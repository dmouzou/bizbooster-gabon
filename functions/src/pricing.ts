/**
 * Tarification officielle côté serveur (BizBooster Gabon).
 *
 * Principe : le client ne fournit que des INTENTIONS (produit, durée, nombre
 * de photos...). Chaque valeur est validée contre une liste blanche, et le
 * serveur renvoie une version assainie des métadonnées. Seule cette version
 * assainie est ensuite stockée dans le document payments et utilisée pour
 * l'attribution des avantages. Rien de ce que le client envoie n'est recopié
 * tel quel.
 */

export class PricingError extends Error {
  /**
   * @param {string} message Message affichable à l'utilisateur.
   */
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export const SUBSCRIPTION_PRICES: Record<string, number> = {
  PRO: 29000,
  ELITE: 59000,
  BUSINESS: 99000,
};

export const TIER_RANK: Record<string, number> = {
  STANDARD: 0,
  PRO: 1,
  ELITE: 2,
  BUSINESS: 3,
};

export const BOOST_PRICE = 5000;

export const BOOST_PRODUCTS: Record<string, {price: number; boosts: number}> = {
  BOOST_SINGLE: {price: 5000, boosts: 1},
  BOOST_5: {price: 15000, boosts: 5},
  BOOST_10: {price: 25000, boosts: 10},
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

export const MAX_PHOTOS = 10;
export const MAX_BOOSTS = 20;
export const MAX_VALIDITY_DAYS = 365;
export const UPGRADE_SURPLUS_WINDOW_DAYS = 7;
export const EXTRA_PHOTO_PRICE = 500;

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const PRODUCT_ALIASES: Record<string, string> = {
  PRO: "SUB_PRO",
  ELITE: "SUB_ELITE",
  BUSINESS: "SUB_BUSINESS",
  SINGLE: "BOOST_SINGLE",
};

export interface PriceContext {
  /** Partenaire VIP exonéré : montant forcé à 0. */
  isExempt: boolean;
  /** Palier réellement actif (expiration déjà appliquée). */
  effectiveTier: string;
  /** Ancienneté de l'abonnement actif en jours (0 si aucun). */
  subscriptionAgeDays: number;
  /** Vrai si consumedFreeAdsCount < quota du palier effectif. */
  hasFreeAdQuota: boolean;
  /** Solde actuel de boosters offerts. */
  freeBoosts: number;
  /** AD_EXTEND : jours restants de l'annonce ciblée. */
  adRemainingDays?: number;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  productId: string;
  amount: number;
  /** Métadonnées assainies : seule source autorisée pour l'attribution. */
  metadata: Record<string, unknown>;
  lines: QuoteLine[];
}

/**
 * Nombre de photos incluses par palier.
 * @param {string} [tier] Le palier de souscription.
 * @return {number} Nombre de photos gratuites incluses.
 */
export function getTierFreePhotosCount(tier?: string): number {
  switch (tier) {
  case "BUSINESS":
    return 5;
  case "ELITE":
    return 4;
  default:
    return 3;
  }
}

/**
 * @param {unknown} v Valeur brute.
 * @param {string} label Libellé pour le message d'erreur.
 * @return {string} Identifiant validé.
 */
function cleanId(v: unknown, label: string): string {
  const s = typeof v === "string" ? v : "";
  if (!ID_RE.test(s)) throw new PricingError(`${label} invalide.`);
  return s;
}

/**
 * @param {unknown} raw Identifiant produit brut.
 * @return {string} Identifiant canonique.
 */
function canonicalProductId(raw: unknown): string {
  if (typeof raw !== "string" || !raw) {
    throw new PricingError("Produit requis.");
  }
  return PRODUCT_ALIASES[raw] || raw;
}

/**
 * @param {string} tier Palier visé.
 * @param {PriceContext} ctx Contexte utilisateur.
 * @param {string} productId Identifiant du produit.
 * @return {Quote} Devis de l'abonnement (surplus si surclassement < 7 jours).
 */
function quoteSubscription(
  tier: string,
  ctx: PriceContext,
  productId: string
): Quote {
  const price = SUBSCRIPTION_PRICES[tier];
  if (!price) throw new PricingError("Forfait inconnu.");
  const target = TIER_RANK[tier];
  const current = TIER_RANK[ctx.effectiveTier] ?? 0;
  if (target <= current) {
    throw new PricingError(
      "Ce forfait est identique ou inférieur à votre forfait actif."
    );
  }
  const inSurplusWindow =
    current > 0 && ctx.subscriptionAgeDays <= UPGRADE_SURPLUS_WINDOW_DAYS;
  const amount = inSurplusWindow ?
    price - SUBSCRIPTION_PRICES[ctx.effectiveTier] :
    price;
  return {
    productId,
    amount,
    metadata: {tier},
    lines: [{
      label: inSurplusWindow ?
        `Surclassement vers ${tier} (surplus 1re semaine)` :
        `Abonnement ${tier} (30 jours)`,
      amount,
    }],
  };
}

/**
 * @param {string} productId Produit boost canonique.
 * @param {Record<string, unknown>} meta Métadonnées brutes.
 * @param {PriceContext} ctx Contexte utilisateur.
 * @return {Quote} Devis du boost ou du pack.
 */
function quoteBoost(
  productId: string,
  meta: Record<string, unknown>,
  ctx: PriceContext
): Quote {
  const def = BOOST_PRODUCTS[productId];
  const hasAd = meta.adId !== undefined && meta.adId !== null &&
    meta.adId !== "";
  const adId = hasAd ? cleanId(meta.adId, "Annonce") : undefined;
  if (productId === "BOOST_SINGLE" && !adId) {
    throw new PricingError("Annonce requise pour un boost unitaire.");
  }
  // Un boost est consommé immédiatement sur l'annonce, le reste est crédité.
  const credited = adId ? def.boosts - 1 : def.boosts;
  if (ctx.freeBoosts + credited > MAX_BOOSTS) {
    throw new PricingError(
      `Plafond de ${MAX_BOOSTS} boosters : vous en avez déjà ` +
      `${ctx.freeBoosts}. Utilisez-les avant d'en acheter.`
    );
  }
  return {
    productId,
    amount: def.price,
    metadata: adId ? {adId, boosts: def.boosts} : {boosts: def.boosts},
    lines: [{label: `Boost "En Tête de Liste" (${def.boosts})`,
      amount: def.price}],
  };
}

/**
 * @param {Record<string, unknown>} meta Métadonnées brutes.
 * @param {PriceContext} ctx Contexte utilisateur.
 * @return {Quote} Devis de prolongation.
 */
function quoteExtension(
  meta: Record<string, unknown>,
  ctx: PriceContext
): Quote {
  const adId = cleanId(meta.adId, "Annonce");
  const days = Number(meta.days);
  const basePrice = EXTENSION_PRICES[days];
  if (basePrice === undefined) {
    throw new PricingError("Durée de prolongation non proposée.");
  }
  if (
    ctx.adRemainingDays !== undefined &&
    ctx.adRemainingDays + days > MAX_VALIDITY_DAYS
  ) {
    throw new PricingError(
      `Une annonce ne peut pas dépasser ${MAX_VALIDITY_DAYS} jours de validité.`
    );
  }
  const rate = ctx.effectiveTier === "BUSINESS" ? 0 :
    ctx.effectiveTier === "ELITE" ? 0.5 :
      ctx.effectiveTier === "PRO" ? 0.75 : 1;
  const amount = Math.round(basePrice * rate);
  return {
    productId: "AD_EXTEND",
    amount,
    metadata: {adId, days},
    lines: [{label: `Prolongation +${days} jours`, amount}],
  };
}

/**
 * @param {Record<string, unknown>} meta Métadonnées brutes.
 * @param {PriceContext} ctx Contexte utilisateur.
 * @return {Quote} Devis de publication.
 */
function quoteAdPublish(
  meta: Record<string, unknown>,
  ctx: PriceContext
): Quote {
  const adId = cleanId(meta.adId, "Annonce");
  const durationDays = Number(meta.durationDays);
  if (PRICING_DURATIONS[durationDays] === undefined) {
    throw new PricingError("Durée de publication non proposée.");
  }
  const photoCount = Number(meta.photoCount ?? 0);
  if (!Number.isInteger(photoCount) || photoCount < 0 ||
    photoCount > MAX_PHOTOS) {
    throw new PricingError(`Entre 0 et ${MAX_PHOTOS} photos autorisées.`);
  }
  const hasVideo = meta.hasVideo === true;
  const withBoost = meta.withBoost === true;
  const requiresSubscription = meta.requiresSubscription === true;

  const lines: QuoteLine[] = [];
  let amount = 0;
  let benefitTier = ctx.effectiveTier;
  let usesFreeQuota = false;
  let selectedTier: string | undefined;

  if (requiresSubscription) {
    selectedTier = String(meta.selectedTierToBuy || "");
    const sub = quoteSubscription(selectedTier, ctx, `SUB_${selectedTier}`);
    amount += sub.amount;
    lines.push(...sub.lines);
    benefitTier = selectedTier;
  } else if (ctx.hasFreeAdQuota) {
    usesFreeQuota = !ctx.isExempt;
    lines.push({label: "Publication incluse dans votre quota", amount: 0});
  } else {
    const base = PRICING_DURATIONS[durationDays];
    amount += base;
    lines.push({label: `Publication ${durationDays} jours`, amount: base});
  }

  const extraPhotos = Math.max(
    0, photoCount - getTierFreePhotosCount(benefitTier)
  );
  if (extraPhotos > 0) {
    const cost = extraPhotos * EXTRA_PHOTO_PRICE;
    amount += cost;
    lines.push({label: `${extraPhotos} photo(s) supplémentaire(s)`,
      amount: cost});
  }

  if (hasVideo) {
    const cost = benefitTier === "BUSINESS" ? 0 :
      benefitTier === "ELITE" ? 1000 : 2000;
    amount += cost;
    lines.push({label: "Vidéo descriptive", amount: cost});
  }

  let boostSource: string | null = null;
  if (withBoost) {
    if (requiresSubscription) {
      boostSource = "SUBSCRIPTION";
    } else if (ctx.isExempt) {
      boostSource = "EXEMPT";
    } else if (ctx.freeBoosts > 0) {
      boostSource = "FREE_BALANCE";
    } else {
      boostSource = "PAID";
      amount += BOOST_PRICE;
      lines.push({label: "Boost 7 jours", amount: BOOST_PRICE});
    }
  }

  const metadata: Record<string, unknown> = {
    adId,
    durationDays,
    photoCount,
    hasVideo,
    withBoost,
    requiresSubscription,
    boostSource,
    usesFreeQuota,
  };
  if (selectedTier) metadata.selectedTierToBuy = selectedTier;

  return {productId: "AD_PUBLISH", amount, metadata, lines};
}

/**
 * Point d'entrée unique de tarification. Lève PricingError si la demande
 * est incohérente (message affichable tel quel à l'utilisateur).
 *
 * @param {unknown} rawProductId Identifiant produit envoyé par le client.
 * @param {unknown} rawMetadata Métadonnées envoyées par le client.
 * @param {PriceContext} ctx Contexte calculé côté serveur.
 * @return {Quote} Montant, métadonnées assainies et détail des lignes.
 */
export function quoteOrder(
  rawProductId: unknown,
  rawMetadata: unknown,
  ctx: PriceContext
): Quote {
  const productId = canonicalProductId(rawProductId);
  const meta = (rawMetadata && typeof rawMetadata === "object" ?
    rawMetadata : {}) as Record<string, unknown>;

  let quote: Quote;
  if (productId.startsWith("SUB_")) {
    quote = quoteSubscription(productId.slice(4), ctx, productId);
  } else if (BOOST_PRODUCTS[productId]) {
    quote = quoteBoost(productId, meta, ctx);
  } else if (productId === "AD_EXTEND") {
    quote = quoteExtension(meta, ctx);
  } else if (productId === "AD_PUBLISH") {
    quote = quoteAdPublish(meta, ctx);
  } else {
    throw new PricingError("Produit inconnu.");
  }

  if (ctx.isExempt) quote.amount = 0;
  return quote;
}

/**
 * Enveloppe de compatibilité temporaire pour calculateServerPrice.
 */
export function calculateServerPrice(
  productId?: string,
  metadata?: Record<string, unknown>,
  userTier?: string,
  isExempt?: boolean,
  isCoveredByQuota?: boolean
): number {
  if (isExempt) return 0;
  const effectiveTier = userTier || "STANDARD";
  const meta: Record<string, unknown> = {
    adId: "ad_compat",
    durationDays: 30,
    ...metadata,
  };
  const ctx: PriceContext = {
    isExempt: Boolean(isExempt),
    effectiveTier,
    subscriptionAgeDays: 0,
    hasFreeAdQuota: Boolean(isCoveredByQuota),
    freeBoosts: 0,
  };
  if (productId === "BOOST_SINGLE" && !meta.adId) {
    meta.adId = "ad_compat";
  }
  return quoteOrder(productId, meta, ctx).amount;
}
