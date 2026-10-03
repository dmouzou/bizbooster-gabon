import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Building2,
  Car,
  Package,
  Briefcase,
  MapPin,
  Camera,
  Video,
  Clock,
  Phone,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Eye,
  Plus,
  Trash2,
  ShieldCheck,
  Upload,
  Film,
  Loader2,
  Star,
  FileText,
  CreditCard,
  AlertTriangle,
  Sparkles,
  GraduationCap,
  Heart,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, auth, db } from '../services/firebase';
import {
  Ad,
  BricABracCategory,
  DomesticJobType,
  JobAdKind,
  MainCategory,
  NecrologieMinistry,
  PaymentOperator,
  PropertyType,
  RollingStockCategory,
  TransactionType,
  TutoringAdKind,
  TutoringLevel,
  TutoringSubject,
  UserProfile,
} from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';
import {
  CAR_BRANDS_AND_MODELS,
  DUMP_TRUCK_BRANDS,
  TANKER_TRUCK_TYPES,
  HEAVY_MACHINERY_TYPES,
  MOTORBIKE_TYPES,
  BICYCLE_TYPES,
} from '../data/vehiclesData';
import {
  PROPERTY_TYPES,
  BRIC_A_BRAC_CATEGORIES,
  DOMESTIC_JOB_TYPES,
  NECROLOGIE_MINISTRIES,
  PRICING_CONFIG,
  TUTORING_LEVELS,
  TUTORING_SUBJECTS,
} from '../data/categoriesData';
import { calculateBill, formatFCFA } from '../utils/formatters';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';
import { CguModal } from './CguModal';

interface PublishAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdPublished: (newAd: Ad) => void | Promise<void>;
  currentUser?: UserProfile | null;
  onSwitchToAdmin?: () => void;
  onSwitchToUserDashboard?: () => void;
  userAds?: Ad[];
  onUpdateUser?: (updated: Partial<UserProfile>) => Promise<void>;
}

// Preset photo options to easily populate realistic imagery
const SAMPLE_IMAGE_PRESETS: Record<MainCategory, string[]> = {
  IMMOBILIER: [
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80',
  ],
  MATERIEL_ROULANT: [
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80',
  ],
  BRIC_A_BRAC: [
    'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
  ],
  EMPLOI: [
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=80',
  ],
  COURS_A_DOMICILE: [
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=80',
  ],
  NECROLOGIE: [
    'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
  ],
};

interface PhotoMediaItem {
  id: string;
  url: string;
  file?: File;
  name?: string;
  size?: number;
}

