import { Ad, MainCategory, SubscriptionTier, getTierPriority } from '../types';

/**
 * =================================================================================================
 * ALGORITHME OFFICIEL DE ROTATION EN TÊTE D'AFFICHE ET CLASSEMENT (BIZBOOSTER GABON)
 * Refonte Phase 4 : Équitable, borné, déterministe, testable et ultra-performant.
 * =================================================================================================
 */

export type EffectiveAdTier = 'VIP' | SubscriptionTier;

export interface RankingConfig {
  windowDurationMs: number; // 120 min = 7 200 000 ms
  slotDurationMs: number; // 12 min = 720 000 ms
  totalSlots: number; // 10 créneaux
  headBlockRatio: number; // 30% des 20 premières positions
  headBlockSizeMax: number; // Jamais plus de 6
  maxAdsPerAdvertiserInHead: number; // Au plus 2 par userId
  boostDurationDays: number; // 7 jours
  tierFrequencies: Record<string, number>;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  windowDurationMs: 120 * 60 * 1000,
  slotDurationMs: 12 * 60 * 1000,
  totalSlots: 10,
  headBlockRatio: 0.3,
  headBlockSizeMax: 6,
  maxAdsPerAdvertiserInHead: 2,
  boostDurationDays: 7,
  tierFrequencies: {
    STANDARD: 1,
    PRO: 2,
    ELITE: 6,
    BUSINESS: 10,
    VIP: 10,
  },
};

export interface UserSignals {
  categoryAffinities: Record<string, number>;
  locationAffinities: Record<string, number>;
  preferredCategories: string[];
  preferredProvinces: string[];
  viewedAdIds: string[];
}

export interface RankingContext {
  now: number; // Heure serveur corrigée (ou fallback local)
  signals: UserSignals; // Préférences et affinités déjà lues (1 seul parse)
  favoriteIds: string[];
  searchQuery?: string;
  config: RankingConfig;
}

export interface SpotlightInfo {
  tier: EffectiveAdTier;
  frequencyPer2Hours: number;
  dutyCyclePercent: number;
  totalSlots: number;
  currentSlot: number;
  slotDurationMinutes: number;
  isSpotlightActive: boolean;
  activeSlots: number[];
}

export type TierRotationDetails = SpotlightInfo;

const STORAGE_KEYS = {
  CATEGORIES: 'bizbooster_user_cat_affinities',
  LOCATIONS: 'bizbooster_user_loc_affinities',
  HISTORY: 'bizbooster_user_view_history',
  PREFERENCES: 'bizbooster_user_preferences',
  INTERACTIONS_TODAY: 'bizbooster_interactions_today',
};

/**
 * Fonction de hachage 32-bit rapide, déterministe et uniforme (FNV-1a variant).
 * Fonction pure.
 */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

/**
 * Détermine le palier effectif de l'annonce pour le classement.
 * Fonction pure.
 */
export function getAdEffectiveTier(ad: Ad): EffectiveAdTier {
  if (ad.isOwnerVip || (ad.ownerTier as any) === 'VIP') return 'VIP';
  if (ad.ownerTier === 'BUSINESS') return 'BUSINESS';
  if (ad.ownerTier === 'ELITE') return 'ELITE';
  if (ad.ownerTier === 'PRO') return 'PRO';
  return 'STANDARD';
}

/**
 * Vérifie si le boost payant est actuellement actif.
 * Règle Phase 4 : Absence de featuredUntil donne NON actif. Expire dès now >= featuredUntil.
 * Fonction pure.
 */
export function isAdBoostFeatured(ad: Ad, now: number = Date.now()): boolean {
  if (!ad.isFeatured || !ad.featuredUntil) return false;
  const exp = new Date(ad.featuredUntil).getTime();
  if (isNaN(exp)) return false;
  return exp > now;
}

/**
 * Calcule les créneaux d'apparition en tête d'affiche selon le palier.
 * Sélection des créneaux sans corrélation (Phase 4.2) :
 * Standard : h % 10 (1 créneau)
 * Pro : p = h % 5, p et p + 5 (2 créneaux espacés de 60 min)
 * Élite : 6 créneaux régulièrement répartis par la grille round(i * 10 / 6) pour i = 0..5, décalés de h % 10 modulo 10
 * Business & VIP : 10 créneaux (100% du temps)
 * Fonction pure.
 */
