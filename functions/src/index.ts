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
import {
  calculateServerPrice,
  quoteOrder,
  PricingError,
  PriceContext,
  Quote,
} from "./pricing";

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

    // Quota Standard partagé (0 annonce gratuite pour Standard)
    const standardQuota = SUBSCRIPTION_QUOTAS.STANDARD ?? 0;
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


export interface PaymentOutcome {
  status: "INITIATING" | "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | "NEEDS_REVIEW";
  singpayStatus?: string;
  singpayResult?: string | null;
  errorReason?: string;
  amountReceived?: number;
}

export const PAYMENT_STATUS_RANKS: Record<string, number> = {
  INITIATING: 0,
  PENDING: 1,
  EXPIRED: 2,
  FAILED: 3,
  NEEDS_REVIEW: 3,
  SUCCESS: 4,
};

/**
 * Traitement unique et atomique de transition d'état et attribution des avantages (Phase 4.1).
 * Toute attribution passe EXCLUSIVEMENT par cette fonction.
 */
export async function settlePayment(
  paymentRefOrId: string,
  rawOutcome: PaymentOutcome
): Promise<{ success: boolean; status: string; attributed: boolean }> {
  const db = getFirestore();
  const paymentDocRef = db.collection("payments").doc(paymentRefOrId);

  return await db.runTransaction(async (tx) => {
    // 1. LECTURES D'ABORD (Règle Firestore transactionnelle : toutes les lectures avant écritures)
    const paymentSnap = await tx.get(paymentDocRef);
    if (!paymentSnap.exists) {
      console.warn(`settlePayment: Paiement ${paymentRefOrId} introuvable.`);
      return { success: false, status: "NOT_FOUND", attributed: false };
    }

    const payment = paymentSnap.data() || {};
    const currentStatus = String(payment.status || "INITIATING").toUpperCase();
    let outcome = { ...rawOutcome };

    // 4.3 Contrôle strict du montant reçu
    if (outcome.status === "SUCCESS" && outcome.amountReceived !== undefined) {
      if (Number(outcome.amountReceived) !== Number(payment.amount)) {
        console.warn(
          `settlePayment: Montant altéré pour ${paymentRefOrId}: attendu ${payment.amount}, reçu ${outcome.amountReceived}`
        );
        outcome.status = "NEEDS_REVIEW";
        outcome.errorReason = `Incohérence montant: attendu ${payment.amount} FCFA, reçu ${outcome.amountReceived} FCFA`;
      }
    }

    // Machine d'états
    const currentRank = PAYMENT_STATUS_RANKS[currentStatus] ?? 0;
    const targetRank = PAYMENT_STATUS_RANKS[outcome.status] ?? -1;

    // Règle: aucune baisse de rang sauf EXPIRED vers SUCCESS
    if (currentStatus === "SUCCESS") {
      // Déjà SUCCESS: terminal et immuable
      return { success: true, status: "SUCCESS", attributed: Boolean(payment.attributed) };
    }
    if (currentStatus === "FAILED" && outcome.status !== "FAILED") {
      // Statut final FAILED: aucune transition possible
      return { success: false, status: "FAILED", attributed: false };
    }
    if (currentStatus === "EXPIRED" && outcome.status !== "SUCCESS") {
      // EXPIRED ne peut transiter que vers SUCCESS (paiement mobile différé)
      return { success: false, status: "EXPIRED", attributed: false };
    }
    if (targetRank < currentRank && !(currentStatus === "EXPIRED" && outcome.status === "SUCCESS")) {
      console.warn(
        `settlePayment: Transition interdite de ${currentStatus} vers ${outcome.status} pour ${paymentRefOrId}.`
      );
      return { success: false, status: currentStatus, attributed: Boolean(payment.attributed) };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Si pas SUCCESS, simple transition de statut (FAILED, EXPIRED, NEEDS_REVIEW, PENDING)
    if (outcome.status !== "SUCCESS") {
      const updates: Record<string, unknown> = {
        status: outcome.status,
        updatedAt: nowIso,
      };
      if (outcome.singpayStatus) updates.singpayStatus = outcome.singpayStatus;
      if (outcome.singpayResult !== undefined) updates.singpayResult = outcome.singpayResult;
      if (outcome.errorReason) updates.errorReason = outcome.errorReason;
      if (outcome.amountReceived !== undefined) updates.amountReceived = outcome.amountReceived;

      tx.set(paymentDocRef, updates, { merge: true });
      return { success: true, status: outcome.status, attributed: false };
    }

    // Ici outcome.status === "SUCCESS"
    if (payment.attributed === true) {
      return { success: true, status: "SUCCESS", attributed: true };
    }

    const userId = payment.userId as string;
    if (!userId) {
      console.warn(`settlePayment: Aucun userId sur ${paymentRefOrId}.`);
      tx.set(paymentDocRef, {
        status: "NEEDS_REVIEW",
        errorReason: "Paiement sans userId associé.",
        updatedAt: nowIso,
      }, { merge: true });
      return { success: false, status: "NEEDS_REVIEW", attributed: false };
    }

    // Lire l'utilisateur (LECTURE)
    const userRef = db.collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};

    const productId = (payment.productId as string) || "";
    const metadata = (payment.metadata as Record<string, unknown>) || {};
    const adId = typeof metadata.adId === "string" ? metadata.adId.trim() : "";

    // Lire l'annonce si applicable (LECTURE)
    let adRef: FirebaseFirestore.DocumentReference | null = null;
    let adData: Record<string, unknown> | null = null;
    if (adId) {
      adRef = db.collection("ads").doc(adId);
      const adSnap = await tx.get(adRef);
      if (adSnap.exists) {
        adData = adSnap.data() || {};
      }
    }

    // 2. CALCUL DES MODIFICATIONS SELON LES RÈGLES PAR PRODUIT (Tableau page 7)
    const userUpdates: Record<string, unknown> = { updatedAt: nowIso };
    const adUpdates: Record<string, unknown> = { updatedAt: nowIso };
    const paymentUpdates: Record<string, unknown> = {
      status: "SUCCESS",
      attributed: true,
      attributedAt: nowIso,
      updatedAt: nowIso,
    };
    if (outcome.singpayStatus) paymentUpdates.singpayStatus = outcome.singpayStatus;
    if (outcome.singpayResult !== undefined) paymentUpdates.singpayResult = outcome.singpayResult;
    if (outcome.amountReceived !== undefined) paymentUpdates.amountReceived = outcome.amountReceived;

    let hasUserUpdates = false;
    let hasAdUpdates = false;

    // Produit : SUB_PRO / SUB_ELITE / SUB_BUSINESS
    if (
      productId === "SUB_PRO" || productId === "PRO" ||
      productId === "SUB_ELITE" || productId === "ELITE" ||
      productId === "SUB_BUSINESS" || productId === "BUSINESS"
    ) {
      const tier = productId.replace("SUB_", "");
      const boostsToAdd = tier === "BUSINESS" ? 6 : tier === "ELITE" ? 3 : 1;
      const currentBoosts = Number(userData.freeBoostsRemaining ?? userData.freeBoosts ?? 0);
      const newBoosts = Math.min(20, currentBoosts + boostsToAdd);

      userUpdates.subscriptionTier = tier;
      userUpdates.subscriptionStartedAt = nowIso;
      userUpdates.subscriptionExpiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      userUpdates.freeBoostsRemaining = newBoosts;
      userUpdates.freeBoosts = newBoosts;
      userUpdates.consumedFreeAdsCount = 0;
      hasUserUpdates = true;
    } else if (productId === "BOOST_SINGLE" || productId === "SINGLE") {
      // BOOST_SINGLE : Annonce obligatoire mise en avant +7 jours
      if (adRef && adData && (adData.userId === userId || !adData.userId)) {
        const currentUntil = adData.featuredUntil ? new Date(adData.featuredUntil as string).getTime() : 0;
        const baseUntil = Math.max(currentUntil, now.getTime());
        const newFeaturedUntil = new Date(baseUntil + 7 * 24 * 3600 * 1000).toISOString();

        adUpdates.isFeatured = true;
        adUpdates.featuredAt = (adData.isFeatured && adData.featuredAt) ? adData.featuredAt : nowIso;
        adUpdates.featuredUntil = newFeaturedUntil;
        hasAdUpdates = true;
      }
    } else if (productId === "BOOST_5" || productId === "BOOST_10") {
      const count = productId === "BOOST_5" ? 5 : 10;
      const currentBoosts = Number(userData.freeBoostsRemaining ?? userData.freeBoosts ?? 0);

      if (adRef && adData && (adData.userId === userId || !adData.userId)) {
        // Avec annonce : mise en avant +7 jours et solde +(count - 1)
        const currentUntil = adData.featuredUntil ? new Date(adData.featuredUntil as string).getTime() : 0;
        const baseUntil = Math.max(currentUntil, now.getTime());
        const newFeaturedUntil = new Date(baseUntil + 7 * 24 * 3600 * 1000).toISOString();

        adUpdates.isFeatured = true;
        adUpdates.featuredAt = (adData.isFeatured && adData.featuredAt) ? adData.featuredAt : nowIso;
        adUpdates.featuredUntil = newFeaturedUntil;
        hasAdUpdates = true;

        const newBoosts = Math.min(20, currentBoosts + (count - 1));
        userUpdates.freeBoostsRemaining = newBoosts;
        userUpdates.freeBoosts = newBoosts;
        userUpdates.activeBoosterPack = productId;
        hasUserUpdates = true;
      } else {
        // Sans annonce : solde +count
        const newBoosts = Math.min(20, currentBoosts + count);
        userUpdates.freeBoostsRemaining = newBoosts;
        userUpdates.freeBoosts = newBoosts;
        userUpdates.activeBoosterPack = productId;
        hasUserUpdates = true;
      }
    } else if (productId === "AD_EXTEND") {
      // AD_EXTEND : jours des métadonnées assainies, max 365 jours
      const days = Number(metadata.days || 0);
      if (adRef && adData && days > 0 && adData.status !== "deleted" && adData.status !== "rejected") {
        const currentExp = adData.expiresAt ? new Date(adData.expiresAt as string).getTime() : now.getTime();
        const baseTime = Math.max(currentExp, now.getTime());
        const maxAllowed = now.getTime() + 365 * 24 * 3600 * 1000;
        const targetTime = Math.min(maxAllowed, baseTime + days * 24 * 3600 * 1000);

        adUpdates.expiresAt = new Date(targetTime).toISOString();
        adUpdates.status = "ACTIVE";
        hasAdUpdates = true;
      }
    } else if (productId === "AD_PUBLISH") {
      // AD_PUBLISH : Achat abonnement éventuel, consommation quota ou boost gratuit, marquage consumedByAdId
      paymentUpdates.consumedByAdId = adId || true;

      if (metadata.requiresSubscription && metadata.selectedTierToBuy) {
        const tier = String(metadata.selectedTierToBuy);
        const boostsToAdd = tier === "BUSINESS" ? 6 : tier === "ELITE" ? 3 : 1;
        const currentBoosts = Number(userData.freeBoostsRemaining ?? userData.freeBoosts ?? 0);
        let finalBoosts = Math.min(20, currentBoosts + boostsToAdd);
        if (metadata.withBoost) {
          finalBoosts = Math.max(0, finalBoosts - 1);
        }

        userUpdates.subscriptionTier = tier;
        userUpdates.subscriptionStartedAt = nowIso;
        userUpdates.subscriptionExpiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
        userUpdates.freeBoostsRemaining = finalBoosts;
        userUpdates.freeBoosts = finalBoosts;
        userUpdates.consumedFreeAdsCount = 0;
        hasUserUpdates = true;
      } else {
        if (metadata.usesFreeQuota) {
          userUpdates.consumedFreeAdsCount = Number(userData.consumedFreeAdsCount || 0) + 1;
          hasUserUpdates = true;
        }
        if (metadata.boostSource === "FREE_BALANCE") {
          const currentBoosts = Number(userData.freeBoostsRemaining ?? userData.freeBoosts ?? 0);
          const finalBoosts = Math.max(0, currentBoosts - 1);
          userUpdates.freeBoostsRemaining = finalBoosts;
          userUpdates.freeBoosts = finalBoosts;
          hasUserUpdates = true;
        }
      }
    }

    // 3. ÉCRITURES ATOMIQUES
    if (hasUserUpdates) {
      tx.set(userRef, userUpdates, { merge: true });
    }
    if (hasAdUpdates && adRef) {
      tx.set(adRef, adUpdates, { merge: true });
    }
    tx.set(paymentDocRef, paymentUpdates, { merge: true });

    return { success: true, status: "SUCCESS", attributed: true };
  });
}

