import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Database,
  HardDrive,
  Send,
  DownloadCloud,
  Layers,
  Coins,
  TrendingUp,
  RefreshCw,
  Lock,
  EyeOff,
  Save,
  Loader2,
} from 'lucide-react';
import { signOut, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../services/firebase';
import { Ad, AdReport, MainCategory, SubscriptionTier, UserProfile, isUserAdmin, isUserSuperAdmin } from '../types';
import { formatFCFA, formatRemainingTime, getAdTransactionBadge } from '../utils/formatters';
import { isTestAd, MODERATION_PRESET_REASONS, KYC_PRESET_REASONS, TIER_WEIGHTS, isPriorityTier, adBelongsToUser, isValidStorageUrl } from '../utils/ads';
import { getFirebaseQuotaComparison, trackSmsSent, trackDownloadRequest, resetSmsCounters, resetDownloadCounters } from '../services/platformMetrics';
import { RealTimeAnalytics } from './RealTimeAnalytics';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { AppAlertModal, AlertModalConfig } from './AppAlertModal';
import { BizboosterLogo } from './BizboosterLogo';

interface AdminPanelProps {
  currentUser?: UserProfile | null;
  ads: Ad[];
  users?: UserProfile[];
  reports?: AdReport[];
  onApproveAd: (adId: string) => Promise<void> | void;
  onRejectAd: (adId: string, reason: string) => Promise<void> | void;
  onRejectExtension?: (adId: string, reason: string) => Promise<void> | void;
  onDeleteAd: (adId: string) => Promise<void> | void;
  onSelectAdDetail: (ad: Ad) => void;
  onSwitchToFrontend: () => void;
  onToggleExemption?: (userId: string, isExempt: boolean) => Promise<void> | void;
  onApproveKyc?: (userId: string) => Promise<void> | void;
  onRejectKyc?: (userId: string, reason: string) => Promise<void> | void;
  onLogKycView?: (userId: string) => Promise<void> | void;
  onUpdateUserSubscription?: (userId: string, tier: SubscriptionTier) => Promise<void> | void;
  onUpdateUserBoosters?: (userId: string, count: number) => Promise<void> | void;
  onUpdateUserRole?: (userId: string, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN') => Promise<void> | void;
  onResolveReport?: (reportId: string, notes?: string) => Promise<void> | void;
  onDismissReport?: (reportId: string, notes?: string) => Promise<void> | void;
  onDeleteReportedAd?: (adId: string, reportId: string) => Promise<void> | void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  ads,
  users = [],
  reports = [],
  onApproveAd,
  onRejectAd,
  onRejectExtension,
  onDeleteAd,
  onSelectAdDetail,
  onSwitchToFrontend,
  onToggleExemption,
  onApproveKyc,
  onRejectKyc,
  onLogKycView,
  onUpdateUserSubscription,
  onUpdateUserBoosters,
  onUpdateUserRole,
  onResolveReport,
  onDismissReport,
  onDeleteReportedAd,
}) => {
  // S-11 : Garde d'accès stricte dans AdminPanel
  if (!isUserAdmin(currentUser)) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black mb-2">Accès restreint au Cockpit</h1>
        <p className="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
          Votre compte ne dispose pas des privilèges administrateur nécessaires pour accéder à cette interface.
        </p>
        {onSwitchToFrontend && (
          <button
            onClick={onSwitchToFrontend}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all cursor-pointer shadow-md"
          >
            Retourner au site public
          </button>
        )}
      </div>
    );
  }

  const isSuper = isUserSuperAdmin(currentUser);

  // Point 3: SUPER ADMIN one-click option to show or hide all test ads (defaults to false / OFF)
  const [showTestAds, setShowTestAds] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bizbooster_show_test_ads');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

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
        }
      },
      (err) => console.warn('AdminPanel system_config listener error:', err)
    );
    return () => unsub();
  }, []);

  // S-13 : Suppression de la synchronisation de registeredUserIds dans system_config (évite fuite, conflit et limite de 1 MiB)
  // B-04 : Détection de test unifiée et sécurisée via isTestAd (drapeau ad.isTest)
  const testAdsCount = useMemo(
    () => ads.filter(isTestAd).length,
    [ads]
  );
  const [alertModalConfig, setAlertModalConfig] = useState<AlertModalConfig | null>(null);

  const handleToggleTestAds = async () => {
    const nextVal = !showTestAds;
    setShowTestAds(nextVal);
    try {
      localStorage.setItem('bizbooster_show_test_ads', String(nextVal));
      window.dispatchEvent(new CustomEvent('bizbooster_test_ads_toggled', { detail: { showTestAds: nextVal } }));
      await setDoc(doc(db, 'settings', 'public_config'), { showTestAds: nextVal, updatedAt: new Date().toISOString() }, { merge: true });
      await setDoc(doc(db, 'settings', 'system_config'), { showTestAds: nextVal, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Could not persist test ads toggle to Firestore:', e);
    }
  };

  // Active Admin Tab: 'MODERATION' | 'OBSERVATOIRE' | 'ADVERTISERS' | 'REPORTS' | 'SCALABILITY' | 'PAYMENTS'
  const [activeTab, setActiveTab] = useState<'MODERATION' | 'OBSERVATOIRE' | 'ADVERTISERS' | 'REPORTS' | 'SCALABILITY' | 'PAYMENTS'>('MODERATION');

  // Point 4: Métriques temps réel de scalabilité et comparaison quota Firebase Spark/Blaze
  const [metricsTick, setMetricsTick] = useState(0);
  const [liveScalabilityMetrics, setLiveScalabilityMetrics] = useState<{
    smsSentToday?: number;
    smsSentAllTime?: number;
    totalDownloadRequests?: number;
    totalDownloadBandwidthBytes?: number;
  }>({});

  // Configuration Passerelle SingPay Gabon (Phase 2 - Document privé & fonctions appelables)
  const [gatewayConfig, setGatewayConfig] = useState<{
    clientId: string;
    clientSecret: string;
    hasClientSecret: boolean;
    hasWebhookSecret: boolean;
    walletId: string;
    moovDisbursement: string;
    airtelDisbursement: string;
    isLive: boolean;
    updatedAt?: string | null;
    updatedBy?: string | null;
    version?: number;
    webhookUrl?: string;
  }>({
    clientId: '',
    clientSecret: '',
    hasClientSecret: false,
    hasWebhookSecret: false,
    walletId: '',
    moovDisbursement: '',
    airtelDisbursement: '',
    isLive: true,
  });

  const [initialDisbursement, setInitialDisbursement] = useState<{
    moov: string;
    airtel: string;
  }>({ moov: '', airtel: '' });

  const [disbursementConfirmModal, setDisbursementConfirmModal] = useState<{
    isOpen: boolean;
    oldMoov: string;
    newMoov: string;
    oldAirtel: string;
    newAirtel: string;
    confirmInput: string;
  }>({
    isOpen: false,
    oldMoov: '',
    newMoov: '',
    oldAirtel: '',
    newAirtel: '',
    confirmInput: '',
  });

  const [reauthModal, setReauthModal] = useState<{
    isOpen: boolean;
    password: string;
    error: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    password: '',
    error: null,
    loading: false,
  });

  const [rotatedWebhookUrl, setRotatedWebhookUrl] = useState<string | null>(null);
  const [isRotatingSecret, setIsRotatingSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [gatewaySaveSuccess, setGatewaySaveSuccess] = useState(false);

  const loadGatewayConfig = useCallback(async () => {
    if (!isSuper) return;
    try {
      const getCfg = httpsCallable<void, any>(functions, 'getGatewayConfig');
      const res = await getCfg();
      const data = res.data || {};
      setGatewayConfig((prev) => ({
        ...prev,
        clientId: data.clientId || '',
        clientSecret: '',
        hasClientSecret: Boolean(data.hasClientSecret),
        hasWebhookSecret: Boolean(data.hasWebhookSecret),
        walletId: data.walletId || '',
        moovDisbursement: data.moovDisbursement || '',
        airtelDisbursement: data.airtelDisbursement || '',
        isLive: data.isLive ?? true,
        updatedAt: data.updatedAt || null,
        updatedBy: data.updatedBy || null,
        version: data.version || 1,
        webhookUrl: data.webhookUrl || '',
      }));
      setInitialDisbursement({
        moov: data.moovDisbursement || '',
        airtel: data.airtelDisbursement || '',
      });
    } catch (err) {
      console.warn('loadGatewayConfig notice:', err);
    }
  }, [isSuper]);

  useEffect(() => {
    if (isSuper) {
      loadGatewayConfig();
    }
  }, [isSuper, loadGatewayConfig]);

  // Si un non-super admin se retrouve sur l'onglet PAYMENTS, redirection automatique vers MODERATION
  useEffect(() => {
    if (!isSuper && activeTab === 'PAYMENTS') {
      setActiveTab('MODERATION');
    }
  }, [isSuper, activeTab]);

  const executeSaveGatewayConfig = async () => {
    setIsSavingGateway(true);
    try {
      const saveCfg = httpsCallable<any, any>(functions, 'saveGatewayConfig');
      const payload: Record<string, unknown> = {
        walletId: gatewayConfig.walletId.trim(),
        isLive: gatewayConfig.isLive,
      };
      if (gatewayConfig.clientId && !gatewayConfig.clientId.startsWith('••••')) {
        payload.clientId = gatewayConfig.clientId.trim();
      }
      if (gatewayConfig.clientSecret.trim()) {
        payload.clientSecret = gatewayConfig.clientSecret.trim();
      }
      if (gatewayConfig.moovDisbursement.trim()) {
        payload.moovDisbursement = gatewayConfig.moovDisbursement.trim();
      }
      if (gatewayConfig.airtelDisbursement.trim()) {
        payload.airtelDisbursement = gatewayConfig.airtelDisbursement.trim();
      }

      await saveCfg(payload);
      setGatewaySaveSuccess(true);
      setTimeout(() => setGatewaySaveSuccess(false), 4000);
      await loadGatewayConfig();
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('reauth-required') || err?.code === 'failed-precondition') {
        setReauthModal({
          isOpen: true,
          password: '',
          error: null,
          loading: false,
        });
        return;
      }
      setAlertModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erreur',
        message: "Erreur lors de l'enregistrement de la configuration SingPay: " + errMsg,
      });
    } finally {
      setIsSavingGateway(false);
    }
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuper) {
      setAlertModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Accès Refusé',
        message: 'Seul le Super Administrateur est autorisé à configurer les clés de la passerelle de paiement SingPay.',
      });
      return;
    }

    const moovChanged =
      gatewayConfig.moovDisbursement.trim() !== '' &&
      gatewayConfig.moovDisbursement.trim() !== initialDisbursement.moov;
    const airtelChanged =
      gatewayConfig.airtelDisbursement.trim() !== '' &&
      gatewayConfig.airtelDisbursement.trim() !== initialDisbursement.airtel;

    if (moovChanged || airtelChanged) {
      setDisbursementConfirmModal({
        isOpen: true,
        oldMoov: initialDisbursement.moov,
        newMoov: gatewayConfig.moovDisbursement.trim(),
        oldAirtel: initialDisbursement.airtel,
        newAirtel: gatewayConfig.airtelDisbursement.trim(),
        confirmInput: '',
      });
      return;
    }

    await executeSaveGatewayConfig();
  };

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUser) return;
    setReauthModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const email = auth.currentUser.email || `${currentUser.phoneNumber?.replace(/\D/g, '')}@bizbooster.ga`;
      const cred = EmailAuthProvider.credential(email, reauthModal.password);
      await reauthenticateWithCredential(auth.currentUser, cred);
      setReauthModal({ isOpen: false, password: '', error: null, loading: false });
      await executeSaveGatewayConfig();
    } catch (err: any) {
      setReauthModal((prev) => ({
        ...prev,
        loading: false,
        error: 'Mot de passe incorrect ou échec de reconnexion. Veuillez réessayer.',
      }));
    }
  };

  const handleRotateWebhookSecret = async () => {
    if (!isSuper) return;
    setIsRotatingSecret(true);
    try {
      const saveCfg = httpsCallable<any, any>(functions, 'saveGatewayConfig');
      const res = await saveCfg({ rotateWebhookSecret: true });
      if (res.data?.webhookUrl) {
        setRotatedWebhookUrl(res.data.webhookUrl);
      }
      await loadGatewayConfig();
    } catch (err: any) {
      setAlertModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de régénérer le secret de webhook : ' + (err?.message || ''),
      });
    } finally {
      setIsRotatingSecret(false);
    }
  };

  useEffect(() => {
    const handleMetricUpdate = () => setMetricsTick((prev) => prev + 1);
    window.addEventListener('bizbooster_metric_updated', handleMetricUpdate);
    return () => window.removeEventListener('bizbooster_metric_updated', handleMetricUpdate);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system_counters', 'scalability_metrics'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const today = new Date().toISOString().split('T')[0];
          const isToday = data.todayDate === today;
          const todayCount = isToday ? Number(data.smsSentToday) || 0 : 0;
          const allTimeCount = Number(data.smsSentAllTime) || 0;
          const downloadReqCount = Number(data.totalDownloadRequests) || 0;
          const downloadBandwidthBytes = Number(data.totalDownloadBandwidthBytes) || 0;

          setLiveScalabilityMetrics({
            smsSentToday: todayCount,
            smsSentAllTime: allTimeCount,
            totalDownloadRequests: downloadReqCount,
            totalDownloadBandwidthBytes: downloadBandwidthBytes,
          });
          localStorage.setItem('bizbooster_sms_sent_date', today);
          localStorage.setItem('bizbooster_sms_sent_today', String(todayCount));
          localStorage.setItem('bizbooster_sms_sent_all_time', String(allTimeCount));
          localStorage.setItem('bizbooster_download_requests_count', String(downloadReqCount));
          localStorage.setItem('bizbooster_download_bandwidth_bytes', String(downloadBandwidthBytes));
        }
      },
      (err) => {
        console.warn('Live scalability metrics listener error:', err);
      }
    );
    return () => unsub();
  }, []);

  const quotaComparison = useMemo(() => {
    return getFirebaseQuotaComparison(ads, users, liveScalabilityMetrics);
  }, [ads, users, metricsTick, liveScalabilityMetrics]);

  // Moderation filters
  type ModerationStatusFilter = 'PENDING' | 'PRIORITY' | 'ACTIVE' | 'REJECTED' | 'ALL';
  const [statusFilter, setStatusFilter] = useState<ModerationStatusFilter>('PENDING');
  const [categoryFilter, setCategoryFilter] = useState<MainCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Requirement 5: Trier par dans le fichier de modération
  type ModerationSortOption = 'DATE_DESC' | 'DATE_ASC' | 'PRIORITY_TIER' | 'PRICE_DESC' | 'PRICE_ASC' | 'REPORTS_DESC';
  const [moderationSortBy, setModerationSortBy] = useState<ModerationSortOption>('DATE_DESC');

  // Point 4: Advertisers Directory filters & Sort
  type AdvertiserSortOption = 'DATE_DESC' | 'DATE_ASC' | 'NAME_ASC' | 'TIER_DESC' | 'ADS_DESC' | 'REVENUE_DESC';
  const [advSortBy, setAdvSortBy] = useState<AdvertiserSortOption>('DATE_DESC');
  const [advSearchQuery, setAdvSearchQuery] = useState('');
  const [advKycFilter, setAdvKycFilter] = useState<'ALL' | 'EXEMPT' | 'VERIFIED' | 'PENDING' | 'NOT_SUBMITTED' | 'REJECTED'>('ALL');

  // Reports filters (Point 4: Trier par)
  const [reportStatusFilter, setReportStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportSortBy, setReportSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'REPORTS_COUNT' | 'REASON'>('DATE_DESC');

  // Pagination côté client (O-04, O-05 : évite la saturation du DOM sur de grands catalogues)
  const [visibleAdsCount, setVisibleAdsCount] = useState(50);
  const [visibleUsersCount, setVisibleUsersCount] = useState(50);

  // B-11, B-12 : Verrou anti-double clic par identifiant
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Modal states
  const [rejectingAd, setRejectingAd] = useState<Ad | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [customRejectText, setCustomRejectText] = useState('');

  // B-11 : Modal dédié au refus de la prolongation payée (maintient l'annonce ACTIVE)
  const [rejectingExtensionAd, setRejectingExtensionAd] = useState<Ad | null>(null);
  const [extensionRejectReason, setExtensionRejectReason] = useState('Paiement de prolongation non validé ou non conforme.');

  // B-15 : Modal de résolution de signalement avec transmission explicite de notes
  const [resolvingReport, setResolvingReport] = useState<AdReport | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState("Signalement vérifié et traité par l'équipe de modération.");

  // KYC review modal (B-12 : valeur initiale alignée sur KYC_PRESET_REASONS[0])
  const [previewKycUser, setPreviewKycUser] = useState<UserProfile | null>(null);
  const [kycImageLoaded, setKycImageLoaded] = useState(false);
  const [kycImageError, setKycImageError] = useState(false);
  const [rejectingKycUser, setRejectingKycUser] = useState<UserProfile | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState(KYC_PRESET_REASONS[0]);

  // S-14 : Réinitialisation et journalisation de la consultation de pièce d'identité
  useEffect(() => {
    if (previewKycUser) {
      setKycImageLoaded(false);
      setKycImageError(false);
      if (!isValidStorageUrl(previewKycUser.idDocumentUrl)) {
        setKycImageError(true);
      }
      if (onLogKycView) {
        Promise.resolve(onLogKycView(previewKycUser.id)).catch((err) => {
          console.warn('Erreur logKycView:', err);
        });
      }
    }
  }, [previewKycUser?.id, onLogKycView]);

  // I-08 : Constantes déplacées au niveau module dans utils/ads.ts
  const PRESET_REASONS = MODERATION_PRESET_REASONS;

  // O-05 : Debounce de recherche pour fluidifier la saisie sous 50ms
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [debouncedAdvSearchQuery, setDebouncedAdvSearchQuery] = useState(advSearchQuery);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedAdvSearchQuery(advSearchQuery), 200);
    return () => clearTimeout(handler);
  }, [advSearchQuery]);

  useEffect(() => {
    setVisibleAdsCount(50);
  }, [statusFilter, categoryFilter, debouncedSearchQuery, moderationSortBy]);

  useEffect(() => {
    setVisibleUsersCount(50);
  }, [advKycFilter, debouncedAdvSearchQuery, advSortBy]);

  // O-05 : Map utilisateur O(1) pour accélérer la résolution de forfait et d'appartenance
  const userByIdMap = useMemo(() => new Map((users || []).map((u) => [u.id, u])), [users]);

  // Helper to identify priority validation users (Pro, Elite, Business)
  const isAdPriorityUser = useCallback((ad: Ad) => {
    const user = ad.userId ? userByIdMap.get(ad.userId) : undefined;
    const tier = ad.ownerTier || user?.subscriptionTier;
    return isPriorityTier(tier);
  }, [userByIdMap]);

  // S-16 & O-05 : Pré-calcul O(1) des statistiques annonceurs par userId strict
  const userStatsMap = useMemo(() => {
    const map = new Map<string, { totalAds: number; activeAds: number; totalSpent: number }>();
    ads.forEach((a) => {
      if (!a.userId || isTestAd(a)) return;
      const cur = map.get(a.userId) || { totalAds: 0, activeAds: 0, totalSpent: 0 };
      cur.totalAds++;
      if (a.status === 'ACTIVE') cur.activeAds++;
      if (a.paymentVerified || a.status === 'ACTIVE') {
        cur.totalSpent += Number(a.paidAmount) || 0;
      }
      map.set(a.userId, cur);
    });
    return map;
  }, [ads]);

  const getTime = (d?: string | number) => {
    if (!d) return 0;
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
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

      // Point 2 & B-15: Audience & Recettes excluent strictement les tests et annonces rejetées
      if (!isTestAd(ad)) {
        if (ad.paymentVerified || ad.status === 'ACTIVE') {
          totalRevenue += Number(ad.paidAmount) || 0;
        }
        totalViews += Number(ad.viewsCount) || 0;
      }
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
  }, [ads, isAdPriorityUser]);

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

  // Filtered ads in moderation queue with sorting (B-04, O-05)
  const filteredAds = useMemo(() => {
    const list = ads.filter((ad) => {
      const isPending = ad.status === 'PENDING_REVIEW' || !!ad.pendingExtension;
      if (statusFilter === 'PENDING' && !isPending) return false;
      if (statusFilter === 'PRIORITY' && (!isPending || !isAdPriorityUser(ad))) return false;
      if (statusFilter === 'ACTIVE' && ad.status !== 'ACTIVE') return false;
      if (statusFilter === 'REJECTED' && ad.status !== 'REJECTED') return false;

      // Point 3 & B-04: Filtre Super Admin robuste basé sur ad.isTest
      if (isSuper && !showTestAds && isTestAd(ad)) return false;

      if (categoryFilter !== 'ALL' && ad.mainCategory !== categoryFilter) return false;

      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
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
        const userA = a.userId ? userByIdMap.get(a.userId) : undefined;
        const userB = b.userId ? userByIdMap.get(b.userId) : undefined;
        const tierA = a.ownerTier || userA?.subscriptionTier || 'STANDARD';
        const tierB = b.ownerTier || userB?.subscriptionTier || 'STANDARD';
        const diff = (TIER_WEIGHTS[tierB] || 0) - (TIER_WEIGHTS[tierA] || 0);
        if (diff !== 0) return diff;
        return getTime(b.createdAt || b.publishedAt) - getTime(a.createdAt || a.publishedAt);
      }
      if (moderationSortBy === 'DATE_ASC') {
        return getTime(a.createdAt || a.publishedAt) - getTime(b.createdAt || b.publishedAt);
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
      return getTime(b.createdAt || b.publishedAt) - getTime(a.createdAt || a.publishedAt);
    });
  }, [ads, userByIdMap, statusFilter, categoryFilter, debouncedSearchQuery, moderationSortBy, isSuper, showTestAds, isAdPriorityUser]);

  // Registered Advertisers List (grounded in users collection with O(1) userStatsMap)
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      const isExempt = Boolean(u.exemptFromPaymentAndKyc || u.isExempt);
      const kycStatus = u.idVerificationStatus || 'NOT_SUBMITTED';

      if (advKycFilter === 'EXEMPT' && !isExempt) return false;
      if (advKycFilter === 'VERIFIED' && kycStatus !== 'VERIFIED') return false;
      if (advKycFilter === 'PENDING' && kycStatus !== 'PENDING') return false;
      if (advKycFilter === 'NOT_SUBMITTED' && kycStatus !== 'NOT_SUBMITTED') return false;
      if (advKycFilter === 'REJECTED' && kycStatus !== 'REJECTED') return false;

      if (debouncedAdvSearchQuery.trim()) {
        const q = debouncedAdvSearchQuery.toLowerCase();
        const name = (u.name || '').toLowerCase();
        const phone = (u.contactPhone || u.phoneNumber || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (advSortBy === 'DATE_DESC') {
        return getTime(b.createdAt) - getTime(a.createdAt);
      }
      if (advSortBy === 'DATE_ASC') {
        return getTime(a.createdAt) - getTime(b.createdAt);
      }
      if (advSortBy === 'NAME_ASC') {
        return (a.name || '').localeCompare(b.name || '', 'fr-FR');
      }
      if (advSortBy === 'TIER_DESC') {
        const tierRank = (t?: string) => (t === 'BUSINESS' ? 4 : t === 'ELITE' ? 3 : t === 'PRO' ? 2 : 1);
        return tierRank(b.subscriptionTier) - tierRank(a.subscriptionTier);
      }
      if (advSortBy === 'ADS_DESC') {
        const countA = userStatsMap.get(a.id)?.activeAds || 0;
        const countB = userStatsMap.get(b.id)?.activeAds || 0;
        return countB - countA;
      }
      if (advSortBy === 'REVENUE_DESC') {
        const revA = userStatsMap.get(a.id)?.totalSpent || 0;
        const revB = userStatsMap.get(b.id)?.totalSpent || 0;
        return revB - revA;
      }
      return 0;
    });
  }, [users, advKycFilter, debouncedAdvSearchQuery, advSortBy, userStatsMap]);

  // Filtered & Sorted Reports (Point 4: Trier par)
  const filteredReports = useMemo(() => {
    const list = reports.filter((r) => {
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

    return list.sort((a, b) => {
      if (reportSortBy === 'DATE_DESC') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (reportSortBy === 'DATE_ASC') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (reportSortBy === 'REPORTS_COUNT') {
        const adA = ads.find((ad) => ad.id === a.adId);
        const adB = ads.find((ad) => ad.id === b.adId);
        const countA = adA?.reportsCount || 1;
        const countB = adB?.reportsCount || 1;
        return countB - countA;
      }
      if (reportSortBy === 'REASON') {
        return (a.reason || '').localeCompare(b.reason || '');
      }
      return 0;
    });
  }, [reports, reportStatusFilter, reportSearchQuery, reportSortBy, ads]);

  const pendingKycCount = useMemo(
    () => users.filter((u) => u.idVerificationStatus === 'PENDING').length,
    [users]
  );

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const handleAdminLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleApproveAdWithBusy = async (adId: string) => {
    if (busyIds.has(adId)) return;
    setBusy(adId, true);
    try {
      await onApproveAd(adId);
    } catch (err: any) {
      console.error('Erreur approbation:', err);
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: "Échec de l'approbation",
        message: err.message || "Impossible d'approuver cette annonce.",
      });
    } finally {
      setBusy(adId, false);
    }
  };

  const handleConfirmRejectAd = async () => {
    if (!rejectingAd) return;
    const adId = rejectingAd.id;
    if (busyIds.has(adId)) return;
    const finalReason = customRejectText.trim() || rejectReason || 'Non-conformité aux règles de publication.';
    setBusy(adId, true);
    try {
      await onRejectAd(adId, finalReason);
      setRejectingAd(null);
      setRejectReason('');
      setCustomRejectText('');
    } catch (err: any) {
      console.error('Erreur rejet annonce:', err);
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Échec du rejet',
        message: err.message || "Impossible de rejeter cette annonce.",
      });
    } finally {
      setBusy(adId, false);
    }
  };

  const handleConfirmRejectExtension = async () => {
    if (!rejectingExtensionAd || !onRejectExtension) return;
    const adId = rejectingExtensionAd.id;
    if (busyIds.has(adId)) return;
    const finalReason = extensionRejectReason.trim();
    if (!finalReason) return;
    setBusy(adId, true);
    try {
      await onRejectExtension(adId, finalReason);
      setRejectingExtensionAd(null);
    } catch (err: any) {
      console.error('Erreur rejet extension:', err);
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: "Échec du refus de prolongation",
        message: err.message || "Impossible de refuser cette prolongation.",
      });
    } finally {
      setBusy(adId, false);
    }
  };

  const handleApproveKycUser = (u: UserProfile) => {
    if (busyIds.has(u.id)) return;
    setAlertModalConfig({
      isOpen: true,
      type: 'confirm',
      title: "Valider la pièce d'identité (KYC) ?",
      message: `Confirmez-vous l'attribution du statut vérifié pour l'annonceur « ${u.name || u.contactPhone} » ? Le badge Annonceur Vérifié sera immédiatement actif.`,
      onConfirm: async () => {
        setBusy(u.id, true);
        try {
          if (onApproveKyc) await onApproveKyc(u.id);
        } catch (err: any) {
          console.error('Erreur approbation KYC:', err);
          setAlertModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Échec de validation KYC',
            message: err.message || "Impossible de valider la pièce.",
          });
        } finally {
          setBusy(u.id, false);
        }
      },
    });
  };

  const handleConfirmRejectKyc = async () => {
    if (!rejectingKycUser || !onRejectKyc) return;
    const uid = rejectingKycUser.id;
    if (busyIds.has(uid)) return;
    const finalReason = kycRejectionReason.trim();
    if (!finalReason || finalReason.length < 5) {
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Motif insuffisant',
        message: 'Veuillez sélectionner ou renseigner un motif de rejet explicite (minimum 5 caractères).',
      });
      return;
    }
    setBusy(uid, true);
    try {
      await onRejectKyc(uid, finalReason);
      setRejectingKycUser(null);
      setKycRejectionReason(KYC_PRESET_REASONS[0]);
    } catch (err: any) {
      console.error('Erreur rejet KYC:', err);
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Échec du rejet KYC',
        message: err.message || "Impossible de rejeter ce document KYC.",
      });
    } finally {
      setBusy(uid, false);
    }
  };

  const handleToggleExemptionWithConfirm = (userId: string, userName: string, currentExempt: boolean) => {
    if (busyIds.has(userId) || !onToggleExemption) return;
    setAlertModalConfig({
      isOpen: true,
      type: 'confirm',
      title: currentExempt ? 'Révoquer le statut Partenaire VIP ?' : 'Accorder le statut Partenaire VIP ?',
      message: currentExempt
        ? `Voulez-vous révoquer l'exonération des frais de publication pour « ${userName} » ?`
        : `Voulez-vous attribuer l'exonération intégrale des frais de publication pour « ${userName} » ?`,
      onConfirm: async () => {
        setBusy(userId, true);
        try {
          await onToggleExemption(userId, !currentExempt);
        } catch (err: any) {
          setAlertModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erreur exonération',
            message: err.message || "Impossible de modifier l'exonération.",
          });
        } finally {
          setBusy(userId, false);
        }
      },
    });
  };

  const handleUpdateSubscriptionWithConfirm = (userId: string, userName: string, currentTier: string, newTier: SubscriptionTier) => {
    if (busyIds.has(userId) || currentTier === newTier || !onUpdateUserSubscription) return;
    setAlertModalConfig({
      isOpen: true,
      type: 'confirm',
      title: "Modifier l'abonnement partenaire ?",
      message: `Confirmez-vous le passage du compte « ${userName} » de ${currentTier} vers le forfait ${newTier} ?`,
      onConfirm: async () => {
        setBusy(userId, true);
        try {
          await onUpdateUserSubscription(userId, newTier);
        } catch (err: any) {
          setAlertModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erreur abonnement',
            message: err.message || "Impossible de modifier l'abonnement.",
          });
        } finally {
          setBusy(userId, false);
        }
      },
    });
  };

  const handleUpdateBoostersWithBusy = async (userId: string, count: number) => {
    if (busyIds.has(userId) || !onUpdateUserBoosters) return;
    setBusy(userId, true);
    try {
      await onUpdateUserBoosters(userId, count);
    } catch (err: any) {
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Erreur boosters',
        message: err.message || 'Impossible de modifier le solde de boosters.',
      });
    } finally {
      setBusy(userId, false);
    }
  };

  const handleConfirmResolveReport = async () => {
    if (!resolvingReport || !onResolveReport) return;
    const reportId = resolvingReport.id;
    if (busyIds.has(reportId)) return;
    setBusy(reportId, true);
    try {
      await onResolveReport(reportId, resolutionNoteInput.trim());
      setResolvingReport(null);
    } catch (err: any) {
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Erreur résolution',
        message: err.message || 'Impossible de marquer ce signalement comme résolu.',
      });
    } finally {
      setBusy(reportId, false);
    }
  };

  const handleDismissReportWithBusy = async (reportId: string) => {
    if (busyIds.has(reportId) || !onDismissReport) return;
    setBusy(reportId, true);
    try {
      await onDismissReport(reportId, "Signalement classé sans suite après vérification.");
    } catch (err: any) {
      setAlertModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Erreur classement',
        message: err.message || 'Impossible de classer ce signalement.',
      });
    } finally {
      setBusy(reportId, false);
    }
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

            <div className="flex items-center gap-3">
              <BizboosterLogo variant="mark" iconSize={38} className="shrink-0" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 flex-wrap">
                  <span>BIZBOOSTER Gabon</span>
                  <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                    {isSuper ? 'Super Administration' : 'Panneau de Modération'}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5 max-w-2xl">
                  {isSuper
                    ? "Modération complète, gestion des partenaires VIP, forfaits abonnements, attribution des boosters et observatoire du marché."
                    : "Modération des annonces, contrôle d'identité KYC, observatoire marché en direct et traitement des signalements de fraude."}
                </p>
              </div>
            </div>
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
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'SCALABILITY'
                ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Capacité & Scalabilité</span>
            {isSuper && quotaComparison.isAnyQuotaExceeded && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse flex items-center gap-1">
                <span>Dépassement</span>
              </span>
            )}
          </button>

          {/* TAB 6: PASSERELLE SINGPAY (SUPER ADMIN UNIQUEMENT) */}
          {isSuper && (
            <button
              onClick={() => setActiveTab('PAYMENTS')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
                activeTab === 'PAYMENTS'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Passerelle SingPay</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                gatewayConfig.singpayClientId && gatewayConfig.singpayClientSecret
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-amber-400 text-slate-950 animate-pulse'
              }`}>
                {gatewayConfig.singpayClientId && gatewayConfig.singpayClientSecret ? 'Moov Actif' : 'À configurer'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* POINT 4: NOTIFICATION SUPER ADMIN EN CAS DE DÉPASSEMENT DES QUOTAS DU PLAN GRATUIT FIREBASE */}
      {isSuper && quotaComparison.isAnyQuotaExceeded && (
        <div className="bg-linear-to-r from-red-950 via-rose-900 to-amber-950 border-2 border-red-500/70 rounded-3xl p-5 shadow-xl text-white space-y-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-500/20 rounded-2xl text-red-300 border border-red-400/50 shrink-0 mt-0.5">
                <ShieldAlert className="w-6 h-6 text-red-300 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                    Dépassement Quota Firebase Spark
                  </span>
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-400/30">
                    Facturation Blaze Requise
                  </span>
                  <span className="text-[11px] text-slate-300 font-bold">
                    Super Admin Uniquement
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Frais supplémentaires cumulés à régler : ${quotaComparison.totalAccruedCostUSD.toFixed(2)} USD ({quotaComparison.totalAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                </h3>
                <div className="flex flex-wrap gap-2 text-xs text-rose-200 pt-0.5">
                  {quotaComparison.alerts.map((al, idx) => (
                    <span key={idx} className="bg-black/40 px-2 py-0.5 rounded-md border border-white/10 font-medium">
                      ⚠️ {al}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('SCALABILITY')}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-rose-950 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Server className="w-4 h-4 text-rose-700" />
              <span>Consulter l'audit Capacité & Frais</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                  onClick={handleToggleTestAds}
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
              {filteredAds.slice(0, visibleAdsCount).map((ad) => {
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
                          loading="lazy"
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
                          {ad.status === 'ACTIVE' && ad.pendingExtension && (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-2xs">
                              <Clock className="w-3 h-3 text-purple-700" />
                              Extension payée en attente ({ad.pendingExtension.days || 30}j)
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

                          {(() => {
                            const badge = getAdTransactionBadge(ad);
                            return (
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${badge.badgeClass}`}>
                                {badge.label}
                              </span>
                            );
                          })()}

                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-sm">
                            {ad.mainCategory}
                          </span>

                          {(ad.reportsCount ?? 0) > 0 && (
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
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Examiner</span>
                      </button>

                      {/* B-11 : Traitement scindé entre prolongation payée et approbation classique */}
                      {ad.status === 'ACTIVE' && ad.pendingExtension ? (
                        <>
                          <button
                            disabled={busyIds.has(ad.id)}
                            onClick={() => handleApproveAdWithBusy(ad.id)}
                            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                            title="Valider la prolongation et prolonger l'échéance"
                          >
                            <Check className="w-4 h-4" />
                            <span>{busyIds.has(ad.id) ? 'Validation...' : "Valider l'extension"}</span>
                          </button>
                          <button
                            disabled={busyIds.has(ad.id)}
                            onClick={() => setRejectingExtensionAd(ad)}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Refuser la prolongation (l'annonce reste en ligne)"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Refuser l'extension</span>
                          </button>
                          <button
                            disabled={busyIds.has(ad.id)}
                            onClick={() => {
                              setRejectingAd(ad);
                              setRejectReason(PRESET_REASONS[1]);
                            }}
                            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            title="Suspendre l'annonce entière"
                          >
                            Suspendre l'annonce
                          </button>
                        </>
                      ) : isPending ? (
                        <>
                          <button
                            disabled={busyIds.has(ad.id)}
                            onClick={() => handleApproveAdWithBusy(ad.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>{busyIds.has(ad.id) ? 'Approbation...' : 'Approuver & Publier'}</span>
                          </button>

                          <button
                            disabled={busyIds.has(ad.id)}
                            onClick={() => {
                              setRejectingAd(ad);
                              setRejectReason(PRESET_REASONS[0]);
                            }}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rejeter</span>
                          </button>
                        </>
                      ) : isActive ? (
                        <button
                          disabled={busyIds.has(ad.id)}
                          onClick={() => {
                            setRejectingAd(ad);
                            setRejectReason(PRESET_REASONS[1]);
                          }}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Suspendre
                        </button>
                      ) : null}

                      <button
                        disabled={busyIds.has(ad.id)}
                        onClick={() => onDeleteAd(ad.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredAds.length > visibleAdsCount && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setVisibleAdsCount((prev) => prev + 50)}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                  >
                    Charger 50 annonces supplémentaires ({visibleAdsCount} affichées sur {filteredAds.length})
                  </button>
                </div>
              )}
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
              <button
                onClick={() => setAdvKycFilter('REJECTED')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  advKycFilter === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                ✕ KYC Rejetés ({users.filter((u) => u.idVerificationStatus === 'REJECTED').length})
              </button>
              <button
                onClick={() => setAdvKycFilter('NOT_SUBMITTED')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  advKycFilter === 'NOT_SUBMITTED' ? 'bg-slate-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Non soumis ({users.filter((u) => !u.idVerificationStatus || u.idVerificationStatus === 'NOT_SUBMITTED').length})
              </button>
            </div>

            {/* Point 4: Controls for Advertisers: Option Trier par & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Trier par :</span>
                <select
                  value={advSortBy}
                  onChange={(e) => setAdvSortBy(e.target.value as AdvertiserSortOption)}
                  className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="DATE_DESC">Date (Plus récents inscrits)</option>
                  <option value="DATE_ASC">Date (Plus anciens inscrits)</option>
                  <option value="NAME_ASC">Nom (A → Z)</option>
                  <option value="TIER_DESC">⚡ Forfait (Business &gt; Élite &gt; Pro)</option>
                  <option value="ADS_DESC">Volume d'annonces (Actives)</option>
                  <option value="REVENUE_DESC">Dépenses (Total payé)</option>
                </select>
              </div>

              <div className="relative w-full sm:w-60">
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
                  {filteredUsers.slice(0, visibleUsersCount).map((u) => {
                    const isExempt = Boolean(u.exemptFromPaymentAndKyc || u.isExempt);
                    const kycStatus = u.idVerificationStatus || 'NOT_SUBMITTED';

                    // O-05 & S-16: Statistiques O(1) précalculées par userId
                    const userStats = userStatsMap.get(u.id) || { totalAds: 0, activeAds: 0, totalSpent: 0 };
                    const isStaff = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'SUPER ADMIN';

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
                          <span className="font-bold text-slate-900">{userStats.totalAds}</span>
                          <span className="text-slate-400"> ({userStats.activeAds} en ligne)</span>
                        </td>

                        {/* Total Spent */}
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {formatFCFA(userStats.totalSpent)}
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
                                  disabled={busyIds.has(u.id)}
                                  onChange={(e) => handleUpdateSubscriptionWithConfirm(u.id, u.name || u.contactPhone || 'Annonceur', u.subscriptionTier || 'STANDARD', e.target.value as SubscriptionTier)}
                                  className="text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer block disabled:opacity-50"
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
                                    onClick={() => handleUpdateBoostersWithBusy(u.id, Math.max(0, (u.freeBoostsRemaining || 0) - 1))}
                                    disabled={busyIds.has(u.id) || (u.freeBoostsRemaining || 0) <= 0}
                                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs flex items-center justify-center cursor-pointer"
                                    title="Diminuer de 1 booster (Super Admin)"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateBoostersWithBusy(u.id, Math.min(20, (u.freeBoostsRemaining || 0) + 1))}
                                    disabled={busyIds.has(u.id) || (u.freeBoostsRemaining || 0) >= 20}
                                    className="w-6 h-6 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs flex items-center justify-center cursor-pointer border border-emerald-200"
                                    title="Ajouter 1 booster (Super Admin)"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateBoostersWithBusy(u.id, Math.min(20, (u.freeBoostsRemaining || 0) + 5))}
                                    disabled={busyIds.has(u.id) || (u.freeBoostsRemaining || 0) >= 20}
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
                                    onClick={() => {
                                      trackDownloadRequest(2200000);
                                      setPreviewKycUser(u);
                                    }}
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
                                        setAlertModalConfig({
                                          isOpen: true,
                                          type: 'confirm',
                                          title: 'Promouvoir Super Administrateur ?',
                                          message: `Êtes-vous certain de vouloir promouvoir le modérateur "${u.name || u.contactPhone}" en SUPER ADMINISTRATEUR ?\n\nConformément à la règle de gouvernance, un Super Administrateur ne peut plus être rétrogradé depuis cette interface web (toute révocation future devra obligatoirement être réalisée manuellement dans la base de données Firestore).`,
                                          confirmLabel: 'Confirmer la promotion',
                                          cancelLabel: 'Annuler',
                                          onConfirm: () => {
                                            onUpdateUserRole(u.id, 'SUPER_ADMIN');
                                          },
                                        });
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
                                    disabled={busyIds.has(u.id)}
                                    onClick={() => handleToggleExemptionWithConfirm(u.id, u.name || u.contactPhone || 'Annonceur', isExempt)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer disabled:opacity-50 ${
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
                                        disabled={busyIds.has(u.id)}
                                        onClick={() => handleApproveKycUser(u)}
                                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                                        title="Valider la pièce d'identité"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {onRejectKyc && (
                                      <button
                                        disabled={busyIds.has(u.id)}
                                        onClick={() => setRejectingKycUser(u)}
                                        className="p-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
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
              {filteredUsers.length > visibleUsersCount && (
                <div className="text-center p-4 border-t border-slate-100 bg-slate-50/50">
                  <button
                    onClick={() => setVisibleUsersCount((prev) => prev + 50)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                  >
                    Charger 50 annonceurs supplémentaires ({visibleUsersCount} affichés sur {filteredUsers.length})
                  </button>
                </div>
              )}
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

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
              {/* Point 4: Trier par dans Signalement et Fraudes */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Trier par :</span>
                <select
                  value={reportSortBy}
                  onChange={(e) => setReportSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden cursor-pointer"
                  id="admin-reports-sort-select"
                >
                  <option value="DATE_DESC">Date (Plus récent)</option>
                  <option value="DATE_ASC">Date (Plus ancien)</option>
                  <option value="REPORTS_COUNT">Les plus signalés (Annonce)</option>
                  <option value="REASON">Motif (A-Z)</option>
                </select>
              </div>

              <div className="relative w-full sm:w-64">
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
                              disabled={busyIds.has(report.id)}
                              onClick={() => onDeleteReportedAd(report.adId, report.id)}
                              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer l'annonce</span>
                            </button>
                          )}

                          {onResolveReport && (
                            <button
                              disabled={busyIds.has(report.id)}
                              onClick={() => setResolvingReport(report)}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Résoudre</span>
                            </button>
                          )}

                          {onDismissReport && (
                            <button
                              disabled={busyIds.has(report.id)}
                              onClick={() => handleDismissReportWithBusy(report.id)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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

      {/* VIEW 5: SCALABILITY & ARCHITECTURE AUDIT (STRICTLY RESERVED TO SUPER ADMIN FOR FINANCIAL METRICS) */}
      {activeTab === 'SCALABILITY' && (
        <div className="space-y-6">
          {!isSuper ? (
            /* Restriction notice for non-super admins */
            <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-amber-400/30">
                Confidentialité Restreinte
              </span>
              <h3 className="text-xl sm:text-2xl font-black">
                Rubrique Réservée Exclusivement au Super Administrateur
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Les métriques d'infrastructure (nombre de codes SMS OTP distribués, volume stocké dans Firebase Storage, total des requêtes de téléchargement de documents) ainsi que le suivi des coûts et la comparaison avec le plan gratuit Firebase (Spark/Blaze) sont strictement confidentiels.
              </p>
            </div>
          ) : (
            <>
              {/* SECTION 1: SUPER ADMIN INFRASTRUCTURE & BILLING AUDIT */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-100 text-purple-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm">
                        Super Admin · Métriques & Facturation
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                        Temps Réel
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
                      Capacité, Scalabilité & Suivi des Quotas Firebase
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                      Audit en temps réel de la consommation de la plateforme, comparaison avec le forfait gratuit Firebase (Spark) et calcul automatique des frais supplémentaires encourus (Plan Blaze).
                    </p>
                  </div>

                  {/* Manual refresh action */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setMetricsTick((prev) => prev + 1)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
                      title="Rafraîchir les métriques"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                      <span>Actualiser</span>
                    </button>
                  </div>
                </div>

                {/* ACTIVE QUOTA ALERT BANNER FOR SUPER ADMIN */}
                {quotaComparison.isAnyQuotaExceeded && (
                  <div className="bg-linear-to-r from-red-950 via-rose-900 to-amber-950 border-2 border-red-500/80 rounded-2xl p-4 sm:p-5 text-white shadow-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-red-500/20 rounded-xl text-red-300 border border-red-400/40 shrink-0 mt-0.5">
                        <AlertTriangle className="w-5 h-5 text-red-300 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                            Alerte Dépassement Quota Gratuit
                          </span>
                          <span className="text-xs text-amber-300 font-bold">
                            Plan Firebase Spark dépassé
                          </span>
                        </div>
                        <h4 className="text-base font-black text-white">
                          Frais supplémentaires accumulés requis à payer : ${quotaComparison.totalAccruedCostUSD.toFixed(2)} USD ({quotaComparison.totalAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                        </h4>
                        <div className="space-y-1 text-xs text-rose-200 pt-1">
                          {quotaComparison.alerts.map((alertText, idx) => (
                            <p key={idx} className="flex items-center gap-1.5">
                              <span className="text-amber-400 font-black">●</span>
                              <span>{alertText}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* THE 3 RELEVANT METRICS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* METRIC A: SMS OTP CODES SENT */}
                  <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    quotaComparison.isSmsQuotaExceeded
                      ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs">
                          <Send className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">Codes SMS OTP Envoyés</h4>
                          <span className="text-[11px] text-slate-500">Authentification & Sécurité</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm("Réinitialiser le compteur de SMS à 0 ?")) {
                              await resetSmsCounters();
                            }
                          }}
                          className="text-[10px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2 py-0.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
                          title="Remettre le compteur de SMS à zéro"
                        >
                          🔄 Réinitialiser à 0
                        </button>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          quotaComparison.isSmsQuotaExceeded
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {quotaComparison.isSmsQuotaExceeded ? 'Quota Dépassé' : 'Dans le Quota'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Aujourd'hui (Plan Spark : 10 SMS/j inclus)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-3xl font-black ${
                          quotaComparison.isSmsQuotaExceeded ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {quotaComparison.smsSentToday}
                        </p>
                        <span className="text-xs text-slate-500 font-semibold">
                          / {quotaComparison.smsDailyQuota} inclus gratuitement
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100 text-slate-600">
                        <span>Total historique plateforme :</span>
                        <span className="font-extrabold text-slate-900">{quotaComparison.smsSentAllTime} SMS</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Excédent au-delà du quota :</span>
                        <span className={`font-black ${quotaComparison.smsExcessCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {quotaComparison.smsExcessCount > 0 ? `+${quotaComparison.smsExcessCount} SMS` : '0 SMS'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Tarif unitaire excédent :</span>
                        <span className="font-bold text-slate-800">${quotaComparison.smsExtraUnitPriceUSD} USD / SMS</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 font-black text-slate-900">
                        <span>Frais supplémentaires SMS :</span>
                        <span className="text-amber-700">
                          ${quotaComparison.smsAccruedCostUSD.toFixed(2)} USD ({quotaComparison.smsAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Le plan gratuit Spark inclut 10 SMS/jour. À partir du 11ème envoi, Firebase facture $0.21 par SMS supplémentaire délivré (+241).
                    </p>
                  </div>

                  {/* METRIC B: TOTAL STORAGE SIZE */}
                  <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    quotaComparison.isStorageQuotaExceeded
                      ? 'bg-red-50/60 border-red-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-xs">
                          <HardDrive className="w-4 h-4 text-indigo-700" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">Volume Firebase Storage</h4>
                          <span className="text-[11px] text-slate-500">Photos, Vidéos, Fiches & CV</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        quotaComparison.isStorageQuotaExceeded
                          ? 'bg-red-500 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {quotaComparison.isStorageQuotaExceeded ? 'Quota Dépassé' : 'Dans le Quota'}
                      </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Taille Totale Fichiers Stockés
                      </span>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-3xl font-black ${
                          quotaComparison.isStorageQuotaExceeded ? 'text-red-600' : 'text-indigo-600'
                        }`}>
                          {quotaComparison.totalStorageGB >= 1
                            ? `${quotaComparison.totalStorageGB} Go`
                            : `${(quotaComparison.totalStorageBytes / (1024 * 1024)).toFixed(1)} Mo`}
                        </p>
                        <span className="text-xs text-slate-500 font-semibold">
                          / {quotaComparison.storageFreeTierGB} Go inclus
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100 text-slate-600">
                        <span>Taux d'utilisation gratuit :</span>
                        <span className="font-extrabold text-slate-900">
                          {((quotaComparison.totalStorageGB / quotaComparison.storageFreeTierGB) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Excédent au-delà de 5 Go :</span>
                        <span className={`font-black ${quotaComparison.storageExcessGB > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {quotaComparison.storageExcessGB > 0 ? `+${quotaComparison.storageExcessGB} Go` : '0 Go'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Tarif unitaire excédent :</span>
                        <span className="font-bold text-slate-800">${quotaComparison.storageExtraUnitPriceUSD} USD / Go / mois</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 font-black text-slate-900">
                        <span>Frais supplémentaires stockage :</span>
                        <span className="text-indigo-700">
                          ${quotaComparison.storageAccruedCostUSD.toFixed(3)} USD ({quotaComparison.storageAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Comprend les photos d'annonces compressées WebP, vidéos descriptives, fiches de poste employeurs (.pdf, .docx, .md), CV candidats et documents KYC.
                    </p>
                  </div>

                  {/* METRIC C: DOWNLOAD REQUESTS AND BANDWIDTH */}
                  <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    quotaComparison.isDownloadQuotaExceeded
                      ? 'bg-purple-50/60 border-purple-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs">
                          <DownloadCloud className="w-4 h-4 text-purple-700" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">Requêtes Téléchargement</h4>
                          <span className="text-[11px] text-slate-500">Fiches, CV, Médias & Exports</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm("Réinitialiser le compteur de téléchargements et de bande passante à 0 ?")) {
                              await resetDownloadCounters();
                            }
                          }}
                          className="text-[10px] font-bold text-slate-500 hover:text-purple-600 bg-slate-100 hover:bg-purple-50 px-2 py-0.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
                          title="Remettre le compteur de téléchargements à zéro"
                        >
                          🔄 Réinitialiser à 0
                        </button>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          quotaComparison.isDownloadQuotaExceeded
                            ? 'bg-red-500 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {quotaComparison.isDownloadQuotaExceeded ? 'Quota Dépassé' : 'Dans le Quota'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Total Requêtes par les Utilisateurs
                      </span>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-3xl font-black ${
                          quotaComparison.isDownloadQuotaExceeded ? 'text-purple-700' : 'text-slate-900'
                        }`}>
                          {quotaComparison.totalDownloadRequests}
                        </p>
                        <span className="text-xs text-slate-500 font-semibold">
                          / {quotaComparison.downloadFreeTierOpsPerDay.toLocaleString('fr-FR')} req/j
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100 text-slate-600">
                        <span>Bande passante sortante transférée :</span>
                        <span className="font-extrabold text-slate-900">{quotaComparison.totalDownloadBandwidthGB} Go</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Quota gratuit bande passante :</span>
                        <span className="font-bold text-slate-800">{quotaComparison.downloadFreeTierBandwidthGB} Go / jour inclus</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Bande passante excédentaire :</span>
                        <span className={`font-black ${quotaComparison.downloadExcessGB > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {quotaComparison.downloadExcessGB > 0 ? `+${quotaComparison.downloadExcessGB} Go` : '0 Go'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 font-black text-slate-900">
                        <span>Frais supplémentaires bande passante :</span>
                        <span className="text-purple-700">
                          ${quotaComparison.downloadAccruedCostUSD.toFixed(3)} USD ({quotaComparison.downloadAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Comptabilise l'ensemble des clics 'Télécharger fiche de poste', 'Télécharger CV', exports PDF et affichages de médias par les visiteurs.
                    </p>
                  </div>
                </div>

                {/* COMPARATIVE BREAKDOWN TABLE: SPARK (FREE) VS REAL USAGE VS BLAZE (ACCRUED COSTS) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Comparatif Exhaustif : Forfait Gratuit Firebase (Spark) vs Forfait Réel (Blaze)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Détail des seuils gratuits et calcul des frais supplémentaires exigés par Google Cloud / Firebase en cas de dépassement.
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-700 bg-white px-3 py-1 rounded-xl border border-slate-200">
                      Taux : 1 USD = 615 FCFA
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Composant Firebase</th>
                          <th className="py-2.5 px-3">Quota Plan Gratuit (Spark)</th>
                          <th className="py-2.5 px-3">Consommation Réelle</th>
                          <th className="py-2.5 px-3">Dépassement Constaté</th>
                          <th className="py-2.5 px-3">Tarif Unitaire Dépassement</th>
                          <th className="py-2.5 px-3 text-right">Frais Requis à Payer</th>
                          <th className="py-2.5 px-3 text-center">Statut Quota</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                        {/* Row 1: SMS OTP */}
                        <tr className="hover:bg-white/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <Send className="w-3.5 h-3.5 text-amber-600" />
                              <span>Authentification Téléphone (SMS OTP)</span>
                            </div>
                            <span className="text-[10px] text-slate-400">Firebase Phone Auth (+241)</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">10 SMS / jour</td>
                          <td className="py-3 px-3 font-extrabold text-slate-900">{quotaComparison.smsSentToday} SMS aujourd'hui</td>
                          <td className="py-3 px-3">
                            {quotaComparison.smsExcessCount > 0 ? (
                              <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                +{quotaComparison.smsExcessCount} SMS
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">Aucun dépassement</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">$0.21 USD / SMS</td>
                          <td className="py-3 px-3 text-right font-black text-amber-700">
                            ${quotaComparison.smsAccruedCostUSD.toFixed(2)} USD
                            <span className="block text-[10px] text-slate-500 font-normal">
                              ({quotaComparison.smsAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              quotaComparison.isSmsQuotaExceeded
                                ? 'bg-red-500 text-white'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {quotaComparison.isSmsQuotaExceeded ? 'DÉPASSÉ' : 'CONFORME'}
                            </span>
                          </td>
                        </tr>

                        {/* Row 2: Storage */}
                        <tr className="hover:bg-white/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Cloud Storage (Fichiers & Médias)</span>
                            </div>
                            <span className="text-[10px] text-slate-400">Photos, Vidéos, Fiches de poste, CV, KYC</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">5.0 Go inclus</td>
                          <td className="py-3 px-3 font-extrabold text-slate-900">
                            {quotaComparison.totalStorageGB >= 1
                              ? `${quotaComparison.totalStorageGB} Go`
                              : `${(quotaComparison.totalStorageBytes / (1024 * 1024)).toFixed(1)} Mo`}
                          </td>
                          <td className="py-3 px-3">
                            {quotaComparison.storageExcessGB > 0 ? (
                              <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                +{quotaComparison.storageExcessGB} Go
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">Aucun dépassement</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">$0.026 USD / Go / mois</td>
                          <td className="py-3 px-3 text-right font-black text-indigo-700">
                            ${quotaComparison.storageAccruedCostUSD.toFixed(3)} USD
                            <span className="block text-[10px] text-slate-500 font-normal">
                              ({quotaComparison.storageAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              quotaComparison.isStorageQuotaExceeded
                                ? 'bg-red-500 text-white'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {quotaComparison.isStorageQuotaExceeded ? 'DÉPASSÉ' : 'CONFORME'}
                            </span>
                          </td>
                        </tr>

                        {/* Row 3: Downloads & Bandwidth */}
                        <tr className="hover:bg-white/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <DownloadCloud className="w-3.5 h-3.5 text-purple-600" />
                              <span>Requêtes de Téléchargement & Bande Passante</span>
                            </div>
                            <span className="text-[10px] text-slate-400">Téléchargements fiche de poste, CV et transferts</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">
                            50 000 req/j & 1.0 Go/j
                          </td>
                          <td className="py-3 px-3 font-extrabold text-slate-900">
                            {quotaComparison.totalDownloadRequests} req ({quotaComparison.totalDownloadBandwidthGB} Go)
                          </td>
                          <td className="py-3 px-3">
                            {quotaComparison.downloadExcessGB > 0 ? (
                              <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                +{quotaComparison.downloadExcessGB} Go
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">Aucun dépassement</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">$0.12 USD / Go sortant</td>
                          <td className="py-3 px-3 text-right font-black text-purple-700">
                            ${quotaComparison.downloadAccruedCostUSD.toFixed(3)} USD
                            <span className="block text-[10px] text-slate-500 font-normal">
                              ({quotaComparison.downloadAccruedCostFCFA.toLocaleString('fr-FR')} FCFA)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              quotaComparison.isDownloadQuotaExceeded
                                ? 'bg-red-500 text-white'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {quotaComparison.isDownloadQuotaExceeded ? 'DÉPASSÉ' : 'CONFORME'}
                            </span>
                          </td>
                        </tr>
                      </tbody>

                      {/* SUMMARY TOTAL ROW */}
                      <tfoot>
                        <tr className="bg-slate-900 text-white font-black text-xs">
                          <td colSpan={5} className="py-3.5 px-4 rounded-l-xl uppercase tracking-wider text-right">
                            Total Frais Supplémentaires Requis à Payer (Forfait Blaze Firebase) :
                          </td>
                          <td className="py-3.5 px-3 text-right text-amber-300 text-sm">
                            ${quotaComparison.totalAccruedCostUSD.toFixed(2)} USD
                            <span className="block text-[11px] text-emerald-300 font-extrabold">
                              {quotaComparison.totalAccruedCostFCFA.toLocaleString('fr-FR')} FCFA
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center rounded-r-xl">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              quotaComparison.isAnyQuotaExceeded
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-emerald-500 text-white'
                            }`}>
                              {quotaComparison.isAnyQuotaExceeded ? 'ACTION REQUISE' : 'GRATUIT'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ENGINEERING ARCHITECTURE & READ/WRITE SCALABILITY */}
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
            </>
          )}
        </div>
      )}

      {/* VIEW 6: PASSERELLE DE PAIEMENT SINGPAY GABON (SUPER ADMIN UNIQUEMENT) */}
      {activeTab === 'PAYMENTS' && isSuper && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm">
                    Passerelle Officielle Gabon
                  </span>
                  {gatewayConfig.clientId && gatewayConfig.hasClientSecret && gatewayConfig.walletId && gatewayConfig.moovDisbursement ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Moov Actif
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-slate-300 flex items-center gap-1">
                      Moov Inactif
                    </span>
                  )}
                  {gatewayConfig.clientId && gatewayConfig.hasClientSecret && gatewayConfig.walletId && gatewayConfig.airtelDisbursement ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Airtel Actif
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-slate-300 flex items-center gap-1">
                      Airtel Inactif
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                  Passerelle de Paiement SingPay Gabon
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Intégration directe de l'API SingPay pour le prélèvement USSD Push sur mobile. Support officiel de Moov Money (route 62) et Airtel Money (route 74).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="https://client.singpay.ga/doc/reference/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <span>Documentation SingPay</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Status Alert Banner */}
            {gatewayConfig.clientId && gatewayConfig.hasClientSecret && gatewayConfig.walletId ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-emerald-950">Passerelle SingPay opérationnelle</p>
                  <p className="text-emerald-800 leading-relaxed text-[11px]">
                    Les identifiants API sont enregistrés de façon confidentielle sur le serveur.
                    Reversement Moov : <strong>{gatewayConfig.moovDisbursement || 'Non configuré'}</strong> |
                    Reversement Airtel : <strong>{gatewayConfig.airtelDisbursement || 'Non configuré'}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-amber-950">Identifiants API SingPay requis</p>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    Renseignez vos clés fournies par SingPay (Client ID, Client Secret et Wallet ID) ci-dessous pour activer les transactions réelles sur l'application.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Configuration des Clés API SingPay</h3>
                <p className="text-xs text-slate-500">Ces clés sont stockées dans un document fermé et utilisées exclusivement par le serveur Cloud Functions.</p>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {gatewayConfig.updatedAt ? `Dernière modification : ${new Date(gatewayConfig.updatedAt).toLocaleDateString('fr-FR')} par ${gatewayConfig.updatedBy ? gatewayConfig.updatedBy.slice(0, 8) : 'Super Admin'}` : 'Configuration initiale'}
              </span>
            </div>

            {/* Section Webhook */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">URL de Webhook SingPay</span>
                  <span className="text-[11px] text-slate-500">À enregistrer dans la console partenaire SingPay.</span>
                </div>
                <button
                  type="button"
                  disabled={isRotatingSecret}
                  onClick={handleRotateWebhookSecret}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotatingSecret ? 'animate-spin' : ''}`} />
                  <span>Régénérer le secret</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={gatewayConfig.webhookUrl || ''}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (gatewayConfig.webhookUrl) {
                      navigator.clipboard.writeText(gatewayConfig.webhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                >
                  {copiedWebhook ? 'Copié !' : 'Copier'}
                </button>
              </div>
              {rotatedWebhookUrl && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <p className="text-xs font-bold text-amber-900">
                    Nouveau secret généré ! Copiez l'URL complète ci-dessous (affichée une seule fois) :
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={rotatedWebhookUrl}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-amber-950 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(rotatedWebhookUrl);
                        setCopiedWebhook(true);
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveGatewayConfig} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Client ID */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Client ID SingPay (<code className="text-blue-600 lowercase">x-client-id</code>)
                  </label>
                  <input
                    type="text"
                    value={gatewayConfig.clientId}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, clientId: e.target.value })}
                    placeholder="Ex: 9b2d3e4f-..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Identifiant client (masqué une fois enregistré).</span>
                </div>

                {/* Client Secret */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Client Secret SingPay (<code className="text-blue-600 lowercase">x-client-secret</code>)
                  </label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      value={gatewayConfig.clientSecret}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, clientSecret: e.target.value })}
                      placeholder={gatewayConfig.hasClientSecret ? 'Laisser vide pour conserver •••• 1234' : 'Saisir le Client Secret'}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showSecretKey ? 'Masquer' : 'Afficher'}
                    >
                      {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {gatewayConfig.hasClientSecret ? 'Clé secrète enregistrée. Laisser vide pour la conserver.' : 'Clé secrète OAuth 2.0 confidentielle.'}
                  </span>
                </div>

                {/* Wallet ID */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Wallet ID du Portefeuille (<code className="text-blue-600 lowercase">x-wallet</code>)
                  </label>
                  <input
                    type="text"
                    value={gatewayConfig.walletId}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, walletId: e.target.value })}
                    placeholder="Ex: 60a7e4b9c..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">ID du portefeuille sur SingPay (affiché en clair pour vérification).</span>
                </div>

                {/* Moov Money Disbursement Phone */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Numéro Moov Récepteur (<code className="text-blue-600 lowercase">disbursement</code>)
                    </label>
                    {gatewayConfig.moovDisbursement && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.2 rounded-full">
                        Actif
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={gatewayConfig.moovDisbursement}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, moovDisbursement: e.target.value })}
                    placeholder="060, 062, 065 ou 066"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Numéro Moov Money recevant les fonds (préfixes : 60, 62, 65, 66).</span>
                </div>

                {/* Airtel Money Disbursement Phone */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Numéro Airtel Récepteur (<code className="text-red-600 lowercase">disbursement</code>)
                    </label>
                    {gatewayConfig.airtelDisbursement && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.2 rounded-full">
                        Actif
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={gatewayConfig.airtelDisbursement}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, airtelDisbursement: e.target.value })}
                    placeholder="074, 076 ou 077"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Numéro Airtel Money recevant les fonds (préfixes : 74, 76, 77).</span>
                </div>

                {/* Interrupteur Paiements actifs */}
                <div className="space-y-1.5 flex flex-col justify-center">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    État des Paiements
                  </span>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gatewayConfig.isLive}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, isLive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-3 text-xs font-extrabold text-slate-800">
                      {gatewayConfig.isLive ? 'Paiements actifs' : 'Paiements suspendus'}
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-400">Permet de suspendre temporairement les paiements sans effacer les clés.</span>
                </div>
              </div>

              {/* Feedback and submit */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-3">
                <div>
                  {gatewaySaveSuccess && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Configuration SingPay enregistrée avec succès dans Firebase !
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSavingGateway}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                >
                  {isSavingGateway ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSavingGateway ? 'Enregistrement...' : 'Enregistrer la configuration SingPay'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Technical Architecture Details */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-blue-400" />
              <span>Architecture de Sécurité SingPay Gabon</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 space-y-1.5">
                <span className="font-bold text-blue-300 block">1. Document Fermé au Navigateur</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Les identifiants API et secrets de reversement sont stockés dans le document privé Firestore <code>private_config/singpay</code>, inaccessible aux clients web et uniquement géré par le SDK Admin côté Cloud Functions.
                </p>
              </div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 space-y-1.5">
                <span className="font-bold text-emerald-300 block">2. Journalisation d'Audit & Reconnexion</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Chaque modification de clés ou de numéros génère un enregistrement immuable dans <code>gateway_audit</code> (numéros masqués, jamais de secret) et exige une session connectée depuis moins de 10 minutes.
                </p>
              </div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 space-y-1.5">
                <span className="font-bold text-purple-300 block">3. Masquage Strict & Validation</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Le Client Secret ne revient jamais à l'écran du navigateur une fois enregistré. Les numéros sont strictement validés selon les préfixes officiels Moov (60, 62, 65, 66) et Airtel (74, 76, 77).
                </p>
              </div>
            </div>
          </div>

          {/* Modal de Confirmation de changement de numéro marchand */}
          {disbursementConfirmModal.isOpen && (
            <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-600 font-extrabold text-base">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Confirmation de changement de numéro marchand</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Attention : modifier un numéro de reversement redirige l'intégralité des paiements clients collectés vers ce nouveau compte mobile.
                </p>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                  {disbursementConfirmModal.newMoov !== disbursementConfirmModal.oldMoov && (
                    <div>
                      <span className="font-bold text-slate-700 block">Compte Moov Money :</span>
                      <span className="text-slate-400">Ancien : {disbursementConfirmModal.oldMoov ? `•••• •• ${disbursementConfirmModal.oldMoov.slice(-4)}` : 'Non défini'}</span>
                      <span className="text-emerald-700 font-bold block">Nouveau : {disbursementConfirmModal.newMoov}</span>
                    </div>
                  )}
                  {disbursementConfirmModal.newAirtel !== disbursementConfirmModal.oldAirtel && (
                    <div>
                      <span className="font-bold text-slate-700 block">Compte Airtel Money :</span>
                      <span className="text-slate-400">Ancien : {disbursementConfirmModal.oldAirtel ? `•••• •• ${disbursementConfirmModal.oldAirtel.slice(-4)}` : 'Non défini'}</span>
                      <span className="text-emerald-700 font-bold block">Nouveau : {disbursementConfirmModal.newAirtel}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Saisissez <span className="font-mono text-red-600 font-black">CONFIRMER</span> pour valider :
                  </label>
                  <input
                    type="text"
                    value={disbursementConfirmModal.confirmInput}
                    onChange={(e) => setDisbursementConfirmModal({ ...disbursementConfirmModal, confirmInput: e.target.value })}
                    placeholder="CONFIRMER"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisbursementConfirmModal({ isOpen: false, oldMoov: '', newMoov: '', oldAirtel: '', newAirtel: '', confirmInput: '' })}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={disbursementConfirmModal.confirmInput !== 'CONFIRMER'}
                    onClick={async () => {
                      setDisbursementConfirmModal((prev) => ({ ...prev, isOpen: false }));
                      await executeSaveGatewayConfig();
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer"
                  >
                    Confirmer la modification
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Reconnexion récente exigée */}
          {reauthModal.isOpen && (
            <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-600 font-extrabold text-base">
                  <Lock className="w-5 h-5 text-red-600 shrink-0" />
                  <span>Reconnexion de sécurité requise</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Votre dernière connexion date de plus de 10 minutes. Veuillez saisir votre mot de passe pour autoriser la modification critique des clés de paiement.
                </p>
                <form onSubmit={handleReauthSubmit} className="space-y-3">
                  <input
                    type="password"
                    value={reauthModal.password}
                    onChange={(e) => setReauthModal({ ...reauthModal, password: e.target.value })}
                    placeholder="Votre mot de passe"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {reauthModal.error && (
                    <p className="text-xs text-red-600 font-bold">{reauthModal.error}</p>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReauthModal({ isOpen: false, password: '', error: null, loading: false })}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={reauthModal.loading || !reauthModal.password}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer"
                    >
                      {reauthModal.loading ? 'Vérification...' : 'Valider la reconnexion'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
                  placeholder="Ex: Photos non conformes, prix erroné, contenu contraire aux CGU..."
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

      {/* MODAL 2: FULL-SIZE KYC DOCUMENT VIEWER (S-06, S-14) */}
      {previewKycUser && (() => {
        const isStorageSafe = isValidStorageUrl(previewKycUser.idDocumentUrl);
        const kycStatus = (previewKycUser.idVerificationStatus || '').toUpperCase();
        const isPending = kycStatus === 'PENDING';
        const canApprove = isPending && isStorageSafe && kycImageLoaded && !kycImageError && !busyIds.has(previewKycUser.id);

        return (
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
                <div className="bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center p-2 min-h-64 relative">
                  {!isStorageSafe ? (
                    <div className="p-4 text-center text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl max-w-md">
                      <p className="font-bold mb-1">Origine de document non sécurisée (S-14)</p>
                      <p className="text-[11px] text-rose-600">L'URL du document ne provient pas d'un bucket officiel Firebase ou Google Cloud Storage. L'affichage et l'approbation sont bloqués par mesure de sécurité.</p>
                    </div>
                  ) : kycImageError ? (
                    <div className="p-4 text-center text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl max-w-md">
                      <p className="font-bold mb-1">Échec du chargement du document (S-06)</p>
                      <p className="text-[11px] text-rose-600">Impossible de charger la pièce d'identité (erreur réseau, URL expirée ou fichier inaccessible). La validation est strictement conditionnée à la visualisation intégrale du document.</p>
                    </div>
                  ) : (
                    <>
                      {!kycImageLoaded && (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                          <span>Chargement sécurisé du document...</span>
                        </div>
                      )}
                      <img
                        src={previewKycUser.idDocumentUrl}
                        alt="Pièce d'identité"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onLoad={() => setKycImageLoaded(true)}
                        onError={() => setKycImageError(true)}
                        className={`max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm ${!kycImageLoaded ? 'hidden' : 'block'}`}
                      />
                    </>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-wrap justify-between gap-2">
                  <span>
                    Type : <strong>{previewKycUser.idDocumentType || 'CNI'}</strong>
                  </span>
                  <span>
                    Statut : <strong className={kycStatus === 'VERIFIED' ? 'text-emerald-700' : kycStatus === 'REJECTED' ? 'text-red-700' : 'text-amber-700'}>{previewKycUser.idVerificationStatus || 'En attente'}</strong>
                  </span>
                  {previewKycUser.idSubmittedAt && (
                    <span>
                      Transmise le : {new Date(previewKycUser.idSubmittedAt).toLocaleString('fr-FR')}
                    </span>
                  )}
                </div>

                {!isPending && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    Cette pièce d'identité n'est pas en attente (statut actuel : {previewKycUser.idVerificationStatus || 'Inconnu'}). Seules les demandes au statut « PENDING » peuvent être validées.
                  </p>
                )}
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
                  {onRejectKyc && isPending && (
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
                      disabled={!canApprove}
                      onClick={() => {
                        handleApproveKycUser(previewKycUser);
                        setPreviewKycUser(null);
                      }}
                      title={
                        !isPending
                          ? "Le statut de l'utilisateur n'est pas PENDING"
                          : !isStorageSafe
                          ? "L'URL de la pièce n'est pas sécurisée"
                          : kycImageError
                          ? "Le chargement de l'image a échoué"
                          : !kycImageLoaded
                          ? "Attendez le chargement complet du document"
                          : "Valider l'Identité"
                      }
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{busyIds.has(previewKycUser.id) ? 'Traitement...' : "Valider l'Identité"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 1B: REFUSER L'EXTENSION (B-11) */}
      {rejectingExtensionAd && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-base">Refuser la demande d'extension</h3>
              </div>
              <button
                onClick={() => setRejectingExtensionAd(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs text-slate-500">Annonce concernée :</span>
                <p className="font-extrabold text-slate-900 text-sm">{rejectingExtensionAd.title}</p>
                <p className="text-xs text-slate-600 mt-1">
                  💡 <strong>Important :</strong> Le refus de la prolongation ne supprime ni ne suspend l'annonce. Celle-ci restera en ligne jusqu'à son échéance normale.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Motif du refus de l'extension :
                </label>
                <input
                  type="text"
                  value={extensionRejectReason}
                  onChange={(e) => setExtensionRejectReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  placeholder="Ex: Paiement non confirmé, référence introuvable..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingExtensionAd(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busyIds.has(rejectingExtensionAd.id)}
                  onClick={handleConfirmRejectExtension}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {busyIds.has(rejectingExtensionAd.id) ? 'Traitement...' : "Confirmer le refus de prolongation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RESOLUTION DE SIGNALEMENT (B-15) */}
      {resolvingReport && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-slate-900">Résoudre le signalement</h3>
              </div>
              <button onClick={() => setResolvingReport(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Signalement pour l'annonce <strong>« {resolvingReport.adTitle || resolvingReport.adId} »</strong>. Veuillez consigner la note de résolution administrative.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Note de résolution :
              </label>
              <textarea
                value={resolutionNoteInput}
                onChange={(e) => setResolutionNoteInput(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                placeholder="Ex: Contact vendeur vérifié, faux positif, annonce conforme..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResolvingReport(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busyIds.has(resolvingReport.id)}
                onClick={handleConfirmResolveReport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer"
              >
                {busyIds.has(resolvingReport.id) ? 'Enregistrement...' : 'Confirmer la résolution'}
              </button>
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

      {/* Reusable App Alert / Confirm Modal (Point 1) */}
      <AppAlertModal
        config={alertModalConfig}
        onClose={() => setAlertModalConfig(null)}
      />
    </div>
  );
};
