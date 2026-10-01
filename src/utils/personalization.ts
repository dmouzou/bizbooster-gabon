import { Ad, MainCategory, getTierPriority } from '../types';

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

/**
 * Computes a personalization & relevance score for an ad:
 * 1. Boosted/Featured ads are strictly ranked by tier level:
 *    - VIP Partner: 15,000,000 pts
 *    - Business:    14,000,000 pts
 *    - Élite:       13,000,000 pts
 *    - Pro:         12,000,000 pts
 *    - Standard:    11,000,000 pts
 * 2. Within the same tier, boost recency & fresh publication add up to 100,000 pts.
 * 3. User category & location affinities add up to 65,000 pts.
 * 4. Regular non-boosted ads score below 1,000,000 pts.
 */
export function computeAdScore(ad: Ad, prefs: UserPreferences): number {
  let score = 0;
  const now = Date.now();

  // 1. Pinned / Top-of-feed Boost (Option "En Tête de Liste") with Strict Tier Hierarchy
  if (isAdBoostFeatured(ad)) {
    const tierPrio = getTierPriority(ad); // 5 (VIP) > 4 (Business) > 3 (Elite) > 2 (Pro) > 1 (Standard)
    score += 10_000_000 + tierPrio * 1_000_000;

    // Boost recency: the more recent the boost/publication, the higher in its tier bracket
    const boostTime = new Date(ad.featuredAt || ad.publishedAt || 0).getTime();
    const hoursSinceBoost = Math.max(0, (now - boostTime) / (1000 * 60 * 60));
    const boostRecencyScore = Math.max(0, 100_000 - hoursSinceBoost * 200);
    score += boostRecencyScore;
  }

  // 2. Publication Freshness & Recency
  const pubTime = new Date(ad.publishedAt || 0).getTime();
  const hoursOld = Math.max(0, (now - pubTime) / (1000 * 60 * 60));
  const recencyBoost = Math.max(0, 50_000 - hoursOld * 150);
  score += recencyBoost;

  // 3. User Category Affinity
  const catViews = prefs.categories[ad.mainCategory] || 0;
  score += Math.min(catViews * 8_000, 40_000);

  // 4. User Location Affinity
  if (ad.location?.province) {
    const provViews = prefs.locations[ad.location.province] || 0;
    score += Math.min(provViews * 4_000, 20_000);
  }
  if (ad.location?.city) {
    const cityViews = prefs.locations[ad.location.city] || 0;
    score += Math.min(cityViews * 5_000, 25_000);
  }

  return score;
}

/**
 * Sorts ads personalized according to the user's past actions and preferences,
 * while strictly honoring the "En Tête" tier hierarchy (VIP > Business > Elite > Pro > Standard).
 */
export function sortAdsPersonalized(ads: Ad[]): Ad[] {
  const prefs = getUserPreferences();
  return [...ads].sort((a, b) => {
    const scoreA = computeAdScore(a, prefs);
    const scoreB = computeAdScore(b, prefs);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // Tie-breaker: newest first
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
}

/**
 * Pure chronological sort: featured first strictly prioritized by tier:
 * VIP Partners > Business > Élite > Pro > Standard,
 * then newest publishedAt descending.
 */
export function sortAdsRecent(ads: Ad[]): Ad[] {
  return [...ads].sort((a, b) => {
    const isFeatA = isAdBoostFeatured(a);
    const isFeatB = isAdBoostFeatured(b);

    if (isFeatA && isFeatB) {
      const prioA = getTierPriority(a);
      const prioB = getTierPriority(b);
      if (prioB !== prioA) {
        return prioB - prioA; // Higher tier priority first
      }
      // Within same tier: newest boost or publication first
      const timeA = new Date(a.featuredAt || a.publishedAt || 0).getTime();
      const timeB = new Date(b.featuredAt || b.publishedAt || 0).getTime();
      return timeB - timeA;
    }

    if (isFeatB !== isFeatA) {
      return isFeatB ? 1 : -1;
    }

    // Both unfeatured: newest first
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
}
