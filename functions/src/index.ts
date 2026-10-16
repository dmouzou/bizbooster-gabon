import {onSchedule} from "firebase-functions/v2/scheduler";
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {
  getFirestore,
  AggregateField,
  FieldValue,
} from "firebase-admin/firestore";
import {getAuth, UserRecord} from "firebase-admin/auth";
import {initializeApp} from "firebase-admin/app";
import * as crypto from "crypto";
import {isAdVipCornerEligible} from "./vipCorner";
import {calculateServerPrice} from "./pricing";

initializeApp();

/**
 * Normalise un numéro de téléphone gabonais (+241).
 *
 * @param {string} input - Le numéro de téléphone saisi.
 * @return {{e164: string, rawDigits: string}} Format E.164 et chiffres bruts.
 */
function normalizeGabonPhone(input: string): {
  e164: string;
  rawDigits: string;
} {
  const digits = (input || "").replace(/\D/g, "");
  let clean = digits;
  if (clean.startsWith("00241")) {
    clean = clean.slice(5);
  } else if (clean.startsWith("241")) {
    clean = clean.slice(3);
  }
  if (clean.length === 9 && clean.startsWith("0")) {
    clean = clean.slice(1);
  }
  return {
    e164: `+241${clean}`,
    rawDigits: clean,
  };
}

/**
 * Normalise un numéro international pour les 7 pays supportés.
 *
 * @param {string} input - Le numéro saisi.
 * @return {{e164: string, rawDigits: string}} Format E.164 et chiffres bruts.
 */
function normalizeInternationalPhone(input: string): {
  e164: string;
  rawDigits: string;
} {
  const str = input || "";
  const digits = str.replace(/\D/g, "");

  if (str.startsWith("+237") || digits.startsWith("00237")) {
    const clean = digits.startsWith("00237") ?
      digits.slice(5) : digits.slice(3);
    return {e164: `+237${clean}`, rawDigits: clean};
  }
  if (str.startsWith("+221") || digits.startsWith("00221")) {
    const clean = digits.startsWith("00221") ?
      digits.slice(5) : digits.slice(3);
    return {e164: `+221${clean}`, rawDigits: clean};
  }
  if (str.startsWith("+223") || digits.startsWith("00223")) {
    const clean = digits.startsWith("00223") ?
      digits.slice(5) : digits.slice(3);
    return {e164: `+223${clean}`, rawDigits: clean};
  }
  if (str.startsWith("+228") || digits.startsWith("00228")) {
    const clean = digits.startsWith("00228") ?
      digits.slice(5) : digits.slice(3);
    return {e164: `+228${clean}`, rawDigits: clean};
  }
  if (str.startsWith("+233") || digits.startsWith("00233")) {
    const clean = digits.startsWith("00233") ?
      digits.slice(5) : digits.slice(3);
    return {e164: `+233${clean}`, rawDigits: clean};
  }
  if (
    str.startsWith("+91") ||
    digits.startsWith("0091") ||
    (digits.startsWith("91") && digits.length > 10)
  ) {
    let clean = digits;
    if (clean.startsWith("0091")) {
      clean = clean.slice(4);
    } else if (clean.startsWith("91") && clean.length > 10) {
      clean = clean.slice(2);
    }
    if (clean.length === 11 && clean.startsWith("0")) {
      clean = clean.slice(1);
    }
    return {e164: `+91${clean}`, rawDigits: clean};
  }
  return normalizeGabonPhone(input);
}

/**
 * Résout l'utilisateur Firebase Auth correspondant à un compte (Section 0.5).
 *
 * @param {string} docId - ID du document utilisateur dans Firestore.
 * @param {string} rawDigits - Chiffres du numéro pour l'e-mail synthétique.
 * @param {string} e164 - Numéro normalisé au format E.164.
 * @return {Promise<UserRecord>} L'utilisateur Auth résolu.
 */
export async function resolveAuthUser(
  docId: string,
  rawDigits: string,
  e164: string
): Promise<UserRecord> {
  const authAdmin = getAuth();
  if (docId) {
    try {
      return await authAdmin.getUser(docId);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        throw err;
      }
    }
  }
  if (rawDigits) {
    try {
      return await authAdmin.getUserByEmail(`${rawDigits}@bizbooster.ga`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        throw err;
      }
    }
  }
  if (e164) {
    try {
      return await authAdmin.getUserByPhoneNumber(e164);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/user-not-found") {
        throw err;
      }
    }
  }
  throw new HttpsError(
    "not-found",
    "Utilisateur Firebase Auth introuvable pour ce compte."
  );
}

// Table des quotas partagée (Phase 7 - Décision D3: Standard = 0)
export const SUBSCRIPTION_QUOTAS: Record<string, number> = {
  STANDARD: 0,
  PRO: 8,
  ELITE: 14,
  BUSINESS: 20,
  VIP_EXEMPT: 20,
};

// Numéros de test Firebase Auth (Phase 8) sans code secret
export const FIREBASE_TEST_PHONE_NUMBERS = [
  "+24167256341",
  "+24167896902",
  "+24177276895",
  "+24177905165",
  "+24177000000",
  "+24166000000",
  "+24174000000",
];

/**
 * 2. Expiration automatique des annonces et gestion des dépassements de
 * quota (Phase 7) :
 * - Expire les annonces actives dont la date de validité est passée.
 * - Découpe les écritures en batches de 500 opérations max.
 * - Ignore les partenaires avec isExempt ou exemptFromPaymentAndKyc lors
 *   des rétrogradations et suspensions.
 * - Rétrograde les abonnements expirés (PRO/ELITE/BUSINESS vers STANDARD).
 * - Suspend automatiquement les annonces excédentaires au-delà du quota
 *   Standard (3 annonces).
 */
export const expireAds = onSchedule("every 60 minutes", async () => {
  const db = getFirestore();
  const now = new Date().toISOString();
  const CHUNK_SIZE = 500;

  // A. Expirer les annonces dont expiresAt <= now
  const expiredAdsSnap = await db
    .collection("ads")
    .where("status", "==", "ACTIVE")
    .where("expiresAt", "<=", now)
    .get();

  const expiredDocs = expiredAdsSnap.docs;
  for (let i = 0; i < expiredDocs.length; i += CHUNK_SIZE) {
    const chunk = expiredDocs.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach((doc) =>
      batch.update(doc.ref, {status: "EXPIRED", updatedAt: now})
    );
    await batch.commit();
  }

  // A2. Terminer les boosts échus (isFeatured: false si featuredUntil <= now)
  const expiredBoostsSnap = await db
    .collection("ads")
    .where("isFeatured", "==", true)
    .where("featuredUntil", "<=", now)
    .get();

  for (let i = 0; i < expiredBoostsSnap.docs.length; i += CHUNK_SIZE) {
    const chunk = expiredBoostsSnap.docs.slice(i, i + CHUNK_SIZE);
    const boostBatch = db.batch();
    chunk.forEach((d) => {
      boostBatch.update(d.ref, {isFeatured: false, updatedAt: now});
    });
    await boostBatch.commit();
  }

  // B. Détecter les utilisateurs dont l'abonnement mensuel a expiré
  const expiredUsersSnap = await db
    .collection("users")
    .where("subscriptionTier", "in", ["PRO", "ELITE", "BUSINESS"])
    .where("subscriptionExpiresAt", "<=", now)
    .get();

  for (const userDoc of expiredUsersSnap.docs) {
    const userData = userDoc.data() || {};

    // Ignore les partenaires exemptés lors des rétrogradations et
    // suspensions (Phase 7)
    if (userData.isExempt || userData.exemptFromPaymentAndKyc) {
      continue;
    }

    const userId = userDoc.id;

    // Rétrograde en STANDARD
    await userDoc.ref.update({
      subscriptionTier: "STANDARD",
      subscriptionExpiredAt: now,
      updatedAt: now,
    });

    // Mettre à jour ownerTier sur les annonces de l'utilisateur rétrogradé
    const userRemainingAdsSnap = await db
      .collection("ads")
      .where("userId", "==", userId)
      .where("status", "in", ["ACTIVE", "PENDING_REVIEW"])
      .get();
    for (let i = 0; i < userRemainingAdsSnap.docs.length; i += CHUNK_SIZE) {
      const chunk = userRemainingAdsSnap.docs.slice(i, i + CHUNK_SIZE);
      const tierBatch = db.batch();
      chunk.forEach((d) => {
        tierBatch.update(d.ref, {
          ownerTier: "STANDARD",
          isOwnerVip: false,
          updatedAt: now,
        });
      });
      await tierBatch.commit();
    }

    // Quota Standard partagé (3 annonces actives max)
    const standardQuota = SUBSCRIPTION_QUOTAS.STANDARD || 3;
    const activeAdsSnap = await db
      .collection("ads")
      .where("userId", "==", userId)
      .where("status", "==", "ACTIVE")
      .get();

    if (activeAdsSnap.size > standardQuota) {
      const sortedDocs = [...activeAdsSnap.docs].sort((a, b) => {
        const tA = new Date(
          a.data().createdAt || a.data().publishedAt || 0
        ).getTime();
        const tB = new Date(
          b.data().createdAt || b.data().publishedAt || 0
        ).getTime();
        return tA - tB;
      });

      const excessDocs = sortedDocs.slice(standardQuota);
      for (let i = 0; i < excessDocs.length; i += CHUNK_SIZE) {
        const chunk = excessDocs.slice(i, i + CHUNK_SIZE);
        const quotaBatch = db.batch();
        chunk.forEach((doc) => {
          quotaBatch.update(doc.ref, {
            status: "SUSPENDED",
            suspensionReason: "FORFAIT_EXPIRE_QUOTA",
            suspendedAt: now,
            updatedAt: now,
          });
        });
        await quotaBatch.commit();
      }
    }
  }
});