export function getSpotlightSlots(ad: Ad, now: number = Date.now()): SpotlightInfo {
  const tier = getAdEffectiveTier(ad);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 120 minutes
  const SLOT_DURATION_MS = 12 * 60 * 1000; // 12 minutes
  const TOTAL_SLOTS = 10;

  const epoch = Math.floor(now / TWO_HOURS_MS);
  const currentSlot = Math.floor((now % TWO_HOURS_MS) / SLOT_DURATION_MS);
  const h = hashString(`${ad.id || 'ad'}:${epoch}`);

  let activeSlots: number[] = [];
  let frequencyPer2Hours = 1;

  switch (tier) {
    case 'VIP':
    case 'BUSINESS':
      frequencyPer2Hours = 10;
      activeSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      break;

    case 'ELITE': {
      frequencyPer2Hours = 6;
      const offset = h % TOTAL_SLOTS;
      const grid = [0, 1, 2, 3, 4, 5].map((i) => Math.round((i * 10) / 6));
      activeSlots = Array.from(new Set(grid.map((g) => (g + offset) % TOTAL_SLOTS))).sort((a, b) => a - b);
      break;
    }

    case 'PRO': {
      frequencyPer2Hours = 2;
      const p = h % 5;
      activeSlots = [p, p + 5].sort((a, b) => a - b);
      break;
    }

    case 'STANDARD':
    default: {
      frequencyPer2Hours = 1;
      activeSlots = [h % TOTAL_SLOTS];
      break;
    }
  }

  const isSpotlightActive = activeSlots.includes(currentSlot);

  return {
    tier,
    frequencyPer2Hours,
    dutyCyclePercent: (frequencyPer2Hours / TOTAL_SLOTS) * 100,
    totalSlots: TOTAL_SLOTS,
    currentSlot,
    slotDurationMinutes: 12,
    isSpotlightActive,
    activeSlots,
  };
}

export const getTierRotationDetails = getSpotlightSlots;

export function isAdSpotlightActive(ad: Ad, now: number = Date.now()): boolean {
  if (isAdBoostFeatured(ad, now)) return true;
  return getSpotlightSlots(ad, now).isSpotlightActive;
}

/**
 * Calcul du score organique (Niveau 3) sans somme de constantes géantes.
 * Fraîcheur exponentielle + affinités + préférences explicites + favoris - pénalité vue + pertinence recherche.
 * Fonction pure.
 */
export function computeOrganicScore(
  ad: Ad,
  ctx: RankingContext,
  favCatSet: Set<string>
): number {
  let score = 0;

  // 1. Fraîcheur : décroissance exponentielle (demi-vie ~ 7 jours = 168h)
  const pubTime = new Date(ad.publishedAt || 0).getTime();
  const ageHours = Math.max(0, (ctx.now - pubTime) / 3600000);
  const recencyScore = 100 * Math.exp(-ageHours / 168);
  score += recencyScore;

  // 2. Affinités implicites de catégories et lieux
  const catViews = ctx.signals.categoryAffinities[ad.mainCategory] || 0;
  score += Math.min(catViews * 4, 30);

  if (ad.location?.province) {
    const provViews = ctx.signals.locationAffinities[ad.location.province] || 0;
    score += Math.min(provViews * 2, 15);
  }
  if (ad.location?.city) {
    const cityViews = ctx.signals.locationAffinities[ad.location.city] || 0;
    score += Math.min(cityViews * 3, 20);
  }

  // 3. Préférences explicites enregistrées
  if (ctx.signals.preferredCategories.includes(ad.mainCategory)) {
    score += 35;
  }
  if (ad.location?.province && ctx.signals.preferredProvinces.includes(ad.location.province)) {
    score += 20;
  }

  // 4. Favoris
  if (favCatSet.has(ad.mainCategory)) {
    score += 25;
  }
  if (ctx.favoriteIds.includes(ad.id)) {
    score += 40;
  }

  // 5. Pénalité pour annonces déjà consultées
  if (ctx.signals.viewedAdIds.includes(ad.id)) {
    score -= 30;
  }

  // 6. Pertinence de recherche si active
  if (ctx.searchQuery && ctx.searchQuery.trim()) {
    const q = ctx.searchQuery.trim().toLowerCase();
    const title = (ad.title || '').toLowerCase();
    const desc = (ad.description || '').toLowerCase();
    if (title === q) {
      score += 500;
    } else if (title.includes(q)) {
      score += 300;
    } else if (desc.includes(q)) {
      score += 80;
    }
  }

  return score;
}

