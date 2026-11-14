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
  PropertyType,
  RollingStockCategory,
  TransactionType,
  TutoringAdKind,
  TutoringLevel,
  TutoringSubject,
} from '../../types';
import { toE164 } from '../../utils/phone';

export interface BuildAdPayloadParams {
  id: string;
  title: string;
  mainCategory: MainCategory;
  transactionType: TransactionType;
  jobKind?: JobAdKind;
  propertyType?: PropertyType;
  province: string;
  city: string;
  neighborhood: string;
  vehicleCategory?: RollingStockCategory;
  vehicleBrand?: string;
  vehicleModel?: string;
  bricCategory?: BricABracCategory;
  domesticJobType?: DomesticJobType;
  tutoringKind?: TutoringAdKind;
  tutoringSubject?: TutoringSubject;
  tutoringLevel?: TutoringLevel;
  necroMinistry?: NecrologieMinistry;
  necroDeceasedName?: string;
  necroCeremonyDate?: string;
  necroCeremonyLocation?: string;
  necroFuneralProgram?: string;
  necroFamilyContact?: string;
  avisCategory?: AvisRechercheCategory;
  avisTargetName?: string;
  avisLastSeenDate?: string;
  avisLastSeenLocation?: string;
  avisEmergencyContact?: string;
  avisRewardAmount?: number | '';
  eventType?: EventType;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventOrganizer?: string;
  eventDressCode?: string;
  autresEmploisSubCategory?: AutresEmploisSubCategory;
  autresEmploisProfession?: string;
  autresEmploisContractType?: string;
  autresEmploisExperience?: string;
  cvUrl?: string;
  cvFileName?: string;
  cvFileType?: string;
  cvFileSize?: number;
  price: number | '';
  priceMax?: number | '';
  priceUnit: 'total' | 'mois' | 'jour' | 'trimestre' | 'an' | 'heure';
  description: string;
  images: string[];
  videoUrl?: string;
  contactPhone: string;
  contactName: string;
  durationDays: number;
  createdAt: string;
  userId?: string;
  paymentReference?: string;
}

/**
 * Construit un objet Ad canonique, rigoureusement conforme à la structure attendue
 * par le schéma Firestore et la règle de sécurité /ads.
 */
