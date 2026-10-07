export type MainCategory = 
  | 'IMMOBILIER' 
  | 'MATERIEL_ROULANT' 
  | 'BRIC_A_BRAC' 
  | 'EMPLOI' 
  | 'COURS_A_DOMICILE' 
  | 'NECROLOGIE'
  | 'AVIS_DE_RECHERCHE'
  | 'AUTRES_EMPLOIS';

export type TransactionType = 'VENTE' | 'LOCATION' | 'EMPLOYER' | 'A_EMPLOYER' | 'CHERCHE_EMPLOI';
export type JobAdKind = 'OFFRE_EMPLOI' | 'DEMANDE_EMPLOI'; // Point 8: Offre (Recruteur cherche un employé) vs Demande (Candidat cherche à travailler)

export type PropertyType = 
  | 'Villa'
  | 'Maison'
  | 'Appartement'
  | 'Studio (1 chambre + 1 salon)'
  | 'Chambre américaine (chambre + coin cuisine)'
  | 'Chambre simple'
  | 'Studio / Chambre'
  | 'Terrain / Parcelle'
  | 'Bureau / Local commercial'
  | 'Entrepôt';

export type RollingStockCategory = 
  | 'Voitures'
  | 'Camions Bennes'
  | 'Camions Citernes'
  | 'Engins de chantiers'
  | 'Motos'
  | 'Vélos';

export type BricABracCategory = 
  | 'Électronique & Smartphones'
  | 'Électroménager'
  | 'Informatique & Bureautique'
  | 'Meubles & Décoration'
  | 'Mode & Vêtements'
  | 'Bricolage & Matériaux'
  | 'Autres objets';

export type DomesticJobType = 
  | 'Nounous (garde-bébé)'
  | 'Cuisiniers'
  | 'Gardiens de nuit / de jour'
  | 'Jardiniers'
  | 'Assistants aux personnes âgées'
  | 'Femmes de ménage / Repassage'
  | 'Chauffeurs particuliers';

export type NecrologieMinistry = 
  | 'Éducation nationale'
  | 'Police nationale'
  | 'Armée'
  | 'Santé'
  | 'Autre';

export interface NecrologieData {
  ministry: NecrologieMinistry;
  deceasedName?: string;
  ceremonyDate?: string;
  ceremonyLocation?: string;
  familyContact?: string;
  funeralProgram?: string;
}

export type TutoringSubject = 
  | 'Mathématiques'
  | 'Physique-Chimie'
  | 'SVT (Sciences de la Vie et de la Terre)'
  | 'Français'
  | 'Anglais'
  | 'Philosophie'
  | 'Histoire-Géographie'
  | 'Informatique'
  | 'Autre matière';

export type TutoringAdKind = 'OFFRE' | 'DEMANDE'; // Offre de cours ou Demande de cours
export type TutoringLevel = 'Tous niveaux' | 'Primaire' | 'Collège' | 'Lycée' | 'Supérieur / Université';

export interface TutoringData {
  kind: TutoringAdKind;
  subject: TutoringSubject;
  level?: TutoringLevel;
}

// Point 2: Avis de Recherche
export type AvisRechercheCategory = 
  | 'Personne disparue'
  | 'Objet ou bien égaré'
  | 'Animal perdu'
  | 'Document ou Titre officiel perdu'
  | 'Témoin recherché'
  | 'Autre avis';

export interface AvisRechercheData {
  category: AvisRechercheCategory;
  targetName?: string;
  lastSeenDate?: string;
  lastSeenLocation?: string;
  hasReward?: boolean;
  rewardAmount?: number;
  contactEmergency?: string;
}

// Point 2: Autres Emplois
export type AutresEmploisSubCategory = 
  | "Demandeur d'emploi"
  | "Offre d'emploi"
  | 'Stage / Alternance'
  | 'Freelance & Prestations'
  | 'Intérim & Saisonnier';

