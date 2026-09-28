import { BricABracCategory, DomesticJobType, PropertyType, RollingStockCategory } from '../types';

export const PROPERTY_TYPES: PropertyType[] = [
  'Villa',
  'Maison',
  'Appartement',
  'Studio / Chambre',
  'Terrain / Parcelle',
  'Bureau / Local commercial',
  'Entrepôt'
];

export const BRIC_A_BRAC_CATEGORIES: BricABracCategory[] = [
  'Électronique & Smartphones',
  'Électroménager',
  'Informatique & Bureautique',
  'Meubles & Décoration',
  'Mode & Vêtements',
  'Bricolage & Matériaux',
  'Autres objets'
];

export const DOMESTIC_JOB_TYPES: DomesticJobType[] = [
  'Nounous (garde-bébé)',
  'Cuisiniers',
  'Gardiens de nuit / de jour',
  'Jardiniers',
  'Assistants aux personnes âgées',
  'Femmes de ménage / Repassage',
  'Chauffeurs particuliers'
];

export const PRICING_CONFIG = {
  durations: [
    { days: 3, label: '3 Jours (Express)', price: 1500 },
    { days: 7, label: '7 Jours (1 Semaine)', price: 3000 },
    { days: 15, label: '15 Jours (2 Semaines)', price: 5500 },
    { days: 30, label: '30 Jours (1 Mois - Populaire)', price: 9500 },
    { days: 60, label: '60 Jours (2 Mois)', price: 16000 }
  ],
  includedImages: 5, // 5 premières photos incluses sans supplément
  pricePerExtraImage: 500, // 500 FCFA par photo à partir de la 6e
  maxImages: 10, // Plafond maximal de photos par annonce
  videoPrice: 2000, // FCFA pour courte vidéo descriptive (30s max)
  maxCharLength: 300 // Limite de caractères du descriptif
};