async function uploadAdImage(file: File): Promise<string> {
  const path = `ads/${auth.currentUser!.uid}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export const PublishAdModal: React.FC<PublishAdModalProps> = ({
  isOpen,
  onClose,
  onAdPublished,
  currentUser,
  onSwitchToAdmin,
  onSwitchToUserDashboard,
  userAds,
  onUpdateUser,
}) => {
  if (!isOpen) return null;

  // Wizard Step: 1 = Categorization, 2 = Content & Media, 3 = Billing & Payment, 4 = Confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Point 1: Identity is NOT required for transactions or ad deposits
  // Verification is treated as an optional trust badge
  const isExempt = Boolean(currentUser?.exemptFromPaymentAndKyc || currentUser?.isExempt);
  const isOwnerVerified = currentUser?.idVerificationStatus === 'VERIFIED' || !!currentUser?.idVerifiedAt || (!!currentUser?.idDocumentUrl && currentUser?.idVerificationStatus !== 'REJECTED' && currentUser?.idVerificationStatus !== 'PENDING');
  const isAllowedToPublish = true;

  // Form State
  const [mainCategory, setMainCategory] = useState<MainCategory>('IMMOBILIER');
  
  // Specific detail requested: Vente vs Location
  const [transactionType, setTransactionType] = useState<TransactionType>('LOCATION');
  
  // User profile defaults for location and contact (Point 4)
  const profileNeighborhood = currentUser?.location?.neighborhood?.trim() || '';
  const profileProvince = currentUser?.location?.province?.trim() || '';
  const profileCity = currentUser?.location?.city?.trim() || '';
  const accountRegisteredPhone = (currentUser?.contactPhone || currentUser?.phoneNumber || '').trim();

  // Immobilier specifics
  const [propertyType, setPropertyType] = useState<PropertyType>('Villa');
  const [province, setProvince] = useState<string>(profileProvince || 'Estuaire');
  const [city, setCity] = useState<string>(profileCity || 'Libreville');
  const [neighborhood, setNeighborhood] = useState<string>(profileNeighborhood || 'La Sablière');
  const [saveNeighborhoodToProfile, setSaveNeighborhoodToProfile] = useState<boolean>(false);

  // Matériel Roulant specifics
  const [vehicleCategory, setVehicleCategory] = useState<RollingStockCategory>('Voitures');
  const [vehicleBrand, setVehicleBrand] = useState<string>('TOYOTA');
  const [vehicleModel, setVehicleModel] = useState<string>('Hilux');

  // Bric-à-Brac specifics
  const [bricCategory, setBricCategory] = useState<BricABracCategory>('Électronique & Smartphones');

  // Emploi specifics (Point 8: Distinction Offre d'emploi vs Demande d'emploi)
  const [domesticJobType, setDomesticJobType] = useState<DomesticJobType>('Nounous (garde-bébé)');
  const [jobKind, setJobKind] = useState<JobAdKind>('OFFRE_EMPLOI');

  // Cours à Domicile specifics (Point 9)
  const [tutoringKind, setTutoringKind] = useState<TutoringAdKind>('OFFRE');
  const [tutoringSubject, setTutoringSubject] = useState<TutoringSubject>('Mathématiques');
  const [tutoringLevel, setTutoringLevel] = useState<TutoringLevel>('Tous niveaux');

  // Nécrologie specifics (Point 8)
  const [necroMinistry, setNecroMinistry] = useState<NecrologieMinistry>('Éducation nationale');
  const [necroDeceasedName, setNecroDeceasedName] = useState<string>('');
  const [necroCeremonyDate, setNecroCeremonyDate] = useState<string>('');
  const [necroCeremonyLocation, setNecroCeremonyLocation] = useState<string>('');
  const [necroFuneralProgram, setNecroFuneralProgram] = useState<string>('');
  const [necroFamilyContact, setNecroFamilyContact] = useState<string>('');

  // Point 4: Format category and subcategory at the top of Step 2
  const getCategoryHeaderSummary = () => {
    switch (mainCategory) {
      case 'COURS_A_DOMICILE': {
        const kindLabel = tutoringKind === 'DEMANDE' ? 'Demande de cours' : 'Offre de cours';
        return tutoringSubject
          ? `Cours à Domicile - ${kindLabel} (${tutoringSubject})`
          : `Cours à Domicile - ${kindLabel}`;
      }
      case 'EMPLOI': {
        const kindLabel = jobKind === 'DEMANDE_EMPLOI' ? "Demande d'emploi" : "Offre d'emploi";
        return domesticJobType
          ? `Emploi - ${kindLabel} (${domesticJobType})`
          : `Emploi - ${kindLabel}`;
      }
      case 'BRIC_A_BRAC': {
        return bricCategory ? `Bric-à-Brac - ${bricCategory}` : 'Bric-à-Brac';
      }
      case 'MATERIEL_ROULANT': {
        const typeLabel = transactionType === 'VENTE' ? 'Vente' : 'Location';
        return vehicleCategory
          ? `Matériel Roulant - ${vehicleCategory} (${typeLabel})`
          : `Matériel Roulant (${typeLabel})`;
      }
      case 'IMMOBILIER': {
        const typeLabel = transactionType === 'VENTE' ? 'Vente' : 'Location';
        return propertyType
          ? `Immobilier - ${propertyType} (${typeLabel})`
          : `Immobilier (${typeLabel})`;
      }
      case 'NECROLOGIE': {
        return necroMinistry
          ? `Nécrologie - Avis d'Obsèques (${necroMinistry})`
          : "Nécrologie - Avis d'Obsèques";
      }
      default:
        return 'Détails de votre annonce';
    }
  };

  // Step 2 Fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number>(350000);
  const [priceUnit, setPriceUnit] = useState<'total' | 'mois' | 'jour' | 'trimestre' | 'an' | 'heure'>('mois');
  const [description, setDescription] = useState('');

  // Boost "En tête de liste" (7 days)
  const [isBoostFeatured, setIsBoostFeatured] = useState(false);
  const BOOST_PRICE = 5000;
  const hasFreeBoost = Boolean(
    currentUser?.freeBoostsRemaining && currentUser.freeBoostsRemaining > 0
  );
  const boostCost = isBoostFeatured && !isExempt && !hasFreeBoost ? BOOST_PRICE : 0;
  
  // Media State: photos (max 5) with support for presets and local File uploads
  const [photos, setPhotos] = useState<PhotoMediaItem[]>([
    { id: 'preset-init', url: SAMPLE_IMAGE_PRESETS['IMMOBILIER'][0] },
  ]);
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Video State: max 1 video, ≤ 30s, ≤ 50 Mo
  const [hasVideo, setHasVideo] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Errors & Upload submission state
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const [contactName, setContactName] = useState(currentUser?.name || '');
  const [contactPhone, setContactPhone] = useState(accountRegisteredPhone || '');
  const [phoneChoice, setPhoneChoice] = useState<'ACCOUNT' | 'CUSTOM'>(accountRegisteredPhone ? 'ACCOUNT' : 'CUSTOM');
  const [durationDays, setDurationDays] = useState<number>(15);

  // Modal body scroll reference for Step navigation (Point 3)
  const modalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [step]);

  // Newly created ad for verification view
  const [createdAd, setCreatedAd] = useState<Ad | null>(null);

  // Point 3: Draft ("Brouillon") management
  const DRAFT_STORAGE_KEY = `bizbooster_publish_draft_${currentUser?.id || 'guest'}`;
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [existingDraft, setExistingDraft] = useState<any | null>(null);
  const [showCguModal, setShowCguModal] = useState(false);

  // Check for existing draft when opening
  React.useEffect(() => {
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

  const handleRestoreDraft = () => handleResumeDraft();
  const handleResumeDraft = () => {
    if (!existingDraft) return;
    if (existingDraft.step && existingDraft.step <= 3) setStep(existingDraft.step);
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
    setNeighborhood('La Sablière');
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
    setPrice(350000);
    setPriceUnit('mois');
    setDescription('');
    setPhotos([{ id: 'preset-init', url: SAMPLE_IMAGE_PRESETS['IMMOBILIER'][0] }]);
    setHasVideo(false);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setContactName(currentUser?.name || '');
    setContactPhone(currentUser?.contactPhone || '');
    setDurationDays(15);
    setIsBoostFeatured(false);
    setMediaError(null);
  };

  // Auto-save draft whenever form fields change (Debounced)
  React.useEffect(() => {
    if (!isOpen || showDraftPrompt || step === 4) return;
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
          title,
          price,
          priceUnit,
          description,
          photos: photos.map((p) => ({ id: p.id, url: p.url, name: p.name, size: p.size })),
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
    tutoringKind,
    tutoringSubject,
    tutoringLevel,
    necroMinistry,
    necroDeceasedName,
    necroCeremonyDate,
    necroCeremonyLocation,
    necroFuneralProgram,
    necroFamilyContact,
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

  // Active/Simultaneous ads count for the current user
  const userSimultaneousAds = useMemo(() => {
    if (!userAds || !currentUser) return [];
    const now = Date.now();
    return userAds.filter(
      (a) =>
        (a.userId === currentUser.id || !a.userId) &&
        a.status !== 'REJECTED' &&
        new Date(a.expiresAt).getTime() > now
    );
  }, [userAds, currentUser]);

  const simultaneousAdsCount = userSimultaneousAds.length;

  // Max simultaneous ads quota:
  // Standard = 3 max. VIP / Business = 20 max. Elite = 14. Pro = 8.
  const maxQuota = useMemo(() => {
    if (isExempt) return 20; // VIP Partner: 20 simultaneous ads (reflects Business version)
    if (currentUser?.subscriptionTier === 'BUSINESS') return 20;
    if (currentUser?.subscriptionTier === 'ELITE') return 14;
    if (currentUser?.subscriptionTier === 'PRO') return 8;
    return 3; // Standard free users: max 3 simultaneous ads
  }, [currentUser?.subscriptionTier, isExempt]);

  // Absolute hard ceiling is 20 ads
  const isUltimateCeilingReached = simultaneousAdsCount >= 20;

  // Subscription upgrade required if simultaneous ads >= current quota and < 20
  const isSubscriber = Boolean(currentUser?.subscriptionTier && currentUser.subscriptionTier !== 'STANDARD');
  const requiresSubscription = useMemo(() => {
    if (isExempt) return false;
    return simultaneousAdsCount >= maxQuota && maxQuota < 20;
  }, [isExempt, simultaneousAdsCount, maxQuota]);

  const SUBSCRIPTION_PRICES: Record<'PRO' | 'ELITE' | 'BUSINESS', number> = {
    PRO: 29000,
    ELITE: 59000,
    BUSINESS: 99000,
  };

  const [selectedTierToBuy, setSelectedTierToBuy] = useState<'PRO' | 'ELITE' | 'BUSINESS'>('PRO');

  // Subscription upgrade rule (Point 5): surplus only within 1 week, else full price
  const subscriptionAgeDays = useMemo(() => {
    if (!isSubscriber || !currentUser?.subscriptionExpiresAt) return 0;
    const startedMs = currentUser.subscriptionStartedAt 
      ? new Date(currentUser.subscriptionStartedAt).getTime()
      : new Date(currentUser.subscriptionExpiresAt).getTime() - 30 * 86400000;
    return Math.max(0, (Date.now() - startedMs) / (24 * 3600 * 1000));
  }, [isSubscriber, currentUser?.subscriptionStartedAt, currentUser?.subscriptionExpiresAt]);

  const hasExceededOneWeek = subscriptionAgeDays > 7;

  const subscriptionCost = useMemo(() => {
    if (!requiresSubscription) return 0;
    const targetPrice = SUBSCRIPTION_PRICES[selectedTierToBuy];
    if (isSubscriber && currentUser?.subscriptionTier && currentUser.subscriptionTier !== 'STANDARD') {
      const currentPrice = SUBSCRIPTION_PRICES[currentUser.subscriptionTier as 'PRO' | 'ELITE' | 'BUSINESS'] || 0;
      if (!hasExceededOneWeek && targetPrice > currentPrice) {
        return Math.max(0, targetPrice - currentPrice);
      }
    }
    return targetPrice;
  }, [requiresSubscription, selectedTierToBuy, isSubscriber, currentUser?.subscriptionTier, hasExceededOneWeek]);

  // Dynamic Gabon city and neighborhood lists
  const currentProvinceData = useMemo(() => {
    return GABON_PROVINCES.find((p) => p.name === province) || GABON_PROVINCES[0];
  }, [province]);

  const currentCityData = useMemo(() => {
    return currentProvinceData.cities.find((c) => c.name === city) || currentProvinceData.cities[0];
  }, [currentProvinceData, city]);

  // Car models list
  const currentCarModels = useMemo(() => {
    const brand = CAR_BRANDS_AND_MODELS.find((b) => b.brand === vehicleBrand);
    return brand ? brand.models : ['Standard'];
  }, [vehicleBrand]);

  // Dynamic Bill Calculation (Section C-d) based on photos count and video option
  const bill = useMemo(() => {
    return calculateBill(durationDays, photos.length, hasVideo);
  }, [durationDays, photos.length, hasVideo]);

  // Base price is waived if subscriber, VIP, or subscribing right now
  const isBasePostingCovered = Boolean(
    isExempt ||
    isSubscriber ||
    requiresSubscription
  );

  const basePriceToPay = isBasePostingCovered ? 0 : bill.basePrice;
  const totalBillCalculated = isExempt
    ? 0
    : basePriceToPay + bill.extraPhotosCost + bill.videoCost + boostCost + subscriptionCost;

  // File selection for photos (limit: max 5 photos total, max 10 Mo/image)
  const handlePhotoFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selectedFiles: File[] = Array.from(files);
    e.target.value = ''; // Reset input to allow selecting same file again if desired

    // Validation: 10 Mo max per image
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    for (const file of selectedFiles) {
      if (file.size > MAX_IMAGE_SIZE) {
        setMediaError(`La photo "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de 10 Mo.`);
        return;
      }
    }

    // Validation: max allowed photos (10 max, 5 first included free)
    const maxPhotos = PRICING_CONFIG.maxImages || 10;
    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setMediaError(`Limite atteinte : ${maxPhotos} photos maximum autorisées pour votre annonce.`);
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setMediaError(`Seules ${remainingSlots} photo(s) ont été ajoutées pour respecter le plafond de ${maxPhotos} photos.`);
    } else {
      setMediaError(null);
    }

    filesToAdd.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = (loadEvt.target?.result as string) || '';
        if (dataUrl) {
          setPhotos((prev) => [
            ...prev,
            {
              id: `file-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              url: dataUrl,
              file,
              name: file.name,
              size: file.size,
            },
          ]);
        }
      };
      reader.onerror = () => {
        const objUrl = URL.createObjectURL(file);
        setPhotos((prev) => [
          ...prev,
          {
            id: `file-${Date.now()}-${idx}`,
            url: objUrl,
            file,
            name: file.name,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Add sample preset photo (kept as requested by user)
  const handleAddSampleImage = (img: string) => {
    const maxPhotos = PRICING_CONFIG.maxImages || 10;
    if (photos.length >= maxPhotos) {
      setMediaError(`Limite atteinte : ${maxPhotos} photos maximum autorisées.`);
      return;
    }
    if (!photos.some((p) => p.url === img)) {
      setPhotos((prev) => [...prev, { id: `preset-${Date.now()}`, url: img }]);
      setMediaError(null);
    }
  };

  const handleAddCustomImage = () => {
    const maxPhotos = PRICING_CONFIG.maxImages || 10;
    if (photos.length >= maxPhotos) {
      setMediaError(`Limite atteinte : ${maxPhotos} photos maximum autorisées.`);
      return;
    }
    if (customImageUrl.trim()) {
      setPhotos((prev) => [...prev, { id: `custom-${Date.now()}`, url: customImageUrl.trim() }]);
      setCustomImageUrl('');
      setMediaError(null);
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (photos.length > 1) {
      const removed = photos[index];
      if (removed.url && removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url);
      }
      setPhotos((prev) => prev.filter((_, idx) => idx !== index));
      setMediaError(null);
    } else {
      setMediaError('Votre annonce doit comporter au moins 1 photo.');
    }
  };

  // Video file selection (limit: max 30s, ≤ 50 Mo)
  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    // Size limit: 50 Mo max
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_VIDEO_SIZE) {
      setMediaError(`La vidéo "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de 50 Mo.`);
      return;
    }

    setMediaError(null);
    setVideoFile(file);
    const blobUrl = URL.createObjectURL(file);
    // Point 10 fix: Immediately set preview URL so video displays inside container
    setVideoPreviewUrl(blobUrl);
    setHasVideo(true);

    // Duration limit check (async with fallback)
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      const duration = Math.round(tempVideo.duration);
      if (duration > 30) {
        setMediaError(`Attention : La durée de la vidéo (${duration}s) dépasse les 30s recommandées.`);
      }
      setVideoDuration(duration);
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

  // Switch image presets on category change
  const handleMainCategoryChange = (cat: MainCategory) => {
    setMainCategory(cat);
    const hasUserFiles = photos.some((p) => p.file || p.url.startsWith('data:'));
    if (!hasUserFiles) {
      setPhotos([{ id: `preset-${Date.now()}`, url: SAMPLE_IMAGE_PRESETS[cat][0] }]);
    }
    if (cat === 'IMMOBILIER') {
      setPriceUnit(transactionType === 'LOCATION' ? 'mois' : 'total');
    } else if (cat === 'MATERIEL_ROULANT') {
      setPriceUnit(transactionType === 'LOCATION' ? 'jour' : 'total');
    } else if (cat === 'EMPLOI') {
      setPriceUnit('mois');
      setPrice(120000);
      setTransactionType('EMPLOYER');
    } else if (cat === 'BRIC_A_BRAC') {
      setPriceUnit('total');
      setTransactionType('VENTE');
    } else if (cat === 'COURS_A_DOMICILE') {
      setPriceUnit('mois');
      setPrice(45000);
      setTransactionType('VENTE');
    } else if (cat === 'NECROLOGIE') {
      setPriceUnit('total');
      setPrice(0);
      setTransactionType('VENTE');
    } else {
      setPriceUnit('total');
    }
  };

  // Payment completed handler: Uploads all media to Firebase Storage before publishing
  const handlePaymentSuccess = async (paymentInfo: {
    operator: PaymentOperator;
    contactPhone: string;
    transactionRef: string;
  }) => {
    setIsSubmitting(true);
    setMediaError(null);

    try {
      // 1. Upload local photo files to Firebase Storage
      const finalImageUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const item = photos[i];
        if (item.file) {
          setUploadProgressText(`Téléversement de la photo ${i + 1}/${photos.length} en cours...`);
          const uploadedUrl = await uploadAdImage(item.file);
          finalImageUrls.push(uploadedUrl);
        } else {
          finalImageUrls.push(item.url);
        }
      }

      // 2. Upload video file to Firebase Storage if option enabled
      let finalVideoUrl: string | undefined = undefined;
      if (hasVideo) {
        if (videoFile) {
          setUploadProgressText('Téléversement de la vidéo descriptive (≤ 30s) en cours...');
          finalVideoUrl = await uploadAdImage(videoFile);
        } else {
          finalVideoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-modern-house-architecture-4247-large.mp4';
        }
      }

      setUploadProgressText("Finalisation et enregistrement de l'annonce...");

      const now = new Date();
      const expires = new Date(now.getTime() + durationDays * 86400000);

      const newAd: Ad = {
        id: `ad-${Date.now().toString(36)}`,
        title: title || `${transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${mainCategory}`,
        mainCategory,
        transactionType:
          mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT'
            ? transactionType
            : mainCategory === 'EMPLOI'
            ? (jobKind === 'DEMANDE_EMPLOI' ? 'CHERCHE_EMPLOI' : 'EMPLOYER')
            : 'VENTE',
        jobKind: mainCategory === 'EMPLOI' ? jobKind : undefined,
        propertyType: mainCategory === 'IMMOBILIER' ? propertyType : undefined,
        location: {
          province,
          city,
          neighborhood,
        },
        vehicleData:
          mainCategory === 'MATERIEL_ROULANT'
            ? {
                category: vehicleCategory,
                brand: vehicleCategory === 'Voitures' || vehicleCategory === 'Camions Bennes' ? vehicleBrand : undefined,
                model: vehicleCategory === 'Voitures' ? vehicleModel : undefined,
              }
            : undefined,
        bricCategory: mainCategory === 'BRIC_A_BRAC' ? bricCategory : undefined,
        domesticJobType: mainCategory === 'EMPLOI' ? domesticJobType : undefined,
        tutoringData:
          mainCategory === 'COURS_A_DOMICILE'
            ? {
                kind: tutoringKind,
                subject: tutoringSubject,
                level: tutoringLevel,
              }
            : undefined,
        necrologieData:
          mainCategory === 'NECROLOGIE'
            ? {
                ministry: necroMinistry,
                deceasedName: necroDeceasedName,
                ceremonyDate: necroCeremonyDate,
                ceremonyLocation: necroCeremonyLocation,
                funeralProgram: necroFuneralProgram,
                familyContact: necroFamilyContact,
              }
            : undefined,
        price: Number(price) || 0,
        priceUnit,
        isFeatured: isBoostFeatured,
        featuredUntil: isBoostFeatured ? new Date(now.getTime() + 7 * 86400000).toISOString() : undefined,
        featuredAt: isBoostFeatured ? now.toISOString() : undefined,
        ownerTier: requiresSubscription ? selectedTierToBuy : (currentUser?.subscriptionTier || 'STANDARD'),
        isOwnerVip: Boolean(currentUser?.exemptFromPaymentAndKyc || currentUser?.isExempt),
        isOwnerVerified: Boolean(currentUser?.idVerificationStatus === 'VERIFIED' || !!currentUser?.idVerifiedAt || (!!currentUser?.idDocumentUrl && currentUser?.idVerificationStatus !== 'REJECTED' && currentUser?.idVerificationStatus !== 'PENDING')),
        description: description || 'Annonce vérifiée et publiée sur BIZBOOSTER Gabon.',
        images: finalImageUrls.length > 0 ? finalImageUrls : [SAMPLE_IMAGE_PRESETS[mainCategory][0]],
        videoUrl: finalVideoUrl,
        contactPhone: contactPhone,
        hasWhatsapp: true,
        contactName: contactName || 'Annonceur BIZBOOSTER',
        durationDays,
        publishedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        status: 'PENDING_REVIEW', // Post is sent to admin moderation before public live
        userId: currentUser?.id || auth.currentUser?.uid,
        paidAmount: isExempt ? 0 : totalBillCalculated,
        paymentMethod: isExempt ? ('AIRTEL_MONEY' as PaymentOperator) : paymentInfo.operator,
        transactionRef: isExempt ? (paymentInfo.transactionRef || `VIP-${Date.now().toString(36).toUpperCase()}`) : paymentInfo.transactionRef,
        viewsCount: 0,
      };

      if (requiresSubscription) {
        const boostsToAdd = selectedTierToBuy === 'BUSINESS' ? 6 : selectedTierToBuy === 'ELITE' ? 3 : 1;
        const currentBoosts = currentUser?.freeBoostsRemaining || 0;
        let finalBoosts = Math.min(20, currentBoosts + boostsToAdd);
        if (isBoostFeatured && !isExempt) {
          finalBoosts = Math.max(0, finalBoosts - 1);
        }
        await onUpdateUser?.({
          subscriptionTier: selectedTierToBuy,
          subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          freeBoostsRemaining: finalBoosts,
        });
      } else if (hasFreeBoost && isBoostFeatured) {
        await onUpdateUser?.({ freeBoostsRemaining: Math.max(0, (currentUser?.freeBoostsRemaining || 1) - 1) });
      }

      // Point 4: If advertiser chose to remember their neighborhood in profile
      if (saveNeighborhoodToProfile && neighborhood.trim() && currentUser?.id) {
        await onUpdateUser?.({
          location: {
            province,
            city,
            neighborhood: neighborhood.trim(),
          },
        });
      }

      await onAdPublished(newAd);
      setCreatedAd(newAd);
      setStep(4);

      // Clean up draft from localStorage on successful publish
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (err) {
        console.warn('Could not remove draft:', err);
      }
    } catch (e: any) {
      console.error(e);
      alert("L'annonce n'a pas pu être enregistrée : " + (e?.message || 'Vérifiez votre connexion et réessayez.'));
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  return (
    <div className="app-modal-overlay">
      <div
        className="app-modal-dialog bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-300/80 flex flex-col animate-in fade-in zoom-in-95 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-emerald-950 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-emerald-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                Publication BIZBOOSTER
              </span>
              <span className="text-xs text-emerald-300 font-semibold">
                {step < 4 ? `Étape ${step} sur 3` : 'Confirmation'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
              {step === 1 && '1. Catégorie & Localisation spatiale'}
              {step === 2 && '2. Détails, Photos & Description (min 50 car.)'}
              {step === 3 && (isExempt ? '3. Validation Partenaire VIP (Publication Gratuite)' : '3. Facturation & Paiement Mobile (Airtel / Moov)')}
              {step === 4 && '4. Annonce Transmise à la Modération'}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-emerald-400 hover:text-white p-1 rounded-lg hover:bg-emerald-900 disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard progress bar */}
        <div className="bg-emerald-900 h-1.5 w-full">
          <div
            className="bg-amber-400 h-full transition-all duration-300"
            style={{
              width: `${step === 1 ? 33 : step === 2 ? 66 : 100}%`
            }}
          />
        </div>

        {/* Modal Body with ref for automatic scroll to top on Step 3 (Point 3) */}
        <div ref={modalBodyRef} className="p-3.5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
          {/* DRAFT RECOVERY PROMPT (Point 3) */}
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
                      Modifié le {new Date(existingDraft.savedAt).toLocaleDateString('fr-FR')} à {new Date(existingDraft.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mt-1">
                    Souhaitez-vous reprendre l'annonce en cours ?
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Une annonce non publiée (« {existingDraft.title || existingDraft.mainCategory || 'Sans titre'} ») a été sauvegardée. Vous pouvez reprendre là où vous vous étiez arrêté, ou repartir de zéro (ce qui effacera définitivement ce brouillon et ses médias).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Recommencer à zéro (Supprimer le brouillon)</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reprendre là où je m'étais arrêté</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: CATEGORIZATION & SPATIAL RUBRICS */}
              {step === 1 && (
            <div className="space-y-5">
              {/* Quota & Ceiling Alert */}
              {isUltimateCeilingReached ? (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-black text-red-900 uppercase">
                      Plafond maximal atteint (20 / 20 annonces actives)
                    </p>
                    <p className="text-red-700 mt-1 leading-relaxed">
                      Conformément aux règles de diffusion BIZBOOSTER Gabon, chaque annonceur est soumis au plafond maximal de 20 annonces simultanées en cours.
                      Veuillez attendre l'expiration d'une annonce ou en supprimer une depuis votre espace pour déposer une nouvelle offre.
                    </p>
                  </div>
                </div>
              ) : requiresSubscription ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-black text-amber-900 uppercase">
                      Limite de {maxQuota} annonce{maxQuota > 1 ? 's' : ''} atteinte ({simultaneousAdsCount} actives)
                    </p>
                    <p className="text-amber-800 mt-1 leading-relaxed">
                      Pour afficher plus de 3 annonces simultanément, vous devez souscrire au forfait Pro (jusqu'à 8), Élite (jusqu'à 14) ou Business (jusqu'à 20). Vous pourrez choisir votre formule à l'étape suivante.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-semibold">
                    Vos annonces simultanées en cours :
                  </span>
                  <span className="font-extrabold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                    {simultaneousAdsCount} / {maxQuota} max {currentUser?.subscriptionTier ? `(${currentUser.subscriptionTier})` : '(Standard)'}
                  </span>
                </div>
              )}

              {/* Category Selector (6 categories: Immob, Roulant, Bric, Emploi, Cours, Nécrologie) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Choisissez la catégorie principale (Section B)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('IMMOBILIER')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'IMMOBILIER'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400 text-emerald-950 font-black'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <span className="text-xs block">IMMOBILIER</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('MATERIEL_ROULANT')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'MATERIEL_ROULANT'
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-400 text-blue-950 font-black'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <Car className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <span className="text-xs block">MATÉRIEL ROULANT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('BRIC_A_BRAC')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'BRIC_A_BRAC'
                        ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400 text-amber-950 font-black'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <Package className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                    <span className="text-xs block">BRIC-À-BRAC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('EMPLOI')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'EMPLOI'
                        ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-400 text-purple-950 font-black'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <Briefcase className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                    <span className="text-xs block">EMPLOI MAISONS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('COURS_A_DOMICILE')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'COURS_A_DOMICILE'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-400 text-indigo-950 font-black'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
                    <span className="text-xs block">COURS À DOMICILE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('NECROLOGIE')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'NECROLOGIE'
                        ? 'bg-slate-800 border-slate-900 ring-2 ring-slate-700 text-white font-black'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <Heart className="w-5 h-5 mx-auto mb-1 text-rose-500" />
                    <span className="text-xs block">NÉCROLOGIE</span>
                  </button>
                </div>
              </div>

              {/* CRITICAL REQUIREMENT: "L'annonceur doit pouvoir préciser s'il vend ou s'il loue son bien." */}
              {(mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT') && (
                <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                      Détail obligatoire
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      Précisez la nature de votre transaction : Vendez-vous ou Louez-vous ?
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTransactionType('VENTE');
                        setPriceUnit('total');
                      }}
                      className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-xs ${
                        transactionType === 'VENTE'
                          ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-amber-50/40'
                      }`}
                      id="publish-trans-vente"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>JE VENDS MON BIEN (Vente)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransactionType('LOCATION');
                        setPriceUnit(mainCategory === 'IMMOBILIER' ? 'mois' : 'jour');
                      }}
                      className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-xs ${
                        transactionType === 'LOCATION'
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-400/50'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50/40'
                      }`}
                      id="publish-trans-location"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>JE LOUE MON BIEN (Location)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SPECIFIC FIELDS: IMMOBILIER (Point 2: Localisation étendue à toutes les catégories) */}
              {mainCategory === 'IMMOBILIER' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                      Type de Bien Immobilier
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Catégorie de bien immobilier *
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      id="publish-property-type-select"
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* SPECIFIC FIELDS: MATÉRIEL ROULANT (Voitures, Camions Bennes, Citernes, Engins...) */}
              {mainCategory === 'MATERIEL_ROULANT' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Catégorie Matériel Roulant (Section B-2)
                      </label>
                      <select
                        value={vehicleCategory}
                        onChange={(e) => {
                          setVehicleCategory(e.target.value as RollingStockCategory);
                          if (e.target.value === 'Camions Bennes') {
                            setVehicleBrand(DUMP_TRUCK_BRANDS[0]);
                          } else if (e.target.value === 'Voitures') {
                            setVehicleBrand('TOYOTA');
                            setVehicleModel('Hilux');
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Voitures">Voitures</option>
                        <option value="Camions Bennes">Camions Bennes</option>
                        <option value="Camions Citernes">Camions Citernes</option>
                        <option value="Engins de chantiers">Engins de chantiers</option>
                        <option value="Motos">Motos</option>
                        <option value="Vélos">Vélos</option>
                      </select>
                    </div>

                    {vehicleCategory === 'Voitures' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            Marque (ex: TOYOTA, HYUNDAI, NISSAN, KIA...)
                          </label>
                          <select
                            value={vehicleBrand}
                            onChange={(e) => {
                              setVehicleBrand(e.target.value);
                              const b = CAR_BRANDS_AND_MODELS.find((x) => x.brand === e.target.value);
                              if (b) setVehicleModel(b.models[0]);
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                          >
                            {CAR_BRANDS_AND_MODELS.map((b) => (
                              <option key={b.brand} value={b.brand}>
                                {b.brand}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            Modèle (ex: Santa Fe, Hilux, Tucson...)
                          </label>
                          <select
                            value={vehicleModel}
                            onChange={(e) => setVehicleModel(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                          >
                            {currentCarModels.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {vehicleCategory === 'Camions Bennes' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Marque Benne (HOWO, IVECO, MERCEDES, SHACMAN...)
                        </label>
                        <select
                          value={vehicleBrand}
                          onChange={(e) => setVehicleBrand(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                          {DUMP_TRUCK_BRANDS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SPECIFIC FIELDS: BRIC-À-BRAC */}
              {mainCategory === 'BRIC_A_BRAC' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Sous-catégorie Bric-à-Brac
                  </label>
                  <select
                    value={bricCategory}
                    onChange={(e) => setBricCategory(e.target.value as BricABracCategory)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  >
                    {BRIC_A_BRAC_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SPECIFIC FIELDS: EMPLOI (Point 8: Distinction Offre vs Demande d'emploi) */}
              {mainCategory === 'EMPLOI' && (
                <div className="bg-purple-50/80 border-2 border-purple-200 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-purple-700" />
                    <span className="font-black text-xs text-purple-950 uppercase tracking-wide">
                      Annonce Emploi & Métiers Domestiques
                    </span>
                  </div>

                  {/* Offre d'emploi (Recruteur) vs Demande d'emploi (Candidat) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Nature de l'annonce Emploi : Recrutez-vous ou cherchez-vous du travail ? *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setJobKind('OFFRE_EMPLOI');
                          setTransactionType('LOCATION');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          jobKind === 'OFFRE_EMPLOI'
                            ? 'bg-purple-600 border-purple-700 text-white shadow-md ring-2 ring-purple-400/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
                        }`}
                      >
                        <div className="font-black text-xs flex items-center gap-1.5">
                          💼 OFFRE D'EMPLOI
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${jobKind === 'OFFRE_EMPLOI' ? 'text-purple-100' : 'text-slate-500'}`}>
                          Je recrute ou cherche un employé / travailleur
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setJobKind('DEMANDE_EMPLOI');
                          setTransactionType('CHERCHE_EMPLOI');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          jobKind === 'DEMANDE_EMPLOI'
                            ? 'bg-teal-600 border-teal-700 text-white shadow-md ring-2 ring-teal-400/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50'
                        }`}
                      >
                        <div className="font-black text-xs flex items-center gap-1.5">
                          🙋 DEMANDE D'EMPLOI
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${jobKind === 'DEMANDE_EMPLOI' ? 'text-teal-100' : 'text-slate-500'}`}>
                          Je cherche du travail et je propose mes compétences
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Métier Domestique ciblé *
                    </label>
                    <select
                      value={domesticJobType}
                      onChange={(e) => setDomesticJobType(e.target.value as DomesticJobType)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                    >
                      {DOMESTIC_JOB_TYPES.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* SPECIFIC FIELDS: COURS A DOMICILE (Point 9) */}
              {mainCategory === 'COURS_A_DOMICILE' && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                    <span className="font-black text-xs text-indigo-950 uppercase tracking-wide">
                      Paramètres des Cours à Domicile (Offres & Demandes)
                    </span>
                  </div>

                  {/* Offre ou Demande */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nature de la publication : Proposez-vous ou recherchez-vous des cours ?
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setTutoringKind('OFFRE')}
                        className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                          tutoringKind === 'OFFRE'
                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50/40'
                        }`}
                      >
                        🎓 OFFRE DE COURS
                        <span className="block text-[10px] font-normal opacity-90 mt-0.5">
                          (Je suis enseignant / répétiteur)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTutoringKind('DEMANDE')}
                        className={`p-3 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                          tutoringKind === 'DEMANDE'
                            ? 'bg-purple-600 border-purple-700 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50/40'
                        }`}
                      >
                        📖 DEMANDE DE COURS
                        <span className="block text-[10px] font-normal opacity-90 mt-0.5">
                          (Je suis parent / élève en recherche)
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Matière principale enseignée *
                      </label>
                      <select
                        value={tutoringSubject}
                        onChange={(e) => setTutoringSubject(e.target.value as TutoringSubject)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                      >
                        {TUTORING_SUBJECTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Niveau scolaire ciblé *
                      </label>
                      <select
                        value={tutoringLevel}
                        onChange={(e) => setTutoringLevel(e.target.value as TutoringLevel)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                      >
                        {TUTORING_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>


                </div>
              )}

              {/* SPECIFIC FIELDS: NECROLOGIE (Point 8) */}
              {mainCategory === 'NECROLOGIE' && (
                <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-600" />
                    <span className="font-black text-xs text-slate-900 uppercase tracking-wide">
                      Avis de Décès & Nécrologie (Ministères & Familles)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sous-menu Ministères les plus populeux (Point 8) *
                    </label>
                    <select
                      value={necroMinistry}
                      onChange={(e) => setNecroMinistry(e.target.value as NecrologieMinistry)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-slate-700"
                    >
                      {NECROLOGIE_MINISTRIES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Catégorisation par ministères les plus populeux (Éducation nationale, Police nationale, Armée, Santé, Autre) pour informer rapidement collègues et proches.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nom complet du défunt / de la défunte *
                      </label>
                      <input
                        type="text"
                        value={necroDeceasedName}
                        onChange={(e) => setNecroDeceasedName(e.target.value)}
                        placeholder="Ex: Feu M. MBOUMBA Jean-Pierre"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Date de la veillée / inhumation
                      </label>
                      <input
                        type="text"
                        value={necroCeremonyDate}
                        onChange={(e) => setNecroCeremonyDate(e.target.value)}
                        placeholder="Ex: Samedi 18 Octobre 2026"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Lieu de la veillée / Inhumation
                      </label>
                      <input
                        type="text"
                        value={necroCeremonyLocation}
                        onChange={(e) => setNecroCeremonyLocation(e.target.value)}
                        placeholder="Ex: Domicile familial à Nzeng-Ayong, Libreville"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact de la famille / Organisation
                      </label>
                      <input
                        type="text"
                        value={necroFamilyContact}
                        onChange={(e) => setNecroFamilyContact(e.target.value)}
                        placeholder="Ex: 077 12 34 56 / 065 98 76 54"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Programme sommaire des obsèques (facultatif)
                    </label>
                    <textarea
                      value={necroFuneralProgram}
                      onChange={(e) => setNecroFuneralProgram(e.target.value)}
                      rows={2}
                      placeholder="Ex: Sortie de corps à Casep-Ga, veillée au domicile, messe à Ste-Marie, inhumation au cimetière de Plaine Roberti."
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-slate-700"
                    />
                  </div>
                </div>
              )}
              {/* LOCALISATION GÉOGRAPHIQUE AU GABON (Accessible à toutes les catégories - Point 2) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                      Localisation spatiale au Gabon (9 Provinces)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Quartier détaillé
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      1. Province du Gabon *
                    </label>
                    <select
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        const pObj = GABON_PROVINCES.find((p) => p.name === e.target.value);
                        if (pObj && pObj.cities.length > 0) {
                          setCity(pObj.cities[0].name);
                          setNeighborhood(pObj.cities[0].neighborhoods[0] || '');
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      id="publish-province-select"
                    >
                      {GABON_PROVINCES.map((p) => (
                        <option key={p.code} value={p.name}>
                          {p.name} ({p.capital})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      2. Ville / Commune *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        const cObj = currentProvinceData.cities.find((c) => c.name === e.target.value);
                        if (cObj && cObj.neighborhoods.length > 0) {
                          setNeighborhood(cObj.neighborhoods[0]);
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      id="publish-city-select"
                    >
                      {currentProvinceData.cities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quartier Détaillé avec option de profil par défaut - Point 2 & Point 4 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      3. Quartier / Précision du secteur *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Tapez librement pour détailler votre quartier
                    </span>
                  </div>

                  {/* Option de quartier de profil enregistré (Point 4) */}
                  {profileNeighborhood ? (
                    <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[11px] text-emerald-950 truncate">
                          Quartier habituel de votre profil : <strong>{profileNeighborhood}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNeighborhood(profileNeighborhood);
                          if (profileProvince) setProvince(profileProvince);
                          if (profileCity) setCity(profileCity);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          neighborhood.trim().toLowerCase() === profileNeighborhood.toLowerCase()
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {neighborhood.trim().toLowerCase() === profileNeighborhood.toLowerCase() ? '✓ Quartier actif' : 'Utiliser ce quartier'}
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={saveNeighborhoodToProfile}
                        onChange={(e) => setSaveNeighborhoodToProfile(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Enregistrer ce quartier comme quartier par défaut dans mon profil</span>
                    </label>
                  )}

                  <div className="relative">
                    <input
                      type="text"
                      list="publish-neighborhood-suggestions"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Ex: Louis, Angondjé (Carrefour GP), Nzeng-Ayong, Oloumi..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                      id="publish-neighborhood-input"
                      required
                    />
                    <datalist id="publish-neighborhood-suggestions">
                      {currentCityData.neighborhoods.map((q) => (
                        <option key={q} value={q} />
                      ))}
                    </datalist>
                  </div>

                  {/* Suggestion pills from selected city */}
                  {currentCityData.neighborhoods.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">Suggestions rapides :</span>
                      {currentCityData.neighborhoods.slice(0, 6).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setNeighborhood(q)}
                          className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                            neighborhood === q
                              ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                              : 'bg-white hover:bg-emerald-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONTENT, MEDIA & STRICT CHAR LIMIT */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Point 4: Prominent Category & Subcategory Header */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-slate-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 block">
                      Rubrique sélectionnée
                    </span>
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {getCategoryHeaderSummary()}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Changer de catégorie ou sous-catégorie"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Titre de l'annonce *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Villa de standing 4 chambres avec piscine à La Sablière"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  id="publish-title-input"
                />
              </div>

              {/* Price & Unit (Customized for EMPLOI / Métiers Domestiques) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    {mainCategory === 'EMPLOI' ? 'Salaire proposé / souhaité (en FCFA) *' : 'Prix (en FCFA) *'}
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    placeholder={mainCategory === 'EMPLOI' ? 'Ex: 150000' : 'Ex: 250000'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    id="publish-price-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    {mainCategory === 'EMPLOI' ? 'Périodicité du salaire *' : 'Unité de prix'}
                  </label>
                  <select
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    {mainCategory === 'EMPLOI' ? (
                      <>
                        <option value="mois">Mensuelle (par mois)</option>
                        <option value="jour">Journalière (par jour)</option>
                        <option value="trimestre">Trimestrielle (par trimestre)</option>
                        <option value="an">Annuelle (par an)</option>
                      </>
                    ) : (
                      <>
                        <option value="total">Prix total (Achat définitif)</option>
                        <option value="mois">Par mois (Location mensuelle)</option>
                        <option value="jour">Par jour (Location journalière)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Section C: Mandatory detailed description with min 50 and max chars */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Description détaillée du bien / produit / offre * (Min 50, Max {PRICING_CONFIG.maxCharLength} car.)
                  </label>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      description.trim().length < 50
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {description.trim().length < 50
                      ? `${description.trim().length} / 50 min (${50 - description.trim().length} restant${50 - description.trim().length > 1 ? 's' : ''})`
                      : `${description.trim().length} / ${PRICING_CONFIG.maxCharLength} (Conforme ✓)`}
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => {
                    if (e.target.value.length <= PRICING_CONFIG.maxCharLength) {
                      setDescription(e.target.value);
                      if (mediaError && e.target.value.trim().length >= 50) {
                        setMediaError(null);
                      }
                    }
                  }}
                  rows={4}
                  placeholder="Description détaillée obligatoire (au moins 50 caractères) : décrivez précisément l'article, ses caractéristiques techniques, dimensions, commodités (climatiseur, bâche d'eau, groupe...), situation géographique exacte, conditions de vente ou de location."
                  className={`w-full bg-slate-50 border rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:ring-2 transition-all ${
                    description.trim().length > 0 && description.trim().length < 50
                      ? 'border-amber-400 focus:ring-amber-400'
                      : description.trim().length >= 50
                      ? 'border-emerald-400 focus:ring-emerald-500'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                  id="publish-desc-input"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  * La description est obligatoire et doit comporter au moins 50 caractères afin d'offrir des informations fiables et précises aux acquéreurs.
                </p>
              </div>

              {/* Section C-a: Choix de joindre des images (max 5) ou courte vidéo (max 30s) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                      Photos descriptives ({photos.length}/{PRICING_CONFIG.maxImages || 10})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    5 incluses gratuites, +500 F/photo à partir de la 6e (Max {PRICING_CONFIG.maxImages || 10} photos)
                  </span>
                </div>

                {/* Error message banner */}
                {mediaError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{mediaError}</span>
                  </div>
                )}

                {/* Selected images preview list */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photos.map((item, idx) => (
                    <div key={item.id || idx} className="relative w-20 h-16 rounded-xl overflow-hidden border shrink-0 group bg-slate-100">
                      <img src={item.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {item.file && (
                        <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-xs">
                          Fichier
                        </span>
                      )}
                      {photos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                          title="Supprimer la photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Local photo file upload button */}
                <div>
                  <label
                    className={`cursor-pointer border-2 border-dashed rounded-xl p-3 flex items-center justify-center gap-2 transition-all text-xs font-bold ${
                      photos.length >= (PRICING_CONFIG.maxImages || 10)
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>
                      {photos.length >= (PRICING_CONFIG.maxImages || 10)
                        ? `Limite de ${PRICING_CONFIG.maxImages || 10} photos atteinte`
                        : 'Sélectionner des photos locales (≤ 10 Mo/photo)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoFilesSelect}
                      disabled={photos.length >= (PRICING_CONFIG.maxImages || 10)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Presets to quickly pick test photos (kept as requested by user) */}
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold block mb-1.5">
                    Ou ajouter une photo test suggérée :
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {SAMPLE_IMAGE_PRESETS[mainCategory].map((sample, idx) => {
                      const isAlreadySelected = photos.some((p) => p.url === sample);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddSampleImage(sample)}
                          disabled={isAlreadySelected || photos.length >= (PRICING_CONFIG.maxImages || 10)}
                          className={`w-14 h-12 rounded-lg overflow-hidden border shrink-0 transition-all ${
                            isAlreadySelected
                              ? 'opacity-30 border-emerald-500 cursor-not-allowed'
                              : 'hover:scale-105 hover:border-emerald-600'
                          }`}
                          title={isAlreadySelected ? 'Déjà ajoutée' : 'Ajouter cette photo'}
                        >
                          <img src={sample} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom URL upload */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="Ou collez l'URL d'une image..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomImage}
                    disabled={photos.length >= 5}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {/* Short video option (Section C-a: courte vidéo descriptive ≤ 30s) */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-purple-600" />
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          Option Vidéo Descriptive (+2 000 FCFA)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Courte vidéo (max 30 secondes, ≤ 50 Mo)
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={hasVideo}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasVideo(checked);
                        if (!checked) {
                          handleRemoveVideo();
                        }
                      }}
                      className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Video file picker and preview when option is checked */}
                  {hasVideo && (
                    <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="cursor-pointer bg-white border border-purple-300 hover:bg-purple-100 text-purple-900 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors">
                          <Film className="w-3.5 h-3.5 text-purple-700" />
                          <span>{videoFile ? 'Remplacer la vidéo' : 'Sélectionner le fichier vidéo (≤ 30s)'}</span>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoFileSelect}
                            className="hidden"
                          />
                        </label>

                        {videoFile && (
                          <button
                            type="button"
                            onClick={handleRemoveVideo}
                            className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Retirer</span>
                          </button>
                        )}
                      </div>

                      {videoPreviewUrl ? (
                        <div className="space-y-1.5">
                          <div className="aspect-16/9 max-w-xs rounded-lg overflow-hidden bg-black mx-auto">
                            <video src={videoPreviewUrl} controls className="w-full h-full object-contain" />
                          </div>
                          <div className="text-[11px] text-purple-900 font-semibold text-center">
                            Durée : {videoDuration !== null ? `${videoDuration}s (max 30s)` : 'Déterminée'} •{' '}
                            {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} Mo` : 'Démo'}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-purple-700 italic">
                          Sélectionnez votre fichier vidéo ci-dessus (une vidéo de démonstration sera utilisée à défaut).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section C-c: Contact Téléphonique avec choix entre compte enregistré ou autre numéro (Point 4) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                      Coordonnées de contact pour cette annonce
                    </span>
                  </div>
                  {accountRegisteredPhone && (
                    <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                      Compte : {accountRegisteredPhone}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Votre Nom ou Agence *
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ex: Jean-Marc ONDO ou Agence Prestige"
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      id="publish-name-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Numéro de téléphone Gabon (+241) *
                    </label>

                    {accountRegisteredPhone ? (
                      <div className="space-y-2">
                        {/* Option de choisir entre numéro du compte ou un autre numéro (Point 4) */}
                        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneChoice('ACCOUNT');
                              setContactPhone(accountRegisteredPhone);
                            }}
                            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer ${
                              phoneChoice === 'ACCOUNT'
                                ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            📱 Compte ({accountRegisteredPhone})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneChoice('CUSTOM');
                              if (contactPhone === accountRegisteredPhone) {
                                setContactPhone('');
                              }
                            }}
                            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer ${
                              phoneChoice === 'CUSTOM'
                                ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ✏️ Autre numéro
                          </button>
                        </div>

                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={contactPhone}
                            onChange={(e) => {
                              setContactPhone(e.target.value);
                              if (phoneChoice === 'ACCOUNT') setPhoneChoice('CUSTOM');
                            }}
                            placeholder="+241 77 45 20 18"
                            required
                            className={`w-full border rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 ${
                              phoneChoice === 'ACCOUNT'
                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                            id="publish-phone-input"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {phoneChoice === 'ACCOUNT'
                            ? 'Ce numéro est celui enregistré sur votre compte.'
                            : 'Entrez le numéro spécifique qui recevra les appels et WhatsApp.'}
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+241 77 45 20 18"
                          required
                          className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                          id="publish-phone-input"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DURATION, BILLING & PAYMENT (Section C-b, C-d, C-e) */}
          {step === 3 && (
            <div className="space-y-6">
              {/* APERÇU ET VÉRIFICATION DE L'ANNONCE AVANT PAIEMENT (Point 4) */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-slate-700/80 space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/70">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                      Aperçu avant paiement
                    </span>
                    <h3 className="text-sm font-black text-white">
                      Vérifiez les informations de votre annonce
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Modifier la catégorie ou la localisation"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Éditer Étape 1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Modifier les photos, le titre ou le prix"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Éditer Étape 2</span>
                    </button>
                  </div>
                </div>

                {/* Preview Mini Card */}
                <div className="flex flex-col sm:flex-row gap-4 bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700">
                  {/* Photo thumbnail */}
                  <div className="w-full sm:w-28 sm:h-28 h-36 rounded-xl overflow-hidden bg-slate-950 shrink-0 relative border border-slate-600">
                    <img
                      src={photos[0]?.url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80'}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/75 text-[10px] text-white px-1.5 py-0.2 rounded font-mono">
                      📷 {photos.length} photo{photos.length > 1 ? 's' : ''}
                      {hasVideo ? ' + 🎥' : ''}
                    </span>
                  </div>

                  {/* Summary details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-400 text-slate-950">
                        {mainCategory === 'IMMOBILIER' ? 'Immobilier' :
                         mainCategory === 'MATERIEL_ROULANT' ? 'Matériel Roulant' :
                         mainCategory === 'BRIC_A_BRAC' ? 'Bric-à-Brac' :
                         mainCategory === 'EMPLOI' ? (jobKind === 'DEMANDE_EMPLOI' ? "Demande d'Emploi" : "Offre d'Emploi") :
                         mainCategory === 'COURS_A_DOMICILE' ? (tutoringKind === 'OFFRE' ? 'Offre Cours' : 'Demande Cours') :
                         'Nécrologie'}
                      </span>
                      {mainCategory === 'IMMOBILIER' && (
                        <span className="text-[10px] font-bold bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                          {transactionType === 'VENTE' ? 'Vente' : 'Location'} • {propertyType}
                        </span>
                      )}
                      {mainCategory === 'MATERIEL_ROULANT' && (
                        <span className="text-[10px] font-bold bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                          {vehicleBrand} {vehicleModel}
                        </span>
                      )}
                      {mainCategory === 'EMPLOI' && (
                        <span className="text-[10px] font-bold bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                          {domesticJobType}
                        </span>
                      )}
                      {(isOwnerVerified || isExempt) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-600/90 text-white px-2 py-0.5 rounded-md border border-emerald-400/50 shadow-xs">
                          <ShieldCheck className="w-3 h-3 text-emerald-200" />
                          <span>Vendeur Vérifié</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-white line-clamp-1">
                      {title || 'Titre de votre annonce'}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <div className="flex items-center gap-1 text-emerald-400 font-black">
                        <span>{formatFCFA(Number(price) || 0)}</span>
                        {priceUnit !== 'total' && (
                          <span className="text-[11px] font-normal text-emerald-200">/ {priceUnit}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-slate-300 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="truncate">{province} • {city} • <strong className="text-amber-300 font-bold">{neighborhood || 'Non précisé'}</strong></span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {description || 'Aucune description rédigée'}
                    </p>

                    <div className="text-[10px] text-slate-400 pt-0.5 flex flex-wrap items-center gap-2">
                      <span>Contact : <strong className="text-white">{contactName || 'Annonceur'}</strong> ({contactPhone})</span>
                      <span>•</span>
                      <span>Durée choisie : <strong className="text-amber-400">{durationDays} jours</strong></span>
                    </div>
                  </div>
                </div>
              </div>
              {/* If user is exempt (VIP / Partenaire) */}
              {isExempt && (
                <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                      <Star className="w-5 h-5 fill-slate-950" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        Compte Partenaire VIP Exonéré
                      </h4>
                      <p className="text-xs text-slate-600">
                        Votre compte bénéficie d'une publication 100% gratuite sans frais de diffusion Mobile Money et sans KYC requis.
                      </p>
                    </div>
                  </div>
                  <span className="bg-amber-500 text-slate-950 text-xs font-black px-3 py-1 rounded-xl shrink-0">
                    0 FCFA
                  </span>
                </div>
              )}


              {/* Requirement 4: Subscription required for more than 3 simultaneous ads */}
              {requiresSubscription && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                      Quota standard ({maxQuota} annonces) atteint
                    </span>
                    <h4 className="font-extrabold text-xs text-slate-900">
                      Abonnement Pro, Élite ou Business requis (Au-delà de 3 annonces simultanées)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pour diffuser plus de 3 annonces simultanément, vous devez souscrire à un forfait d'abonnement. Choisissez la formule qui convient à votre volume d'activité :
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTierToBuy('PRO')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selectedTierToBuy === 'PRO'
                          ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-md'
                          : 'border-slate-200 bg-white/70 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">🥉 Pro</span>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Jusqu'à 8</span>
                      </div>
                      <div className="text-sm font-black text-blue-700 mt-1">29 000 FCFA/m</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">+1 boost offert/m</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTierToBuy('ELITE')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selectedTierToBuy === 'ELITE'
                          ? 'border-purple-600 bg-white ring-2 ring-purple-500/20 shadow-md'
                          : 'border-slate-200 bg-white/70 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">🥈 Élite</span>
                        <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">Jusqu'à 14</span>
                      </div>
                      <div className="text-sm font-black text-purple-700 mt-1">59 000 FCFA/m</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">+3 boosts offerts/m</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTierToBuy('BUSINESS')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selectedTierToBuy === 'BUSINESS'
                          ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-md'
                          : 'border-slate-200 bg-white/70 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">🥇 Business</span>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Jusqu'à 20</span>
                      </div>
                      <div className="text-sm font-black text-emerald-700 mt-1">99 000 FCFA/m</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">+6 boosts offerts/m</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Requirement 6: Option Booster en tête de liste */}
              <div
                onClick={() => setIsBoostFeatured(!isBoostFeatured)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isBoostFeatured
                    ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/30 shadow-md'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                      isBoostFeatured ? 'bg-amber-400 text-slate-950 shadow-sm' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Sparkles className="w-5 h-5 fill-slate-950 text-slate-950" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-xs text-slate-900 uppercase tracking-wide">
                          Option "Mettre en Tête de Liste" (7 jours)
                        </h4>
                        <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-sm">
                          POPULAIRE
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        Épingle votre annonce tout en haut du catalogue public dès sa validation par la modération.
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-xs text-emerald-800 block">
                      {hasFreeBoost ? 'Inclus (Abonnement)' : isExempt ? 'Offert VIP' : '+5 000 FCFA'}
                    </span>
                    <span className={`text-[10px] font-bold ${isBoostFeatured ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {isBoostFeatured ? 'Activé ✓' : '+ Ajouter'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section C-b: Choix de la durée (nombre de jours) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  b- Choisissez la durée de votre annonce sur le site (Section C-b)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PRICING_CONFIG.durations.map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setDurationDays(d.days)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        durationDays === d.days
                          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-extrabold text-xs text-slate-900">{d.label}</div>
                      <div className="text-sm font-black text-emerald-700 mt-1">
                        {isExempt ? '0 FCFA (VIP)' : formatFCFA(d.price)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section C-d: Facturation automatique */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-200">
                      d- Facturation Déterminée (Section C-d)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Devise: FCFA (XAF)</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Forfait durée ({durationDays} jours) :</span>
                    <span className="font-mono font-bold text-white">
                      {isExempt
                        ? '0 FCFA'
                        : isBasePostingCovered
                        ? 'Inclus (Abonnement)'
                        : formatFCFA(bill.basePrice)}
                    </span>
                  </div>

                  {requiresSubscription && (
                    <div className="flex justify-between text-amber-300">
                      <span>Abonnement {selectedTierToBuy} (1 mois) :</span>
                      <span className="font-mono font-bold">+{formatFCFA(subscriptionCost)}</span>
                    </div>
                  )}

                  {isBoostFeatured && (
                    <div className="flex justify-between text-amber-300">
                      <span>Option "En Tête de Liste" (7 jours) :</span>
                      <span className="font-mono font-bold">
                        {hasFreeBoost ? '0 FCFA (Inclus)' : isExempt ? '0 FCFA (VIP)' : '+5 000 FCFA'}
                      </span>
                    </div>
                  )}

                  {bill.extraPhotosCount > 0 ? (
                    <div className="flex justify-between text-slate-300">
                      <span>{bill.extraPhotosCount} photo(s) au-delà des 5 incluses :</span>
                      <span className="font-mono font-bold text-white">
                        {isExempt ? '0 FCFA' : formatFCFA(bill.extraPhotosCost)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Photos descriptives ({photos.length}/5 incluses gratuites) :</span>
                      <span className="font-mono text-emerald-400 font-bold">0 FCFA</span>
                    </div>
                  )}

                  {hasVideo && (
                    <div className="flex justify-between text-slate-300">
                      <span>Option courte vidéo descriptive :</span>
                      <span className="font-mono font-bold text-white">
                        {isExempt ? '0 FCFA' : formatFCFA(bill.videoCost)}
                      </span>
                    </div>
                  )}

                  {isExempt && (
                    <div className="flex justify-between text-amber-400 font-bold">
                      <span>Exonération Partenaire VIP :</span>
                      <span className="font-mono font-bold">- 100%</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-sm">
                    <span className="font-black text-amber-400 uppercase tracking-wider">
                      Total Facturé :
                    </span>
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {isExempt ? '0 FCFA' : formatFCFA(totalBillCalculated)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment or direct free validation */}
              {isExempt || totalBillCalculated === 0 ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                    <Star className="w-6 h-6 fill-slate-950" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-slate-900">
                      {isExempt ? 'Validation Directe Partenaire VIP' : 'Publication Incluse dans votre Quota'}
                    </h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto mt-0.5">
                      {isExempt
                        ? "Aucun débit Mobile Money requis pour les partenaires VIP. Votre annonce est directement transmise à l'équipe de modération."
                        : "Cette annonce est couverte par votre pack ou abonnement actif. Aucun frais supplémentaire requis."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handlePaymentSuccess({
                        operator: 'AIRTEL_MONEY',
                        contactPhone: contactPhone,
                        transactionRef: isExempt
                          ? `VIP-${Date.now().toString(36).toUpperCase()}`
                          : `PACK-${Date.now().toString(36).toUpperCase()}`,
                      })
                    }
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-200" />
                    <span>Valider & Transmettre à la Modération (0 FCFA)</span>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                      Étape e
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      Choisissez votre moyen de paiement Mobile Gabon
                    </h4>
                  </div>

                  {/* CGU Acceptance & Disclaimer Notice (Point 2) */}
                  <div className="mb-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-center justify-between gap-3">
                    <span>
                      En procédant au règlement, vous reconnaissez avoir pris connaissance des <strong>Conditions Générales d'Utilisation</strong> et de la <strong>Clause de non-responsabilité</strong> de BIZBOOSTER Gabon.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCguModal(true)}
                      className="shrink-0 text-emerald-700 hover:text-emerald-800 font-extrabold underline text-xs cursor-pointer"
                    >
                      Consulter les CGU
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <MobilePaymentSimulator
                      amount={totalBillCalculated}
                      itemDescription={`Publication ${title || mainCategory} (${durationDays} jours)`}
                      onSuccess={handlePaymentSuccess}
                      onCancel={() => setStep(2)}
                      initialPhone={contactPhone || currentUser?.contactPhone}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUBMITTED TO MODERATION & CONFIRMATION */}
          {step === 4 && createdAd && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto border-2 border-amber-400 shadow-lg">
                <Clock className="w-10 h-10" />
              </div>

              <div>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase px-2.5 py-0.5 rounded-full">
                  Paiement Réussi • Transmis à la modération
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  Votre annonce est en cours de validation
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                  Afin de garantir la fiabilité du réseau et prévenir les fraudes foncières et commerciales au Gabon, un modérateur vérifie chaque publication avant sa mise en ligne publique (délai d'examen et publication : sous 24 heures).
                </p>
              </div>

              {/* Verification Preview Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto text-left shadow-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={createdAd.images[0]}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                          createdAd.transactionType === 'EMPLOYER' || createdAd.mainCategory === 'EMPLOI'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : createdAd.transactionType === 'VENTE'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {createdAd.mainCategory === 'EMPLOI' || createdAd.transactionType === 'EMPLOYER' ? 'À EMPLOYER' : (createdAd.transactionType ? (createdAd.transactionType === 'VENTE' ? 'À VENDRE' : 'À LOUER') : createdAd.mainCategory)}
                      </span>
                      <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 px-1.5 py-0.2 rounded">
                        En attente d'approbation
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 truncate">{createdAd.title}</h4>
                    <p className="text-sm font-black text-emerald-700 mt-1">
                      {formatFCFA(createdAd.price)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Durée de publication : {createdAd.durationDays} jours
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                {onSwitchToUserDashboard && (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchToUserDashboard();
                      onClose();
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-colors flex items-center gap-2"
                  >
                    <span>Suivre dans Mon Espace Annonceur</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-colors shadow-sm"
                >
                  Retourner au Catalogue
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls (Step 1 & Step 2) */}
        {step < 3 && (
          <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              disabled={isUltimateCeilingReached}
              onClick={() => {
                if (isUltimateCeilingReached) return;
                if (step === 1) {
                  if (!neighborhood.trim()) {
                    setMediaError('Veuillez préciser ou détailler le quartier de votre bien / service.');
                    const el = document.getElementById('publish-neighborhood-input');
                    if (el) el.focus();
                    return;
                  }
                  setMediaError(null);
                  setStep(2);
                } else if (step === 2) {
                  const trimmedDesc = description.trim();
                  if (trimmedDesc.length < 50) {
                    setMediaError(
                      `La description détaillée est obligatoire et doit comporter au moins 50 caractères (actuellement : ${trimmedDesc.length}/50 caractères). Veuillez détailler davantage votre bien ou service.`
                    );
                    const el = document.getElementById('publish-desc-input');
                    if (el) el.focus();
                    return;
                  }

                  if (photos.length === 0) {
                    setMediaError('Veuillez ajouter au moins une photo pour votre annonce.');
                    return;
                  }

                  if (!contactName.trim()) {
                    setMediaError('Veuillez renseigner votre nom ou le nom de votre agence.');
                    return;
                  }

                  if (!contactPhone.trim()) {
                    setMediaError('Veuillez renseigner un contact téléphonique valide au Gabon.');
                    return;
                  }

                  if (!title.trim()) {
                    let genTitle = '';
                    if (mainCategory === 'IMMOBILIER') {
                      genTitle = `${transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${propertyType} à ${neighborhood}, ${city}`;
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
                    }
                    setTitle(genTitle || mainCategory);
                  }
                  setMediaError(null);
                  setStep(3);
                  modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              id="publish-next-step"
            >
              <span>{step === 2 ? 'Passer à la facturation & paiement' : 'Suivant'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* CGU & Disclaimer Modal (Point 2) */}
        <CguModal isOpen={showCguModal} onClose={() => setShowCguModal(false)} />

        {/* Loading / Uploading Overlay during secure media transfer */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-6 text-center text-white rounded-3xl animate-in fade-in">
            <Loader2 className="w-12 h-12 animate-spin text-amber-400 mb-3" />
            <h3 className="text-base font-extrabold tracking-tight">Enregistrement sécurisé de vos médias...</h3>
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
