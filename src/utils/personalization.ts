import { Ad, MainCategory } from '../types';

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
 * 1. Boosted/Featured ads get the highest base score so they are always at the top.
 * 2. User category and location affinities add dynamic weighting.
 * 3. Freshness / Recency adds a decaying boost (newest ads are naturally favored).
 */
export function computeAdScore(ad: Ad, prefs: UserPreferences): number {
  let score = 0;

  // 1. Pinned / Top-of-feed Boost (Option "En Tête de Liste")
  if (isAdBoostFeatured(ad)) {
    score += 1_000_000;
  }

  // 2. Freshness & Recency
  const pubTime = new Date(ad.publishedAt || 0).getTime();
  const now = Date.now();
  const hoursOld = Math.max(0, (now - pubTime) / (1000 * 60 * 60));
  // Ads published in the last 24h get up to 50,000 points
  const recencyBoost = Math.max(0, 50000 - hoursOld * 150);
  score += recencyBoost;

  // 3. User Category Affinity
  const catViews = prefs.categories[ad.mainCategory] || 0;
  score += Math.min(catViews * 8000, 40000);

  // 4. User Location Affinity
  if (ad.location?.province) {
    const provViews = prefs.locations[ad.location.province] || 0;
    score += Math.min(provViews * 4000, 20000);
  }
  if (ad.location?.city) {
    const cityViews = prefs.locations[ad.location.city] || 0;
    score += Math.min(cityViews * 5000, 25000);
  }

  return score;
}

/**
 * Sorts ads personalized according to the user's past actions and preferences,
 * while keeping newer and boosted ads at the front.
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
 * Pure chronological sort: featured first, then newest publishedAt descending.
 */
export function sortAdsRecent(ads: Ad[]): Ad[] {
  return [...ads].sort((a, b) => {
    const featuredA = isAdBoostFeatured(a) ? 1 : 0;
    const featuredB = isAdBoostFeatured(b) ? 1 : 0;
    if (featuredB !== featuredA) {
      return featuredB - featuredA;
    }
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });
}