/**
 * 3. Mise à jour des compteurs de l'Observatoire (system_counters)
 * Optimisé Phase 7 :
 * - Ignore les écritures limitées à l'incrément de vues ou signalements.
 * - Utilise des requêtes d'agrégation count() et sum() natives O(1).
 */
export const updateCounters = onDocumentWritten(
  "ads/{adId}",
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;

    // Si modification : ignorer si seules views ou reports ont changé
    if (before?.exists && after?.exists) {
      const beforeData = before.data() || {};
      const afterData = after.data() || {};

      const allKeys = new Set([
        ...Object.keys(beforeData),
        ...Object.keys(afterData),
      ]);
      let onlyViewsOrReports = true;
      for (const key of allKeys) {
        if (
          key !== "viewsCount" &&
        key !== "reportsCount" &&
        key !== "updatedAt"
        ) {
          if (
            JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])
          ) {
            onlyViewsOrReports = false;
            break;
          }
        }
      }
      if (onlyViewsOrReports) {
        return;
      }
    }

    const db = getFirestore();
    const activeQuery = db.collection("ads").where("status", "==", "ACTIVE");

    const countSnap = await activeQuery.count().get();
    const totalActiveAds = countSnap.data().count;

    const aggregateSnap = await activeQuery
      .aggregate({
        totalValue: AggregateField.sum("price"),
      })
      .get();
    const totalCatalogValue = aggregateSnap.data().totalValue || 0;

    await db.doc("system_counters/global").set(
      {
        totalActiveAds,
        totalCatalogValueFCFA: totalCatalogValue,
        updatedAt: new Date().toISOString(),
      },
      {merge: true}
    );
  });

interface SingPayTransactionData {
  id?: string;
  _id?: string;
  reference?: string;
  status?: string;
  result?: string;
  amount?: string | number;
  client_msisdn?: string;
}

interface SingPayResponsePayload {
  transaction?: SingPayTransactionData;
  status?: {
    code?: string;
    message?: string;
    success?: boolean;
    result_code?: string;
  };
  message?: string;
}

// Phase 6: Définition des secrets SingPay via Secret Manager (defineSecret)
const singpayClientId = defineSecret("SINGPAY_CLIENT_ID");
const singpayClientSecret = defineSecret("SINGPAY_CLIENT_SECRET");
const singpayWalletId = defineSecret("SINGPAY_WALLET_ID");
const singpayWebhookSecret = defineSecret("SINGPAY_WEBHOOK_SECRET");
const singpayMoovDisbursement = defineSecret("SINGPAY_MOOV_DISBURSEMENT");
const singpayAirtelDisbursement = defineSecret("SINGPAY_AIRTEL_DISBURSEMENT");

// Table des préfixes d'opérateurs stricte (Phase 6)
export const MOOV_PREFIXES = ["60", "62", "65", "66"];
export const AIRTEL_PREFIXES = ["74", "76", "77"];

// Catalogue des produits et tarification officielle côté serveur (Phase 6)
export const SERVER_PRODUCTS: Record<string, number> = {
  SUB_PRO: 29000,
  PRO: 29000,
  SUB_ELITE: 59000,
  ELITE: 59000,
  SUB_BUSINESS: 99000,
  BUSINESS: 99000,
  BOOST_SINGLE: 5000,
  SINGLE: 5000,
  BOOST_5: 15000,
  BOOST_10: 25000,
};

export interface SingPayConfigData {
  clientId: string;
  clientSecret: string;
  walletId: string;
  webhookSecret: string;
  moovDisbursement: string;
  airtelDisbursement: string;
  isLive: boolean;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
}

let cachedSingPayConfig: SingPayConfigData | null = null;
let cachedConfigExpiry = 0;

export function clearSingPayConfigCache() {
  cachedSingPayConfig = null;
  cachedConfigExpiry = 0;
}

/**
 * Récupère la configuration SingPay :
 * 1. Document Firestore private_config/singpay (source de vérité)
 * 2. Repli sur Secret Manager / process.env si non configuré
 * 3. Cache mémoire de 60 secondes
 * 4. Aucun repli webhookSecret = clientSecret
 */
export async function getSingPayConfig(): Promise<SingPayConfigData> {
  const now = Date.now();
  if (cachedSingPayConfig && cachedConfigExpiry > now) {
    return cachedSingPayConfig;
  }

  const db = getFirestore();
  let firestoreDoc: Record<string, unknown> | null = null;
  try {
    const snap = await db.collection("private_config").doc("singpay").get();
    if (snap.exists) {
      firestoreDoc = snap.data() || null;
    }
  } catch (err) {
    console.warn("getSingPayConfig: Erreur lecture private_config/singpay:", err);
  }

  let secClientId = "";
  let secClientSecret = "";
  let secWalletId = "";
  let secWebhookSecret = "";
  let secMoovDisbursement = "";
  let secAirtelDisbursement = "";

  try {
    secClientId = singpayClientId.value() || process.env.SINGPAY_CLIENT_ID || "";
  } catch {
    secClientId = process.env.SINGPAY_CLIENT_ID || "";
  }
  try {
    secClientSecret = singpayClientSecret.value() || process.env.SINGPAY_CLIENT_SECRET || "";
  } catch {
    secClientSecret = process.env.SINGPAY_CLIENT_SECRET || "";
  }
  try {
    secWalletId = singpayWalletId.value() || process.env.SINGPAY_WALLET_ID || "";
  } catch {
    secWalletId = process.env.SINGPAY_WALLET_ID || "";
  }
  try {
    secWebhookSecret = singpayWebhookSecret.value() || process.env.SINGPAY_WEBHOOK_SECRET || "";
  } catch {
    secWebhookSecret = process.env.SINGPAY_WEBHOOK_SECRET || "";
  }
  try {
    secMoovDisbursement = singpayMoovDisbursement.value() || process.env.SINGPAY_MOOV_DISBURSEMENT || "";
  } catch {
    secMoovDisbursement = process.env.SINGPAY_MOOV_DISBURSEMENT || "";
  }
  try {
    secAirtelDisbursement = singpayAirtelDisbursement.value() || process.env.SINGPAY_AIRTEL_DISBURSEMENT || "";
  } catch {
    secAirtelDisbursement = process.env.SINGPAY_AIRTEL_DISBURSEMENT || "";
  }

  const clientId = (firestoreDoc?.clientId as string) || secClientId;
  const clientSecret = (firestoreDoc?.clientSecret as string) || secClientSecret;
  const walletId = (firestoreDoc?.walletId as string) || secWalletId;
  const webhookSecret = (firestoreDoc?.webhookSecret as string) || secWebhookSecret;
  const moovDisbursement = (firestoreDoc?.moovDisbursement as string) || secMoovDisbursement;
  const airtelDisbursement = (firestoreDoc?.airtelDisbursement as string) || secAirtelDisbursement;
  const isLive = firestoreDoc?.isLive !== undefined ? Boolean(firestoreDoc.isLive) : true;
  const version = typeof firestoreDoc?.version === "number" ? firestoreDoc.version : 1;
  const updatedAt = (firestoreDoc?.updatedAt as string) || undefined;
  const updatedBy = (firestoreDoc?.updatedBy as string) || undefined;

  cachedSingPayConfig = {
    clientId,
    clientSecret,
    walletId,
    webhookSecret,
    moovDisbursement,
    airtelDisbursement,
    isLive,
    version,
    updatedAt,
    updatedBy,
  };
  cachedConfigExpiry = now + 60000;

  return cachedSingPayConfig;
}

/**
 * Vérifie les privilèges Super Admin.
 * Exige request.auth, puis vérifie le rôle SUPER_ADMIN ou SUPER ADMIN
 * dans le jeton ou dans users/{uid}.role (ou users/{uid}.isSuperAdmin === true).
 */
export async function assertSuperAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): Promise<string> {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Authentification requise pour cette opération."
    );
  }

  const tokenRole = request.auth.token.role;
  const isTokenSuperAdmin =
    tokenRole === "SUPER_ADMIN" ||
    tokenRole === "SUPER ADMIN" ||
    request.auth.token.isSuperAdmin === true;

  if (isTokenSuperAdmin) {
    return request.auth.uid;
  }

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data() || {};
    const dbRole = userData.role;
    if (
      dbRole === "SUPER_ADMIN" ||
      dbRole === "SUPER ADMIN" ||
      userData.isSuperAdmin === true
    ) {
      return request.auth.uid;
    }
  }

  throw new HttpsError(
    "permission-denied",
    "Accès réservé exclusivement au Super Administrateur."
  );
}

