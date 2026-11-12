import { describe, it, expect } from 'vitest';
import { mergeAdViewCounts, resolveAdViewsCount } from '../src/utils/viewCounters';
import type { Ad } from '../src/types';

function makeAd(id: string, viewsCount?: number): Ad {
  return {
    id,
    title: `Annonce ${id}`,
    mainCategory: 'IMMOBILIER',
    price: 100000,
    description: 'Description exemple',
    contactPhone: 'Non renseigné',
    contactName: 'Annonceur Exemple',
    durationDays: 14,
    status: 'ACTIVE',
    userId: 'sample-user-1',
    ...(viewsCount !== undefined ? { viewsCount } : {}),
  };
}

describe('F6 : Fusion des compteurs réels ad_counters pour propriétaire et admin', () => {
  it('privilégie le compteur live ad_counters lorsqu’il dépasse ads.viewsCount', () => {
    const ad = makeAd('ad-1', 2);
    expect(resolveAdViewsCount(ad, { 'ad-1': 19 }, {})).toBe(19);
  });

  it('fusionne ad_counters et localOverrides sans rétrograder une valeur plus élevée', () => {
    const ads = [
      makeAd('ad-1', 0),
      makeAd('ad-2', 12),
      makeAd('ad-3'),
    ];
    const merged = mergeAdViewCounts(
      ads,
      { 'ad-1': 27, 'ad-2': 5, 'ad-3': 8 },
      { 'ad-1': 15 }
    );

    expect(merged[0].viewsCount).toBe(27);
    expect(merged[1].viewsCount).toBe(12);
    expect(merged[1]).toBe(ads[1]);
    expect(merged[2].viewsCount).toBe(8);
  });
});