/**
 * Enveloppe de compatibilité : route exclusivement vers settlePayment (Phase 4.4).
 */
export async function applyPaymentAttribution(
  paymentRefOrId: string
): Promise<boolean> {
  const res = await settlePayment(paymentRefOrId, { status: "SUCCESS" });
  return res.attributed;
}

/**
 * 4. Passerelle SingPay Gabon (Paiement Moov Money / Airtel Money réel)
 * Déclenche un appel à l'API SingPay pour envoyer un USSD Push sur le mobile.
 */
/**
 * Appel HTTP vers SingPay avec délai d'attente strict (20s) et aucun retry (Phase 3.6).
 */
export async function singpayFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error(`Délai d'attente SingPay dépassé (${timeoutMs / 1000}s).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Construit le contexte de tarification PriceContext (Phase 3.2).
 */
export function buildPriceContext(
  userData: Record<string, unknown>,
  adData?: Record<string, unknown> | null
): PriceContext {
  const isExempt = Boolean(
    userData.isExempt || userData.exemptFromPaymentAndKyc
  );

  const rawTier = String(userData.subscriptionTier || "STANDARD").toUpperCase();
  let effectiveTier = ["PRO", "ELITE", "BUSINESS"].includes(rawTier)
    ? rawTier
    : "STANDARD";

  const expiresAt = userData.subscriptionExpiresAt;
  if (effectiveTier !== "STANDARD" && expiresAt) {
    const expTime =
      typeof expiresAt === "string"
        ? new Date(expiresAt).getTime()
        : typeof expiresAt === "object" &&
          expiresAt !== null &&
          "toMillis" in (expiresAt as Record<string, unknown>)
        ? (expiresAt as { toMillis: () => number }).toMillis()
        : 0;
    if (expTime > 0 && expTime < Date.now()) {
      effectiveTier = "STANDARD";
    }
  }

  let subscriptionAgeDays = 0;
  if (effectiveTier !== "STANDARD" && userData.subscriptionStartedAt) {
    const startTime =
      typeof userData.subscriptionStartedAt === "string"
        ? new Date(userData.subscriptionStartedAt).getTime()
        : typeof userData.subscriptionStartedAt === "object" &&
          userData.subscriptionStartedAt !== null &&
          "toMillis" in (userData.subscriptionStartedAt as Record<string, unknown>)
        ? (userData.subscriptionStartedAt as { toMillis: () => number }).toMillis()
        : 0;
    if (startTime > 0 && Date.now() > startTime) {
      subscriptionAgeDays = Math.floor(
        (Date.now() - startTime) / (1000 * 60 * 60 * 24)
      );
    }
  }

  // Quota gratuit : STANDARD = 0 (Décision D3)
  const tierQuota = SUBSCRIPTION_QUOTAS[effectiveTier] ?? 0;
  const consumed = Number(userData.consumedFreeAdsCount || 0);
  const hasFreeAdQuota = isExempt || (tierQuota > 0 && consumed < tierQuota);

  const freeBoosts = Math.max(0, Number(userData.freeBoosts || 0));

  let adRemainingDays: number | undefined;
  if (adData && adData.expiresAt) {
    const expTime =
      typeof adData.expiresAt === "string"
        ? new Date(adData.expiresAt).getTime()
        : typeof adData.expiresAt === "object" &&
          adData.expiresAt !== null &&
          "toMillis" in (adData.expiresAt as Record<string, unknown>)
        ? (adData.expiresAt as { toMillis: () => number }).toMillis()
        : 0;
    if (expTime > Date.now()) {
      adRemainingDays = Math.ceil(
        (expTime - Date.now()) / (1000 * 60 * 60 * 24)
      );
    } else {
      adRemainingDays = 0;
    }
  }

  return {
    isExempt,
    effectiveTier,
    subscriptionAgeDays,
    hasFreeAdQuota,
    freeBoosts,
    adRemainingDays,
  };
}

/**
 * Prévisualisation du devis côté serveur pour affichage dans l'interface client (Phase 8.1).
 */
export const previewQuote = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour prévisualiser un devis."
      );
    }

    const {productId, metadata} = (request.data || {}) as {
      productId?: unknown;
      metadata?: Record<string, unknown>;
    };

    if (!productId || typeof productId !== "string") {
      throw new HttpsError("invalid-argument", "Produit requis.");
    }

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};

    let adData: Record<string, unknown> | null = null;
    const cleanAdId =
      metadata && typeof metadata.adId === "string" ? metadata.adId.trim() : "";
    if (cleanAdId) {
      const adDoc = await db.collection("ads").doc(cleanAdId).get();
      if (adDoc.exists) {
        adData = adDoc.data() || null;
      }
    }

    const priceContext = buildPriceContext(userData, adData);
    try {
      const quote = quoteOrder(productId, metadata, priceContext);
      return {
        productId: quote.productId,
        amount: quote.amount,
        lines: quote.lines,
        metadata: quote.metadata,
      };
    } catch (err) {
      if (err instanceof PricingError) {
        throw new HttpsError("invalid-argument", err.message);
      }
      throw err;
    }
  }
);

/**
 * 4. Passerelle SingPay Gabon (Phase 3 : Initiation sécurisée, idempotente et traçable)
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
    // Exiger une session connectée (Phase 3)
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour initier un paiement."
      );
    }
    const callerUid = request.auth.uid;

    const {
      productId,
      metadata,
      phoneNumber,
      operator,
      idempotencyKey,
    } = (request.data || {}) as {
      productId?: unknown;
      metadata?: Record<string, unknown>;
      phoneNumber?: unknown;
      operator?: unknown;
      idempotencyKey?: unknown;
    };

    // 3.1 Refuser si productId est absent (supprime tout repli sur amount ou description client)
    if (!productId || typeof productId !== "string") {
      throw new HttpsError("invalid-argument", "Produit requis.");
    }

    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }

    // 3.7 Interrupteur isLive : si faux, refuser immédiatement
    const cfg = await getSingPayConfig();
    if (cfg.isLive === false) {
      throw new HttpsError(
        "unavailable",
        "Les paiements sont temporairement suspendus."
      );
    }

    const requestedOperator =
      operator === "AIRTEL_MONEY" ? "AIRTEL_MONEY" : "MOOV_MONEY";

    const {rawDigits} = normalizeGabonPhone(String(phoneNumber));

    // Validation stricte des opérateurs selon les préfixes officiels
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

    // 3.2 Contrôle de l'annonce si metadata.adId est présent
    let adData: Record<string, unknown> | null = null;
    const cleanAdId =
      metadata && typeof metadata.adId === "string" ? metadata.adId.trim() : "";
    if (cleanAdId) {
      const adDoc = await db.collection("ads").doc(cleanAdId).get();
      if (!adDoc.exists) {
        throw new HttpsError("not-found", "Annonce ciblée introuvable.");
      }
      adData = adDoc.data() || {};
      const isSuperOrAdmin =
        request.auth.token.role === "SUPER_ADMIN" ||
        request.auth.token.role === "SUPER ADMIN" ||
        request.auth.token.role === "ADMIN" ||
        userData.role === "SUPER_ADMIN" ||
        userData.role === "SUPER ADMIN" ||
        userData.role === "ADMIN";

      if (adData.userId !== request.auth.uid && !isSuperOrAdmin) {
        throw new HttpsError(
          "permission-denied",
          "Cette annonce ne vous appartient pas."
        );
      }

      if (adData.status === "deleted" || adData.status === "rejected") {
        throw new HttpsError(
          "failed-precondition",
          "Cette annonce ne peut plus être modifiée ou prolongée."
        );
      }
    }

    // 3.2 & 3.3 Construire le contexte et devis via quoteOrder
    const priceContext = buildPriceContext(userData, adData);
    let quote: Quote;
    try {
      quote = quoteOrder(productId, metadata, priceContext);
    } catch (err) {
      if (err instanceof PricingError) {
        throw new HttpsError("invalid-argument", err.message);
      }
      throw err;
    }

    if (quote.amount <= 0 && !priceContext.isExempt && !quote.metadata.usesFreeQuota) {
      throw new HttpsError(
        "invalid-argument",
        "Le montant calculé par le serveur doit être supérieur à 0 FCFA."
      );
    }

    // 3.4 Idempotence : référence = BZB_<uid8>_<hash(idempotencyKey)>
    const uid8 = callerUid.slice(0, 8);
    const rawKey =
      typeof idempotencyKey === "string" && idempotencyKey.trim()
        ? idempotencyKey.trim()
        : crypto.randomUUID();
    const keyHash = crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex")
      .slice(0, 12);
    const serverReference = `BZB_${uid8}_${keyHash}`;

    const clientMsisdn = `241${rawDigits}`;
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    const paymentRef = db.collection("payments").doc(serverReference);

    // Vérification d'idempotence et création INITIATING dans une transaction
    const idempotencyCheck = await db.runTransaction(async (tx) => {
      const snap = await tx.get(paymentRef);
      if (snap.exists) {
        const d = snap.data() || {};
        if (d.userId === callerUid) {
          return {
            exists: true,
            reference: d.reference,
            amount: d.amount,
            expiresAt: d.expiresAt,
            lines: d.lines || [],
            operator: d.operator,
            status: d.status,
          };
        } else {
          throw new HttpsError("already-exists", "Référence de paiement déjà utilisée.");
        }
      }

      // 3.5 Créer payments/{ref} en INITIATING avant l'appel SingPay
      tx.set(paymentRef, {
        reference: serverReference,
        userId: callerUid,
        productId: quote.productId,
        metadata: quote.metadata,
        amount: quote.amount,
        lines: quote.lines,
        operator: requestedOperator,
        clientPhoneMasked: maskNumber(clientMsisdn),
        status: "INITIATING",
        attributed: false,
        configVersion: cfg.version || 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        expiresAt,
      });

      return {exists: false};
    });

    if (idempotencyCheck.exists) {
      return {
        reference: idempotencyCheck.reference,
        amount: idempotencyCheck.amount,
        expiresAt: idempotencyCheck.expiresAt,
        lines: idempotencyCheck.lines,
        operator: idempotencyCheck.operator,
        status: idempotencyCheck.status,
      };
    }

    // Vérifier s'il existe déjà un paiement INITIATING ou PENDING récent (< 3 min)
    const recentPayments = await db
      .collection("payments")
      .where("userId", "==", callerUid)
      .where("status", "in", ["INITIATING", "PENDING"])
      .get();

    const duplicate = recentPayments.docs.find((doc) => {
      if (doc.id === serverReference) return false;
      const d = doc.data();
      const createdTime = new Date(d.createdAt).getTime();
      if (Date.now() - createdTime > 3 * 60 * 1000) return false;
      const sameProduct = d.productId === quote.productId;
      const sameAd =
        (!quote.metadata.adId && !d.metadata?.adId) ||
        quote.metadata.adId === d.metadata?.adId;
      return sameProduct && sameAd;
    });

    if (duplicate) {
      await paymentRef.delete().catch(() => {});
      throw new HttpsError(
        "already-exists",
        "Un paiement est déjà en cours pour cette demande. Veuillez patienter ou vérifier votre téléphone."
      );
    }

    // Récupération des clés SingPay
    const clientId = cfg.clientId;
    const clientSecret = cfg.clientSecret;
    const walletId = cfg.walletId;

    if (!clientId || !clientSecret || !walletId) {
      await paymentRef.update({
        status: "FAILED",
        errorReason: "Identifiants SingPay non configurés sur le serveur.",
        updatedAt: new Date().toISOString(),
      });
      throw new HttpsError(
        "failed-precondition",
        "Identifiants SingPay non configurés sur le serveur."
      );
    }

    const rawDisbursement =
      requestedOperator === "AIRTEL_MONEY"
        ? cfg.airtelDisbursement
        : cfg.moovDisbursement;

    if (!rawDisbursement) {
      await paymentRef.update({
        status: "FAILED",
        errorReason: `Numéro de reversement non configuré pour ${requestedOperator}.`,
        updatedAt: new Date().toISOString(),
      });
      throw new HttpsError(
        "failed-precondition",
        `Reversement non configuré pour ${requestedOperator}.`
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
      amount: quote.amount,
      reference: serverReference,
      client_msisdn: clientMsisdn,
      portefeuille: walletId,
      disbursement: disbursement,
      isTransfer: false,
    };

    const operatorEndpointCode =
      requestedOperator === "AIRTEL_MONEY" ? "74" : "62";
    const paymentUrl = `https://gateway.singpay.ga/v1/${operatorEndpointCode}/paiement`;

    // 3.6 Appel SingPay via singpayFetch (20s timeout, aucun retry)
    try {
      const resp = await singpayFetch(
        paymentUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
            "x-wallet": walletId,
          },
          body: JSON.stringify(paymentPayload),
        },
        20000
      );

      const responseText = await resp.text();
      let responseJson: SingPayResponsePayload | null = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // format texte
      }

      if (!resp.ok || !responseJson?.status?.success) {
        const errorMsg =
          responseJson?.status?.message ||
          responseJson?.message ||
          responseText ||
          `Erreur SingPay code HTTP ${resp.status}`;

        await paymentRef.update({
          status: "FAILED",
          errorReason: errorMsg,
          updatedAt: new Date().toISOString(),
        });

        throw new HttpsError("internal", `SingPay: ${errorMsg}`);
      }

      const singpayTx = responseJson.transaction || {};
      const singpayTxId = singpayTx.id || singpayTx._id || "";

      await paymentRef.update({
        status: "PENDING",
        singpayTransactionId: singpayTxId,
        singpayStatus: singpayTx.status || "Start",
        singpayResult: singpayTx.result || null,
        updatedAt: new Date().toISOString(),
      });

      // 3.8 Réponse : { reference, amount, expiresAt, lines, operator }
      return {
        reference: serverReference,
        amount: quote.amount,
        expiresAt,
        lines: quote.lines,
        operator: requestedOperator,
      };
    } catch (err: unknown) {
      if (err instanceof HttpsError) {
        throw err;
      }
      const e = err as Error;
      await paymentRef.update({
        status: "FAILED",
        errorReason: e.message || "Erreur de communication SingPay",
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
      throw new HttpsError("internal", `SingPay: ${e.message}`);
    }
  }
);

