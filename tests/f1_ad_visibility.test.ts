import { describe, it, expect } from 'vitest';
import { isExplicitTestAd } from '../functions/src/testAds';
import { isTestAd, isPublicCatalogAd } from '../src/utils/ads';
import { Ad } from '../src/types';

describe('F1 : Visibilité des annonces des utilisateurs réels', () => {
  const futureExpiry = new Date(Date.now() + 7 * 86400000).toISOString();

  it('ne marque pas les annonces de vrais utilisateurs comme isTest dans onAdCreated', () => {
    expect(isExplicitTestAd('ad-k9LmN2pQ7xR4vT8w', 'u8xK2mP9qR4vT7wZ1nB3')).toBe(false);
    expect(isExplicitTestAd('ad_real_9981', 'firebaseUidAbc12345')).toBe(false);
  });

  it('marque uniquement les identifiants/préfixes explicites de test ou démo comme isTest', () => {
    expect(isExplicitTestAd('test_ad_1', 'realUid123')).toBe(true);
    expect(isExplicitTestAd('test-ad-1', 'realUid123')).toBe(true);
    expect(isExplicitTestAd('ad-test-123', 'realUid123')).toBe(true);
    expect(isExplicitTestAd('ad_test_123', 'realUid123')).toBe(true);
    expect(isExplicitTestAd('demo-ad-1', 'realUid123')).toBe(true);
    expect(isExplicitTestAd('realAdId123', 'demo-user-1')).toBe(true);
    expect(isExplicitTestAd('realAdId123', 'user_test_standard')).toBe(true);
    expect(isExplicitTestAd('realAdId123', 'test-uid')).toBe(true);
  });

  it('garde toujours visibles au catalogue public les annonces actives de vrais utilisateurs (même avec showTestAds=false)', () => {
    const realAd: Ad = {
      id: 'k9LmN2pQ7xR4vT8w',
      userId: 'u8xK2mP9qR4vT7wZ1nB3',
      title: 'Appartement à louer à Akanda',
      mainCategory: 'IMMOBILIER',
      price: 300000,
      durationDays: 30,
      status: 'ACTIVE',
      expiresAt: futureExpiry,
      isTest: false,
      contactName: 'Annonceur Réel',
      contactPhone: '+24177112233',
      images: [],
    };

    expect(isTestAd(realAd)).toBe(false);
    expect(isPublicCatalogAd(realAd, false)).toBe(true);
    expect(isPublicCatalogAd(realAd, true)).toBe(true);
  });

  it('masque les annonces de test lorsque showTestAds=false et les affiche lorsque showTestAds=true', () => {
    const flaggedTestAd: Ad = {
      id: 'ad-immo-1',
      userId: 'demo-user',
      title: 'Annonce Démo',
      mainCategory: 'IMMOBILIER',
      price: 150000,
      durationDays: 30,
      status: 'ACTIVE',
      expiresAt: futureExpiry,
      isTest: true,
      contactName: 'Démo',
      contactPhone: '+24177000000',
      images: [],
    };

    expect(isTestAd(flaggedTestAd)).toBe(true);
    expect(isPublicCatalogAd(flaggedTestAd, false)).toBe(false);
    expect(isPublicCatalogAd(flaggedTestAd, true)).toBe(true);
  });
});

