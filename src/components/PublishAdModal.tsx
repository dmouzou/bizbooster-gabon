import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Trash2,
  Loader2,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, collection } from 'firebase/firestore';
import { storage, auth, db } from '../services/firebase';
import { previewQuote, PreviewQuoteResult } from '../services/singpay';
import { AppAlertModal, AlertModalConfig } from './AppAlertModal';
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
  PaymentOperator,
  PriceUnit,
  PropertyType,
  RollingStockCategory,
  TransactionType,
  TutoringAdKind,
  TutoringLevel,
  TutoringSubject,
  UserProfile,
} from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';
import { compressImageForUpload } from '../utils/imageCompressor';
import { isAdVipCornerEligible } from '../utils/vipCorner';
import { validateEventSchedule } from '../utils/eventValidation';
import { CguModal } from './CguModal';
import { PublishHeader } from '../features/publish/components/PublishHeader';
import { PublishFooter } from '../features/publish/components/PublishFooter';
import { Step1Category } from '../features/publish/components/Step1Category';
import { Step2Photos } from '../features/publish/components/Step2Photos';
import { Step3Details } from '../features/publish/components/Step3Details';
import { Step4Pricing } from '../features/publish/components/Step4Pricing';
import { Step5Preview } from '../features/publish/components/Step5Preview';
import { Step6Payment } from '../features/publish/components/Step6Payment';
import { Step7Confirmation } from '../features/publish/components/Step7Confirmation';
import { PhotoMediaItem, PublishStep } from '../features/publish/publishTypes';
import { getMaxPhotosAllowed } from '../features/publish/schemas/types';
import { buildAdPayload } from '../features/publish/payloadBuilder';

export interface PublishAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdPublished: (newAd: Ad) => void | Promise<void>;
  currentUser?: UserProfile | null;
  onSwitchToAdmin?: () => void;
  onSwitchToUserDashboard?: () => void;
  userAds?: Ad[];
  onUpdateUser?: (updated: Partial<UserProfile>) => Promise<void>;
}

