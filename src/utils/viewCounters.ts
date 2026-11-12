import { Ad } from '../types';

/**
 * Resolves the effective view count for an ad by taking the maximum of the
 * ad document's cached `viewsCount`, the live `ad_counters` value, and any
 * optimistic local session override.
 */
export function resolveAdViewsCount(
  ad: Pick<Ad, 'id' | 'viewsCount'>,
  counterViews: Record<string, number> = {},
  localOverrides: Record<string, number> = {}
): number {
  const baseViews = typeof ad.viewsCount === 'number' ? ad.viewsCount : 0;
  const counter = typeof counterViews[ad.id] === 'number' ? counterViews[ad.id] : 0;
  const override = typeof localOverrides[ad.id] === 'number' ? localOverrides[ad.id] : 0;
  return Math.max(baseViews, counter, override);
}

/**
 * Merges live `ad_counters` view counts (and optional local overrides) into an array of ads.
 */
export function mergeAdViewCounts(
  ads: Ad[],
  counterViews: Record<string, number> = {},
  localOverrides: Record<string, number> = {}
): Ad[] {
  return ads.map((ad) => {
    const mergedViews = resolveAdViewsCount(ad, counterViews, localOverrides);
    if (mergedViews !== (ad.viewsCount || 0)) {
      return { ...ad, viewsCount: mergedViews };
    }
    return ad;
  });
}

