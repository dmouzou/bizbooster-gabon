import { describe, it, expect } from 'vitest';
import {
  isValidDateString,
  isValidTimeString,
  parseEventDateTime,
  validateEventSchedule,
} from '../src/utils/eventValidation';

describe('Validation des Événements (Date, Heure et Règle du Futur Strict)', () => {
  // Date de référence fixe pour tests déterministes : Dimanche 1er Novembre 2026 à 14h30
  const fixedNow = new Date('2026-11-01T14:30:00').getTime();

  describe('Validation du format de date', () => {
    it('accepte les dates valides au format YYYY-MM-DD', () => {
      expect(isValidDateString('2026-11-01')).toBe(true);
      expect(isValidDateString('2026-12-31')).toBe(true);
      expect(isValidDateString('2027-02-28')).toBe(true);
    });

    it('rejette les formats ou valeurs invalides', () => {
      expect(isValidDateString('')).toBe(false);
      expect(isValidDateString('invalid')).toBe(false);
      expect(isValidDateString('01/11/2026')).toBe(false);
      expect(isValidDateString('2026-13-01')).toBe(false); // Mois 13 invalide
      expect(isValidDateString('2026-02-30')).toBe(false); // 30 Février invalide
      expect(isValidDateString('2026-04-31')).toBe(false); // 31 Avril invalide (30 jours max)
    });
  });

  describe('Validation du format de l\'heure', () => {
    it('accepte les horaires 24h valides', () => {
      expect(isValidTimeString('00:00')).toBe(true);
      expect(isValidTimeString('14:30')).toBe(true);
      expect(isValidTimeString('18:00')).toBe(true);
      expect(isValidTimeString('23:59')).toBe(true);
    });

    it('rejette les horaires invalides', () => {
      expect(isValidTimeString('')).toBe(false);
      expect(isValidTimeString('24:00')).toBe(false); // 24h invalide
      expect(isValidTimeString('12:60')).toBe(false); // 60 min invalide
      expect(isValidTimeString('8h30')).toBe(false);
      expect(isValidTimeString('abc')).toBe(false);
    });
  });

  describe('Règle stricte : Événement dans le futur uniquement (interdit dans le passé)', () => {
    it('rejette un événement sans date', () => {
      const res = validateEventSchedule('', '18:00', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('date');
      expect(res.error).toBe("Veuillez indiquer la date de l'événement.");
    });

    it('rejette un événement avec une date malformée', () => {
      const res = validateEventSchedule('2026-02-31', '18:00', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('date');
      expect(res.error).toBe("La date de l'événement n'est pas valide.");
    });

    it('rejette un événement sans heure', () => {
      const res = validateEventSchedule('2026-11-20', '', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('time');
      expect(res.error).toBe("Veuillez indiquer l'heure de début de l'événement (format 24h).");
    });

    it('rejette un événement avec une heure malformée', () => {
      const res = validateEventSchedule('2026-11-20', '25:00', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('time');
      expect(res.error).toBe("L'heure de l'événement n'est pas valide (format HH:mm attendu).");
    });

    it('rejette un événement dont la date est passée (ex: hier)', () => {
      // fixedNow = 2026-11-01T14:30:00
      const res = validateEventSchedule('2026-10-31', '20:00', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('both');
      expect(res.error).toContain("Un événement ne peut pas être défini dans le passé, uniquement dans le futur.");
    });

    it('rejette un événement prévu aujourd\'hui mais à une heure déjà écoulée (ex: 10h00 quand il est 14h30)', () => {
      // fixedNow = 2026-11-01T14:30:00
      const res = validateEventSchedule('2026-11-01', '10:00', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('both');
      expect(res.error).toContain("Un événement ne peut pas être défini dans le passé, uniquement dans le futur.");
    });

    it('rejette un événement dont l\'heure correspond exactement à l\'instant présent', () => {
      // fixedNow = 2026-11-01T14:30:00
      const res = validateEventSchedule('2026-11-01', '14:30', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.field).toBe('both');
      expect(res.error).toContain("Un événement ne peut pas être défini dans le passé, uniquement dans le futur.");
    });

    it('accepte un événement prévu aujourd\'hui mais plus tard dans la journée (ex: 20h00 quand il est 14h30)', () => {
      // fixedNow = 2026-11-01T14:30:00
      const res = validateEventSchedule('2026-11-01', '20:00', fixedNow);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('accepte un événement prévu dans le futur (ex: dans 3 semaines à 18h00)', () => {
      const res = validateEventSchedule('2026-11-20', '18:00', fixedNow);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });
});