export function maskNumber(val?: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `+241 •• •• ${digits.slice(-4)}`;
}

export function validateNoControlOrWhitespace(value: string, fieldName: string) {
  if (/\s/.test(value)) {
    throw new HttpsError(
      "invalid-argument",
      `Le champ ${fieldName} ne doit pas contenir d'espaces internes.`
    );
  }
  if (/[\x00-\x1F\x7F]/.test(value)) {
    throw new HttpsError(
      "invalid-argument",
      `Le champ ${fieldName} contient des caractères de contrôle non autorisés.`
    );
  }
}

export function normalizeMoovDisbursement(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let clean = digits;
  if (clean.startsWith("241")) clean = clean.slice(3);
  if (clean.startsWith("0")) clean = clean.slice(1);
  if (clean.length !== 8) {
    throw new HttpsError(
      "invalid-argument",
      "Le numéro Moov Money doit comporter 8 chiffres après l'indicatif."
    );
  }
  const prefix = clean.slice(0, 2);
  if (!MOOV_PREFIXES.includes(prefix)) {
    throw new HttpsError(
      "invalid-argument",
      `Le numéro Moov doit commencer par un préfixe Moov (${MOOV_PREFIXES.join(", ")}).`
    );
  }
  return `241${clean}`;
}

export function normalizeAirtelDisbursement(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let clean = digits;
  if (clean.startsWith("241")) clean = clean.slice(3);
  if (clean.startsWith("0")) clean = clean.slice(1);
  if (clean.length !== 8) {
    throw new HttpsError(
      "invalid-argument",
      "Le numéro Airtel Money doit comporter 8 chiffres après l'indicatif."
    );
  }
  const prefix = clean.slice(0, 2);
  if (!AIRTEL_PREFIXES.includes(prefix)) {
    throw new HttpsError(
      "invalid-argument",
      `Le numéro Airtel doit commencer par un préfixe Airtel (${AIRTEL_PREFIXES.join(", ")}).`
    );
  }
  return `241${clean}`;
}

/**
 * Renvoie la configuration de la passerelle au Super Admin (masquage strict des secrets).
 */
export const getGatewayConfig = onCall(
  {
    cors: true,
    secrets: [
      singpayClientId,
      singpayClientSecret,
      singpayWalletId,
      singpayWebhookSecret,
      singpayMoovDisbursement,
      singpayAirtelDisbursement,
    ],
  },
  async (request) => {
    await assertSuperAdmin(request);
    const cfg = await getSingPayConfig();

    const maskedClientId = cfg.clientId
      ? (cfg.clientId.length > 4 ? `••••••••••••${cfg.clientId.slice(-4)}` : "••••")
      : "";

    const projectId = process.env.GCLOUD_PROJECT || "bizbooster-gabon";
    const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/singpayWebhook`;

    return {
      clientId: maskedClientId,
      hasClientSecret: Boolean(cfg.clientSecret),
      hasWebhookSecret: Boolean(cfg.webhookSecret),
      walletId: cfg.walletId,
      moovDisbursement: cfg.moovDisbursement,
      airtelDisbursement: cfg.airtelDisbursement,
      isLive: cfg.isLive,
      updatedAt: cfg.updatedAt || null,
      updatedBy: cfg.updatedBy || null,
      version: cfg.version || 1,
      webhookUrl,
    };
  }
);

/**
 * Enregistre les clés et numéros de reversement configurés par le Super Admin.
 */
export const saveGatewayConfig = onCall(
  {
    cors: true,
    secrets: [
      singpayClientId,
      singpayClientSecret,
      singpayWalletId,
      singpayWebhookSecret,
      singpayMoovDisbursement,
      singpayAirtelDisbursement,
    ],
  },
  async (request) => {
    const uid = await assertSuperAdmin(request);

    // Reconnexion récente exigée (max 10 minutes)
    const authTime = Number(request.auth?.token?.auth_time || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (authTime > 0 && (nowSec - authTime > 600)) {
      throw new HttpsError(
        "failed-precondition",
        "reauth-required"
      );
    }

    const data = (request.data || {}) as {
      clientId?: string;
      clientSecret?: string;
      walletId?: string;
      moovDisbursement?: string;
      airtelDisbursement?: string;
      isLive?: boolean;
      rotateWebhookSecret?: boolean;
    };

    const db = getFirestore();

    // Limite de débit : 10 enregistrements par heure
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const recentAudits = await db
      .collection("gateway_audit")
      .where("at", ">=", oneHourAgo)
      .get();
    if (recentAudits.size >= 10) {
      throw new HttpsError(
        "resource-exhausted",
        "Limite de 10 enregistrements par heure atteinte pour la passerelle."
      );
    }

    const projectId = process.env.GCLOUD_PROJECT || "bizbooster-gabon";
    const webhookBaseUrl = `https://us-central1-${projectId}.cloudfunctions.net/singpayWebhook`;
    let generatedWebhookUrl: string | null = null;
    let newWebhookSecret: string | null = null;

    if (data.rotateWebhookSecret === true) {
      newWebhookSecret = crypto.randomBytes(32).toString("hex");
      generatedWebhookUrl = `${webhookBaseUrl}?secret=${newWebhookSecret}`;
    }

    if (data.clientId !== undefined && data.clientId !== "") {
      validateNoControlOrWhitespace(data.clientId, "Client ID");
      if (data.clientId.length > 256) {
        throw new HttpsError("invalid-argument", "Client ID trop long (max 256).");
      }
    }
    if (data.clientSecret !== undefined && data.clientSecret !== "") {
      validateNoControlOrWhitespace(data.clientSecret, "Client Secret");
      if (data.clientSecret.length > 256) {
        throw new HttpsError("invalid-argument", "Client Secret trop long (max 256).");
      }
    }
    if (data.walletId !== undefined && data.walletId !== "") {
      validateNoControlOrWhitespace(data.walletId, "Wallet ID");
      if (data.walletId.length > 128) {
        throw new HttpsError("invalid-argument", "Wallet ID trop long (max 128).");
      }
    }

    let normalizedMoov: string | undefined;
    if (data.moovDisbursement !== undefined && data.moovDisbursement !== "") {
      validateNoControlOrWhitespace(data.moovDisbursement, "Numéro Moov");
      normalizedMoov = normalizeMoovDisbursement(data.moovDisbursement);
    }

    let normalizedAirtel: string | undefined;
    if (data.airtelDisbursement !== undefined && data.airtelDisbursement !== "") {
      validateNoControlOrWhitespace(data.airtelDisbursement, "Numéro Airtel");
      normalizedAirtel = normalizeAirtelDisbursement(data.airtelDisbursement);
    }

    const configRef = db.collection("private_config").doc("singpay");
    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(configRef);
      const current = snap.exists ? (snap.data() as SingPayConfigData) : ({} as Partial<SingPayConfigData>);
      const version = ((current.version as number) || 0) + 1;

      const changedFields: string[] = [];
      const updates: Record<string, unknown> = {
        version,
        updatedAt: nowIso,
        updatedBy: uid,
      };

      if (data.clientId !== undefined && data.clientId !== "") {
        updates.clientId = data.clientId;
        changedFields.push("clientId");
      }
      if (data.clientSecret !== undefined && data.clientSecret !== "") {
        updates.clientSecret = data.clientSecret;
        changedFields.push("clientSecret");
      }
      if (data.walletId !== undefined && data.walletId !== "") {
        updates.walletId = data.walletId;
        changedFields.push("walletId");
      }
      if (data.isLive !== undefined) {
        updates.isLive = Boolean(data.isLive);
        changedFields.push("isLive");
      }
      if (newWebhookSecret) {
        updates.webhookSecret = newWebhookSecret;
        changedFields.push("webhookSecret");
      }

      let disbursementChanged = false;
      let oldMoovMasked = maskNumber(current.moovDisbursement);
      let newMoovMasked = oldMoovMasked;
      if (normalizedMoov !== undefined) {
        updates.moovDisbursement = normalizedMoov;
        changedFields.push("moovDisbursement");
        disbursementChanged = true;
        newMoovMasked = maskNumber(normalizedMoov);
      }

      let oldAirtelMasked = maskNumber(current.airtelDisbursement);
      let newAirtelMasked = oldAirtelMasked;
      if (normalizedAirtel !== undefined) {
        updates.airtelDisbursement = normalizedAirtel;
        changedFields.push("airtelDisbursement");
        disbursementChanged = true;
        newAirtelMasked = maskNumber(normalizedAirtel);
      }

      tx.set(configRef, updates, {merge: true});

      // Ligne d'audit (sans aucune valeur secrète)
      const auditRef = db.collection("gateway_audit").doc();
      tx.set(auditRef, {
        at: nowIso,
        uid,
        changedFields,
        disbursementChanged,
        oldMoovMasked,
        newMoovMasked,
        oldAirtelMasked,
        newAirtelMasked,
        version,
      });

      return {
        success: true,
        version,
        changedFields,
        webhookUrl: generatedWebhookUrl,
      };
    });

    clearSingPayConfigCache();
    return result;
  }
);

/**
 * Migration ponctuelle depuis settings/payment_gateway vers private_config/singpay.
 */
