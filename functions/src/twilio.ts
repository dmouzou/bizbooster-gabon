import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {assertSuperAdmin, AIRTEL_PREFIXES, MOOV_PREFIXES} from "./index";

// 1. Définition des secrets Twilio pour Secret Manager (defineSecret)
export const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
export const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
export const twilioVerifyServiceSid = defineSecret("TWILIO_VERIFY_SERVICE_SID");

export type SupportedCountry = "GA" | "IN" | "CM" | "ML" | "TG" | "SN" | "GH";

export interface CountryConfig {
  code: SupportedCountry;
  name: string;
  dialCode: string;
  digitsLength: number;
}

export const SUPPORTED_COUNTRIES: Record<SupportedCountry, CountryConfig> = {
  GA: {code: "GA", name: "Gabon", dialCode: "+241", digitsLength: 8},
  CM: {code: "CM", name: "Cameroun", dialCode: "+237", digitsLength: 9},
  SN: {code: "SN", name: "Sénégal", dialCode: "+221", digitsLength: 9},
  ML: {code: "ML", name: "Mali", dialCode: "+223", digitsLength: 8},
  TG: {code: "TG", name: "Togo", dialCode: "+228", digitsLength: 8},
  GH: {code: "GH", name: "Ghana", dialCode: "+233", digitsLength: 9},
  IN: {code: "IN", name: "Inde", dialCode: "+91", digitsLength: 10},
};

export interface TwilioConfigData {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
  isLive: boolean;
  updatedAt?: string;
  updatedBy?: string;
  version?: number;
}

let cachedTwilioConfig: TwilioConfigData | null = null;
let cachedTwilioExpiry = 0;

export function invalidateTwilioConfigCache(): void {
  cachedTwilioConfig = null;
  cachedTwilioExpiry = 0;
}

/**
 * Récupère la configuration Twilio Verify :
 * 1. Priorité au document Firestore `private_config/twilio` (surcharge modifiable par le Super Admin)
 * 2. Repli sur Google Secret Manager / variables d'environnement (process.env)
 * 3. Cache mémoire de 60 secondes pour préserver les quotas de lecture
 */
export async function getTwilioConfig(): Promise<TwilioConfigData> {
  const now = Date.now();
  if (cachedTwilioConfig && cachedTwilioExpiry > now) {
    return cachedTwilioConfig;
  }

  const db = getFirestore();
  let firestoreDoc: Record<string, unknown> | null = null;
  try {
    const snap = await db.collection("private_config").doc("twilio").get();
    if (snap.exists) {
      firestoreDoc = snap.data() || null;
    }
  } catch (err) {
    console.warn("getTwilioConfig: Erreur lecture private_config/twilio:", err);
  }

  let secAccountSid = "";
  let secAuthToken = "";
  let secVerifyServiceSid = "";

  try {
    secAccountSid = twilioAccountSid.value() || process.env.TWILIO_ACCOUNT_SID || "";
  } catch {
    secAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
  }

  try {
    secAuthToken = twilioAuthToken.value() || process.env.TWILIO_AUTH_TOKEN || "";
  } catch {
    secAuthToken = process.env.TWILIO_AUTH_TOKEN || "";
  }

  try {
    secVerifyServiceSid = twilioVerifyServiceSid.value() || process.env.TWILIO_VERIFY_SERVICE_SID || "";
  } catch {
    secVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";
  }

  const accountSid = (firestoreDoc?.accountSid as string) || secAccountSid;
  const authToken = (firestoreDoc?.authToken as string) || secAuthToken;
  const verifyServiceSid = (firestoreDoc?.verifyServiceSid as string) || secVerifyServiceSid;
  const isLive = firestoreDoc?.isLive !== undefined ? Boolean(firestoreDoc.isLive) : true;
  const updatedAt = (firestoreDoc?.updatedAt as string) || undefined;
  const updatedBy = (firestoreDoc?.updatedBy as string) || undefined;
  const version = typeof firestoreDoc?.version === "number" ? firestoreDoc.version : 1;

  cachedTwilioConfig = {
    accountSid,
    authToken,
    verifyServiceSid,
    isLive,
    updatedAt,
    updatedBy,
    version,
  };
  cachedTwilioExpiry = now + 60000;

  return cachedTwilioConfig;
}