/**
 * Algorithme principal de classement (rankAds).
 * Entrelacement équitable et borné :
 * - Niveau 1 : Boost payant actif
 * - Niveau 2 : Spotlight dans son créneau
 * - Niveau 3 : Flux organique
 * Bloc de tête borné à au plus 30% des 20 premières positions (max 6), max 2 par annonceur.
 * Technique decorate-sort : calcul des scores en Map avant le tri (< 50ms sur 2000 annonces).
 * Fonction pure.
 */
export function rankAds(ads: Ad[], ctx: RankingContext): Ad[] {
  if (!ads || ads.length === 0) return [];

  const config = ctx.config || DEFAULT_RANKING_CONFIG;
  const TWO_HOURS_MS = config.windowDurationMs;
  const SLOT_DURATION_MS = config.slotDurationMs;
  const epoch = Math.floor(ctx.now / TWO_HOURS_MS);
  const slot = Math.floor((ctx.now % TWO_HOURS_MS) / SLOT_DURATION_MS);

  // Ensemble des catégories favorites
  const favCatSet = new Set<string>();
  if (ctx.favoriteIds && ctx.favoriteIds.length > 0) {
    for (const id of ctx.favoriteIds) {
      const found = ads.find((a) => a.id === id);
      if (found?.mainCategory) favCatSet.add(found.mainCategory);
    }
  }

  // Decorate : calcul unique des scores organiques avant le tri
  const scoreMap = new Map<string, number>();
  for (const ad of ads) {
    scoreMap.set(ad.id, computeOrganicScore(ad, ctx, favCatSet));
  }

  // Séparation en niveaux
  const level1Boosted: Ad[] = [];
  const level2Spotlight: Ad[] = [];
  const level3Organic: Ad[] = [];

  for (const ad of ads) {
    if (isAdBoostFeatured(ad, ctx.now)) {
      level1Boosted.push(ad);
    } else if (getSpotlightSlots(ad, ctx.now).isSpotlightActive) {
      level2Spotlight.push(ad);
    } else {
      level3Organic.push(ad);
    }
  }

  // Niveau 1 : Tri par ancienneté du boost (le plus récent en premier), départage par score
  level1Boosted.sort((a, b) => {
    // Si recherche active avec forte pertinence organique, la pertinence prime
    if (ctx.searchQuery) {
      const sA = scoreMap.get(a.id) || 0;
      const sB = scoreMap.get(b.id) || 0;
      if (Math.abs(sB - sA) > 150) return sB - sA;
    }
    const tA = new Date(a.featuredAt || a.publishedAt || 0).getTime();
    const tB = new Date(b.featuredAt || b.publishedAt || 0).getTime();
    if (tB !== tA) return tB - tA;
    return (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
  });

  // Niveau 2 : Équité par tirage pseudo-aléatoire hash(adId:epoch:slot), départage par score
  const getLottery = (ad: Ad) => hashString(`${ad.id}:${epoch}:${slot}`);
  const tierBands: Record<EffectiveAdTier, Ad[]> = {
    VIP: [],
    BUSINESS: [],
    ELITE: [],
    PRO: [],
    STANDARD: [],
  };

  for (const ad of level2Spotlight) {
    const t = getAdEffectiveTier(ad);
    tierBands[t].push(ad);
  }

  const sortBand = (list: Ad[]) => {
    list.sort((a, b) => {
      const lA = getLottery(a);
      const lB = getLottery(b);
      // Marge faible (2%) : départage par score
      if (Math.abs(lB - lA) < 42949672) {
        return (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
      }
      return lB - lA;
    });
  };

  sortBand(tierBands.VIP);
  sortBand(tierBands.BUSINESS);
  sortBand(tierBands.ELITE);
  sortBand(tierBands.PRO);
  sortBand(tierBands.STANDARD);

  // Construction du bloc de tête borné (≤ 30% du top 20, max 6, max 2 par userId)
  const topPageSize = Math.min(20, ads.length);
  const maxHeadSize = Math.min(
    config.headBlockSizeMax,
    Math.max(1, Math.floor(topPageSize * config.headBlockRatio))
  );

  const headBlock: Ad[] = [];
  const headAdIds = new Set<string>();
  const userHeadCount: Record<string, number> = {};

  const tryAddToHead = (ad: Ad): boolean => {
    if (headBlock.length >= maxHeadSize) return false;
    const uid = ad.userId || 'anon';
    if ((userHeadCount[uid] || 0) >= config.maxAdsPerAdvertiserInHead) {
      return false;
    }
    headBlock.push(ad);
    headAdIds.add(ad.id);
    userHeadCount[uid] = (userHeadCount[uid] || 0) + 1;
    return true;
  };

  const highTierSpotlight = [...tierBands.VIP, ...tierBands.BUSINESS];
  const midTierSpotlight = [...tierBands.ELITE, ...tierBands.PRO];
  const standardSpotlight = [...tierBands.STANDARD];

  const q = ctx.searchQuery ? ctx.searchQuery.trim().toLowerCase() : '';
  const isExactSearchMatch = (ad: Ad) => q !== '' && (ad.title || '').trim().toLowerCase() === q;
  const isPartialSearchMatch = (ad: Ad) =>
    q !== '' &&
    ((ad.title || '').toLowerCase().includes(q) || (ad.description || '').toLowerCase().includes(q));

  if (q) {
    // Phase 4.6 : Si une recherche est active, la pertinence prime sur le boost faible.
    // Une correspondance exacte non boostée passe devant une annonce boostée non pertinente.
    // 1. Annonces avec correspondance exacte (boostées ou non)
    const exactMatches = ads.filter(isExactSearchMatch);
    for (const ad of exactMatches) {
      if (headBlock.length >= maxHeadSize) break;
      tryAddToHead(ad);
    }

    // 2. Annonces boostées pertinentes
    for (const ad of level1Boosted) {
      if (headBlock.length >= maxHeadSize) break;
      if (!headAdIds.has(ad.id) && isPartialSearchMatch(ad)) {
        tryAddToHead(ad);
      }
    }

    // 3. Annonces spotlight pertinentes
    for (const ad of [...highTierSpotlight, ...midTierSpotlight, ...standardSpotlight]) {
      if (headBlock.length >= maxHeadSize) break;
      if (!headAdIds.has(ad.id) && isPartialSearchMatch(ad)) {
        tryAddToHead(ad);
      }
    }

    // 4. Boosts non pertinents
    for (const ad of level1Boosted) {
      if (headBlock.length >= maxHeadSize) break;
      if (!headAdIds.has(ad.id)) {
        tryAddToHead(ad);
      }
    }
  } else {
    // 1. Boosts payants prioritaires dans le bloc de tête
    for (const ad of level1Boosted) {
      if (headBlock.length >= maxHeadSize) break;
      tryAddToHead(ad);
    }
  }

  // 2. Entrelacement équitable des paliers en spotlight
  // Garantit qu'un Standard ou Pro en spotlight ait une chance d'apparaître en tête
  let hIdx = 0;
  let mIdx = 0;
  let sIdx = 0;

  while (
    headBlock.length < maxHeadSize &&
    (hIdx < highTierSpotlight.length ||
      mIdx < midTierSpotlight.length ||
      sIdx < standardSpotlight.length)
  ) {
    if (hIdx < highTierSpotlight.length) {
      tryAddToHead(highTierSpotlight[hIdx++]);
    }
    if (headBlock.length < maxHeadSize && mIdx < midTierSpotlight.length) {
      tryAddToHead(midTierSpotlight[mIdx++]);
    }
    if (headBlock.length < maxHeadSize && sIdx < standardSpotlight.length) {
      tryAddToHead(standardSpotlight[sIdx++]);
    }
  }

  // 3. Toutes les annonces restantes tombent dans le flux organique
  const remainingAds = ads.filter((ad) => !headAdIds.has(ad.id));

  // Tri du flux restant par score organique
  remainingAds.sort((a, b) => {
    const sB = scoreMap.get(b.id) || 0;
    const sA = scoreMap.get(a.id) || 0;
    if (sB !== sA) return sB - sA;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });

  return [...headBlock, ...remainingAds];
}

/**
 * Mode "Plus récentes" (rankAdsRecent).
 * Même bloc de tête borné (boost / rotation), puis tri chronologique sur les annonces restantes.
 * Fonction pure.
 */
export function rankAdsRecent(ads: Ad[], ctx: RankingContext): Ad[] {
  if (!ads || ads.length === 0) return [];

  // Construit d'abord le classement complet pour obtenir le bloc de tête borné
  const fullRanked = rankAds(ads, ctx);
  const config = ctx.config || DEFAULT_RANKING_CONFIG;
  const topPageSize = Math.min(20, ads.length);
  const maxHeadSize = Math.min(
    config.headBlockSizeMax,
    Math.max(1, Math.floor(topPageSize * config.headBlockRatio))
  );

  const headBlock = fullRanked.slice(0, maxHeadSize);
  const headIds = new Set(headBlock.map((a) => a.id));

  const remaining = ads.filter((a) => !headIds.has(a.id));
  remaining.sort(
    (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
  );

  return [...headBlock, ...remaining];
}

/**
 * =================================================================================================
 * ADAPTATEURS ET EXPORTS DE COMPATIBILITÉ (App.tsx, AdCard.tsx, UserDashboard.tsx)
 * =================================================================================================
 */

export function getUserPreferences(): {
  categories: Record<string, number>;
  locations: Record<string, number>;
  viewedAdIds: string[];
} {
  try {
    const catStr = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const locStr = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    const histStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return {
      categories: catStr ? JSON.parse(catStr) : {},
      locations: locStr ? JSON.parse(locStr) : {},
      viewedAdIds: histStr ? JSON.parse(histStr) : [],
    };
  } catch (_) {
    return { categories: {}, locations: {}, viewedAdIds: [] };
  }
}

export function getUserSelectedPreferences(): {
  preferredCategories: string[];
  preferredProvinces: string[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        preferredCategories: parsed.preferredCategories || [],
        preferredProvinces: parsed.preferredProvinces || [],
      };
    }
  } catch (_) {}
  return { preferredCategories: [], preferredProvinces: [] };
}

/**
 * Construit un objet UserSignals complet en un seul passage (performance).
 */
export function buildUserSignals(): UserSignals {
  const prefs = getUserPreferences();
  const selected = getUserSelectedPreferences();
  return {
    categoryAffinities: prefs.categories,
    locationAffinities: prefs.locations,
    preferredCategories: selected.preferredCategories,
    preferredProvinces: selected.preferredProvinces,
    viewedAdIds: prefs.viewedAdIds,
  };
}

/**
 * Enregistrement avec plafond quotidien par annonce (Phase 5.5).
 */
export function recordAdInteraction(ad: Ad): void {
  try {
    if (!ad?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const interactionKey = `${ad.id}_${today}`;

    // Plafond d'une interaction par annonce et par jour pour limiter la dérive
    let todayInteractions: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INTERACTIONS_TODAY);
      if (raw) todayInteractions = JSON.parse(raw);
    } catch (_) {}

    if (todayInteractions[interactionKey]) {
      return;
    }
    todayInteractions[interactionKey] = true;
    try {
      localStorage.setItem(STORAGE_KEYS.INTERACTIONS_TODAY, JSON.stringify(todayInteractions));
    } catch (_) {}

    const prefs = getUserPreferences();
    if (ad.mainCategory) {
      prefs.categories[ad.mainCategory] = (prefs.categories[ad.mainCategory] || 0) + 1;
    }
    if (ad.location?.province) {
      prefs.locations[ad.location.province] = (prefs.locations[ad.location.province] || 0) + 1;
    }
    if (ad.location?.city) {
      prefs.locations[ad.location.city] = (prefs.locations[ad.location.city] || 0) + 1;
    }
    if (!prefs.viewedAdIds.includes(ad.id)) {
      prefs.viewedAdIds = [ad.id, ...prefs.viewedAdIds].slice(0, 50);
    }

    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(prefs.categories));
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(prefs.locations));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(prefs.viewedAdIds));
  } catch (e) {
    console.warn('Could not record user interaction:', e);
  }
}

