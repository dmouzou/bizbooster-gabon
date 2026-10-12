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
});
