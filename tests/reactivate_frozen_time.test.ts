import { describe, it, expect } from 'vitest';
import { formatFrozenRemainingTime } from '../src/utils/formatters';

describe('formatFrozenRemainingTime', () => {
  it('calcule les jours gelés entre suspendedAt et expiresAt', () => {
    const suspendedAt = '2026-11-01T10:00:00.000Z';
    const expiresAt = '2026-11-13T10:00:00.000Z';
    const res = formatFrozenRemainingTime(expiresAt, suspendedAt);
    expect(res.days).toBe(12);
    expect(res.remainingMs).toBe(12 * 24 * 3600 * 1000);
    expect(res.label).toBe('12 jours gelés');
  });

  it('gère le cas où expiresAt est antérieur à suspendedAt', () => {
    const suspendedAt = '2026-11-10T10:00:00.000Z';
    const expiresAt = '2026-11-09T10:00:00.000Z';
    const res = formatFrozenRemainingTime(expiresAt, suspendedAt);
    expect(res.days).toBe(0);
    expect(res.remainingMs).toBe(0);
    expect(res.label).toContain('0 jour restant');
  });
});

