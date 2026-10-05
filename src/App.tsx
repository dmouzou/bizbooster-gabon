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
  Clock,
  Grid,
  PlusCircle,
} from 'lucide-react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { ImmobilierFilterBar } from './components/ImmobilierFilterBar';
import { VehiclesFilterBar } from './components/VehiclesFilterBar';
import { TutoringFilterBar } from './components/TutoringFilterBar';
import { NecrologieFilterBar } from './components/NecrologieFilterBar';
import { EmploiFilterBar } from './components/EmploiFilterBar';
import { CguModal } from './components/CguModal';
import { AdCard } from './components/AdCard';
import { AdDetailModal } from './components/AdDetailModal';
import { PublishAdModal } from './components/PublishAdModal';
import { ExtendAdModal } from './components/ExtendAdModal';
import { EditAdModal } from './components/EditAdModal';
import { ConfirmEditOnlineModal } from './components/ConfirmEditOnlineModal';
import { UserDashboard } from './components/UserDashboard';
import { PhoneAuthModal } from './components/PhoneAuthModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { isAdOwner } from './utils/formatters';
import { sortAdsPersonalized, sortAdsRecent, recordCategoryInterest } from './utils/personalization';
import {
  Ad,
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
} from './types';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { INITIAL_ADS } from './data/initialAds';
import { isTestAd } from './components/AdminPanel';
import AdminApp from './AdminApp';

