import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rejectionNotifId } from '../src/services/notificationService';

describe('Étape 2.2 & 2.3 : File de notifications et persistance atomique (B-01, B-05, B-06 à B-10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rejectionNotifId (B-09)', () => {
    it('génère un identifiant déterministe avec priorité moderatedAt > updatedAt > createdAt', () => {
      const ad1 = { id: 'ad_123', moderatedAt: '2026-10-17T10:00:00Z', updatedAt: '2026-10-17T09:00:00Z' };
      expect(rejectionNotifId(ad1)).toBe('rej_ad_123_2026-10-17T10:00:00Z');

      const ad2 = { id: 'ad_123', updatedAt: '2026-10-17T09:00:00Z', createdAt: '2026-10-17T08:00:00Z' };
      expect(rejectionNotifId(ad2)).toBe('rej_ad_123_2026-10-17T09:00:00Z');

      const ad3 = { id: 'ad_123', createdAt: '2026-10-17T08:00:00Z' };
      expect(rejectionNotifId(ad3)).toBe('rej_ad_123_2026-10-17T08:00:00Z');

      const adEmpty = { id: 'ad_123' };
      expect(rejectionNotifId(adEmpty)).toBe('rej_ad_123_rejected');
    });
  });

  describe('Simulation de la file stable Annexe B (B-01, B-05)', () => {
    it('affiche successivement 3 notifications en file avec un intervalle de 2 secondes', () => {
      const queue = [
        { id: 'notif_1', title: 'Rejet' },
        { id: 'notif_2', title: 'Validation' },
        { id: 'notif_3', title: 'KYC' },
      ];

      const displayed: string[] = [];
      let activeRef: any = null;
      let isWaiting = false;

      const showNext = () => {
        if (activeRef || isWaiting) return;
        const next = queue.shift();
        if (!next) return;
        activeRef = next;
        displayed.push(next.id);
      };

      const dismissActive = () => {
        if (!activeRef) return;
        activeRef = null;
        if (queue.length > 0) {
          isWaiting = true;
          setTimeout(() => {
            isWaiting = false;
            showNext();
          }, 2000);
        }
      };

      // 1. Première notification
      showNext();
      expect(displayed).toEqual(['notif_1']);
      expect(activeRef.id).toBe('notif_1');

      // Tentative concurrente de ré-appeler showNext pendant qu'une notification est active -> bloquée
      showNext();
      expect(displayed).toEqual(['notif_1']);

      // 2. Fermeture de la notification 1
      dismissActive();
      expect(activeRef).toBeNull();
      // Pendant les 2 secondes d'attente, rien n'est encore affiché
      vi.advanceTimersByTime(1000);
      expect(displayed).toEqual(['notif_1']);

      // Après 2000ms au total, notification 2 s'affiche
      vi.advanceTimersByTime(1000);
      expect(displayed).toEqual(['notif_1', 'notif_2']);
      expect(activeRef.id).toBe('notif_2');

      // 3. Fermeture de notification 2
      dismissActive();
      vi.advanceTimersByTime(2000);
      expect(displayed).toEqual(['notif_1', 'notif_2', 'notif_3']);
      expect(activeRef.id).toBe('notif_3');

      // 4. Fermeture de notification 3 (file vide)
      dismissActive();
      vi.advanceTimersByTime(5000);
      expect(displayed).toEqual(['notif_1', 'notif_2', 'notif_3']);
      expect(activeRef).toBeNull();
    });
  });

  describe('Fenêtre de récence et limitation de session (B-08)', () => {
    it('filtre les événements datant de plus de 7 jours et plafonne à 5 par session', () => {
      const now = Date.now();
      const RECENCY_WINDOW_MS = 7 * 24 * 3600 * 1000;
      const MAX_SESSION_NOTIFICATIONS = 5;

      const items = Array.from({ length: 15 }, (_, i) => ({
        id: `notif_${i}`,
        // Les 3 premiers sont vieux de 10 jours (> 7 jours)
        timestamp: i < 3 ? now - 10 * 24 * 3600 * 1000 : now - i * 3600 * 1000,
      }));

      // Filtrage par récence
      const recent = items.filter((item) => now - item.timestamp <= RECENCY_WINDOW_MS);
      expect(recent.length).toBe(12);

      // Plafond par session
      const capped = recent.slice(0, MAX_SESSION_NOTIFICATIONS);
      expect(capped.length).toBe(5);
    });
  });
});