export const migrateGatewayConfig = onCall(
  {cors: true},
  async (request) => {
    const uid = await assertSuperAdmin(request);
    const db = getFirestore();
    const oldRef = db.collection("settings").doc("payment_gateway");
    const oldSnap = await oldRef.get();
    if (!oldSnap.exists) {
      return {migrated: false, message: "Aucune ancienne configuration à migrer."};
    }

    const data = oldSnap.data() || {};
    const newDoc: Record<string, unknown> = {
      clientId: data.singpayClientId || data.clientId || "",
      clientSecret: data.singpayClientSecret || data.clientSecret || "",
      walletId: data.singpayWalletId || data.walletId || "",
      webhookSecret: data.singpayWebhookSecret || data.webhookSecret || "",
      moovDisbursement: data.moovDisbursementNumber || data.moovDisbursement || "",
      airtelDisbursement: data.airtelDisbursementNumber || data.airtelDisbursement || "",
      isLive: data.isLive ?? true,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };

    await db.collection("private_config").doc("singpay").set(newDoc, {merge: true});
    await oldRef.delete();
    clearSingPayConfigCache();
    return {migrated: true, version: 1};
  }
);

export {calculateServerPrice};


/**
 * Attribution sécurisée des avantages après paiement validé SUCCESS.
 * Exécutée exclusivement côté serveur avec le SDK Admin.
 *
 * @param {string} paymentRefOrId Référence ou ID du document paiement.
 * @return {Promise<boolean>} Indique si l'attribution a réussi.
 */
export async function applyPaymentAttribution(
  paymentRefOrId: string
): Promise<boolean> {
  const db = getFirestore();
  const paymentDocRef = db.collection("payments").doc(paymentRefOrId);
  const paymentSnap = await paymentDocRef.get();
  if (!paymentSnap.exists) {
    console.warn(
      `applyPaymentAttribution: Paiement ${paymentRefOrId} introuvable.`
    );
    return false;
  }

  const payment = paymentSnap.data() || {};
  if (payment.status !== "SUCCESS") {
    console.warn(
      `applyPaymentAttribution: Statut non SUCCESS pour ${paymentRefOrId}.`
    );
    return false;
  }

  if (payment.attributed === true) {
    // Déjà attribué (idempotence)
    return true;
  }

  const userId = payment.userId as string;
  if (!userId) {
    console.warn(
      `applyPaymentAttribution: Aucun userId sur ${paymentRefOrId}.`
    );
    return false;
  }

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.warn(
      `applyPaymentAttribution: Utilisateur ${userId} introuvable.`
    );
    return false;
  }
  const userData = userSnap.data() || {};

  const productId = (payment.productId as string) || "";
  const metadata = (payment.metadata as Record<string, unknown>) || {};
  const now = new Date();

  // 1. Abonnements
  if (productId === "SUB_PRO" || productId === "PRO") {
    const currentBoosts = Number(userData.freeBoostsRemaining || 0);
    await userRef.update({
      subscriptionTier: "PRO",
      subscriptionStartedAt: now.toISOString(),
      subscriptionExpiresAt: new Date(
        now.getTime() + 30 * 86400000
      ).toISOString(),
      freeBoostsRemaining: Math.min(20, currentBoosts + 1),
      consumedFreeAdsCount: 0,
      updatedAt: now.toISOString(),
    });
  } else if (productId === "SUB_ELITE" || productId === "ELITE") {
    const currentBoosts = Number(userData.freeBoostsRemaining || 0);
    await userRef.update({
      subscriptionTier: "ELITE",
      subscriptionStartedAt: now.toISOString(),
      subscriptionExpiresAt: new Date(
        now.getTime() + 30 * 86400000
      ).toISOString(),
      freeBoostsRemaining: Math.min(20, currentBoosts + 3),
      consumedFreeAdsCount: 0,
      updatedAt: now.toISOString(),
    });
  } else if (productId === "SUB_BUSINESS" || productId === "BUSINESS") {
    const currentBoosts = Number(userData.freeBoostsRemaining || 0);
    await userRef.update({
      subscriptionTier: "BUSINESS",
      subscriptionStartedAt: now.toISOString(),
      subscriptionExpiresAt: new Date(
        now.getTime() + 30 * 86400000
      ).toISOString(),
      freeBoostsRemaining: Math.min(20, currentBoosts + 6),
      consumedFreeAdsCount: 0,
      updatedAt: now.toISOString(),
    });
  } else if (productId === "BOOST_SINGLE" || productId === "SINGLE") {
    // 2. Boost individuel
    const adId = metadata.adId as string;
    if (adId) {
      const adRef = db.collection("ads").doc(adId);
      const adSnap = await adRef.get();
      if (adSnap.exists) {
        const adData = adSnap.data() || {};
        const existingUntil = adData.featuredUntil ?
          new Date(adData.featuredUntil).getTime() : 0;
        const baseUntil = Math.max(existingUntil, now.getTime());
        await adRef.update({
          isFeatured: true,
          featuredAt: (adData.isFeatured && adData.featuredAt) ?
            adData.featuredAt : now.toISOString(),
          featuredUntil: new Date(baseUntil + 7 * 86400000).toISOString(),
          updatedAt: now.toISOString(),
        });
      }
    } else {
      const currentBoosts = Number(userData.freeBoostsRemaining || 0);
      await userRef.update({
        freeBoostsRemaining: Math.min(20, currentBoosts + 1),
        updatedAt: now.toISOString(),
      });
    }
  } else if (productId === "BOOST_5") {
    // 3. Pack 5 Boosters
    const adId = metadata.adId as string;
    const currentBoosts = Number(userData.freeBoostsRemaining || 0);
    if (adId) {
      const adRef = db.collection("ads").doc(adId);
      const adSnap = await adRef.get();
      if (adSnap.exists) {
        const adData = adSnap.data() || {};
        const existingUntil = adData.featuredUntil ?
          new Date(adData.featuredUntil).getTime() : 0;
        const baseUntil = Math.max(existingUntil, now.getTime());
        await adRef.update({
          isFeatured: true,
          featuredAt: (adData.isFeatured && adData.featuredAt) ?
            adData.featuredAt : now.toISOString(),
          featuredUntil: new Date(baseUntil + 7 * 86400000).toISOString(),
          updatedAt: now.toISOString(),
        });
      }
      await userRef.update({
        freeBoostsRemaining: Math.min(20, currentBoosts + 4),
        activeBoosterPack: "BOOST_5",
        updatedAt: now.toISOString(),
      });
    } else {
      await userRef.update({
        freeBoostsRemaining: Math.min(20, currentBoosts + 5),
        activeBoosterPack: "BOOST_5",
        updatedAt: now.toISOString(),
      });
    }
  } else if (productId === "BOOST_10") {
    // 4. Pack 10 Boosters
    const adId = metadata.adId as string;
    const currentBoosts = Number(userData.freeBoostsRemaining || 0);
    if (adId) {
      const adRef = db.collection("ads").doc(adId);
      const adSnap = await adRef.get();
      if (adSnap.exists) {
        const adData = adSnap.data() || {};
        const existingUntil = adData.featuredUntil ?
          new Date(adData.featuredUntil).getTime() : 0;
        const baseUntil = Math.max(existingUntil, now.getTime());
        await adRef.update({
          isFeatured: true,
          featuredAt: (adData.isFeatured && adData.featuredAt) ?
            adData.featuredAt : now.toISOString(),
          featuredUntil: new Date(baseUntil + 7 * 86400000).toISOString(),
          updatedAt: now.toISOString(),
        });
      }
      await userRef.update({
        freeBoostsRemaining: Math.min(20, currentBoosts + 9),
        activeBoosterPack: "BOOST_10",
        updatedAt: now.toISOString(),
      });
    } else {
      await userRef.update({
        freeBoostsRemaining: Math.min(20, currentBoosts + 10),
        activeBoosterPack: "BOOST_10",
        updatedAt: now.toISOString(),
      });
    }
  } else if (productId === "AD_EXTEND") {
    // 5. Prolongation d'annonce
    const adId = metadata.adId as string;
    const days = Number(metadata.days || 0);
    if (adId && days > 0) {
      const adRef = db.collection("ads").doc(adId);
      const adSnap = await adRef.get();
      if (adSnap.exists) {
        const adData = adSnap.data() || {};
        const currentExp = adData.expiresAt ?
          new Date(adData.expiresAt).getTime() :
          now.getTime();
        const baseTime = Math.max(currentExp, now.getTime());
        const newExpiresAt = new Date(baseTime + days * 86400000).toISOString();
        await adRef.update({
          expiresAt: newExpiresAt,
          status: "ACTIVE",
          updatedAt: now.toISOString(),
        });
      }
    }
  } else if (productId === "AD_PUBLISH") {
    // 6. Publication avec achat d'abonnement
    if (metadata.requiresSubscription && metadata.selectedTierToBuy) {
      const tier = String(metadata.selectedTierToBuy);
      const boostsToAdd = tier === "BUSINESS" ? 6 : tier === "ELITE" ? 3 : 1;
      const currentBoosts = Number(userData.freeBoostsRemaining || 0);
      let finalBoosts = Math.min(20, currentBoosts + boostsToAdd);
      if (metadata.withBoost) {
        finalBoosts = Math.max(0, finalBoosts - 1);
      }
      await userRef.update({
        subscriptionTier: tier,
        subscriptionStartedAt: now.toISOString(),
        subscriptionExpiresAt: new Date(
          now.getTime() + 30 * 86400000
        ).toISOString(),
        freeBoostsRemaining: finalBoosts,
        consumedFreeAdsCount: 0,
        updatedAt: now.toISOString(),
      });
    }
  }

  // Marquer le paiement comme attribué
  await paymentDocRef.update({
    attributed: true,
    attributedAt: now.toISOString(),
  });

  return true;
}