export function recordCategoryInterest(category: MainCategory | string): void {
  try {
    if (!category || category === 'ALL') return;
    const prefs = getUserPreferences();
    prefs.categories[category] = (prefs.categories[category] || 0) + 2;
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(prefs.categories));
  } catch (e) {
    console.warn('Could not record category interest:', e);
  }
}

/**
 * Calcul des catégories favorites sur l'ensemble du catalogue.
 */
export function getUserFavoriteCategories(
  allAds?: Ad[],
  activeFavoriteIds?: string[]
): Set<string> {
  const catSet = new Set<string>();
  if (!allAds) return catSet;

  let favIds = activeFavoriteIds;
  if (!favIds) {
    try {
      const favRaw = localStorage.getItem('bizbooster_guest_favorites');
      if (favRaw) favIds = JSON.parse(favRaw);
    } catch (_) {}
  }

  if (favIds && favIds.length > 0) {
    const idSet = new Set(favIds);
    for (const ad of allAds) {
      if (idSet.has(ad.id) && ad.mainCategory) {
        catSet.add(ad.mainCategory);
      }
    }
  }
  return catSet;
}

/**
 * Adaptateur de compatibilité : sortAdsPersonalized
 */
export function sortAdsPersonalized(
  ads: Ad[],
  activeFavoriteIds?: string[],
  now: number = Date.now(),
  searchQuery?: string
): Ad[] {
  const signals = buildUserSignals();
  const ctx: RankingContext = {
    now,
    signals,
    favoriteIds: activeFavoriteIds || [],
    searchQuery,
    config: DEFAULT_RANKING_CONFIG,
  };
  return rankAds(ads, ctx);
}

