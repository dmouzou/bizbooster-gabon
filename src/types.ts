export type MainCategory = 'IMMOBILIER' | 'MATERIEL_ROULANT' | 'BRIC_A_BRAC' | 'EMPLOI';

export type TransactionType = 'VENTE' | 'LOCATION';

export type PropertyType = 
  | 'Villa'
  | 'Maison'
  | 'Appartement'
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
  // Detail explicitly required: L'annonceur doit pouvoir préciser s'il vend ou s'il loue son bien
  transactionType?: TransactionType; // For Immobilier & Matériel Roulant (Vente or Location)
  
  // Specific Category Data
  propertyType?: PropertyType;
  location?: LocationHierarchy; // For Immobilier and general
  
  vehicleData?: VehicleHierarchy; // For Matériel Roulant
  bricCategory?: BricABracCategory; // For Bric-à-Brac
  domesticJobType?: DomesticJobType; // For Emploi
  
  price: number; // in FCFA (XAF)
  priceUnit?: 'total' | 'mois' | 'jour' | 'heure' | 'trimestre' | 'an'; // ex: FCFA/mois, FCFA/trimestre, FCFA/an
  
  // Featured / Top-of-feed boost
  isFeatured?: boolean;
  featuredUntil?: string; // ISO string

  description: string; // limited character text (<= 300 chars)
  images: string[];
  videoUrl?: string;
  
  contactPhone: string; // Gabon telephone (+241 ...)
  hasWhatsapp?: boolean;
  contactName: string;
  
  // Expiration & Duration management
  durationDays: number;
  publishedAt: string; // ISO string
  expiresAt: string; // ISO string
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'REJECTED';
  moderationReason?: string;
  moderatedAt?: string;
  userId?: string; // Links ad to the authenticated phone user
  
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

export interface UserProfile {
  id: string;
  contactPhone?: string; // Gabon format: +241 XX XX XX XX
  phoneNumber?: string;
  name: string;
  operator: 'AIRTEL' | 'MOOV';
  isVerified: boolean;
  termsAccepted: boolean;
  termsAcceptedAt: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;

  // Subscription & Boosters
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string;
  freeBoostsRemaining?: number; // max 20 per user
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
  idVerifiedAt?: string;
}

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