function PublicApp({ onSwitchToAdmin }: { onSwitchToAdmin?: () => void } = {}) {
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
            const data = snap.data();
            const existingFavs: string[] = data.favoriteAdIds || [];
            try {
              const guestStored = localStorage.getItem('bizbooster_guest_favorites');
              if (guestStored) {
                const guestFavs: string[] = JSON.parse(guestStored);
                if (Array.isArray(guestFavs) && guestFavs.length > 0) {
                  const merged = Array.from(new Set([...existingFavs, ...guestFavs]));
                  if (merged.length !== existingFavs.length) {
                    updateDoc(doc(db, 'users', fbUser.uid), { favoriteAdIds: merged });
                  }
                  localStorage.removeItem('bizbooster_guest_favorites');
                }
              }
            } catch {
              // ignore
            }
            setCurrentUser({
              id: fbUser.uid,
              ...data,
              password: data.password || 'users-with-no-password',
            } as UserProfile);
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

  // Point 3: Test ads visibility state (synced with Firestore system_config and localStorage, defaults to OFF/false)
  const [showTestAds, setShowTestAds] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bizbooster_show_test_ads');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  const [registeredUserIds, setRegisteredUserIds] = useState<string[]>([]);
  const [registeredPhones, setRegisteredPhones] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'system_config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.showTestAds === 'boolean') {
            setShowTestAds(data.showTestAds);
            try {
              localStorage.setItem('bizbooster_show_test_ads', String(data.showTestAds));
            } catch {}
          }
          if (Array.isArray(data.registeredUserIds)) {
            setRegisteredUserIds(data.registeredUserIds);
          }
          if (Array.isArray(data.registeredPhones)) {
            setRegisteredPhones(data.registeredPhones);
          }
        }
      },
      (err) => console.warn('system_config listener error:', err)
    );

    const handleLocalToggle = (e: any) => {
      if (typeof e?.detail?.showTestAds === 'boolean') {
        setShowTestAds(e.detail.showTestAds);
      }
    };
    window.addEventListener('bizbooster_test_ads_toggled', handleLocalToggle);

    return () => {
      unsub();
      window.removeEventListener('bizbooster_test_ads_toggled', handleLocalToggle);
    };
  }, []);

  // Check whether an ad belongs to a registered advertiser from the Admin Directory
  const isAdFromRegisteredAdvertiser = (ad: Ad): boolean => {
    if (ad.isTest) return false;
    // An ad must have a registered userId
    if (!ad.userId || ad.userId.startsWith('demo-') || ad.userId.startsWith('test-')) {
      return false;
    }
    // If registeredUserIds is available from system_config, check direct membership
    if (registeredUserIds.length > 0) {
      if (registeredUserIds.includes(ad.userId)) return true;
      const cleanPhone = (ad.contactPhone || '').replace(/\D/g, '');
      if (cleanPhone && registeredPhones.length > 0 && registeredPhones.some((p) => p.includes(cleanPhone) || cleanPhone.includes(p))) {
        return true;
      }
      return false;
    }
    // Fallback if list not yet loaded
    return !isTestAd(ad);
  };

  // Local views overrides for instant UI updates & non-duplicated views tracking
  const [localViewOverrides, setLocalViewOverrides] = useState<Record<string, number>>({});

  // Merge initial demonstration ads with live Firestore publicAds and myAds
  const ads = useMemo(() => {
    const map = new Map<string, Ad>();
    const now = Date.now();

    // 1. Initial test ads (Point 3: strictly active, non-expired, and ONLY if showTestAds is ON)
    if (showTestAds) {
      INITIAL_ADS
        .filter((a) => a.status === 'ACTIVE' && new Date(a.expiresAt).getTime() > now)
        .forEach((a) => map.set(a.id, a));
    }

    // 2. Real-time active public ads from Firestore (filtered if test ads are disabled)
    publicAds
      .filter((a) => a.status === 'ACTIVE' && new Date(a.expiresAt).getTime() > now)
      .filter((a) => showTestAds || isAdFromRegisteredAdvertiser(a))
      .forEach((a) => map.set(a.id, a));

    // 3. Current user's own ads from Firestore (even if PENDING_REVIEW or EXPIRED, for dashboard management)
    myAds.forEach((a) => map.set(a.id, a));

    const isCurrentUserVerified = currentUser?.idVerificationStatus === 'VERIFIED' || 
      !!currentUser?.idVerifiedAt || 
      currentUser?.isExempt || 
      currentUser?.exemptFromPaymentAndKyc;

    return Array.from(map.values()).map((a) => {
      let currentAd = a;
      // Point 2: Verified badge must also appear on VIP partners ads
      if (currentAd.isOwnerVip) {
        currentAd = { ...currentAd, isOwnerVerified: true };
      }
      if (isCurrentUserVerified && isAdOwner(currentAd, currentUser)) {
        currentAd = {
          ...currentAd,
          isOwnerVerified: true,
          isOwnerVip: currentAd.isOwnerVip || Boolean(currentUser?.isExempt || currentUser?.exemptFromPaymentAndKyc)
        };
      }
      const override = localViewOverrides[currentAd.id];
      if (override !== undefined && override > (currentAd.viewsCount || 0)) {
        return { ...currentAd, viewsCount: override };
      }
      return currentAd;
    });
  }, [publicAds, myAds, localViewOverrides, currentUser, showTestAds, registeredUserIds, registeredPhones]);

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

  // Cours à domicile specific filters (Point 9)
  const [tutoringKind, setTutoringKind] = useState<TutoringAdKind | 'ALL'>('ALL');
  const [tutoringSubject, setTutoringSubject] = useState<TutoringSubject | 'ALL'>('ALL');
  const [tutoringLevel, setTutoringLevel] = useState<TutoringLevel | 'ALL'>('ALL');
  const [tutoringProvince, setTutoringProvince] = useState('');
  const [tutoringCity, setTutoringCity] = useState('');

  // Nécrologie specific filters (Point 8)
  const [necroMinistry, setNecroMinistry] = useState<NecrologieMinistry | 'ALL'>('ALL');
  const [necroProvince, setNecroProvince] = useState('');
  const [necroCity, setNecroCity] = useState('');

  // Emploi specific filters (Point 8: Distinction Offre vs Demande)
  const [emploiJobKind, setEmploiJobKind] = useState<JobAdKind | 'ALL'>('ALL');
  const [emploiJobType, setEmploiJobType] = useState<string>('ALL');
  const [emploiProvince, setEmploiProvince] = useState('');
  const [emploiCity, setEmploiCity] = useState('');

  // Modals state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isCguModalOpen, setIsCguModalOpen] = useState(false);
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [authTriggerPurpose, setAuthTriggerPurpose] = useState<'PUBLISH' | 'DASHBOARD'>('DASHBOARD');
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<Ad | null>(null);
  const [selectedAdForExtend, setSelectedAdForExtend] = useState<Ad | null>(null);
  const [adToEdit, setAdToEdit] = useState<Ad | null>(null);
  const [adPendingEditConfirm, setAdPendingEditConfirm] = useState<Ad | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Favorites management (Requirement 4)
  const [guestFavoriteIds, setGuestFavoriteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('bizbooster_guest_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const activeFavoriteIds = useMemo(() => {
    if (currentUser) {
      return currentUser.favoriteAdIds || [];
    }
    return guestFavoriteIds;
  }, [currentUser, guestFavoriteIds]);

  const handleToggleFavorite = async (adId: string) => {
    const isFav = activeFavoriteIds.includes(adId);
    const newFavs = isFav
      ? activeFavoriteIds.filter((id) => id !== adId)
      : [...activeFavoriteIds, adId];

    if (currentUser) {
      const updatedUser: UserProfile = {
        ...currentUser,
        favoriteAdIds: newFavs,
      };
      setCurrentUser(updatedUser);
      showToast(isFav ? 'Annonce retirée de vos favoris' : 'Annonce ajoutée à vos favoris ❤️');
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          favoriteAdIds: newFavs,
        });
      } catch (err) {
        console.error('Error saving favorite to Firestore:', err);
      }
    } else {
      setGuestFavoriteIds(newFavs);
      try {
        localStorage.setItem('bizbooster_guest_favorites', JSON.stringify(newFavs));
      } catch (err) {
        console.error('Error saving guest favorite:', err);
      }
      if (!isFav) {
        showToast('Annonce ajoutée à vos favoris ❤️ (Connectez-vous pour voir votre liste dans votre espace)');
      } else {
        showToast('Annonce retirée de vos favoris');
      }
    }
  };

  // Deep-linking for shared ad (Requirement 5: ?ad=... or #ad-...)
  useEffect(() => {
    if (ads.length === 0) return;

    const checkUrlForAd = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const adIdFromQuery = searchParams.get('ad');
        const hash = window.location.hash;
        const adIdFromHash = hash.startsWith('#ad-') ? hash.slice(1) : (hash.startsWith('#') ? hash.slice(1) : null);
        const targetAdId = adIdFromQuery || adIdFromHash;

        if (targetAdId) {
          const matchedAd = ads.find((a) => a.id === targetAdId);
          if (matchedAd) {
            setSelectedAdForDetail(matchedAd);
            setFrontendTab('catalog');
          }
        }
      } catch (err) {
        console.error('Error parsing shared ad URL:', err);
      }
    };

    checkUrlForAd();
    window.addEventListener('popstate', checkUrlForAd);
    return () => window.removeEventListener('popstate', checkUrlForAd);
  }, [ads]);

  const handleCloseAdDetail = () => {
    setSelectedAdForDetail(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('ad');
      const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
      window.history.replaceState(null, '', cleanUrl);
    } catch {
      // ignore
    }
  };

  // Computed selected ad with freshest views count
  const activeSelectedAd = useMemo(() => {
    if (!selectedAdForDetail) return null;
    const found = ads.find((a) => a.id === selectedAdForDetail.id);
    return found
      ? { ...found, viewsCount: Math.max(found.viewsCount || 0, selectedAdForDetail.viewsCount || 0) }
      : selectedAdForDetail;
  }, [ads, selectedAdForDetail]);

  // Show quick toast notification
  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => {
      setNotificationMsg(null);
    }, 4500);
  };

  // Total active (publicly visible) ads count (strictly active & non-expired & excluding test ads if OFF)
  const activeAdsCount = useMemo(() => {
    const now = Date.now();
    return ads.filter(
      (ad) =>
        ad.status === 'ACTIVE' &&
        new Date(ad.expiresAt).getTime() > now &&
        (showTestAds || isAdFromRegisteredAdvertiser(ad))
    ).length;
  }, [ads, showTestAds, registeredUserIds, registeredPhones]);

  // Category counts calculation for ACTIVE and non-expired ads only (general visitors)
  const categoryCounts = useMemo(() => {
    const now = Date.now();
    const counts: Record<MainCategory | 'ALL', number> = {
      ALL: 0,
      IMMOBILIER: 0,
      MATERIEL_ROULANT: 0,
      BRIC_A_BRAC: 0,
      EMPLOI: 0,
      COURS_A_DOMICILE: 0,
      NECROLOGIE: 0,
    };
    ads.forEach((ad) => {
      if (
        ad.status === 'ACTIVE' &&
        new Date(ad.expiresAt).getTime() > now &&
        (showTestAds || isAdFromRegisteredAdvertiser(ad))
      ) {
        counts.ALL++;
        if (counts[ad.mainCategory] !== undefined) {
          counts[ad.mainCategory]++;
        }
      }
    });
    return counts;
  }, [ads, showTestAds, registeredUserIds, registeredPhones]);

  // Feed Sort Mode: 'RECOMMENDED' (personalisation selon historique & affinités) ou 'RECENT' (plus récentes en premier)
  const [feedSortMode, setFeedSortMode] = useState<'RECOMMENDED' | 'RECENT'>('RECOMMENDED');

  // Public Catalog Filtering engine (ONLY ACTIVE AND NON-EXPIRED APPROVED ADS)
  const filteredAds = useMemo(() => {
    const now = Date.now();
    const list = ads.filter((ad) => {
      // Point 3: When test ads are OFF (showTestAds === false), strictly hide any ad whose advertiser is not in the directory
      if (!showTestAds && !isAdFromRegisteredAdvertiser(ad)) {
        return false;
      }

      // 0. Only show ACTIVE ads to public viewers!
      if (ad.status !== 'ACTIVE') {
        return false;
      }

      // Requirement 3: Ensure expired ads are never shown in public catalog
      if (new Date(ad.expiresAt).getTime() <= now) {
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
        if (globalTransaction === 'EMPLOYER') {
          if (ad.mainCategory !== 'EMPLOI' && ad.transactionType !== 'EMPLOYER' && ad.transactionType !== 'A_EMPLOYER') {
            return false;
          }
        } else {
          if (ad.transactionType !== globalTransaction) {
            return false;
          }
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

      // 6. Specific Cours à Domicile filters (Point 9)
      if (activeCategory === 'COURS_A_DOMICILE') {
        const adKind = ad.tutoringData?.kind || (ad as any).tutoringKind;
        if (tutoringKind !== 'ALL') {
          if (!adKind || adKind !== tutoringKind) {
            return false;
          }
        }
        const adSubject = ad.tutoringData?.subject || (ad as any).tutoringSubject;
        if (tutoringSubject !== 'ALL') {
          if (!adSubject) return false;
          const normAdSub = adSubject.toLowerCase();
          const normFilterSub = tutoringSubject.toLowerCase();
          if (normAdSub !== normFilterSub && !normAdSub.includes(normFilterSub) && !normFilterSub.includes(normAdSub)) {
            return false;
          }
        }
        const adLevel = ad.tutoringData?.level || (ad as any).tutoringLevel;
        if (tutoringLevel !== 'ALL' && tutoringLevel !== 'Tous niveaux') {
          if (!adLevel) return false;
          const normAdLevel = adLevel.toLowerCase();
          const normFilterLevel = tutoringLevel.toLowerCase();
          if (normAdLevel !== normFilterLevel && !normAdLevel.includes(normFilterLevel) && !normFilterLevel.includes(normAdLevel)) {
            return false;
          }
        }
        if (tutoringProvince && ad.location?.province?.toLowerCase() !== tutoringProvince.toLowerCase()) {
          return false;
        }
        if (tutoringCity && ad.location?.city?.toLowerCase() !== tutoringCity.toLowerCase()) {
          return false;
        }
      }

      // 7. Specific Nécrologie filters (Point 8)
      if (activeCategory === 'NECROLOGIE') {
        const adMinistry = ad.necrologieData?.ministry || (ad as any).necroMinistry;
        if (necroMinistry !== 'ALL') {
          if (!adMinistry) return false;
          const normAdMin = adMinistry.toLowerCase();
          const normFilterMin = necroMinistry.toLowerCase();
          if (normAdMin !== normFilterMin && !normAdMin.includes(normFilterMin) && !normFilterMin.includes(normAdMin)) {
            return false;
          }
        }
        if (necroProvince && ad.location?.province?.toLowerCase() !== necroProvince.toLowerCase()) {
          return false;
        }
        if (necroCity && ad.location?.city?.toLowerCase() !== necroCity.toLowerCase()) {
          return false;
        }
      }

      // 8. Specific Emploi filters (Point 8: Offres vs Demandes)
      if (activeCategory === 'EMPLOI') {
        const isDemand = ad.jobKind === 'DEMANDE_EMPLOI' || ad.transactionType === 'CHERCHE_EMPLOI';
        if (emploiJobKind !== 'ALL') {
          if (emploiJobKind === 'OFFRE_EMPLOI' && isDemand) {
            return false;
          }
          if (emploiJobKind === 'DEMANDE_EMPLOI' && !isDemand) {
            return false;
          }
        }
        const adJobType = ad.domesticJobType || (ad as any).jobType;
        if (emploiJobType !== 'ALL') {
          if (!adJobType) return false;
          const normAdJob = adJobType.toLowerCase();
          const normFilterJob = emploiJobType.toLowerCase();
          if (normAdJob !== normFilterJob && !normAdJob.includes(normFilterJob) && !normFilterJob.includes(normAdJob)) {
            return false;
          }
        }
        if (emploiProvince && ad.location?.province?.toLowerCase() !== emploiProvince.toLowerCase()) {
          return false;
        }
        if (emploiCity && ad.location?.city?.toLowerCase() !== emploiCity.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Requirement 5: Personalization & recency sorting
    if (feedSortMode === 'RECOMMENDED') {
      return sortAdsPersonalized(list);
    } else {
      return sortAdsRecent(list);
    }
  }, [
    ads,
    feedSortMode,
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
    tutoringKind,
    tutoringSubject,
    tutoringLevel,
    tutoringProvince,
    tutoringCity,
    necroMinistry,
    necroProvince,
    necroCity,
    emploiJobKind,
    emploiJobType,
    emploiProvince,
    emploiCity,
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
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setCurrentUser(null);
    setIsLogoutConfirmOpen(false);
    sessionStorage.clear();
    // Requirement 5: Reload page on logout to completely reset session and reCAPTCHA state
    window.location.reload();
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

  // Ad pending deletion confirmation state (replaces native browser window.confirm - Point 6)
  const [adPendingDelete, setAdPendingDelete] = useState<Ad | null>(null);

  // Trigger custom in-app Delete Confirmation Modal
  const handleDeleteAd = (adId: string) => {
    const targetAd = ads.find((a) => a.id === adId) || null;
    if (targetAd) {
      setAdPendingDelete(targetAd);
    } else {
      setAdPendingDelete({ id: adId, title: 'Annonce sélectionnée' } as any);
    }
  };

  const handleConfirmDeleteAd = async () => {
    if (!adPendingDelete) return;
    const adId = adPendingDelete.id;
    setAdPendingDelete(null);
    try {
      await deleteDoc(doc(db, 'ads', adId));
      setMyAds((prev) => prev.filter((a) => a.id !== adId));
      setPublicAds((prev) => prev.filter((a) => a.id !== adId));
      showToast('Annonce supprimée avec succès.');
    } catch (e) {
      console.error(e);
      showToast('Suppression impossible. Réessayez.');
    }
  };

  // Handle selecting an ad detail with view counting and deep-link URL sync
  const handleSelectAdDetail = async (ad: Ad) => {
    setSelectedAdForDetail(ad);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('ad', ad.id);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }

    const sessionKey = `bizbooster_view_${ad.id}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      const nextViews = (ad.viewsCount || 0) + 1;
      setSelectedAdForDetail((curr) =>
        curr && curr.id === ad.id ? { ...curr, viewsCount: nextViews } : curr
      );
      setLocalViewOverrides((prev) => ({
        ...prev,
        [ad.id]: Math.max(nextViews, (prev[ad.id] || 0) + 1),
      }));

      try {
        await updateDoc(doc(db, 'ads', ad.id), {
          viewsCount: increment(1),
        });
      } catch (err) {
        console.warn('Could not increment viewsCount in Firestore:', err);
      }
    }
  };

  // Trigger editing ad - STRICTEMENT RÉSERVÉ AU DÉTENTEUR DE L'ANNONCE
  const handleTriggerEdit = (ad: Ad) => {
    if (!currentUser) {
      showToast("Veuillez vous connecter avec votre numéro gabonais pour modifier cette annonce.");
      setAuthTriggerPurpose('DASHBOARD');
      setIsPhoneAuthOpen(true);
      return;
    }

    if (!isAdOwner(ad, currentUser)) {
      showToast("Accès refusé : Seul le détenteur de l'annonce est autorisé à la modifier.");
      return;
    }

    // If ad is already ACTIVE (live online), warn user first via pop-up
    if (ad.status === 'ACTIVE') {
      setAdPendingEditConfirm(ad);
    } else {
      // Unverified ad (PENDING_REVIEW / PENDING_PAYMENT / REJECTED): can edit freely
      setAdToEdit(ad);
    }
  };

  // Save edited ad handler
  const handleSaveEditedAd = async (
    adId: string,
    updatedFields: Partial<Ad>,
    wasActive: boolean
  ) => {
    const targetAd = ads.find((a) => a.id === adId);
    if (!targetAd || !isAdOwner(targetAd, currentUser)) {
      showToast("Opération refusée : Vous n'êtes pas le détenteur autorisé de cette annonce.");
      return;
    }

    try {
      await updateDoc(doc(db, 'ads', adId), {
        ...updatedFields,
        ...(wasActive ? { status: 'PENDING_REVIEW' } : {}),
        updatedAt: new Date().toISOString(),
      });

      if (wasActive) {
        showToast("Modifications enregistrées ! Votre annonce a été renvoyée en modération administrative pour vérification.");
      } else {
        showToast("Modifications enregistrées avec succès !");
      }
      setAdToEdit(null);
    } catch (e) {
      console.error('Failed to update ad:', e);
      showToast("Erreur lors de l'enregistrement des modifications.");
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

  // Handle extending ad duration with VIP free advantage and strict 365 days limit
  const handleExtendSuccess = async (
    adId: string,
    additionalDays: number,
    paymentInfo: { operator: PaymentOperator; transactionRef: string; isFreeVip?: boolean }
  ) => {
    const targetAd = ads.find((a) => a.id === adId);
    if (!targetAd || !isAdOwner(targetAd, currentUser)) {
      showToast("Opération refusée : Vous n'êtes pas le détenteur autorisé de cette annonce.");
      setSelectedAdForExtend(null);
      return;
    }

    const base = Math.max(new Date(targetAd.expiresAt).getTime(), Date.now());
    const maxExpiry = Date.now() + 365 * 86400000;
    const computedExpiry = base + Math.min(additionalDays, 365) * 86400000;
    const finalExpiry = Math.min(computedExpiry, maxExpiry);
    const effectiveDays = Math.max(1, Math.round((finalExpiry - base) / 86400000));

    if (finalExpiry <= base) {
      showToast("Cette annonce a déjà atteint la durée maximale autorisée de validité continue (365 jours).");
      setSelectedAdForExtend(null);
      return;
    }

    const isVip = Boolean(
      paymentInfo.isFreeVip ||
      currentUser?.exemptFromPaymentAndKyc ||
      currentUser?.isExempt ||
      currentUser?.role === 'ADMIN'
    );

    try {
      if (isVip) {
        // VIP partner: instant free extension applied immediately to Firestore
        await updateDoc(doc(db, 'ads', adId), {
          expiresAt: new Date(finalExpiry).toISOString(),
          durationDays: Math.min(365, (targetAd.durationDays || 0) + effectiveDays),
          status: targetAd.status === 'EXPIRED' ? 'ACTIVE' : targetAd.status,
          paymentMethod: 'AIRTEL',
          transactionRef: paymentInfo.transactionRef || `VIP-EXT-${Date.now().toString(36).toUpperCase()}`,
          paidAmount: 0,
          paymentVerified: true,
          lastExtendedAt: new Date().toISOString(),
        });
        showToast(`Prolongation de +${effectiveDays} jours appliquée avec succès !`);
      } else {
        // Standard user: Filed for administrative payment check
        await updateDoc(doc(db, 'ads', adId), {
          pendingExtension: {
            days: effectiveDays,
            operator: paymentInfo.operator,
            transactionRef: paymentInfo.transactionRef,
            requestedAt: new Date().toISOString(),
          },
        });
        showToast(`Prolongation de +${effectiveDays} jours demandée. Elle sera validée après vérification du paiement.`);
      }
    } catch (e) {
      console.error(e);
      showToast('Erreur lors de la prolongation.');
    }
    setSelectedAdForExtend(null);
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

  const handleResetEmploiFilters = () => {
    setEmploiJobKind('ALL');
    setEmploiJobType('ALL');
    setEmploiProvince('');
    setEmploiCity('');
  };

  const handleResetTutoringFilters = () => {
    setTutoringKind('ALL');
    setTutoringSubject('ALL');
    setTutoringLevel('ALL');
    setTutoringProvince('');
    setTutoringCity('');
  };

  const handleResetNecroFilters = () => {
    setNecroMinistry('ALL');
    setNecroProvince('');
    setNecroCity('');
  };

  const handleSelectCategory = (category: MainCategory | 'ALL') => {
    setActiveCategory(category);
    if (category !== 'ALL') {
      recordCategoryInterest(category);
    }
    handleResetImmoFilters();
    handleResetVehiclesFilters();
    handleResetEmploiFilters();
    handleResetTutoringFilters();
    handleResetNecroFilters();
  };

  // Update user profile in Firestore (for subscriptions, ad packs, free boosts)
  const handleUpdateUserProfile = async (updated: Partial<UserProfile>) => {
    const uid = currentUser?.id || auth.currentUser?.uid;
    if (!uid) {
      console.error('handleUpdateUserProfile: No user ID found');
      showToast("Erreur : utilisateur non identifié.");
      throw new Error("Utilisateur non identifié");
    }
    try {
      await updateDoc(doc(db, 'users', uid), updated);
      setCurrentUser((prev) => (prev ? { ...prev, ...updated, id: uid } : null));

      // Point 1: If advertiser name is updated, automatically synchronize the new name on ALL their ads
      if (updated.name && updated.name.trim() && (!currentUser || updated.name.trim() !== currentUser.name)) {
        const newName = updated.name.trim();
        const userAdsToUpdate = ads.filter((ad) => isAdOwner(ad, currentUser) || (ad.userId && ad.userId === uid));
        if (userAdsToUpdate.length > 0) {
          try {
            const batch = writeBatch(db);
            userAdsToUpdate.forEach((ad) => {
              batch.update(doc(db, 'ads', ad.id), { contactName: newName });
            });
            await batch.commit();
            setMyAds((prev) =>
              prev.map((ad) =>
                isAdOwner(ad, currentUser) || (ad.userId && ad.userId === uid)
                  ? { ...ad, contactName: newName }
                  : ad
              )
            );
            setPublicAds((prev) =>
              prev.map((ad) =>
                isAdOwner(ad, currentUser) || (ad.userId && ad.userId === uid)
                  ? { ...ad, contactName: newName }
                  : ad
              )
            );
          } catch (batchErr) {
            console.error('Error synchronizing advertiser name on ads:', batchErr);
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to update user profile in Firestore:', e);
      showToast("Erreur lors de la mise à jour du profil.");
      throw e;
    }
  };

  // Boost ad to top ("En Tête de Liste" - 7 jours)
  const handleBoostAd = async (adId: string) => {
    const targetAd = ads.find((a) => a.id === adId);
    if (!targetAd || !isAdOwner(targetAd, currentUser)) {
      showToast("Opération refusée : Vous n'êtes pas le détenteur de cette annonce.");
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const featuredUntil = new Date(Date.now() + 7 * 86400000).toISOString();
      await updateDoc(doc(db, 'ads', adId), {
        isFeatured: true,
        featuredUntil,
        featuredAt: nowIso,
        ownerTier: currentUser?.subscriptionTier || 'STANDARD',
        isOwnerVip: Boolean(currentUser?.exemptFromPaymentAndKyc || currentUser?.isExempt),
      });

      // If user has free boosts remaining, decrement exactly ONCE
      const uid = currentUser?.id || auth.currentUser?.uid;
      if (uid && (currentUser?.freeBoostsRemaining || 0) > 0) {
        const newBalance = Math.max(0, (currentUser?.freeBoostsRemaining || 0) - 1);
        await updateDoc(doc(db, 'users', uid), {
          freeBoostsRemaining: newBalance,
        });
        setCurrentUser((prev) => (prev ? { ...prev, freeBoostsRemaining: newBalance } : null));
      }

      showToast("🚀 Votre annonce a été propulsée 'En Tête de Liste' pour 7 jours !");
    } catch (e: any) {
      console.error('Failed to boost ad:', e);
      showToast("Erreur lors de la mise en avant.");
      throw e;
    }
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
        onSwitchToAdmin={onSwitchToAdmin}
      />

      <main className="flex-1 max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 w-full space-y-5 sm:space-y-6 pb-28 md:pb-8">
        {/* TAB 1: PUBLIC CATALOGUE (100% LIBRE, GRATUIT, VÉRIFIÉ) */}
        {frontendTab === 'catalog' && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
            {/* Hero Banner for Public Visitors (Optimized for mobile & desktop) */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white p-5 sm:p-8 lg:p-10 shadow-xl border border-emerald-700/30">
              <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs font-bold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-emerald-400/30 backdrop-blur-xs">
                  <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-300" />
                  <span>Portail Annonces & Commerce au Gabon • 100% Vérifié</span>
                </div>
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                  Achetez, Louez ou Vendez rapidement dans tout le <span className="text-amber-400">Gabon</span>.
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed hidden sm:block">
                  Immobilier géolocalisé par province, ville et quartier, Matériel Roulant (voitures, 4x4, engins), Bric-à-Brac et Emploi. Toutes les annonces sont vérifiées avant publication.
                </p>

                {/* Quick actions row in Hero */}
                <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleTriggerPublish}
                    className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-emerald-950 font-black text-xs sm:text-sm px-4 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg transition-all transform hover:scale-102 flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                  >
                    <span>Déposer une annonce maintenant</span>
                    <ArrowRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
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
                  <button
                    onClick={() => setGlobalTransaction('EMPLOYER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      globalTransaction === 'EMPLOYER'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    À Employer
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

            {/* Specialized Filters: COURS A DOMICILE (Point 9) */}
            {activeCategory === 'COURS_A_DOMICILE' && (
              <TutoringFilterBar
                selectedKind={tutoringKind}
                onChangeKind={setTutoringKind}
                selectedSubject={tutoringSubject}
                onChangeSubject={setTutoringSubject}
                selectedLevel={tutoringLevel}
                onChangeLevel={setTutoringLevel}
                selectedProvince={tutoringProvince}
                onChangeProvince={setTutoringProvince}
                selectedCity={tutoringCity}
                onChangeCity={setTutoringCity}
                onResetFilters={() => {
                  setTutoringKind('ALL');
                  setTutoringSubject('ALL');
                  setTutoringLevel('ALL');
                  setTutoringProvince('');
                  setTutoringCity('');
                }}
              />
            )}

            {/* Specialized Filters: NECROLOGIE (Point 8) */}
            {activeCategory === 'NECROLOGIE' && (
              <NecrologieFilterBar
                selectedMinistry={necroMinistry}
                onChangeMinistry={setNecroMinistry}
                selectedProvince={necroProvince}
                onChangeProvince={setNecroProvince}
                selectedCity={necroCity}
                onChangeCity={setNecroCity}
                onResetFilters={() => {
                  setNecroMinistry('ALL');
                  setNecroProvince('');
                  setNecroCity('');
                }}
              />
            )}

            {/* Specialized Filters: EMPLOI (Point 8: Distinction Offre vs Demande) */}
            {activeCategory === 'EMPLOI' && (
              <EmploiFilterBar
                selectedJobKind={emploiJobKind}
                onChangeJobKind={setEmploiJobKind}
                selectedKind={emploiJobKind}
                onChangeKind={setEmploiJobKind}
                selectedJobType={emploiJobType}
                onChangeJobType={setEmploiJobType}
                selectedProvince={emploiProvince}
                onChangeProvince={setEmploiProvince}
                selectedCity={emploiCity}
                onChangeCity={setEmploiCity}
                onResetFilters={handleResetEmploiFilters}
              />
            )}

            {/* Ads Grid Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
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

              <div className="flex items-center gap-2 flex-wrap">
                {/* Sort Mode Switcher: Requirement 5 */}
                <div className="inline-flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-bold">
                  <button
                    onClick={() => setFeedSortMode('RECOMMENDED')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      feedSortMode === 'RECOMMENDED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Annonces adaptées à vos préférences et recherches récentes"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Pour vous</span>
                  </button>
                  <button
                    onClick={() => setFeedSortMode('RECENT')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      feedSortMode === 'RECENT'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Annonces triées par ordre chronologique de publication"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Plus récentes</span>
                  </button>
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
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer px-2 py-1"
                  >
                    Réinitialiser filtres
                  </button>
                )}
              </div>
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
                      isFavorite={activeFavoriteIds.includes(ad.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectAd={(selected) => handleSelectAdDetail(selected)}
                      onOpenExtendModal={isOwner ? () => handleTriggerExtend(ad) : undefined}
                      onEditAd={isOwner ? () => handleTriggerEdit(ad) : undefined}
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
              onEditAd={(ad) => handleTriggerEdit(ad)}
              onSelectAdDetail={(ad) => handleSelectAdDetail(ad)}
              onDeleteAd={handleDeleteAd}
              onLogout={handleLogout}
              onBoostAd={handleBoostAd}
              onUpdateUser={handleUpdateUserProfile}
              onSwitchToAdmin={onSwitchToAdmin}
              onToggleFavorite={handleToggleFavorite}
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

      {/* Frontend Footer - Extra bottom padding on mobile so floating bottom nav doesn't overlap footer (Point 2, Image 3) */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 pb-32 md:pb-8 text-xs text-slate-500">
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
                Immobilier (9 provinces) • Matériel Roulant • Bric-à-Brac • Emploi • Cours à Domicile • Nécrologie
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsCguModalOpen(true)}
              className="text-slate-600 hover:text-emerald-700 underline cursor-pointer transition-colors"
            >
              Conditions Générales (CGU) & Clause de Non-responsabilité
            </button>
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
        ad={activeSelectedAd}
        onClose={handleCloseAdDetail}
        onOpenExtendModal={(ad) => handleTriggerExtend(ad)}
        onEditAd={(ad) => handleTriggerEdit(ad)}
        currentUser={currentUser}
        isFavorite={activeSelectedAd ? activeFavoriteIds.includes(activeSelectedAd.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* 3. Full Publishing & Mobile Payment Wizard */}
      <PublishAdModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onAdPublished={handleAdPublished}
        currentUser={currentUser}
        userAds={myAds}
        onUpdateUser={handleUpdateUserProfile}
        onSwitchToUserDashboard={() => {
          setFrontendTab('user-dashboard');
        }}
      />

      {/* 4. Extend Ad Validity Modal */}
      <ExtendAdModal
        ad={selectedAdForExtend}
        currentUser={currentUser}
        onClose={() => setSelectedAdForExtend(null)}
        onExtendSuccess={handleExtendSuccess}
      />

      {/* 5. Warning confirmation modal for editing an already online ad */}
      <ConfirmEditOnlineModal
        isOpen={!!adPendingEditConfirm}
        ad={adPendingEditConfirm}
        onClose={() => setAdPendingEditConfirm(null)}
        onConfirm={() => {
          if (adPendingEditConfirm) {
            setAdToEdit(adPendingEditConfirm);
            setAdPendingEditConfirm(null);
          }
        }}
      />

      {/* 6. Edit Ad Modal */}
      <EditAdModal
        isOpen={!!adToEdit}
        ad={adToEdit}
        onClose={() => setAdToEdit(null)}
        onSave={handleSaveEditedAd}
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

      {/* 6. CGU & Clause de Non-responsabilité Modal (Point 2) */}
      <CguModal
        isOpen={isCguModalOpen}
        onClose={() => setIsCguModalOpen(false)}
      />

      {/* 7. Delete Ad Confirmation Modal (Replaces browser confirm dialog - Point 6) */}
      <DeleteConfirmModal
        isOpen={!!adPendingDelete}
        onClose={() => setAdPendingDelete(null)}
        onConfirm={handleConfirmDeleteAd}
        title="Supprimer cette annonce ?"
        adTitle={adPendingDelete?.title}
        message="Êtes-vous certain de vouloir supprimer cette annonce ? Cette action est irréversible et retirera définitivement votre annonce du catalogue."
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
      />

      {/* 6. Native Mobile Bottom Navigation Bar (Optimized for quick thumb reach) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl flex items-center justify-around">
        {/* Tab 1: Catalogue */}
        <button
          onClick={() => {
            setFrontendTab('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            frontendTab === 'catalog'
              ? 'text-emerald-700 font-black'
              : 'text-slate-500 font-semibold hover:text-slate-800'
          }`}
          id="mobile-nav-catalog"
        >
          <div className={`p-1.5 rounded-xl transition-colors ${frontendTab === 'catalog' ? 'bg-emerald-100/80 text-emerald-700' : 'text-slate-500'}`}>
            <Grid className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Catalogue</span>
        </button>

        {/* Tab 2: Publier (Central Elevated Action Button) */}
        <button
          onClick={handleTriggerPublish}
          className="flex flex-col items-center -mt-5 group cursor-pointer"
          id="mobile-nav-publish"
        >
          <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-700/30 group-hover:scale-105 active:scale-95 transition-all border-4 border-white">
            <PlusCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-black text-emerald-800 mt-0.5">Publier</span>
        </button>

        {/* Tab 3: Mon Espace */}
        <button
          onClick={() => {
            if (currentUser) {
              setFrontendTab('user-dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              setAuthTriggerPurpose('DASHBOARD');
              setIsPhoneAuthOpen(true);
            }
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            frontendTab === 'user-dashboard'
              ? 'text-emerald-700 font-black'
              : 'text-slate-500 font-semibold hover:text-slate-800'
          }`}
          id="mobile-nav-user"
        >
          <div className={`p-1.5 rounded-xl transition-colors relative ${frontendTab === 'user-dashboard' ? 'bg-emerald-100/80 text-emerald-700' : 'text-slate-500'}`}>
            <User className="w-5 h-5" />
            {currentUser && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="text-[10px] truncate max-w-[75px]">
            {currentUser ? currentUser.name.split(' ')[0] : 'Mon Espace'}
          </span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<'frontend' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/admin')) {
        return 'admin';
      }
    }
    return 'frontend';
  });

  useEffect(() => {
    const handlePopState = () => {
      // Point 5: Prevent the browser back button on frontend from routing to /admin
      if (window.location.pathname.startsWith('/admin')) {
        if (currentView === 'frontend') {
          // If already on frontend, replace state to root and stay on frontend
          window.history.replaceState(null, '', '/');
          return;
        }
        setCurrentView('admin');
      } else {
        setCurrentView('frontend');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView]);

  const switchToAdmin = () => {
    setCurrentView('admin');
    if (!window.location.pathname.startsWith('/admin')) {
      window.history.pushState(null, '', '/admin');
    }
  };

  const switchToFrontend = () => {
    setCurrentView('frontend');
    // Point 5: Use replaceState so /admin is NOT kept in browser history behind frontend
    window.history.replaceState(null, '', '/');
  };

  return currentView === 'admin' ? (
    <AdminApp onSwitchToFrontend={switchToFrontend} />
  ) : (
    <PublicApp onSwitchToAdmin={switchToAdmin} />
  );
}