export interface MappedPaymentResult {
  status: "SUCCESS" | "FAILED" | "PENDING";
  result: string;
  singpayStatus: string;
  failureReason?: string;
}

/**
 * Table de correspondance unique partagée par tous les flux SingPay (Phase 5.2).
 */
export function mapSingPayResult(
  tx: SingPayTransactionData | Record<string, unknown>
): MappedPaymentResult {
  const txStatus = String(tx.status || "");
  const txResult = String(tx.result || "");

  if (
    txResult === "Success" ||
    (txStatus === "Terminate" && txResult === "Success")
  ) {
    return {
      status: "SUCCESS",
      result: txResult || "Success",
      singpayStatus: txStatus,
    };
  }

  if (txResult === "PasswordError") {
    return {
      status: "FAILED",
      result: txResult,
      singpayStatus: txStatus,
      failureReason: "Code PIN erroné saisi sur le mobile.",
    };
  }

  if (txResult === "BalanceError") {
    return {
      status: "FAILED",
      result: txResult,
      singpayStatus: txStatus,
      failureReason: "Solde mobile insuffisant sur le compte client.",
    };
  }

  if (txResult === "TimeOutError") {
    return {
      status: "FAILED",
      result: txResult,
      singpayStatus: txStatus,
      failureReason: "Délai d'attente dépassé (timeout USSD).",
    };
  }

  if (
    txResult === "Error" ||
    (txStatus === "Terminate" && txResult && txResult !== "Success")
  ) {
    return {
      status: "FAILED",
      result: txResult,
      singpayStatus: txStatus,
      failureReason: "Paiement refusé ou annulé par l'utilisateur.",
    };
  }

  return {
    status: "PENDING",
    result: txResult,
    singpayStatus: txStatus,
  };
}

