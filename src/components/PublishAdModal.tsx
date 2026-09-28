import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, auth, db } from '../services/firebase';
import {
  Ad,
  BricABracCategory,
  DomesticJobType,
  MainCategory,
  PaymentOperator,
  PropertyType,
  RollingStockCategory,
  TransactionType,
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
  PRICING_CONFIG,
} from '../data/categoriesData';
import { calculateBill, formatFCFA } from '../utils/formatters';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';
import { UserProfile } from '../types';

interface PublishAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdPublished: (newAd: Ad) => void | Promise<void>;
  currentUser?: UserProfile | null;
  onSwitchToAdmin?: () => void;
  onSwitchToUserDashboard?: () => void;
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
};

interface PhotoMediaItem {
  id: string;
  url: string;
  file?: File;
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
}) => {
  if (!isOpen) return null;

  // Wizard Step: 1 = Categorization, 2 = Content & Media, 3 = Billing & Payment, 4 = Confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Exemption and KYC state
  const isExempt = Boolean(currentUser?.exemptFromPaymentAndKyc || currentUser?.isExempt || currentUser?.role === 'ADMIN');
  const isKycVerified = currentUser?.idVerificationStatus === 'VERIFIED';
  const isKycPending = currentUser?.idVerificationStatus === 'PENDING';
  const isKycRejected = currentUser?.idVerificationStatus === 'REJECTED';

  // Standard users MUST be validated by the team before they can start putting an ad
  const isAllowedToPublish = isExempt || isKycVerified;

  const [kycDocType, setKycDocType] = useState<'CNI' | 'CARTE_SEJOUR' | 'PASSPORT'>(
    currentUser?.idDocumentType || 'CNI'
  );
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [kycPreviewUrl, setKycPreviewUrl] = useState<string | null>(
    currentUser?.idDocumentUrl || null
  );
  const [isUploadingKyc, setIsUploadingKyc] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);

  const handleGateKycSubmit = async () => {
    if (!kycFile && !currentUser?.idDocumentUrl) {
      setKycError('Veuillez sélectionner une photo lisible de votre pièce d’identité.');
      return;
    }
    const uid = currentUser?.id || auth.currentUser?.uid;
    if (!uid) {
      setKycError('Session expirée ou utilisateur non connecté.');
      return;
    }

    setIsUploadingKyc(true);
    setKycError(null);

    try {
      let finalUrl = currentUser?.idDocumentUrl || '';
      if (kycFile) {
        setUploadProgressText("Téléversement sécurisé de votre pièce d'identité...");
        const storagePath = `kyc/${uid}/${Date.now()}_id_${kycFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, kycFile);
        finalUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, 'users', uid), {
        idDocumentUrl: finalUrl,
        idDocumentType: kycDocType,
        idVerificationStatus: 'PENDING',
        idSubmittedAt: new Date().toISOString(),
        idRejectionReason: null,
      });
    } catch (err: any) {
      console.error(err);
      setKycError(err?.message || "Erreur lors de l'enregistrement de votre pièce d'identité.");
    } finally {
      setIsUploadingKyc(false);
      setUploadProgressText('');
    }
  };

  // Form State
  const [mainCategory, setMainCategory] = useState<MainCategory>('IMMOBILIER');
  
  // Specific detail requested: Vente vs Location
  const [transactionType, setTransactionType] = useState<TransactionType>('LOCATION');
  
  // Immobilier specifics
  const [propertyType, setPropertyType] = useState<PropertyType>('Villa');
  const [province, setProvince] = useState<string>('Estuaire');
  const [city, setCity] = useState<string>('Libreville');
  const [neighborhood, setNeighborhood] = useState<string>('La Sablière');

  // Matériel Roulant specifics
  const [vehicleCategory, setVehicleCategory] = useState<RollingStockCategory>('Voitures');
  const [vehicleBrand, setVehicleBrand] = useState<string>('TOYOTA');
  const [vehicleModel, setVehicleModel] = useState<string>('Hilux');

  // Bric-à-Brac specifics
  const [bricCategory, setBricCategory] = useState<BricABracCategory>('Électronique & Smartphones');

  // Emploi specifics
  const [domesticJobType, setDomesticJobType] = useState<DomesticJobType>('Nounous (garde-bébé)');

  // Step 2 Fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number>(350000);
  const [priceUnit, setPriceUnit] = useState<'total' | 'mois' | 'jour'>('mois');
  const [description, setDescription] = useState('');
  
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
  const [contactPhone, setContactPhone] = useState(currentUser?.contactPhone || '');
  const [durationDays, setDurationDays] = useState<number>(15);

  // Newly created ad for verification view
  const [createdAd, setCreatedAd] = useState<Ad | null>(null);

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

    const newItems: PhotoMediaItem[] = filesToAdd.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      url: URL.createObjectURL(file),
      file,
    }));

    setPhotos((prev) => [...prev, ...newItems]);
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
      if (removed.file && removed.url.startsWith('blob:')) {
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

    // Duration limit: 30 seconds max
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    const blobUrl = URL.createObjectURL(file);

    tempVideo.onloadedmetadata = () => {
      const duration = Math.round(tempVideo.duration);
      if (duration > 30) {
        URL.revokeObjectURL(blobUrl);
        setMediaError(`La durée de la vidéo (${duration}s) dépasse la limite maximale autorisée de 30 secondes.`);
      } else {
        if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(videoPreviewUrl);
        }
        setVideoFile(file);
        setVideoPreviewUrl(blobUrl);
        setVideoDuration(duration);
        setHasVideo(true);
        setMediaError(null);
      }
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      setMediaError('Impossible de lire le format de cette vidéo. Veuillez sélectionner un fichier vidéo standard (MP4 ou WebM).');
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
    const hasUserFiles = photos.some((p) => p.file);
    if (!hasUserFiles) {
      setPhotos([{ id: `preset-${Date.now()}`, url: SAMPLE_IMAGE_PRESETS[cat][0] }]);
    }
    if (cat === 'IMMOBILIER') {
      setPriceUnit(transactionType === 'LOCATION' ? 'mois' : 'total');
    } else if (cat === 'MATERIEL_ROULANT') {
      setPriceUnit(transactionType === 'LOCATION' ? 'jour' : 'total');
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
          setUploadProgressText(`Téléversement de la photo ${i + 1}/${photos.length} sur Firebase Storage...`);
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
          setUploadProgressText('Téléversement de la vidéo descriptive (≤ 30s) sur Firebase Storage...');
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
            : undefined,
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
        price: Number(price) || 50000,
        priceUnit,
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
        paidAmount: isExempt ? 0 : bill.total,
        paymentMethod: isExempt ? ('AIRTEL_MONEY' as PaymentOperator) : paymentInfo.operator,
        transactionRef: isExempt ? (paymentInfo.transactionRef || `VIP-${Date.now().toString(36).toUpperCase()}`) : paymentInfo.transactionRef,
        viewsCount: 0,
      };

      await onAdPublished(newAd);
      setCreatedAd(newAd);
      setStep(4);
    } catch (e: any) {
      console.error(e);
      alert("L'annonce n'a pas pu être enregistrée : " + (e?.message || 'Vérifiez votre connexion et réessayez.'));
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-emerald-950 text-white px-6 py-4 flex items-center justify-between border-b border-emerald-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                Publication BIZBOOSTER
              </span>
              <span className="text-xs text-emerald-300 font-semibold">
                {!isAllowedToPublish
                  ? (isKycPending ? 'Examen en cours' : isKycRejected ? 'Nouvelle pièce requise' : 'Étape préalable obligatoire')
                  : `Étape ${step} sur 3`}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
              {!isAllowedToPublish ? (
                isKycPending
                  ? 'Compte annonceur en cours de validation par l’équipe'
                  : isKycRejected
                  ? 'Nouvelle pièce d’identité requise (Refusée)'
                  : 'Validation préalable de vos identifiants par l’équipe'
              ) : (
                <>
                  {step === 1 && '1. Catégorie & Localisation spatiale'}
                  {step === 2 && '2. Détails, Photos & Description (min 50 car.)'}
                  {step === 3 && (isExempt ? '3. Validation Partenaire VIP (Publication Gratuite)' : '3. Facturation & Paiement Mobile (Airtel / Moov)')}
                  {step === 4 && '4. Annonce En Ligne !'}
                </>
              )}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting || isUploadingKyc}
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
              width: !isAllowedToPublish
                ? '100%'
                : `${step === 1 ? 33 : step === 2 ? 66 : 100}%`
            }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {/* PREREQUISITE GATE: STANDARD USERS MUST HAVE CREDENTIALS VALIDATED BEFORE PUTTING AN AD */}
          {!isAllowedToPublish ? (
            <div className="space-y-6">
              {isKycPending ? (
                /* Gate Pending View */
                <div className="text-center py-6 sm:py-8 space-y-5 animate-in fade-in">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border-2 border-amber-400 shadow-md">
                    <Clock className="w-9 h-9 sm:w-11 sm:h-11" />
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase px-3 py-1 rounded-full inline-block">
                      Dossier en cours d’examen
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                      Votre compte est en cours de validation
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Pour garantir la sécurité des transactions et éliminer les faux démarcheurs et arnaques au Gabon,{' '}
                      <strong>votre compte doit être validé par notre équipe avant de pouvoir commencer le dépôt d’une annonce</strong>.
                    </p>
                  </div>

                  {/* Status Summary Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 max-w-md mx-auto text-left space-y-2.5">
                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-bold">Document transmis :</span>
                      <span className="font-extrabold text-slate-900">
                        {currentUser?.idDocumentType === 'CNI'
                          ? 'Carte Nationale d’Identité (CNI)'
                          : currentUser?.idDocumentType === 'PASSPORT'
                          ? 'Passeport'
                          : 'Carte de Séjour'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-bold">Contact associé :</span>
                      <span className="font-mono font-bold text-slate-900">{currentUser?.contactPhone}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">Délai d’examen :</span>
                      <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Sous 24 heures maximum
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3.5 rounded-2xl max-w-md mx-auto flex items-start gap-2.5 text-left">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Dès que notre équipe aura approuvé votre document, vous pourrez immédiatement déposer vos annonces sur BIZBOOSTER Gabon.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    {onSwitchToUserDashboard && (
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchToUserDashboard();
                          onClose();
                        }}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                      >
                        Consulter mon Espace Annonceur
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              ) : (
                /* Gate Upload View */
                <div className="space-y-5 animate-in fade-in">
                  {isKycRejected ? (
                    <div className="bg-red-50 border-2 border-red-300 p-4 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-sm text-red-950">
                          Pièce d’identité refusée par l’équipe
                        </h4>
                        <p className="text-xs text-red-800 mt-1 leading-relaxed">
                          Motif du refus : <strong>{currentUser?.idRejectionReason || 'Document illisible ou non conforme'}</strong>.
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          Veuillez transmettre une photo nette et lisible d’un document officiel en cours de validité ci-dessous pour que l’équipe puisse valider votre compte.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border-2 border-amber-400 p-4 rounded-2xl flex items-start gap-3">
                      <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          Validation préalable obligatoire de vos identifiants (Lutte anti-fraude Gabon)
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          Vous ne pouvez pas commencer le dépôt d’une annonce avant que votre pièce d’identité n’ait été validée par notre équipe. 
                          Cette mesure protège les acheteurs et élimine les fraudes au Gabon. L’examen est réalisé <strong>sous 24 heures</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {kycError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{kycError}</span>
                    </div>
                  )}

                  {/* Document Type Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      1. Choisissez le type de pièce d’identité
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setKycDocType('CNI')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          kycDocType === 'CNI'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                        <span className="block font-black">CNI Gabonaise</span>
                        <span className="text-[10px] text-slate-500 font-normal">Carte d’Identité</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKycDocType('CARTE_SEJOUR')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          kycDocType === 'CARTE_SEJOUR'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <FileText className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                        <span className="block font-black">Carte de Séjour</span>
                        <span className="text-[10px] text-slate-500 font-normal">Résident Gabon</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKycDocType('PASSPORT')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          kycDocType === 'PASSPORT'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                        <span className="block font-black">Passeport</span>
                        <span className="text-[10px] text-slate-500 font-normal">En cours de validité</span>
                      </button>
                    </div>
                  </div>

                  {/* Document Photo Picker */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      2. Photo nette de votre pièce (≤ 10 Mo)
                    </label>

                    {kycPreviewUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2.5">
                        <img
                          src={kycPreviewUrl}
                          alt="Pièce d'identité"
                          className="w-full max-h-56 object-contain rounded-xl"
                        />
                        <label className="mt-2 block cursor-pointer text-center text-xs font-bold text-emerald-700 hover:underline">
                          Changer la photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                if (f.size > 10 * 1024 * 1024) {
                                  setKycError('La photo dépasse la taille maximale autorisée de 10 Mo.');
                                  return;
                                }
                                setKycError(null);
                                setKycFile(f);
                                setKycPreviewUrl(URL.createObjectURL(f));
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all">
                        <Upload className="w-8 h-8 text-emerald-600 mb-2" />
                        <span className="text-xs font-extrabold text-slate-900 block">
                          Cliquez pour sélectionner la photo de votre pièce d’identité
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5">
                          Format photo (JPG, PNG) • Document net, lisible et non rogné
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              if (f.size > 10 * 1024 * 1024) {
                                setKycError('La photo dépasse la taille maximale autorisée de 10 Mo.');
                                return;
                              }
                              setKycError(null);
                              setKycFile(f);
                              setKycPreviewUrl(URL.createObjectURL(f));
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      Annuler & Fermer
                    </button>

                    <button
                      type="button"
                      disabled={isUploadingKyc || (!kycFile && !currentUser?.idDocumentUrl)}
                      onClick={handleGateKycSubmit}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      {isUploadingKyc ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Téléversement…</span>
                        </>
                      ) : (
                        <>
                          <span>Transmettre ma pièce pour validation</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* STEP 1: CATEGORIZATION & SPATIAL RUBRICS */}
              {step === 1 && (
            <div className="space-y-5">
              {/* Category Selector (4 options from document) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Choisissez la catégorie principale (Section B)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('IMMOBILIER')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'IMMOBILIER'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400 text-emerald-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <span className="font-bold text-xs block">IMMOBILIER</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('MATERIEL_ROULANT')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'MATERIEL_ROULANT'
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-400 text-blue-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Car className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <span className="font-bold text-xs block">MATÉRIEL ROULANT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('BRIC_A_BRAC')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'BRIC_A_BRAC'
                        ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400 text-amber-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Package className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                    <span className="font-bold text-xs block">BRIC-À-BRAC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMainCategoryChange('EMPLOI')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      mainCategory === 'EMPLOI'
                        ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-400 text-purple-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Briefcase className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                    <span className="font-bold text-xs block">EMPLOI MAISONS</span>
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

              {/* SPECIFIC FIELDS: IMMOBILIER (9 Provinces > Villes > Quartiers as per Section B-1) */}
              {mainCategory === 'IMMOBILIER' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                      Rubriques spatiales (9 Provinces du Gabon)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        1. Province du Gabon
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
                        2. Ville / Localité
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

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        3. Quartier
                      </label>
                      <select
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                        id="publish-neighborhood-select"
                      >
                        {currentCityData.neighborhoods.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Type de Bien Immobilier
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

              {/* SPECIFIC FIELDS: EMPLOI / EMPLOYÉS DE MAISONS (Section B-3) */}
              {mainCategory === 'EMPLOI' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Spécialité Employé de Maison (Section B-3)
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
              )}
            </div>
          )}

          {/* STEP 2: CONTENT, MEDIA & STRICT CHAR LIMIT */}
          {step === 2 && (
            <div className="space-y-4">
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

              {/* Price & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Prix (en FCFA) *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    id="publish-price-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Unité de prix
                  </label>
                  <select
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value as 'total' | 'mois' | 'jour')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="total">Prix total (Achat définitif)</option>
                    <option value="mois">Par mois (Location mensuelle)</option>
                    <option value="jour">Par jour (Location journalière)</option>
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
                      photos.length >= 5
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>
                      {photos.length >= 5
                        ? 'Limite de 5 photos atteinte'
                        : 'Sélectionner des photos locales (≤ 10 Mo/photo)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoFilesSelect}
                      disabled={photos.length >= 5}
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
                          disabled={isAlreadySelected || photos.length >= 5}
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

              {/* Section C-c: Contact Téléphonique */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Votre Nom ou Agence *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Jean-Marc ONDO ou Agence Prestige"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    id="publish-name-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Contact Téléphonique Gabon (+241) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+241 77 45 20 18"
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      id="publish-phone-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DURATION, BILLING & PAYMENT (Section C-b, C-d, C-e) */}
          {step === 3 && (
            <div className="space-y-6">
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

              {/* If standard user with KYC */}
              {!isExempt && isKycVerified && (
                <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Identité Vérifiée ({currentUser?.idDocumentType || 'CNI'}) • Compte autorisé à diffuser</span>
                </div>
              )}

              {!isExempt && isKycPending && (
                <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-bold">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Pièce d'identité soumise en cours d'examen par la modération. Vous pouvez finaliser la publication.</span>
                </div>
              )}

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
                      {isExempt ? '0 FCFA' : formatFCFA(bill.basePrice)}
                    </span>
                  </div>

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
                      {isExempt ? '0 FCFA' : formatFCFA(bill.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment or VIP direct validation */}
              {isExempt ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                    <Star className="w-6 h-6 fill-slate-950" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-slate-900">Validation Directe Partenaire</h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto mt-0.5">
                      Aucun débit Mobile Money requis. Cliquez ci-dessous pour transmettre directement votre annonce à la modération.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handlePaymentSuccess({
                        operator: 'AIRTEL_MONEY',
                        contactPhone: contactPhone,
                        transactionRef: `VIP-${Date.now().toString(36).toUpperCase()}`,
                      })
                    }
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-200" />
                    <span>Valider & Publier Gratuitement (Exonération VIP)</span>
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

                  <div className="flex justify-center">
                    <MobilePaymentSimulator
                      amount={bill.total}
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
                          createdAd.transactionType === 'VENTE' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {createdAd.transactionType || createdAd.mainCategory}
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
                      Réf paiement : {createdAd.transactionRef} ({createdAd.durationDays}j)
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
            </>
          )}
        </div>

        {/* Modal Footer Controls (Step 1 & Step 2 for authorized users only) */}
        {isAllowedToPublish && step < 3 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
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
              onClick={() => {
                if (step === 1) {
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
                    setTitle(
                      `${transactionType === 'VENTE' ? 'Vente' : 'Location'} - ${
                        mainCategory === 'IMMOBILIER'
                          ? `${propertyType} à ${neighborhood}, ${city}`
                          : mainCategory === 'MATERIEL_ROULANT'
                          ? `${vehicleBrand} ${vehicleModel}`
                          : mainCategory
                      }`
                    );
                  }
                  setMediaError(null);
                  setStep(3);
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

        {/* Loading / Uploading Overlay during media transfer to Firebase Storage */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-6 text-center text-white rounded-3xl animate-in fade-in">
            <Loader2 className="w-12 h-12 animate-spin text-amber-400 mb-3" />
            <h3 className="text-base font-extrabold tracking-tight">Téléversement sur Firebase Storage...</h3>
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
