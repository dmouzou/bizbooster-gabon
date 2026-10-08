import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  AlertTriangle,
  Upload,
  Trash2,
  Plus,
  CheckCircle2,
  Building2,
  Car,
  ShoppingBag,
  Briefcase,
  MapPin,
  Smartphone,
  User,
  Film,
  Loader2,
  ShieldAlert,
  Heart,
  GraduationCap,
  Search,
  UserCheck,
  Crown,
  FileText,
  Download,
} from 'lucide-react';
import {
  Ad,
  MainCategory,
  TransactionType,
  PropertyType,
  RollingStockCategory,
  BricABracCategory,
  DomesticJobType,
  JobAdKind,
  NecrologieMinistry,
  AvisRechercheCategory,
  AutresEmploisSubCategory,
  TutoringSubject,
  TutoringLevel,
  TutoringAdKind,
} from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';
import {
  NECROLOGIE_MINISTRIES,
  AVIS_RECHERCHE_CATEGORIES,
  AUTRES_EMPLOIS_SUBCATEGORIES,
  TUTORING_SUBJECTS,
  TUTORING_LEVELS,
} from '../data/categoriesData';
import { isAdVipCornerEligible } from '../utils/vipCorner';
import { auth, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImageForUpload } from '../utils/imageCompressor';
import { trackDownloadRequest } from '../services/platformMetrics';

interface EditAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: Ad | null;
  onSave: (adId: string, updatedFields: Partial<Ad>, wasActive: boolean) => Promise<void>;
}