export interface AutresEmploisData {
  subCategory: AutresEmploisSubCategory;
  profession?: string;
  contractType?: 'CDI' | 'CDD' | 'Stage' | 'Freelance' | 'Temps partiel' | 'Autre';
  experienceYears?: string;
  cvUrl?: string;
  cvFileName?: string;
  cvFileType?: 'pdf' | 'docx' | 'md' | string;
  cvFileSize?: number;
  jobDocUrl?: string;
  jobDocFileName?: string;
  jobDocFileType?: 'pdf' | 'docx' | 'md' | string;
  jobDocFileSize?: number;
}

export type PaymentOperator = 'AIRTEL_MONEY' | 'MOOV_MONEY';

export interface LocationHierarchy {
  province: string;
  city: string;
  neighborhood: string;
}

export interface VehicleHierarchy {
  category: RollingStockCategory;
  brand?: string;
  model?: string;
  subType?: string;
}

export interface Ad {
  id: string;
  title: string;
  mainCategory: MainCategory;
  // Detail explicitly required: L'annonceur doit pouvoir préciser s'il vend ou s'il loue son bien ou recherche un employé
  transactionType?: TransactionType; // For Immobilier, Matériel Roulant (Vente or Location) & Emploi
  
  // Specific Category Data
  propertyType?: PropertyType;
  location?: LocationHierarchy; // For Immobilier and general
  
  vehicleData?: VehicleHierarchy; // For Matériel Roulant
  bricCategory?: BricABracCategory; // For Bric-à-Brac
  domesticJobType?: DomesticJobType; // For Emploi
  jobKind?: JobAdKind; // Point 8: Offre (Recruteur cherche un employé) ou Demande (Candidat cherche du travail)
  tutoringData?: TutoringData; // For Cours à Domicile
  necrologieData?: NecrologieData; // For Nécrologie
  avisRechercheData?: AvisRechercheData; // Point 2: Avis de Recherche
  autresEmploisData?: AutresEmploisData; // Point 2: Autres Emplois
  
  // Point 2: Document joint (.pdf, .docx, .md) : CV pour demandeur d'emploi OU Fiche de poste pour donneur d'emploi (optionnel)
  cvUrl?: string;
  cvFileName?: string;
  cvFileType?: 'pdf' | 'docx' | 'md' | string;
  cvFileSize?: number;
  jobDocUrl?: string;
  jobDocFileName?: string;
  jobDocFileType?: 'pdf' | 'docx' | 'md' | string;
  jobDocFileSize?: number;

  // Point 4: Corner VIP
  isVipCorner?: boolean; // Éligible et affiché dans le Corner VIP sans frais

  price: number; // in FCFA (XAF)
  priceMax?: number; // Point 1: Tranche de salaire / prix (ex: 150 000 - 250 000 FCFA)
  priceUnit?: 'total' | 'mois' | 'jour' | 'heure' | 'trimestre' | 'an'; // ex: FCFA/mois, FCFA/trimestre, FCFA/an
  
  // Featured / Top-of-feed boost
  isFeatured?: boolean;
  featuredUntil?: string; // ISO string
  featuredAt?: string; // ISO string when boosted
  ownerTier?: SubscriptionTier;
  isOwnerVip?: boolean;
  isOwnerVerified?: boolean; // Trust badge signal, does not discriminate against unverified listings

  description: string; // limited character text (<= 1000 chars)
  images?: string[];
  videoUrl?: string;
  
  contactPhone: string; // Gabon telephone (+241 ...)
  hasWhatsapp?: boolean;
  contactName: string;
  
  // Expiration & Duration management
  durationDays: number;
  createdAt?: string; // ISO string
  publishedAt: string; // ISO string
  expiresAt: string; // ISO string
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'REJECTED' | 'SUSPENDED';
  moderationReason?: string;
  moderatedAt?: string;
  suspensionReason?: string; // Ex: 'FORFAIT_EXPIRE_QUOTA'
  suspendedAt?: string;
  userId?: string; // Links ad to the authenticated phone user
  isTest?: boolean; // Flag to identify test or demo ads
  