/**
 * 4. Passerelle SingPay Gabon (Paiement Moov Money / Airtel Money réel)
 * Déclenche un appel à l'API SingPay pour envoyer un USSD Push sur le mobile.
 */
export const initiateSingPayPayment = onCall(
  {
    cors: true,
    secrets: [
      singpayClientId,
      singpayClientSecret,
      singpayWalletId,
      singpayMoovDisbursement,
      singpayAirtelDisbursement,
    ],
  },
  async (request) => {
    // Exiger une session connectée (0.4)
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour initier un paiement."
      );
    }

    const {
      amount,
      productId,
      metadata,
      phoneNumber,
      itemDescription,
      operator,
    } = request.data || {};

    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }

    const requestedOperator =
      operator === "AIRTEL_MONEY" ? "AIRTEL_MONEY" : "MOOV_MONEY";

    const {e164, rawDigits} = normalizeGabonPhone(String(phoneNumber));

    // Validation stricte des opérateurs (Phase 6 : Moov / Airtel)
    const isMoov = MOOV_PREFIXES.some((p) => rawDigits.startsWith(p));
    const isAirtel = AIRTEL_PREFIXES.some((p) => rawDigits.startsWith(p));

    if (requestedOperator === "MOOV_MONEY" && !isMoov) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro Moov Money invalide (préfixes requis: 060, 062, 065, 066)."
      );
    }

    if (requestedOperator === "AIRTEL_MONEY" && !isAirtel) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro Airtel Money invalide (préfixes requis: 074, 076, 077)."
      );
    }

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};

    const isExempt = Boolean(
      userData.isExempt || userData.exemptFromPaymentAndKyc
    );
    const quota =
      SUBSCRIPTION_QUOTAS[userData.subscriptionTier || "STANDARD"] || 3;
    const consumed = Number(userData.consumedFreeAdsCount || 0);
    const isCoveredByQuota = consumed < quota;

    // Calcul du prix côté serveur : ne jamais faire confiance au montant client
    let serverAmount = 0;
    if (productId) {
      serverAmount = calculateServerPrice(
        productId,
        metadata as Record<string, unknown> | undefined,
        userData.subscriptionTier as string | undefined,
        isExempt,
        isCoveredByQuota
      );
    } else if (amount && Number(amount) > 0) {
      serverAmount = Number(amount);
    } else {
      throw new HttpsError("invalid-argument", "Produit ou montant invalide.");
    }

    if (serverAmount <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Le montant de transaction doit être supérieur à 0 FCFA."
      );
    }

    // Référence générée côté serveur, unique par UID et horodatée
    const uidPrefix = request.auth.uid.slice(0, 8);
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const serverReference =
      `BZB_${uidPrefix}_${Date.now()}_${randSuffix}`;

    const clientMsisdn = `241${rawDigits}`;

    // Récupération des secrets SingPay
    const cfg = await getSingPayConfig();
    const clientId = cfg.clientId;
    const clientSecret = cfg.clientSecret;
    const walletId = cfg.walletId;

    if (!clientId || !clientSecret || !walletId) {
      throw new HttpsError(
        "failed-precondition",
        "Identifiants SingPay manquants dans Secret Manager."
      );
    }

    // Numéro de reversement depuis les secrets (aucun repli codé en dur)
    const rawDisbursement =
      requestedOperator === "AIRTEL_MONEY" ?
        cfg.airtelDisbursement :
        cfg.moovDisbursement;

    if (!rawDisbursement) {
      throw new HttpsError(
        "failed-precondition",
        `Reversement non configuré dans les secrets pour ${requestedOperator}.`
      );
    }

    const disbDigits = rawDisbursement.replace(/\D/g, "");
    let disbursement = disbDigits;
    if (disbDigits.startsWith("241")) {
      disbursement = disbDigits;
    } else if (disbDigits.startsWith("0")) {
      disbursement = `241${disbDigits.slice(1)}`;
    } else if (disbDigits.length === 8) {
      disbursement = `241${disbDigits}`;
    }

    const paymentPayload = {
      amount: serverAmount,
      reference: serverReference,
      client_msisdn: clientMsisdn,
      portefeuille: walletId,
      disbursement: disbursement,
      isTransfer: false,
    };

    const operatorEndpointCode =
      requestedOperator === "AIRTEL_MONEY" ? "74" : "62";
    const paymentUrl = `https://gateway.singpay.ga/v1/${operatorEndpointCode}/paiement`;

    try {
      const resp = await fetch(paymentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-wallet": walletId,
        },
        body: JSON.stringify(paymentPayload),
      });

      const responseText = await resp.text();
      let responseJson: SingPayResponsePayload | null = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // Plain text
      }

      if (!resp.ok || !responseJson?.status?.success) {
        const errorMsg =
          responseJson?.status?.message ||
          responseJson?.message ||
          responseText ||
          `Erreur SingPay code ${resp.status}`;
        throw new HttpsError("internal", `SingPay: ${errorMsg}`);
      }

      const singpayTx = responseJson.transaction || {};
      const singpayTxId = singpayTx.id || singpayTx._id || "";

      // Document payment avec UID propriétaire (.create() anti-écrasement)
      await db.collection("payments").doc(serverReference).create({
        reference: serverReference,
        userId: request.auth.uid,
        productId: productId || null,
        metadata: metadata || {},
        singpayTransactionId: singpayTxId,
        amount: serverAmount,
        operator: requestedOperator,
        clientPhone: e164,
        clientMsisdn,
        disbursementPhone: disbursement,
        itemDescription: itemDescription || "Paiement BIZBOOSTER Gabon",
        status: "PENDING",
        attributed: false,
        singpayStatus: singpayTx.status || "Start",
        singpayResult: singpayTx.result || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const operatorLabel =
        requestedOperator === "AIRTEL_MONEY" ? "Airtel Money" : "Moov Money";
      return {
        success: true,
        reference: serverReference,
        transactionId: singpayTxId,
        amount: serverAmount,
        status: "PENDING",
        message: `Demande USSD Push envoyée sur le mobile ${operatorLabel}.`,
      };
    } catch (err: unknown) {
      if (err instanceof HttpsError) {
        throw err;
      }
      const e = err as Error;
      throw new HttpsError("internal", `SingPay communication: ${e.message}`);
    }
  }
);

/**
 * 5. Vérification du statut d'une transaction SingPay
 */
export const checkSingPayPaymentStatus = onCall(
  {
    cors: true,
    secrets: [
      singpayClientId,
      singpayClientSecret,
      singpayWalletId,
    ],
  },
  async (request) => {
    const {transactionId, reference} = request.data || {};

    if (!reference && !transactionId) {
      throw new HttpsError(
        "invalid-argument",
        "Référence ou ID de transaction requis."
      );
    }

    const db = getFirestore();
    let paymentDocRef = null;
    let paymentData: Record<string, unknown> | null = null;

    if (reference) {
      paymentDocRef = db.collection("payments").doc(String(reference));
      const snap = await paymentDocRef.get();
      if (snap.exists) {
        paymentData = snap.data() || null;
      }
    }

    if (paymentData?.status === "SUCCESS") {
      // Déclencher l'attribution si pas encore faite
      if (!paymentData.attributed && paymentDocRef) {
        await applyPaymentAttribution(paymentDocRef.id);
      }
      return {
        status: "SUCCESS",
        result: "Success",
        reference: paymentData.reference as string,
        transactionId: paymentData.singpayTransactionId as string,
        message: "Paiement validé avec succès.",
      };
    }

    const cfg = await getSingPayConfig();
    const clientId = cfg.clientId;
    const clientSecret = cfg.clientSecret;
    const walletId = cfg.walletId;

    if (!clientId || !clientSecret) {
      return {
        status: (paymentData?.status as string) || "PENDING",
        message: "Clés SingPay non configurées dans Secret Manager.",
      };
    }

    const targetTxId =
      transactionId || (paymentData?.singpayTransactionId as string);
    let endpoint = "";
    const headers: Record<string, string> = {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    };

    if (targetTxId) {
      endpoint = `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(
        targetTxId
      )}`;
    } else if (reference) {
      endpoint = `https://gateway.singpay.ga/v1/transaction/api/search/by-reference/${encodeURIComponent(
        reference
      )}`;
      headers["x-wallet"] = walletId;
    }

    try {
      const resp = await fetch(endpoint, {
        method: "GET",
        headers,
      });

      const responseText = await resp.text();
      let responseJson: SingPayResponsePayload | null = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // Plain text
      }

      if (!resp.ok) {
        return {
          status: (paymentData?.status as string) || "PENDING",
          message: "En attente de validation auprès de l'opérateur.",
        };
      }

      const tx = responseJson?.transaction || {};
      const txStatus = tx.status || "";
      const txResult = tx.result || "";

      let finalStatus = "PENDING";
      let failureReason = "";

      if (
        txResult === "Success" ||
        (txStatus === "Terminate" && txResult === "Success")
      ) {
        finalStatus = "SUCCESS";
      } else if (txResult === "PasswordError") {
        finalStatus = "FAILED";
        failureReason = "Code PIN erroné saisi sur le mobile.";
      } else if (txResult === "BalanceError") {
        finalStatus = "FAILED";
        failureReason = "Solde mobile insuffisant sur le compte client.";
      } else if (txResult === "TimeOutError") {
        finalStatus = "FAILED";
        failureReason = "Délai d'attente dépassé (timeout USSD).";
      } else if (
        txResult === "Error" ||
        (txStatus === "Terminate" && txResult && txResult !== "Success")
      ) {
        finalStatus = "FAILED";
        failureReason = "Paiement refusé ou annulé par l'utilisateur.";
      }

      if (
        paymentDocRef &&
        (finalStatus !== paymentData?.status ||
          txStatus !== paymentData?.singpayStatus)
      ) {
        await paymentDocRef.set(
          {
            status: finalStatus,
            singpayStatus: txStatus,
            singpayResult: txResult,
            failureReason: failureReason || null,
            updatedAt: new Date().toISOString(),
          },
          {merge: true}
        );

        if (finalStatus === "SUCCESS") {
          await applyPaymentAttribution(paymentDocRef.id);
        }
      }

      return {
        status: finalStatus,
        result: txResult,
        singpayStatus: txStatus,
        failureReason,
        transactionId: tx.id || targetTxId,
        reference: tx.reference || reference,
      };
    } catch (err: unknown) {
      const e = err as Error;
      return {
        status: (paymentData?.status as string) || "PENDING",
        message: e.message,
      };
    }
  }
);

