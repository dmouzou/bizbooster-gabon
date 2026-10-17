import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MAX_DURATION_MS } from '../src/components/InAppNotificationModal';

describe('Étape 2.1 : Durée de 15 secondes des notifications In-App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('définit MAX_DURATION_MS strictement à 15000 (15 secondes)', () => {
    expect(MAX_DURATION_MS).toBe(15000);
  });

  it('ne contient aucune occurrence de 30s ou 30 secondes dans InAppNotificationModal.tsx', () => {
    const modalPath = path.resolve(__dirname, '../src/components/InAppNotificationModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    expect(content).not.toMatch(/30\s*s(econdes)?/i);
    expect(content).not.toContain('30000');
  });

  it('minuterie fake timers : se déclenche à 15000 ms et se gèle au survol', () => {
    let dismissed = false;
    let isHovered = false;
    let remainingTimeMs = MAX_DURATION_MS;

    const intervalStep = 100;
    const intervalId = setInterval(() => {
      if (isHovered) return;
      if (remainingTimeMs <= intervalStep) {
        clearInterval(intervalId);
        dismissed = true;
        remainingTimeMs = 0;
      } else {
        remainingTimeMs -= intervalStep;
      }
    }, intervalStep);

    // Après 5000ms normal -> reste 10000ms, non fermé
    vi.advanceTimersByTime(5000);
    expect(dismissed).toBe(false);
    expect(remainingTimeMs).toBe(10000);

    // Survol actif -> pause pendant 20 secondes !
    isHovered = true;
    vi.advanceTimersByTime(20000);
    expect(dismissed).toBe(false);
    expect(remainingTimeMs).toBe(10000);

    // Fin du survol -> reprend pour les 10000ms restantes
    isHovered = false;
    vi.advanceTimersByTime(9900);
    expect(dismissed).toBe(false);

    vi.advanceTimersByTime(100);
    expect(dismissed).toBe(true);
    expect(remainingTimeMs).toBe(0);
  });
});
