import { describe, it, expect } from 'vitest';
import {
  calculateServerPrice,
  getTierFreePhotosCount,
} from '../functions/src/pricing';
import {
  isAdVipCornerEligible as serverVipEligible,
} from '../functions/src/vipCorner';
import {
  isAdVipCornerEligible as clientVipEligible,
} from '../src/utils/vipCorner';

describe('Calcul des prix serveur (Pricing Parity)', () => {
  it('accorde la gratuité totale à un compte partenaire exempté', () => {
    const price = calculateServerPrice('AD_PUBLISH', { photoCount: 10, hasVideo: true }, 'STANDARD', true);
    expect(price).toBe(0);
  });

  it('renvoie les tarifs fixes des abonnements et packs', () => {
    expect(calculateServerPrice('SUB_PRO')).toBe(29000);
    expect(calculateServerPrice('SUB_ELITE')).toBe(59000);
    expect(calculateServerPrice('SUB_BUSINESS')).toBe(99000);
    expect(calculateServerPrice('BOOST_SINGLE')).toBe(5000);
    expect(calculateServerPrice('BOOST_5')).toBe(15000);
    expect(calculateServerPrice('BOOST_10')).toBe(25000);
  });

  it('calcule correctement les photos incluses par palier', () => {
    expect(getTierFreePhotosCount('STANDARD')).toBe(3);
    expect(getTierFreePhotosCount('PRO')).toBe(3);
    expect(getTierFreePhotosCount('ELITE')).toBe(4);
    expect(getTierFreePhotosCount('BUSINESS')).toBe(5);
  });

  it('facture les photos supplémentaires et vidéos selon le palier', () => {
    // 5 photos en Standard (3 gratuites, 2 en sus à 500 = 1000) + vidéo (2000) + durée 30j (9500)
    const priceStandard = calculateServerPrice('AD_PUBLISH', {
      durationDays: 30,
      photoCount: 5,
      hasVideo: true,
    }, 'STANDARD');
    expect(priceStandard).toBe(9500 + 1000 + 2000);

    // 5 photos en Business (5 gratuites) + vidéo gratuite (0) + durée 30j (9500)
    const priceBusiness = calculateServerPrice('AD_PUBLISH', {
      durationDays: 30,
      photoCount: 5,
      hasVideo: true,
    }, 'BUSINESS');
    expect(priceBusiness).toBe(9500 + 0 + 0);

    // 5 photos en Elite (4 gratuites, 1 en sus à 500) + vidéo 1000 + durée 30j (9500)
    const priceElite = calculateServerPrice('AD_PUBLISH', {
      durationDays: 30,
      photoCount: 5,
      hasVideo: true,
    }, 'ELITE');
    expect(priceElite).toBe(9500 + 500 + 1000);
  });

  it('applique la gratuité de la durée de base si couverte par quota', () => {
    const price = calculateServerPrice('AD_PUBLISH', {
      durationDays: 30,
      photoCount: 3,
      hasVideo: false,
    }, 'STANDARD', false, true);
    expect(price).toBe(0);
  });

  it('applique les réductions de palier sur les prolongations d\'annonces', () => {
    // Base 30j = 9500
    expect(calculateServerPrice('AD_EXTEND', { days: 30 }, 'STANDARD')).toBe(9500);
    expect(calculateServerPrice('AD_EXTEND', { days: 30 }, 'PRO')).toBe(Math.round(9500 * 0.75));
    expect(calculateServerPrice('AD_EXTEND', { days: 30 }, 'ELITE')).toBe(Math.round(9500 * 0.5));
    expect(calculateServerPrice('AD_EXTEND', { days: 30 }, 'BUSINESS')).toBe(0);
  });
});

describe('Coin VIP (Parité Client/Serveur)', () => {
  it('détecte un bien immobilier VIP selon les seuils', () => {
    const adEligible = {
      mainCategory: 'IMMOBILIER',
      transactionType: 'VENTE',
      price: 80_000_000,
      propertyType: 'villa',
    };
    expect(serverVipEligible(adEligible)).toBe(true);
    expect(clientVipEligible(adEligible as any)).toBe(true);

    const adUnderThreshold = {
      mainCategory: 'IMMOBILIER',
      transactionType: 'VENTE',
      price: 50_000_000,
      propertyType: 'villa',
    };
    expect(serverVipEligible(adUnderThreshold)).toBe(false);
    expect(clientVipEligible(adUnderThreshold as any)).toBe(false);
  });

  it('détecte un véhicule VIP selon les seuils', () => {
    const adCarVip = {
      mainCategory: 'MATERIEL_ROULANT',
      transactionType: 'VENTE',
      price: 30_000_000,
      vehicleData: { category: 'voiture' },
    };
    expect(serverVipEligible(adCarVip)).toBe(true);
    expect(clientVipEligible(adCarVip as any)).toBe(true);

    const adCarLow = {
      mainCategory: 'MATERIEL_ROULANT',
      transactionType: 'VENTE',
      price: 10_000_000,
      vehicleData: { category: 'voiture' },
    };
    expect(serverVipEligible(adCarLow)).toBe(false);
    expect(clientVipEligible(adCarLow as any)).toBe(false);
  });
});
