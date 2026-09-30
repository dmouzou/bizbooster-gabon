import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Ad, UserProfile, SubscriptionTier, BoosterPackType, AdPackType, PaymentOperator } from '../types';
import { formatFCFA, formatRemainingTime, isAdOwner } from '../utils/formatters';
import { isAdBoostFeatured } from '../utils/personalization';
import { KycUploadModal } from './KycUploadModal';
import { MobilePaymentSimulator } from './MobilePaymentSimulator';

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
}

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
      'Support VIP dédié 7j/7',
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
}) => {
  const [dashboardTab, setDashboardTab] = useState<'ADS' | 'SUBSCRIPTIONS'>('ADS');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'REJECTED'>('ALL');
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<string | null>(null);

  // Boost modal state
  const [adToBoost, setAdToBoost] = useState<Ad | null>(null);
  const [isBoostingAd, setIsBoostingAd] = useState(false);
  const [showBoostPayment, setShowBoostPayment] = useState(false);

  // Subscriptions & Booster Pack payment simulator state
  const [itemToPurchase, setItemToPurchase] = useState<{
    type: 'SUBSCRIPTION' | 'BOOSTER_PACK';
    title: string;
    price: number;
    tier?: SubscriptionTier;
    boostCount?: number;
    packType?: BoosterPackType;
  } | null>(null);

  const isExempt = !!(currentUser.exemptFromPaymentAndKyc || currentUser.isExempt);
  const kycStatus = currentUser.idVerificationStatus || 'NOT_SUBMITTED';

  // Filter ads strictly belonging to this user
  const myAds = ads.filter((ad) => isAdOwner(ad, currentUser));

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
  const maxQuota = useMemo(() => {
    if (isExempt) return 20; // Requirement 2: VIP Partner limit is 20 to reflect Business version!
    if (currentTier === 'BUSINESS') return 20;
    if (currentTier === 'ELITE') return 14;
    if (currentTier === 'PRO') return 8;
    return 3; // Standard free users: max 3 simultaneous ads
  }, [currentTier, isExempt]);

  const displayedAds = myAds.filter((ad) => {
    if (filterStatus === 'ACTIVE') return ad.status === 'ACTIVE';
    if (filterStatus === 'PENDING') return ad.status === 'PENDING_REVIEW';
    if (filterStatus === 'REJECTED') return ad.status === 'REJECTED';
    return true;
  });

  const handleConfirmBoost = async (ad: Ad) => {
    if (!onBoostAd) return;
    setIsBoostingAd(true);
    try {
      await onBoostAd(ad.id);
      if (currentUser.freeBoostsRemaining && currentUser.freeBoostsRemaining > 0 && onUpdateUser) {
        await onUpdateUser({
          freeBoostsRemaining: currentUser.freeBoostsRemaining - 1,
        });
      }
      setAdToBoost(null);
      setShowBoostPayment(false);
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la mise en tête de votre annonce. Réessayez.');
    } finally {
      setIsBoostingAd(false);
    }
  };

  const handleSelectSubscription = async (tier: (typeof SUBSCRIPTION_TIERS)[number]) => {
    if (isExempt) {
      if (!onUpdateUser) return;
      const boostsToAdd = tier.tier === 'BUSINESS' ? 6 : tier.tier === 'ELITE' ? 3 : 1;
      await onUpdateUser({
        subscriptionTier: tier.tier,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        freeBoostsRemaining: Math.min(20, (currentUser.freeBoostsRemaining || 0) + boostsToAdd),
      });
      alert(`Forfait ${tier.name} activé avec succès (Gratuit Partenaire VIP) ! Vos avantages sont immédiatement actifs.`);
      return;
    }

    setItemToPurchase({
      type: 'SUBSCRIPTION',
      title: `Abonnement ${tier.name} (${formatFCFA(tier.price)}/mois)`,
      price: tier.price,
      tier: tier.tier,
    });
  };

  const handleSelectBoosterPack = async (pack: (typeof BOOSTER_PACKS)[number]) => {
    if (isExempt) {
      if (!onUpdateUser) return;
      const currentBoosts = currentUser.freeBoostsRemaining || 0;
      const newBoosts = Math.min(20, currentBoosts + pack.boostsCount);
      await onUpdateUser({
        freeBoostsRemaining: newBoosts,
        activeBoosterPack: pack.type,
      });
      alert(`${pack.name} activé avec succès (Gratuit Partenaire VIP) ! Votre nouveau solde est de ${newBoosts} boosters (max 20).`);
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
        await onUpdateUser({
          subscriptionTier: itemToPurchase.tier,
          subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          freeBoostsRemaining: Math.min(20, (currentUser.freeBoostsRemaining || 0) + boostsToAdd),
        });
        alert(`Félicitations ! Vous êtes désormais abonné au forfait ${itemToPurchase.tier}. Vos avantages sont immédiatement actifs.`);
      } else if (itemToPurchase.type === 'BOOSTER_PACK' && itemToPurchase.boostCount) {
        const currentBoosts = currentUser.freeBoostsRemaining || 0;
        const newBoosts = Math.min(20, currentBoosts + itemToPurchase.boostCount);
        await onUpdateUser({
          freeBoostsRemaining: newBoosts,
          activeBoosterPack: itemToPurchase.packType,
        });
        alert(`Pack de boosters activé avec succès ! Votre nouveau solde est de ${newBoosts} boosters (max 20).`);
      }
      setItemToPurchase(null);
    } catch (e) {
      console.error('Purchase update error:', e);
      alert('Erreur lors de l\'activation de votre achat.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* User Identity & Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-2xl shadow-lg border border-emerald-400/30 shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">{currentUser.name}</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Numéro Gabon Vérifié
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                currentUser.operator === 'AIRTEL' ? 'bg-red-900/60 text-red-200 border border-red-500/30' : 'bg-blue-900/60 text-blue-200 border border-blue-500/30'
              }`}>
                {currentUser.operator === 'AIRTEL' ? 'Airtel Gabon' : 'Moov Africa Gabon'}
              </span>

              {/* Subscription badge */}
              {currentTier !== 'STANDARD' && (
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3 fill-slate-950" />
                  Plan {currentTier}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white tracking-wide">{currentUser.contactPhone}</span>
              <span>•</span>
              <span>Charte CGU acceptée</span>
              <span>•</span>
              <span className="text-emerald-300 font-semibold">
                Annonces actives : {simultaneousCount} / {maxQuota}
              </span>
              {(currentUser.freeBoostsRemaining || 0) > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-amber-300" />
                    {currentUser.freeBoostsRemaining} boost{(currentUser.freeBoostsRemaining || 0) > 1 ? 's' : ''} offert{(currentUser.freeBoostsRemaining || 0) > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onOpenPublishModal}
            className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Déposer une nouvelle annonce</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Advertiser Space Tabs (Exclusively visible inside advertiser dashboard) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
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
                onClick={onOpenPublishModal}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Déposer sans frais</span>
              </button>
            </div>
          ) : kycStatus === 'VERIFIED' ? (
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
                    Votre document d'identité a été validé par la modération. Vos annonces publiées bénéficient du badge officiel de confiance anti-fraude.
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
                  <p className="text-xs text-slate-600 mt-1">
                    Votre pièce d'identité ({currentUser.idDocumentType || 'CNI'}) a été transmise avec succès. Notre équipe contrôle sa conformité.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-50 via-amber-50/50 to-orange-50/30 border border-amber-300/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">Vérification d'identité obligatoire</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                      Anti-Fraude
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Déposez une photo nette de votre pièce officielle pour valider vos annonces.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsKycModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Vérifier mon identité</span>
              </button>
            </div>
          )}

          {/* KPI Cards for the User */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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

            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-700">Vues Cumulées</span>
                <Eye className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-700">{totalViews}</div>
              <span className="text-[10px] text-slate-400">Total consultations</span>
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
                          {ad.mainCategory !== 'EMPLOI' && ad.transactionType && (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                                ad.transactionType === 'VENTE'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {ad.transactionType === 'VENTE' ? 'À VENDRE' : 'À LOUER'}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm">
                            {ad.mainCategory}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isRejected
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isPending ? 'En attente' : isActive ? 'En ligne' : isRejected ? 'Rejetée' : 'Expirée'}
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
                          {ad.mainCategory === 'EMPLOI' ? 'Salaire proposé :' : 'Tarif :'}
                        </span>
                        {formatFCFA(ad.price)}
                        {ad.priceUnit && ad.priceUnit !== 'total' && (
                          <span className="text-xs text-slate-500 font-medium">/{ad.priceUnit}</span>
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
                          onClick={() => onEditAd(ad)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1 border border-emerald-200"
                          title="Modifier cette annonce"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Modifier</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Requirement 6: Boost to top button */}
                        {isActive && (
                          <button
                            onClick={() => setAdToBoost(ad)}
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

                        {isActive && (
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
                onClick={onOpenPublishModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Déposer ma première annonce</span>
              </button>
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
                  ? 'Vous bénéficiez de 3 annonces simultanées incluses. Dès la 4e annonce, un pack fixe (5 ou 10 annonces) est facturé.'
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
                const isCurrent = currentTier === tier.tier;

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
                Propulsez vos annonces en première position pendant 7 jours. Achetez un pack de 5 ou 10 boosters à tarif préférentiel (jusqu'à 20 boosters par utilisateur). Gratuit pour les partenaires VIP.
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

      {/* Boost Modal (Requirement 6) */}
      {adToBoost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  ⭐
                </div>
                <h4 className="font-black text-sm text-slate-900 uppercase">
                  Mettre en Tête de Liste (7 jours)
                </h4>
              </div>
              <button onClick={() => setAdToBoost(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
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
                      : `Vous disposez de ${currentUser.freeBoostsRemaining} boost(s) offert(s) avec votre abonnement.`}
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
                  amount={5000}
                  itemDescription={`Mise en tête de liste 7 jours - ${adToBoost.title}`}
                  onSuccess={() => handleConfirmBoost(adToBoost)}
                  onCancel={() => setShowBoostPayment(false)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl">
                  <span className="text-xs">Tarif de l'option (7 jours) :</span>
                  <span className="text-lg font-black text-amber-400">5 000 FCFA</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBoostPayment(true)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Payer 5 000 FCFA via Airtel ou Moov Money</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription / Pack Purchase Modal */}
      {itemToPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 border border-slate-200 space-y-4">
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
              initialPhone={currentUser.contactPhone}
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
    </div>
  );
};
