import { Ad, MainCategory, SubscriptionTier, getTierPriority } from '../types';

const STORAGE_KEYS = {
  CATEGORIES: 'bizbooster_user_cat_affinities',
  LOCATIONS: 'bizbooster_user_loc_affinities',
  HISTORY: 'bizbooster_user_view_history',
};

interface UserPreferences {
  categories: Record<string, number>;
  locations: Record<string, number>;
  viewedAdIds: string[];
}

export function getUserPreferences(): UserPreferences {
  try {
    const catStr = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const locStr = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    const histStr = localStorage.getItem(STORAGE_KEYS.HISTORY);

    return {
      categories: catStr ? JSON.parse(catStr) : {},
      locations: locStr ? JSON.parse(locStr) : {},
      viewedAdIds: histStr ? JSON.parse(histStr) : [],
    };
  } catch (e) {
    console.warn('Could not read user preferences from localStorage:', e);
    return { categories: {}, locations: {}, viewedAdIds: [] };
  }
}

export function recordAdInteraction(ad: Ad): void {
  try {
    const prefs = getUserPreferences();

    // Increment category affinity
    if (ad.mainCategory) {
      prefs.categories[ad.mainCategory] = (prefs.categories[ad.mainCategory] || 0) + 1;
    }

    // Increment location affinity
    if (ad.location?.province) {
      prefs.locations[ad.location.province] = (prefs.locations[ad.location.province] || 0) + 1;
    }
    if (ad.location?.city) {
      prefs.locations[ad.location.city] = (prefs.locations[ad.location.city] || 0) + 1;
    }

    // Record view in history (keep last 50)
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

export function isAdBoostFeatured(ad: Ad): boolean {
  if (!ad.isFeatured) return false;
  if (!ad.featuredUntil) return true;
  return new Date(ad.featuredUntil).getTime() > Date.now();
}

export function getUserSelectedPreferences(): { preferredCategories: string[]; preferredProvinces: string[] } {
  try {
    const raw = localStorage.getItem('bizbooster_user_preferences');
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

export function getUserFavoriteCategories(allAds?: Ad[], activeFavoriteIds?: string[]): Set<string> {
  const catSet = new Set<string>();
  if (!allAds) return catSet;

  let favIds = activeFavoriteIds;
  if (!favIds) {
    try {
      const favRaw = localStorage.getItem('bizbooster_guest_favorites');
      if (favRaw) {
        favIds = JSON.parse(favRaw);
      }
    } catch (_) {}
  }

  if (favIds && favIds.length > 0) {
    for (const id of favIds) {
      const found = allAds.find((a) => a.id === id);
      if (found?.mainCategory) catSet.add(found.mainCategory);
    }
  }
  return catSet;
}

// -------------------------------------------------------------------------------------------------
// Algorithme Équitable de Rotation en Tête d'Affiche selon l'Abonnement (Point 3)
// -------------------------------------------------------------------------------------------------
// Fenêtre temporelle maîtresse : 2 heures (120 minutes) découpée en 10 créneaux réguliers de 12 minutes.
// Fréquences exactes garanties par tranche de 2 heures :
// - STANDARD : 1 fois toutes les 2 heures (1 créneau sur 10, soit 12 min / 2h, 10% duty cycle)
// - PRO      : 2 fois toutes les 2 heures (2 créneaux sur 10 espacés d'une heure, 24 min / 2h, 20% duty cycle)
// - ÉLITE    : 6 fois toutes les 2 heures (6 créneaux sur 10, 72 min / 2h, 60% duty cycle)
// - BUSINESS : 10 fois toutes les 2 heures (10 créneaux sur 10, en continu, 100% duty cycle)
// - VIP      : 10 fois toutes les 2 heures (10 créneaux sur 10, en continu, 100% duty cycle)
// -------------------------------------------------------------------------------------------------

export type EffectiveAdTier = 'VIP' | SubscriptionTier;

export interface TierRotationDetails {
  tier: EffectiveAdTier;
  frequencyPer2Hours: number;
  dutyCyclePercent: number;
  totalSlots: number;
  currentSlot: number;
  slotDurationMinutes: number;
  isSpotlightActive: boolean;
  activeSlots: number[];
}

export function getAdEffectiveTier(ad: Ad): EffectiveAdTier {
  if (ad.isOwnerVip) return 'VIP';
  if (ad.ownerTier === 'BUSINESS') return 'BUSINESS';
  if (ad.ownerTier === 'ELITE') return 'ELITE';
  if (ad.ownerTier === 'PRO') return 'PRO';
  return 'STANDARD';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

/**
 * Calcule l'état de rotation en tête d'affiche d'une annonce pour le moment `now`.
 * La répartition est déterministe et équitable : chaque annonce a un décalage unique
 * pour que les annonces d'un même palier se succèdent harmonieusement sans encombrement simultané.
 */
export function getTierRotationDetails(ad: Ad, now: number = Date.now()): TierRotationDetails {
  const tier = getAdEffectiveTier(ad);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 120 minutes = 7 200 000 ms
  const SLOT_DURATION_MS = 12 * 60 * 1000;  // 12 minutes = 720 000 ms
  const TOTAL_SLOTS = 10;

  const epoch = Math.floor(now / TWO_HOURS_MS);
  const currentSlot = Math.floor((now % TWO_HOURS_MS) / SLOT_DURATION_MS);

  // Décalage individuel pseudo-aléatoire mais déterministe par annonce.
  // Le multiplicateur 3 (premier avec 10) fait évoluer équitablement le créneau au fil des cycles de 2 heures.
  const adHash = hashString(ad.id || 'ad');
  const baseOffset = Math.abs(adHash + epoch * 3) % TOTAL_SLOTS;

  let activeSlots: number[] = [];
  let frequencyPer2Hours = 1;

  switch (tier) {
    case 'VIP':
    case 'BUSINESS':
      // 10 fois toutes les 2 heures (présence permanente en tête d'affiche)
      frequencyPer2Hours = 10;
      activeSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      break;

    case 'ELITE':
      // 6 fois toutes les 2 heures (6 créneaux de 12 min harmonieusement répartis sur les 2h)
      frequencyPer2Hours = 6;
      activeSlots = [0, 1, 3, 5, 6, 8].map((s) => (baseOffset + s) % TOTAL_SLOTS);
      break;

    case 'PRO':
      // 2 fois toutes les 2 heures (2 créneaux de 12 min espacés d'une heure / 5 créneaux)
      frequencyPer2Hours = 2;
      activeSlots = [0, 5].map((s) => (baseOffset + s) % TOTAL_SLOTS);
      break;

    case 'STANDARD':
    default:
      // 1 fois toutes les 2 heures (1 créneau unique de 12 min par bloc de 2 heures)
      frequencyPer2Hours = 1;
      activeSlots = [baseOffset % TOTAL_SLOTS];
      break;
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

/**
 * Indique si l'annonce est actuellement en tête d'affiche
 * (soit via Boost payant actif, soit via son créneau de rotation équitable selon son abonnement).
 */
export function isAdSpotlightActive(ad: Ad, now: number = Date.now()): boolean {
  if (isAdBoostFeatured(ad)) return true;
  return getTierRotationDetails(ad, now).isSpotlightActive;
}

/**
 * Bonus de score alloué lorsqu'une annonce est dans sa phase active de passage en tête d'affiche.
 */
export function computeTierRotationBonus(ad: Ad, now: number = Date.now()): number {
  const details = getTierRotationDetails(ad, now);
  if (!details.isSpotlightActive) return 0;

  const tierWeights: Record<EffectiveAdTier, number> = {
    VIP: 500_000,
    BUSINESS: 400_000,
    ELITE: 300_000,
    PRO: 200_000,
    STANDARD: 100_000,
  };

  // Base spotlight de 2 000 000 points + pondération selon le niveau d'abonnement
  return 2_000_000 + (tierWeights[details.tier] || 100_000);
}

/**
 * Alias de compatibilité pour les appels existants.
 */
export function computeStandardRotationBonus(adId: string, now: number = Date.now()): number {
  const dummyAd = { id: adId, ownerTier: 'STANDARD' } as Ad;
  return computeTierRotationBonus(dummyAd, now);
}

/**
 * Calcule le score global de pertinence et de classement d'une annonce :
 * 1. Annonces avec Boost payant actif ("Option En Tête de Liste") : 10M - 15M pts.
 * 2. Annonces en phase active de rotation selon leur abonnement : 2.1M - 2.5M pts
 *    (Standard 1x/2h, Pro 2x/2h, Elite 6x/2h, Business/VIP 10x/2h).
 * 3. Fraîcheur temporelle de publication (jusqu'à 50k pts).
 * 4. Affinités de navigation de l'utilisateur (catégories & villes jusqu'à 65k pts).
 * 5. Préférences explicites enregistrées (jusqu'à 90k pts).
 * 6. Catégories favorites de l'utilisateur (+50k pts).
 */
export function computeAdScore(
  ad: Ad,
  prefs: UserPreferences,
  favoriteCats?: Set<string>,
  now: number = Date.now()
): number {
  let score = 0;

  // 1. Boost Payant ("En Tête de Liste") prioritaire
  if (isAdBoostFeatured(ad)) {
    const tierPrio = getTierPriority(ad); // 5 (VIP) > 4 (Business) > 3 (Elite) > 2 (Pro) > 1 (Standard)
    score += 10_000_000 + tierPrio * 1_000_000;

    const boostTime = new Date(ad.featuredAt || ad.publishedAt || 0).getTime();
    const hoursSinceBoost = Math.max(0, (now - boostTime) / (1000 * 60 * 60));
    const boostRecencyScore = Math.max(0, 100_000 - hoursSinceBoost * 200);
    score += boostRecencyScore;
  } else {
    // 2. Passage en tête d'affiche selon le rythme de l'abonnement
    score += computeTierRotationBonus(ad, now);
  }

  // 3. Fraîcheur de publication
  const pubTime = new Date(ad.publishedAt || 0).getTime();
  const hoursOld = Math.max(0, (now - pubTime) / (1000 * 60 * 60));
  const recencyBoost = Math.max(0, 50_000 - hoursOld * 150);
  score += recencyBoost;

  // 4. Affinité catégories
  const catViews = prefs.categories[ad.mainCategory] || 0;
  score += Math.min(catViews * 8_000, 40_000);

  // 5. Affinité localisation
  if (ad.location?.province) {
    const provViews = prefs.locations[ad.location.province] || 0;
    score += Math.min(provViews * 4_000, 20_000);
  }
  if (ad.location?.city) {
    const cityViews = prefs.locations[ad.location.city] || 0;
    score += Math.min(cityViews * 5_000, 25_000);
  }

  // 6. Préférences explicites sélectionnées
  const explicitPrefs = getUserSelectedPreferences();
  if (explicitPrefs.preferredCategories.includes(ad.mainCategory)) {
    score += 60_000;
  }
  if (ad.location?.province && explicitPrefs.preferredProvinces.includes(ad.location.province)) {
    score += 30_000;
  }

  // 7. Prise en compte immédiate des favoris
  if (favoriteCats && favoriteCats.has(ad.mainCategory)) {
    score += 50_000;
  }

  return score;
}

/**
 * Trie et harmonise le catalogue de façon personnalisée :
 * - Les annonces avec Boost payant et les annonces dans leur créneau de rotation
 *   (Standard 1x/2h, Pro 2x/2h, Elite 6x/2h, Business/VIP 10x/2h)
 *   sont montées en tête et entrelacées avec un ratio équilibré 2:1.
 * - Aucune annonce n'est reléguée ou oubliée.
 * - Le flux restant est ordonné par pertinence utilisateur et fraîcheur.
 */
export function sortAdsPersonalized(ads: Ad[], activeFavoriteIds?: string[], now: number = Date.now()): Ad[] {
  const prefs = getUserPreferences();
  const favoriteCats = getUserFavoriteCategories(ads, activeFavoriteIds);

  const paidBoostedAds: Ad[] = [];
  const spotlightRotatingAds: Ad[] = [];
  const generalFeedAds: Ad[] = [];

  for (const ad of ads) {
    if (isAdBoostFeatured(ad)) {
      paidBoostedAds.push(ad);
    } else if (getTierRotationDetails(ad, now).isSpotlightActive) {
      spotlightRotatingAds.push(ad);
    } else {
      generalFeedAds.push(ad);
    }
  }

  const sortByScore = (a: Ad, b: Ad) => {
    const scoreA = computeAdScore(a, prefs, favoriteCats, now);
    const scoreB = computeAdScore(b, prefs, favoriteCats, now);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  };

  paidBoostedAds.sort(sortByScore);
  spotlightRotatingAds.sort(sortByScore);
  generalFeedAds.sort(sortByScore);

  // Entrelacement régulier (2 annonces boostées payantes pour 1 annonce en tête d'affiche rotative)
  const blended: Ad[] = [];
  let bIdx = 0;
  let sIdx = 0;

  while (bIdx < paidBoostedAds.length || sIdx < spotlightRotatingAds.length) {
    for (let i = 0; i < 2 && bIdx < paidBoostedAds.length; i++) {
      blended.push(paidBoostedAds[bIdx++]);
    }
    if (sIdx < spotlightRotatingAds.length) {
      blended.push(spotlightRotatingAds[sIdx++]);
    }
  }

  // Suite du catalogue organique, classé selon l'intérêt de l'utilisateur
  return blended.concat(generalFeedAds);
}

/**
 * Tri chronologique avec mise en valeur équitable des annonces en tête d'affiche.
 */
export function sortAdsRecent(ads: Ad[], now: number = Date.now()): Ad[] {
  const paidBoostedAds: Ad[] = [];
  const spotlightRotatingAds: Ad[] = [];
  const generalFeedAds: Ad[] = [];

  for (const ad of ads) {
    if (isAdBoostFeatured(ad)) {
      paidBoostedAds.push(ad);
    } else if (getTierRotationDetails(ad, now).isSpotlightActive) {
      spotlightRotatingAds.push(ad);
    } else {
      generalFeedAds.push(ad);
    }
  }

  const sortByTierThenDate = (a: Ad, b: Ad) => {
    const prioA = getTierPriority(a);
    const prioB = getTierPriority(b);
    if (prioB !== prioA) return prioB - prioA;
    const timeA = new Date(a.featuredAt || a.publishedAt || 0).getTime();
    const timeB = new Date(b.featuredAt || b.publishedAt || 0).getTime();
    return timeB - timeA;
  };

  paidBoostedAds.sort(sortByTierThenDate);
  spotlightRotatingAds.sort(sortByTierThenDate);
  generalFeedAds.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

  const topPool = [...paidBoostedAds, ...spotlightRotatingAds];
  const blended: Ad[] = [];
  let tIdx = 0;
  let gIdx = 0;

  while (tIdx < topPool.length || gIdx < generalFeedAds.length) {
    for (let i = 0; i < 2 && tIdx < topPool.length; i++) {
      blended.push(topPool[tIdx++]);
    }
    if (gIdx < generalFeedAds.length) {
      blended.push(generalFeedAds[gIdx++]);
    }
  }

  return blended;
}