/**
 * Détecte le pays à partir de la chaîne de téléphone saisie.
 */
export function detectCountryFromPhoneBackend(raw?: string | null): SupportedCountry | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  if (trimmed.startsWith("+241") || trimmed.startsWith("00241")) return "GA";
  if (trimmed.startsWith("+237") || trimmed.startsWith("00237")) return "CM";
  if (trimmed.startsWith("+221") || trimmed.startsWith("00221")) return "SN";
  if (trimmed.startsWith("+223") || trimmed.startsWith("00223")) return "ML";
  if (trimmed.startsWith("+228") || trimmed.startsWith("00228")) return "TG";
  if (trimmed.startsWith("+233") || trimmed.startsWith("00233")) return "GH";
  if (trimmed.startsWith("+91") || trimmed.startsWith("0091")) return "IN";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("237") && digits.length === 12) return "CM";
  if (digits.startsWith("221") && digits.length === 12) return "SN";
  if (digits.startsWith("223") && digits.length === 11) return "ML";
  if (digits.startsWith("228") && digits.length === 11) return "TG";
  if (digits.startsWith("233") && digits.length === 12) return "GH";
  if (digits.startsWith("91") && digits.length === 12) return "IN";
  if (digits.startsWith("241") && (digits.length === 11 || digits.length === 12)) return "GA";

  return null;
}

/**
 * Normalise un numéro pour n'importe lequel des pays supportés (Gabon, Cameroun, Sénégal, Mali, Togo, Ghana, Inde).
 */
