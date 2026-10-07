import { 
  AvisRechercheCategory,
  AutresEmploisSubCategory,
  BricABracCategory, 
  DomesticJobType, 
  NecrologieMinistry, 
  PropertyType, 
  RollingStockCategory, 
  TutoringLevel, 
  TutoringSubject 
} from '../types';

export const PROPERTY_TYPES: PropertyType[] = [
  'Villa',
  'Maison',
  'Appartement',
  'Studio (1 chambre + 1 salon)',
  'Chambre américaine (chambre + coin cuisine)',
  'Chambre simple',
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

export const NECROLOGIE_MINISTRIES: NecrologieMinistry[] = [
  'Éducation nationale',
  'Police nationale',
  'Armée',
  'Santé',
  'Autre'
];

export const TUTORING_SUBJECTS: TutoringSubject[] = [
  'Mathématiques',
  'Physique-Chimie',
  'SVT (Sciences de la Vie et de la Terre)',
  'Français',
  'Anglais',
  'Philosophie',
  'Histoire-Géographie',
  'Informatique',
  'Autre matière'
];

export const TUTORING_LEVELS: TutoringLevel[] = [
  'Tous niveaux',
  'Primaire',
  'Collège',
  'Lycée',
  'Supérieur / Université'
];

export const AVIS_RECHERCHE_CATEGORIES: AvisRechercheCategory[] = [
  'Personne disparue',
  'Objet ou bien égaré',
  'Animal perdu',
  'Document ou Titre officiel perdu',
  'Témoin recherché',
  'Autre avis'
];

export const AUTRES_EMPLOIS_SUBCATEGORIES: AutresEmploisSubCategory[] = [
  "Demandeur d'emploi",
  "Offre d'emploi",
  'Stage / Alternance',
  'Freelance & Prestations',
  'Intérim & Saisonnier'
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
  maxCharLength: 1000 // Limite de caractères du descriptif (1000 caractères max pour toutes les catégories)
};