/**
 * 6. Webhook de rappel officiel SingPay
 */
export const singpayWebhook = onRequest(
  {
    cors: true,
    secrets: [
      singpayClientId,
      singpayClientSecret,
      singpayWebhookSecret,
    ],
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({error: "Method Not Allowed"});
        return;
      }

      const cfg = await getSingPayConfig();
      const expectedSecret = cfg.webhookSecret;

      const receivedSecret =
        (req.headers["x-webhook-secret"] as string) ||
        (req.headers["x-client-secret"] as string) ||
        (req.query.secret as string);

      // Rejeter tout appel falsifié ou non authentifié avec 401 (0.4)
      if (!expectedSecret || receivedSecret !== expectedSecret) {
        console.warn(
          "singpayWebhook: appel non autorisé (secret manquant ou invalide)"
        );
        res.status(401).json({error: "Unauthorized"});
        return;
      }

      const data = (req.body || {}) as {
        transaction?: SingPayTransactionData;
        id?: string;
        _id?: string;
        reference?: string;
        result?: string;
        status?: string;
      };
      const tx: SingPayTransactionData = data.transaction || data;
      const reference = tx.reference;
      const result = tx.result;
      const status = tx.status;

      if (!reference) {
        res.status(400).json({error: "Missing reference"});
        return;
      }

      const db = getFirestore();
      const docRef = db.collection("payments").doc(String(reference));
      const paySnap = await docRef.get();
      if (!paySnap.exists) {
        res.status(404).json({error: "Payment not found"});
        return;
      }

      const clientId = cfg.clientId;
      const clientSecret = cfg.clientSecret;

      let verifiedStatus = status;
      let verifiedResult = result;

      // Réinterroger l'API SingPay côté serveur pour certifier le statut
      const txId = tx.id || tx._id;
      if (clientId && clientSecret && txId) {
        try {
          const resp = await fetch(
            `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(txId)}`,
            {
              method: "GET",
              headers: {
                "x-client-id": clientId,
                "x-client-secret": clientSecret,
              },
            }
          );
          if (resp.ok) {
            const json = (await resp.json()) as SingPayResponsePayload;
            if (json?.transaction) {
              verifiedStatus = json.transaction.status;
              verifiedResult = json.transaction.result;
            }
          }
        } catch (fetchErr) {
          console.warn(
            "singpayWebhook: validation statut côté serveur échouée:",
            fetchErr
          );
        }
      }

      const isSuccess =
        verifiedResult === "Success" ||
        (verifiedStatus === "Terminate" && verifiedResult === "Success");

      await docRef.set(
        {
          singpayTransactionId: txId || null,
          singpayStatus: verifiedStatus || null,
          singpayResult: verifiedResult || null,
          status: isSuccess ? "SUCCESS" : verifiedResult ? "FAILED" : "PENDING",
          updatedAt: new Date().toISOString(),
          rawWebhookPayload: data,
        },
        {merge: true}
      );

      if (isSuccess) {
        await applyPaymentAttribution(String(reference));
      }

      res.status(200).json({received: true});
    } catch (err: unknown) {
      const e = err as Error;
      res.status(500).json({error: e.message});
    }
  }
);

/**
 * Déclencheur Firestore sur écriture de paiement :
 * Si statut SUCCESS et non encore attribué, applique l'attribution.
 */
export const onPaymentStatusChange = onDocumentWritten(
  "payments/{paymentId}",
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return;
    const data = after.data() || {};
    if (data.status === "SUCCESS" && !data.attributed) {
      await applyPaymentAttribution(event.params.paymentId);
    }
  }
);

/**
 * Fonction appelable permettant au client de réclamer/attendre
 * l'attribution des bénéfices après confirmation du paiement.
 */
export const claimPaymentBenefits = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour réclamer les bénéfices."
      );
    }
    const {reference} = request.data || {};
    if (!reference) {
      throw new HttpsError(
        "invalid-argument",
        "Référence de paiement requise."
      );
    }
    const db = getFirestore();
    const paySnap = await db
      .collection("payments")
      .doc(String(reference))
      .get();
    if (!paySnap.exists) {
      throw new HttpsError("not-found", "Paiement introuvable.");
    }
    const payData = paySnap.data() || {};
    if (payData.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Accès non autorisé.");
    }
    if (payData.status !== "SUCCESS") {
      throw new HttpsError(
        "failed-precondition",
        "Le paiement n'a pas encore été validé avec succès."
      );
    }
    const attributed = await applyPaymentAttribution(String(reference));
    return {success: attributed};
  }
);

/**
 * 7. Enregistrement atomique des SMS envoyés côté serveur (Phase 8).
 * Utilise FieldValue.increment(1) et ignore les numéros de test Firebase.
 */
export const recordSmsSent = onCall(
  {cors: true},
  async (request) => {
    const {phoneNumber} = request.data || {};
    const {e164} = normalizeInternationalPhone(phoneNumber);

    if (e164 && FIREBASE_TEST_PHONE_NUMBERS.includes(e164)) {
      return {success: true, test: true};
    }

    const db = getFirestore();
    const today = new Date().toISOString().split("T")[0];
    await db.doc("system_counters/scalability_metrics").set(
      {
        todayDate: today,
        smsSentToday: FieldValue.increment(1),
        smsSentAllTime: FieldValue.increment(1),
        lastSmsSentAt: new Date().toISOString(),
      },
      {merge: true}
    );

    return {success: true};
  }
);

/**
 * Vérifie si l'utilisateur appelant possède les prérogatives d'administrateur.
 * @param {string} uid - L'identifiant utilisateur.
 * @param {object} [authData] - Le contexte d'authentification.
 * @return {Promise<boolean>} Vrai si administrateur.
 */
async function checkIsAdmin(
  uid: string,
  authData?: {token?: Record<string, unknown>}
): Promise<boolean> {
  const role = authData?.token?.role;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "SUPER ADMIN"
  ) {
    return true;
  }
  const db = getFirestore();
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return false;
  const data = userDoc.data() || {};
  return (
    data.role === "ADMIN" ||
    data.role === "SUPER_ADMIN" ||
    data.role === "SUPER ADMIN" ||
    data.isAdmin === true ||
    data.isSuperAdmin === true
  );
}

/**
 * Calcule le palier effectif et les badges VIP/Vérifié d'un utilisateur.
 * @param {Record<string, unknown>} userData - Profil utilisateur.
 * @return {object} Palier effectif et statuts VIP.
 */
function computeEffectiveOwnerTier(userData: Record<string, unknown>): {
  ownerTier: string;
  isOwnerVip: boolean;
  isOwnerVerified: boolean;
} {
  const isExempt = Boolean(
    userData.isExempt || userData.exemptFromPaymentAndKyc
  );
  let ownerTier = (userData.subscriptionTier as string) || "STANDARD";
  if (!isExempt && ownerTier !== "STANDARD") {
    const expiresAt = userData.subscriptionExpiresAt ?
      new Date(userData.subscriptionExpiresAt as string).getTime() : 0;
    if (expiresAt > 0 && expiresAt <= Date.now()) {
      ownerTier = "STANDARD";
    }
  }
  const isOwnerVip = ownerTier === "VIP" || isExempt;
  const isOwnerVerified =
    isOwnerVip ||
    userData.idVerificationStatus === "VERIFIED" ||
    userData.isKycVerified === true;
  return {ownerTier, isOwnerVip, isOwnerVerified};
}