export function normalizePhoneForTwilio(
  input: string,
  countryHint: string = "GA"
): {
  e164: string;
  rawDigits: string;
  country: SupportedCountry;
  operator?: string;
  isValid: boolean;
} {
  const detected = detectCountryFromPhoneBackend(input);
  const targetCountry = (detected || countryHint.toUpperCase()) as SupportedCountry;
  const digits = (input || "").replace(/\D/g, "");

  switch (targetCountry) {
    case "IN": {
      let clean = digits;
      if (clean.startsWith("0091")) clean = clean.slice(4);
      else if (clean.startsWith("91") && clean.length > 10) clean = clean.slice(2);
      if (clean.length === 11 && clean.startsWith("0")) clean = clean.slice(1);
      const isValid = clean.length === 10;
      return {
        e164: `+91${clean}`,
        rawDigits: clean,
        country: "IN",
        operator: "INDIA_MOBILE",
        isValid,
      };
    }

    case "CM": {
      let clean = digits;
      if (clean.startsWith("00237")) clean = clean.slice(5);
      else if (clean.startsWith("237") && clean.length > 9) clean = clean.slice(3);
      if (clean.length === 10 && clean.startsWith("0")) clean = clean.slice(1);
      const isValid = clean.length === 9;
      return {
        e164: `+237${clean}`,
        rawDigits: clean,
        country: "CM",
        operator: "CAMEROON_MOBILE",
        isValid,
      };
    }

    case "SN": {
      let clean = digits;
      if (clean.startsWith("00221")) clean = clean.slice(5);
      else if (clean.startsWith("221") && clean.length > 9) clean = clean.slice(3);
      if (clean.length === 10 && clean.startsWith("0")) clean = clean.slice(1);
      const isValid = clean.length === 9;
      return {
        e164: `+221${clean}`,
        rawDigits: clean,
        country: "SN",
        operator: "SENEGAL_MOBILE",
        isValid,
      };
    }

    case "ML": {
      let clean = digits;
      if (clean.startsWith("00223")) clean = clean.slice(5);
      else if (clean.startsWith("223") && clean.length > 8) clean = clean.slice(3);
      if (clean.length === 9 && clean.startsWith("0")) clean = clean.slice(1);
      const isValid = clean.length === 8;
      return {
        e164: `+223${clean}`,
        rawDigits: clean,
        country: "ML",
        operator: "MALI_MOBILE",
        isValid,
      };
    }

    case "TG": {
      let clean = digits;
      if (clean.startsWith("00228")) clean = clean.slice(5);
      else if (clean.startsWith("228") && clean.length > 8) clean = clean.slice(3);
      if (clean.length === 9 && clean.startsWith("0")) clean = clean.slice(1);
      const isValid = clean.length === 8;
      return {
        e164: `+228${clean}`,
        rawDigits: clean,
        country: "TG",
        operator: "TOGO_MOBILE",
        isValid,
      };
    }

    case "GH": {
      let clean = digits;
      if (clean.startsWith("00233")) clean = clean.slice(5);
      else if (clean.startsWith("233") && clean.length > 9) clean = clean.slice(3);
      if (clean.length === 10 && clean.startsWith("0")) clean = clean.slice(1);
      const isValid = clean.length === 9;
      return {
        e164: `+233${clean}`,
        rawDigits: clean,
        country: "GH",
        operator: "GHANA_MOBILE",
        isValid,
      };
    }

    case "GA":
    default: {
      let clean = digits;
      if (clean.startsWith("00241")) clean = clean.slice(5);
      else if (clean.startsWith("241")) clean = clean.slice(3);
      if (clean.length === 9 && clean.startsWith("0")) clean = clean.slice(1);

      const prefix = clean.slice(0, 2);
      let op = "UNKNOWN";
      if ((AIRTEL_PREFIXES as readonly string[]).includes(prefix)) op = "AIRTEL";
      else if ((MOOV_PREFIXES as readonly string[]).includes(prefix)) op = "MOOV";

      const isValid = clean.length === 8 && op !== "UNKNOWN";
      return {
        e164: `+241${clean}`,
        rawDigits: clean,
        country: "GA",
        operator: op,
        isValid,
      };
    }
  }
}

/**
 * Alias de compatibilité pour le Gabon.
 */
export function normalizeGabonPhoneForTwilio(input: string) {
  return normalizePhoneForTwilio(input, "GA");
}

/**
 * Génère l'e-mail synthétique pour le compte Firebase Auth.
 */
export function toSyntheticEmailBackend(rawDigits: string, country: string = "GA"): string {
  const c = country.toUpperCase();
  switch (c) {
    case "CM":
      return `237${rawDigits}@bizbooster.ga`;
    case "SN":
      return `221${rawDigits}@bizbooster.ga`;
    case "ML":
      return `223${rawDigits}@bizbooster.ga`;
    case "TG":
      return `228${rawDigits}@bizbooster.ga`;
    case "GH":
      return `233${rawDigits}@bizbooster.ga`;
    case "IN":
      return `91${rawDigits}@bizbooster.ga`;
    case "GA":
    default:
      return `${rawDigits}@bizbooster.ga`;
  }
}

/**
 * Effectue un appel HTTP authentifié à l'API Twilio Verify v2 via fetch natif (Node 18+).
 */
