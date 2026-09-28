import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Building2,
  Car,
  Package,
  Briefcase,
  Layers,
  MapPin,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  User,
  ArrowRight,
} from 'lucide-react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { ImmobilierFilterBar } from './components/ImmobilierFilterBar';
import { VehiclesFilterBar } from './components/VehiclesFilterBar';
import { AdCard } from './components/AdCard';
import { AdDetailModal } from './components/AdDetailModal';
import { PublishAdModal } from './components/PublishAdModal';
import { ExtendAdModal } from './components/ExtendAdModal';
import { UserDashboard } from './components/UserDashboard';
import { PhoneAuthModal } from './components/PhoneAuthModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { isAdOwner } from './utils/formatters';
import {
  Ad,
  MainCategory,
  PaymentOperator,
  PropertyType,
  RollingStockCategory,
  TransactionType,
  UserProfile,
} from './types';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { INITIAL_ADS } from './data/initialAds';
import AdminApp from './AdminApp';

function PublicApp() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (!fbUser) {
        setCurrentUser(null);
        return;
      }

      // Real-time listener for current user profile (picks up KYC approvals, VIP exemption, etc.)
      unsubUserDoc = onSnapshot(
        doc(db, 'users', fbUser.uid),
        (snap) => {
          if (snap.exists()) {
            setCurrentUser(snap.data() as UserProfile);
          } else {
            setCurrentUser(null);
          }
        },
        (err) => console.error('User profile listener error:', err)
      );
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const [publicAds, setPublicAds] = useState<Ad[]>([]);
  const [myAds, setMyAds] = useState<Ad[]>([]);

  // Everyone: ACTIVE ads only (exactly what the security rules allow)
  useEffect(() => {
    const q = query(collection(db, 'ads'), where('status', '==', 'ACTIVE'));
    return onSnapshot(
      q,
      (snap) => setPublicAds(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Ad)),
      (err) => console.error('Public ads listener error:', err)
    );
  }, []);

  // Signed-in advertiser: their own ads in every status
  useEffect(() => {
    if (!currentUser) {
      setMyAds([]);
      return;
    }
    const q = query(collection(db, 'ads'), where('userId', '==', currentUser.id));
    return onSnapshot(
      q,
      (snap) => setMyAds(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Ad)),
      (err) => console.error('My ads listener error:', err)
    );
  }, [currentUser?.id]);

  // Merge initial demonstration ads with live Firestore publicAds and myAds
  const ads = useMemo(() => {
    const map = new Map<string, Ad>();
    const now = Date.now();

    // 1. Initial test ads (kept displayed on the site for demonstration & test)
    INITIAL_ADS.forEach((a) => map.set(a.id, a));

    // 2. Real-time active public ads from Firestore
    publicAds
      .filter((a) => new Date(a.expiresAt).getTime() > now)
      .forEach((a) => map.set(a.id, a));

    // 3. Current user's own ads from Firestore (even if PENDING_REVIEW)
    myAds.forEach((a) => map.set(a.id, a));

    return Array.from(map.values());
  }, [publicAds, myAds]);

  // Frontend Tab State: 'catalog' | 'user-dashboard'
  const [frontendTab, setFrontendTab] = useState<'catalog' | 'user-dashboard'>('catalog');

  // Filter States for Frontend
  const [activeCategory, setActiveCategory] = useState<MainCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Immobilier specific filters
  const [immoProvince, setImmoProvince] = useState('');
  const [immoCity, setImmoCity] = useState('');
  const [immoNeighborhood, setImmoNeighborhood] = useState('');
  const [immoTransaction, setImmoTransaction] = useState<TransactionType | 'ALL'>('ALL');
  const [immoPropertyType, setImmoPropertyType] = useState<PropertyType | 'ALL'>('ALL');

  // Matériel Roulant specific filters
  const [vehicleSubcategory, setVehicleSubcategory] = useState<RollingStockCategory | 'ALL'>('ALL');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleTransaction, setVehicleTransaction] = useState<TransactionType | 'ALL'>('ALL');

  // Global transaction filter when in 'ALL'
  const [globalTransaction, setGlobalTransaction] = useState<TransactionType | 'ALL'>('ALL');

  // Modals state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [authTriggerPurpose, setAuthTriggerPurpose] = useState<'PUBLISH' | 'DASHBOARD'>('DASHBOARD');
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<Ad | null>(null);
  const [selectedAdForExtend, setSelectedAdForExtend] = useState<Ad | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Show quick toast notification
  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => {
      setNotificationMsg(null);
    }, 4500);
  };

  // Total active (publicly visible) ads count
  const activeAdsCount = useMemo(() => {
    return ads.filter((ad) => ad.status === 'ACTIVE').length;
  }, [ads]);

  // Category counts calculation for ACTIVE ads only (general visitors)
  const categoryCounts = useMemo(() => {
    const counts: Record<MainCategory | 'ALL', number> = {
      ALL: 0,
      IMMOBILIER: 0,
      MATERIEL_ROULANT: 0,
      BRIC_A_BRAC: 0,
      EMPLOI: 0,
    };
    ads.forEach((ad) => {
      if (ad.status === 'ACTIVE') {
        counts.ALL++;
        if (counts[ad.mainCategory] !== undefined) {
          counts[ad.mainCategory]++;
        }
      }
    });
    return counts;
  }, [ads]);

  // Public Catalog Filtering engine (ONLY ACTIVE APPROVED ADS)
  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      // 0. Only show ACTIVE ads to public viewers!
      if (ad.status !== 'ACTIVE') {
        return false;
      }

      // 1. Main Category filter
      if (activeCategory !== 'ALL' && ad.mainCategory !== activeCategory) {
        return false;
      }

      // 2. Global search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = ad.title.toLowerCase().includes(query);
        const matchesDesc = ad.description.toLowerCase().includes(query);
        const matchesCity = ad.location?.city.toLowerCase().includes(query);
        const matchesNeighborhood = ad.location?.neighborhood.toLowerCase().includes(query);
        const matchesBrand = ad.vehicleData?.brand?.toLowerCase().includes(query);
        const matchesModel = ad.vehicleData?.model?.toLowerCase().includes(query);

        if (!matchesTitle && !matchesDesc && !matchesCity && !matchesNeighborhood && !matchesBrand && !matchesModel) {
          return false;
        }
      }

      // 3. Global transaction filter (if applied in 'ALL')
      if (activeCategory === 'ALL' && globalTransaction !== 'ALL') {
        if (ad.transactionType && ad.transactionType !== globalTransaction) {
          return false;
        }
      }

      // 4. Specific Immobilier filters (Section B-1)
      if (activeCategory === 'IMMOBILIER') {
        if (immoTransaction !== 'ALL' && ad.transactionType !== immoTransaction) {
          return false;
        }
        if (immoProvince && ad.location?.province?.toLowerCase() !== immoProvince.toLowerCase()) {
          return false;
        }
        if (immoCity && ad.location?.city?.toLowerCase() !== immoCity.toLowerCase()) {
          return false;
        }
        if (immoNeighborhood && ad.location?.neighborhood?.toLowerCase() !== immoNeighborhood.toLowerCase()) {
          return false;
        }
        if (immoPropertyType !== 'ALL' && ad.propertyType?.toLowerCase() !== immoPropertyType.toLowerCase()) {
          return false;
        }
      }

      // 5. Specific Matériel Roulant filters (Section B-2)
      if (activeCategory === 'MATERIEL_ROULANT') {
        if (vehicleTransaction !== 'ALL' && ad.transactionType !== vehicleTransaction) {
          return false;
        }
        if (vehicleSubcategory !== 'ALL' && ad.vehicleData?.category?.toLowerCase() !== vehicleSubcategory.toLowerCase()) {
          return false;
        }
        if (vehicleBrand && ad.vehicleData?.brand?.toLowerCase() !== vehicleBrand.toLowerCase()) {
          return false;
        }
        if (vehicleModel && ad.vehicleData?.model?.toLowerCase() !== vehicleModel.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [
    ads,
    activeCategory,
    searchQuery,
    globalTransaction,
    immoTransaction,
    immoProvince,
    immoCity,
    immoNeighborhood,
    immoPropertyType,
    vehicleSubcategory,
    vehicleBrand,
    vehicleModel,
    vehicleTransaction,
  ]);

  // Handle open publish flow with mandatory auth check
  const handleTriggerPublish = () => {
    if (!currentUser) {
      setAuthTriggerPurpose('PUBLISH');
      setIsPhoneAuthOpen(true);
    } else {
      setIsPublishModalOpen(true);
    }
  };

  // Handle login success from PhoneAuthModal
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsPhoneAuthOpen(false);
    showToast(`Bienvenue ${user.name} ! Votre numéro ${user.contactPhone} a été vérifié par SMS.`);

    if (authTriggerPurpose === 'PUBLISH') {
      setIsPublishModalOpen(true);
    } else {
      setFrontendTab('user-dashboard');
    }
  };

  // Handle Logout Confirmation
  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    showToast('Vous avez été déconnecté avec succès.');
    if (frontendTab === 'user-dashboard') {
      setFrontendTab('catalog');
    }
  };

  // Handle adding new ad (received from PublishAdModal). Errors propagate to the modal.
  const handleAdPublished = async (newAd: Ad) => {
    await setDoc(doc(db, 'ads', newAd.id), {
      ...newAd,
      userId: auth.currentUser!.uid,
      status: 'PENDING_REVIEW',
    });
    showToast(`Annonce "${newAd.title}" transmise à la modération administrative !`);
  };

  // Delete Ad
  const handleDeleteAd = async (adId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) return;
    try {
      await deleteDoc(doc(db, 'ads', adId));
      showToast('Annonce supprimée avec succès.');
    } catch (e) {
      console.error(e);
      showToast('Suppression impossible. Réessayez.');
    }
  };

  // Trigger extending ad duration - STRICTEMENT RÉSERVÉ AU DÉTENTEUR DE L'ANNONCE
  const handleTriggerExtend = (ad: Ad) => {
    if (!currentUser) {
      showToast("Veuillez vous connecter avec votre numéro gabonais pour prolonger cette annonce.");
      setAuthTriggerPurpose('DASHBOARD');
      setIsPhoneAuthOpen(true);
      return;
    }

    if (!isAdOwner(ad, currentUser)) {
      showToast("Accès refusé : Seul le détenteur de l'annonce est autorisé à prolonger sa durée.");
      return;
    }

    setSelectedAdForExtend(ad);
  };

  // Handle extending ad duration (Section C-NB)
  // The owner only files a REQUEST; an admin applies it after checking the payment.
  const handleExtendSuccess = async (
    adId: string,
    additionalDays: number,
    paymentInfo: { operator: PaymentOperator; transactionRef: string }
  ) => {
    const targetAd = ads.find((a) => a.id === adId);
    if (!targetAd || !isAdOwner(targetAd, currentUser)) {
      showToast("Opération refusée : Vous n'êtes pas le détenteur autorisé de cette annonce.");
      setSelectedAdForExtend(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'ads', adId), {
        pendingExtension: {
          days: additionalDays,
          operator: paymentInfo.operator,
          transactionRef: paymentInfo.transactionRef,
          requestedAt: new Date().toISOString(),
        },
      });
      showToast(`Prolongation de +${additionalDays} jours demandée. Elle sera appliquée après vérification du paiement.`);
    } catch (e) {
      console.error(e);
      showToast('Erreur lors de la demande de prolongation.');
    }
  };

  // Reset helpers
  const handleResetImmoFilters = () => {
    setImmoProvince('');
    setImmoCity('');
    setImmoNeighborhood('');
    setImmoTransaction('ALL');
    setImmoPropertyType('ALL');
  };

  const handleResetVehiclesFilters = () => {
    setVehicleSubcategory('ALL');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleTransaction('ALL');
  };

  const handleSelectCategory = (category: MainCategory | 'ALL') => {
    setActiveCategory(category);
    handleResetImmoFilters();
    handleResetVehiclesFilters();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="fixed bottom-5 right-5 z-60 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{notificationMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* APPLICATION FRONTEND GRAND PUBLIC (DÉDIÉE UTILISATEURS)  */}
      {/* ======================================================== */}
      <Header
        currentTab={frontendTab}
        setCurrentTab={setFrontendTab}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        onOpenPublishModal={handleTriggerPublish}
        onOpenPhoneAuth={() => {
          setAuthTriggerPurpose('DASHBOARD');
          setIsPhoneAuthOpen(true);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        totalActiveAdsCount={activeAdsCount}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {/* TAB 1: PUBLIC CATALOGUE (100% LIBRE, GRATUIT, VÉRIFIÉ) */}
        {frontendTab === 'catalog' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Hero Banner for Public Visitors */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white p-6 sm:p-10 shadow-xl border border-emerald-700/30">
              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-400/30 backdrop-blur-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Portail Annonces & Commerce au Gabon • 100% Vérifié</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                  Achetez, Louez ou Vendez rapidement dans tout le <span className="text-amber-400">Gabon</span>.
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  Immobilier géolocalisé par province, ville et quartier, Matériel Roulant (voitures, 4x4, engins), Bric-à-Brac et Emploi. Toutes les annonces sont vérifiées avant publication.
                </p>

                {/* Quick actions row in Hero */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleTriggerPublish}
                    className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg transition-all transform hover:scale-102 flex items-center gap-2"
                  >
                    <span>Déposer une annonce maintenant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Decorative background element */}
              <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            </div>

            {/* Global Search & Transaction Mode Toggle */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-center">
                {/* Search Input */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Recherche générale (ex: Appartement Angondjé, Hilux, Terrain titré, Téléviseur...)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                {/* Global Transaction Quick Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 w-full md:w-auto justify-center">
                  <button
                    onClick={() => setGlobalTransaction('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      globalTransaction === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tout
                  </button>
                  <button
                    onClick={() => setGlobalTransaction('VENTE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      globalTransaction === 'VENTE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    À Vendre
                  </button>
                  <button
                    onClick={() => setGlobalTransaction('LOCATION')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      globalTransaction === 'LOCATION'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    À Louer
                  </button>
                </div>
              </div>

              {/* Main Categories Bar */}
              <CategoryBar
                activeCategory={activeCategory}
                onSelectCategory={handleSelectCategory}
                setActiveCategory={handleSelectCategory}
                categoryCounts={categoryCounts}
              />
            </div>

            {/* Specialized Filters: IMMOBILIER */}
            {activeCategory === 'IMMOBILIER' && (
              <ImmobilierFilterBar
                selectedProvince={immoProvince}
                onChangeProvince={setImmoProvince}
                selectedCity={immoCity}
                onChangeCity={setImmoCity}
                selectedNeighborhood={immoNeighborhood}
                onChangeNeighborhood={setImmoNeighborhood}
                selectedTransaction={immoTransaction}
                onChangeTransaction={setImmoTransaction}
                selectedPropertyType={immoPropertyType}
                onChangePropertyType={setImmoPropertyType}
                onResetFilters={handleResetImmoFilters}
              />
            )}

            {/* Specialized Filters: MATERIEL ROULANT */}
            {activeCategory === 'MATERIEL_ROULANT' && (
              <VehiclesFilterBar
                selectedSubcategory={vehicleSubcategory}
                onChangeSubcategory={setVehicleSubcategory}
                selectedBrand={vehicleBrand}
                onChangeBrand={setVehicleBrand}
                selectedModel={vehicleModel}
                onChangeModel={setVehicleModel}
                selectedTransaction={vehicleTransaction}
                onChangeTransaction={setVehicleTransaction}
                onResetFilters={handleResetVehiclesFilters}
              />
            )}

            {/* Ads Grid Section */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>
                    {activeCategory === 'ALL'
                      ? 'Toutes les annonces en ligne'
                      : activeCategory === 'IMMOBILIER'
                      ? 'Annonces Immobilières au Gabon'
                      : activeCategory === 'MATERIEL_ROULANT'
                      ? 'Matériel Roulant & Véhicules'
                      : activeCategory === 'BRIC_A_BRAC'
                      ? 'Bric-à-Brac & Équipements'
                      : 'Offres & Demandes d\'Emploi'}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {filteredAds.length} active{filteredAds.length > 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Annonces vérifiées et modérées • Tarifs affichés en Francs CFA (XAF)
                </p>
              </div>

              {(searchQuery ||
                activeCategory !== 'ALL' ||
                immoProvince ||
                immoCity ||
                immoNeighborhood ||
                vehicleBrand ||
                globalTransaction !== 'ALL') && (
                <button
                  onClick={() => {
                    handleResetImmoFilters();
                    handleResetVehiclesFilters();
                    setSearchQuery('');
                    setActiveCategory('ALL');
                    setGlobalTransaction('ALL');
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                >
                  Réinitialiser la recherche
                </button>
              )}
            </div>

            {/* Listings Grid */}
            {filteredAds.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredAds.map((ad) => {
                  const isOwner = isAdOwner(ad, currentUser);
                  return (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      isOwner={isOwner}
                      onSelectAd={(selected) => setSelectedAdForDetail(selected)}
                      onOpenExtendModal={isOwner ? () => handleTriggerExtend(ad) : undefined}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">
                    Aucune annonce ne correspond à vos filtres
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Essayez d'élargir votre recherche ou de réinitialiser la province ou la ville.
                  </p>
                </div>
                <button
                  onClick={() => {
                    handleResetImmoFilters();
                    handleResetVehiclesFilters();
                    setSearchQuery('');
                    setActiveCategory('ALL');
                    setGlobalTransaction('ALL');
                  }}
                  className="bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs hover:bg-emerald-700 transition-colors"
                >
                  Réinitialiser tous les filtres
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USER DEDICATED DASHBOARD ("MON ESPACE ANNONCEUR") */}
        {frontendTab === 'user-dashboard' && (
          currentUser ? (
            <UserDashboard
              currentUser={currentUser}
              ads={ads}
              onOpenPublishModal={handleTriggerPublish}
              onOpenExtendModal={(ad) => handleTriggerExtend(ad)}
              onSelectAdDetail={(ad) => setSelectedAdForDetail(ad)}
              onDeleteAd={handleDeleteAd}
              onLogout={handleLogout}
            />
          ) : (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Espace Personnel Annonceur</h2>
              <p className="text-xs text-slate-600">
                Connectez-vous via votre numéro de téléphone gabonais (+241) pour retrouver vos annonces déposées, suivre leur validation en modération et gérer leur durée.
              </p>
              <button
                onClick={() => {
                  setAuthTriggerPurpose('DASHBOARD');
                  setIsPhoneAuthOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Se connecter par SMS Gabon (+241)</span>
              </button>
            </div>
          )
        )}
      </main>

      {/* Frontend Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-black text-sm shadow-sm">
              BZ
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-sm">
                BIZBOOSTER GABON • Solution anti-perte de temps
              </p>
              <p className="text-[11px] text-slate-400">
                Immobilier (9 provinces) • Matériel Roulant • Bric-à-Brac • Emploi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <span className="text-emerald-700">✓ Vente & Location</span>
            <span className="text-red-600">✓ Airtel Money Gabon</span>
            <span className="text-blue-600">✓ Moov Money Gabon</span>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Phone SMS Login & Terms Acceptance Modal */}
      <PhoneAuthModal
        isOpen={isPhoneAuthOpen}
        onClose={() => setIsPhoneAuthOpen(false)}
        onSuccessLogin={handleLoginSuccess}
        initialMode={authTriggerPurpose === 'PUBLISH' ? 'PUBLISH_TRIGGER' : 'LOGIN'}
      />

      {/* 2. Detail Modal */}
      <AdDetailModal
        ad={selectedAdForDetail}
        onClose={() => setSelectedAdForDetail(null)}
        onOpenExtendModal={(ad) => handleTriggerExtend(ad)}
        currentUser={currentUser}
      />

      {/* 3. Full Publishing & Mobile Payment Wizard */}
      <PublishAdModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onAdPublished={handleAdPublished}
        currentUser={currentUser}
        onSwitchToUserDashboard={() => {
          setFrontendTab('user-dashboard');
        }}
      />

      {/* 4. Extend Ad Validity Modal */}
      <ExtendAdModal
        ad={selectedAdForExtend}
        onClose={() => setSelectedAdForExtend(null)}
        onExtendSuccess={handleExtendSuccess}
      />

      {/* 5. Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Déconnexion de votre compte"
        message="Êtes-vous certain de vouloir vous déconnecter de votre Espace Annonceur BizBooster Gabon ?"
        confirmText="Déconnexion"
        cancelText="Rester connecté"
      />
    </div>
  );
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <AdminApp /> : <PublicApp />;
}