/**
 * 5. Vérification du statut d'une transaction SingPay (Phase 5.1).
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
    // 5.1 Exiger l'authentification
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour vérifier le statut d'un paiement."
      );
    }

    const {reference} = (request.data || {}) as { reference?: unknown };

    // 5.1 N'accepter que reference (plus d'identifiant libre)
    if (!reference || typeof reference !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Référence de paiement requise."
      );
    }

    const db = getFirestore();
    const paymentDocRef = db.collection("payments").doc(reference);
    const snap = await paymentDocRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Paiement introuvable.");
    }

    const paymentData = snap.data() || {};

    // 5.1 Refuser si le paiement n'appartient pas à l'appelant, sauf admin
    const isAdmin = await checkIsAdmin(request.auth.uid, request.auth);
    if (paymentData.userId !== request.auth.uid && !isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Accès refusé pour cette référence de paiement."
      );
    }

    // 5.1 Si le statut est final, le renvoyer sans appeler SingPay
    if (paymentData.status === "SUCCESS" || paymentData.status === "FAILED") {
      return {
        status: paymentData.status,
        result: paymentData.singpayResult || (paymentData.status === "SUCCESS" ? "Success" : "Error"),
        reference: paymentData.reference,
        transactionId: paymentData.singpayTransactionId || "",
        message:
          paymentData.status === "SUCCESS"
            ? "Paiement validé avec succès."
            : paymentData.errorReason || "Paiement non abouti.",
      };
    }

    // 5.1 Limiter à un appel SingPay toutes les 4 secondes par paiement
    const lastCheckedAt = paymentData.lastCheckedAt
      ? new Date(paymentData.lastCheckedAt as string).getTime()
      : 0;
    const now = Date.now();
    if (now - lastCheckedAt < 4000) {
      return {
        status: (paymentData.status as string) || "PENDING",
        result: (paymentData.singpayResult as string) || "",
        reference: paymentData.reference,
        transactionId: paymentData.singpayTransactionId || "",
        throttled: true,
      };
    }

    await paymentDocRef.set(
      { lastCheckedAt: new Date(now).toISOString() },
      { merge: true }
    );

    const cfg = await getSingPayConfig();
    const clientId = cfg.clientId;
    const clientSecret = cfg.clientSecret;
    const walletId = cfg.walletId;

    if (!clientId || !clientSecret) {
      return {
        status: (paymentData.status as string) || "PENDING",
        message: "Clés SingPay non configurées.",
      };
    }

    const targetTxId = paymentData.singpayTransactionId as string;
    let endpoint = "";
    const headers: Record<string, string> = {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    };

    if (targetTxId) {
      endpoint = `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(
        targetTxId
      )}`;
    } else {
      endpoint = `https://gateway.singpay.ga/v1/transaction/api/search/by-reference/${encodeURIComponent(
        reference
      )}`;
      headers["x-wallet"] = walletId;
    }

    try {
      const resp = await singpayFetch(endpoint, { method: "GET", headers }, 10000);
      const responseText = await resp.text();
      let responseJson: SingPayResponsePayload | null = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // format brut
      }

      if (!resp.ok) {
        return {
          status: (paymentData.status as string) || "PENDING",
          message: "En attente de validation auprès de l'opérateur.",
        };
      }

      const tx = responseJson?.transaction || {};
      const mapped = mapSingPayResult(tx);

      // 5.1 Passer par settlePayment
      if (mapped.status !== "PENDING" || mapped.singpayStatus !== paymentData.singpayStatus) {
        const settleRes = await settlePayment(reference, {
          status: mapped.status,
          singpayStatus: mapped.singpayStatus,
          singpayResult: mapped.result,
          errorReason: mapped.failureReason,
          amountReceived: tx.amount !== undefined ? Number(tx.amount) : undefined,
        });

        return {
          status: settleRes.status,
          result: mapped.result,
          singpayStatus: mapped.singpayStatus,
          failureReason: mapped.failureReason || null,
          transactionId: tx.id || targetTxId,
          reference: tx.reference || reference,
        };
      }

      return {
        status: (paymentData.status as string) || "PENDING",
        result: mapped.result,
        singpayStatus: mapped.singpayStatus,
        transactionId: tx.id || targetTxId,
        reference: tx.reference || reference,
      };
    } catch (err: unknown) {
      const e = err as Error;
      return {
        status: (paymentData.status as string) || "PENDING",
        message: e.message,
      };
    }
  }
);

/**
 * 6. Webhook de rappel officiel SingPay (Phase 5.3 & 5.4).
 */
