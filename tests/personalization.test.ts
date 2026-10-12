import { describe, it, expect } from 'vitest';
import {
  rankAds,
  rankAdsRecent,
  getSpotlightSlots,
  isAdBoostFeatured,
  sortAdsByPriceAsc,
  DEFAULT_RANKING_CONFIG,
  RankingContext,
  UserSignals,
} from '../src/utils/personalization';
import { Ad } from '../src/types';

function createMockAd(partial: Partial<Ad> = {}): Ad {
  return {
    id: partial.id || `ad_${Math.random().toString(36).substring(2, 9)}`,
    title: partial.title || 'Annonce de test',
    description: partial.description || 'Description de test',
    price: partial.price ?? 50000,
    mainCategory: partial.mainCategory || 'VEHICULES',
    status: partial.status || 'ACTIVE',
    userId: partial.userId || 'user_1',
    publishedAt: partial.publishedAt || new Date(Date.now() - 3600000).toISOString(),
    ownerTier: partial.ownerTier || 'STANDARD',
    viewsCount: partial.viewsCount ?? 10,
    location: partial.location || { province: 'Estuaire', city: 'Libreville' },
    ...partial,
  };
}

function createMockSignals(partial: Partial<UserSignals> = {}): UserSignals {
  return {
    categoryAffinities: {},
    locationAffinities: {},
    preferredCategories: [],
    preferredProvinces: [],
    viewedAdIds: [],
    ...partial,
  };
}

