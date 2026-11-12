import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CGU_SECTIONS } from '../src/data/cguData';
import { PRICING_CONFIG } from '../src/data/categoriesData';
import { PRICING_CONFIG as ADMIN_PRICING_CONFIG } from '../admin/src/data/categoriesData';
import { getTierFreePhotosCount } from '../src/utils/formatters';
import { getTierFreePhotosCount as getAdminTierFreePhotosCount } from '../admin/src/utils/formatters';
import {
  SUBSCRIPTION_QUOTAS,
  getTierFreePhotosCount as getServerTierFreePhotosCount,
} from '../functions/src/pricing';
import { UserDashboard } from '../src/components/UserDashboard';
import type { UserProfile } from '../src/types';

const STANDARD_USER: UserProfile = {
  id: 'sample-std-user',
  name: 'Annonceur Standard',
  isVerified: false,
  termsAccepted: true,
  termsAcceptedAt: '2026-01-01T00:00:00.000Z',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
  subscriptionTier: 'STANDARD',
  consumedFreeAdsCount: 0,
};

describe('L1 : Cohérence des textes et quotas Standard / Photos / Abonnements', () => {
  it('aligne PRICING_CONFIG.includedImages et getTierFreePhotosCount sur 3/3/4/5', () => {
    expect(PRICING_CONFIG.includedImages).toBe(3);
    expect(ADMIN_PRICING_CONFIG.includedImages).toBe(3);

    for (const [tier, expected] of [
      ['STANDARD', 3],
      ['PRO', 3],
      ['ELITE', 4],
      ['BUSINESS', 5],
    ] as const) {
      expect(getTierFreePhotosCount(tier)).toBe(expected);
      expect(getAdminTierFreePhotosCount(tier)).toBe(expected);
      expect(getServerTierFreePhotosCount(tier)).toBe(expected);
    }
  });

  it('aligne SUBSCRIPTION_QUOTAS sur 0 / 4 / 7 / 10', () => {
    expect(SUBSCRIPTION_QUOTAS.STANDARD).toBe(0);
    expect(SUBSCRIPTION_QUOTAS.PRO).toBe(4);
    expect(SUBSCRIPTION_QUOTAS.ELITE).toBe(7);
    expect(SUBSCRIPTION_QUOTAS.BUSINESS).toBe(10);
  });

  it('met à jour les CGU sans promesse de 3 annonces gratuites ni de 5 photos universelles', () => {
    const art4 = CGU_SECTIONS.find((s) => s.id === 'tarifs-duree');
    expect(art4).toBeDefined();
    const joined = art4!.content.join(' ');
    expect(joined).not.toContain('3 annonces simultanées gratuites');
    expect(joined).not.toContain('au-delà de 5');
    expect(joined).toContain('0 annonce gratuite incluse');
    expect(joined).toContain('3 pour Standard/Pro, 4 pour Élite, 5 pour Business');
  });

  it('affiche dans UserDashboard que Standard n’inclut pas d’annonces gratuites et plafonne Business à 10', () => {
    const html = renderToString(
      React.createElement(UserDashboard, {
        currentUser: STANDARD_USER,
        ads: [],
        onOpenPublishModal: () => {},
        onOpenExtendModal: () => {},
        onEditAd: () => {},
        onSelectAdDetail: () => {},
        onDeleteAd: () => {},
        onLogout: () => {},
        initialTab: 'SUBSCRIPTIONS',
      })
    );

    expect(html).not.toContain('Standard Gratuit');
    expect(html).not.toContain('3 annonces simultanées incluses gratuitement');
    expect(html).not.toContain("jusqu'à 20 pour Business");
    expect(html).toContain('0 / 0');
    expect(html).toContain('3 annonces');
    expect(html).toContain('jusqu&#x27;à 10 pour Business');
  });
});