export const singpayWebhook = onRequest(
  {
    cors: true,
    secrets: [
      singpayClientId,
      singpayClientSecret,
      singpayWalletId,
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

      // 5.4 Transport du secret : accepte x-webhook-secret ou ?secret=
      const receivedSecret =
        (req.headers["x-webhook-secret"] as string) ||
        (req.query.secret as string) ||
        "";

      // 5.3 Comparaison avec crypto.timingSafeEqual et suppression du repli Client Secret
      if (!expectedSecret || !receivedSecret) {
        res.status(401).json({error: "Unauthorized"});
        return;
      }

      const bufExpected = Buffer.from(expectedSecret);
      const bufReceived = Buffer.from(receivedSecret);
      if (
        bufExpected.length !== bufReceived.length ||
        !crypto.timingSafeEqual(bufExpected, bufReceived)
      ) {
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
        amount?: number;
      };
      const tx: SingPayTransactionData = data.transaction || data;
      const reference = tx.reference;

      // 5.3 Référence inconnue = réponse 200 « ignoré »
      if (!reference || typeof reference !== "string") {
        res.status(200).json({status: "ignored", reason: "missing-reference"});
        return;
      }

      const db = getFirestore();
      const docRef = db.collection("payments").doc(reference);
      const paySnap = await docRef.get();
      if (!paySnap.exists) {
        res.status(200).json({status: "ignored", reason: "payment-not-found"});
        return;
      }

      const mapped = mapSingPayResult(tx);
      let outcome: PaymentOutcome = {
        status: mapped.status,
        singpayStatus: mapped.singpayStatus,
        singpayResult: mapped.result,
        errorReason: mapped.failureReason,
        amountReceived: tx.amount !== undefined ? Number(tx.amount) : undefined,
      };

      // 5.3 Avant tout SUCCESS, confirmer par un GET de statut auprès de SingPay
      if (mapped.status === "SUCCESS") {
        const txId = tx.id || tx._id || paySnap.data()?.singpayTransactionId;
        let confirmed = false;
        if (cfg.clientId && cfg.clientSecret) {
          try {
            let verifyUrl = "";
            const verifyHeaders: Record<string, string> = {
              "x-client-id": cfg.clientId,
              "x-client-secret": cfg.clientSecret,
            };
            if (txId) {
              verifyUrl = `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(String(txId))}`;
            } else {
              verifyUrl = `https://gateway.singpay.ga/v1/transaction/api/search/by-reference/${encodeURIComponent(reference)}`;
              verifyHeaders["x-wallet"] = cfg.walletId;
            }

            const verifyResp = await singpayFetch(verifyUrl, { method: "GET", headers: verifyHeaders }, 10000);
            if (verifyResp.ok) {
              const verifyJson = (await verifyResp.json()) as SingPayResponsePayload;
              const verifyTx = verifyJson.transaction || {};
              const verifiedMapped = mapSingPayResult(verifyTx);
              if (verifiedMapped.status === "SUCCESS") {
                confirmed = true;
                if (verifyTx.amount !== undefined) {
                  outcome.amountReceived = Number(verifyTx.amount);
                }
              }
            }
          } catch (fetchErr) {
            console.warn("singpayWebhook: validation statut côté serveur échouée:", fetchErr);
          }
        }

        if (!confirmed) {
          console.warn(
            `singpayWebhook: Confirmation GET refusée ou impossible pour ${reference}. En attente réconciliation.`
          );
          outcome = {
            status: "NEEDS_REVIEW",
            errorReason: "Validation GET SingPay non certifiée après réception du webhook.",
          };
        }
      }

      // 5.3 Passer par settlePayment (idempotent, 1 seule attribution même avec 5 replays)
      await settlePayment(reference, outcome);
      res.status(200).json({received: true});
    } catch (err: unknown) {
      const e = err as Error;
      res.status(500).json({error: e.message});
    }
  }
);

