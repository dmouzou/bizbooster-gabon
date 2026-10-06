import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  PlusCircle,
  RefreshCw,
  LogOut,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  Trash2,
  Building2,
  Car,
  Package,
  Briefcase,
  Sparkles,
  ShieldAlert,
  FileText,
  X,
  Edit3,
  Crown,
  Zap,
  Check,
  ArrowRight,
  Star,
  Flame,
  KeyRound,
  Lock,
  EyeOff,
  Layers,
  AlertTriangle,
  PauseCircle,
  Heart,
  ArrowUpDown,
} from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Ad, UserProfile, SubscriptionTier, BoosterPackType, AdPackType, PaymentOperator, isUserAdmin, isUserSuperAdmin } from '../types';
import { formatFCFA, formatRemainingTime, isAdOwner, formatPriceDisplay, getPriceOrSalaryLabel, formatPriceUnit, isJobAd } from '../utils/formatters';
import { isAdBoostFeatured } from '../utils/personalization';
import { GABON_PROVINCES } from '../data/gabonLocations';
import { KycUploadModal } from './KycUploadModal';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';
import { SubscriptionUpgradeModal } from './SubscriptionUpgradeModal';
import { AdCard } from './AdCard';
import { AppAlertModal, AlertModalConfig } from './AppAlertModal';
import { recordPasswordCooldown } from '../utils/passwordCooldown';

const formatGabonPhone = (raw: string) => {
  let clean = raw.replace(/[^0-9]/g, '');
  if (clean.startsWith('241')) clean = clean.slice(3);
  if (clean.startsWith('0')) clean = clean.slice(1);
  return `+241${clean}`;
};

interface UserDashboardProps {
  currentUser: UserProfile;
  ads: Ad[];
  onOpenPublishModal: () => void;
  onOpenExtendModal: (ad: Ad) => void;
  onEditAd: (ad: Ad) => void;
  onSelectAdDetail: (ad: Ad) => void;
  onDeleteAd: (adId: string) => void;
  onLogout: () => void;
  onBoostAd?: (adId: string) => Promise<void>;
  onUpdateUser?: (updated: Partial<UserProfile>) => Promise<void>;
  onSwitchToAdmin?: () => void;
  onToggleFavorite?: (adId: string) => void;
}

const TIER_ORDER: Record<SubscriptionTier, number> = {
  STANDARD: 0,
  PRO: 1,
  ELITE: 2,
  BUSINESS: 3,
};

const TIER_PRICES: Record<SubscriptionTier, number> = {
  STANDARD: 0,
  PRO: 29000,
  ELITE: 59000,
  BUSINESS: 99000,
};

const TIER_QUOTAS: Record<SubscriptionTier, number> = {
  STANDARD: 3,
  PRO: 8,
  ELITE: 14,
  BUSINESS: 20,
};

const SUBSCRIPTION_TIERS = [
  {
    tier: 'PRO' as const,
    name: 'Pro',
    price: 29000,
    period: '/ mois',
    badgeColor: 'bg-blue-600 text-white',
    ringColor: 'border-blue-300 hover:border-blue-500',
    description: 'Idéal pour indépendants, artisans et petites activités.',
    features: [
      "Jusqu'à 8 annonces simultanées sans frais supplémentaires",
      "1 Boost 'En Tête de Liste' offert par mois (valeur 5 000 F)",
      '-25% de réduction sur toutes les prolongations',
      "Badge vérifié 'Pro' sur toutes vos annonces",
      'Support prioritaire via WhatsApp',
    ],
  },
  {
    tier: 'ELITE' as const,
    name: 'Élite',
    popular: true,
    price: 59000,
    period: '/ mois',
    badgeColor: 'bg-purple-600 text-white',
    ringColor: 'border-purple-300 hover:border-purple-500',
    description: 'Parfait pour agences immobilières et concessionnaires auto.',
    features: [
      "Jusqu'à 14 annonces simultanées incluses",
      "3 Boosts 'En Tête de Liste' offerts par mois (valeur 15 000 F)",
      '-50% de réduction sur toutes les prolongations',
      'Badge prestige doré et visibilité renforcée',
      'Support prioritaire dédié 7j/7',
      'Statistiques avancées des contacts & clics WhatsApp',
    ],
  },
  {
    tier: 'BUSINESS' as const,
    name: 'Business',
    price: 99000,
    period: '/ mois',
    badgeColor: 'bg-emerald-600 text-white',
    ringColor: 'border-emerald-300 hover:border-emerald-500',
    description: 'Plafond maximal pour grandes entreprises et promoteurs.',
    features: [
      "Jusqu'à 20 annonces simultanées incluses (Plafond ultime du site)",
      "6 Boosts 'En Tête de Liste' offerts par mois (valeur 30 000 F)",
      'Prolongations 100% GRATUITES et illimitées (Exemption totale)',
      "Badge officiel 'Entreprise Partenaire Business'",
      'Référencement prioritaire en tête de rubrique',
      'Publication assistée directement par WhatsApp avec conseiller dédié',
    ],
  },
];