export const EditAdModal: React.FC<EditAdModalProps> = ({
  isOpen,
  onClose,
  ad,
  onSave,
}) => {
  if (!isOpen || !ad) return null;

  const wasActive = ad.status === 'ACTIVE';
  const isRejected = ad.status === 'REJECTED';

  // Form states
  const [title, setTitle] = useState(ad.title || '');
  const [description, setDescription] = useState(ad.description || '');
  const [price, setPrice] = useState(ad.price ? String(ad.price) : '');
  const [priceMax, setPriceMax] = useState(ad.priceMax ? String(ad.priceMax) : '');
  const [priceUnit, setPriceUnit] = useState<'total' | 'mois' | 'jour' | 'heure'>(
    ad.priceUnit || 'total'
  );
  const [mainCategory, setMainCategory] = useState<MainCategory>(ad.mainCategory || 'IMMOBILIER');
  const [transactionType, setTransactionType] = useState<TransactionType>(
    ad.transactionType || 'VENTE'
  );

  // Property fields
  const [propertyType, setPropertyType] = useState<PropertyType>(ad.propertyType || 'Appartement');

  // Vehicle fields
  const [vehicleCategory, setVehicleCategory] = useState<RollingStockCategory>(
    ad.vehicleData?.category || 'Voitures'
  );
  const [vehicleBrand, setVehicleBrand] = useState(ad.vehicleData?.brand || '');
  const [vehicleModel, setVehicleModel] = useState(ad.vehicleData?.model || '');

  // Bric-a-brac fields
  const [bricCategory, setBricCategory] = useState<BricABracCategory>(
    ad.bricCategory || 'Électronique & Smartphones'
  );

  // Emploi fields
  const [domesticJobType, setDomesticJobType] = useState<DomesticJobType>(
    ad.domesticJobType || 'Gardiens de nuit / de jour'
  );
  const [jobKind, setJobKind] = useState<JobAdKind>(
    ad.jobKind || (ad.transactionType === 'CHERCHE_EMPLOI' ? 'DEMANDE_EMPLOI' : 'OFFRE_EMPLOI')
  );

  // Nécrologie fields (Point 1: User can edit ministry)
  const [necroMinistry, setNecroMinistry] = useState<NecrologieMinistry>(
    ad.necrologieData?.ministry || 'Éducation nationale'
  );
  const [necroDeceasedName, setNecroDeceasedName] = useState(ad.necrologieData?.deceasedName || '');
  const [necroCeremonyDate, setNecroCeremonyDate] = useState(ad.necrologieData?.ceremonyDate || '');
  const [necroCeremonyLocation, setNecroCeremonyLocation] = useState(ad.necrologieData?.ceremonyLocation || '');
  const [necroFuneralProgram, setNecroFuneralProgram] = useState(ad.necrologieData?.funeralProgram || '');
  const [necroFamilyContact, setNecroFamilyContact] = useState(ad.necrologieData?.familyContact || '');

  // Cours à Domicile fields
  const [tutoringKind, setTutoringKind] = useState<TutoringAdKind>(ad.tutoringData?.kind || 'OFFRE');
  const [tutoringSubject, setTutoringSubject] = useState<TutoringSubject>(ad.tutoringData?.subject || 'Mathématiques');
  const [tutoringLevel, setTutoringLevel] = useState<TutoringLevel>(ad.tutoringData?.level || 'Tous niveaux');

  // Avis de Recherche fields (Point 2)
  const [avisCategory, setAvisCategory] = useState<AvisRechercheCategory>(
    ad.avisRechercheData?.category || 'Personne disparue'
  );
  const [avisTargetName, setAvisTargetName] = useState(ad.avisRechercheData?.targetName || '');
  const [avisLastSeenDate, setAvisLastSeenDate] = useState(ad.avisRechercheData?.lastSeenDate || '');
  const [avisLastSeenLocation, setAvisLastSeenLocation] = useState(ad.avisRechercheData?.lastSeenLocation || '');
  const [avisHasReward, setAvisHasReward] = useState(Boolean(ad.avisRechercheData?.hasReward || (ad.avisRechercheData?.rewardAmount && ad.avisRechercheData.rewardAmount > 0)));
  const [avisRewardAmount, setAvisRewardAmount] = useState<number | ''>(ad.avisRechercheData?.rewardAmount || '');
  const [avisEmergencyContact, setAvisEmergencyContact] = useState(ad.avisRechercheData?.contactEmergency || '');

  // Autres Emplois fields (Point 2: Demandeur d'emploi + CV)
  const [autresEmploisSubCategory, setAutresEmploisSubCategory] = useState<AutresEmploisSubCategory>(
    ad.autresEmploisData?.subCategory || "Demandeur d'emploi"
  );
  const [autresEmploisProfession, setAutresEmploisProfession] = useState(ad.autresEmploisData?.profession || '');
  const [autresEmploisContractType, setAutresEmploisContractType] = useState(ad.autresEmploisData?.contractType || 'CDI');
  const [autresEmploisExperience, setAutresEmploisExperience] = useState(ad.autresEmploisData?.experienceYears || '');
  const [cvUrl, setCvUrl] = useState(ad.cvUrl || ad.autresEmploisData?.cvUrl || '');
  const [cvFileName, setCvFileName] = useState(ad.cvFileName || ad.autresEmploisData?.cvFileName || '');
  const [cvFileType, setCvFileType] = useState(ad.cvFileType || ad.autresEmploisData?.cvFileType || '');
  const [cvFileSize, setCvFileSize] = useState(ad.cvFileSize || ad.autresEmploisData?.cvFileSize || 0);

  // Location fields
  const [selectedProvinceName, setSelectedProvinceName] = useState(
    ad.location?.province || 'Estuaire'
  );
  const [selectedCityName, setSelectedCityName] = useState(
    ad.location?.city || 'Libreville'
  );
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(
    ad.location?.neighborhood || 'Centre'
  );

  // Contact fields
  const [contactName, setContactName] = useState(ad.contactName || '');
  const [contactPhone, setContactPhone] = useState(ad.contactPhone || '');

  // Media
  const [images, setImages] = useState<string[]>(ad.images || []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState(ad.videoUrl || '');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if ad changes
  useEffect(() => {
    if (ad) {
      setTitle(ad.title || '');
      setDescription(ad.description || '');
      setPrice(ad.price ? String(ad.price) : '');
      setPriceMax(ad.priceMax ? String(ad.priceMax) : '');
      setPriceUnit(ad.priceUnit || 'total');
      setMainCategory(ad.mainCategory || 'IMMOBILIER');
      setTransactionType(ad.transactionType || 'VENTE');
      setPropertyType(ad.propertyType || 'Appartement');
      setVehicleCategory(ad.vehicleData?.category || 'Voitures');
      setVehicleBrand(ad.vehicleData?.brand || '');
      setVehicleModel(ad.vehicleData?.model || '');
      setBricCategory(ad.bricCategory || 'Électronique & Smartphones');
      setDomesticJobType(ad.domesticJobType || 'Gardiens de nuit / de jour');
      setJobKind(ad.jobKind || (ad.transactionType === 'CHERCHE_EMPLOI' ? 'DEMANDE_EMPLOI' : 'OFFRE_EMPLOI'));
      setNecroMinistry(ad.necrologieData?.ministry || 'Éducation nationale');
      setNecroDeceasedName(ad.necrologieData?.deceasedName || '');
      setNecroCeremonyDate(ad.necrologieData?.ceremonyDate || '');
      setNecroCeremonyLocation(ad.necrologieData?.ceremonyLocation || '');
      setNecroFuneralProgram(ad.necrologieData?.funeralProgram || '');
      setNecroFamilyContact(ad.necrologieData?.familyContact || '');
      setTutoringKind(ad.tutoringData?.kind || 'OFFRE');
      setTutoringSubject(ad.tutoringData?.subject || 'Mathématiques');
      setTutoringLevel(ad.tutoringData?.level || 'Tous niveaux');
      setAvisCategory(ad.avisRechercheData?.category || 'Personne disparue');
      setAvisTargetName(ad.avisRechercheData?.targetName || '');
      setAvisLastSeenDate(ad.avisRechercheData?.lastSeenDate || '');
      setAvisLastSeenLocation(ad.avisRechercheData?.lastSeenLocation || '');
      setAvisHasReward(Boolean(ad.avisRechercheData?.hasReward || (ad.avisRechercheData?.rewardAmount && ad.avisRechercheData.rewardAmount > 0)));
      setAvisRewardAmount(ad.avisRechercheData?.rewardAmount ? String(ad.avisRechercheData.rewardAmount) : '');
      setAvisEmergencyContact(ad.avisRechercheData?.contactEmergency || '');
      setAutresEmploisSubCategory(ad.autresEmploisData?.subCategory || "Demandeur d'emploi");
      setAutresEmploisProfession(ad.autresEmploisData?.profession || '');
      setAutresEmploisContractType(ad.autresEmploisData?.contractType || 'CDI');
      setAutresEmploisExperience(ad.autresEmploisData?.experienceYears || '');
      setCvUrl(ad.cvUrl || ad.autresEmploisData?.cvUrl || '');
      setCvFileName(ad.cvFileName || ad.autresEmploisData?.cvFileName || '');
      setCvFileType(ad.cvFileType || ad.autresEmploisData?.cvFileType || '');
      setCvFileSize(ad.cvFileSize || ad.autresEmploisData?.cvFileSize || 0);
      setSelectedProvinceName(ad.location?.province || 'Estuaire');
      setSelectedCityName(ad.location?.city || 'Libreville');
      setSelectedNeighborhood(ad.location?.neighborhood || 'Centre');
      setContactName(ad.contactName || '');
      setContactPhone(ad.contactPhone || '');
      setImages(ad.images || []);
      setVideoUrl(ad.videoUrl || '');
      setErrorMsg(null);
    }
  }, [ad]);

  // Province / City / Neighborhood helpers
  const currentProvince = GABON_PROVINCES.find((p) => p.name === selectedProvinceName) || GABON_PROVINCES[0];
  const currentCity = currentProvince.cities.find((c) => c.name === selectedCityName) || currentProvince.cities[0];
  const availableNeighborhoods = currentCity?.neighborhoods || ['Centre'];

  const handleProvinceChange = (provName: string) => {
    setSelectedProvinceName(provName);
    const p = GABON_PROVINCES.find((prov) => prov.name === provName) || GABON_PROVINCES[0];
    const firstCity = p.cities[0]?.name || 'Centre';
    setSelectedCityName(firstCity);
    setSelectedNeighborhood(p.cities[0]?.neighborhoods[0] || 'Centre');
  };

  const handleCityChange = (cityName: string) => {
    setSelectedCityName(cityName);
    const c = currentProvince.cities.find((city) => city.name === cityName);
    setSelectedNeighborhood(c?.neighborhoods[0] || 'Centre');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
      setErrorMsg('Veuillez vous connecter pour téléverser une image.');
      return;
    }

    try {
      setUploadingImage(true);
      setErrorMsg(null);
      const { blob, mimeType } = await compressImageForUpload(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const storagePath = `ads/${auth.currentUser.uid}/${Date.now()}_${cleanName}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, {
        contentType: mimeType,
        cacheControl: 'public,max-age=31536000,immutable',
      });
      const downloadUrl = await getDownloadURL(storageRef);
      setImages((prev) => [...prev, downloadUrl]);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setErrorMsg('Échec du téléversement de l\'image. Veuillez réessayer.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx' && ext !== 'md') {
      setErrorMsg('Format de CV non supporté. Veuillez choisir un fichier .pdf, .docx ou .md');
      return;
    }
    try {
      setErrorMsg(null);
      if (auth.currentUser) {
        const storagePath = `cvs/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        setCvUrl(downloadUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          setCvUrl(loadEvt.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
      setCvFileName(file.name);
      setCvFileType(ext);
      setCvFileSize(file.size);
    } catch (err) {
      console.error('CV upload error:', err);
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        setCvUrl(loadEvt.target?.result as string);
        setCvFileName(file.name);
        setCvFileType(ext);
        setCvFileSize(file.size);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Form validations
    if (!title.trim()) {
      setErrorMsg('Le titre de l\'annonce est obligatoire.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('La description de l\'annonce est obligatoire.');
      return;
    }
    const isDemandeurEmploi = mainCategory === 'AUTRES_EMPLOIS' && autresEmploisSubCategory === "Demandeur d'emploi";
    let numPrice = Number(price);

    if (mainCategory === 'NECROLOGIE' || mainCategory === 'AVIS_DE_RECHERCHE') {
      numPrice = 0;
    } else {
      if (price === '' || String(price).trim() === '') {
        setErrorMsg(
          mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS'
            ? 'Le montant du salaire désiré ou proposé est obligatoire.'
            : 'Le prix de votre annonce est obligatoire.'
        );
        return;
      }
      if (isNaN(numPrice) || numPrice <= 0) {
        setErrorMsg(
          mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS'
            ? 'Le salaire désiré ou proposé ne peut pas être égal à 0 ou négatif. Veuillez renseigner un montant strictement supérieur à 0 FCFA.'
            : 'Le prix en FCFA ne peut pas être égal à 0 ou négatif. Veuillez renseigner un montant supérieur à 0.'
        );
        return;
      }
      if (priceMax && (isNaN(Number(priceMax)) || Number(priceMax) <= 0)) {
        setErrorMsg('La borne maximale de salaire ou prix ne peut pas être égale à 0 ou négative.');
        return;
      }
    }

    if (isDemandeurEmploi) {
      if (!cvUrl && !cvFileName) {
        setErrorMsg("Le dépôt de votre CV (.pdf, .docx ou .md) est obligatoire pour la sous-catégorie Demandeur d'emploi.");
        return;
      }
    } else {
      if (images.length === 0) {
        setErrorMsg('Au moins une photo est requise pour illustrer votre annonce.');
        return;
      }
    }

    if (!contactPhone.trim()) {
      setErrorMsg('Le numéro de téléphone de contact (+241...) est requis.');
      return;
    }

    const updatedData: Partial<Ad> = {
      title: title.trim(),
      description: description.trim(),
      price: numPrice,
      priceMax: (mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS') && priceMax && Number(priceMax) > numPrice ? Number(priceMax) : undefined,
      priceUnit,
      mainCategory,
      transactionType:
        mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT'
          ? transactionType
          : undefined,
      location: {
        province: selectedProvinceName,
        city: selectedCityName,
        neighborhood: selectedNeighborhood,
      },
      contactName: contactName.trim() || 'Annonceur BizBooster',
      contactPhone: (() => {
        const rawClean = (contactPhone || '').replace(/[^0-9]/g, '').replace(/^241/, '').replace(/^0+/, '');
        return rawClean ? `+241${rawClean}` : contactPhone.trim();
      })(),
      images,
      videoUrl: videoUrl.trim() || undefined,
    };

    if (mainCategory === 'IMMOBILIER') {
      updatedData.propertyType = propertyType;
      updatedData.isVipCorner = isAdVipCornerEligible({ mainCategory, transactionType, price: numPrice, priceUnit, propertyType });
    } else if (mainCategory === 'MATERIEL_ROULANT') {
      updatedData.vehicleData = {
        category: vehicleCategory,
        brand: vehicleBrand.trim() || undefined,
        model: vehicleModel.trim() || undefined,
      };
      updatedData.isVipCorner = isAdVipCornerEligible({
        mainCategory,
        transactionType,
        price: numPrice,
        priceUnit,
        vehicleData: { category: vehicleCategory },
      });
    } else if (mainCategory === 'BRIC_A_BRAC') {
      updatedData.bricCategory = bricCategory;
    } else if (mainCategory === 'EMPLOI') {
      updatedData.domesticJobType = domesticJobType;
      updatedData.jobKind = jobKind;
      if (jobKind === 'DEMANDE_EMPLOI') {
        updatedData.transactionType = 'CHERCHE_EMPLOI';
      }
    } else if (mainCategory === 'COURS_A_DOMICILE') {
      updatedData.tutoringData = {
        kind: tutoringKind,
        subject: tutoringSubject,
        level: tutoringLevel,
      };
    } else if (mainCategory === 'NECROLOGIE') {
      // Point 1: Ministry modification persisted correctly
      updatedData.necrologieData = {
        ministry: necroMinistry,
        deceasedName: necroDeceasedName.trim() || undefined,
        ceremonyDate: necroCeremonyDate.trim() || undefined,
        ceremonyLocation: necroCeremonyLocation.trim() || undefined,
        funeralProgram: necroFuneralProgram.trim() || undefined,
        familyContact: necroFamilyContact.trim() || undefined,
      };
      updatedData.price = 0;
    } else if (mainCategory === 'AVIS_DE_RECHERCHE') {
      updatedData.avisRechercheData = {
        category: avisCategory,
        targetName: avisTargetName.trim() || undefined,
        lastSeenDate: avisLastSeenDate.trim() || undefined,
        lastSeenLocation: avisLastSeenLocation.trim() || undefined,
        hasReward: avisHasReward,
        rewardAmount: Number(avisRewardAmount) || undefined,
        contactEmergency: avisEmergencyContact.trim() || undefined,
      };
    } else if (mainCategory === 'AUTRES_EMPLOIS') {
      const isSeeker = autresEmploisSubCategory === "Demandeur d'emploi";
      updatedData.autresEmploisData = {
        subCategory: autresEmploisSubCategory,
        profession: autresEmploisProfession.trim() || undefined,
        contractType: autresEmploisContractType as any,
        experienceYears: autresEmploisExperience.trim() || undefined,
        cvUrl: isSeeker ? (cvUrl || undefined) : undefined,
        cvFileName: isSeeker ? (cvFileName || undefined) : undefined,
        cvFileType: isSeeker ? (cvFileType || undefined) : undefined,
        cvFileSize: isSeeker ? (cvFileSize || undefined) : undefined,
        jobDocUrl: !isSeeker ? (cvUrl || undefined) : undefined,
        jobDocFileName: !isSeeker ? (cvFileName || undefined) : undefined,
        jobDocFileType: !isSeeker ? (cvFileType || undefined) : undefined,
        jobDocFileSize: !isSeeker ? (cvFileSize || undefined) : undefined,
      };
      updatedData.cvUrl = cvUrl || undefined;
      updatedData.cvFileName = cvFileName || undefined;
      updatedData.cvFileType = cvFileType || undefined;
      updatedData.cvFileSize = cvFileSize || undefined;
      if (!isSeeker) {
        updatedData.jobDocUrl = cvUrl || undefined;
        updatedData.jobDocFileName = cvFileName || undefined;
        updatedData.jobDocFileType = cvFileType || undefined;
        updatedData.jobDocFileSize = cvFileSize || undefined;
      }
    }

    try {
      setIsSubmitting(true);
      await onSave(ad.id, updatedData, wasActive);
      onClose();
    } catch (err: any) {
      console.error('Save ad edit error:', err);
      const detail = err?.message || err?.code || '';
      setErrorMsg(detail ? `Erreur (${detail}) : vérifiez votre saisie ou réessayez.` : 'Erreur lors de la sauvegarde des modifications. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-modal-overlay">
      <div
        className="app-modal-dialog bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-300/80 animate-in fade-in zoom-in-95 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white">
                  Modifier l'annonce
                </h3>
                {wasActive ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Actuellement En Ligne
                  </span>
                ) : isRejected ? (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Annonce Rejetée (À Corriger)
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    En attente de vérification
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-md">
                {ad.mainCategory} • {ad.location?.city || 'Gabon'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {/* Status Alert Banner */}
          {isRejected ? (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 text-rose-950 text-xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black text-rose-900 text-sm mb-0.5">
                  Annonce refusée par la modération — Correction requise
                </strong>
                {ad.moderationReason ? (
                  <p className="mb-1.5 text-rose-900 font-semibold bg-rose-100/80 p-2 rounded-xl border border-rose-200">
                    Motif de refus : <span className="font-normal italic">« {ad.moderationReason} »</span>
                  </p>
                ) : null}
                Apportez les modifications nécessaires ci-dessous. Dès l'enregistrement, votre annonce corrigée sera <strong>automatiquement renvoyée aux modérateurs</strong> pour être vérifiée et approuvée.
              </div>
            </div>
          ) : wasActive ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-950 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black text-amber-900 text-sm mb-0.5">
                  Important : Renvoi obligatoire en modération
                </strong>
                Cette annonce étant déjà publiée, la validation de vos modifications entraînera son <strong>retrait temporaire du site public</strong> et son <strong>renvoi à l'équipe d'administration pour vérification</strong>. Elle sera remise en ligne dès approbation.
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3 text-emerald-950 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black text-emerald-900 text-sm mb-0.5">
                  Modification libre avant validation
                </strong>
                Votre annonce n'a pas encore été validée par nos administrateurs. Vous pouvez modifier librement son contenu. Les superviseurs examineront directement ces nouvelles données.
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Main Categories & Transaction */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
              1. Catégorie & Type de transaction
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'IMMOBILIER', label: 'Immobilier', icon: Building2 },
                { key: 'MATERIEL_ROULANT', label: 'Véhicules', icon: Car },
                { key: 'BRIC_A_BRAC', label: 'Bric-à-Brac', icon: ShoppingBag },
                { key: 'EMPLOI', label: 'Emploi Domestique', icon: Briefcase },
                { key: 'COURS_A_DOMICILE', label: 'Cours à Domicile', icon: GraduationCap },
                { key: 'NECROLOGIE', label: 'Nécrologie', icon: Heart },
                { key: 'AVIS_DE_RECHERCHE', label: 'Avis de Recherche', icon: Search },
                { key: 'AUTRES_EMPLOIS', label: 'Autres Emplois', icon: UserCheck },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setMainCategory(key as MainCategory)}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    mainCategory === key
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-extrabold ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              {(mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type de Transaction :
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['VENTE', 'LOCATION'] as TransactionType[]).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setTransactionType(type)}
                        className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          transactionType === type
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {type === 'VENTE' ? 'À VENDRE' : 'À LOUER'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mainCategory === 'EMPLOI' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Type d'annonce Emploi :
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setJobKind('OFFRE_EMPLOI')}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                          jobKind === 'OFFRE_EMPLOI'
                            ? 'bg-purple-600 border-purple-700 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50/50'
                        }`}
                      >
                        💼 Offre d'emploi (Recruteur)
                      </button>
                      <button
                        type="button"
                        onClick={() => setJobKind('DEMANDE_EMPLOI')}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                          jobKind === 'DEMANDE_EMPLOI'
                            ? 'bg-teal-600 border-teal-700 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50/50'
                        }`}
                      >
                        🙋 Demande d'emploi (Candidat)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Métier Domestique :
                    </label>
                    <select
                      value={domesticJobType}
                      onChange={(e) => setDomesticJobType(e.target.value as DomesticJobType)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                    >
                      {[
                        'Nounous (garde-bébé)',
                        'Cuisiniers',
                        'Gardiens de nuit / de jour',
                        'Jardiniers',
                        'Assistants aux personnes âgées',
                        'Femmes de ménage / Repassage',
                        'Chauffeurs particuliers',
                      ].map((jt) => (
                        <option key={jt} value={jt}>{jt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {mainCategory === 'IMMOBILIER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type de Bien Immobilier :
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                  >
                    {[
                      'Villa',
                      'Maison',
                      'Appartement',
                      'Studio (1 chambre + 1 salon)',
                      'Chambre américaine (chambre + coin cuisine)',
                      'Chambre simple',
                      'Studio / Chambre',
                      'Terrain / Parcelle',
                      'Bureau / Local commercial',
                      'Entrepôt',
                    ].map((pt) => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>
              )}

              {mainCategory === 'MATERIEL_ROULANT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catégorie Véhicule :
                  </label>
                  <select
                    value={vehicleCategory}
                    onChange={(e) => setVehicleCategory(e.target.value as RollingStockCategory)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                  >
                    {[
                      'Voitures',
                      'Camions Bennes',
                      'Camions Citernes',
                      'Engins de chantiers',
                      'Motos',
                      'Vélos',
                    ].map((vc) => (
                      <option key={vc} value={vc}>{vc}</option>
                    ))}
                  </select>
                </div>
              )}

              {mainCategory === 'BRIC_A_BRAC' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sous-catégorie Bric-à-Brac :
                  </label>
                  <select
                    value={bricCategory}
                    onChange={(e) => setBricCategory(e.target.value as BricABracCategory)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                  >
                    {[
                      'Électronique & Smartphones',
                      'Électroménager',
                      'Informatique & Bureautique',
                      'Meubles & Décoration',
                      'Mode & Vêtements',
                      'Bricolage & Matériaux',
                      'Autres objets',
                    ].map((bc) => (
                      <option key={bc} value={bc}>{bc}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Point 1: NÉCROLOGIE - Modifier son ministère & détails */}
              {mainCategory === 'NECROLOGIE' && (
                <div className="space-y-3 bg-slate-900 text-white p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2 text-amber-400 border-b border-slate-800 pb-2">
                    <Heart className="w-4 h-4 fill-amber-400/20" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Détails Nécrologie & Avis d'Obsèques (Diffusion Nationale)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">
                      Ministère / Corps professionnel de rattachement :
                    </label>
                    <select
                      value={necroMinistry}
                      onChange={(e) => setNecroMinistry(e.target.value as NecrologieMinistry)}
                      className="w-full text-xs font-bold bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-amber-400"
                    >
                      {NECROLOGIE_MINISTRIES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nom complet du défunt / de la défunte :
                      </label>
                      <input
                        type="text"
                        value={necroDeceasedName}
                        onChange={(e) => setNecroDeceasedName(e.target.value)}
                        placeholder="Ex: Jean-Baptiste NGUEMA"
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Date de la cérémonie :
                      </label>
                      <input
                        type="text"
                        value={necroCeremonyDate}
                        onChange={(e) => setNecroCeremonyDate(e.target.value)}
                        placeholder="Ex: Samedi 18 Octobre 2026"
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Lieu de la cérémonie :
                      </label>
                      <input
                        type="text"
                        value={necroCeremonyLocation}
                        onChange={(e) => setNecroCeremonyLocation(e.target.value)}
                        placeholder="Ex: Église Sainte-Marie, Libreville"
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Contact famille / organisation :
                      </label>
                      <input
                        type="text"
                        value={necroFamilyContact}
                        onChange={(e) => setNecroFamilyContact(e.target.value)}
                        placeholder="Ex: +241 77 00 00 00"
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Programme sommaire des obsèques :
                    </label>
                    <textarea
                      value={necroFuneralProgram}
                      onChange={(e) => setNecroFuneralProgram(e.target.value)}
                      rows={2}
                      placeholder="Veillée, messe de requiem, levée de corps, inhumation..."
                      className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
              )}

              {/* COURS À DOMICILE */}
              {mainCategory === 'COURS_A_DOMICILE' && (
                <div className="space-y-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTutoringKind('OFFRE')}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                        tutoringKind === 'OFFRE'
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      🎓 Offre de cours (Enseignant)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTutoringKind('DEMANDE')}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                        tutoringKind === 'DEMANDE'
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      📖 Recherche de cours (Parent / Élève)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-indigo-900 mb-1">
                        Matière enseignée :
                      </label>
                      <select
                        value={tutoringSubject}
                        onChange={(e) => setTutoringSubject(e.target.value as TutoringSubject)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800"
                      >
                        {TUTORING_SUBJECTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-900 mb-1">
                        Niveau scolaire :
                      </label>
                      <select
                        value={tutoringLevel}
                        onChange={(e) => setTutoringLevel(e.target.value as TutoringLevel)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800"
                      >
                        {TUTORING_LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Point 2: AVIS DE RECHERCHE */}
              {mainCategory === 'AVIS_DE_RECHERCHE' && (
                <div className="space-y-3 bg-amber-50/80 p-4 rounded-2xl border border-amber-300">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider border-b border-amber-200 pb-2">
                    <Search className="w-4 h-4 text-amber-700" />
                    <span>Détails de l'Avis de Recherche</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-950 mb-1">
                      Catégorie d'avis de recherche :
                    </label>
                    <select
                      value={avisCategory}
                      onChange={(e) => setAvisCategory(e.target.value as AvisRechercheCategory)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800"
                    >
                      {AVIS_RECHERCHE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nom / Description du sujet recherché :
                      </label>
                      <input
                        type="text"
                        value={avisTargetName}
                        onChange={(e) => setAvisTargetName(e.target.value)}
                        placeholder="Ex: Titre Foncier n° 4589, Chien Max..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Date de disparition / perte :
                      </label>
                      <input
                        type="text"
                        value={avisLastSeenDate}
                        onChange={(e) => setAvisLastSeenDate(e.target.value)}
                        placeholder="Ex: 5 Octobre 2026"
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Dernier lieu aperçu :
                      </label>
                      <input
                        type="text"
                        value={avisLastSeenLocation}
                        onChange={(e) => setAvisLastSeenLocation(e.target.value)}
                        placeholder="Ex: Quartier Glass, Libreville"
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Contact d'urgence :
                      </label>
                      <input
                        type="text"
                        value={avisEmergencyContact}
                        onChange={(e) => setAvisEmergencyContact(e.target.value)}
                        placeholder="Ex: +241 66 00 11 22"
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avisHasReward}
                        onChange={(e) => setAvisHasReward(e.target.checked)}
                        className="rounded-sm text-amber-600 focus:ring-amber-500"
                      />
                      <span>Récompense promise à la personne qui retrouve</span>
                    </label>
                    {avisHasReward && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={avisRewardAmount}
                          onChange={(e) => setAvisRewardAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Montant FCFA"
                          className="w-32 text-xs font-bold bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-amber-900"
                        />
                        <span className="text-xs font-bold text-amber-900">FCFA</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Point 2: AUTRES EMPLOIS (Demandeur d'emploi avec CV obligatoire) */}
              {mainCategory === 'AUTRES_EMPLOIS' && (
                <div className="space-y-3 bg-teal-50/70 p-4 rounded-2xl border border-teal-300">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-xs uppercase tracking-wider border-b border-teal-200 pb-2">
                    <UserCheck className="w-4 h-4 text-teal-700" />
                    <span>Détails Autres Emplois</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-950 mb-1">
                      Sous-catégorie :
                    </label>
                    <select
                      value={autresEmploisSubCategory}
                      onChange={(e) => setAutresEmploisSubCategory(e.target.value as AutresEmploisSubCategory)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800"
                    >
                      {AUTRES_EMPLOIS_SUBCATEGORIES.map((sc) => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Métier / Titre du poste :
                      </label>
                      <input
                        type="text"
                        value={autresEmploisProfession}
                        onChange={(e) => setAutresEmploisProfession(e.target.value)}
                        placeholder="Ex: Comptable, Développeur Web..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Type de contrat :
                      </label>
                      <select
                        value={autresEmploisContractType}
                        onChange={(e) => setAutresEmploisContractType(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      >
                        {['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Autre'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Expérience :
                      </label>
                      <input
                        type="text"
                        value={autresEmploisExperience}
                        onChange={(e) => setAutresEmploisExperience(e.target.value)}
                        placeholder="Ex: 5 ans"
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>

                  {/* Point 2: CV Attachment Box for Demandeur d'emploi */}
                  {autresEmploisSubCategory === "Demandeur d'emploi" && (
                    <div className="pt-2 border-t border-teal-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-teal-950 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-teal-700" />
                          <span>Curriculum Vitae (CV) - Obligatoire (.pdf, .docx, .md)</span>
                        </span>
                        {cvFileName && (
                          <span className="text-[10px] font-bold bg-teal-200 text-teal-900 px-2 py-0.5 rounded-full uppercase">
                            {cvFileType || 'CV'} attaché
                          </span>
                        )}
                      </div>

                      {cvFileName ? (
                        <div className="p-3 bg-white border border-teal-300 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg font-black text-xs uppercase shrink-0">
                              {cvFileType || 'DOC'}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-900 truncate">{cvFileName}</p>
                              {cvFileSize > 0 && (
                                <p className="text-[10px] text-slate-500">{(cvFileSize / 1024).toFixed(1)} Ko</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {cvUrl && (
                              <a
                                href={cvUrl}
                                download={cvFileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackDownloadRequest(cvFileSize || 250000)}
                                className="p-1.5 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                title="Télécharger / Voir le CV"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                            <label className="text-xs font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg border border-teal-200 cursor-pointer">
                              <span>Remplacer</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.md"
                                onChange={handleCvUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setCvUrl('');
                                setCvFileName('');
                                setCvFileType('');
                                setCvFileSize(0);
                              }}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                              title="Retirer le CV"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer border-2 border-dashed border-teal-300 bg-white hover:bg-teal-50 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 text-center transition-colors">
                          <Upload className="w-5 h-5 text-teal-600" />
                          <span className="text-xs font-bold text-teal-950">
                            Sélectionner votre CV (.pdf, .docx, ou .md)
                          </span>
                          <span className="text-[10px] text-teal-700">
                            L'attachement du CV est obligatoire à l'étape de publication pour les demandeurs d'emploi.
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.docx,.md"
                            onChange={handleCvUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Point 2: Document joint pour Donneur d'emploi (Optionnel) */}
                  {autresEmploisSubCategory !== "Demandeur d'emploi" && (
                    <div className="pt-2 border-t border-teal-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-teal-950 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-teal-700" />
                          <span>Fiche de poste / Descriptif de l'emploi (.pdf, .docx, .md)</span>
                        </span>
                        <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full uppercase">
                          {cvFileName ? `${cvFileType || 'DOC'} attaché` : 'Optionnel'}
                        </span>
                      </div>

                      {cvFileName ? (
                        <div className="p-3 bg-white border border-teal-300 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg font-black text-xs uppercase shrink-0">
                              {cvFileType || 'DOC'}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-900 truncate">{cvFileName}</p>
                              {cvFileSize > 0 && (
                                <p className="text-[10px] text-slate-500">{(cvFileSize / 1024).toFixed(1)} Ko</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {cvUrl && (
                              <a
                                href={cvUrl}
                                download={cvFileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackDownloadRequest(cvFileSize || 250000)}
                                className="p-1.5 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                title="Télécharger / Voir le descriptif"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                            <label className="text-xs font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg border border-teal-200 cursor-pointer">
                              <span>Remplacer</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.md"
                                onChange={handleCvUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setCvUrl('');
                                setCvFileName('');
                                setCvFileType('');
                                setCvFileSize(0);
                              }}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                              title="Retirer le document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer border-2 border-dashed border-teal-300 bg-white hover:bg-teal-50 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 text-center transition-colors">
                          <Upload className="w-5 h-5 text-teal-600" />
                          <span className="text-xs font-bold text-teal-950">
                            Téléverser la fiche de poste ou descriptif (.pdf, .docx, .md)
                          </span>
                          <span className="text-[10px] text-teal-700">
                            Optionnel : permet aux candidats de consulter et télécharger la fiche de poste détaillée.
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.docx,.md"
                            onChange={handleCvUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Localization */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Localisation au Gabon</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Province :
                </label>
                <select
                  value={selectedProvinceName}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                >
                  {GABON_PROVINCES.map((prov) => (
                    <option key={prov.code} value={prov.name}>
                      {prov.name} ({prov.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ville / Commune :
                </label>
                <select
                  value={selectedCityName}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                >
                  {currentProvince.cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quartier :
                </label>
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                >
                  {availableNeighborhoods.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Ad Content & Price */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
              3. Titre, Description & Tarif
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Titre de l'annonce :
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={90}
                placeholder="Ex: Villa 4 pièces avec piscine à Angondjé"
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-emerald-500"
                required
              />
            </div>

            {mainCategory !== 'NECROLOGIE' && mainCategory !== 'AVIS_DE_RECHERCHE' && (
              <div className="space-y-2">
                {(() => {
                  const isJob = mainCategory === 'EMPLOI' || mainCategory === 'AUTRES_EMPLOIS';
                  const isSeeker = (mainCategory === 'EMPLOI' && (jobKind === 'DEMANDE_EMPLOI' || transactionType === 'CHERCHE_EMPLOI')) ||
                    (mainCategory === 'AUTRES_EMPLOIS' && autresEmploisSubCategory === "Demandeur d'emploi");
                  const isEmployerOffer = isJob && !isSeeker;

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isSeeker
                              ? 'Salaire désiré en Francs CFA (XAF) :'
                              : isEmployerOffer
                              ? 'Salaire proposé en Francs CFA (XAF) :'
                              : 'Prix en Francs CFA (XAF) :'}
                          </label>
                          <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder={isJob ? 'Ex: 150000' : 'Ex: 250000'}
                            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-emerald-800 focus:outline-emerald-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isJob ? 'Périodicité du salaire :' : 'Unité du prix :'}
                          </label>
                          <select
                            value={priceUnit}
                            onChange={(e) => setPriceUnit(e.target.value as any)}
                            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
                          >
                            {isJob ? (
                              <>
                                <option value="mois">Salaire mensuel</option>
                                <option value="jour">Salaire journalier</option>
                                <option value="trimestre">Salaire trimestriel</option>
                                <option value="an">Salaire annuel</option>
                              </>
                            ) : (
                              <>
                                <option value="total">Prix Total (Achat / Vente)</option>
                                <option value="mois">Par Mois (Location)</option>
                                <option value="jour">Par Jour</option>
                                <option value="heure">Par Heure</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Tranche de salaire pour l'employeur (Point 1) */}
                      {isEmployerOffer && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-800">
                            Fourchette / Tranche de salaire (Optionnel) :
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-semibold shrink-0">De {price ? `${Number(price).toLocaleString('fr-FR')} FCFA` : '—'} à</span>
                            <input
                              type="number"
                              value={priceMax}
                              onChange={(e) => setPriceMax(e.target.value)}
                              placeholder="Salaire maximum (ex: 250000)"
                              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-xs text-slate-500 font-bold shrink-0">FCFA</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Laissez vide si le salaire est fixe. Si renseigné, l'annonce affichera la fourchette proposée.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Point 4: Coin VIP notification if eligible */}
                {(mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT') &&
                  isAdVipCornerEligible({
                    mainCategory,
                    transactionType,
                    price: Number(price) || 0,
                    priceUnit,
                    propertyType,
                    vehicleData: { category: vehicleCategory },
                  }) && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300 rounded-xl flex items-center gap-2.5 text-amber-950 text-xs shadow-xs animate-in fade-in">
                      <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-black shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold block text-amber-900">
                          👑 Annonce éligible au Coin VIP (Inclus sans aucun frais)
                        </span>
                        <span className="text-[11px] text-amber-800">
                          En raison de son standing d'exception, votre annonce sera mise en avant dans le Coin VIP sans frais supplémentaires.
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description détaillée (Max 1000 car.) :
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                maxLength={1000}
                placeholder={
                  mainCategory === 'NECROLOGIE'
                    ? "Rédigez l'avis d'obsèques, l'hommage de la famille et le parcours du défunt (jusqu'à 1000 caractères)..."
                    : "Décrivez l'état, les caractéristiques et les conditions de la transaction (jusqu'à 1000 caractères)..."
                }
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-emerald-500 leading-relaxed"
                required
              />
              <span className="text-[10px] text-slate-400 block text-right mt-1">
                {description.length}/1000 caractères
              </span>
            </div>
          </div>

          {/* Section 4: Media Photos & Video */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
              4. Photos & Vidéo de l'annonce
            </h4>

            {/* Photo list */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 h-24 bg-slate-100">
                  <img
                    src={imgUrl}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer cette photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Principale
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add photo controls */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <label className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{uploadingImage ? 'Téléversement...' : 'Téléverser photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>

              <div className="flex-1 w-full flex items-center gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Ou coller une URL d'image (https://...)"
                  className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-blue-600" />
                <span>Lien vidéo (Optionnel) :</span>
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/... ou https://..."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-emerald-500"
              />
            </div>
          </div>

          {/* Section 5: Contact info */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
              5. Coordonnées de contact
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nom de l'annonceur / Contact :</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex: M. Ndong"
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Téléphone Gabon (+241...) :</span>
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+241 77 00 00 00"
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-emerald-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-2 py-3 rounded-xl font-black text-xs text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                wasActive
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                  : isRejected
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : wasActive ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-slate-950" />
                  <span>Enregistrer et renvoyer en vérification</span>
                </>
              ) : isRejected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Enregistrer et renvoyer aux modérateurs</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Enregistrer les modifications</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