/**
 * Réconciliation planifiée automatique (Phase 5.5).
 * Exécutée toutes les 2 minutes pour clore les paiements sans dépendre du webhook ni du client.
 */
export const reconcilePayments = onSchedule(
  {
    schedule: "every 2 minutes",
    secrets: [singpayClientId, singpayClientSecret, singpayWalletId],
  },
  async () => {
    const db = getFirestore();
    const cfg = await getSingPayConfig();
    const now = Date.now();
    const sixtySecAgo = new Date(now - 60000).toISOString();
    const twoMinAgo = new Date(now - 120000).toISOString();

    // 1. INITIATING de plus de 2 minutes -> FAILED
    const stuckInitiating = await db
      .collection("payments")
      .where("status", "==", "INITIATING")
      .where("createdAt", "<=", twoMinAgo)
      .limit(50)
      .get();

    for (const doc of stuckInitiating.docs) {
      await settlePayment(doc.id, {
        status: "FAILED",
        errorReason: "Paiement abandonné avant envoi opérateur (timeout INITIATING).",
      });
    }

    // 2. PENDING de plus de 60 s (au plus 50 paiements)
    const pendingSnap = await db
      .collection("payments")
      .where("status", "==", "PENDING")
      .where("createdAt", "<=", sixtySecAgo)
      .limit(50)
      .get();

    for (const doc of pendingSnap.docs) {
      const data = doc.data() || {};
      const expiresTime = data.expiresAt ? new Date(data.expiresAt as string).getTime() : 0;

      // PENDING dépassant expiresAt sans succès -> EXPIRED
      if (expiresTime > 0 && now > expiresTime) {
        let checkedSuccess = false;
        if (cfg.clientId && cfg.clientSecret) {
          try {
            const txId = data.singpayTransactionId;
            let queryUrl = "";
            const headers: Record<string, string> = {
              "x-client-id": cfg.clientId,
              "x-client-secret": cfg.clientSecret,
            };
            if (txId) {
              queryUrl = `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(String(txId))}`;
            } else {
              queryUrl = `https://gateway.singpay.ga/v1/transaction/api/search/by-reference/${encodeURIComponent(doc.id)}`;
              headers["x-wallet"] = cfg.walletId;
            }
            const res = await singpayFetch(queryUrl, { method: "GET", headers }, 8000);
            if (res.ok) {
              const json = (await res.json()) as SingPayResponsePayload;
              const mapped = mapSingPayResult(json.transaction || {});
              if (mapped.status === "SUCCESS") {
                await settlePayment(doc.id, {
                  status: "SUCCESS",
                  singpayStatus: mapped.singpayStatus,
                  singpayResult: mapped.result,
                  amountReceived: json.transaction?.amount !== undefined ? Number(json.transaction.amount) : undefined,
                });
                checkedSuccess = true;
              }
            }
          } catch {
            // Ignorer l'erreur réseau
          }
        }
        if (!checkedSuccess) {
          await settlePayment(doc.id, {
            status: "EXPIRED",
            errorReason: "Délai de validation mobile dépassé (3 minutes).",
          });
        }
        continue;
      }

      // Interroger SingPay pour les PENDING actifs de plus de 60 s
      if (cfg.clientId && cfg.clientSecret) {
        try {
          const txId = data.singpayTransactionId;
          let queryUrl = "";
          const headers: Record<string, string> = {
            "x-client-id": cfg.clientId,
            "x-client-secret": cfg.clientSecret,
          };
          if (txId) {
            queryUrl = `https://gateway.singpay.ga/v1/transaction/api/status/${encodeURIComponent(String(txId))}`;
          } else {
            queryUrl = `https://gateway.singpay.ga/v1/transaction/api/search/by-reference/${encodeURIComponent(doc.id)}`;
            headers["x-wallet"] = cfg.walletId;
          }
          const res = await singpayFetch(queryUrl, { method: "GET", headers }, 8000);
          if (res.ok) {
            const json = (await res.json()) as SingPayResponsePayload;
            const mapped = mapSingPayResult(json.transaction || {});
            if (mapped.status !== "PENDING") {
              await settlePayment(doc.id, {
                status: mapped.status,
                singpayStatus: mapped.singpayStatus,
                singpayResult: mapped.result,
                errorReason: mapped.failureReason,
                amountReceived: json.transaction?.amount !== undefined ? Number(json.transaction.amount) : undefined,
              });
            }
          }
        } catch (e) {
          console.warn(`reconcilePayments: Erreur vérification SingPay pour ${doc.id}:`, e);
        }
      }
    }
  }
);

