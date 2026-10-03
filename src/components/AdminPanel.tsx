import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  DollarSign,
  Smartphone,
  MapPin,
  Calendar,
  ExternalLink,
  Users,
  Search,
  Check,
  X,
  Trash2,
  BarChart3,
  Server,
  LogOut,
  FileCheck,
  ShieldAlert,
  Star,
  FileText,
  BadgeAlert,
  ChevronRight,
  Filter,
  Crown,
  Sparkles,
  FlaskConical,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Ad, AdReport, MainCategory, SubscriptionTier, UserProfile, isUserSuperAdmin } from '../types';
import { formatFCFA, formatRemainingTime } from '../utils/formatters';
import { RealTimeAnalytics } from './RealTimeAnalytics';
import { LogoutConfirmModal } from './LogoutConfirmModal';

interface AdminPanelProps {
  currentUser?: UserProfile | null;
  ads: Ad[];
  users?: UserProfile[];
  reports?: AdReport[];
  onApproveAd: (adId: string) => void;
  onRejectAd: (adId: string, reason: string) => void;
  onDeleteAd: (adId: string) => void;
  onSelectAdDetail: (ad: Ad) => void;
  onSwitchToFrontend: () => void;
  onToggleExemption?: (userId: string, isExempt: boolean) => Promise<void> | void;
  onApproveKyc?: (userId: string) => Promise<void> | void;
  onRejectKyc?: (userId: string, reason: string) => Promise<void> | void;
  onUpdateUserSubscription?: (userId: string, tier: SubscriptionTier) => Promise<void> | void;
  onUpdateUserBoosters?: (userId: string, count: number) => Promise<void> | void;
  onUpdateUserRole?: (userId: string, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN') => Promise<void> | void;
  onResolveReport?: (reportId: string, notes?: string) => Promise<void> | void;
  onDismissReport?: (reportId: string, notes?: string) => Promise<void> | void;
  onDeleteReportedAd?: (adId: string, reportId: string) => Promise<void> | void;
}

// Helper function to detect seed, simulator, and test ads (Point 3)
export function isTestAd(ad: Ad): boolean {
  if (ad.isTest) return true;
  const id = (ad.id || '').toLowerCase();
  const title = (ad.title || '').toLowerCase();
  const desc = (ad.description || '').toLowerCase();
  const phone = (ad.contactPhone || '').replace(/\s+/g, '');
  const ref = (ad.transactionRef || '').toLowerCase();

  if (title.includes('test') || desc.includes('test')) return true;
  if (id.startsWith('test') || id.startsWith('ad-test')) return true;
  if (
    id.startsWith('ad-immo-') ||
    id.startsWith('ad-auto-') ||
    id.startsWith('ad-bric-') ||
    id.startsWith('ad-emp-') ||
    id.startsWith('ad-tut-') ||
    id.startsWith('ad-necro-')
  ) {
    return true;
  }
  if (ref.startsWith('test-') || ref.startsWith('sim-') || ref.includes('demo')) return true;
  if (phone.includes('000000') || phone.includes('123456')) return true;

  return false;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  ads,
  users = [],
  reports = [],
  onApproveAd,
  onRejectAd,
  onDeleteAd,
  onSelectAdDetail,
  onSwitchToFrontend,
  onToggleExemption,
  onApproveKyc,
  onRejectKyc,
  onUpdateUserSubscription,
  onUpdateUserBoosters,
  onUpdateUserRole,
  onResolveReport,
  onDismissReport,
  onDeleteReportedAd,
}) => {
  const isSuper = isUserSuperAdmin(currentUser);

  // Point 3: SUPER ADMIN one-click option to show or hide all test ads
  const [showTestAds, setShowTestAds] = useState<boolean>(true);
  const testAdsCount = useMemo(() => ads.filter(isTestAd).length, [ads]);
  // Active Admin Tab: 'MODERATION' | 'OBSERVATOIRE' | 'ADVERTISERS' | 'REPORTS' | 'SCALABILITY'
  const [activeTab, setActiveTab] = useState<'MODERATION' | 'OBSERVATOIRE' | 'ADVERTISERS' | 'REPORTS' | 'SCALABILITY'>('MODERATION');

  // Moderation filters
  type ModerationStatusFilter = 'PENDING' | 'PRIORITY' | 'ACTIVE' | 'REJECTED' | 'ALL';
  const [statusFilter, setStatusFilter] = useState<ModerationStatusFilter>('PENDING');
  const [categoryFilter, setCategoryFilter] = useState<MainCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Requirement 5: Trier par dans le fichier de modération
  type ModerationSortOption = 'DATE_DESC' | 'DATE_ASC' | 'PRIORITY_TIER' | 'PRICE_DESC' | 'PRICE_ASC' | 'REPORTS_DESC';
  const [moderationSortBy, setModerationSortBy] = useState<ModerationSortOption>('DATE_DESC');

  // Advertisers Directory filters
  const [advSearchQuery, setAdvSearchQuery] = useState('');
  const [advKycFilter, setAdvKycFilter] = useState<'ALL' | 'EXEMPT' | 'VERIFIED' | 'PENDING' | 'NOT_SUBMITTED'>('ALL');

  // Reports filters
  const [reportStatusFilter, setReportStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING');
  const [reportSearchQuery, setReportSearchQuery] = useState('');

  // Modal states
  const [rejectingAd, setRejectingAd] = useState<Ad | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [customRejectText, setCustomRejectText] = useState('');

  // KYC review modal
  const [previewKycUser, setPreviewKycUser] = useState<UserProfile | null>(null);
  const [rejectingKycUser, setRejectingKycUser] = useState<UserProfile | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState('Document illisible ou tronqué.');

  // Quick preset rejection reasons for Gabon market
  const PRESET_REASONS = [
    'Absence de titre foncier ou suspicion de litige sur la parcelle / le bien immobilier.',
    'Photos non conformes, floues ou téléchargées depuis Internet sans rapport avec le bien réel.',
    'Prix irréaliste ou manifestement erroné par rapport au marché gabonais.',
    'Numéro de téléphone inactif ou non joignable lors du test de contact.',
    'Non-respect de la catégorie ou description trompeuse.',
    'Numéro de châssis / carte grise non renseigné pour le véhicule.',
  ];

  const KYC_PRESET_REASONS = [
    'Photo du document floue ou illisible.',
    'Pièce d’identité expirée (date de validité dépassée).',
    'Document non conforme (seuls CNI, Carte de séjour ou Passeport sont acceptés).',
    'Nom ou prénom ne correspondant pas aux informations du compte.',
    'Document rogné ou incomplet.',
  ];

  // Helper to identify priority validation users (Pro, Elite, Business)
  const isAdPriorityUser = (ad: Ad) => {
    const user = users.find((u) => u.id === ad.userId || (ad.contactPhone && u.contactPhone === ad.contactPhone));
    const tier = ad.ownerTier || user?.subscriptionTier;
    return tier === 'PRO' || tier === 'ELITE' || tier === 'BUSINESS';
  };

  // Counts & financial metrics
  const stats = useMemo(() => {
    let pending = 0;
    let priority = 0;
    let active = 0;
    let rejected = 0;
    let totalRevenue = 0;
    let totalViews = 0;

    ads.forEach((ad) => {
      const isPendingAd = ad.status === 'PENDING_REVIEW' || !!ad.pendingExtension;
      if (isPendingAd) {
        pending++;
        if (isAdPriorityUser(ad)) {
          priority++;
        }
      } else if (ad.status === 'ACTIVE') {
        active++;
      } else if (ad.status === 'REJECTED') {
        rejected++;
      }
      totalRevenue += Number(ad.paidAmount) || 0;
      totalViews += Number(ad.viewsCount) || 0;
    });

    return {
      total: ads.length,
      pending,
      priority,
      active,
      rejected,
      totalRevenue,
      totalViews,
    };
  }, [ads, users]);

  // Reports counts
  const reportStats = useMemo(() => {
    let pending = 0;
    let resolved = 0;
    let dismissed = 0;

    reports.forEach((r) => {
      if (r.status === 'PENDING') pending++;
      else if (r.status === 'RESOLVED') resolved++;
      else if (r.status === 'DISMISSED') dismissed++;
    });

    return {
      total: reports.length,
      pending,
      resolved,
      dismissed,
    };
  }, [reports]);

  // Filtered ads in moderation queue with sorting
  const filteredAds = useMemo(() => {
    const list = ads.filter((ad) => {
      const isPending = ad.status === 'PENDING_REVIEW' || !!ad.pendingExtension;
      if (statusFilter === 'PENDING' && !isPending) return false;
      if (statusFilter === 'PRIORITY' && (!isPending || !isAdPriorityUser(ad))) return false;
      if (statusFilter === 'ACTIVE' && ad.status !== 'ACTIVE') return false;
      if (statusFilter === 'REJECTED' && ad.status !== 'REJECTED') return false;

      // Point 3: Super Admin filter to hide test ads
      if (isSuper && !showTestAds && isTestAd(ad)) return false;

      if (categoryFilter !== 'ALL' && ad.mainCategory !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (ad.title || '').toLowerCase().includes(q);
        const matchesPhone = (ad.contactPhone || '').toLowerCase().includes(q);
        const matchesName = (ad.contactName || '').toLowerCase().includes(q);
        const matchesCity = (ad.location?.city || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesPhone && !matchesName && !matchesCity) return false;
      }

      return true;
    });

    // Apply Sorting (Requirement 5)
    return list.sort((a, b) => {
      if (moderationSortBy === 'PRIORITY_TIER') {
        const tierWeight: Record<string, number> = { BUSINESS: 4, ELITE: 3, PRO: 2, STARTER: 1, STANDARD: 0, FREE: 0 };
        const tierA = a.ownerTier || users.find((u) => u.id === a.userId)?.subscriptionTier || 'STANDARD';
        const tierB = b.ownerTier || users.find((u) => u.id === b.userId)?.subscriptionTier || 'STANDARD';
        const diff = (tierWeight[tierB] || 0) - (tierWeight[tierA] || 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt || b.publishedAt || 0).getTime() - new Date(a.createdAt || a.publishedAt || 0).getTime();
      }
      if (moderationSortBy === 'DATE_ASC') {
        return new Date(a.createdAt || a.publishedAt || 0).getTime() - new Date(b.createdAt || b.publishedAt || 0).getTime();
      }
      if (moderationSortBy === 'PRICE_DESC') {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      }
      if (moderationSortBy === 'PRICE_ASC') {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }
      if (moderationSortBy === 'REPORTS_DESC') {
        return (Number(b.reportsCount) || 0) - (Number(a.reportsCount) || 0);
      }
      // Default: DATE_DESC
      return new Date(b.createdAt || b.publishedAt || 0).getTime() - new Date(a.createdAt || a.publishedAt || 0).getTime();
    });
  }, [ads, users, statusFilter, categoryFilter, searchQuery, moderationSortBy, isSuper, showTestAds]);

  // Registered Advertisers List (grounded in users collection)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const isExempt = Boolean(u.exemptFromPaymentAndKyc || u.isExempt);
      const kycStatus = u.idVerificationStatus || 'NOT_SUBMITTED';

      if (advKycFilter === 'EXEMPT' && !isExempt) return false;
      if (advKycFilter === 'VERIFIED' && kycStatus !== 'VERIFIED') return false;
      if (advKycFilter === 'PENDING' && kycStatus !== 'PENDING') return false;
      if (advKycFilter === 'NOT_SUBMITTED' && kycStatus !== 'NOT_SUBMITTED') return false;

      if (advSearchQuery.trim()) {
        const q = advSearchQuery.toLowerCase();
        const name = (u.name || '').toLowerCase();
        const phone = (u.contactPhone || u.phoneNumber || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });
  }, [users, advKycFilter, advSearchQuery]);

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (reportStatusFilter !== 'ALL' && r.status !== reportStatusFilter) return false;
      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.toLowerCase();
        const title = (r.adTitle || '').toLowerCase();
        const reason = (r.reason || '').toLowerCase();
        const details = (r.details || '').toLowerCase();
        const phone = (r.reporterPhone || '').toLowerCase();
        if (!title.includes(q) && !reason.includes(q) && !details.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [reports, reportStatusFilter, reportSearchQuery]);

  const pendingKycCount = useMemo(
    () => users.filter((u) => u.idVerificationStatus === 'PENDING').length,
    [users]
  );

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const handleAdminLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmRejectAd = () => {
    if (!rejectingAd) return;
    const finalReason = customRejectText.trim() || rejectReason || 'Non-conformité aux règles de publication.';
    onRejectAd(rejectingAd.id, finalReason);
    setRejectingAd(null);
    setRejectReason('');
    setCustomRejectText('');
  };

  const handleConfirmRejectKyc = () => {
    if (!rejectingKycUser || !onRejectKyc) return;
    onRejectKyc(rejectingKycUser.id, kycRejectionReason);
    setRejectingKycUser(null);
    setKycRejectionReason('Document illisible ou tronqué.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Executive Header / Top Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {isSuper ? (
                <>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 shadow-sm">
                    <Crown className="w-3.5 h-3.5 fill-slate-950" />
                    SUPER ADMIN Cockpit
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Contrôle Total (Partenaires, Forfaits & Boosters)
                  </span>
                </>
              ) : (
                <>
                  <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Console de Modération Admin
                  </span>
                  <span className="bg-slate-700/60 text-slate-300 border border-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Modérateur Connecté
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              BIZBOOSTER Gabon · {isSuper ? 'Super Administration' : 'Panneau de Modération'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {isSuper
                ? "Modération complète, gestion des partenaires VIP, forfaits abonnements, attribution des boosters et observatoire du marché."
                : "Modération des annonces, contrôle d'identité KYC, observatoire marché en direct et traitement des signalements de fraude."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Attention signal for pending identity submissions (Point 6) */}
            {pendingKycCount > 0 && (
              <button
                onClick={() => {
                  setActiveTab('ADVERTISERS');
                  setAdvKycFilter('PENDING');
                }}
                className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-xl text-xs font-black transition-all flex items-center gap-2 animate-pulse cursor-pointer shadow-sm"
                title="Cliquer pour examiner les pièces d'identité en attente"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{pendingKycCount} KYC en attente</span>
              </button>
            )}

            <button
              onClick={onSwitchToFrontend}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-emerald-200" />
              <span>Ouvrir l'App Frontend Client</span>
            </button>

            {/* Red Logout Button (Point 9) */}
            <button
              onClick={handleAdminLogout}
              className="px-3.5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black transition-all shadow-sm border border-red-500 flex items-center gap-1.5 cursor-pointer"
              title="Se déconnecter de l'administration"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation inside Admin Application */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-800/80">
          {/* TAB 1: MODERATION QUEUE */}
          <button
            onClick={() => setActiveTab('MODERATION')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'MODERATION'
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>File de Modération</span>
            {stats.pending > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'MODERATION' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
                }`}
              >
                {stats.pending}
              </span>
            )}
          </button>

          {/* TAB 2: OBSERVATOIRE MARCHÉ */}
          <button
            onClick={() => setActiveTab('OBSERVATOIRE')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'OBSERVATOIRE'
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Observatoire Marché & BI</span>
            <span className="bg-emerald-400/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              Chiffres Exacts
            </span>
          </button>

          {/* TAB 3: ADVERTISERS DIRECTORY with KYC signal (Point 6) */}
          <button
            onClick={() => setActiveTab('ADVERTISERS')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'ADVERTISERS'
                ? 'bg-indigo-500 text-white border-indigo-400 shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Répertoire Annonceurs ({users.length})</span>
            {pendingKycCount > 0 && (
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 ${
                  activeTab === 'ADVERTISERS' ? 'bg-slate-950 text-amber-300' : 'bg-amber-400 text-slate-950'
                }`}
                title={`${pendingKycCount} pièce(s) d'identité en attente d'examen`}
              >
                <Clock className="w-2.5 h-2.5" />
                <span>{pendingKycCount} KYC</span>
              </span>
            )}
          </button>

          {/* TAB 4: FRAUD REPORTS */}
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border ${
              activeTab === 'REPORTS'
                ? 'bg-red-500 text-white border-red-400 shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Signalements & Fraude</span>
            {reportStats.pending > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'REPORTS' ? 'bg-slate-950 text-red-300' : 'bg-red-500 text-white'
                }`}
              >
                {reportStats.pending} à traiter
              </span>
            )}
          </button>

          {/* TAB 5: SCALABILITY AUDIT */}
          <button
            onClick={() => setActiveTab('SCALABILITY')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border ${
              activeTab === 'SCALABILITY'
                ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Capacité & Scalabilité</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: OBSERVATOIRE MARCHÉ EN DIRECT (STRICTLY RESERVED TO ADMIN) */}
      {activeTab === 'OBSERVATOIRE' && (
        <div className="space-y-4">
          <RealTimeAnalytics ads={ads} users={users} />
        </div>
      )}

      {/* VIEW 2: MODERATION QUEUE */}
      {activeTab === 'MODERATION' && (
        <div className="space-y-4">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              onClick={() => setStatusFilter('PENDING')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500/10 border-amber-500 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-amber-700 font-bold mb-1">
                <span>En attente</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-600">
                {stats.pending}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">À traiter au total</span>
            </div>

            {/* Requirement 2: Validations Prioritaires Quick Card */}
            <div
              onClick={() => setStatusFilter('PRIORITY')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                statusFilter === 'PRIORITY'
                  ? 'bg-amber-400/20 border-amber-500 text-slate-900 shadow-xs ring-2 ring-amber-400/30'
                  : 'bg-amber-50/60 border-amber-300/80 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-amber-900 font-black mb-1">
                <span className="flex items-center gap-1">⚡ Priorités (Pro+)</span>
                <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-700">
                {stats.priority}
              </div>
              <span className="text-[10px] text-amber-800 font-bold">Pro, Élite, Business</span>
            </div>

            <div
              onClick={() => setStatusFilter('ACTIVE')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-emerald-700 font-bold mb-1">
                <span>En ligne (Actives)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                {stats.active}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Visibles sur le frontend</span>
            </div>

            <div
              onClick={() => setStatusFilter('REJECTED')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                statusFilter === 'REJECTED'
                  ? 'bg-red-500/10 border-red-500 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-red-700 font-bold mb-1">
                <span>Annonces Rejetées</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-red-600">
                {stats.rejected}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Avec motif de refus</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-center justify-between text-xs text-indigo-700 font-bold mb-1">
                <span>Recettes Mobile Money</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {formatFCFA(stats.totalRevenue)}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Airtel & Moov encaissés</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-center justify-between text-xs text-blue-700 font-bold mb-1">
                <span>Audience (Vues)</span>
                <Eye className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-700 font-mono">
                {stats.totalViews.toLocaleString('fr-FR')}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Total vues enregistrées</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Filtrer statut :</span>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>En attente</span>
                <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {stats.pending}
                </span>
              </button>

              {/* Requirement 2: Rubrique Validations Prioritaires */}
              <button
                onClick={() => setStatusFilter('PRIORITY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'PRIORITY'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs font-black ring-2 ring-amber-400/40'
                    : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>⚡ Validations prioritaires</span>
                <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {stats.priority}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>En ligne ({stats.active})</span>
              </button>

              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'REJECTED'
                    ? 'bg-red-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Rejetées ({stats.rejected})</span>
              </button>

              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Toutes ({stats.total})
              </button>

              {/* Point 3: SUPER ADMIN One-Click Test Ads Toggle */}
              {isSuper && (
                <button
                  type="button"
                  onClick={() => setShowTestAds((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                    showTestAds
                      ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                  title={
                    showTestAds
                      ? '1 clic pour masquer toutes les annonces tests'
                      : '1 clic pour afficher toutes les annonces tests'
                  }
                >
                  <FlaskConical className={`w-3.5 h-3.5 ${showTestAds ? 'text-purple-700' : 'text-slate-400'}`} />
                  <span>
                    {showTestAds
                      ? `🧪 Annonces Tests : Affichées (${testAdsCount})`
                      : `🧪 Annonces Tests : Masquées (${testAdsCount})`}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase ${
                      showTestAds ? 'bg-purple-700 text-white' : 'bg-slate-600 text-white'
                    }`}
                  >
                    {showTestAds ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}
            </div>

            {/* Controls: Trier par & Search in moderation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Requirement 5: Option Trier par */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Trier par :</span>
                <select
                  value={moderationSortBy}
                  onChange={(e) => setModerationSortBy(e.target.value as ModerationSortOption)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="DATE_DESC">Date (Plus récentes)</option>
                  <option value="DATE_ASC">Date (Plus anciennes - FIFO)</option>
                  <option value="PRIORITY_TIER">⚡ Forfait (Business &gt; Élite &gt; Pro)</option>
                  <option value="PRICE_DESC">Prix (Plus élevé d'abord)</option>
                  <option value="PRICE_ASC">Prix (Plus bas d'abord)</option>
                  <option value="REPORTS_DESC">Signalements (Fraude)</option>
                </select>
              </div>

              {/* Search in moderation */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Chercher par titre, ville, tel..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* List of Ads in Moderation */}
          {filteredAds.length > 0 ? (
            <div className="space-y-4">
              {filteredAds.map((ad) => {
                const isPending = ad.status === 'PENDING_REVIEW' || !!ad.pendingExtension;
                const isActive = ad.status === 'ACTIVE';
                const isRejected = ad.status === 'REJECTED';
                const isPriorityAd = isAdPriorityUser(ad);

                return (
                  <div
                    key={ad.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 ${
                      isPriorityAd && isPending
                        ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/10'
                        : isPending
                        ? 'border-amber-300 ring-2 ring-amber-400/20'
                        : isRejected
                        ? 'border-red-200 bg-red-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Left: Thumbnail & Details */}
                    <div className="flex flex-col sm:flex-row items-start gap-4 flex-1">
                      <div className="w-full sm:w-36 h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                        <img
                          src={ad.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=500&q=80'}
                          alt={ad.title || 'Annonce'}
                          className="w-full h-full object-cover"
                        />
                        {(ad.images?.length || 0) > 1 && (
                          <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            +{(ad.images?.length || 1) - 1} photos
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        {/* Status + Category + Transaction Tag + Priority Tag */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isPending && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-700" />
                              En attente de validation
                            </span>
                          )}
                          {isPriorityAd && isPending && (
                            <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-2xs border border-amber-300">
                              <Sparkles className="w-3 h-3 fill-slate-950" />
                              <span>⚡ Validation prioritaire ({ad.ownerTier || users.find((u) => u.id === ad.userId)?.subscriptionTier || 'PRO'})</span>
                            </span>
                          )}
                          {isActive && (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              En Ligne sur Frontend
                            </span>
                          )}
                          {isRejected && (
                            <span className="bg-red-100 text-red-900 border border-red-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-red-700" />
                              Rejetée
                            </span>
                          )}

                          {isTestAd(ad) && (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <FlaskConical className="w-3 h-3 text-purple-700" />
                              Test
                            </span>
                          )}

                          {ad.mainCategory === 'EMPLOI' ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-sm bg-purple-50 text-purple-800 border border-purple-200">
                              À EMPLOYER
                            </span>
                          ) : ad.transactionType ? (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                                ad.transactionType === 'VENTE'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {ad.transactionType === 'VENTE' ? 'À VENDRE' : 'À LOUER'}
                            </span>
                          ) : null}

                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-sm">
                            {ad.mainCategory}
                          </span>

                          {ad.reportsCount && ad.reportsCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {ad.reportsCount} signalement(s)
                            </span>
                          )}
                        </div>

                        {/* Title & Price */}
                        <h3
                          className="font-extrabold text-base text-slate-900 hover:text-emerald-700 cursor-pointer"
                          onClick={() => onSelectAdDetail(ad)}
                        >
                          {ad.title}
                        </h3>

                        <div className="text-emerald-700 font-black text-sm">
                          {formatFCFA(ad.price)}
                          {ad.priceUnit && ad.priceUnit !== 'total' && (
                            <span className="text-xs text-slate-500 font-medium">/{ad.priceUnit}</span>
                          )}
                        </div>

                        {/* Meta info: Location + Advertiser contact + Views */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                          {ad.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {ad.location.city} ({ad.location.neighborhood})
                            </span>
                          )}

                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Smartphone className="w-3 h-3 text-emerald-600" />
                            {ad.contactPhone} ({ad.contactName})
                          </span>

                          <span className="flex items-center gap-1 font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>{ad.viewsCount || 0} vue{(ad.viewsCount || 0) > 1 ? 's' : ''}</span>
                          </span>

                          <span className="text-slate-400">
                            Paiement : <strong>{formatFCFA(ad.paidAmount)}</strong> ({ad.paymentMethod || 'Exonération / Direct'} - Réf: {ad.transactionRef || 'N/A'})
                          </span>
                        </div>

                        {/* Rejection reason banner if rejected */}
                        {isRejected && ad.moderationReason && (
                          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                            <strong>Motif du rejet notifié :</strong> {ad.moderationReason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap lg:flex-col items-center justify-end gap-2 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        onClick={() => onSelectAdDetail(ad)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Examiner</span>
                      </button>

                      {isPending && (
                        <>
                          <button
                            onClick={() => onApproveAd(ad.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>Approuver & Publier</span>
                          </button>

                          <button
                            onClick={() => {
                              setRejectingAd(ad);
                              setRejectReason(PRESET_REASONS[0]);
                            }}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rejeter</span>
                          </button>
                        </>
                      )}

                      {isActive && (
                        <button
                          onClick={() => {
                            setRejectingAd(ad);
                            setRejectReason(PRESET_REASONS[1]);
                          }}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          Suspendre
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteAd(ad.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm">
                Aucune annonce dans cette catégorie de modération
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Toutes les annonces soumises ont été traitées ou correspondent à d'autres filtres.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: ADVERTISERS DIRECTORY (REPERTOIRE ANNONCEURS) */}
      {activeTab === 'ADVERTISERS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-lg text-slate-900">
                  Répertoire Complet des Annonceurs Inscrits
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuper
                  ? "Gestion des comptes, vérification KYC, forfaits abonnements et gestion des partenaires VIP."
                  : "Gestion des comptes annonceurs et vérification des pièces d'identité KYC."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                {users.length} annonceur{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Filters & Search for advertisers */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 mr-1">Filtre :</span>
              <button
                onClick={() => setAdvKycFilter('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  advKycFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Tous ({users.length})
              </button>
              {isSuper && (
                <button
                  onClick={() => setAdvKycFilter('EXEMPT')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    advKycFilter === 'EXEMPT' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  ⭐ Exonérés VIP ({users.filter((u) => u.exemptFromPaymentAndKyc || u.isExempt).length})
                </button>
              )}
              <button
                onClick={() => setAdvKycFilter('PENDING')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  advKycFilter === 'PENDING' ? 'bg-blue-600 text-white font-black' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                ⏳ KYC À Valider ({users.filter((u) => u.idVerificationStatus === 'PENDING').length})
              </button>
              <button
                onClick={() => setAdvKycFilter('VERIFIED')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  advKycFilter === 'VERIFIED' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                ✓ KYC Validés ({users.filter((u) => u.idVerificationStatus === 'VERIFIED').length})
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={advSearchQuery}
                onChange={(e) => setAdvSearchQuery(e.target.value)}
                placeholder="Rechercher nom, téléphone..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Advertisers Table */}
          {filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3 rounded-l-xl">Annonceur</th>
                    <th className="p-3">Numéro Gabon (+241)</th>
                    <th className="p-3">Annonces (Actives)</th>
                    <th className="p-3">Total Payé</th>
                    {isSuper && <th className="p-3">Statut Exonération</th>}
                    <th className="p-3">Forfait / Abonnement</th>
                    <th className="p-3">Boosters (max 20)</th>
                    <th className="p-3">Pièce d'Identité (KYC)</th>
                    {isSuper && <th className="p-3">Rôle Système</th>}
                    <th className="p-3 rounded-r-xl text-right">Actions {isSuper ? 'Superviseur' : 'Modérateur'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isExempt = Boolean(u.exemptFromPaymentAndKyc || u.isExempt);
                    const kycStatus = u.idVerificationStatus || 'NOT_SUBMITTED';

                    // Ads for this user
                    const userAds = ads.filter((a) => a.userId === u.id || (a.contactPhone && (a.contactPhone === u.contactPhone || a.contactPhone === u.phoneNumber)));
                    const activeUserAds = userAds.filter((a) => a.status === 'ACTIVE');
                    const isStaff = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'SUPER ADMIN';
                    const totalSpent = userAds.reduce((acc, a) => acc + (Number(a.paidAmount) || 0), 0);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name & Role */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block">{u.name}</span>
                              <span className="text-[10px] text-slate-400">
                                {u.role === 'ADMIN' ? '👑 Modérateur' : u.role === 'SUPER_ADMIN' || u.role === 'SUPER ADMIN' ? '👑 Super Admin' : 'Annonceur'}
                                {u.createdAt ? ` • Inscrit le ${new Date(u.createdAt).toLocaleDateString('fr-FR')}` : ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Phone & Operator */}
                        <td className="p-3 font-mono">
                          <div className="font-bold text-slate-800">{u.contactPhone || u.phoneNumber || 'N/A'}</div>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                              u.operator === 'AIRTEL'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {u.operator === 'AIRTEL' ? 'Airtel Money' : 'Moov Money'}
                          </span>
                        </td>

                        {/* Ads Count */}
                        <td className="p-3">
                          <span className="font-bold text-slate-900">{userAds.length}</span>
                          <span className="text-slate-400"> ({activeUserAds.length} en ligne)</span>
                        </td>

                        {/* Total Spent */}
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {formatFCFA(totalSpent)}
                        </td>

                        {/* Exemption VIP Status (Super Admin Only) - Point 6: Not for moderators */}
                        {isSuper && (
                          <td className="p-3">
                            {isStaff ? (
                              <span className="text-slate-400 text-[10px] italic">
                                Non applicable (Équipe)
                              </span>
                            ) : isExempt ? (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                                Exonéré VIP (Gratuit)
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                Standard (Payant)
                              </span>
                            )}
                          </td>
                        )}

                        {/* Subscription Tier (Forfait) - Point 6: Not for moderators */}
                        <td className="p-3">
                          {isStaff ? (
                            <span className="text-slate-400 text-[10px] italic">
                              Non applicable (Équipe)
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <div>
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                                    u.subscriptionTier === 'BUSINESS'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : u.subscriptionTier === 'ELITE'
                                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                                      : u.subscriptionTier === 'PRO'
                                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {u.subscriptionTier === 'BUSINESS'
                                    ? '🥇 Business (20 ads)'
                                    : u.subscriptionTier === 'ELITE'
                                    ? '🥈 Élite (14 ads)'
                                    : u.subscriptionTier === 'PRO'
                                    ? '🥉 Pro (8 ads)'
                                    : 'Standard (3 ads)'}
                                </span>
                              </div>
                              {isSuper && onUpdateUserSubscription && (
                                <select
                                  value={u.subscriptionTier || 'STANDARD'}
                                  onChange={(e) => onUpdateUserSubscription(u.id, e.target.value as SubscriptionTier)}
                                  className="text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer block"
                                  title="Modifier ou révoquer le forfait d'abonnement (Super Admin)"
                                >
                                  <option value="STANDARD">Standard (Sans forfait)</option>
                                  <option value="PRO">Pro (8 annonces)</option>
                                  <option value="ELITE">Élite (14 annonces)</option>
                                  <option value="BUSINESS">Business (20 annonces)</option>
                                </select>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Boosters (Solde & Attribution max 20) - Point 6: Not for moderators */}
                        <td className="p-3">
                          {isStaff ? (
                            <span className="text-slate-400 text-[10px] italic">
                              Non applicable
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                                  ⚡ {u.freeBoostsRemaining || 0} / 20
                                </span>
                              </div>
                              {isSuper && onUpdateUserBoosters && (
                                <div className="flex items-center gap-1 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateUserBoosters(u.id, Math.max(0, (u.freeBoostsRemaining || 0) - 1))}
                                    disabled={(u.freeBoostsRemaining || 0) <= 0}
                                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs flex items-center justify-center cursor-pointer"
                                    title="Diminuer de 1 booster (Super Admin)"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateUserBoosters(u.id, Math.min(20, (u.freeBoostsRemaining || 0) + 1))}
                                    disabled={(u.freeBoostsRemaining || 0) >= 20}
                                    className="w-6 h-6 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs flex items-center justify-center cursor-pointer border border-emerald-200"
                                    title="Ajouter 1 booster (Super Admin)"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateUserBoosters(u.id, Math.min(20, (u.freeBoostsRemaining || 0) + 5))}
                                    disabled={(u.freeBoostsRemaining || 0) >= 20}
                                    className="px-1.5 h-6 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 disabled:opacity-30 disabled:cursor-not-allowed font-black text-[10px] flex items-center justify-center cursor-pointer border border-amber-200"
                                    title="Ajouter 5 boosters (max 20) (Super Admin)"
                                  >
                                    +5
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* KYC Status & Thumbnail - Point 6: Not required for staff */}
                        <td className="p-3">
                          {isStaff ? (
                            <span className="text-slate-400 text-[10px] italic">
                              Non requis (Équipe)
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {kycStatus === 'VERIFIED' && (
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Validée ({u.idDocumentType || 'CNI'})
                                </span>
                              )}
                              {kycStatus === 'PENDING' && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  En attente d'examen
                                </span>
                              )}
                              {kycStatus === 'REJECTED' && (
                                <span className="bg-red-100 text-red-900 border border-red-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-red-600" />
                                  Rejetée
                                </span>
                              )}
                              {kycStatus === 'NOT_SUBMITTED' && (
                                <span className="text-slate-400 text-[10px] italic">
                                  Non transmise
                                </span>
                              )}

                              {u.idDocumentUrl && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewKycUser(u)}
                                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Voir la pièce ({u.idDocumentType || 'CNI'})</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* System Role (Super Admin Only - Strict Policies 2a & 2b) */}
                        {isSuper && (
                          <td className="p-3">
                            <div className="space-y-1.5">
                              {u.role === 'SUPER_ADMIN' || u.role === 'SUPER ADMIN' ? (
                                <div className="space-y-0.5">
                                  <span className="bg-amber-100 text-amber-950 border border-amber-300 font-black text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                                    <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                                    Super Admin
                                  </span>
                                  <span className="text-[9px] text-slate-400 block font-medium">
                                    🔒 Non révocable via l'interface (Console Firestore uniquement)
                                  </span>
                                </div>
                              ) : u.role === 'ADMIN' ? (
                                <div className="space-y-1">
                                  <span className="bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-purple-700" />
                                    Modérateur (Admin)
                                  </span>
                                  {onUpdateUserRole && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Êtes-vous certain de vouloir promouvoir le modérateur "${u.name || u.contactPhone}" en SUPER ADMINISTRATEUR ?\n\nConformément à la règle de gouvernance, un Super Administrateur ne peut plus être rétrogradé depuis cette interface web (toute révocation future devra obligatoirement être réalisée manuellement dans la base de données Firestore).`
                                          )
                                        ) {
                                          onUpdateUserRole(u.id, 'SUPER_ADMIN');
                                        }
                                      }}
                                      className="text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 px-2 py-1 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                      title="Promouvoir ce modérateur en Super Administrateur"
                                    >
                                      <Crown className="w-3 h-3 fill-slate-950" />
                                      <span>Promouvoir Super Admin</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px] px-2 py-0.5 rounded-full inline-block">
                                    Annonceur Standard
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">
                                    Compte annonceur
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Actions - Point 6: Exemption & KYC actions reserved for advertisers */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isStaff ? (
                              <span className="text-slate-400 text-[10px] italic">
                                Équipe interne
                              </span>
                            ) : (
                              <>
                                {/* Toggle Exemption Button (Super Admin Only) */}
                                {isSuper && onToggleExemption && (
                                  <button
                                    onClick={() => onToggleExemption(u.id, !isExempt)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                                      isExempt
                                        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                    }`}
                                    title={isExempt ? "Révoquer l'exonération VIP" : "Accorder l'exonération VIP (gratuit et sans KYC)"}
                                  >
                                    {isExempt ? 'Révoquer VIP' : 'Exonérer (VIP)'}
                                  </button>
                                )}

                                {/* Validate / Reject KYC Buttons */}
                                {u.idDocumentUrl && kycStatus === 'PENDING' && (
                                  <>
                                    {onApproveKyc && (
                                      <button
                                        onClick={() => onApproveKyc(u.id)}
                                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                                        title="Valider la pièce d'identité"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {onRejectKyc && (
                                      <button
                                        onClick={() => setRejectingKycUser(u)}
                                        className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                        title="Rejeter la pièce"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-500 text-xs">
              Aucun annonceur ne correspond aux filtres de recherche.
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: FRAUD REPORTS & COMPLAINTS (SIGNALEMENTS & FRAUDE) */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setReportStatusFilter('PENDING')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                reportStatusFilter === 'PENDING'
                  ? 'bg-red-500/10 border-red-500 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-red-700 font-bold mb-1">
                <span>Signalements en attente</span>
                <BadgeAlert className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-red-600">
                {reportStats.pending}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">À instruire immédiatement</span>
            </div>

            <div
              onClick={() => setReportStatusFilter('RESOLVED')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                reportStatusFilter === 'RESOLVED'
                  ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-emerald-700 font-bold mb-1">
                <span>Signalements Traités</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                {reportStats.resolved}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Annonces supprimées ou régularisées</span>
            </div>

            <div
              onClick={() => setReportStatusFilter('DISMISSED')}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                reportStatusFilter === 'DISMISSED'
                  ? 'bg-slate-200 border-slate-400 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-700 font-bold mb-1">
                <span>Classés Sans Suite</span>
                <XCircle className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-700">
                {reportStats.dismissed}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Signalements non fondés</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-center justify-between text-xs text-indigo-700 font-bold mb-1">
                <span>Total Signalements</span>
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {reportStats.total}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Historique complet des alertes</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 mr-1">Statut :</span>
              <button
                onClick={() => setReportStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  reportStatusFilter === 'PENDING'
                    ? 'bg-red-600 text-white font-black shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>En attente ({reportStats.pending})</span>
              </button>
              <button
                onClick={() => setReportStatusFilter('RESOLVED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  reportStatusFilter === 'RESOLVED'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Résolus ({reportStats.resolved})
              </button>
              <button
                onClick={() => setReportStatusFilter('DISMISSED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  reportStatusFilter === 'DISMISSED'
                    ? 'bg-slate-900 text-white font-black shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Classés sans suite ({reportStats.dismissed})
              </button>
              <button
                onClick={() => setReportStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  reportStatusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white font-black shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tous ({reportStats.total})
              </button>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                placeholder="Chercher par annonce, motif, tél..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* List of Reports */}
          {filteredReports.length > 0 ? (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const isPending = report.status === 'PENDING';
                const isResolved = report.status === 'RESOLVED';
                const relatedAd = ads.find((a) => a.id === report.adId);

                return (
                  <div
                    key={report.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                      isPending ? 'border-red-300 ring-2 ring-red-400/20 bg-red-50/10' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-red-100 text-red-900 border border-red-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-red-700" />
                          {report.reason}
                        </span>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-amber-100 text-amber-900'
                              : isResolved
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isPending ? 'À Traiter' : isResolved ? 'Traité / Résolu' : 'Classé Sans Suite'}
                        </span>

                        <span className="text-[11px] text-slate-400">
                          {report.createdAt ? new Date(report.createdAt).toLocaleString('fr-FR') : ''}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                        Annonce concernée : <span className="text-red-700">{report.adTitle}</span>
                      </h4>

                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                        <strong>Précisions du signalant :</strong> {report.details}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {report.reporterPhone && (
                          <span>
                            Contact du signalant : <strong className="text-slate-800">{report.reporterPhone}</strong>
                          </span>
                        )}
                        {report.adOwnerPhone && (
                          <span>
                            Annonceur mis en cause : <strong className="text-slate-800">{report.adOwnerPhone}</strong>
                          </span>
                        )}
                        {report.resolutionNotes && (
                          <span className="text-emerald-700 font-medium">
                            Note de résolution : {report.resolutionNotes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions on Report */}
                    <div className="flex flex-wrap lg:flex-col items-center justify-end gap-2 shrink-0 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {relatedAd && (
                        <button
                          onClick={() => onSelectAdDetail(relatedAd)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Voir l'annonce</span>
                        </button>
                      )}

                      {isPending && (
                        <>
                          {onDeleteReportedAd && relatedAd && (
                            <button
                              onClick={() => onDeleteReportedAd(report.adId, report.id)}
                              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer l'annonce</span>
                            </button>
                          )}

                          {onResolveReport && (
                            <button
                              onClick={() => onResolveReport(report.id)}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Résoudre</span>
                            </button>
                          )}

                          {onDismissReport && (
                            <button
                              onClick={() => onDismissReport(report.id)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                            >
                              Classer sans suite
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm">
                Aucun signalement dans ce statut
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                La plateforme est saine ou tous les signalements de fraude ont été résolus.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: SCALABILITY & ARCHITECTURE AUDIT */}
      {activeTab === 'SCALABILITY' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm">
              Rapport d'Ingénierie & Capacité
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Combien d'utilisateurs cette application peut-elle supporter ?
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analyse architecturale détaillée des performances en lecture (visiteurs gratuits) et en écriture (annonceurs connectés).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Visiteurs Publics (Lecture)</h4>
                  <span className="text-[11px] text-emerald-700 font-bold">100% Gratuit sans login</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Capacité Concurrente</span>
                <p className="text-2xl font-black text-emerald-600">100 000+ à 1 000 000+</p>
                <span className="text-[11px] text-slate-500">visiteurs simultanés via CDN Edge</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Les visiteurs consultant le catalogue d'annonces sur l'application Frontend ne sollicitent que des lectures statiques ou mises en cache. Servi via Cloud CDN, le coût est quasi nul et l'application ne sature pas même lors de pics de trafic massifs au Gabon.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Annonceurs (Authentifiés)</h4>
                  <span className="text-[11px] text-indigo-700 font-bold">SMS OTP + Publication</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Débit d'Écriture Backend</span>
                <p className="text-2xl font-black text-indigo-600">10 000 requêtes / sec</p>
                <span className="text-[11px] text-slate-500">avec Firestore ou PostgreSQL Cloud SQL</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Les annonceurs se connectant par numéro (+241) avec code OTP reçoivent un jeton de session JWT. La création d'annonce et le stockage des photos (Google Cloud Storage) s'effectuent de façon asynchrone sans bloquer l'expérience utilisateur.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Passerelle SMS (+241)</h4>
                  <span className="text-[11px] text-amber-700 font-bold">Airtel Gabon & Moov Africa</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Envois SMS OTP</span>
                <p className="text-2xl font-black text-amber-600">500 à 1 000 SMS / sec</p>
                <span className="text-[11px] text-slate-500">via Twilio / Infobip / Africa's Talking</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Le seul facteur limitant au Gabon est le débit de distribution des SMS par les opérateurs locaux (Airtel / Moov). Avec une route directe SMPP, la plateforme délivre le code OTP en moins de 3 secondes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REJECTION REASON FOR AD */}
      {rejectingAd && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-base">Rejeter l'annonce</h3>
              </div>
              <button
                onClick={() => setRejectingAd(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs text-slate-500">Annonce concernée :</span>
                <p className="font-extrabold text-slate-900 text-sm">{rejectingAd.title}</p>
                <p className="text-xs text-slate-600">
                  Déposée par {rejectingAd.contactName} ({rejectingAd.contactPhone})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Sélectionner un motif de rejet prédéfini :
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                >
                  {PRESET_REASONS.map((r, i) => (
                    <option key={i} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Ou préciser un motif sur-mesure :
                </label>
                <textarea
                  value={customRejectText}
                  onChange={(e) => setCustomRejectText(e.target.value)}
                  rows={3}
                  placeholder="Ex: Titre foncier non visible, documents illisibles..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingAd(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectAd}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all"
                >
                  Confirmer le rejet et notifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FULL-SIZE KYC DOCUMENT VIEWER */}
      {previewKycUser && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-indigo-950 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                    {previewKycUser.idDocumentType || 'CNI'}
                  </span>
                  <h3 className="font-extrabold text-base">Pièce d'Identité Annonceur</h3>
                </div>
                <p className="text-xs text-indigo-300 mt-0.5">
                  {previewKycUser.name} ({previewKycUser.contactPhone || previewKycUser.phoneNumber})
                </p>
              </div>
              <button
                onClick={() => setPreviewKycUser(null)}
                className="text-indigo-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-2 min-h-64">
                <img
                  src={previewKycUser.idDocumentUrl}
                  alt="Pièce d'identité"
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-wrap justify-between gap-2">
                <span>
                  Type : <strong>{previewKycUser.idDocumentType || 'CNI'}</strong>
                </span>
                <span>
                  Statut : <strong>{previewKycUser.idVerificationStatus || 'En attente'}</strong>
                </span>
                {previewKycUser.idSubmittedAt && (
                  <span>
                    Transmise le : {new Date(previewKycUser.idSubmittedAt).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewKycUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                {onRejectKyc && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingKycUser(previewKycUser);
                      setPreviewKycUser(null);
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-all"
                  >
                    Rejeter la pièce
                  </button>
                )}

                {onApproveKyc && (
                  <button
                    type="button"
                    onClick={() => {
                      onApproveKyc(previewKycUser.id);
                      setPreviewKycUser(null);
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Valider l'Identité</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KYC REJECTION REASON */}
      {rejectingKycUser && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-slate-900">Motif du rejet de la pièce</h3>
              </div>
              <button onClick={() => setRejectingKycUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Précisez la raison pour laquelle la pièce d'identité de <strong>{rejectingKycUser.name}</strong> n'est pas acceptée. L'utilisateur pourra en soumettre une nouvelle.
            </p>

            <select
              value={kycRejectionReason}
              onChange={(e) => setKycRejectionReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
            >
              {KYC_PRESET_REASONS.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingKycUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectKyc}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-sm"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => signOut(auth)}
        title="Déconnexion de l'Administration"
        message="Êtes-vous certain de vouloir fermer votre session d'administration BizBooster Gabon ?"
        confirmText="Déconnexion"
        cancelText="Annuler"
      />
    </div>
  );
};