async function callTwilioVerifyApi(
  endpoint: string,
  params: Record<string, string>,
  config: TwilioConfigData
): Promise<any> {
  if (!config.accountSid || !config.authToken || !config.verifyServiceSid) {
    throw new HttpsError(
      "failed-precondition",
      "L'API Twilio Verify n'est pas encore configurée. Définissez les clés dans Secret Manager ou depuis le panneau Super Admin."
    );
  }

  const url = `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/${endpoint}`;
  const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;

  const bodyData = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: bodyData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const twilioCode = data?.code;
    const twilioMessage = data?.message || "Erreur inconnue de l'API Twilio Verify";

    console.error("Twilio Verify API Error:", {
      status: response.status,
      twilioCode,
      twilioMessage,
      endpoint,
    });

    if (twilioCode === 60605) {
      throw new HttpsError(
        "permission-denied",
        "L'envoi vers cette destination est bloqué par les Géo-Permissions Twilio. Activez le pays de destination dans Twilio Console > Verify > Services > Settings > Geo-permissions."
      );
    }
    if (twilioCode === 60200) {
      throw new HttpsError("invalid-argument", "Le numéro de téléphone fourni est invalide.");
    }
    if (twilioCode === 60202) {
      throw new HttpsError(
        "resource-exhausted",
        "Trop de demandes de vérification pour ce numéro. Veuillez patienter 10 minutes."
      );
    }
    if (twilioCode === 60203) {
      throw new HttpsError(
        "resource-exhausted",
        "Nombre maximal de tentatives de saisie atteint pour ce code. Veuillez demander un nouveau code."
      );
    }
    if (twilioCode === 20404) {
      throw new HttpsError(
        "not-found",
        "Le Service Verify SID (VA...) est introuvable. Vérifiez la configuration dans le panneau Super Admin."
      );
    }
    if (twilioCode === 20003) {
      throw new HttpsError(
        "unauthenticated",
        "Identifiants Twilio non autorisés (Account SID ou Auth Token incorrects)."
      );
    }

    throw new HttpsError(
      "internal",
      `Échec Twilio Verify (${twilioCode || response.status}): ${twilioMessage}`
    );
  }

  return data;
}

/**
 * ----------------------------------------------------------------------------------
 * FONCTIONS D'ADMINISTRATION POUR LE SUPER ADMIN (Cockpit Back-Office)
 * ----------------------------------------------------------------------------------
 */

/**
 * Récupère la configuration Twilio masquée pour le Super Admin.
 */
export const getTwilioAdminConfig = onCall(
  {
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid],
  },
  async (request) => {
    await assertSuperAdmin(request);
    const cfg = await getTwilioConfig();

    const maskedAccountSid = cfg.accountSid
      ? (cfg.accountSid.length > 6
          ? `${cfg.accountSid.slice(0, 4)}••••••••••••${cfg.accountSid.slice(-4)}`
          : "••••")
      : "";

    const maskedServiceSid = cfg.verifyServiceSid
      ? (cfg.verifyServiceSid.length > 6
          ? `${cfg.verifyServiceSid.slice(0, 4)}••••••••••••${cfg.verifyServiceSid.slice(-4)}`
          : "••••")
      : "";

    return {
      accountSid: maskedAccountSid,
      hasAuthToken: Boolean(cfg.authToken),
      verifyServiceSid: maskedServiceSid,
      isLive: cfg.isLive,
      updatedAt: cfg.updatedAt || null,
      updatedBy: cfg.updatedBy || null,
      version: cfg.version || 1,
    };
  }
);

/**
 * Enregistre ou met à jour la configuration Twilio Verify via le Super Admin.
 */