/**
 * Phase 2 - 1. onAdCreated : Initialisation serveur des annonces.
 * Pose ownerTier, isOwnerVip, isOwnerVerified, isVipCorner, vérifie le paiement
 * ou applique le quota gratuit côté serveur.
 */
export const onAdCreated = onDocumentCreated(
  "ads/{adId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const adData = snap.data() || {};
    const userId = adData.userId;
    if (!userId) return;

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};

    const effective = computeEffectiveOwnerTier(userData);
    const isVip = isAdVipCornerEligible({
      ...adData,
      isVipCorner: effective.isOwnerVip ? true : undefined,
    });

    const isExempt = Boolean(
      userData.isExempt || userData.exemptFromPaymentAndKyc
    );
    const quota =
      SUBSCRIPTION_QUOTAS[effective.ownerTier || "STANDARD"] || 3;
    const consumed = Number(userData.consumedFreeAdsCount || 0);
    const isCoveredByQuota = consumed < quota;

    // Vérification du statut de l'annonceur dans l'annuaire (Phase 2 - 10)
    let isRegistered = false;
    try {
      const sysConfigSnap = await db.doc("settings/system_config").get();
      if (sysConfigSnap.exists) {
        const sysConfig = sysConfigSnap.data() || {};
        const registeredUserIds =
          (sysConfig.registeredUserIds as string[]) || [];
        const registeredPhones =
          (sysConfig.registeredPhones as string[]) || [];
        const rawPhone = (userData.contactPhone ||
          userData.phoneNumber ||
          adData.contactPhone ||
          "") as string;
        const cleanUserPhone = rawPhone.replace(/\D/g, "");
        isRegistered =
          registeredUserIds.includes(userId) ||
          (cleanUserPhone.length >= 6 &&
            registeredPhones.some((p: string) =>
              p.includes(cleanUserPhone) || cleanUserPhone.includes(p)
            ));
      }
    } catch (cfgErr) {
      console.warn("onAdCreated: Erreur lecture system_config:", cfgErr);
    }

    const updates: Record<string, unknown> = {
      ownerTier: effective.ownerTier,
      isOwnerVip: effective.isOwnerVip,
      isOwnerVerified: effective.isOwnerVerified,
      isVipCorner: isVip,
      advertiserApproved: isRegistered,
      isTest: !isRegistered,
      updatedAt: new Date().toISOString(),
    };

    // Vérification de couverture de paiement
    const paymentReference = adData.paymentReference;
    if (paymentReference) {
      const paySnap = await db
        .collection("payments")
        .doc(String(paymentReference))
        .get();
      if (paySnap.exists) {
        const payData = paySnap.data() || {};
        if (
          payData.status === "SUCCESS" &&
          payData.userId === userId
        ) {
          updates.paidAmount = payData.amount || 0;
          updates.paymentMethod = payData.operator || null;
          updates.transactionRef =
            payData.singpayTransactionId ||
            payData.transactionId ||
            paymentReference;
          updates.paymentVerified = true;
          if (payData.metadata?.withBoost) {
            updates.boostRequested = true;
          }
        } else {
          updates.status = "REJECTED";
          updates.moderationReason = "PAIEMENT_NON_VERIFIE";
          updates.paymentVerified = false;
        }
      } else {
        updates.status = "REJECTED";
        updates.moderationReason = "PAIEMENT_NON_VERIFIE";
        updates.paymentVerified = false;
      }
    } else {
      if (isExempt) {
        updates.paymentVerified = true;
      } else if (isCoveredByQuota) {
        updates.paymentVerified = true;
        // Incrémente le quota côté serveur
        if (userDoc.exists) {
          await userDoc.ref.update({
            consumedFreeAdsCount: FieldValue.increment(1),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        updates.status = "REJECTED";
        updates.moderationReason = "PAIEMENT_NON_VERIFIE";
        updates.paymentVerified = false;
      }
    }

    await snap.ref.update(updates);
  }
);

/**
 * Phase 5 - 1. Mise en pause du boost si une annonce active
 * repasse en modération.
 */
export const onAdStatusUpdated = onDocumentUpdated(
  "ads/{adId}",
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};

    if (
      before.status === "ACTIVE" &&
      after.status === "PENDING_REVIEW" &&
      after.isFeatured
    ) {
      if (!after.featuredPausedAt) {
        await event.data?.after?.ref.update({
          featuredPausedAt: new Date().toISOString(),
        });
      }
    }
  }
);

/**
 * Phase 2 - 2. approveAd : Validation d'annonce par un administrateur.
 * Démarre le compteur de validité et le boost de 7 jours à la validation.
 */
export const approveAd = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const isAdmin = await checkIsAdmin(request.auth.uid, request.auth);
    if (!isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Accès réservé aux administrateurs."
      );
    }

    const {adId} = request.data || {};
    if (!adId) {
      throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
    }

    const db = getFirestore();
    const adRef = db.collection("ads").doc(String(adId));
    const adSnap = await adRef.get();
    if (!adSnap.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }

    const ad = adSnap.data() || {};
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (ad.pendingExtension) {
      const base = Math.max(
        ad.expiresAt ? new Date(ad.expiresAt).getTime() : now,
        now
      );
      const maxExpiry = now + 365 * 86400000;
      const requestedDays = Math.min(
        Number(ad.pendingExtension.days) || 30,
        365
      );
      const computedExpiry = base + requestedDays * 86400000;
      const newExpiry = new Date(
        Math.min(computedExpiry, maxExpiry)
      ).toISOString();
      const effectiveAddedDays = Math.max(
        1,
        Math.round((new Date(newExpiry).getTime() - base) / 86400000)
      );

      await adRef.update({
        status: "ACTIVE",
        expiresAt: newExpiry,
        durationDays: Math.min(
          365,
          (Number(ad.durationDays) || 0) + effectiveAddedDays
        ),
        paymentMethod:
          ad.pendingExtension.operator || ad.paymentMethod || null,
        transactionRef:
          ad.pendingExtension.transactionRef || ad.transactionRef || null,
        pendingExtension: FieldValue.delete(),
        moderatedAt: nowIso,
        moderationReason: FieldValue.delete(),
        updatedAt: nowIso,
      });
    } else {
      const durationDays = Number(ad.durationDays) || 30;
      const expiresAt = new Date(now + durationDays * 86400000).toISOString();
      const updates: Record<string, unknown> = {
        status: "ACTIVE",
        publishedAt: ad.publishedAt || nowIso,
        expiresAt,
        moderatedAt: nowIso,
        moderationReason: FieldValue.delete(),
        updatedAt: nowIso,
      };

      // Si le boost était en pause pendant la re-modération, le prolonger
      if (ad.featuredPausedAt && ad.featuredUntil) {
        const pausedAtMs = new Date(ad.featuredPausedAt).getTime();
        const pauseDuration = Math.max(0, now - pausedAtMs);
        const newFeaturedUntil = new Date(
          new Date(ad.featuredUntil).getTime() + pauseDuration
        ).toISOString();
        updates.isFeatured = true;
        updates.featuredUntil = newFeaturedUntil;
        updates.featuredPausedAt = FieldValue.delete();
      } else if (ad.boostRequested || ad.withBoost) {
        updates.isFeatured = true;
        updates.featuredAt = nowIso;
        updates.featuredUntil = new Date(now + 7 * 86400000).toISOString();
        updates.boostRequested = FieldValue.delete();
        updates.withBoost = FieldValue.delete();
      }

      await adRef.update(updates);
    }

    return {success: true, adId};
  }
);

/**
 * Phase 2 - 3. boostAd : Activation d'un boost gratuit côté serveur.
 * Transaction Firestore garantissant l'intégrité du solde et la prolongation.
 */
export const boostAd = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour booster une annonce."
      );
    }
    const {adId} = request.data || {};
    if (!adId) {
      throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
    }

    const db = getFirestore();
    const adRef = db.collection("ads").doc(String(adId));
    const userRef = db.collection("users").doc(request.auth.uid);

    return await db.runTransaction(async (transaction) => {
      const adSnap = await transaction.get(adRef);
      if (!adSnap.exists) {
        throw new HttpsError("not-found", "Annonce introuvable.");
      }
      const ad = adSnap.data() || {};
      if (ad.userId !== request.auth!.uid) {
        throw new HttpsError(
          "permission-denied",
          "Vous n'êtes pas le propriétaire de cette annonce."
        );
      }
      if (ad.status !== "ACTIVE") {
        throw new HttpsError(
          "failed-precondition",
          "Seule une annonce active peut être boostée."
        );
      }
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      if (ad.expiresAt && new Date(ad.expiresAt).getTime() <= now) {
        throw new HttpsError(
          "failed-precondition",
          "Impossible de booster une annonce expirée."
        );
      }

      const userSnap = await transaction.get(userRef);
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const isExempt = Boolean(
        userData.isExempt ||
        userData.exemptFromPaymentAndKyc ||
        userData.subscriptionTier === "VIP"
      );
      const freeBoosts = Number(userData.freeBoostsRemaining || 0);

      if (!isExempt && freeBoosts <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "Solde de boosters gratuit insuffisant."
        );
      }

      if (!isExempt) {
        transaction.update(userRef, {
          freeBoostsRemaining: Math.max(0, freeBoosts - 1),
          updatedAt: nowIso,
        });
      }

      const existingUntil = ad.featuredUntil ?
        new Date(ad.featuredUntil).getTime() : 0;
      const baseUntil = Math.max(existingUntil, now);
      const newFeaturedUntil = new Date(baseUntil + 7 * 86400000).toISOString();

      const adUpdates: Record<string, unknown> = {
        isFeatured: true,
        featuredUntil: newFeaturedUntil,
        updatedAt: nowIso,
      };
      if (!ad.isFeatured || !ad.featuredAt) {
        adUpdates.featuredAt = nowIso;
      }
      transaction.update(adRef, adUpdates);

      return {
        success: true,
        featuredUntil: newFeaturedUntil,
        freeBoostsRemaining: isExempt ?
          freeBoosts :
          Math.max(0, freeBoosts - 1),
      };
    });
  }
);