  // Payment information
  paidAmount: number;
  paymentMethod?: PaymentOperator;
  transactionRef?: string;
  viewsCount: number;
  reportsCount?: number;

  // Extension request filed by the advertiser, applied by an admin after payment check
  pendingExtension?: {
    days: number;
    operator: PaymentOperator;
    transactionRef: string;
    requestedAt: string;
  };
}

export type SubscriptionTier = 'STANDARD' | 'PRO' | 'ELITE' | 'BUSINESS';
export type BoosterPackType = 'BOOST_5' | 'BOOST_10';
export type AdPackType = 'PACK_5' | 'PACK_10';
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserProfile {
  id: string;
  contactPhone?: string; // Gabon format: +241 XX XX XX XX
  phoneNumber?: string;
  name: string;
  operator: 'AIRTEL' | 'MOOV';
  isVerified: boolean;
  termsAccepted: boolean;
  termsAcceptedAt: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'SUPER ADMIN' | string;
  createdAt: string;

  // Subscription & Boosters
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string;
  subscriptionStartedAt?: string;
  freeBoostsRemaining?: number; // max 20 per user
  consumedFreeAdsCount?: number; // Count of free ads consumed under subscription/plan
  activePack?: AdPackType;
  activeBoosterPack?: BoosterPackType;

  // Exemption from payment & KYC (VIP / Partenaires)
  exemptFromPaymentAndKyc?: boolean;
  isExempt?: boolean;

  // KYC Identity verification (compulsory for standard users)
  idDocumentUrl?: string;
  idDocumentType?: 'CNI' | 'CARTE_SEJOUR' | 'PASSPORT';
  idVerificationStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  idRejectionReason?: string;
  idSubmittedAt?: string;
  // Password & Security
  password?: string;
  lastPasswordChangeDate?: string; // ISO string to enforce 1 change per 24h
  location?: {
    province?: string;
    city?: string;
    neighborhood?: string;
  };
  favoriteAdIds?: string[];
  seenNotificationIds?: string[];
}

export const isUserSuperAdmin = (user?: { role?: string; isSuperAdmin?: boolean } | null): boolean => {
  if (!user) return false;
  if ((user as any).isSuperAdmin === true) return true;
  if (!user.role) return false;
  const normalized = String(user.role).trim().toUpperCase().replace(/[\s_-]+/g, '');
  return normalized === 'SUPERADMIN';
};

export const isUserAdmin = (user?: { role?: string; isAdmin?: boolean; isSuperAdmin?: boolean } | null): boolean => {
  if (!user) return false;
  if ((user as any).isAdmin === true || (user as any).isSuperAdmin === true) return true;
  if (!user.role) return false;
  const normalized = String(user.role).trim().toUpperCase().replace(/[\s_-]+/g, '');
  return normalized === 'SUPERADMIN' || normalized === 'ADMIN';
};

export const getTierPriority = (ad: { isOwnerVip?: boolean; ownerTier?: SubscriptionTier }): number => {
  if (ad.isOwnerVip) return 5;
  if (ad.ownerTier === 'BUSINESS') return 4;
  if (ad.ownerTier === 'ELITE') return 3;
  if (ad.ownerTier === 'PRO') return 2;
  return 1;
};

export interface AdReport {
  id: string;
  adId: string;
  adTitle: string;
  adCategory?: string;
  adPrice?: number;
  adOwnerPhone?: string;
  adOwnerName?: string;
  reason: string;
  details: string;
  reporterPhone?: string;
  createdAt: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface ModerationLog {
  id: string;
  adId: string;
  adTitle: string;
  action: 'APPROVED' | 'REJECTED' | 'EXTENDED' | 'DELETED';
  reason?: string;
  timestamp: string;
  moderatorName: string;
}

export interface GabonProvince {
  name: string;
  code: string;
  capital: string;
  cities: {
    name: string;
    neighborhoods: string[];
  }[];
}

export interface PricingPlan {
  basePerDay: number;
  additionalImagePrice: number;
  videoPrice: number;
}