export const saveTwilioAdminConfig = onCall(
  {
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid],
  },
  async (request) => {
    const uid = await assertSuperAdmin(request);

    // Contrôle d'authentification récente (max 10 minutes)
    const authTime = Number(request.auth?.token?.auth_time || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (authTime > 0 && nowSec - authTime > 600) {
      throw new HttpsError("failed-precondition", "reauth-required");
    }

    const data = (request.data || {}) as {
      accountSid?: string;
      authToken?: string;
      verifyServiceSid?: string;
      isLive?: boolean;
    };

    const currentCfg = await getTwilioConfig();
    const db = getFirestore();

    const updates: Record<string, unknown> = {
      isLive: data.isLive !== undefined ? Boolean(data.isLive) : currentCfg.isLive,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
      version: (currentCfg.version || 1) + 1,
    };

    if (data.accountSid && !data.accountSid.includes("••")) {
      const trimmedSid = data.accountSid.trim();
      if (!/^AC[a-zA-Z0-9]{32}$/.test(trimmedSid)) {
        throw new HttpsError(
          "invalid-argument",
          "Le Account SID Twilio doit commencer par 'AC' et comporter 34 caractères alphanumériques."
        );
      }
      updates.accountSid = trimmedSid;
    }

    if (data.authToken && data.authToken.trim().length > 0) {
      const trimmedToken = data.authToken.trim();
      if (trimmedToken.length < 16) {
        throw new HttpsError(
          "invalid-argument",
          "L'Auth Token Twilio semble trop court (minimum 16 caractères)."
        );
      }
      updates.authToken = trimmedToken;
    }

    if (data.verifyServiceSid && !data.verifyServiceSid.includes("••")) {
      const trimmedServiceSid = data.verifyServiceSid.trim();
      if (!/^VA[a-zA-Z0-9]{32}$/.test(trimmedServiceSid)) {
        throw new HttpsError(
          "invalid-argument",
          "Le Verify Service SID Twilio doit commencer par 'VA' et comporter 34 caractères alphanumériques."
        );
      }
      updates.verifyServiceSid = trimmedServiceSid;
    }

    await db.collection("private_config").doc("twilio").set(updates, {merge: true});
    invalidateTwilioConfigCache();

    // Trace d'audit sécurisée
    await db.collection("gateway_audit").add({
      at: new Date().toISOString(),
      by: uid,
      service: "TWILIO_VERIFY",
      action: "UPDATE_CONFIG",
      hasAccountSid: Boolean(updates.accountSid || currentCfg.accountSid),
      hasAuthToken: Boolean(updates.authToken || currentCfg.authToken),
      hasVerifyServiceSid: Boolean(updates.verifyServiceSid || currentCfg.verifyServiceSid),
      isLive: updates.isLive,
    });

    return {
      success: true,
      message: "Configuration Twilio Verify mise à jour avec succès.",
    };
  }
);

/**
 * Permet au Super Admin de tester l'envoi d'un code OTP sur un numéro de n'importe quel pays supporté (incluant l'Inde).
 */
export const testTwilioOtpSend = onCall(
  {
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid],
  },
  async (request) => {
    await assertSuperAdmin(request);

    const {testPhone, channel = "sms", country = "GA"} = (request.data || {}) as {
      testPhone?: string;
      channel?: "sms" | "whatsapp";
      country?: string;
    };

    if (!testPhone) {
      throw new HttpsError("invalid-argument", "Numéro de test requis.");
    }

    const {e164, isValid, operator, country: resolvedCountry} = normalizePhoneForTwilio(testPhone, country);
    if (!isValid) {
      const info = SUPPORTED_COUNTRIES[resolvedCountry] || SUPPORTED_COUNTRIES.GA;
      throw new HttpsError(
        "invalid-argument",
        `Numéro ${info.name} invalide (${info.digitsLength} chiffres requis). Format attendu pour l'indicatif ${info.dialCode}.`
      );
    }

    const selectedChannel = channel === "whatsapp" ? "whatsapp" : "sms";
    const cfg = await getTwilioConfig();

    const result = await callTwilioVerifyApi(
      "Verifications",
      {
        To: e164,
        Channel: selectedChannel,
      },
      cfg
    );

    return {
      success: true,
      to: e164,
      country: resolvedCountry,
      operator: operator || resolvedCountry,
      channel: selectedChannel,
      status: result.status,
      sid: result.sid,
      message: `Code de test envoyé avec succès au ${e164} (${resolvedCountry}) via ${selectedChannel.toUpperCase()}.`,
    };
  }
);

/**
 * ----------------------------------------------------------------------------------
 * FONCTIONS PUBLIQUES D'AUTHENTIFICATION UTILISATEUR (Frontend Multi-Pays)
 * ----------------------------------------------------------------------------------
 */

/**
 * Envoie un code OTP via Twilio Verify (SMS ou WhatsApp) pour l'ensemble des pays supportés (Gabon, Cameroun, Sénégal, Mali, Togo, Ghana, Inde).
 */