export function buildAdPayload(params: BuildAdPayloadParams): Ad {
  const isDemandeurEmploi =
    params.autresEmploisSubCategory === "Demandeur d'emploi" ||
    (params.autresEmploisSubCategory as any) === 'DEMANDE_EMPLOI';

  const defaultTitle = `${params.transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${params.mainCategory}`;
  const finalTitle = (params.title || defaultTitle).trim().slice(0, 120);

  const finalTransactionType: TransactionType =
    params.mainCategory === 'IMMOBILIER' || params.mainCategory === 'MATERIEL_ROULANT'
      ? params.transactionType
      : params.mainCategory === 'EMPLOI'
      ? params.jobKind === 'DEMANDE_EMPLOI'
        ? 'CHERCHE_EMPLOI'
        : 'EMPLOYER'
      : params.mainCategory === 'AUTRES_EMPLOIS'
      ? isDemandeurEmploi
        ? 'CHERCHE_EMPLOI'
        : 'EMPLOYER'
      : 'VENTE';

  const numPrice = Number(params.price) || 0;
  const numPriceMax =
    (params.mainCategory === 'EMPLOI' || params.mainCategory === 'AUTRES_EMPLOIS') &&
    params.priceMax !== '' &&
    params.priceMax !== undefined &&
    Number(params.priceMax) > numPrice
      ? Number(params.priceMax)
      : undefined;

  return {
    id: params.id,
    title: finalTitle,
    mainCategory: params.mainCategory,
    transactionType: finalTransactionType,
    jobKind: params.mainCategory === 'EMPLOI' ? params.jobKind : undefined,
    propertyType: params.mainCategory === 'IMMOBILIER' ? params.propertyType : undefined,
    location: {
      province: params.province,
      city: params.city,
      neighborhood: params.neighborhood,
    },
    vehicleData:
      params.mainCategory === 'MATERIEL_ROULANT'
        ? {
            category: params.vehicleCategory || 'Voitures',
            brand:
              params.vehicleCategory === 'Voitures' || params.vehicleCategory === 'Camions Bennes'
                ? params.vehicleBrand
                : undefined,
            model: params.vehicleCategory === 'Voitures' ? params.vehicleModel : undefined,
          }
        : undefined,
    bricCategory: params.mainCategory === 'BRIC_A_BRAC' ? params.bricCategory : undefined,
    domesticJobType: params.mainCategory === 'EMPLOI' ? params.domesticJobType : undefined,
    tutoringData:
      params.mainCategory === 'COURS_A_DOMICILE'
        ? {
            kind: params.tutoringKind || 'OFFRE',
            subject: params.tutoringSubject || 'Mathématiques',
            level: params.tutoringLevel || 'Tous niveaux',
          }
        : undefined,
    necrologieData:
      params.mainCategory === 'NECROLOGIE'
        ? {
            ministry: params.necroMinistry || 'Éducation nationale',
            deceasedName: params.necroDeceasedName || '',
            ceremonyDate: params.necroCeremonyDate || '',
            ceremonyLocation: params.necroCeremonyLocation || '',
            funeralProgram: params.necroFuneralProgram || '',
            familyContact: params.necroFamilyContact || '',
          }
        : undefined,
    avisRechercheData:
      params.mainCategory === 'AVIS_DE_RECHERCHE'
        ? {
            category: params.avisCategory || 'Personne disparue',
            targetName: params.avisTargetName || '',
            lastSeenDate: params.avisLastSeenDate || '',
            lastSeenLocation: params.avisLastSeenLocation || '',
            contactEmergency: params.avisEmergencyContact || '',
            rewardAmount: Number(params.avisRewardAmount) || undefined,
          }
        : undefined,
    eventData:
      params.mainCategory === 'EVENEMENTS'
        ? {
            eventType: params.eventType || 'Mariage',
            eventDate: params.eventDate || '',
            eventTime: params.eventTime || undefined,
            venue: params.eventVenue?.trim() || undefined,
            organizer: params.eventOrganizer?.trim() || undefined,
            dressCode: params.eventDressCode?.trim() || undefined,
          }
        : undefined,
    autresEmploisData:
      params.mainCategory === 'AUTRES_EMPLOIS'
        ? {
            subCategory: params.autresEmploisSubCategory || "Demandeur d'emploi",
            profession: params.autresEmploisProfession || '',
            contractType: (params.autresEmploisContractType as any) || 'CDI',
            experienceYears: params.autresEmploisExperience || '',
            cvUrl: isDemandeurEmploi ? params.cvUrl : undefined,
            cvFileName: isDemandeurEmploi ? params.cvFileName : undefined,
            cvFileType: isDemandeurEmploi ? params.cvFileType : undefined,
            cvFileSize: isDemandeurEmploi ? params.cvFileSize : undefined,
            jobDocUrl: !isDemandeurEmploi ? params.cvUrl : undefined,
            jobDocFileName: !isDemandeurEmploi ? params.cvFileName : undefined,
            jobDocFileType: !isDemandeurEmploi ? params.cvFileType : undefined,
            jobDocFileSize: !isDemandeurEmploi ? params.cvFileSize : undefined,
          }
        : undefined,
    cvUrl: params.cvUrl,
    cvFileName: params.cvFileName || undefined,
    cvFileType: params.cvFileType || undefined,
    cvFileSize: params.cvFileSize || undefined,
    jobDocUrl: !isDemandeurEmploi ? params.cvUrl : undefined,
    jobDocFileName: !isDemandeurEmploi ? params.cvFileName : undefined,
    jobDocFileType: !isDemandeurEmploi ? params.cvFileType : undefined,
    jobDocFileSize: !isDemandeurEmploi ? params.cvFileSize : undefined,
    price: params.mainCategory === 'NECROLOGIE' || params.mainCategory === 'AVIS_DE_RECHERCHE' ? 0 : numPrice,
    priceMax: numPriceMax,
    priceUnit: params.priceUnit,
    description: params.description || 'Annonce vérifiée et publiée sur BIZBOOSTER Gabon.',
    images: params.images,
    videoUrl: params.videoUrl,
    contactPhone: toE164(params.contactPhone.trim()),
    hasWhatsapp: true,
    contactName: params.contactName || 'Annonceur BIZBOOSTER',
    durationDays: params.durationDays,
    createdAt: params.createdAt,
    status: 'PENDING_REVIEW',
    userId: params.userId,
    paymentReference: params.paymentReference,
  };
}