const BOOSTER_PACKS = [
  {
    type: 'BOOST_5' as const,
    name: 'Pack 5 Boosters',
    price: 15000,
    boostsCount: 5,
    description: '5 boosts "En Tête de Liste" (7 jours par boost) pour propulser vos annonces en première position.',
  },
  {
    type: 'BOOST_10' as const,
    name: 'Pack 10 Boosters',
    price: 25000,
    boostsCount: 10,
    description: '10 boosts "En Tête de Liste" (7 jours par boost) avec forte remise pour maximiser vos contacts.',
  },
];

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  ads,
  onOpenPublishModal,
  onOpenExtendModal,
  onEditAd,
  onSelectAdDetail,
  onDeleteAd,
  onLogout,
  onBoostAd,
  onUpdateUser,
  onSwitchToAdmin,
  onToggleFavorite,
}) => {
  const [dashboardTab, setDashboardTab] = useState<'ADS' | 'FAVORITES' | 'SUBSCRIPTIONS' | 'PROFILE'>('ADS');
  // Point 5: Inclus la case 'Expirées' et la fonction 'Trier par'
  type UserDashboardFilterStatus = 'ALL' | 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REJECTED' | 'SUSPENDED';
  const [filterStatus, setFilterStatus] = useState<UserDashboardFilterStatus>('ALL');
  type UserAdsSortOption = 'DATE_DESC' | 'DATE_ASC' | 'EXPIRY_ASC' | 'VIEWS_DESC' | 'PRICE_DESC' | 'PRICE_ASC';
  const [adsSortBy, setAdsSortBy] = useState<UserAdsSortOption>('DATE_DESC');
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<string | null>(null);

  // Boost modal state (Requirement 4: single vs pack)
  const [adToBoost, setAdToBoost] = useState<Ad | null>(null);
  const [isBoostingAd, setIsBoostingAd] = useState(false);
  const [showBoostPayment, setShowBoostPayment] = useState(false);
  const [boostOption, setBoostOption] = useState<'SINGLE' | 'PACK'>('SINGLE');
  const [selectedPackForBoost, setSelectedPackForBoost] = useState<(typeof BOOSTER_PACKS)[number] | null>(null);
  const [showBoosterPacksModal, setShowBoosterPacksModal] = useState(false);

  // Profile update state (Requirement 3c)
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [profileProvince, setProfileProvince] = useState(currentUser.location?.province || 'Estuaire');
  const [profileCity, setProfileCity] = useState(currentUser.location?.city || 'Libreville');
  const [profileNeighborhood, setProfileNeighborhood] = useState(currentUser.location?.neighborhood || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // App Alert Modal State (Point 1: replaces native alert/confirm)
  const [alertModalConfig, setAlertModalConfig] = useState<AlertModalConfig | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    setAlertModalConfig({
      isOpen: true,
      message,
      type,
      title,
    });
  };

  // Password reset flow state in Profile (Requirement 3c with OTP and 24h cooldown)
  const [pwdStep, setPwdStep] = useState<'IDLE' | 'OTP' | 'NEW_PWD'>('IDLE');
  const [pwdOtp, setPwdOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdResendTimer, setPwdResendTimer] = useState(45);
  const pwdConfirmationRef = useRef<ConfirmationResult | null>(null);
  const pwdRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // 24-hour password rate limiting
  const passwordCooldown = useMemo(() => {
    if (!currentUser.lastPasswordChangeDate) {
      return { canChange: true, remainingHours: 0 };
    }
    const lastTime = new Date(currentUser.lastPasswordChangeDate).getTime();
    if (isNaN(lastTime)) return { canChange: true, remainingHours: 0 };
    const diffMs = Date.now() - lastTime;
    const dayMs = 24 * 3600 * 1000;
    if (diffMs < dayMs) {
      const remainingHours = Math.ceil((dayMs - diffMs) / (3600 * 1000));
      return { canChange: false, remainingHours };
    }
    return { canChange: true, remainingHours: 0 };
  }, [currentUser.lastPasswordChangeDate]);

  // Cities matching selected province in profile
  const profileCities = GABON_PROVINCES.find((p) => p.name === profileProvince)?.cities || [];

  // Countdown timer for password OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pwdStep === 'OTP' && pwdResendTimer > 0) {
      interval = setInterval(() => {
        setPwdResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pwdStep, pwdResendTimer]);

  const getOrCreatePwdRecaptcha = () => {
    let container = document.getElementById('pwd-recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pwd-recaptcha-container';
      document.body.appendChild(container);
    }
    if (pwdRecaptchaRef.current) {
      try {
        pwdRecaptchaRef.current.clear();
      } catch (e) {
        // ignore
      }
      pwdRecaptchaRef.current = null;
    }
    container.innerHTML = '';
    auth.languageCode = 'fr';
    pwdRecaptchaRef.current = new RecaptchaVerifier(auth, 'pwd-recaptcha-container', {
      size: 'invisible',
      callback: () => {},
    });
    return pwdRecaptchaRef.current;
  };

  // Subscriptions & Booster Pack payment simulator state
  const [itemToPurchase, setItemToPurchase] = useState<{
    type: 'SUBSCRIPTION' | 'BOOSTER_PACK';
    title: string;
    price: number;
    tier?: SubscriptionTier;
    boostCount?: number;
    packType?: BoosterPackType;
  } | null>(null);

  const [upgradedTierModal, setUpgradedTierModal] = useState<SubscriptionTier | null>(null);

  const isExempt = !!(currentUser.exemptFromPaymentAndKyc || currentUser.isExempt);
  const kycStatus = currentUser.idVerificationStatus || 'NOT_SUBMITTED';
  const isKycVerified = kycStatus === 'VERIFIED' || !!currentUser.idVerifiedAt || (!!currentUser.idDocumentUrl && kycStatus !== 'REJECTED' && kycStatus !== 'PENDING');
  // Point 1: ID card is an optional trust badge, no longer required for transactions or publishing
  const isAllowedToTransact = true;

  const handleSafeOpenPublish = () => {
    onOpenPublishModal();
  };

  const handleOpenBoostModal = (ad: Ad) => {
    setAdToBoost(ad);
    setSelectedPackForBoost(null);
    setBoostOption('SINGLE');
  };

  // Filter ads strictly belonging to this user
  const myAds = ads.filter((ad) => isAdOwner(ad, currentUser));

  // User favorite ads list
  const favoriteAds = useMemo(() => {
    const favIds = currentUser.favoriteAdIds || [];
    return ads.filter((ad) => favIds.includes(ad.id));
  }, [ads, currentUser.favoriteAdIds]);

  const activeCount = myAds.filter((a) => a.status === 'ACTIVE').length;
  const pendingCount = myAds.filter((a) => a.status === 'PENDING_REVIEW').length;
  const rejectedCount = myAds.filter((a) => a.status === 'REJECTED').length;
  const totalViews = myAds.reduce((sum, a) => sum + (a.viewsCount || 0), 0);

  // Count simultaneous active/pending ads
  const now = Date.now();
  const userSimultaneousAds = myAds.filter(
    (a) => a.status !== 'REJECTED' && new Date(a.expiresAt).getTime() > now
  );
  const simultaneousCount = userSimultaneousAds.length;

  const currentTier: SubscriptionTier = currentUser.subscriptionTier || 'STANDARD';

  // Requirement 4: Subscription Expiration & Quota Downgrade Management
  const isSubscriptionExpired = useMemo(() => {
    if (isExempt) return false;
    if (!currentUser.subscriptionTier || currentUser.subscriptionTier === 'STANDARD') return false;
    if (!currentUser.subscriptionExpiresAt) return false;
    return new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now();
  }, [currentUser.subscriptionTier, currentUser.subscriptionExpiresAt, isExempt]);

  const effectiveTier: SubscriptionTier = isSubscriptionExpired
    ? 'STANDARD'
    : currentUser.subscriptionTier || 'STANDARD';

  const maxQuota = useMemo(() => {
    if (isExempt) return 20; // VIP Partner limit is 20 to reflect Business version
    if (effectiveTier === 'BUSINESS') return 20;
    if (effectiveTier === 'ELITE') return 14;
    if (effectiveTier === 'PRO') return 8;
    return 3; // Standard free users: max 3 simultaneous ads
  }, [effectiveTier, isExempt]);

  // Subscription upgrade/downgrade logic (Point 5)
  const isSubscriptionActive = !isSubscriptionExpired && effectiveTier !== 'STANDARD';

  const subscriptionStartedAtMs = useMemo(() => {
    if (currentUser.subscriptionStartedAt) {
      return new Date(currentUser.subscriptionStartedAt).getTime();
    }
    if (currentUser.subscriptionExpiresAt) {
      const expiresMs = new Date(currentUser.subscriptionExpiresAt).getTime();
      return Math.max(0, expiresMs - 30 * 86400000);
    }
    return Date.now();
  }, [currentUser.subscriptionStartedAt, currentUser.subscriptionExpiresAt]);

  const subscriptionAgeDays = useMemo(() => {
    if (!isSubscriptionActive) return 0;
    return Math.max(0, (Date.now() - subscriptionStartedAtMs) / (24 * 3600 * 1000));
  }, [isSubscriptionActive, subscriptionStartedAtMs]);

  const hasExceededOneWeek = subscriptionAgeDays > 7;

  const [downgradeConfirmationTier, setDowngradeConfirmationTier] = useState<(typeof SUBSCRIPTION_TIERS)[number] | null>(null);
  const [isDowngrading, setIsDowngrading] = useState<boolean>(false);

  const getTierUpgradeInfo = (targetTier: SubscriptionTier) => {
    const currentRank = TIER_ORDER[effectiveTier] || 0;
    const targetRank = TIER_ORDER[targetTier] || 0;
    const targetPrice = TIER_PRICES[targetTier] || 0;
    const currentPrice = TIER_PRICES[effectiveTier] || 0;

    if (targetRank === currentRank) {
      return {
        type: 'SAME' as const,
        priceToPay: 0,
      };
    }

    // Downgrade (e.g. Business -> Elite or Pro, or Elite -> Pro)
    if (isSubscriptionActive && targetRank < currentRank) {
      return {
        type: 'DOWNGRADE' as const,
        priceToPay: 0,
      };
    }

    // Upgrade (e.g. Pro -> Elite or Business, or Elite -> Business)
    if (isSubscriptionActive && targetRank > currentRank) {
      if (hasExceededOneWeek) {
        return {
          type: 'UPGRADE_FULL' as const,
          priceToPay: targetPrice,
        };
      } else {
        const surplus = Math.max(0, targetPrice - currentPrice);
        return {
          type: 'UPGRADE_SURPLUS' as const,
          priceToPay: surplus,
        };
      }
    }

    // New subscription (Standard free user or expired subscription)
    return {
      type: 'NEW' as const,
      priceToPay: targetPrice,
    };
  };

  // Ads currently suspended due to quota excess
  const suspendedQuotaAds = useMemo(() => {
    return myAds.filter(
      (a) => a.status === 'SUSPENDED' && ((a as any).suspensionReason === 'FORFAIT_EXPIRE_QUOTA' || !(a as any).suspensionReason)
    );
  }, [myAds]);

  // Automatic suspension of excess active ads if quota is exceeded (the newest ads are suspended)
  const [isSuspendingExcess, setIsSuspendingExcess] = useState(false);
  useEffect(() => {
    if (isExempt) return;
    const activeAds = myAds.filter((a) => a.status === 'ACTIVE');
    if (activeAds.length > maxQuota && !isSuspendingExcess) {
      // Sort ascending: oldest ads stay active, newest excess ads are suspended
      const sorted = [...activeAds].sort((a, b) => {
        const tA = new Date(a.createdAt || a.publishedAt || 0).getTime();
        const tB = new Date(b.createdAt || b.publishedAt || 0).getTime();
        return tA - tB;
      });
      const excessAds = sorted.slice(maxQuota);
      setIsSuspendingExcess(true);
      (async () => {
        try {
          for (const excessAd of excessAds) {
            await updateDoc(doc(db, 'ads', excessAd.id), {
              status: 'SUSPENDED',
              suspensionReason: 'FORFAIT_EXPIRE_QUOTA',
              suspendedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error('Error suspending excess quota ads:', err);
        } finally {
          setIsSuspendingExcess(false);
        }
      })();
    }
  }, [myAds, maxQuota, isExempt, isSuspendingExcess]);

  const expiredCount = myAds.filter(
    (ad) => ad.status === 'EXPIRED' || new Date(ad.expiresAt).getTime() <= Date.now()
  ).length;

  const displayedAds = myAds
    .filter((ad) => {
      const isExp = ad.status === 'EXPIRED' || new Date(ad.expiresAt).getTime() <= Date.now();
      if (filterStatus === 'EXPIRED') return isExp;
      if (filterStatus === 'ACTIVE') return ad.status === 'ACTIVE' && !isExp;
      if (filterStatus === 'PENDING') return ad.status === 'PENDING_REVIEW';
      if (filterStatus === 'REJECTED') return ad.status === 'REJECTED';
      if (filterStatus === 'SUSPENDED') return ad.status === 'SUSPENDED';
      return true;
    })
    .sort((a, b) => {
      if (adsSortBy === 'DATE_DESC') {
        return new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime();
      }
      if (adsSortBy === 'DATE_ASC') {
        return new Date(a.publishedAt || a.createdAt || 0).getTime() - new Date(b.publishedAt || b.createdAt || 0).getTime();
      }
      if (adsSortBy === 'EXPIRY_ASC') {
        return new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime();
      }
      if (adsSortBy === 'VIEWS_DESC') {
        return (b.viewsCount || 0) - (a.viewsCount || 0);
      }
      if (adsSortBy === 'PRICE_DESC') {
        return (b.price || 0) - (a.price || 0);
      }
      if (adsSortBy === 'PRICE_ASC') {
        return (a.price || 0) - (b.price || 0);
      }
      return 0;
    });

  // Requirement 4: Boost purchase success (Single Boost or Booster Pack)
  const handleBoostPurchaseSuccess = async () => {
    if (!adToBoost || !onBoostAd) return;
    if (!isAllowedToTransact) {
      showAlert("Vérification d'identité obligatoire : Votre identité doit être vérifiée avant tout paiement ou activation de boost.", 'error', "Identité requise");
      setIsKycModalOpen(true);
      return;
    }
    setIsBoostingAd(true);
    try {
      if (boostOption === 'SINGLE' || !selectedPackForBoost) {
        await onBoostAd(adToBoost.id);
        showAlert(`Félicitations ! Votre annonce "${adToBoost.title}" est propulsée En Tête pour 7 jours.`, 'success', "Annonce Propulsée !");
      } else {
        // 1. Boost this ad immediately
        await onBoostAd(adToBoost.id);
        // 2. Credit the remaining (pack.boostsCount - 1) boosters to user's balance
        const remainingToCredit = selectedPackForBoost.boostsCount - 1;
        if (remainingToCredit > 0 && onUpdateUser) {
          const currentBoosts = currentUser.freeBoostsRemaining || 0;
          const newTotal = Math.min(20, currentBoosts + remainingToCredit);
          await onUpdateUser({
            freeBoostsRemaining: newTotal,
            activeBoosterPack: selectedPackForBoost.type,
          });
        }
        showAlert(
          `Félicitations ! Votre annonce "${adToBoost.title}" est propulsée En Tête pour 7 jours, et ${remainingToCredit} boosters supplémentaires ont été crédités sur votre compte (solde disponible) !`,
          'success',
          "Pack Boosters Activé !"
        );
      }
      setAdToBoost(null);
      setShowBoostPayment(false);
      setSelectedPackForBoost(null);
    } catch (e: any) {
      console.error('Boost purchase error:', e);
      showAlert("Erreur lors de l'activation du boost : " + (e?.message || 'Réessayez.'), 'error');
    } finally {
      setIsBoostingAd(false);
    }
  };

  // Requirement 3c: Save personal info (Name & Location)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateUser) return;
    if (!profileName.trim()) {
      showAlert('Veuillez renseigner votre nom complet.', 'error');
      return;
    }
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      await onUpdateUser({
        name: profileName.trim(),
        location: {
          province: profileProvince,
          city: profileCity,
          neighborhood: profileNeighborhood.trim(),
        },
      });
      setProfileSuccessMsg('Vos informations personnelles ont été mises à jour avec succès.');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      showAlert('Erreur lors de la sauvegarde : ' + (err?.message || 'Réessayez.'), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Requirement 3c: Send SMS OTP for password change
  const handleRequestPasswordOtp = async () => {
    setPwdError(null);
    setPwdSuccess(null);
    const phone = currentUser.contactPhone || currentUser.phoneNumber;
    if (!phone) {
      setPwdError('Aucun numéro de téléphone Gabon associé à ce compte.');
      return;
    }
    const e164 = formatGabonPhone(phone);
    setPwdLoading(true);
    try {
      const verifier = getOrCreatePwdRecaptcha();
      pwdConfirmationRef.current = await signInWithPhoneNumber(auth, e164, verifier);
      setPwdStep('OTP');
      setPwdResendTimer(45);
    } catch (err: any) {
      console.error('Password OTP error:', err);
      setPwdError("Impossible d'envoyer le code SMS OTP. Réessayez dans un instant.");
    } finally {
      setPwdLoading(false);
    }
  };

  // Requirement 3c: Verify OTP code
  const handleVerifyPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    if (!pwdConfirmationRef.current) {
      setPwdError('La session SMS a expiré. Veuillez redemander un code.');
      setPwdStep('IDLE');
      return;
    }
    setPwdLoading(true);
    try {
      await pwdConfirmationRef.current.confirm(pwdOtp);
      setPwdStep('NEW_PWD');
    } catch {
      setPwdError('Code SMS OTP incorrect ou expiré.');
    } finally {
      setPwdLoading(false);
    }
  };

  // Requirement 3c: Save new password (records lastPasswordChangeDate to enforce 24h cooldown)
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    if (newPassword.length < 6) {
      setPwdError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setPwdLoading(true);
    try {
      const nowIso = new Date().toISOString();
      await recordPasswordCooldown(currentUser.contactPhone || currentUser.phoneNumber || '', nowIso);
      if (onUpdateUser) {
        await onUpdateUser({
          password: newPassword.trim(),
          lastPasswordChangeDate: nowIso,
        });
      }
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, newPassword.trim());
        } catch {
          // ignore
        }
      }
      setPwdSuccess('Votre nouveau mot de passe a été enregistré avec succès !');
      setPwdStep('IDLE');
      setNewPassword('');
      setConfirmNewPassword('');
      setPwdOtp('');
      setTimeout(() => setPwdSuccess(null), 5000);
    } catch (err: any) {
      console.error('Save password error:', err);
      setPwdError('Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleConfirmBoost = async (ad: Ad) => {
    if (!onBoostAd) return;
    if (!isAllowedToTransact) {
      showAlert("Vérification d'identité obligatoire : Votre identité doit être vérifiée avant de pouvoir booster une annonce.", 'error', "Identité requise");
      setIsKycModalOpen(true);
      return;
    }
    setIsBoostingAd(true);
    try {
      await onBoostAd(ad.id);
      setAdToBoost(null);
      setShowBoostPayment(false);
    } catch (e) {
      console.error(e);
      showAlert('Erreur lors de la mise en tête de votre annonce. Réessayez.', 'error');
    } finally {
      setIsBoostingAd(false);
    }
  };

  const handleSelectSubscription = async (tier: (typeof SUBSCRIPTION_TIERS)[number]) => {
    if (isExempt) {
      if (!onUpdateUser) return;
      try {
        const boostsToAdd = tier.tier === 'BUSINESS' ? 6 : tier.tier === 'ELITE' ? 3 : 1;
        const currentBoosts = currentUser.freeBoostsRemaining || 0;
        const newBoosts = Math.min(20, currentBoosts + boostsToAdd);
        await onUpdateUser({
          subscriptionTier: tier.tier,
          subscriptionExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          subscriptionStartedAt: new Date().toISOString(),
          freeBoostsRemaining: newBoosts,
        });
        setUpgradedTierModal(tier.tier);
      } catch (err: any) {
        console.error('Error activating plan:', err);
        showAlert(`Erreur lors de l'activation du forfait ${tier.name} : ${err?.message || 'Vérifiez votre connexion et réessayez.'}`, 'error');
      }
      return;
    }

    const upgradeInfo = getTierUpgradeInfo(tier.tier);

    // If downgrade: show warning confirmation modal (free of charge - Point 5)
    if (upgradeInfo.type === 'DOWNGRADE') {
      setDowngradeConfirmationTier(tier);
      return;
    }

    // If upgrade or new subscription:
    setItemToPurchase({
      type: 'SUBSCRIPTION',
      title: upgradeInfo.type === 'UPGRADE_SURPLUS'
        ? `Surclassement vers ${tier.name} (Surplus 1ère semaine : ${formatFCFA(upgradeInfo.priceToPay)})`
        : `Abonnement ${tier.name} (${formatFCFA(upgradeInfo.priceToPay)}/mois)`,
      price: upgradeInfo.priceToPay,
      tier: tier.tier,
    });
  };

  const handleConfirmDowngrade = async (targetTier: (typeof SUBSCRIPTION_TIERS)[number]) => {
    if (!onUpdateUser) return;
    setIsDowngrading(true);
    try {
      await onUpdateUser({
        subscriptionTier: targetTier.tier,
      });
      setDowngradeConfirmationTier(null);
      showAlert(`Votre abonnement a été rétrogradé avec succès vers le forfait ${targetTier.name}. Aucun frais supplémentaire n'a été appliqué.`, 'info', "Abonnement modifié");
    } catch (err: any) {
      console.error('Error downgrading:', err);
      showAlert("Erreur lors de la rétrogradation : " + (err?.message || 'Réessayez.'), 'error');
    } finally {
      setIsDowngrading(false);
    }
  };

  const handleSelectBoosterPack = async (pack: (typeof BOOSTER_PACKS)[number]) => {
    if (isExempt) {
      if (!onUpdateUser) return;
      try {
        const currentBoosts = currentUser.freeBoostsRemaining || 0;
        const newBoosts = Math.min(20, currentBoosts + pack.boostsCount);
        await onUpdateUser({
          freeBoostsRemaining: newBoosts,
          activeBoosterPack: pack.type,
        });
        showAlert(`${pack.name} activé avec succès ! Votre nouveau solde est de ${newBoosts} boosters disponibles (max 20).`, 'success', "Pack Boosters Activé !");
      } catch (err: any) {
        console.error('Error adding booster pack for VIP:', err);
        showAlert(`Erreur lors de l'activation des boosters : ${err?.message || 'Vérifiez votre connexion et réessayez.'}`, 'error');
      }
      return;
    }

    setItemToPurchase({
      type: 'BOOSTER_PACK',
      title: `${pack.name} (${pack.boostsCount} Boosts "En Tête")`,
      price: pack.price,
      boostCount: pack.boostsCount,
      packType: pack.type,
    });
  };

  const handlePurchaseSuccess = async (paymentInfo: { operator: PaymentOperator; transactionRef: string }) => {
    if (!itemToPurchase || !onUpdateUser) return;
    try {
      if (itemToPurchase.type === 'SUBSCRIPTION' && itemToPurchase.tier) {
        const boostsToAdd = itemToPurchase.tier === 'BUSINESS' ? 6 : itemToPurchase.tier === 'ELITE' ? 3 : 1;
        const currentBoosts = currentUser.freeBoostsRemaining || 0;
        const newBoosts = Math.min(20, currentBoosts + boostsToAdd);
        await onUpdateUser({
          subscriptionTier: itemToPurchase.tier,
          subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          subscriptionStartedAt: new Date().toISOString(),
          freeBoostsRemaining: newBoosts,
        });
        setItemToPurchase(null);
        setUpgradedTierModal(itemToPurchase.tier);
      } else if (itemToPurchase.type === 'BOOSTER_PACK' && itemToPurchase.boostCount) {
        const currentBoosts = currentUser.freeBoostsRemaining || 0;
        const newBoosts = Math.min(20, currentBoosts + itemToPurchase.boostCount);
        await onUpdateUser({
          freeBoostsRemaining: newBoosts,
          activeBoosterPack: itemToPurchase.packType,
        });
        setItemToPurchase(null);
        showAlert(`${itemToPurchase.boostCount} Boosters activés avec succès ! Votre nouveau solde est de ${newBoosts} boosters disponibles (max 20).`, 'success', "Pack Boosters Activé !");
      }
    } catch (e: any) {
      console.error('Purchase update error:', e);
      showAlert("Erreur lors de l'activation de votre achat : " + (e?.message || 'Veuillez réessayer.'), 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Privileged Cockpit Banner */}
      {isUserAdmin(currentUser) && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-400/60 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-400/30 shrink-0">
              <ShieldCheck className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight">Cockpit d'Administration & Modération</span>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {isUserSuperAdmin(currentUser) ? '👑 Super Admin' : '👑 Modérateur Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Votre profil possède les accès d'arbitrage éditorial, vérification des pièces d'identité KYC, validation des prolongations et consultation de l'Observatoire du Marché.
              </p>
            </div>
          </div>
          <button
            onClick={onSwitchToAdmin}
            className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:from-amber-500 active:to-amber-600 text-slate-950 font-black text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 transform hover:scale-102"
          >
            <ExternalLink className="w-4 h-4 text-slate-950" />
            <span>Ouvrir le Panneau Admin</span>
          </button>
        </div>
      )}

      {/* User Identity & Profile Banner (Harmonious & Responsive Layout - Point 5) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left Column: Full room for Profile Details & Badges */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-2xl shadow-lg border border-emerald-400/30 shrink-0">
              {(currentUser.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                  {currentUser.name || 'Annonceur'}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Numéro Gabon Vérifié
                </span>
                {currentUser.operator && (
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded shrink-0 ${
                      currentUser.operator === 'AIRTEL'
                        ? 'bg-red-900/60 text-red-200 border border-red-500/30'
                        : 'bg-blue-900/60 text-blue-200 border border-blue-500/30'
                    }`}
                  >
                    {currentUser.operator === 'AIRTEL' ? 'Airtel Gabon' : 'Moov Africa Gabon'}
                  </span>
                )}

                {/* Subscription status badge */}
                {currentTier !== 'STANDARD' && (
                  <span
                    className={`font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-2xs ${
                      isSubscriptionExpired
                        ? 'bg-red-900/80 text-red-200 border border-red-500/40'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    <Crown className="w-3 h-3 fill-current" />
                    Plan {currentTier} {isSubscriptionExpired ? '(Expiré)' : ''}
                  </span>
                )}
              </div>

              {/* Informative metadata row */}
              <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-white tracking-wide bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                  {currentUser.contactPhone || currentUser.phoneNumber || 'Numéro vérifié'}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Charte CGU acceptée</span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-300 font-bold">
                  Annonces actives : {myAds.filter((a) => a.status === 'ACTIVE').length} / {maxQuota}
                </span>
                {currentUser.subscriptionExpiresAt && currentTier !== 'STANDARD' && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className={isSubscriptionExpired ? 'text-rose-300 font-semibold' : 'text-amber-300'}>
                      {isSubscriptionExpired
                        ? `Forfait expiré le ${new Date(currentUser.subscriptionExpiresAt).toLocaleDateString('fr-FR')}`
                        : `Valide jusqu'au ${new Date(currentUser.subscriptionExpiresAt).toLocaleDateString('fr-FR')}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Balanced Booster Pill & Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            {/* Green Box: Sleek, well-proportioned Boosters Disponibles widget */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl px-4 py-2.5 border border-emerald-400/50 shadow-md flex items-center justify-between sm:justify-start gap-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs text-amber-300 border border-white/30 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 block">
                    Boosters Disponibles
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white leading-none">
                      {currentUser.freeBoostsRemaining || 0}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-200">
                      / 20 max
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowBoosterPacksModal(true)}
                className="text-[10px] font-black bg-white text-emerald-950 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 shrink-0 ml-1.5"
                title="Acheter ou recharger vos boosters"
              >
                <span>Recharger</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSafeOpenPublish}
                className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Déposer une annonce</span>
              </button>

              <button
                onClick={onLogout}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border border-red-500 cursor-pointer"
                title="Se déconnecter de votre compte"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Advertiser Space Tabs (Exclusively visible inside advertiser dashboard) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar flex-nowrap py-1">
        <button
          onClick={() => setDashboardTab('ADS')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            dashboardTab === 'ADS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Mes Annonces ({myAds.length})</span>
        </button>

        <button
          onClick={() => setDashboardTab('FAVORITES')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            dashboardTab === 'FAVORITES'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-rose-50 border border-slate-200'
          }`}
          id="tab-user-favorites"
        >
          <Heart className={`w-4 h-4 ${dashboardTab === 'FAVORITES' ? 'fill-current text-white' : 'text-rose-500'}`} />
          <span>Mes Favoris ({favoriteAds.length})</span>
        </button>

        <button
          onClick={() => setDashboardTab('SUBSCRIPTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            dashboardTab === 'SUBSCRIPTIONS'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white text-slate-700 hover:bg-amber-50 border border-slate-200'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Abonnements Pro, Élite & Business</span>
          {currentTier !== 'STANDARD' && (
            <span className="bg-slate-950 text-white text-[9px] px-1.5 py-0.5 rounded-sm uppercase">
              Actif: {currentTier}
            </span>
          )}
        </button>

        <button
          onClick={() => setDashboardTab('PROFILE')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            dashboardTab === 'PROFILE'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <User className="w-4 h-4 text-emerald-500" />
          <span>Mes Informations & Sécurité</span>
        </button>
      </div>

      {/* TAB 1: ADS MANAGEMENT */}
      {dashboardTab === 'ADS' && (
        <div className="space-y-6">
          {/* KYC / VIP Status Banner */}
          {isExempt ? (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border border-amber-400/50 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">Statut Privilégié / Partenaire VIP</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                      0 FCFA • Exemption Totale Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Votre compte bénéficie d'une dispense spéciale accordée par l'administration BizBooster (0 FCFA facturé, max 10 annonces simultanées).
                  </p>
                </div>
              </div>
              <button
                onClick={handleSafeOpenPublish}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Déposer sans frais</span>
              </button>
            </div>
          ) : isKycVerified ? (
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">Identité Certifiée & Conforme</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {currentUser.idDocumentType === 'CNI' ? 'CNI Gabonaise' : currentUser.idDocumentType === 'PASSPORT' ? 'Passeport' : 'Titre de Séjour'} Validé
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Votre document d'identité a été validé par la modération. Vous disposez du badge officiel de confiance « Vérifié » sur votre profil et vos annonces.
                  </p>
                </div>
              </div>
              {currentUser.idDocumentUrl && (
                <button
                  onClick={() => setPreviewDocModal(currentUser.idDocumentUrl || null)}
                  className="text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100/70 border border-emerald-200 px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <FileText className="w-4 h-4" />
                  <span>Voir ma pièce d'identité</span>
                </button>
              )}
            </div>
          ) : kycStatus === 'PENDING' ? (
            <div className="bg-amber-50/80 border border-amber-300 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">Pièce d'identité en cours d'examen</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                      Modération en cours
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Votre pièce d'identité ({currentUser.idDocumentType || 'CNI'}) a été transmise avec succès. Notre équipe contrôle sa conformité. La vérification étant facultative, vous pouvez d'ores et déjà publier vos annonces et effectuer vos transactions. Dès validation par notre équipe, le badge de confiance « Vérifié » sera automatiquement attribué à votre profil et à toutes vos annonces.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-blue-50/50 border border-emerald-300/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">Badge « Vérifié » (Facultatif - Signal de Confiance)</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Confiance Acheteurs
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Conformément aux réalités locales, la vérification d'identité est facultative : elle ne bloque pas vos publications ni vos transactions. Transmettez votre document pour obtenir le badge Vérifié et rassurer vos acquéreurs.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsKycModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Demander le Badge Vérifié</span>
              </button>
            </div>
          )}

          {/* KPI Cards for the User */}
          <div className={`grid gap-3 sm:gap-4 ${suspendedQuotaAds.length > 0 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
            <div
              onClick={() => setFilterStatus('ALL')}
              className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
                filterStatus === 'ALL' ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-[11px] font-bold text-slate-500 block mb-1">Total Déposées</span>
              <div className="text-2xl font-black text-slate-900">{myAds.length}</div>
              <span className="text-[10px] text-slate-400">Toutes rubriques</span>
            </div>

            <div
              onClick={() => setFilterStatus('PENDING')}
              className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
                filterStatus === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700">En cours d'examen</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
              <span className="text-[10px] text-amber-700">Modération</span>
            </div>

            <div
              onClick={() => setFilterStatus('ACTIVE')}
              className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
                filterStatus === 'ACTIVE' ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700">En Ligne Publique</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">{activeCount}</div>
              <span className="text-[10px] text-emerald-700">Visibles par le public</span>
            </div>

            <div
              onClick={() => setFilterStatus('EXPIRED')}
              className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
                filterStatus === 'EXPIRED' ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Expirées</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-700">{expiredCount}</div>
              <span className="text-[10px] text-amber-700 font-bold">À prolonger</span>
            </div>

            {suspendedQuotaAds.length > 0 && (
              <div
                onClick={() => setFilterStatus('SUSPENDED')}
                className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
                  filterStatus === 'SUSPENDED'
                    ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800">En pause (Forfait)</span>
                  <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-700">{suspendedQuotaAds.length}</div>
                <span className="text-[10px] text-amber-600">Plafond Standard dépassé</span>
              </div>
            )}

            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-700">Vues Cumulées</span>
                <Eye className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-700">{totalViews}</div>
              <span className="text-[10px] text-slate-400">Total consultations</span>
            </div>
          </div>

          {/* Requirement 4: Alert Banner for Suspended Ads due to expired plan */}
          {suspendedQuotaAds.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">
                      {suspendedQuotaAds.length} annonce{suspendedQuotaAds.length > 1 ? 's' : ''} en pause suite à l'expiration de votre forfait
                    </span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      Plafond Standard ({maxQuota} annonces)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                    Vos {maxQuota} annonces les plus anciennes restent en ligne. Vos {suspendedQuotaAds.length} annonces les plus récentes ont été automatiquement suspendues et restent conservées intactes. Renouvelez votre forfait pour les réactiver immédiatement.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDashboardTab('SUBSCRIPTIONS')}
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Crown className="w-4 h-4 fill-amber-400" />
                <span>Renouveler mon forfait</span>
              </button>
            </div>
          )}

          {/* Sorting and Filters Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filtré par :</span>
              <span className="text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                {filterStatus === 'ALL' && 'Toutes les annonces'}
                {filterStatus === 'ACTIVE' && 'En ligne publiques'}
                {filterStatus === 'PENDING' && 'En attente de modération'}
                {filterStatus === 'EXPIRED' && 'Expirées'}
                {filterStatus === 'SUSPENDED' && 'En pause (Forfait)'}
                {filterStatus === 'REJECTED' && 'Rejetées'}
              </span>
              <span className="text-xs text-slate-400">({displayedAds.length})</span>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <label htmlFor="user-ads-sort" className="text-xs font-bold text-slate-600">Trier par :</label>
              <select
                id="user-ads-sort"
                value={adsSortBy}
                onChange={(e) => setAdsSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-hidden cursor-pointer"
              >
                <option value="DATE_DESC">Plus récentes d'abord</option>
                <option value="DATE_ASC">Plus anciennes d'abord</option>
                <option value="EXPIRY_ASC">Date d'expiration proche</option>
                <option value="VIEWS_DESC">Les plus consultées</option>
                <option value="PRICE_DESC">Prix le plus élevé</option>
                <option value="PRICE_ASC">Prix le plus bas</option>
              </select>
            </div>
          </div>

          {/* Ads List */}
          {displayedAds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedAds.map((ad) => {
                const { isExpired, label: remainingLabel } = formatRemainingTime(ad.expiresAt);
                const isPending = ad.status === 'PENDING_REVIEW';
                const isActive = ad.status === 'ACTIVE' && !isExpired;
                const isRejected = ad.status === 'REJECTED';
                const isBoosted = isAdBoostFeatured(ad);

                return (
                  <div
                    key={ad.id}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all ${
                      isBoosted
                        ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                        : isRejected
                        ? 'border-red-300 bg-red-50/20'
                        : isPending
                        ? 'border-amber-300 bg-amber-50/20'
                        : isExpired
                        ? 'border-slate-300 opacity-70 bg-slate-50'
                        : 'border-slate-200 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Boosted badge */}
                      {isBoosted && (
                        <div className="mb-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase px-2.5 py-1 rounded-lg flex items-center justify-between shadow-xs">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 fill-slate-950" />
                            Annonce en tête de liste
                          </span>
                          <span className="text-[9px] font-bold">Actif ✓</span>
                        </div>
                      )}

                      {/* Header badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {ad.mainCategory === 'EMPLOI' ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 border border-purple-300">
                              À EMPLOYER
                            </span>
                          ) : ad.transactionType ? (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                                ad.transactionType === 'VENTE'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {ad.transactionType === 'VENTE' ? 'À VENDRE' : 'À LOUER'}
                            </span>
                          ) : null}
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm">
                            {ad.mainCategory}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            ad.status === 'SUSPENDED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isPending
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isRejected
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ad.status === 'SUSPENDED'
                            ? '⏸️ En pause (Forfait)'
                            : isPending
                            ? 'En attente'
                            : isActive
                            ? 'En ligne'
                            : isRejected
                            ? 'Rejetée'
                            : 'Expirée'}
                        </span>
                      </div>

                      <h3
                        onClick={() => onSelectAdDetail(ad)}
                        className="font-black text-slate-900 text-base hover:text-emerald-700 cursor-pointer line-clamp-1 mb-1"
                      >
                        {ad.title}
                      </h3>

                      <div className="text-emerald-700 font-black text-sm mb-3">
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {getPriceOrSalaryLabel(ad)} :
                        </span>
                        {formatPriceDisplay(ad.price, ad.priceMax)}
                        {ad.priceUnit && (
                          <span className="text-xs text-slate-500 font-medium">/{formatPriceUnit(ad.priceUnit, isJobAd(ad))}</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-4">
                        {ad.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{ad.location.city}, quartier {ad.location.neighborhood} ({ad.location.province})</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                          <span className="font-bold text-blue-700 flex items-center gap-1">
                            <Eye className="w-3 h-3 text-blue-600" />
                            {ad.viewsCount || 0} vue{(ad.viewsCount || 0) > 1 ? 's' : ''}
                          </span>
                          {isActive && (
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              {remainingLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSelectAdDetail(ad)}
                          className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Aperçu</span>
                        </button>

                        <button
                          onClick={() => {
                            if (isExpired) {
                              showAlert("Cette annonce est expirée. Vous devez d'abord la prolonger pour pouvoir la modifier.", 'info', "Prolongation requise");
                              onOpenExtendModal(ad);
                              return;
                            }
                            onEditAd(ad);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1 border border-emerald-200 cursor-pointer"
                          title={isExpired ? "Prolonger l'annonce avant de la modifier" : "Modifier cette annonce"}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Modifier</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ad.status === 'SUSPENDED' && (
                          <button
                            onClick={() => setDashboardTab('SUBSCRIPTIONS')}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Renouveler votre forfait pour réactiver cette annonce"
                          >
                            <Crown className="w-3 h-3 fill-slate-950" />
                            <span>Réactiver (Forfait)</span>
                          </button>
                        )}

                        {/* Requirement 6: Boost to top button */}
                        {isActive && (
                          <button
                            onClick={() => handleOpenBoostModal(ad)}
                            className={`px-2.5 py-1.5 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                              isBoosted
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black'
                            }`}
                            title="Booster cette annonce en tête de liste"
                          >
                            <Sparkles className="w-3 h-3 fill-slate-950" />
                            <span>{isBoosted ? 'En tête' : 'Booster'}</span>
                          </button>
                        )}

                        {(isActive || isExpired) && (
                          <button
                            onClick={() => onOpenExtendModal(ad)}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3 text-amber-400" />
                            <span>Prolonger</span>
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteAd(ad.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer mon annonce"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <PlusCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900">
                  {filterStatus === 'ALL' ? 'Vous n\'avez pas encore déposé d\'annonce' : 'Aucune annonce dans ce statut'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Publiez votre bien immobilier (vente ou location), véhicule, objet ou offre d'emploi au Gabon en quelques minutes.
                </p>
              </div>

              <button
                onClick={handleSafeOpenPublish}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Déposer ma première annonce</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: FAVORITES */}
      {dashboardTab === 'FAVORITES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 fill-rose-500" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Mes Annonces Favorites
                </h3>
                <p className="text-xs text-slate-500">
                  Retrouvez et contactez facilement les annonceurs de vos biens sauvegardés.
                </p>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
              {favoriteAds.length} annonce{favoriteAds.length > 1 ? 's' : ''} sauvegardée{favoriteAds.length > 1 ? 's' : ''}
            </div>
          </div>

          {favoriteAds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {favoriteAds.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  onSelectAd={onSelectAdDetail}
                  isFavorite={true}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">Aucun favori pour le moment</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vous n'avez pas encore d'annonces enregistrées dans vos favoris. Parcourez les annonces du catalogue et cliquez sur le cœur ❤️ d'une vignette pour l'ajouter à vos favoris instantanément !
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION TIERS & AD PACKS (Requirement 6 & Requirement 4) */}
      {dashboardTab === 'SUBSCRIPTIONS' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Current Tier status card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Votre Formule Actuelle
                </span>
              </div>
              <h3 className="text-2xl font-black text-white">
                Plan {currentTier === 'STANDARD' ? 'Standard Gratuit' : currentTier}
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                {currentTier === 'STANDARD'
                  ? 'Vous bénéficiez de 3 annonces simultanées incluses gratuitement. Au-delà de 3 annonces actives, vous pouvez souscrire à un forfait Pro, Élite ou Business pour augmenter votre quota simultané.'
                  : `Votre abonnement ${currentTier} est actif jusqu'au ${currentUser.subscriptionExpiresAt ? new Date(currentUser.subscriptionExpiresAt).toLocaleDateString('fr-FR') : 'prochain renouvellement'}.`}
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Plafond simultané</span>
                <span className="text-xl font-black text-emerald-400">{maxQuota} annonces</span>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Boosts offerts</span>
                <span className="text-xl font-black text-amber-400">{currentUser.freeBoostsRemaining || 0}</span>
              </div>
            </div>
          </div>

          {/* Section: Subscription Tiers (Pro, Elite, Business) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Modèles d'Abonnement Professionnels
                </h3>
                <p className="text-xs text-slate-500">
                  Augmentez votre quota d'annonces simultanées (jusqu'à 20 pour Business) et bénéficiez de réductions sur les prolongations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {SUBSCRIPTION_TIERS.map((tier) => {
                const isCurrent = effectiveTier === tier.tier;
                const upgradeInfo = getTierUpgradeInfo(tier.tier);

                return (
                  <div
                    key={tier.tier}
                    className={`bg-white rounded-3xl border-2 p-6 flex flex-col justify-between transition-all relative ${
                      isCurrent
                        ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-lg'
                        : tier.popular
                        ? 'border-purple-300 shadow-md ring-1 ring-purple-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tier.popular && !isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                        Recommandé
                      </span>
                    )}

                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                        Forfait Actuel ✓
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${tier.badgeColor}`}>
                          {tier.name}
                        </span>
                        <Crown className={`w-4 h-4 ${tier.tier === 'BUSINESS' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>

                      <div className="flex items-baseline gap-1 my-3">
                        <span className="text-2xl font-black text-slate-900">{formatFCFA(tier.price)}</span>
                        <span className="text-xs font-semibold text-slate-500">{tier.period}</span>
                      </div>

                      <p className="text-xs text-slate-600 mb-4">{tier.description}</p>

                      <ul className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                        {tier.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 leading-relaxed">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => handleSelectSubscription(tier)}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isExempt
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                        }`}
                      >
                        <span>
                          {isCurrent
                            ? 'Forfait Actif'
                            : isExempt
                            ? `Activer ${tier.name} (Gratuit VIP)`
                            : `Choisir ${tier.name}`}
                        </span>
                        {!isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Booster Packs (Requirement 4) */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-black text-slate-900">
                  Packs de Boosters "En Tête de Liste"
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isExempt
                  ? "Propulsez vos annonces en première position pendant 7 jours. Activez un pack de 5 ou 10 boosters inclus avec votre statut partenaire privilégié."
                  : "Propulsez vos annonces en première position pendant 7 jours. Achetez un pack de 5 ou 10 boosters à tarif préférentiel (jusqu'à 20 boosters par utilisateur)."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BOOSTER_PACKS.map((pack) => {
                const isBoosterFull = (currentUser.freeBoostsRemaining || 0) >= 20;

                return (
                  <div
                    key={pack.type}
                    className="bg-white rounded-3xl border-2 border-slate-200 hover:border-amber-400 p-5 flex flex-col justify-between transition-all shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span>{pack.name}</span>
                        </span>
                        <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-sm">
                          +{pack.boostsCount} Boosts
                        </span>
                      </div>
                      <div className="text-xl font-black text-emerald-700 mt-2">
                        {isExempt ? (
                          <span className="text-amber-600 font-black">Gratuit (Partenaire VIP)</span>
                        ) : (
                          formatFCFA(pack.price)
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{pack.description}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isBoosterFull}
                      onClick={() => handleSelectBoosterPack(pack)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all mt-4 flex items-center justify-center gap-1.5 cursor-pointer ${
                        isBoosterFull
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : isExempt
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <span>
                        {isBoosterFull
                          ? 'Plafond atteint (20 max)'
                          : isExempt
                          ? `Activer +${pack.boostsCount} Boosts (0 FCFA)`
                          : `Acheter le ${pack.name}`}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERSONAL INFORMATION & SECURITY (Requirement 3c) */}
      {dashboardTab === 'PROFILE' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-lg text-slate-900">
                  Mes Informations Personnelles & Sécurité
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gérez votre nom d'annonceur, votre localisation géographique au Gabon et votre mot de passe de sécurité.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Personal Info & Location */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Coordonnées & Localisation
                </h4>
              </div>

              {profileSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nom complet ou Nom de l'Agence
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Ex: Paul OBAME ou Immobilier Gabon"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Numéro de Téléphone Vérifié (+241)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={currentUser.contactPhone || currentUser.phoneNumber || ''}
                      readOnly
                      disabled
                      className="w-full text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-500 cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Vérifié
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pour modifier votre numéro, contactez l'administration.
                  </span>
                </div>

                {/* Province & City Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Province
                    </label>
                    <select
                      value={profileProvince}
                      onChange={(e) => {
                        const prov = e.target.value;
                        setProfileProvince(prov);
                        const match = GABON_PROVINCES.find((p) => p.name === prov)?.cities || [];
                        if (match.length > 0) {
                          setProfileCity(match[0].name);
                        }
                      }}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      {GABON_PROVINCES.map((p) => (
                        <option key={p.code} value={p.name}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Ville
                    </label>
                    <select
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      {profileCities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quartier de Résidence / Localité
                  </label>
                  <input
                    type="text"
                    value={profileNeighborhood}
                    onChange={(e) => setProfileNeighborhood(e.target.value)}
                    placeholder="Ex: Akébé, Nzeng-Ayong, Glass, Alénakiri..."
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Enregistrer mes coordonnées</span>
                </button>
              </form>
            </div>

            {/* Card 2: Security & Password Management (With 24h limit) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Mot de passe & Sécurité du Compte
                </h4>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Statut du mot de passe :</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                    Actif
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Dernier changement :</span>
                  <span className="font-bold text-slate-800">
                    {currentUser.lastPasswordChangeDate
                      ? new Date(currentUser.lastPasswordChangeDate).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Non enregistré'}
                  </span>
                </div>
                <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200/60 leading-relaxed">
                  🛡️ <em>Règle de sécurité Gabon :</em> Pour prévenir les abus et protéger les envois de codes SMS, la modification du mot de passe requiert une confirmation par SMS OTP et est limitée à <strong>une seule fois par période de 24 heures</strong>.
                </div>
              </div>

              {pwdSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              {pwdError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              {/* Password Cooldown Lock Check */}
              {!passwordCooldown.canChange ? (
                <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-xs text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-black">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Délai de sécurité actif (1 modification / 24h)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Vous avez déjà modifié votre mot de passe récemment. Pour protéger votre compte contre les tentatives répétées, vous pourrez à nouveau le changer dans <strong>{passwordCooldown.remainingHours} heure(s)</strong>.
                  </p>
                </div>
              ) : pwdStep === 'IDLE' ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cliquez ci-dessous pour lancer la procédure de changement de mot de passe. Un code de sécurité SMS sera envoyé à votre numéro <strong>{currentUser.contactPhone || currentUser.phoneNumber}</strong>.
                  </p>
                  <button
                    type="button"
                    disabled={pwdLoading}
                    onClick={handleRequestPasswordOtp}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {pwdLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Changer mon mot de passe (Vérification SMS OTP)</span>
                  </button>
                </div>
              ) : pwdStep === 'OTP' ? (
                <form onSubmit={handleVerifyPasswordOtp} className="space-y-3 pt-2">
                  <div className="text-xs text-slate-700 font-bold">
                    Entrez le code SMS à 6 chiffres envoyé au {currentUser.contactPhone || currentUser.phoneNumber} :
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={pwdOtp}
                    onChange={(e) => setPwdOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ex: 582104"
                    className="w-full tracking-widest text-center text-xl font-black py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                    autoFocus
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() => setPwdStep('IDLE')}
                      className="text-slate-600 underline"
                    >
                      Annuler
                    </button>
                    {pwdResendTimer > 0 ? (
                      <span className="text-slate-400">Renvoyer dans {pwdResendTimer}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestPasswordOtp}
                        className="text-emerald-700 underline font-bold"
                      >
                        Renvoyer le code SMS
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={pwdLoading || pwdOtp.length < 6}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {pwdLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Vérifier le code SMS</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSaveNewPassword} className="space-y-3 pt-2">
                  <div className="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Numéro confirmé par SMS. Définissez votre nouveau mot de passe.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Nouveau mot de passe (min. 6 caractères)
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        className="w-full pl-3 pr-10 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        required
                        minLength={6}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                      >
                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Confirmer le nouveau mot de passe
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Répétez le nouveau mot de passe"
                      className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPwdStep('IDLE')}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {pwdLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Enregistrer</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Boost Modal (Requirement 4: Single Boost or Booster Pack Choice) */}
      {adToBoost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 border border-slate-200 space-y-4 my-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  ⭐
                </div>
                <h4 className="font-black text-sm text-slate-900 uppercase">
                  Mettre en Tête de Liste (7 jours)
                </h4>
              </div>
              <button
                onClick={() => {
                  setAdToBoost(null);
                  setShowBoostPayment(false);
                  setSelectedPackForBoost(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-900 line-clamp-1">{adToBoost.title}</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Cette annonce sera épinglée tout en haut des résultats de recherche et de sa catégorie pendant 7 jours.
              </span>
            </div>

            {/* Condition: if user has free boosts or VIP */}
            {(currentUser.freeBoostsRemaining || 0) > 0 || isExempt ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {isExempt
                      ? 'Inclus gratuitement pour votre compte partenaire VIP (0 FCFA)'
                      : `Vous disposez de ${currentUser.freeBoostsRemaining} booster(s) disponible(s). 1 booster sera déduit.`}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isBoostingAd}
                  onClick={() => handleConfirmBoost(adToBoost)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Activer la mise en tête (0 FCFA)</span>
                </button>
              </div>
            ) : showBoostPayment ? (
              <div className="pt-2">
                <MobilePaymentSimulator
                  amount={boostOption === 'SINGLE' || !selectedPackForBoost ? 5000 : selectedPackForBoost.price}
                  itemDescription={
                    boostOption === 'SINGLE' || !selectedPackForBoost
                      ? `Mise en tête de liste 7 jours - ${adToBoost.title}`
                      : `${selectedPackForBoost.name} (${selectedPackForBoost.boostsCount} Boosts) - ${adToBoost.title}`
                  }
                  onSuccess={handleBoostPurchaseSuccess}
                  onCancel={() => {
                    setShowBoostPayment(false);
                    setSelectedPackForBoost(null);
                  }}
                  initialPhone=""
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode Selector: 1 Boost vs Booster Pack (Requirement 4) */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBoostOption('SINGLE')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                      boostOption === 'SINGLE'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    1 Boost (Cette annonce)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoostOption('PACK')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                      boostOption === 'PACK'
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ⚡ Packs de Boosters (Éco)
                  </button>
                </div>

                {boostOption === 'SINGLE' ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl">
                      <span className="text-xs">Tarif à l'unité (7 jours) :</span>
                      <span className="text-lg font-black text-amber-400">5 000 FCFA</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowBoostPayment(true)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-300" />
                      <span>Payer 5 000 FCFA via Airtel ou Moov</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-500">
                      1 boost sera directement appliqué à cette annonce, et les autres boosters seront conservés sur votre solde pour vos futures annonces.
                    </p>
                    {BOOSTER_PACKS.map((pack) => (
                      <div
                        key={pack.type}
                        className="bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-slate-900">{pack.name}</span>
                            <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-amber-200">
                              {pack.boostsCount} boosts
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                            {formatFCFA(pack.price)} (soit {formatFCFA(Math.round(pack.price / pack.boostsCount))}/boost)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPackForBoost(pack);
                            setShowBoostPayment(true);
                          }}
                          className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          Acheter
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booster Packs Dedicated Modal (Point 2) */}
      {showBoosterPacksModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-7 border border-slate-200 space-y-5 my-auto">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-black shrink-0 border border-amber-500/30 shadow-inner">
                  <Zap className="w-6 h-6 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                    Recharger vos Boosters
                  </h3>
                  <p className="text-xs text-slate-500">
                    Propulsez vos annonces en première position pendant 7 jours
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBoosterPacksModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Bar */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-800 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <div>
                  <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                    Votre solde actuel
                  </span>
                  <span className="text-lg font-black text-white">
                    {currentUser.freeBoostsRemaining || 0} booster{(currentUser.freeBoostsRemaining || 0) > 1 ? 's' : ''} disponible{(currentUser.freeBoostsRemaining || 0) > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-200 bg-white/10 px-2.5 py-1 rounded-lg">
                Plafond : 20 max
              </span>
            </div>

            {/* Explanatory text */}
            <p className="text-xs text-slate-600 leading-relaxed">
              Choisissez un pack de rechargement. Les boosters acquis sont conservés sur votre compte et peuvent être activés à tout moment sur vos annonces depuis votre espace annonceur.
            </p>

            {/* Pack Cards */}
            <div className="space-y-3.5">
              {BOOSTER_PACKS.map((pack) => {
                const isBoosterFull = (currentUser.freeBoostsRemaining || 0) >= 20;
                return (
                  <div
                    key={pack.type}
                    className="bg-slate-50 hover:bg-amber-50/60 border-2 border-slate-200 hover:border-amber-400 rounded-2xl p-4 sm:p-5 transition-all shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{pack.name}</span>
                        <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-amber-300">
                          +{pack.boostsCount} Boosts
                        </span>
                      </div>
                      <span className="text-base font-black text-emerald-700">
                        {isExempt ? (
                          <span className="text-amber-600 font-bold text-xs">Gratuit (Partenaire VIP)</span>
                        ) : (
                          formatFCFA(pack.price)
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {pack.description}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-bold text-slate-500">
                        Soit {formatFCFA(Math.round(pack.price / pack.boostsCount))} par boost de 7 jours
                      </span>
                      <button
                        type="button"
                        disabled={isBoosterFull}
                        onClick={() => {
                          setShowBoosterPacksModal(false);
                          handleSelectBoosterPack(pack);
                        }}
                        className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          isBoosterFull
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : isExempt
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {isBoosterFull
                            ? 'Plafond atteint (20 max)'
                            : isExempt
                            ? 'Activer gratuitement'
                            : 'Recharger ce pack'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBoosterPacksModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription / Pack Purchase Modal */}
      {itemToPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 border border-slate-200 space-y-4 my-auto">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-black text-sm text-slate-900">{itemToPurchase.title}</h4>
                <p className="text-[11px] text-slate-500">Paiement sécurisé Mobile Money Gabon</p>
              </div>
              <button onClick={() => setItemToPurchase(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <MobilePaymentSimulator
              amount={itemToPurchase.price}
              itemDescription={itemToPurchase.title}
              onSuccess={handlePurchaseSuccess}
              onCancel={() => setItemToPurchase(null)}
              initialPhone=""
            />
          </div>
        </div>
      )}

      {/* Identity Verification Upload Modal */}
      <KycUploadModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Document Lightbox Preview Modal */}
      {previewDocModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-5 border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="font-black text-sm text-slate-900">Pièce d'identité enregistrée</h4>
                <p className="text-[11px] text-slate-500">Document transmis pour vérification anti-fraude</p>
              </div>
              <button
                onClick={() => setPreviewDocModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950/5 flex items-center justify-center p-2">
              <img src={previewDocModal} alt="Pièce d'identité" className="max-w-full max-h-[65vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
      {/* Downgrade Warning Confirmation Modal (Point 5) */}
      {downgradeConfirmationTier && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Mise en garde : Rétrograder vers le forfait {downgradeConfirmationTier.name}
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Vous bénéficiez actuellement du forfait supérieur <strong>{effectiveTier}</strong> ({TIER_QUOTAS[effectiveTier]} annonces max).
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <span>⚠️ Conséquences de la rétrogradation :</span>
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-900">
                <li>Votre quota simultané passera de <strong>{TIER_QUOTAS[effectiveTier]}</strong> à <strong>{TIER_QUOTAS[downgradeConfirmationTier.tier]} annonces</strong>.</li>
                <li>Les éventuelles annonces actives dépassant {TIER_QUOTAS[downgradeConfirmationTier.tier]} seront automatiquement suspendues.</li>
                <li><strong>Aucun frais supplémentaire</strong> ne vous sera facturé pour ce changement.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDowngrading}
                onClick={() => setDowngradeConfirmationTier(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDowngrading}
                onClick={() => handleConfirmDowngrade(downgradeConfirmationTier)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isDowngrading ? 'Mise à jour...' : 'Confirmer la rétrogradation (Gratuit)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Upgrade Celebration Modal */}
      <SubscriptionUpgradeModal
        isOpen={Boolean(upgradedTierModal)}
        tier={upgradedTierModal || 'PRO'}
        onClose={() => setUpgradedTierModal(null)}
        onGoToPublish={() => {
          setUpgradedTierModal(null);
          handleSafeOpenPublish();
        }}
      />

      {/* App Alert / Confirmation Modal (Point 1) */}
      <AppAlertModal
        config={alertModalConfig}
        onClose={() => setAlertModalConfig(null)}
      />
    </div>
  );
};
