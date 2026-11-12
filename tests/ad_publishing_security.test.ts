import { describe, it, expect } from 'vitest';
import { sanitizeAdForCreation, FORBIDDEN_AD_CREATE_KEYS } from '../src/utils/ads';
import { Ad } from '../src/types';

describe('Ad Publishing & Creation Security Sanitization', () => {
  it('strips all forbidden and ranking keys from an ad before creation in Firestore', () => {
    const rawAd: Partial<Ad> & Record<string, any> = {
      id: 'ad_test_123',
      title: 'Mariage Princier à Libreville',
      mainCategory: 'EVENEMENTS',
      transactionType: 'VENTE',
      location: {
        province: 'Estuaire',
        city: 'Libreville',
        neighborhood: 'La Sablière',
      },
      eventData: {
        eventType: 'Mariage',
        eventDate: '2026-11-20',
        eventTime: '18:00',
        venue: 'Hôtel Boulevard',
        organizer: 'Famille Mba',
        dressCode: 'Tenue de soirée',
      },
      price: 0,
      priceUnit: 'total',
      description: 'Célébration du mariage civil et religieux suivie d’un grand banquet.',
      images: ['https://example.com/photo1.jpg'],
      contactPhone: '+24177000000',
      contactName: 'Jean Mba',
      durationDays: 30,
      status: 'PENDING_REVIEW',
      userId: 'user_elite_456',

      // Forbidden keys that must NOT reach Firestore on create
      publishedAt: '2026-10-27T00:00:00.000Z',
      expiresAt: '2026-11-26T00:00:00.000Z',
      moderatedAt: '2026-10-27T00:00:00.000Z',
      moderationReason: 'Test reason',
      ownerTier: 'ELITE',
      isOwnerVip: true,
      isOwnerVerified: true,
      isFeatured: true,
      featuredAt: '2026-10-27T00:00:00.000Z',
      featuredUntil: '2026-11-03T00:00:00.000Z',
      featuredPausedAt: '2026-10-27T00:00:00.000Z',
      boostRequested: true,
      withBoost: true,
      isVipCorner: true,
      paidAmount: 50000,
      paymentMethod: 'AIRTEL_MONEY',
      transactionRef: 'AIRTEL-12345',
      paymentVerified: true,
      viewsCount: 150,
      reportsCount: 0,
      pendingExtension: { days: 15 },
      suspensionReason: 'None',
      suspendedAt: '2026-10-27T00:00:00.000Z',
      lastExtendedAt: '2026-10-27T00:00:00.000Z',
    };

    const sanitized = sanitizeAdForCreation(rawAd as any);

    // Verify none of the forbidden keys are present in sanitized output
    for (const forbiddenKey of FORBIDDEN_AD_CREATE_KEYS) {
      expect(sanitized).not.toHaveProperty(forbiddenKey);
    }

    // Verify critical ad payload is completely intact
    expect(sanitized.id).toBe('ad_test_123');
    expect(sanitized.title).toBe('Mariage Princier à Libreville');
    expect(sanitized.mainCategory).toBe('EVENEMENTS');
    expect(sanitized.price).toBe(0);
    expect(sanitized.eventData).toEqual({
      eventType: 'Mariage',
      eventDate: '2026-11-20',
      eventTime: '18:00',
      venue: 'Hôtel Boulevard',
      organizer: 'Famille Mba',
      dressCode: 'Tenue de soirée',
    });
    expect(sanitized.location).toEqual({
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'La Sablière',
    });
    expect(sanitized.durationDays).toBe(30);
  });

  it('allows paymentReference for traceability without violating rankingKeys', () => {
    const rawAd: Partial<Ad> = {
      id: 'ad_quota_789',
      title: 'Soirée Gala Annuel',
      mainCategory: 'EVENEMENTS',
      price: 10000,
      paymentReference: 'QUOTA-XYZ123',
    };

    const sanitized = sanitizeAdForCreation(rawAd);

    expect(sanitized.paymentReference).toBe('QUOTA-XYZ123');
    expect(sanitized.title).toBe('Soirée Gala Annuel');
  });
});
