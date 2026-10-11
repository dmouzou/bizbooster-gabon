import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {
  getFirestore,
  AggregateField,
  FieldValue,
} from "firebase-admin/firestore";
import {getAuth, UserRecord} from "firebase-admin/auth";
import {initializeApp} from "firebase-admin/app";

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
 * Normalise un numéro (Gabon +241 ou Inde +91).
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
    return {
      e164: `+91${clean}`,
      rawDigits: clean,
    };
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

// Table des quotas partagée (Phase 7)
export const SUBSCRIPTION_QUOTAS: Record<string, number> = {
  STANDARD: 3,
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

const EXTENSION_PRICES: Record<number, number> = {
  7: 2000,
  15: 4000,
  30: 7500,
  60: 14000,
  90: 20000,
  180: 38000,
  365: 75000,
};

/**
 * Récupère les secrets SingPay depuis Secret Manager / environnement.
 * Aucun secret n'est lu depuis Firestore.
 *
 * @return {Record<string, string>} Configuration et secrets SingPay.
 */
function getSingPayConfig() {
  const clientId =
    singpayClientId.value() || process.env.SINGPAY_CLIENT_ID || "";
  const clientSecret =
    singpayClientSecret.value() || process.env.SINGPAY_CLIENT_SECRET || "";
  const walletId =
    singpayWalletId.value() || process.env.SINGPAY_WALLET_ID || "";
  const webhookSecret =
    singpayWebhookSecret.value() ||
    process.env.SINGPAY_WEBHOOK_SECRET ||
    clientSecret;
  const moovDisbursement =
    singpayMoovDisbursement.value() ||
    process.env.SINGPAY_MOOV_DISBURSEMENT ||
    "";
  const airtelDisbursement =
    singpayAirtelDisbursement.value() ||
    process.env.SINGPAY_AIRTEL_DISBURSEMENT ||
    "";

  return {
    clientId,
    clientSecret,
    walletId,
    webhookSecret,
    moovDisbursement,
    airtelDisbursement,
  };
}

/**
 * Calcule le tarif garanti d'un produit côté serveur.
 * Ne fait jamais confiance au montant fourni par le client.
 *
 * @param {string} [productId] Identifiant du produit.
 * @param {Record<string, unknown>} [metadata] Métadonnées associées.
 * @param {string} [userTier] Niveau d'abonnement actuel de l'utilisateur.
 * @return {number} Prix garanti calculé en FCFA.
 */
export function calculateServerPrice(
  productId?: string,
  metadata?: Record<string, unknown>,
  userTier?: string
): number {
  if (productId && SERVER_PRODUCTS[productId] !== undefined) {
    return SERVER_PRODUCTS[productId];
  }

  if (productId === "AD_EXTEND" && metadata) {
    const days = Number(metadata.days || 0);
    const basePrice = EXTENSION_PRICES[days] || 2000;
    if (userTier === "BUSINESS") return 0;
    if (userTier === "ELITE") return Math.round(basePrice * 0.5);
    if (userTier === "PRO") return Math.round(basePrice * 0.75);
    return basePrice;
  }

  if (productId === "AD_PUBLISH" && metadata) {
    const durationDays = Number(metadata.durationDays || 30);
    const photoCount = Number(metadata.photoCount || 0);
    const hasVideo = Boolean(metadata.hasVideo);
    const withBoost = Boolean(metadata.withBoost);
    const requiresSubscription = Boolean(metadata.requiresSubscription);
    const selectedTier = String(metadata.selectedTierToBuy || "");

    let total = 0;
    if (requiresSubscription && SERVER_PRODUCTS[`SUB_${selectedTier}`]) {
      total += SERVER_PRODUCTS[`SUB_${selectedTier}`];
    } else {
      if (durationDays <= 15) total += 1500;
      else if (durationDays <= 30) total += 2500;
      else if (durationDays <= 60) total += 4500;
      else total += 6000;
    }

    if (photoCount > 5) {
      total += (photoCount - 5) * 500;
    }
    if (hasVideo) {
      total += 2000;
    }
    if (withBoost && !requiresSubscription) {
      total += 5000;
    }
    return total;
  }

  throw new HttpsError(
    "invalid-argument",
    `Identifiant de produit inconnu ou non tarife: ${productId}`
  );
}

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
      updatedAt: now.toISOString(),
    });
  } else if (productId === "BOOST_SINGLE" || productId === "SINGLE") {
    // 2. Boost individuel
    const adId = metadata.adId as string;
    if (adId) {
      const adRef = db.collection("ads").doc(adId);
      const adSnap = await adRef.get();
      if (adSnap.exists) {
        await adRef.update({
          isFeatured: true,
          featuredAt: now.toISOString(),
          featuredUntil: new Date(now.getTime() + 7 * 86400000).toISOString(),
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
        await adRef.update({
          isFeatured: true,
          featuredAt: now.toISOString(),
          featuredUntil: new Date(now.getTime() + 7 * 86400000).toISOString(),
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
        await adRef.update({
          isFeatured: true,
          featuredAt: now.toISOString(),
          featuredUntil: new Date(now.getTime() + 7 * 86400000).toISOString(),
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

    // Calcul du prix côté serveur : ne jamais faire confiance au montant client
    let serverAmount = 0;
    if (productId) {
      serverAmount = calculateServerPrice(
        productId,
        metadata as Record<string, unknown> | undefined,
        userData.subscriptionTier as string | undefined
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

    // Récupération des secrets SingPay depuis Secret Manager
    const cfg = getSingPayConfig();
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

    const cfg = getSingPayConfig();
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

      const cfg = getSingPayConfig();
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