/**
 * Adaptateur de compatibilité : sortAdsRecent
 */
export function sortAdsRecent(
  ads: Ad[],
  now: number = Date.now(),
  activeFavoriteIds?: string[],
  searchQuery?: string
): Ad[] {
  const signals = buildUserSignals();
  const ctx: RankingContext = {
    now,
    signals,
    favoriteIds: activeFavoriteIds || [],
    searchQuery,
    config: DEFAULT_RANKING_CONFIG,
  };
  return rankAdsRecent(ads, ctx);
}

/**
 * Tri par prix équitable (Phase 4.9) :
 * Les annonces à 0 FCFA sont placées en fin de tri croissant.
 * Normalise les durées de loyer (mois, jour, trimestre, an) pour une comparaison équitable.
 */
export function sortAdsByPriceAsc(ads: Ad[]): Ad[] {
  const normalizePriceToMonthly = (ad: Ad): number => {
    const p = Number(ad.price || 0);
    if (p <= 0) return 0;
    const unit = ad.priceUnit as string | undefined;
    if (unit === 'jour') return p * 30;
    if (unit === 'semaine') return p * 4;
    if (unit === 'trimestre') return Math.round(p / 3);
    if (unit === 'an') return Math.round(p / 12);
    return p;
  };

  const nonZero: Ad[] = [];
  const zeroPrice: Ad[] = [];

  for (const ad of ads) {
    const p = Number(ad.price || 0);
    if (p <= 0 || ad.mainCategory === 'NECROLOGIE' || ad.mainCategory === 'AVIS_DE_RECHERCHE') {
      zeroPrice.push(ad);
    } else {
      nonZero.push(ad);
    }
  }

  nonZero.sort((a, b) => normalizePriceToMonthly(a) - normalizePriceToMonthly(b));
  return [...nonZero, ...zeroPrice];
}
