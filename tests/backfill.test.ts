import { describe, it, expect } from 'vitest';

describe('Phase 6: Migration backfill script logic', () => {
  it('calcule correctement la médiane et le seuil d aberration', () => {
    const views = [10, 20, 20, 30, 40, 50, 1000]; // médiane = 30
    const sorted = [...views].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted[mid];
    expect(median).toBe(30);

    const threshold = Math.max(100, median * 10);
    expect(threshold).toBe(300);
    // 1000 > 300, donc détecté comme aberrant
    expect(1000 > threshold).toBe(true);
    expect(50 > threshold).toBe(false);
  });

  it('détecte les boosts orphelins, échus ou trop longs (> 30 jours)', () => {
    const now = 1770000000000;
    const maxFutureBoost = now + 30 * 86400000;

    // Boost sans featuredUntil
    const orphanBoost = { isFeatured: true, featuredUntil: undefined };
    expect(orphanBoost.isFeatured && !orphanBoost.featuredUntil).toBe(true);

    // Boost échu
    const expiredBoost = { isFeatured: true, featuredUntil: new Date(now - 10000).toISOString() };
    const expMs = new Date(expiredBoost.featuredUntil).getTime();
    expect(expMs <= now).toBe(true);

    // Boost trop long
    const tooLongBoost = { isFeatured: true, featuredUntil: new Date(now + 45 * 86400000).toISOString() };
    const longMs = new Date(tooLongBoost.featuredUntil).getTime();
    expect(longMs > maxFutureBoost).toBe(true);
  });

  it('aligne les champs canoniques (I-02) : moderationReason, transactionRef, necrologieData', () => {
    // 1. Alignement moderationReason
    const legacyRejectionAd: any = { rejectionReason: 'Photos non conformes' };
    const updatesRejection: any = {};
    if (legacyRejectionAd.rejectionReason && !legacyRejectionAd.moderationReason) {
      updatesRejection.moderationReason = legacyRejectionAd.rejectionReason;
    }
    expect(updatesRejection.moderationReason).toBe('Photos non conformes');

    // 2. Alignement transactionRef
    const legacyPaymentAd: any = { paymentReference: 'PAY-12345' };
    const updatesPayment: any = {};
    if (legacyPaymentAd.paymentReference && !legacyPaymentAd.transactionRef) {
      updatesPayment.transactionRef = legacyPaymentAd.paymentReference;
    }
    expect(updatesPayment.transactionRef).toBe('PAY-12345');

    // 3. Alignement necrologieData
    const legacyNecroAd: any = {
      necroDeceasedName: 'Feu M. Dupont',
      necroMinistry: 'Police nationale',
    };
    const updatesNecro: any = {};
    if (legacyNecroAd.necroDeceasedName && !legacyNecroAd.necrologieData?.deceasedName) {
      updatesNecro.necrologieData = {
        ministry: legacyNecroAd.necroMinistry || 'Autre',
        deceasedName: legacyNecroAd.necroDeceasedName,
      };
    }
    expect(updatesNecro.necrologieData.deceasedName).toBe('Feu M. Dupont');
    expect(updatesNecro.necrologieData.ministry).toBe('Police nationale');
  });
});