/**
 * Déclencheur Firestore sur écriture de paiement :
 * Phase 4.4 : Toute attribution passe exclusivement par settlePayment.
 * Cette fonction ne réalise aucune attribution directe pour garantir l'atomicité transactionnelle.
 */
export const onPaymentStatusChange = onDocumentWritten(
  "payments/{paymentId}",
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return;
    // Les attributions passent exclusivement par settlePayment (Phase 4.4).
    // Les éventuelles notifications push futures peuvent être déclenchées ici sans écriture Firestore.
  }
);

/**
 * Fonction appelable permettant au client de consulter l'état
 * d'attribution des bénéfices après confirmation du paiement.
 */
export const claimPaymentBenefits = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentification requise pour réclamer les bénéfices."
      );
    }
    const {reference} = (request.data || {}) as { reference?: unknown };
    if (!reference || typeof reference !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Référence de paiement requise."
      );
    }
    const db = getFirestore();
    const paySnap = await db
      .collection("payments")
      .doc(reference)
      .get();
    if (!paySnap.exists) {
      throw new HttpsError("not-found", "Paiement introuvable.");
    }
    const payData = paySnap.data() || {};
    if (payData.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Accès non autorisé.");
    }
    return {
      status: payData.status,
      attributed: Boolean(payData.attributed),
      success: payData.status === "SUCCESS" && Boolean(payData.attributed),
    };
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

export interface ResolvedAdPayment {
  verified: boolean;
  durationDays?: number;
  expiresAt?: string;
  paidAmount?: number;
  paymentMethod?: string | null;
  transactionRef?: string | null;
  boostRequested?: boolean;
  maxPhotos?: number;
  failureReason?: string;
}

/**
 * Résolution et validation stricte du paiement d'une annonce (Phase 6.1).
 * Dérive durée, échéance et photos des métadonnées du paiement côté serveur.
 */
export async function resolveAdPayment(
  adId: string,
  userId: string,
  paymentReference?: string | null
): Promise<ResolvedAdPayment> {
  if (!paymentReference || typeof paymentReference !== "string") {
    return {
      verified: false,
      failureReason: "Référence de paiement absente.",
    };
  }

  const db = getFirestore();
  const paySnap = await db.collection("payments").doc(paymentReference).get();
  if (!paySnap.exists) {
    return {
      verified: false,
      failureReason: "Document de paiement introuvable.",
    };
  }

  const payData = paySnap.data() || {};
  if (payData.status !== "SUCCESS") {
    return {
      verified: false,
      failureReason: `Statut paiement non validé (${payData.status}).`,
    };
  }

  if (payData.userId !== userId) {
    return {
      verified: false,
      failureReason: "Le paiement appartient à un autre compte.",
    };
  }

  if (payData.productId !== "AD_PUBLISH") {
    return {
      verified: false,
      failureReason: "Produit de paiement invalide pour la publication.",
    };
  }

  const payMeta = (payData.metadata as Record<string, unknown>) || {};
  if (payMeta.adId && payMeta.adId !== adId) {
    return {
      verified: false,
      failureReason: "Le paiement cible une autre annonce.",
    };
  }

  if (payData.consumedByAdId && payData.consumedByAdId !== adId) {
    return {
      verified: false,
      failureReason: "Ce paiement a déjà été consommé par une autre annonce.",
    };
  }

  // Marquer le paiement comme consommé par cette annonce
  await paySnap.ref.update({
    consumedByAdId: adId,
    updatedAt: new Date().toISOString(),
  });

  const durationDays = Number(payMeta.durationDays) || 30;
  const now = Date.now();
  const expiresAt = new Date(now + durationDays * 86400000).toISOString();
  const maxPhotos = Number(payMeta.photoCount) || 3;
  const boostRequested = Boolean(payMeta.withBoost);

  return {
    verified: true,
    durationDays,
    expiresAt,
    paidAmount: payData.amount || 0,
    paymentMethod: payData.operator || null,
    transactionRef: payData.singpayTransactionId || paymentReference,
    boostRequested,
    maxPhotos,
  };
}

/**
 * Phase 6.1 onAdCreated : Initialisation serveur des annonces.
 * Pose ownerTier, isOwnerVip, isOwnerVerified, isVipCorner, vérifie le paiement
 * ou applique le quota gratuit côté serveur.
 */