export const sendTwilioOtp = onCall(
  {
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid],
  },
  async (request) => {
    const {phoneNumber, channel = "sms", country = "GA"} = (request.data || {}) as {
      phoneNumber?: string;
      channel?: "sms" | "whatsapp";
      country?: string;
    };

    const targetCountryCode = (country || "GA").toUpperCase() as SupportedCountry;
    if (!SUPPORTED_COUNTRIES[targetCountryCode]) {
      throw new HttpsError(
        "invalid-argument",
        `Le pays sélectionné (${country}) n'est pas pris en charge.`
      );
    }

    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }

    const {e164, rawDigits, operator, isValid, country: resolvedCountry} = normalizePhoneForTwilio(
      phoneNumber,
      targetCountryCode
    );

    const countryInfo = SUPPORTED_COUNTRIES[resolvedCountry];

    if (!isValid) {
      throw new HttpsError(
        "invalid-argument",
        `Numéro ${countryInfo.name} invalide. ${countryInfo.digitsLength} chiffres attendus pour ${countryInfo.dialCode}.`
      );
    }

    const selectedChannel = channel === "whatsapp" ? "whatsapp" : "sms";

    // Protection anti-abus / rate-limiting par pays et numéro
    const db = getFirestore();
    const rateLimitRef = db.collection("otp_rate_limits").doc(`${resolvedCountry}_${rawDigits}`);
    const now = Date.now();

    const rateDoc = await rateLimitRef.get();
    if (rateDoc.exists) {
      const data = rateDoc.data() || {};
      const lastSent = Number(data.lastSentAt || 0);
      const attemptsCount = Number(data.attemptsCount || 0);
      const windowStart = Number(data.windowStart || 0);

      // Cooldown de 30 secondes entre deux renvois
      if (now - lastSent < 30000) {
        const waitSec = Math.ceil((30000 - (now - lastSent)) / 1000);
        throw new HttpsError(
          "resource-exhausted",
          `Veuillez patienter ${waitSec} secondes avant de demander un nouveau code.`
        );
      }

      // Max 5 OTPs par fenêtre de 15 minutes
      if (now - windowStart < 900000 && attemptsCount >= 5) {
        throw new HttpsError(
          "resource-exhausted",
          "Trop de demandes de vérification pour ce numéro. Réessayez dans 15 minutes."
        );
      }
    }

    const cfg = await getTwilioConfig();

    const result = await callTwilioVerifyApi(
      "Verifications",
      {
        To: e164,
        Channel: selectedChannel,
      },
      cfg
    );

    // Mise à jour de la limitation de débit
    await rateLimitRef.set(
      {
        lastSentAt: now,
        attemptsCount: FieldValue.increment(1),
        windowStart: FieldValue.serverTimestamp(),
        channel: selectedChannel,
        country: resolvedCountry,
      },
      {merge: true}
    );

    // Enregistrement métrique pour l'Observatoire / Scalabilité
    try {
      const today = new Date().toISOString().split("T")[0];
      const metricRef = db.doc("system_counters/scalability_metrics");
      await metricRef.set(
        {
          todayDate: today,
          smsSentToday: FieldValue.increment(1),
          smsSentAllTime: FieldValue.increment(1),
          lastSmsSentAt: new Date().toISOString(),
        },
        {merge: true}
      );
    } catch (metricErr) {
      console.warn("Échec incrément compteur scalabilité (non bloquant):", metricErr);
    }

    return {
      success: true,
      channel: selectedChannel,
      status: result.status,
      country: resolvedCountry,
      operator: operator || resolvedCountry,
    };
  }
);

/**
 * Valide le code OTP saisi par l'utilisateur via Twilio Verify pour n'importe quel pays supporté (incluant l'Inde),
 * et génère un Firebase Custom Token permettant la connexion immédiate dans l'application.
 */
