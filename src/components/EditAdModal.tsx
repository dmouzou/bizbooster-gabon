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
} from 'lucide-react';
import {
  Ad,
  MainCategory,
  TransactionType,
  PropertyType,
  RollingStockCategory,
  BricABracCategory,
  DomesticJobType,
} from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';
import { auth, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  // Form states
  const [title, setTitle] = useState(ad.title || '');
  const [description, setDescription] = useState(ad.description || '');
  const [price, setPrice] = useState(ad.price ? String(ad.price) : '');
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
      setPriceUnit(ad.priceUnit || 'total');
      setMainCategory(ad.mainCategory || 'IMMOBILIER');
      setTransactionType(ad.transactionType || 'VENTE');
      setPropertyType(ad.propertyType || 'Appartement');
      setVehicleCategory(ad.vehicleData?.category || 'Voitures');
      setVehicleBrand(ad.vehicleData?.brand || '');
      setVehicleModel(ad.vehicleData?.model || '');
      setBricCategory(ad.bricCategory || 'Électronique & Smartphones');
      setDomesticJobType(ad.domesticJobType || 'Gardiens de nuit / de jour');
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
      const storagePath = `ads/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
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
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg('Veuillez renseigner un prix valide en FCFA.');
      return;
    }
    if (images.length === 0) {
      setErrorMsg('Au moins une photo est requise pour illustrer votre annonce.');
      return;
    }
    if (!contactPhone.trim()) {
      setErrorMsg('Le numéro de téléphone de contact (+241...) est requis.');
      return;
    }

    const updatedData: Partial<Ad> = {
      title: title.trim(),
      description: description.trim(),
      price: numPrice,
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
      contactPhone: contactPhone.trim(),
      images,
      videoUrl: videoUrl.trim() || undefined,
    };

    if (mainCategory === 'IMMOBILIER') {
      updatedData.propertyType = propertyType;
    } else if (mainCategory === 'MATERIEL_ROULANT') {
      updatedData.vehicleData = {
        category: vehicleCategory,
        brand: vehicleBrand.trim() || undefined,
        model: vehicleModel.trim() || undefined,
      };
    } else if (mainCategory === 'BRIC_A_BRAC') {
      updatedData.bricCategory = bricCategory;
    } else if (mainCategory === 'EMPLOI') {
      updatedData.domesticJobType = domesticJobType;
    }

    try {
      setIsSubmitting(true);
      await onSave(ad.id, updatedData, wasActive);
      onClose();
    } catch (err: any) {
      console.error('Save ad edit error:', err);
      setErrorMsg('Erreur lors de la sauvegarde des modifications. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
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
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    En attente de vérification
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-md">
                Ref: {ad.transactionRef || ad.id}
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
          {wasActive ? (
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
              ].map(({ key, label, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setMainCategory(key as MainCategory)}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                        className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
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

              {mainCategory === 'EMPLOI' && (
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {mainCategory === 'EMPLOI' ? 'Salaire en Francs CFA (XAF) :' : 'Prix en Francs CFA (XAF) :'}
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={mainCategory === 'EMPLOI' ? 'Ex: 150000' : 'Ex: 250000'}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-emerald-800 focus:outline-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {mainCategory === 'EMPLOI' ? 'Périodicité du salaire :' : 'Unité du prix :'}
                </label>
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as any)}
                  className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-emerald-500"
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
                      <option value="total">Prix Total (Achat / Vente)</option>
                      <option value="mois">Par Mois (Location)</option>
                      <option value="jour">Par Jour</option>
                      <option value="heure">Par Heure</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description détaillée :
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={600}
                placeholder="Décrivez l'état, les caractéristiques et les conditions de la transaction..."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-emerald-500 leading-relaxed"
                required
              />
              <span className="text-[10px] text-slate-400 block text-right mt-1">
                {description.length}/600 caractères
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