async function uploadAdImage(file: File): Promise<string> {
  const { blob, mimeType } = await compressImageForUpload(file);
  const cleanName = file.name.replace(/\.[^/.]+$/, '');
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const uid = auth.currentUser?.uid || 'user';
  const path = `ads/${uid}/${Date.now()}_${cleanName}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: mimeType,
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(storageRef);
}

async function uploadRawFile(file: File, folder: 'cvs' | 'videos'): Promise<string> {
  const uid = auth.currentUser?.uid || 'user';
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${uid}/${Date.now()}_${cleanName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || (folder === 'videos' ? 'video/mp4' : 'application/pdf'),
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(storageRef);
}

const PublishAdModalContent: React.FC<PublishAdModalProps> = ({
  isOpen,
  onClose,
  onAdPublished,
  currentUser,
  onSwitchToUserDashboard,
  userAds,
  onUpdateUser,
}) => {
  // Wizard Steps:
  // 1 = Catégorie & Localisation
  // 2 = Photos & Médias
  // 3 = Détails & Caractéristiques
  // 4 = Prix & Durée
  // 5 = Aperçu
  // 6 = Paiement & Facturation
  // 7 = Confirmation
  const [step, setStep] = useState<PublishStep>(1);
  const [alertModalConfig, setAlertModalConfig] = useState<AlertModalConfig | null>(null);

  const isExempt = Boolean(currentUser?.exemptFromPaymentAndKyc || currentUser?.isExempt);
  const isOwnerVerified =
    currentUser?.idVerificationStatus === 'VERIFIED' ||
    !!currentUser?.idVerifiedAt ||
    (!!currentUser?.idDocumentUrl &&
      currentUser?.idVerificationStatus !== 'REJECTED' &&
      currentUser?.idVerificationStatus !== 'PENDING');

  // Form State
  const [mainCategory, setMainCategory] = useState<MainCategory>('IMMOBILIER');
  const [transactionType, setTransactionType] = useState<TransactionType>('LOCATION');

  const profileNeighborhood = currentUser?.location?.neighborhood?.trim() || '';
  const profileProvince = currentUser?.location?.province?.trim() || '';
  const profileCity = currentUser?.location?.city?.trim() || '';
  const accountRegisteredPhone = (currentUser?.contactPhone || currentUser?.phoneNumber || '').trim();

  // Immobilier
  const [propertyType, setPropertyType] = useState<PropertyType>('Villa');
  const [province, setProvince] = useState<string>(profileProvince || 'Estuaire');
  const [city, setCity] = useState<string>(profileCity || 'Libreville');
  const [neighborhood, setNeighborhood] = useState<string>(profileNeighborhood || '');
  const [saveNeighborhoodToProfile, setSaveNeighborhoodToProfile] = useState<boolean>(false);

  // Matériel Roulant
  const [vehicleCategory, setVehicleCategory] = useState<RollingStockCategory>('Voitures');
  const [vehicleBrand, setVehicleBrand] = useState<string>('TOYOTA');
  const [vehicleModel, setVehicleModel] = useState<string>('Hilux');

  // Bric-à-Brac
  const [bricCategory, setBricCategory] = useState<BricABracCategory>('Électronique & Smartphones');

  // Emploi
  const [domesticJobType, setDomesticJobType] = useState<DomesticJobType>('Nounous (garde-bébé)');
  const [jobKind, setJobKind] = useState<JobAdKind>('OFFRE_EMPLOI');

  // Cours à Domicile
  const [tutoringKind, setTutoringKind] = useState<TutoringAdKind>('OFFRE');
  const [tutoringSubject, setTutoringSubject] = useState<TutoringSubject>('Mathématiques');
  const [tutoringLevel, setTutoringLevel] = useState<TutoringLevel>('Tous niveaux');

  // Nécrologie
  const [necroMinistry, setNecroMinistry] = useState<NecrologieMinistry>('Éducation nationale');
  const [necroDeceasedName, setNecroDeceasedName] = useState<string>('');
  const [necroCeremonyDate, setNecroCeremonyDate] = useState<string>('');
  const [necroCeremonyLocation, setNecroCeremonyLocation] = useState<string>('');
  const [necroFuneralProgram, setNecroFuneralProgram] = useState<string>('');
  const [necroFamilyContact, setNecroFamilyContact] = useState<string>('');

  // Avis de recherche
  const [avisCategory, setAvisCategory] = useState<AvisRechercheCategory>('Personne disparue');
  const [avisTargetName, setAvisTargetName] = useState<string>('');
  const [avisLastSeenDate, setAvisLastSeenDate] = useState<string>('');
  const [avisLastSeenLocation, setAvisLastSeenLocation] = useState<string>('');
  const [avisHasReward, setAvisHasReward] = useState<boolean>(false);
  const [avisRewardAmount, setAvisRewardAmount] = useState<number | ''>('');
  const [avisEmergencyContact, setAvisEmergencyContact] = useState<string>('');

  // Événements
  const [eventType, setEventType] = useState<EventType>('Mariage');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventTime, setEventTime] = useState<string>('');
  const [eventVenue, setEventVenue] = useState<string>('');
  const [eventOrganizer, setEventOrganizer] = useState<string>('');
  const [eventDressCode, setEventDressCode] = useState<string>('');

  // Autres Emplois
  const [autresEmploisSubCategory, setAutresEmploisSubCategory] =
    useState<AutresEmploisSubCategory>("Demandeur d'emploi");
  const [autresEmploisProfession, setAutresEmploisProfession] = useState<string>('');
  const [autresEmploisContractType, setAutresEmploisContractType] = useState<string>('CDI');
  const [autresEmploisExperience, setAutresEmploisExperience] = useState<string>('');

  // CV
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvDataUrl, setCvDataUrl] = useState<string>('');
  const [cvFileName, setCvFileName] = useState<string>('');
  const [cvFileType, setCvFileType] = useState<string>('');
  const [cvFileSize, setCvFileSize] = useState<number>(0);

  // Content fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [priceMax, setPriceMax] = useState<number | ''>('');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('mois');
  const [description, setDescription] = useState('');

  const [preGeneratedAdId] = useState<string>(() => doc(collection(db, 'ads')).id);

  // Boost
  const [isBoostFeatured, setIsBoostFeatured] = useState(false);

  // Photos & Médias
  const [photos, setPhotos] = useState<PhotoMediaItem[]>([]);
  const [hasVideo, setHasVideo] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Contact
  const [contactName, setContactName] = useState(currentUser?.name || '');
  const [contactPhone, setContactPhone] = useState(accountRegisteredPhone || '');
  const [durationDays, setDurationDays] = useState<number>(30);

  // Status & Progress
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [createdAd, setCreatedAd] = useState<Ad | null>(null);
  const [showCguModal, setShowCguModal] = useState(false);

  const modalBodyRef = useRef<HTMLDivElement>(null);
  const hasHandledPaymentSuccessRef = useRef(false);
  const createdObjectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      createdObjectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      createdObjectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [step]);

  // Draft Management
  const DRAFT_STORAGE_KEY = `bizbooster_publish_draft_${currentUser?.id || 'guest'}`;
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [existingDraft, setExistingDraft] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.savedAt) {
          setExistingDraft(parsed);
          setShowDraftPrompt(true);
        }
      }
    } catch (e) {
      console.warn('Error reading draft from localStorage:', e);
    }
  }, [isOpen, DRAFT_STORAGE_KEY]);

  const handleResumeDraft = () => {
    if (!existingDraft) return;
    if (existingDraft.step && existingDraft.step <= 6) setStep(existingDraft.step as PublishStep);
    if (existingDraft.mainCategory) setMainCategory(existingDraft.mainCategory);
    if (existingDraft.transactionType) setTransactionType(existingDraft.transactionType);
    if (existingDraft.propertyType) setPropertyType(existingDraft.propertyType);
    if (existingDraft.province) setProvince(existingDraft.province);
    if (existingDraft.city) setCity(existingDraft.city);
    if (existingDraft.neighborhood) setNeighborhood(existingDraft.neighborhood);
    if (existingDraft.vehicleCategory) setVehicleCategory(existingDraft.vehicleCategory);
    if (existingDraft.vehicleBrand) setVehicleBrand(existingDraft.vehicleBrand);
    if (existingDraft.vehicleModel) setVehicleModel(existingDraft.vehicleModel);
    if (existingDraft.bricCategory) setBricCategory(existingDraft.bricCategory);
    if (existingDraft.domesticJobType) setDomesticJobType(existingDraft.domesticJobType);
    if (existingDraft.jobKind) setJobKind(existingDraft.jobKind);
    if (existingDraft.tutoringKind) setTutoringKind(existingDraft.tutoringKind);
    if (existingDraft.tutoringSubject) setTutoringSubject(existingDraft.tutoringSubject);
    if (existingDraft.tutoringLevel) setTutoringLevel(existingDraft.tutoringLevel);
    if (existingDraft.necroMinistry) setNecroMinistry(existingDraft.necroMinistry);
    if (existingDraft.necroDeceasedName) setNecroDeceasedName(existingDraft.necroDeceasedName);
    if (existingDraft.necroCeremonyDate) setNecroCeremonyDate(existingDraft.necroCeremonyDate);
    if (existingDraft.necroCeremonyLocation) setNecroCeremonyLocation(existingDraft.necroCeremonyLocation);
    if (existingDraft.necroFuneralProgram) setNecroFuneralProgram(existingDraft.necroFuneralProgram);
    if (existingDraft.necroFamilyContact) setNecroFamilyContact(existingDraft.necroFamilyContact);
    if (existingDraft.eventType) setEventType(existingDraft.eventType);
    if (existingDraft.eventDate) setEventDate(existingDraft.eventDate);
    if (existingDraft.eventTime) setEventTime(existingDraft.eventTime);
    if (existingDraft.eventVenue) setEventVenue(existingDraft.eventVenue);
    if (existingDraft.eventOrganizer) setEventOrganizer(existingDraft.eventOrganizer);
    if (existingDraft.eventDressCode) setEventDressCode(existingDraft.eventDressCode);
    if (existingDraft.title !== undefined) setTitle(existingDraft.title);
    if (existingDraft.price !== undefined) setPrice(existingDraft.price);
    if (existingDraft.priceUnit) setPriceUnit(existingDraft.priceUnit);
    if (existingDraft.description !== undefined) setDescription(existingDraft.description);
    if (existingDraft.photos && existingDraft.photos.length > 0) {
      setPhotos(existingDraft.photos);
    }
    if (existingDraft.hasVideo !== undefined) setHasVideo(existingDraft.hasVideo);
    if (existingDraft.videoPreviewUrl) setVideoPreviewUrl(existingDraft.videoPreviewUrl);
    if (existingDraft.videoDuration !== undefined) setVideoDuration(existingDraft.videoDuration);
    if (existingDraft.contactName) setContactName(existingDraft.contactName);
    if (existingDraft.contactPhone) setContactPhone(existingDraft.contactPhone);
    if (existingDraft.durationDays) setDurationDays(existingDraft.durationDays);
    if (existingDraft.isBoostFeatured !== undefined) setIsBoostFeatured(existingDraft.isBoostFeatured);
    setShowDraftPrompt(false);
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing draft:', e);
    }
    setExistingDraft(null);
    setShowDraftPrompt(false);
    setStep(1);
    setMainCategory('IMMOBILIER');
    setTransactionType('LOCATION');
    setPropertyType('Villa');
    setProvince('Estuaire');
    setCity('Libreville');
    setNeighborhood(profileNeighborhood || '');
    setVehicleCategory('Voitures');
    setVehicleBrand('TOYOTA');
    setVehicleModel('Hilux');
    setBricCategory('Électronique & Smartphones');
    setDomesticJobType('Nounous (garde-bébé)');
    setJobKind('OFFRE_EMPLOI');
    setTutoringKind('OFFRE');
    setTutoringSubject('Mathématiques');
    setTutoringLevel('Tous niveaux');
    setNecroMinistry('Éducation nationale');
    setNecroDeceasedName('');
    setNecroCeremonyDate('');
    setNecroCeremonyLocation('');
    setNecroFuneralProgram('');
    setNecroFamilyContact('');
    setTitle('');
    setPrice('');
    setPriceUnit('mois');
    setDescription('');
    setPhotos([]);
    setHasVideo(false);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setContactName(currentUser?.name || '');
    setContactPhone(currentUser?.contactPhone || '');
    setDurationDays(30);
    setIsBoostFeatured(false);
    setMediaError(null);
  };

  // Auto-save draft on form change (Debounced 600ms)
  useEffect(() => {
    if (!isOpen || showDraftPrompt || step >= 7) return;
    const timer = setTimeout(() => {
      try {
        const draftObj = {
          savedAt: new Date().toISOString(),
          step,
          mainCategory,
          transactionType,
          propertyType,
          province,
          city,
          neighborhood,
          vehicleCategory,
          vehicleBrand,
          vehicleModel,
          bricCategory,
          domesticJobType,
          jobKind,
          tutoringKind,
          tutoringSubject,
          tutoringLevel,
          necroMinistry,
          necroDeceasedName,
          necroCeremonyDate,
          necroCeremonyLocation,
          necroFuneralProgram,
          necroFamilyContact,
          eventType,
          eventDate,
          eventTime,
          eventVenue,
          eventOrganizer,
          eventDressCode,
          title,
          price,
          priceUnit,
          description,
          photos: photos
            .filter((p) => p.url && !p.url.startsWith('blob:') && !p.url.startsWith('data:'))
            .map((p) => ({ id: p.id, url: p.url, name: p.name, size: p.size })),
          hasVideo,
          videoPreviewUrl: videoPreviewUrl && !videoPreviewUrl.startsWith('blob:') ? videoPreviewUrl : null,
          videoDuration,
          contactName,
          contactPhone,
          durationDays,
          isBoostFeatured,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftObj));
      } catch (err) {
        console.warn('Auto-save draft error:', err);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    showDraftPrompt,
    step,
    mainCategory,
    transactionType,
    propertyType,
    province,
    city,
    neighborhood,
    vehicleCategory,
    vehicleBrand,
    vehicleModel,
    bricCategory,
    domesticJobType,
    jobKind,
    tutoringKind,
    tutoringSubject,
    tutoringLevel,
    necroMinistry,
    necroDeceasedName,
    necroCeremonyDate,
    necroCeremonyLocation,
    necroFuneralProgram,
    necroFamilyContact,
    eventType,
    eventDate,
    eventTime,
    eventVenue,
    eventOrganizer,
    eventDressCode,
    title,
    price,
    priceUnit,
    description,
    photos,
    hasVideo,
    videoPreviewUrl,
    videoDuration,
    contactName,
    contactPhone,
    durationDays,
    isBoostFeatured,
    DRAFT_STORAGE_KEY,
  ]);

  // Quotas calculations
  const userSimultaneousAds = useMemo(() => {
    if (!userAds || !currentUser) return [];
    const now = Date.now();
    return userAds.filter(
      (a) =>
        (a.userId === currentUser.id || !a.userId) &&
        a.status !== 'REJECTED' &&
        a.status !== 'EXPIRED' &&
        (!a.expiresAt || new Date(a.expiresAt).getTime() > now)
    );
  }, [userAds, currentUser]);

  const simultaneousAdsCount = userSimultaneousAds.length;

  const maxQuota = useMemo(() => {
    if (isExempt) return 10;
    if (currentUser?.subscriptionTier === 'BUSINESS') return 10;
    if (currentUser?.subscriptionTier === 'ELITE') return 7;
    if (currentUser?.subscriptionTier === 'PRO') return 4;
    return 3;
  }, [currentUser?.subscriptionTier, isExempt]);

  const isUltimateCeilingReached = simultaneousAdsCount >= 10;
  const requiresSubscription = useMemo(() => {
    if (isExempt) return false;
    return simultaneousAdsCount >= maxQuota && maxQuota < 10;
  }, [isExempt, simultaneousAdsCount, maxQuota]);

  const selectedTierToBuy: 'PRO' | 'ELITE' | 'BUSINESS' = 'PRO';

  // Live Devis preview
  const [serverQuote, setServerQuote] = useState<PreviewQuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setServerQuote(null);
    setQuoteLoading(true);
    setQuoteError(null);

    const fetchQuote = async () => {
      try {
        const q = await previewQuote({
          productId: 'AD_PUBLISH',
          metadata: {
            adId: preGeneratedAdId,
            durationDays,
            photoCount: photos.length,
            hasVideo,
            withBoost: isBoostFeatured,
            requiresSubscription,
            selectedTierToBuy,
          },
        });
        if (!cancelled) setServerQuote(q);
      } catch (e: any) {
        if (!cancelled) {
          setQuoteError(e.message || 'Erreur lors du calcul du devis.');
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    };
    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [preGeneratedAdId, durationDays, photos.length, hasVideo, isBoostFeatured, requiresSubscription, selectedTierToBuy]);

  const quoteReady = isExempt || (serverQuote !== null && !quoteLoading && !quoteError);
  const totalBillCalculated = isExempt ? 0 : (serverQuote?.amount ?? 0);

  const isVipEligible = useMemo(() => {
    return isAdVipCornerEligible({
      mainCategory,
      transactionType,
      price: Number(price) || 0,
      priceUnit,
      propertyType,
      vehicleData: { category: vehicleCategory },
    });
  }, [mainCategory, transactionType, price, priceUnit, propertyType, vehicleCategory]);

  const handleMainCategoryChange = (cat: MainCategory) => {
    setMainCategory(cat);
    if (cat === 'IMMOBILIER') {
      setPriceUnit(transactionType === 'LOCATION' ? 'mois' : 'total');
    } else if (cat === 'MATERIEL_ROULANT') {
      setPriceUnit(transactionType === 'LOCATION' ? 'jour' : 'total');
    } else if (cat === 'EMPLOI') {
      setPriceUnit('mois');
      setTransactionType('EMPLOYER');
    } else if (cat === 'BRIC_A_BRAC') {
      setPriceUnit('total');
      setTransactionType('VENTE');
    } else if (cat === 'COURS_A_DOMICILE') {
      setPriceUnit('mois');
      setTransactionType('VENTE');
    } else if (cat === 'NECROLOGIE' || cat === 'AVIS_DE_RECHERCHE') {
      setPriceUnit('total');
      setPrice(0);
      setTransactionType('VENTE');
    } else if (cat === 'EVENEMENTS') {
      setPriceUnit('total');
      setPrice(0);
      setTransactionType('VENTE');
    } else if (cat === 'AUTRES_EMPLOIS') {
      setPriceUnit('mois');
      setTransactionType(
        (autresEmploisSubCategory === "Demandeur d'emploi" || (autresEmploisSubCategory as any) === 'DEMANDE_EMPLOI')
          ? 'CHERCHE_EMPLOI'
          : 'EMPLOYER'
      );
    } else {
      setPriceUnit('total');
    }
  };

  const handleCvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';

    const lowerName = file.name.toLowerCase();
    const isAllowedExt = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx') || lowerName.endsWith('.md');
    if (!isAllowedExt) {
      setMediaError('Format de CV non valide. Veuillez choisir un document au format .pdf, .docx ou .md.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setMediaError('Le document CV ne doit pas dépasser 15 Mo.');
      return;
    }

    setMediaError(null);
    setCvFile(file);
    setCvFileName(file.name);
    setCvFileSize(file.size);
    setCvFileType(lowerName.endsWith('.pdf') ? 'pdf' : lowerName.endsWith('.docx') ? 'docx' : 'md');

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setCvDataUrl((loadEvt.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCv = () => {
    setCvFile(null);
    setCvDataUrl('');
    setCvFileName('');
    setCvFileType('');
    setCvFileSize(0);
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_VIDEO_SIZE) {
      setMediaError(`La vidéo "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite de 50 Mo.`);
      return;
    }

    setMediaError(null);
    setVideoFile(file);
    const blobUrl = URL.createObjectURL(file);
    createdObjectUrlsRef.current.add(blobUrl);
    setVideoPreviewUrl(blobUrl);
    setHasVideo(true);

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      const dur = Math.round(tempVideo.duration);
      if (dur > 30) {
        setMediaError(`Attention : La durée de la vidéo (${dur}s) dépasse les 30s recommandées.`);
      }
      setVideoDuration(dur);
    };
    tempVideo.onerror = () => {
      setVideoDuration(null);
    };
    tempVideo.src = blobUrl;
  };

  const handleRemoveVideo = () => {
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setHasVideo(false);
    setMediaError(null);
  };

  const handleAutoGenerateTitle = () => {
    let genTitle = '';
    if (mainCategory === 'IMMOBILIER') {
      genTitle = `${transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${propertyType} à ${neighborhood || city}`;
    } else if (mainCategory === 'MATERIEL_ROULANT') {
      genTitle = `${transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${vehicleBrand} ${vehicleModel}`;
    } else if (mainCategory === 'BRIC_A_BRAC') {
      genTitle = `À Vendre - ${bricCategory}`;
    } else if (mainCategory === 'EMPLOI') {
      genTitle = `${jobKind === 'DEMANDE_EMPLOI' ? "Demande d'emploi" : "Offre d'emploi"} - ${domesticJobType}`;
    } else if (mainCategory === 'COURS_A_DOMICILE') {
      genTitle = `${tutoringKind === 'OFFRE' ? 'Cours à domicile' : 'Recherche cours'} - ${tutoringSubject} (${tutoringLevel})`;
    } else if (mainCategory === 'NECROLOGIE') {
      genTitle = `Nécrologie - ${necroDeceasedName || 'Avis de décès'} (${necroMinistry})`;
    } else if (mainCategory === 'AVIS_DE_RECHERCHE') {
      genTitle = `Avis de Recherche - ${avisCategory}: ${avisTargetName || 'Signalement'}`;
    } else if (mainCategory === 'EVENEMENTS') {
      genTitle = `${eventType} - ${eventVenue.trim() || 'Événement'}`;
    } else if (mainCategory === 'AUTRES_EMPLOIS') {
      genTitle = `${(autresEmploisSubCategory === "Demandeur d'emploi" || (autresEmploisSubCategory as any) === 'DEMANDE_EMPLOI') ? "Demandeur d'emploi" : "Offre d'emploi"} - ${autresEmploisProfession || 'Poste à pourvoir'}`;
    }
    setTitle(genTitle.slice(0, 120));
  };

  // Step Validation logic
  const handleNextStep = () => {
    setMediaError(null);

    // Étape 1 -> Étape 2
    if (step === 1) {
      if (isUltimateCeilingReached) return;
      if (mainCategory === 'EVENEMENTS') {
        const scheduleCheck = validateEventSchedule(eventDate, eventTime);
        if (!scheduleCheck.isValid) {
          setMediaError(scheduleCheck.error || "La date et l'heure de l'événement doivent être valides et dans le futur.");
          return;
        }
        if (!eventVenue.trim()) {
          setMediaError("Veuillez indiquer le lieu de l'événement (salle, établissement ou adresse).");
          return;
        }
      }
      if (!neighborhood.trim()) {
        setMediaError('Veuillez préciser ou détailler le quartier de votre bien ou service.');
        return;
      }
      setStep(2);
      return;
    }

    // Étape 2 -> Étape 3
    if (step === 2) {
      const isDemandeurEmploi =
        mainCategory === 'AUTRES_EMPLOIS' &&
        (autresEmploisSubCategory === "Demandeur d'emploi" || (autresEmploisSubCategory as any) === 'DEMANDE_EMPLOI');

      if (isDemandeurEmploi && !cvFile && !cvDataUrl) {
        setMediaError("L'attachement d'un CV (.pdf, .docx ou .md) est obligatoire pour les demandeurs d'emploi.");
        return;
      }

      if (hasVideo && !videoFile && !videoPreviewUrl) {
        setMediaError("Vous avez activé l'option vidéo. Veuillez sélectionner un fichier vidéo ou désactiver l'option.");
        return;
      }

      const hasAttachedJobDoc = mainCategory === 'AUTRES_EMPLOIS' && (cvFile || cvDataUrl);
      if (!isDemandeurEmploi && !hasAttachedJobDoc && photos.length === 0) {
        setMediaError('Veuillez ajouter au moins une photo pour votre annonce (ou joindre la fiche de poste).');
        return;
      }

      const maxPhotos = getMaxPhotosAllowed(currentUser?.subscriptionTier);
      if (photos.length > maxPhotos) {
        setMediaError(`Votre forfait autorise au maximum ${maxPhotos} photos.`);
        return;
      }

      setStep(3);
      return;
    }

    // Étape 3 -> Étape 4
    if (step === 3) {
      if (!contactName.trim()) {
        setMediaError('Veuillez renseigner votre nom ou le nom de votre agence.');
        return;
      }

      if (!contactPhone.trim()) {
        setMediaError('Veuillez renseigner un contact téléphonique valide au Gabon.');
        return;
      }

      if (mainCategory === 'NECROLOGIE' && !necroDeceasedName.trim()) {
        setMediaError('Veuillez renseigner le nom complet du défunt pour cet avis nécrologique.');
        return;
      }

      if (mainCategory === 'AVIS_DE_RECHERCHE' && !avisTargetName.trim()) {
        setMediaError('Veuillez préciser le nom ou la désignation de la cible recherchée.');
        return;
      }

      const trimmedDesc = description.trim();
      if (trimmedDesc.length < 50) {
        setMediaError(
          `La description détaillée doit comporter au moins 50 caractères (actuellement : ${trimmedDesc.length}/50).`
        );
        return;
      }

      if (!title.trim()) {
        handleAutoGenerateTitle();
      }

      setStep(4);
      return;
    }

    // Étape 4 -> Étape 5
    if (step === 4) {
      if (mainCategory === 'EVENEMENTS') {
        if (price === '' || Number.isNaN(Number(price)) || Number(price) < 0) {
          setPrice(0);
        }
      }

      if (mainCategory !== 'NECROLOGIE' && mainCategory !== 'AVIS_DE_RECHERCHE' && mainCategory !== 'EVENEMENTS') {
        if (price === '' || price === null || price === undefined || String(price).trim() === '') {
          setMediaError(
            mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS'
              ? 'Veuillez renseigner le salaire désiré ou proposé.'
              : 'Le prix de votre annonce est obligatoire en FCFA.'
          );
          return;
        }

        const numPrice = Number(price);
        if (isNaN(numPrice) || numPrice <= 0) {
          setMediaError(
            mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS'
              ? 'Le salaire ne peut pas être égal à 0 ou négatif.'
              : 'Le prix ne peut pas être égal à 0 ou négatif.'
          );
          return;
        }

        if (
          (mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS') &&
          priceMax !== '' &&
          (isNaN(Number(priceMax)) || Number(priceMax) <= 0)
        ) {
          setMediaError('La tranche maximale de salaire ne peut pas être égale à 0 ou négative.');
          return;
        }
      }

      setStep(5);
      return;
    }

    // Étape 5 -> Étape 6
    if (step === 5) {
      setStep(6);
      return;
    }
  };

  const handlePrevStep = () => {
    setMediaError(null);
    if (step > 1 && step < 7) {
      setStep((step - 1) as PublishStep);
    }
  };

  // Payment completed handler
  const handlePaymentSuccess = async (paymentInfo: {
    operator: PaymentOperator;
    contactPhone: string;
    transactionRef: string;
    amount?: number;
  }) => {
    if (hasHandledPaymentSuccessRef.current) return;
    hasHandledPaymentSuccessRef.current = true;
    setIsSubmitting(true);
    setMediaError(null);

    if (mainCategory === 'EVENEMENTS') {
      const scheduleCheck = validateEventSchedule(eventDate, eventTime);
      if (!scheduleCheck.isValid) {
        setMediaError(scheduleCheck.error || "La date et l'heure de l'événement doivent être valides et dans le futur.");
        setIsSubmitting(false);
        hasHandledPaymentSuccessRef.current = false;
        return;
      }
    }

    try {
      // 1. Upload photos to Firebase Storage
      const finalImageUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const item = photos[i];
        if (item.file) {
          setUploadProgressText(`Téléversement de la photo ${i + 1}/${photos.length}...`);
          try {
            const uploadedUrl = await uploadAdImage(item.file);
            finalImageUrls.push(uploadedUrl);
          } catch (imgErr) {
            console.error(`Erreur téléversement photo ${i + 1}:`, imgErr);
            throw new Error(`Échec du téléversement de la photo ${i + 1}. Vérifiez votre connexion et réessayez.`);
          }
        } else if (item.url) {
          finalImageUrls.push(item.url);
        }
      }

      // 2. Upload video
      let finalVideoUrl: string | undefined = undefined;
      if (hasVideo && videoFile) {
        setUploadProgressText('Téléversement de la vidéo descriptive...');
        try {
          finalVideoUrl = await uploadRawFile(videoFile, 'videos');
        } catch (vidErr) {
          console.error('Erreur téléversement vidéo:', vidErr);
          throw new Error('Échec du téléversement de la vidéo descriptive.');
        }
      }

      // 3. Upload CV
      let finalCvUrl: string | undefined = undefined;
      if (cvFile) {
        setUploadProgressText('Téléversement sécurisé de votre CV...');
        try {
          finalCvUrl = await uploadRawFile(cvFile, 'cvs');
        } catch (cvErr) {
          console.error('Erreur téléversement CV:', cvErr);
          throw new Error('Échec du téléversement du document CV.');
        }
      } else if (cvDataUrl) {
        finalCvUrl = cvDataUrl;
      }

      setUploadProgressText("Finalisation et enregistrement de l'annonce...");

      const now = new Date();

      const newAd: Ad = buildAdPayload({
        id: preGeneratedAdId,
        title,
        mainCategory,
        transactionType,
        jobKind,
        propertyType,
        province,
        city,
        neighborhood,
        vehicleCategory,
        vehicleBrand,
        vehicleModel,
        bricCategory,
        domesticJobType,
        tutoringKind,
        tutoringSubject,
        tutoringLevel,
        necroMinistry,
        necroDeceasedName,
        necroCeremonyDate,
        necroCeremonyLocation,
        necroFuneralProgram,
        necroFamilyContact,
        avisCategory,
        avisTargetName,
        avisLastSeenDate,
        avisLastSeenLocation,
        avisEmergencyContact,
        avisRewardAmount,
        eventType,
        eventDate,
        eventTime,
        eventVenue,
        eventOrganizer,
        eventDressCode,
        autresEmploisSubCategory,
        autresEmploisProfession,
        autresEmploisContractType,
        autresEmploisExperience,
        cvUrl: finalCvUrl,
        cvFileName,
        cvFileType,
        cvFileSize,
        price,
        priceMax,
        priceUnit,
        description,
        images: finalImageUrls,
        videoUrl: finalVideoUrl,
        contactPhone,
        contactName,
        durationDays,
        createdAt: now.toISOString(),
        userId: currentUser?.id || auth.currentUser?.uid,
        paymentReference: (!isExempt && totalBillCalculated > 0) ? paymentInfo.transactionRef : undefined,
      });

      const updatesToUser: Partial<UserProfile> = {};
      if (saveNeighborhoodToProfile && neighborhood.trim() && currentUser?.id) {
        updatesToUser.location = {
          province,
          city,
          neighborhood: neighborhood.trim(),
        };
      }

      if (Object.keys(updatesToUser).length > 0) {
        await onUpdateUser?.(updatesToUser);
      }

      await onAdPublished(newAd);
      setCreatedAd(newAd);
      setStep(7);

      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (err) {
        console.warn('Could not remove draft:', err);
      }
    } catch (e: any) {
      hasHandledPaymentSuccessRef.current = false;
      console.error(e);
      setAlertModalConfig({
        isOpen: true,
        type: 'error',
        title: "Échec de l'enregistrement",
        message: "L'annonce n'a pas pu être enregistrée : " + (e?.message || 'Vérifiez votre connexion et réessayez.'),
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <PublishHeader
          step={step}
          onPrevStep={handlePrevStep}
          onClose={onClose}
          isSubmitting={isSubmitting}
          isWaitingPayment={isWaitingPayment}
          isExempt={isExempt}
        />

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Draft Recovery Prompt */}
          {showDraftPrompt && existingDraft && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm animate-in fade-in space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      Brouillon sauvegardé
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Modifié le {new Date(existingDraft.savedAt).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(existingDraft.savedAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mt-1">
                    Souhaitez-vous reprendre l'annonce en cours ?
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Une annonce non publiée (« {existingDraft.title || existingDraft.mainCategory || 'Sans titre'} ») a été sauvegardée. Vous pouvez reprendre là où vous vous étiez arrêté ou recommencer à zéro.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Recommencer à zéro</span>
                </button>
                <button
                  type="button"
                  onClick={handleResumeDraft}
                  className="px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reprendre mon brouillon</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Catégorie & Localisation */}
          {step === 1 && (
            <Step1Category
              mainCategory={mainCategory}
              onMainCategoryChange={handleMainCategoryChange}
              transactionType={transactionType}
              onTransactionTypeChange={setTransactionType}
              province={province}
              onProvinceChange={setProvince}
              city={city}
              onCityChange={setCity}
              neighborhood={neighborhood}
              onNeighborhoodChange={setNeighborhood}
              saveNeighborhoodToProfile={saveNeighborhoodToProfile}
              onSaveNeighborhoodToProfileChange={setSaveNeighborhoodToProfile}
              currentUser={currentUser}
              simultaneousAdsCount={simultaneousAdsCount}
              maxQuota={maxQuota}
              isUltimateCeilingReached={isUltimateCeilingReached}
              requiresSubscription={requiresSubscription}
            />
          )}

          {/* STEP 2: Photos & Médias */}
          {step === 2 && (
            <Step2Photos
              photos={photos}
              onPhotosChange={setPhotos}
              tier={currentUser?.subscriptionTier}
              mainCategory={mainCategory}
              autresEmploisSubCategory={autresEmploisSubCategory}
              hasVideo={hasVideo}
              onHasVideoChange={setHasVideo}
              videoFile={videoFile}
              videoPreviewUrl={videoPreviewUrl}
              videoDuration={videoDuration}
              onVideoFileSelect={handleVideoFileSelect}
              onRemoveVideo={handleRemoveVideo}
              cvFile={cvFile}
              cvFileName={cvFileName}
              cvFileSize={cvFileSize}
              onCvFileSelect={handleCvFileSelect}
              onRemoveCv={handleRemoveCv}
              mediaError={mediaError}
              setMediaError={setMediaError}
            />
          )}

          {/* STEP 3: Détails & Caractéristiques */}
          {step === 3 && (
            <Step3Details
              mainCategory={mainCategory}
              transactionType={transactionType}
              propertyType={propertyType}
              onPropertyTypeChange={setPropertyType}
              vehicleCategory={vehicleCategory}
              onVehicleCategoryChange={setVehicleCategory}
              vehicleBrand={vehicleBrand}
              onVehicleBrandChange={setVehicleBrand}
              vehicleModel={vehicleModel}
              onVehicleModelChange={setVehicleModel}
              bricCategory={bricCategory}
              onBricCategoryChange={setBricCategory}
              domesticJobType={domesticJobType}
              onDomesticJobTypeChange={setDomesticJobType}
              jobKind={jobKind}
              onJobKindChange={setJobKind}
              tutoringKind={tutoringKind}
              onTutoringKindChange={setTutoringKind}
              tutoringSubject={tutoringSubject}
              onTutoringSubjectChange={setTutoringSubject}
              tutoringLevel={tutoringLevel}
              onTutoringLevelChange={setTutoringLevel}
              necroMinistry={necroMinistry}
              onNecroMinistryChange={setNecroMinistry}
              necroDeceasedName={necroDeceasedName}
              onNecroDeceasedNameChange={setNecroDeceasedName}
              necroCeremonyDate={necroCeremonyDate}
              onNecroCeremonyDateChange={setNecroCeremonyDate}
              necroCeremonyLocation={necroCeremonyLocation}
              onNecroCeremonyLocationChange={setNecroCeremonyLocation}
              necroFuneralProgram={necroFuneralProgram}
              onNecroFuneralProgramChange={setNecroFuneralProgram}
              necroFamilyContact={necroFamilyContact}
              onNecroFamilyContactChange={setNecroFamilyContact}
              avisCategory={avisCategory}
              onAvisCategoryChange={setAvisCategory}
              avisTargetName={avisTargetName}
              onAvisTargetNameChange={setAvisTargetName}
              avisLastSeenDate={avisLastSeenDate}
              onAvisLastSeenDateChange={setAvisLastSeenDate}
              avisLastSeenLocation={avisLastSeenLocation}
              onAvisLastSeenLocationChange={setAvisLastSeenLocation}
              avisEmergencyContact={avisEmergencyContact}
              onAvisEmergencyContactChange={setAvisEmergencyContact}
              avisRewardAmount={avisRewardAmount}
              onAvisRewardAmountChange={setAvisRewardAmount}
              eventType={eventType}
              onEventTypeChange={setEventType}
              eventDate={eventDate}
              onEventDateChange={setEventDate}
              eventTime={eventTime}
              onEventTimeChange={setEventTime}
              eventVenue={eventVenue}
              onEventVenueChange={setEventVenue}
              eventOrganizer={eventOrganizer}
              onEventOrganizerChange={setEventOrganizer}
              eventDressCode={eventDressCode}
              onEventDressCodeChange={setEventDressCode}
              autresEmploisSubCategory={autresEmploisSubCategory}
              onAutresEmploisSubCategoryChange={setAutresEmploisSubCategory}
              autresEmploisProfession={autresEmploisProfession}
              onAutresEmploisProfessionChange={setAutresEmploisProfession}
              autresEmploisContractType={autresEmploisContractType}
              onAutresEmploisContractTypeChange={setAutresEmploisContractType}
              autresEmploisExperience={autresEmploisExperience}
              onAutresEmploisExperienceChange={setAutresEmploisExperience}
              title={title}
              onTitleChange={setTitle}
              description={description}
              onDescriptionChange={setDescription}
              contactName={contactName}
              onContactNameChange={setContactName}
              contactPhone={contactPhone}
              onContactPhoneChange={setContactPhone}
              isOwnerVerified={isOwnerVerified}
              onAutoGenerateTitle={handleAutoGenerateTitle}
              error={mediaError}
            />
          )}

          {/* STEP 4: Prix & Durée */}
          {step === 4 && (
            <Step4Pricing
              mainCategory={mainCategory}
              transactionType={transactionType}
              propertyType={propertyType}
              vehicleCategory={vehicleCategory}
              price={price}
              onPriceChange={setPrice}
              priceMax={priceMax}
              onPriceMaxChange={setPriceMax}
              priceUnit={priceUnit}
              onPriceUnitChange={setPriceUnit}
              durationDays={durationDays}
              onDurationDaysChange={setDurationDays}
              isBoostFeatured={isBoostFeatured}
              onIsBoostFeaturedChange={setIsBoostFeatured}
              currentUser={currentUser}
              serverQuote={serverQuote}
              quoteLoading={quoteLoading}
              quoteError={quoteError}
              isExempt={isExempt}
              totalBillCalculated={totalBillCalculated}
              photoCount={photos.length}
              hasVideo={hasVideo}
            />
          )}

          {/* STEP 5: Aperçu */}
          {step === 5 && (
            <Step5Preview
              title={title}
              mainCategory={mainCategory}
              transactionType={transactionType}
              price={price}
              priceUnit={priceUnit}
              province={province}
              city={city}
              neighborhood={neighborhood}
              description={description}
              photos={photos}
              contactName={contactName}
              contactPhone={contactPhone}
              durationDays={durationDays}
              isBoostFeatured={isBoostFeatured}
              isVipEligible={isVipEligible}
              onOpenCgu={() => setShowCguModal(true)}
            />
          )}

          {/* STEP 6: Paiement & Facturation */}
          {step === 6 && (
            <Step6Payment
              isExempt={isExempt}
              totalBillCalculated={totalBillCalculated}
              itemDescription={`Publication ${title || mainCategory} (${durationDays} jours)`}
              preGeneratedAdId={preGeneratedAdId}
              durationDays={durationDays}
              photoCount={photos.length}
              hasVideo={hasVideo}
              isBoostFeatured={isBoostFeatured}
              requiresSubscription={requiresSubscription}
              selectedTierToBuy={selectedTierToBuy}
              onPaymentSuccess={handlePaymentSuccess}
              onCancel={() => setStep(5)}
              onPaymentPendingChange={setIsWaitingPayment}
              initialPhone={contactPhone}
              isSubmitting={isSubmitting}
            />
          )}

          {/* STEP 7: Confirmation */}
          {step === 7 && createdAd && (
            <Step7Confirmation
              createdAd={createdAd}
              onSwitchToUserDashboard={onSwitchToUserDashboard}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer Navigation */}
        <PublishFooter
          step={step}
          onPrevStep={handlePrevStep}
          onNextStep={handleNextStep}
          isSubmitting={isSubmitting}
          isDisabled={step === 1 && isUltimateCeilingReached}
        />

        {/* CGU Modal */}
        <CguModal isOpen={showCguModal} onClose={() => setShowCguModal(false)} />

        {/* Reusable App Alert Modal */}
        <AppAlertModal
          config={alertModalConfig}
          onClose={() => setAlertModalConfig(null)}
        />

        {/* Uploading Progress Overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-6 text-center text-white rounded-3xl animate-in fade-in">
            <Loader2 className="w-12 h-12 animate-spin text-amber-400 mb-3" />
            <h3 className="text-base font-extrabold tracking-tight">
              Enregistrement sécurisé de vos médias...
            </h3>
            <p className="text-xs text-emerald-300 font-mono mt-2 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-lg max-w-sm">
              {uploadProgressText || 'Enregistrement en cours...'}
            </p>
            <span className="text-[11px] text-slate-400 mt-3">
              Veuillez ne pas fermer cette fenêtre pendant le transfert des médias.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const PublishAdModal: React.FC<PublishAdModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <PublishAdModalContent {...props} />;
};
