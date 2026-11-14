import { describe, it, expect } from 'vitest';
import { getMaxPhotosAllowed } from '../src/features/publish/schemas/types';
import { buildAdPayload, BuildAdPayloadParams } from '../src/features/publish/payloadBuilder';
import { CATEGORY_SCHEMAS, getCategorySchema } from '../src/features/publish/schemas';
import { MainCategory } from '../src/types';

describe('Phase 6: Publish Stepper & Per-Category Schemas', () => {
  describe('Photo Allowance Enforcement (Section 2 & 5.6)', () => {
    it('enforces 3 photos max for Standard tier', () => {
      expect(getMaxPhotosAllowed('STANDARD')).toBe(3);
      expect(getMaxPhotosAllowed(null)).toBe(3);
      expect(getMaxPhotosAllowed(undefined)).toBe(3);
    });

    it('enforces 3 photos max for Pro tier', () => {
      expect(getMaxPhotosAllowed('PRO')).toBe(3);
    });

    it('enforces 4 photos max for Elite tier', () => {
      expect(getMaxPhotosAllowed('ELITE')).toBe(4);
    });

    it('enforces 5 photos max for Business tier', () => {
      expect(getMaxPhotosAllowed('BUSINESS')).toBe(5);
    });
  });

  describe('Category Schemas & Form Validation', () => {
    it('provides valid schemas for all 9 core categories', () => {
      const categories: MainCategory[] = [
        'IMMOBILIER',
        'MATERIEL_ROULANT',
        'BRIC_A_BRAC',
        'EMPLOI',
        'COURS_A_DOMICILE',
        'NECROLOGIE',
        'AVIS_DE_RECHERCHE',
        'AUTRES_EMPLOIS',
        'EVENEMENTS',
      ];

      for (const cat of categories) {
        const schema = getCategorySchema(cat);
        expect(schema).toBeDefined();
        expect(schema.category).toBe(cat);
        expect(Array.isArray(schema.fields)).toBe(true);
        expect(typeof schema.validate).toBe('function');
      }
    });

    it('validates required fields for Immobilier schema', () => {
      const schema = CATEGORY_SCHEMAS.IMMOBILIER;
      const invalid = schema.validate({} as any);
      expect(invalid.propertyType).toBeDefined();

      const valid = schema.validate({
        transactionType: 'VENTE',
        propertyType: 'Villa',
      });
      expect(Object.keys(valid).length).toBe(0);
    });

    it('validates required fields for Nécrologie schema', () => {
      const schema = CATEGORY_SCHEMAS.NECROLOGIE;
      const invalid = schema.validate({
        necroMinistry: 'Éducation nationale',
        necroDeceasedName: '',
      } as any);
      expect(invalid.necroDeceasedName).toBeDefined();

      const valid = schema.validate({
        necroMinistry: 'Éducation nationale',
        necroDeceasedName: 'Feu Jean Mba',
      });
      expect(Object.keys(valid).length).toBe(0);
    });

    it('validates required fields for Avis de recherche schema', () => {
      const schema = CATEGORY_SCHEMAS.AVIS_DE_RECHERCHE;
      const invalid = schema.validate({
        avisCategory: 'Personne disparue',
        avisTargetName: '',
      } as any);
      expect(invalid.avisTargetName).toBeDefined();

      const valid = schema.validate({
        avisCategory: 'Personne disparue',
        avisTargetName: 'Titre foncier 123',
      });
      expect(Object.keys(valid).length).toBe(0);
    });
  });

  describe('Payload Builder Snapshot Consistency', () => {
    it('builds canonical Immobilier ad payload with proper transactionType and E.164 phone', () => {
      const params: BuildAdPayloadParams = {
        id: 'ad_immob_123',
        title: 'Superbe Villa 4 chambres à La Sablière',
        mainCategory: 'IMMOBILIER',
        transactionType: 'LOCATION',
        propertyType: 'Villa',
        province: 'Estuaire',
        city: 'Libreville',
        neighborhood: 'La Sablière',
        price: 850000,
        priceUnit: 'mois',
        description: 'Grande villa avec piscine et groupe électrogène située à La Sablière.',
        images: ['https://example.com/photo1.webp', 'https://example.com/photo2.webp'],
        contactPhone: '077 12 34 56',
        contactName: 'Agence Prestige',
        durationDays: 30,
        createdAt: '2026-11-14T12:00:00.000Z',
        userId: 'user_456',
        paymentReference: 'PAY-123456',
      };

      const payload = buildAdPayload(params);

      expect(payload).toEqual({
        id: 'ad_immob_123',
        title: 'Superbe Villa 4 chambres à La Sablière',
        mainCategory: 'IMMOBILIER',
        transactionType: 'LOCATION',
        propertyType: 'Villa',
        jobKind: undefined,
        location: {
          province: 'Estuaire',
          city: 'Libreville',
          neighborhood: 'La Sablière',
        },
        vehicleData: undefined,
        bricCategory: undefined,
        domesticJobType: undefined,
        tutoringData: undefined,
        necrologieData: undefined,
        avisRechercheData: undefined,
        eventData: undefined,
        autresEmploisData: undefined,
        cvUrl: undefined,
        cvFileName: undefined,
        cvFileType: undefined,
        cvFileSize: undefined,
        jobDocUrl: undefined,
        jobDocFileName: undefined,
        jobDocFileType: undefined,
        jobDocFileSize: undefined,
        price: 850000,
        priceMax: undefined,
        priceUnit: 'mois',
        description: 'Grande villa avec piscine et groupe électrogène située à La Sablière.',
        images: ['https://example.com/photo1.webp', 'https://example.com/photo2.webp'],
        videoUrl: undefined,
        contactPhone: '+24177123456',
        hasWhatsapp: true,
        contactName: 'Agence Prestige',
        durationDays: 30,
        createdAt: '2026-11-14T12:00:00.000Z',
        status: 'PENDING_REVIEW',
        userId: 'user_456',
        paymentReference: 'PAY-123456',
      });
    });

    it('correctly maps transactionType to CHERCHE_EMPLOI for Emploi demandeur', () => {
      const params: BuildAdPayloadParams = {
        id: 'ad_emploi_789',
        title: "Nounou d'expérience cherche famille",
        mainCategory: 'EMPLOI',
        transactionType: 'VENTE',
        jobKind: 'DEMANDE_EMPLOI',
        domesticJobType: 'Nounous (garde-bébé)',
        province: 'Estuaire',
        city: 'Libreville',
        neighborhood: 'Nzeng-Ayong',
        price: 150000,
        priceMax: 200000,
        priceUnit: 'mois',
        description: 'Nounou professionnelle avec 8 ans expérience auprès de nourrissons.',
        images: ['https://example.com/profil.webp'],
        contactPhone: '074 55 66 77',
        contactName: 'Marie O.',
        durationDays: 30,
        createdAt: '2026-11-14T12:00:00.000Z',
        userId: 'user_nounou',
      };

      const payload = buildAdPayload(params);
      expect(payload.transactionType).toBe('CHERCHE_EMPLOI');
      expect(payload.jobKind).toBe('DEMANDE_EMPLOI');
      expect(payload.priceMax).toBe(200000);
      expect(payload.contactPhone).toBe('+24174556677');
    });

    it('correctly zeros price for Necrologie and sets status PENDING_REVIEW', () => {
      const params: BuildAdPayloadParams = {
        id: 'ad_necro_001',
        title: 'Avis d’obsèques Feu Mba',
        mainCategory: 'NECROLOGIE',
        transactionType: 'VENTE',
        necroMinistry: 'Éducation nationale',
        necroDeceasedName: 'Feu Daniel Mba',
        necroCeremonyDate: '2026-11-28',
        necroCeremonyLocation: 'Casep-Ga Libreville',
        necroFuneralProgram: 'Sortie de corps 15h, veillée au domicile familial.',
        necroFamilyContact: '077 11 22 33',
        province: 'Estuaire',
        city: 'Libreville',
        neighborhood: 'Akébé',
        price: 50000, // Should be forced to 0
        priceUnit: 'total',
        description: 'Les familles Mba et Nguema ont la profonde douleur de vous faire part du décès de leur père.',
        images: ['https://example.com/photo_necro.webp'],
        contactPhone: '077 11 22 33',
        contactName: 'Famille Mba',
        durationDays: 15,
        createdAt: '2026-11-14T12:00:00.000Z',
        userId: 'user_famille',
      };

      const payload = buildAdPayload(params);
      expect(payload.price).toBe(0);
      expect(payload.status).toBe('PENDING_REVIEW');
      expect(payload.necrologieData?.deceasedName).toBe('Feu Daniel Mba');
    });

    it('correctly builds Événements payload with eventData', () => {
      const params: BuildAdPayloadParams = {
        id: 'ad_event_002',
        title: 'Mariage Daniel et Claire',
        mainCategory: 'EVENEMENTS',
        transactionType: 'VENTE',
        eventType: 'Mariage',
        eventDate: '2026-12-15',
        eventTime: '17:00',
        eventVenue: 'Hôtel Le Nomad, Libreville',
        eventOrganizer: 'Familles Mouzou et Ondo',
        eventDressCode: 'Tenue de soirée ou pagne traditionnel',
        province: 'Estuaire',
        city: 'Libreville',
        neighborhood: 'La Sablière',
        price: 0,
        priceUnit: 'total',
        description: 'Grande réception à l’occasion de la bénédiction nuptiale de Daniel et Claire.',
        images: ['https://example.com/fairepart.webp'],
        contactPhone: '066 99 88 77',
        contactName: 'Comité d’organisation',
        durationDays: 30,
        createdAt: '2026-11-14T12:00:00.000Z',
        userId: 'user_event',
      };

      const payload = buildAdPayload(params);
      expect(payload.eventData).toEqual({
        eventType: 'Mariage',
        eventDate: '2026-12-15',
        eventTime: '17:00',
        venue: 'Hôtel Le Nomad, Libreville',
        organizer: 'Familles Mouzou et Ondo',
        dressCode: 'Tenue de soirée ou pagne traditionnel',
      });
      expect(payload.contactPhone).toBe('+24166998877');
    });
  });
});