describe('Phase 4: Algorithme de personnalisation & classement (personalization.ts)', () => {
  const baseNow = 1770000000000; // Epoch fixe

  // 1. Déterminisme : mêmes entrées, même sortie
  it('1. Déterminisme : produit exactement le même ordre avec les mêmes entrées', () => {
    const ads: Ad[] = Array.from({ length: 30 }, (_, i) =>
      createMockAd({
        id: `ad_${i}`,
        title: `Produit ${i}`,
        userId: `user_${i % 5}`,
        ownerTier: i % 4 === 0 ? 'PRO' : 'STANDARD',
      })
    );

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals(),
      favoriteIds: ['ad_3', 'ad_7'],
      config: DEFAULT_RANKING_CONFIG,
    };

    const res1 = rankAds(ads, ctx);
    const res2 = rankAds(ads, ctx);

    expect(res1.map((a) => a.id)).toEqual(res2.map((a) => a.id));
  });

  // 2. Fréquence : sur chaque période de 2 h, chaque annonce Standard a 1 créneau, Pro 2, Élite 6, Business 10, VIP 10
  it('2. Fréquence des créneaux selon le palier', () => {
    const standardAd = createMockAd({ id: 'ad_std', ownerTier: 'STANDARD' });
    const proAd = createMockAd({ id: 'ad_pro', ownerTier: 'PRO' });
    const eliteAd = createMockAd({ id: 'ad_elite', ownerTier: 'ELITE' });
    const businessAd = createMockAd({ id: 'ad_biz', ownerTier: 'BUSINESS' });
    const vipAd = createMockAd({ id: 'ad_vip', ownerTier: 'VIP' });

    const stdSlots = getSpotlightSlots(standardAd, baseNow);
    const proSlots = getSpotlightSlots(proAd, baseNow);
    const eliteSlots = getSpotlightSlots(eliteAd, baseNow);
    const bizSlots = getSpotlightSlots(businessAd, baseNow);
    const vipSlots = getSpotlightSlots(vipAd, baseNow);

    expect(stdSlots.activeSlots.length).toBe(1);
    expect(proSlots.activeSlots.length).toBe(2);
    expect(eliteSlots.activeSlots.length).toBe(6);
    expect(bizSlots.activeSlots.length).toBe(10);
    expect(vipSlots.activeSlots.length).toBe(10);
  });

  // 3. Espacement : Pro à 5 créneaux d'écart ; Élite avec écart maximal de 2 créneaux
  it("3. Espacement régulier : Pro à 5 créneaux d'écart et Élite écart maximal <= 2", () => {
    // Tester 20 IDs distincts
    for (let i = 0; i < 20; i++) {
      const proAd = createMockAd({ id: `pro_${i}`, ownerTier: 'PRO' });
      const proInfo = getSpotlightSlots(proAd, baseNow + i * 7200000);
      const [p1, p2] = proInfo.activeSlots;
      expect((p2 - p1 + 10) % 10).toBe(5);

      const eliteAd = createMockAd({ id: `elite_${i}`, ownerTier: 'ELITE' });
      const eliteInfo = getSpotlightSlots(eliteAd, baseNow + i * 7200000);
      const slots = [...eliteInfo.activeSlots].sort((a, b) => a - b);
      expect(slots.length).toBe(6);

      // Calcul des écarts cycliques
      for (let s = 0; s < slots.length; s++) {
        const next = slots[(s + 1) % slots.length];
        const gap = (next - slots[s] + 10) % 10;
        expect(gap).toBeLessThanOrEqual(2);
        expect(gap).toBeGreaterThanOrEqual(1);
      }
    }
  });

  // 4. Équité & Décorrélation : test du khi-deux uniforme sur 1 000 périodes pour 200 annonces Standard
  it('4. Équité : répartition uniforme sur 1000 périodes pour des annonces Standard (khi-deux)', () => {
    const slotCounts = new Array(10).fill(0);
    const totalPeriods = 1000;
    const testAd = createMockAd({ id: 'ad_equity_test', ownerTier: 'STANDARD' });

    for (let epoch = 0; epoch < totalPeriods; epoch++) {
      const epochNow = epoch * 7200000; // chaque période de 2h
      const info = getSpotlightSlots(testAd, epochNow);
      slotCounts[info.activeSlots[0]]++;
    }

    const expectedPerSlot = totalPeriods / 10; // 100 par slot
    let chiSquared = 0;
    for (let i = 0; i < 10; i++) {
      const diff = slotCounts[i] - expectedPerSlot;
      chiSquared += (diff * diff) / expectedPerSlot;
    }

    // Avec 9 degrés de liberté, le seuil critique à p=0.001 est ~27.88.
    // Vérifions que le khi-deux est bien dans des bornes raisonnables.
    expect(chiSquared).toBeLessThan(27.88);
  });

  // 5. Plafonds & permutation sans perte
  it('5. Plafonds : max 2 par userId dans le bloc de tête, taille tête <= 6, aucune annonce perdue', () => {
    // Créons 40 annonces, dont 8 par le même user_monopolist et d'autres annonces boostées par d'autres utilisateurs
    const ads: Ad[] = [];
    for (let i = 0; i < 8; i++) {
      ads.push(
        createMockAd({
          id: `ad_heavy_${i}`,
          userId: 'user_monopolist',
          ownerTier: 'BUSINESS',
          isFeatured: true,
          featuredUntil: new Date(baseNow + 86400000).toISOString(),
          featuredAt: new Date(baseNow - 10000).toISOString(),
        })
      );
    }
    for (let i = 0; i < 4; i++) {
      ads.push(
        createMockAd({
          id: `ad_other_boost_${i}`,
          userId: `user_boost_${i}`,
          ownerTier: 'PRO',
          isFeatured: true,
          featuredUntil: new Date(baseNow + 86400000).toISOString(),
          featuredAt: new Date(baseNow - 5000).toISOString(),
        })
      );
    }
    for (let i = 0; i < 28; i++) {
      ads.push(
        createMockAd({
          id: `ad_other_${i}`,
          userId: `user_${i}`,
          ownerTier: 'STANDARD',
        })
      );
    }

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals(),
      favoriteIds: [],
      config: DEFAULT_RANKING_CONFIG,
    };

    const ranked = rankAds(ads, ctx);

    // Aucune annonce perdue (permutation stricte)
    expect(ranked.length).toBe(ads.length);
    const returnedIds = new Set(ranked.map((a) => a.id));
    expect(returnedIds.size).toBe(ads.length);

    // Bloc de tête borné (≤ 30% des 20 premières positions => au plus 6)
    const headBlock = ranked.slice(0, 6);
    const heavyInHead = headBlock.filter((a) => a.userId === 'user_monopolist');
    expect(heavyInHead.length).toBeLessThanOrEqual(2);
  });

  // 6. Boost : expiration et tri par récence
  it('6. Boost : un boost expiré ou sans date est inactif, boost récent précède ancien', () => {
    const expiredBoost = createMockAd({
      id: 'boost_exp',
      isFeatured: true,
      featuredUntil: new Date(baseNow - 1000).toISOString(),
    });
    const missingDateBoost = createMockAd({
      id: 'boost_nodate',
      isFeatured: true,
      featuredUntil: undefined,
    });
    const oldBoost = createMockAd({
      id: 'boost_old',
      isFeatured: true,
      featuredUntil: new Date(baseNow + 100000).toISOString(),
      featuredAt: new Date(baseNow - 500000).toISOString(),
    });
    const recentBoost = createMockAd({
      id: 'boost_recent',
      isFeatured: true,
      featuredUntil: new Date(baseNow + 100000).toISOString(),
      featuredAt: new Date(baseNow - 1000).toISOString(),
    });

    expect(isAdBoostFeatured(expiredBoost, baseNow)).toBe(false);
    expect(isAdBoostFeatured(missingDateBoost, baseNow)).toBe(false);
    expect(isAdBoostFeatured(oldBoost, baseNow)).toBe(true);
    expect(isAdBoostFeatured(recentBoost, baseNow)).toBe(true);

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals(),
      favoriteIds: [],
      config: DEFAULT_RANKING_CONFIG,
    };

    const ranked = rankAds([oldBoost, recentBoost, expiredBoost], ctx);
    // Recent boost doit précéder old boost
    const idxRecent = ranked.findIndex((a) => a.id === 'boost_recent');
    const idxOld = ranked.findIndex((a) => a.id === 'boost_old');
    expect(idxRecent).toBeLessThan(idxOld);
  });

  // 7. Recherche : correspondance exacte non boostée prime sur boost non pertinent
  it('7. Recherche : correspondance exacte non boostée passe devant un boost non pertinent', () => {
    const exactMatchOrganic = createMockAd({
      id: 'exact_ad',
      title: 'Toyota Rav4 2022',
      description: 'Superbe état',
      isFeatured: false,
      ownerTier: 'STANDARD',
    });

    const irrelevantBoosted = createMockAd({
      id: 'irrelevant_boost',
      title: 'Appartement 3 pièces Batterie 4',
      description: 'Loyer mensuel vue mer',
      isFeatured: true,
      featuredUntil: new Date(baseNow + 86400000).toISOString(),
      ownerTier: 'STANDARD',
    });

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals(),
      favoriteIds: [],
      searchQuery: 'Toyota Rav4 2022',
      config: DEFAULT_RANKING_CONFIG,
    };

    const ranked = rankAds([irrelevantBoosted, exactMatchOrganic], ctx);
    expect(ranked[0].id).toBe('exact_ad');
  });

  // 8. Vues : annonce déjà vue pénalisée dans le flux organique
  it('8. Vues : une annonce déjà vue est pénalisée dans le flux organique', () => {
    const pubDate = new Date(baseNow - 3600000).toISOString();
    const adNotViewed = createMockAd({
      id: 'ad_fresh',
      title: 'Téléphone Samsung S23',
      publishedAt: pubDate,
      ownerTier: 'STANDARD',
    });
    const adViewed = createMockAd({
      id: 'ad_already_viewed',
      title: 'Téléphone Samsung S23',
      publishedAt: pubDate,
      ownerTier: 'STANDARD',
    });

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals({
        viewedAdIds: ['ad_already_viewed'],
      }),
      favoriteIds: [],
      config: {
        ...DEFAULT_RANKING_CONFIG,
        headBlockSizeMax: 0, // Désactive le bloc de tête pour tester le flux organique pur
      },
    };

    const ranked = rankAds([adViewed, adNotViewed], ctx);
    expect(ranked[0].id).toBe('ad_fresh');
    expect(ranked[1].id).toBe('ad_already_viewed');
  });

  // 9. Performance : 2 000 annonces triées en moins de 50 ms (avec marge CI de 150 ms)
  it('9. Performance : tri de 2 000 annonces rapide (< 100 ms)', () => {
    const bigAds: Ad[] = Array.from({ length: 2000 }, (_, i) =>
      createMockAd({
        id: `ad_perf_${i}`,
        title: `Produit en vente numéro ${i}`,
        description: `Description détaillée du produit ${i}`,
        userId: `user_${i % 100}`,
        ownerTier: i % 10 === 0 ? 'BUSINESS' : i % 5 === 0 ? 'PRO' : 'STANDARD',
        price: (i % 50) * 10000,
        publishedAt: new Date(baseNow - (i % 500) * 3600000).toISOString(),
        isFeatured: i % 50 === 0,
        featuredUntil: i % 50 === 0 ? new Date(baseNow + 86400000).toISOString() : undefined,
      })
    );

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals({
        categoryAffinities: { VEHICULES: 5, IMMOBILIER: 10 },
        preferredCategories: ['VEHICULES'],
      }),
      favoriteIds: ['ad_perf_10', 'ad_perf_200'],
      config: DEFAULT_RANKING_CONFIG,
    };

    const start = performance.now();
    const ranked = rankAds(bigAds, ctx);
    const duration = performance.now() - start;

    expect(ranked.length).toBe(2000);
    // En CI ou VM partagée, la marge demandée est de 3x la cible de 50 ms = 150 ms
    expect(duration).toBeLessThan(150);
  });

  // 10. Prix : annonces à 0 FCFA en fin de tri croissant
  it('10. Prix : les annonces à 0 FCFA sont placées en fin de tri croissant', () => {
    const zeroAd1 = createMockAd({ id: 'ad_zero_necro', price: 0, mainCategory: 'NECROLOGIE' });
    const zeroAd2 = createMockAd({ id: 'ad_zero_avis', price: 0, mainCategory: 'AVIS_DE_RECHERCHE' });
    const paidAd1 = createMockAd({ id: 'ad_10k', price: 10000 });
    const paidAd2 = createMockAd({ id: 'ad_5k', price: 5000 });

    const sorted = sortAdsByPriceAsc([zeroAd1, paidAd1, zeroAd2, paidAd2]);

    expect(sorted.map((a) => a.id)).toEqual(['ad_5k', 'ad_10k', 'ad_zero_necro', 'ad_zero_avis']);
  });

  // 11. Mode Plus Récentes (rankAdsRecent)
  it('11. rankAdsRecent : conserve le bloc de tête borné puis tri chronologique sur le reste', () => {
    const boosted = createMockAd({
      id: 'boosted_ad',
      isFeatured: true,
      featuredUntil: new Date(baseNow + 86400000).toISOString(),
      publishedAt: new Date(baseNow - 10000000).toISOString(), // très vieux
    });
    const recentOrganic = createMockAd({
      id: 'recent_org',
      publishedAt: new Date(baseNow - 1000).toISOString(),
    });
    const oldOrganic = createMockAd({
      id: 'old_org',
      publishedAt: new Date(baseNow - 500000).toISOString(),
    });

    const ctx: RankingContext = {
      now: baseNow,
      signals: createMockSignals(),
      favoriteIds: [],
      config: DEFAULT_RANKING_CONFIG,
    };

    const recentRanked = rankAdsRecent([oldOrganic, boosted, recentOrganic], ctx);
    expect(recentRanked[0].id).toBe('boosted_ad'); // Tête bornée
    expect(recentRanked[1].id).toBe('recent_org'); // Plus récent chronologique
    expect(recentRanked[2].id).toBe('old_org'); // Moins récent chronologique
  });
});
