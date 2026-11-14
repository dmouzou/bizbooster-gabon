import {
  Ad,
  AvisRechercheCategory,
  EventType,
  AutresEmploisSubCategory,
  BricABracCategory,
  DomesticJobType,
  JobAdKind,
  MainCategory,
  NecrologieMinistry,
  PriceUnit,
  PropertyType,
  RollingStockCategory,
  SubscriptionTier,
  TransactionType,
  TutoringAdKind,
  TutoringLevel,
  TutoringSubject,
  UserProfile,
} from '../../types';

export type PublishStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PhotoMediaItem {
  id: string;
  url: string;
  file?: File;
  name?: string;
  size?: number;
}

export interface PublishFormState {
  // Step 1: Catégorie & Localisation
  mainCategory: MainCategory;
  transactionType: TransactionType;
  propertyType: PropertyType;
  province: string;
  city: string;
  neighborhood: string;
  saveNeighborhoodToProfile: boolean;

  // Catégories spécifiques
  vehicleCategory: RollingStockCategory;
  vehicleBrand: string;
  vehicleModel: string;
  bricCategory: BricABracCategory;
  domesticJobType: DomesticJobType;
  jobKind: JobAdKind;
  tutoringKind: TutoringAdKind;
  tutoringSubject: TutoringSubject;
  tutoringLevel: TutoringLevel;
  necroMinistry: NecrologieMinistry;
  necroDeceasedName: string;
  necroCeremonyDate: string;
  necroCeremonyLocation: string;
  necroFuneralProgram: string;
  necroFamilyContact: string;
  avisCategory: AvisRechercheCategory;
  avisTargetName: string;
  avisLastSeenDate: string;
  avisLastSeenLocation: string;
  avisHasReward: boolean;
  avisRewardAmount: number | '';
  avisEmergencyContact: string;
  eventType: EventType;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventOrganizer: string;
  eventDressCode: string;
  autresEmploisSubCategory: AutresEmploisSubCategory;
  autresEmploisProfession: string;
  autresEmploisContractType: string;
  autresEmploisExperience: string;

  // Step 2: Photos & Médias
  photos: PhotoMediaItem[];
  hasVideo: boolean;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  videoDuration: number | null;
  cvFile: File | null;
  cvDataUrl: string;
  cvFileName: string;
  cvFileType: string;
  cvFileSize: number;

  // Step 3: Détails
  title: string;
  description: string;
  contactName: string;
  contactPhone: string;
  phoneChoice: 'ACCOUNT' | 'CUSTOM';

  // Step 4: Prix & Durée
  price: number | '';
  priceMax: number | '';
  priceUnit: PriceUnit;
  durationDays: number;
  isBoostFeatured: boolean;
}

export interface SavedDraftState extends Partial<PublishFormState> {
  savedAt: string;
  step: PublishStep;
}
