/**
 * Tarification officielle et calcul de prix côté serveur (BizBooster Gabon)
 * Aligné strictement avec PRICING_CONFIG et utils/formatters.ts
 */

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

export const PRICING_DURATIONS: Record<number, number> = {
  3: 1500,
  7: 3000,
  15: 5500,
  30: 9500,
  60: 16000,
};

export const EXTENSION_PRICES: Record<number, number> = {
  7: 3000,
  15: 5500,
  30: 9500,
  60: 16000,
  90: 22000,
  180: 40000,
  365: 75000,
};

/**
 * Nombre de photos incluses par palier.
 * @param {string} [tier] - Le palier de souscription.
 * @return {number} Nombre de photos gratuites incluses.
 */
export function getTierFreePhotosCount(tier?: string): number {
  switch (tier) {
  case "BUSINESS":
    return 5;
  case "ELITE":
    return 4;
  case "PRO":
  case "STANDARD":
  default:
    return 3;
  }
}

/**
 * Calcule le prix serveur garanti.
 * @param {string} [productId] - L'identifiant du produit ou service.
 * @param {Record<string, unknown>} [metadata] - Métadonnées associées.
 * @param {string} [userTier] - Le palier actif de l'utilisateur.
 * @param {boolean} [isExempt] - Si l'utilisateur est exempté de paiement.
 * @param {boolean} [isCoveredByQuota] - Si couvert par le quota gratuit.
 * @return {number} Prix calculé en FCFA.
 */
export function calculateServerPrice(
  productId?: string,
  metadata?: Record<string, unknown>,
  userTier?: string,
  isExempt?: boolean,
  isCoveredByQuota?: boolean
): number {
  if (isExempt) return 0;

  if (productId && SERVER_PRODUCTS[productId] !== undefined) {
    return SERVER_PRODUCTS[productId];
  }

  // Prolongation d'annonce (AD_EXTEND)
  if (productId === "AD_EXTEND" && metadata) {
    const days = Number(metadata.days || 0);
    const basePrice = EXTENSION_PRICES[days] || 3000;
    if (userTier === "BUSINESS") return 0;
    if (userTier === "ELITE") return Math.round(basePrice * 0.5);
    if (userTier === "PRO") return Math.round(basePrice * 0.75);
    return basePrice;
  }

  // Publication d'annonce (AD_PUBLISH)
  if (productId === "AD_PUBLISH" && metadata) {
    const durationDays = Number(metadata.durationDays || 30);
    const photoCount = Number(metadata.photoCount || 0);
    const hasVideo = Boolean(metadata.hasVideo);
    const withBoost = Boolean(metadata.withBoost);
    const requiresSubscription = Boolean(metadata.requiresSubscription);
    const selectedTier = String(metadata.selectedTierToBuy || "");

    let subTotal = 0;
    let effectiveTier = userTier || "STANDARD";

    if (requiresSubscription && SERVER_PRODUCTS[`SUB_${selectedTier}`]) {
      subTotal = SERVER_PRODUCTS[`SUB_${selectedTier}`];
      effectiveTier = selectedTier;
    }

    let baseDurationPrice = 0;
    if (!requiresSubscription && !isCoveredByQuota) {
      baseDurationPrice = PRICING_DURATIONS[durationDays] ?? 9500;
    }

    // Calcul photos incluses et photos supplémentaires
    const includedPhotos = getTierFreePhotosCount(effectiveTier);
    const extraPhotosCount = Math.max(0, photoCount - includedPhotos);
    const extraPhotosCost = extraPhotosCount * 500;

    // Tarification vidéo descriptive
    let videoCost = 0;
    if (hasVideo) {
      if (effectiveTier === "BUSINESS") {
        videoCost = 0;
      } else if (effectiveTier === "ELITE") {
        videoCost = 1000;
      } else {
        videoCost = 2000;
      }
    }

    // Boost de publication optionnel
    let boostCost = 0;
    if (withBoost && !requiresSubscription) {
      boostCost = 5000;
    }

    return (
      subTotal +
      baseDurationPrice +
      extraPhotosCost +
      videoCost +
      boostCost
    );
  }

  throw new Error(
    `Identifiant de produit inconnu ou non tarifié: ${productId}`
  );
}