export const verifyTwilioOtp = onCall(
  {
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid],
  },
  async (request) => {
    const {phoneNumber, code, mode = "REGISTER", country = "GA"} = (request.data || {}) as {
      phoneNumber?: string;
      code?: string;
      mode?: "REGISTER" | "FORGOT_PASSWORD";
      country?: string;
    };

    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }

    const cleanCode = (code || "").replace(/\D/g, "");
    if (cleanCode.length < 4 || cleanCode.length > 8) {
      throw new HttpsError("invalid-argument", "Code de validation invalide.");
    }

    const {e164, rawDigits, isValid, country: resolvedCountry} = normalizePhoneForTwilio(
      phoneNumber,
      country
    );

    if (!isValid) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone invalide.");
    }

    const cfg = await getTwilioConfig();

    // Appel Twilio Verify pour valider le code
    const verificationCheck = await callTwilioVerifyApi(
      "VerificationCheck",
      {
        To: e164,
        Code: cleanCode,
      },
      cfg
    );

    if (verificationCheck.status !== "approved") {
      throw new HttpsError(
        "invalid-argument",
        "Code de vérification incorrect ou expiré. Veuillez vérifier le code reçu."
      );
    }

    const db = getFirestore();
    const authAdmin = getAuth();
    const syntheticEmail = toSyntheticEmailBackend(rawDigits, resolvedCountry);

    // 1. Recherche du compte existant dans Firebase Auth & Firestore
    let existingAuthUser: any = null;
    try {
      existingAuthUser = await authAdmin.getUserByEmail(syntheticEmail);
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") {
        console.warn("Erreur recherche getUserByEmail:", e);
      }
    }

    const phoneCandidates = [e164, rawDigits, `0${rawDigits}`];
    if (resolvedCountry === "GA") {
      phoneCandidates.push(`+2410${rawDigits}`);
    }

    const userDocByPhone = await db
      .collection("users")
      .where("contactPhone", "in", phoneCandidates)
      .limit(1)
      .get();

    const hasFirestoreProfile = !userDocByPhone.empty;
    const existingDocUid = hasFirestoreProfile ? userDocByPhone.docs[0].id : null;

    if (mode === "REGISTER") {
      // Si un compte existe déjà dans Firestore avec ce numéro, bloquer l'inscription
      if (hasFirestoreProfile) {
        throw new HttpsError(
          "already-exists",
          "Ce numéro possède déjà un compte BizBooster. Veuillez vous connecter avec votre mot de passe."
        );
      }

      // Si un compte Auth résiduel orphelin existe sans profil Firestore, on le nettoie pour repartir propre
      if (existingAuthUser && !hasFirestoreProfile) {
        try {
          await authAdmin.deleteUser(existingAuthUser.uid);
        } catch (delErr) {
          console.warn("Suppression utilisateur Auth orphelin:", delErr);
        }
      }

      // Créer un nouvel identifiant unique pour le futur profil
      const newUid = db.collection("users").doc().id;
      const customToken = await authAdmin.createCustomToken(newUid, {
        role: "USER",
        phoneVerified: true,
        country: resolvedCountry,
      });

      return {
        success: true,
        customToken,
        isNewUser: true,
        e164,
        country: resolvedCountry,
      };
    }

    if (mode === "FORGOT_PASSWORD") {
      // En mode renouvellement de mot de passe, le compte DOIT exister
      const targetUid = existingDocUid || existingAuthUser?.uid;

      if (!targetUid) {
        throw new HttpsError(
          "not-found",
          "Aucun compte associé à ce numéro de téléphone. Veuillez créer un compte."
        );
      }

      const customToken = await authAdmin.createCustomToken(targetUid, {
        role: "USER",
        phoneVerified: true,
        country: resolvedCountry,
      });

      return {
        success: true,
        customToken,
        isNewUser: false,
        e164,
        country: resolvedCountry,
      };
    }

    throw new HttpsError("invalid-argument", `Mode inconnu: ${mode}`);
  }
);