export const onAdCreated = onDocumentCreated(
  "ads/{adId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const adId = event.params.adId;
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
    // Quota standard = 0 (Décision D3)
    const quota = SUBSCRIPTION_QUOTAS[effective.ownerTier || "STANDARD"] ?? 0;
    const consumed = Number(userData.consumedFreeAdsCount || 0);
    const isCoveredByQuota = !isExempt && quota > 0 && consumed < quota;

    // Vérification annuaire professionnel
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

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (isExempt) {
      // Utilisateur exempté : publication sans frais
      updates.paymentVerified = true;
      updates.paidAmount = 0;
      const durationDays = Number(adData.durationDays) || 30;
      updates.durationDays = durationDays;
      updates.expiresAt = new Date(now + durationDays * 86400000).toISOString();
    } else if (isCoveredByQuota) {
      // Inclus dans le quota d'abonnement actif
      updates.paymentVerified = true;
      updates.paidAmount = 0;
      const durationDays = Number(adData.durationDays) || 30;
      updates.durationDays = durationDays;
      updates.expiresAt = new Date(now + durationDays * 86400000).toISOString();
      if (userDoc.exists) {
        await userDoc.ref.update({
          consumedFreeAdsCount: FieldValue.increment(1),
          updatedAt: nowIso,
        });
      }
    } else {
      // 6.1 Exige un paiement validé SUCCESS
      const resolved = await resolveAdPayment(
        adId,
        userId,
        adData.paymentReference as string | undefined
      );

      if (!resolved.verified) {
        // Paiement absent ou faux : l'annonce n'est JAMAIS publiée
        updates.status = "PENDING_PAYMENT";
        updates.paymentVerified = false;
        updates.moderationReason = resolved.failureReason || "PAIEMENT_REQUIS";
        updates.isFeatured = false;
        updates.featuredAt = null;
        updates.featuredUntil = null;
      } else {
        // Dérivation stricte depuis les métadonnées assainies du serveur
        updates.paymentVerified = true;
        updates.durationDays = resolved.durationDays;
        updates.expiresAt = resolved.expiresAt;
        updates.paidAmount = resolved.paidAmount;
        updates.paymentMethod = resolved.paymentMethod;
        updates.transactionRef = resolved.transactionRef;

        if (resolved.boostRequested) {
          updates.isFeatured = true;
          updates.featuredAt = nowIso;
          updates.featuredUntil = new Date(now + 7 * 86400000).toISOString();
        }

        if (
          resolved.maxPhotos &&
          Array.isArray(adData.images) &&
          adData.images.length > resolved.maxPhotos
        ) {
          updates.images = adData.images.slice(0, resolved.maxPhotos);
        }
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
 * Phase 6.3 extendAdVip : Prolongation gratuite réservée aux abonnés Business actifs et membres VIP.
 */
export const extendAdVip = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const {adId, days} = (request.data || {}) as { adId?: unknown; days?: unknown };
    if (!adId || typeof adId !== "string") {
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

    const isBusinessActive =
      userData.subscriptionTier === "BUSINESS" &&
      Boolean(
        userData.subscriptionExpiresAt &&
        new Date(userData.subscriptionExpiresAt).getTime() > Date.now()
      );

    // 6.3 Accepter le cas Business gratuit (devis à 0 pour un abonné Business actif)
    if (!isVipExempt && !isBusinessActive) {
      throw new HttpsError(
        "permission-denied",
        "La prolongation sans frais est réservée aux abonnés Business actifs et membres VIP."
      );
    }

    const adRef = db.collection("ads").doc(adId);
    const adSnap = await adRef.get();
    if (!adSnap.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adSnap.data() || {};
    if (ad.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Accès non autorisé.");
    }

    if (ad.status === "deleted" || ad.status === "rejected") {
      throw new HttpsError(
        "failed-precondition",
        "Cette annonce ne peut plus être prolongée."
      );
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
 * Phase 6.2 requestExtension : Prolongation sécurisée par paiement validé.
 */
export const requestExtension = onCall(
  {cors: true},
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const {
      adId,
      days,
      paymentReference,
    } = (request.data || {}) as {
      adId?: unknown;
      days?: unknown;
      paymentReference?: unknown;
    };
    if (!adId || typeof adId !== "string") {
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
    const isBusinessActive =
      userData.subscriptionTier === "BUSINESS" &&
      Boolean(
        userData.subscriptionExpiresAt &&
        new Date(userData.subscriptionExpiresAt).getTime() > Date.now()
      );

    const adRef = db.collection("ads").doc(adId);
    const adSnap = await adRef.get();
    if (!adSnap.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adSnap.data() || {};
    if (ad.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Accès non autorisé.");
    }
    if (ad.status === "deleted" || ad.status === "rejected") {
      throw new HttpsError(
        "failed-precondition",
        "Cette annonce ne peut plus être prolongée."
      );
    }

    // Gratuit pour Business actif et membres exemptés
    if (isVipExempt || isBusinessActive) {
      const now = Date.now();
      const base = Math.max(
        ad.expiresAt ? new Date(ad.expiresAt).getTime() : now,
        now
      );
      const requestedDays = Math.min(Number(days) || 30, 365);
      const maxExpiry = now + 365 * 86400000;
      const computedExpiry = Math.min(base + requestedDays * 86400000, maxExpiry);
      const newExpiresAt = new Date(computedExpiry).toISOString();

      await adRef.update({
        status: "ACTIVE",
        expiresAt: newExpiresAt,
        lastExtendedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
      return {success: true, expiresAt: newExpiresAt};
    }

    // 6.2 Pour les autres utilisateurs : exige un paiement SUCCESS AD_EXTEND
    if (!paymentReference || typeof paymentReference !== "string") {
      throw new HttpsError(
        "failed-precondition",
        "Un paiement validé est requis pour prolonger cette annonce."
      );
    }

    const paySnap = await db.collection("payments").doc(paymentReference).get();
    if (!paySnap.exists) {
      throw new HttpsError("not-found", "Paiement de prolongation introuvable.");
    }
    const payData = paySnap.data() || {};
    if (
      payData.status !== "SUCCESS" ||
      payData.userId !== request.auth.uid ||
      payData.productId !== "AD_EXTEND"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Paiement non vérifié ou non conforme pour la prolongation."
      );
    }

    const payMeta = (payData.metadata as Record<string, unknown>) || {};
    if (payMeta.adId && payMeta.adId !== adId) {
      throw new HttpsError(
        "failed-precondition",
        "Ce paiement cible une autre annonce."
      );
    }

    if (payData.consumedByAdId && payData.consumedByAdId !== adId) {
      throw new HttpsError(
        "failed-precondition",
        "Ce paiement a déjà été consommé."
      );
    }

    const extendDays = Number(payMeta.days || days || 30);
    const now = Date.now();
    const base = Math.max(
      ad.expiresAt ? new Date(ad.expiresAt).getTime() : now,
      now
    );
    const maxExpiry = now + 365 * 86400000;
    const computedExpiry = Math.min(base + extendDays * 86400000, maxExpiry);
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

    await paySnap.ref.update({
      consumedByAdId: adId,
      updatedAt: new Date(now).toISOString(),
    });

    return {success: true, expiresAt: newExpiresAt};
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