/**
 * Phase 2 - 5. syncOwnerTierOnUserChange : Mise à jour en cascade des annonces
 * lors de la modification de l'abonnement ou du statut KYC de l'utilisateur.
 */
export const syncOwnerTierOnUserChange = onDocumentUpdated(
  "users/{uid}",
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};

    const tierChanged = before.subscriptionTier !== after.subscriptionTier;
    const expiryChanged =
      before.subscriptionExpiresAt !== after.subscriptionExpiresAt;
    const exemptChanged =
      before.isExempt !== after.isExempt ||
      before.exemptFromPaymentAndKyc !== after.exemptFromPaymentAndKyc;
    const kycChanged =
      before.idVerificationStatus !== after.idVerificationStatus ||
      before.isKycVerified !== after.isKycVerified;

    if (!tierChanged && !expiryChanged && !exemptChanged && !kycChanged) {
      return;
    }

    const effective = computeEffectiveOwnerTier(after);
    const db = getFirestore();
    const CHUNK_SIZE = 500;

    const adsSnap = await db
      .collection("ads")
      .where("userId", "==", event.params.uid)
      .where("status", "in", ["ACTIVE", "PENDING_REVIEW"])
      .get();

    for (let i = 0; i < adsSnap.docs.length; i += CHUNK_SIZE) {
      const chunk = adsSnap.docs.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach((d) => {
        const adData = d.data();
        const isVip = isAdVipCornerEligible({
          ...adData,
          isVipCorner: effective.isOwnerVip ? true : undefined,
        });
        batch.update(d.ref, {
          ownerTier: effective.ownerTier,
          isOwnerVip: effective.isOwnerVip,
          isOwnerVerified: effective.isOwnerVerified,
          isVipCorner: isVip,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
  }
);

/**
 * Phase 2 - 7. registerView : Enregistrement atomique des vues d'annonces.
 * Ignore le propriétaire et déduplique par 24h.
 */
export const registerView = onCall(
  {cors: true},
  async (request) => {
    const {adId, deviceId} = request.data || {};
    if (!adId) {
      throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
    }

    const db = getFirestore();
    const adRef = db.collection("ads").doc(String(adId));
    const adSnap = await adRef.get();
    if (!adSnap.exists) {
      return {counted: false, reason: "not_found"};
    }
    const ad = adSnap.data() || {};
    if (ad.status !== "ACTIVE") {
      return {counted: false, reason: "not_active"};
    }
    // Ignore le propriétaire de l'annonce
    if (request.auth && ad.userId === request.auth.uid) {
      return {counted: false, reason: "owner"};
    }

    const viewerKey = request.auth?.uid ?
      `user_${request.auth.uid}` :
      `device_${String(deviceId || "anon").replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    const viewDocId = `${adId}_${viewerKey}`;
    const viewRef = db.collection("ad_views").doc(viewDocId);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const viewSnap = await viewRef.get();
    if (viewSnap.exists) {
      const lastViewed = viewSnap.data()?.viewedAt ?
        new Date(viewSnap.data()?.viewedAt).getTime() : 0;
      if (now - lastViewed < 24 * 3600 * 1000) {
        return {counted: false, reason: "deduplicated"};
      }
    }

    await viewRef.set(
      {
        adId: String(adId),
        viewerKey,
        viewedAt: nowIso,
        expiresAt: new Date(now + 7 * 86400000).toISOString(),
      },
      {merge: true}
    );

    await adRef.update({
      viewsCount: FieldValue.increment(1),
    });

    return {counted: true};
  }
);

/**
 * Phase 2 - 8. extendAdVip : Prolongation réservée aux VIP / exemptés.
 */
export const extendAdVip = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const {adId, days} = request.data || {};
    if (!adId) {
      throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
    }

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const isVipExempt = Boolean(
      userData.isExempt ||
      userData.exemptFromPaymentAndKyc ||
      userData.subscriptionTier === "VIP"
    );
    if (!isVipExempt) {
      throw new HttpsError(
        "permission-denied",
        "Réservé aux membres VIP et partenaires exemptés."
      );
    }

    const adRef = db.collection("ads").doc(String(adId));
    const adSnap = await adRef.get();
    if (!adSnap.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adSnap.data() || {};
    if (ad.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Accès non autorisé.");
    }

    const now = Date.now();
    const base = Math.max(
      ad.expiresAt ? new Date(ad.expiresAt).getTime() : now,
      now
    );
    const requestedDays = Math.min(Number(days) || 30, 365);
    const maxExpiry = now + 365 * 86400000;
    const computedExpiry = Math.min(base + requestedDays * 86400000, maxExpiry);
    const newExpiresAt = new Date(computedExpiry).toISOString();
    const effectiveAddedDays = Math.max(
      1,
      Math.round((computedExpiry - base) / 86400000)
    );

    await adRef.update({
      status: "ACTIVE",
      expiresAt: newExpiresAt,
      durationDays: Math.min(
        365,
        (Number(ad.durationDays) || 0) + effectiveAddedDays
      ),
      lastExtendedAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    return {success: true, expiresAt: newExpiresAt};
  }
);

/**
 * Phase 2 - 8b. requestExtension : Enregistrement de prolongation payante.
 */
export const requestExtension = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const {
      adId,
      days,
      operator,
      transactionRef,
      paymentReference,
    } = request.data || {};
    if (!adId) {
      throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
    }

    const db = getFirestore();
    const adRef = db.collection("ads").doc(String(adId));
    const adSnap = await adRef.get();
    if (!adSnap.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adSnap.data() || {};
    if (ad.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Accès non autorisé.");
    }

    if (paymentReference) {
      const paySnap = await db
        .collection("payments")
        .doc(String(paymentReference))
        .get();
      if (
        !paySnap.exists ||
        paySnap.data()?.status !== "SUCCESS" ||
        paySnap.data()?.userId !== request.auth.uid
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Paiement non vérifié pour cette prolongation."
        );
      }
    }

    await adRef.update({
      pendingExtension: {
        days: Math.min(Number(days) || 30, 365),
        operator: operator || null,
        transactionRef: transactionRef || paymentReference || null,
        requestedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    return {success: true};
  }
);

/**
 * Phase 2 - 9. activateExemptSubscription : Activation d'abonnement
 * ou booster VIP.
 */
export const activateExemptSubscription = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const db = getFirestore();
    const userRef = db.collection("users").doc(request.auth.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const isExempt = Boolean(
      userData.isExempt || userData.exemptFromPaymentAndKyc
    );
    if (!isExempt) {
      throw new HttpsError(
        "permission-denied",
        "Action réservée aux comptes partenaires exemptés."
      );
    }

    const {type, tier, packCount} = request.data || {};
    const now = new Date();

    if (type === "SUBSCRIPTION") {
      const subTier = tier || "VIP";
      await userRef.update({
        subscriptionTier: subTier,
        subscriptionStartedAt: now.toISOString(),
        subscriptionExpiresAt: new Date(
          now.getTime() + 365 * 86400000
        ).toISOString(),
        consumedFreeAdsCount: 0,
        updatedAt: now.toISOString(),
      });

      // Mettre à jour les annonces actives de l'utilisateur
      const adsSnap = await db
        .collection("ads")
        .where("userId", "==", request.auth.uid)
        .where("status", "in", ["ACTIVE", "PENDING_REVIEW"])
        .get();
      const batch = db.batch();
      adsSnap.docs.forEach((d) => {
        batch.update(d.ref, {
          ownerTier: subTier,
          isOwnerVip: subTier === "VIP",
          isOwnerVerified: true,
          updatedAt: now.toISOString(),
        });
      });
      await batch.commit();
    } else if (type === "BOOSTER_PACK") {
      const current = Number(userData.freeBoostsRemaining || 0);
      const count = Math.min(Number(packCount) || 5, Math.max(0, 20 - current));
      await userRef.update({
        freeBoostsRemaining: Math.min(20, current + count),
        activeBoosterPack: "BOOST_EXEMPT",
        updatedAt: now.toISOString(),
      });
    } else {
      throw new HttpsError(
        "invalid-argument",
        "Type invalide (SUBSCRIPTION ou BOOSTER_PACK requis)."
      );
    }

    return {success: true};
  }
);

