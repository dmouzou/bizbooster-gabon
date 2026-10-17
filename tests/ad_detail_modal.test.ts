import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdDetailModal, isTrustedMediaUrl, FALLBACK_IMAGE } from '../src/components/AdDetailModal';
import { formatRemainingTime } from '../src/utils/formatters';
import { Ad } from '../src/types';

describe('Étape 5.2 : AdDetailModal (B-03, S-14, B-19)', () => {
  const sampleAd: Ad = {
    id: 'ad-test-123',
    title: 'Superbe Appartement 3 Pièces',
    mainCategory: 'IMMOBILIER',
    transactionType: 'LOCATION',
    propertyType: 'Appartement',
    price: 350000,
    priceUnit: 'mois',
    description: 'Bel appartement à louer',
    images: [
      'https://firebasestorage.googleapis.com/v0/b/bizbooster.appspot.com/o/ads%2Fimg1.jpg?alt=media',
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80',
      'https://malicious-site.com/exploit.jpg', // Devrait être filtré par S-14
    ],
    videoUrl: 'https://firebasestorage.googleapis.com/v0/b/bizbooster.appspot.com/o/ads%2Fvideo.mp4',
    contactPhone: '+241 77 00 00 00',
    contactName: 'Agence Test',
    durationDays: 30,
    publishedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 5000,
    paymentMethod: 'AIRTEL_MONEY',
  };

  it('B-03 : supporte des ouvertures et fermetures répétées sans lever d erreur de hooks', () => {
    // Rend successivement null -> ad -> null -> ad -> null
    expect(() => {
      renderToString(React.createElement(AdDetailModal, {
        ad: null,
        onClose: () => {},
        onOpenExtendModal: () => {},
      }));

      const htmlWithAd = renderToString(React.createElement(AdDetailModal, {
        ad: sampleAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      }));
      expect(htmlWithAd).toMatch(/REF:.*AD-TEST-123/);

      renderToString(React.createElement(AdDetailModal, {
        ad: null,
        onClose: () => {},
        onOpenExtendModal: () => {},
      }));

      const htmlAgain = renderToString(React.createElement(AdDetailModal, {
        ad: sampleAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      }));
      expect(htmlAgain).toMatch(/REF:.*AD-TEST-123/);
    }).not.toThrow();
  });

  it('S-14 : valide les URLs de médias et écarte les domaines arbitraires', () => {
    expect(isTrustedMediaUrl('https://firebasestorage.googleapis.com/v0/b/app/o/photo.jpg')).toBe(true);
    expect(isTrustedMediaUrl('https://storage.googleapis.com/app/photo.jpg')).toBe(true);
    expect(isTrustedMediaUrl('https://images.unsplash.com/photo-sample')).toBe(true);

    expect(isTrustedMediaUrl('https://evil.com/fake.jpg')).toBe(false);
    expect(isTrustedMediaUrl('http://insecure.com/fake.jpg')).toBe(false);
    expect(isTrustedMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedMediaUrl('')).toBe(false);
    expect(isTrustedMediaUrl(undefined)).toBe(false);
  });

  it('B-19 : libellé de paiement conditionnel selon le statut de paiement réel', () => {
    // 1. Annonce payante Airtel Money
    const htmlAirtel = renderToString(React.createElement(AdDetailModal, {
      ad: { ...sampleAd, paidAmount: 5000, paymentMethod: 'AIRTEL_MONEY' },
      onClose: () => {},
      onOpenExtendModal: () => {},
    }));
    expect(htmlAirtel).toMatch(/Paiement certifié.*Airtel Money/);

    // 2. Annonce payante Moov Money
    const htmlMoov = renderToString(React.createElement(AdDetailModal, {
      ad: { ...sampleAd, paidAmount: 5000, paymentMethod: 'MOOV_MONEY' },
      onClose: () => {},
      onOpenExtendModal: () => {},
    }));
    expect(htmlMoov).toMatch(/Paiement certifié.*Moov Money/);

    // 3. Annonce Coin VIP (gratuite pour l annonceur VIP)
    const htmlVip = renderToString(React.createElement(AdDetailModal, {
      ad: { ...sampleAd, paidAmount: 0, paymentMethod: undefined, isOwnerVip: true },
      onClose: () => {},
      onOpenExtendModal: () => {},
    }));
    expect(htmlVip).toContain('Publication certifiée BIZBOOSTER (Coin VIP)');
    expect(htmlVip).not.toContain('Moov Money');

    // 4. Annonce standard gratuite ou forfaitaire sans montant de paiement spécifique
    const htmlFree = renderToString(React.createElement(AdDetailModal, {
      ad: { ...sampleAd, paidAmount: 0, paymentMethod: undefined, isOwnerVip: false },
      onClose: () => {},
      onOpenExtendModal: () => {},
    }));
    expect(htmlFree).toContain('Publication certifiée BIZBOOSTER');
    expect(htmlFree).not.toContain('Moov Money');
  });

  it('B-19 : formatRemainingTime gère gracieusement les dates invalides, null et expirées', () => {
    expect(formatRemainingTime(undefined).isExpired).toBe(true);
    expect(formatRemainingTime(null).isExpired).toBe(true);
    expect(formatRemainingTime('invalid-date').isExpired).toBe(true);
    expect(formatRemainingTime('invalid-date').label).toBe('Expirée');

    const pastDate = new Date(Date.now() - 3600000).toISOString();
    expect(formatRemainingTime(pastDate).isExpired).toBe(true);

    const futureDate = new Date(Date.now() + 5 * 86400000 + 3600000).toISOString();
    const res = formatRemainingTime(futureDate);
    expect(res.isExpired).toBe(false);
    expect(res.days).toBeGreaterThanOrEqual(5);
  });
});
