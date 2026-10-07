import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Flame,
  Crown,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Pause,
} from 'lucide-react';
import { Ad, UserProfile } from '../types';
import {
  fetchSeenNotificationIds,
  saveDispatchedNotification,
  getLocalSeenNotificationIds,
  markNotificationAsSeenLocally,
} from '../services/notificationService';

export type NotificationType =
  | 'AD_REJECTED'
  | 'AD_VALIDATED'
  | 'AD_EXPIRING_SOON'
  | 'AD_BOOST_EXPIRED'
  | 'IDENTITY_VERIFIED'
  | 'VIEW_MILESTONE_10'
  | 'VIEW_MILESTONE_100'
  | 'VIEW_MILESTONE_1000'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'QUOTA_EXHAUSTED';

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  adId?: string;
  badgeLabel: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface InAppNotificationModalProps {
  currentUser?: UserProfile | null;
  userAds: Ad[];
  onSelectAdDetail?: (ad: Ad) => void;
  onOpenExtendModal?: (ad: Ad) => void;
  onEditAd?: (ad: Ad) => void;
  onOpenSubscriptions?: () => void;
}

export interface NotificationVisualTheme {
  containerClass: string;
  ringClass: string;
  iconBgClass: string;
  badgeClass: string;
  progressBarClass: string;
  actionBtnClass: string;
  categoryLabel: string;
  icon: React.ReactNode;
}

/**
 * Palettes graphiques distinctives selon la nature de la notification :
 * - Rouge/Rubis pour Rejets & Alertes
 * - Émeraude pour Validations & Publications
 * - Ambre/Orange pour Échéances imminentes
 * - Jaune/Or pour Boosters & Options Vedettes
 * - Cyan/Bleu pour Identité & Sécurité KYC
 * - Paliers d'audience : Ciel (10), Violet Flamme (100), Or Solaire (1000)
 * - Indigo/Pourpre pour Abonnements & Forfaits
 */
export function getNotificationTheme(type: NotificationType): NotificationVisualTheme {
  switch (type) {
    case 'AD_REJECTED':
      return {
        containerClass:
          'bg-gradient-to-b from-rose-950/95 via-slate-900/95 to-slate-950/98 border-rose-500/50',
        ringClass: 'ring-4 ring-rose-500/20 shadow-2xl shadow-rose-950/60',
        iconBgClass: 'bg-rose-950/90 border border-rose-600/80 text-rose-400',
        badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
        progressBarClass: 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-400',
        actionBtnClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50',
        categoryLabel: 'Alerte Modération',
        icon: <XCircle className="w-5 h-5 text-rose-400" />,
      };

    case 'AD_VALIDATED':
      return {
        containerClass:
          'bg-gradient-to-b from-emerald-950/95 via-slate-900/95 to-slate-950/98 border-emerald-500/50',
        ringClass: 'ring-4 ring-emerald-500/20 shadow-2xl shadow-emerald-950/60',
        iconBgClass: 'bg-emerald-950/90 border border-emerald-600/80 text-emerald-400',
        badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
        progressBarClass: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400',
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50',
        categoryLabel: 'Validation & Publication',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      };

    case 'AD_EXPIRING_SOON':
      return {
        containerClass:
          'bg-gradient-to-b from-amber-950/95 via-slate-900/95 to-slate-950/98 border-amber-500/50',
        ringClass: 'ring-4 ring-amber-500/20 shadow-2xl shadow-amber-950/60',
        iconBgClass: 'bg-amber-950/90 border border-amber-600/80 text-amber-400',
        badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
        progressBarClass: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300',
        actionBtnClass: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50',
        categoryLabel: 'Vigilance Délai',
        icon: <Clock className="w-5 h-5 text-amber-400" />,
      };

    case 'AD_BOOST_EXPIRED':
      return {
        containerClass:
          'bg-gradient-to-b from-yellow-950/95 via-slate-900/95 to-slate-950/98 border-yellow-400/60',
        ringClass: 'ring-4 ring-yellow-400/20 shadow-2xl shadow-yellow-950/60',
        iconBgClass: 'bg-yellow-950/90 border border-yellow-500/80 text-yellow-300',
        badgeClass: 'bg-yellow-400/20 text-yellow-200 border-yellow-400/40',
        progressBarClass: 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300',
        actionBtnClass:
          'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black shadow-yellow-950/50',
        categoryLabel: 'Option Booster',
        icon: <Sparkles className="w-5 h-5 text-yellow-300" />,
      };

    case 'IDENTITY_VERIFIED':
      return {
        containerClass:
          'bg-gradient-to-b from-cyan-950/95 via-slate-900/95 to-slate-950/98 border-cyan-500/50',
        ringClass: 'ring-4 ring-cyan-500/20 shadow-2xl shadow-cyan-950/60',
        iconBgClass: 'bg-cyan-950/90 border border-cyan-600/80 text-cyan-400',
        badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
        progressBarClass: 'bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-200',
        actionBtnClass: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50',
        categoryLabel: 'Sécurité & Confiance KYC',
        icon: <ShieldCheck className="w-5 h-5 text-cyan-400" />,
      };

    case 'VIEW_MILESTONE_10':
      return {
        containerClass:
          'bg-gradient-to-b from-sky-950/95 via-slate-900/95 to-slate-950/98 border-sky-500/50',
        ringClass: 'ring-4 ring-sky-500/20 shadow-2xl shadow-sky-950/60',
        iconBgClass: 'bg-sky-950/90 border border-sky-600/80 text-sky-400',
        badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
        progressBarClass: 'bg-gradient-to-r from-sky-400 to-blue-500',
        actionBtnClass: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/50',
        categoryLabel: 'Palier d\'Audience',
        icon: <TrendingUp className="w-5 h-5 text-sky-400" />,
      };

    case 'VIEW_MILESTONE_100':
      return {
        containerClass:
          'bg-gradient-to-b from-purple-950/95 via-slate-900/95 to-slate-950/98 border-purple-500/50',
        ringClass: 'ring-4 ring-purple-500/20 shadow-2xl shadow-purple-950/60',
        iconBgClass: 'bg-purple-950/90 border border-purple-600/80 text-purple-400',
        badgeClass: 'bg-purple-500/20 text-purple-200 border-purple-500/40',
        progressBarClass: 'bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500',
        actionBtnClass: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/50',
        categoryLabel: 'Affluence Forte 🔥',
        icon: <Flame className="w-5 h-5 text-purple-400" />,
      };

    case 'VIEW_MILESTONE_1000':
      return {
        containerClass:
          'bg-gradient-to-b from-amber-950/95 via-yellow-950/40 to-slate-950/98 border-amber-300/70',
        ringClass: 'ring-4 ring-amber-400/25 shadow-2xl shadow-amber-950/60',
        iconBgClass: 'bg-amber-950/90 border border-amber-500/80 text-amber-300',
        badgeClass: 'bg-amber-400/25 text-amber-200 border-amber-400/50',
        progressBarClass: 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-200',
        actionBtnClass:
          'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black shadow-amber-950/50',
        categoryLabel: 'Record de Vues 🌟',
        icon: <Sparkles className="w-5 h-5 text-amber-300" />,
      };

    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return {
        containerClass:
          'bg-gradient-to-b from-indigo-950/95 via-purple-950/40 to-slate-950/98 border-indigo-400/50',
        ringClass: 'ring-4 ring-indigo-400/20 shadow-2xl shadow-indigo-950/60',
        iconBgClass: 'bg-indigo-950/90 border border-indigo-600/80 text-indigo-300',
        badgeClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
        progressBarClass: 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400',
        actionBtnClass:
          'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black shadow-indigo-950/50',
        categoryLabel: 'Abonnement & Forfait',
        icon: <Crown className="w-5 h-5 text-indigo-300" />,
      };

    case 'QUOTA_EXHAUSTED':
    default:
      return {
        containerClass:
          'bg-gradient-to-b from-stone-900/95 via-rose-950/60 to-slate-950/98 border-rose-400/50',
        ringClass: 'ring-4 ring-rose-400/20 shadow-2xl shadow-rose-950/60',
        iconBgClass: 'bg-rose-950/90 border border-rose-700/80 text-rose-300',
        badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
        progressBarClass: 'bg-gradient-to-r from-rose-400 to-orange-400',
        actionBtnClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50',
        categoryLabel: 'Quota & Limite',
        icon: <AlertTriangle className="w-5 h-5 text-rose-300" />,
      };
  }
}

const MAX_DURATION_MS = 30000; // Plafond maximal de 30 secondes (au lieu de 6s)

export const InAppNotificationModal: React.FC<InAppNotificationModalProps> = ({
  currentUser,
  userAds,
  onSelectAdDetail,
  onOpenExtendModal,
  onEditAd,
  onOpenSubscriptions,
}) => {
  const [activeNotification, setActiveNotification] = useState<InAppNotification | null>(null);
  const [remainingTimeMs, setRemainingTimeMs] = useState<number>(MAX_DURATION_MS);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isSyncComplete, setIsSyncComplete] = useState<boolean>(false);

  // File d'attente et contrôle des états
  const queueRef = useRef<InAppNotification[]>([]);
  const isWaitingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialisation synchrone immédiate depuis localStorage + currentUser (0ms, aucun délai réseau)
  const getInitialSeenIds = (): Set<string> => {
    const set = new Set<string>();
    if (currentUser?.id) {
      const local = getLocalSeenNotificationIds(currentUser.id);
      local.forEach((id) => set.add(id));
      if (Array.isArray(currentUser.seenNotificationIds)) {
        currentUser.seenNotificationIds.forEach((id) => set.add(id));
      }
    }
    return set;
  };

  const seenIdsRef = useRef<Set<string>>(getInitialSeenIds());

  // 1. Initialisation : synchronisation des IDs vus depuis Firestore + cache local
  useEffect(() => {
    if (!currentUser?.id) {
      setIsSyncComplete(true);
      return;
    }

    // Réinjection synchrone immédiate au cas où currentUser vient d'arriver
    const local = getLocalSeenNotificationIds(currentUser.id);
    local.forEach((id) => seenIdsRef.current.add(id));
    if (Array.isArray(currentUser.seenNotificationIds)) {
      currentUser.seenNotificationIds.forEach((id) => seenIdsRef.current.add(id));
    }

    let isCancelled = false;
    fetchSeenNotificationIds(currentUser.id)
      .then((remoteIds) => {
        if (!isCancelled) {
          remoteIds.forEach((id) => seenIdsRef.current.add(id));
          setIsSyncComplete(true);
        }
      })
      .catch((err) => {
        console.warn('[InAppNotificationModal] Erreur remote sync:', err);
        if (!isCancelled) {
          setIsSyncComplete(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.id]);

  // 2. Traitement de la notification suivante
  const processNextNotification = () => {
    if (activeNotification || isWaitingRef.current || queueRef.current.length === 0) {
      return;
    }

    const next = queueRef.current.shift();
    if (next) {
      // Verrouillage immédiat dès la prise en charge
      seenIdsRef.current.add(next.id);
      if (currentUser?.id) {
        markNotificationAsSeenLocally(currentUser.id, next.id);
        saveDispatchedNotification(currentUser.id, next);
      }
      setActiveNotification(next);
      setRemainingTimeMs(MAX_DURATION_MS);
      setIsHovered(false);
    }
  };

  // 3. Fermeture de la notification active
  const dismissActive = () => {
    if (!activeNotification) return;

    const notifToClose = activeNotification;
    setActiveNotification(null);
    setRemainingTimeMs(MAX_DURATION_MS);
    setIsHovered(false);

    // Sauvegarde immédiate et persistante dans Firebase pour zéro répétition
    if (currentUser?.id) {
      markNotificationAsSeenLocally(currentUser.id, notifToClose.id);
      saveDispatchedNotification(currentUser.id, notifToClose);
    }

    // Intervalle respiratoire de 2 secondes avant la notification suivante (si la file n'est pas vide)
    if (queueRef.current.length > 0) {
      isWaitingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        isWaitingRef.current = false;
        processNextNotification();
      }, 2000);
    }
  };

  // 3b. Nettoyage immédiat : si une annonce a été modifiée ou n'est plus REJECTED, purger immédiatement toute notification de rejet active ou en file
  useEffect(() => {
    if (!currentUser?.id || !userAds) return;

    // Purger de la file d'attente les notifications des annonces qui ne sont plus à l'état REJECTED
    queueRef.current = queueRef.current.filter((notif) => {
      if (notif.type === 'AD_REJECTED' && notif.adId) {
        const matchingAd = userAds.find((a) => a.id === notif.adId);
        if (matchingAd && matchingAd.status !== 'REJECTED') {
          return false;
        }
      }
      return true;
    });

    // Fermer immédiatement la notification active si elle affiche le rejet d'une annonce qui n'est plus REJECTED
    if (activeNotification?.type === 'AD_REJECTED' && activeNotification.adId) {
      const matchingAd = userAds.find((a) => a.id === activeNotification.adId);
      if (matchingAd && matchingAd.status !== 'REJECTED') {
        setActiveNotification(null);
        setRemainingTimeMs(MAX_DURATION_MS);
        setIsHovered(false);
      }
    }
  }, [userAds, currentUser?.id, activeNotification]);

  // 4. Analyse et génération des notifications en attente (uniquement après synchronisation complète)
  useEffect(() => {
    if (!isSyncComplete || !currentUser?.id) return;
    const now = Date.now();
    const candidateNotifications: InAppNotification[] = [];

    const isAlreadyKnown = (id: string) => {
      if (!id) return true;
      if (seenIdsRef.current.has(id)) return true;
      if (currentUser?.seenNotificationIds?.includes(id)) {
        seenIdsRef.current.add(id);
        return true;
      }
      if (currentUser?.id) {
        const local = getLocalSeenNotificationIds(currentUser.id);
        if (local.has(id)) {
          seenIdsRef.current.add(id);
          return true;
        }
      }
      if (activeNotification?.id === id) return true;
      return queueRef.current.some((n) => n.id === id);
    };

    for (const ad of userAds) {
      const createdAtMs = new Date(ad.createdAt || 0).getTime() || now;
      const updatedAtMs = new Date(ad.updatedAt || ad.createdAt || 0).getTime() || now;

      // 1. Annonce rejetée (notifId stable basé sur moderatedAt pour ne pas re-déclencher après modification par l'utilisateur)
      if (ad.status === 'REJECTED') {
        const rejectionKey = ad.moderatedAt || ad.createdAt || 'rejected';
        const notifId = `rej_${ad.id}_${rejectionKey}`;
        if (!isAlreadyKnown(notifId)) {
          const reason = ad.moderationReason || (ad as any).rejectionReason;
          candidateNotifications.push({
            id: notifId,
            type: 'AD_REJECTED',
            title: 'Annonce non validée par la modération',
            message: `Votre annonce « ${ad.title} » n'a pas été validée. ${
              reason
                ? `Motif : ${reason}`
                : 'Veuillez vérifier et corriger les critères de conformité.'
            }`,
            timestamp: updatedAtMs,
            adId: ad.id,
            badgeLabel: 'Rejetée',
            actionLabel: 'Corriger l\'annonce',
            onAction: () => onEditAd && onEditAd(ad),
          });
        }
      }

      // 2. Annonce validée (création initiale ou revalidation suite à des modifications de l'annonceur)
      if (ad.status === 'ACTIVE') {
        const isModified = Boolean(ad.updatedAt);
        const modTimeMs = ad.moderatedAt ? new Date(ad.moderatedAt).getTime() : 0;
        const updateTimeMs = ad.updatedAt ? new Date(ad.updatedAt).getTime() : 0;
        const isValidationAfterEdit = isModified && (modTimeMs === 0 || modTimeMs >= updateTimeMs - 10000);

        if (isValidationAfterEdit) {
          // Validation suite à des modifications apportées par l'annonceur
          const validationKey = ad.moderatedAt || ad.updatedAt || 'edit';
          const notifId = `val_edit_${ad.id}_${validationKey}`;
          const validationTimeMs = modTimeMs || updateTimeMs || now;
          const isRecent = now - validationTimeMs <= 7 * 24 * 3600 * 1000;

          if (isRecent && !isAlreadyKnown(notifId)) {
            // Verrouiller également l'ID initial pour éviter tout conflit
            seenIdsRef.current.add(`val_${ad.id}`);

            candidateNotifications.push({
              id: notifId,
              type: 'AD_VALIDATED',
              title: 'Modifications validées & en ligne !',
              message: `Vos modifications sur l'annonce « ${ad.title} » ont été vérifiées et approuvées par la modération. Votre annonce est de nouveau visible par tous les acheteurs au Gabon.`,
              timestamp: validationTimeMs,
              adId: ad.id,
              badgeLabel: 'Modifiée & Validée ✓',
              actionLabel: 'Voir l\'annonce',
              onAction: () => onSelectAdDetail && onSelectAdDetail(ad),
            });
          }
        } else {
          // Validation initiale lors de la première publication
          const publishedMs = new Date(ad.publishedAt || ad.createdAt || 0).getTime() || createdAtMs;
          const isRecent = now - publishedMs <= 7 * 24 * 3600 * 1000;
          const notifId = `val_${ad.id}`;

          if (isRecent && !isAlreadyKnown(notifId)) {
            candidateNotifications.push({
              id: notifId,
              type: 'AD_VALIDATED',
              title: 'Annonce validée & en ligne !',
              message: `Votre annonce « ${ad.title} » est approuvée et visible par tous les acheteurs au Gabon.`,
              timestamp: publishedMs,
              adId: ad.id,
              badgeLabel: 'En Ligne',
              actionLabel: 'Voir l\'annonce',
              onAction: () => onSelectAdDetail && onSelectAdDetail(ad),
            });
          }
        }
      }

      // 3. Annonce expirant bientôt (< 24h restantes)
      if (ad.status === 'ACTIVE' && ad.expiresAt) {
        const expMs = new Date(ad.expiresAt).getTime();
        const diffMs = expMs - now;
        if (diffMs > 0 && diffMs <= 24 * 3600 * 1000) {
          const expDateStr = new Date(ad.expiresAt).toISOString().split('T')[0];
          const notifId = `exp_soon_${ad.id}_${expDateStr}`;
          if (!isAlreadyKnown(notifId)) {
            const hoursLeft = Math.max(1, Math.floor(diffMs / (3600 * 1000)));
            candidateNotifications.push({
              id: notifId,
              type: 'AD_EXPIRING_SOON',
              title: 'Annonce bientôt expirée (< 24h)',
              message: `Votre annonce « ${ad.title} » expire dans ${hoursLeft} heure(s). Prolongez-la pour rester visible.`,
              timestamp: expMs - 24 * 3600 * 1000,
              adId: ad.id,
              badgeLabel: 'Dernières 24h',
              actionLabel: 'Prolonger',
              onAction: () => onOpenExtendModal && onOpenExtendModal(ad),
            });
          }
        }
      }

      // 4. Boost « En Tête de Liste » arrivé à terme
      if (ad.featuredUntil) {
        const featExpMs = new Date(ad.featuredUntil).getTime();
        if (featExpMs <= now) {
          const notifId = `boost_exp_${ad.id}_${ad.featuredUntil}`;
          if (!isAlreadyKnown(notifId)) {
            candidateNotifications.push({
              id: notifId,
              type: 'AD_BOOST_EXPIRED',
              title: 'Boost « En Tête » arrivé à terme',
              message: `L'option En Tête de Liste pour votre annonce « ${ad.title} » est terminée. Vous pouvez la réactiver à tout moment.`,
              timestamp: featExpMs,
              adId: ad.id,
              badgeLabel: 'Boost Terminé',
              actionLabel: 'Rebooster',
              onAction: () => onSelectAdDetail && onSelectAdDetail(ad),
            });
          }
        }
      }

      // 5. Paliers de vues (On ne retient que le jalon le plus élevé atteint pour éviter le spam)
      const views = ad.viewsCount || 0;
      if (views >= 1000) {
        const notifId = `view_1000_${ad.id}`;
        if (!isAlreadyKnown(notifId)) {
          candidateNotifications.push({
            id: notifId,
            type: 'VIEW_MILESTONE_1000',
            title: 'Événement exceptionnel : 1 000 vues !',
            message: `Forte affluence ! Votre annonce « ${ad.title} » a franchi le cap des 1 000 consultations.`,
            timestamp: createdAtMs + 14400000,
            adId: ad.id,
            badgeLabel: '1 000 Vues 🌟',
            actionLabel: 'Voir les stats',
            onAction: () => onSelectAdDetail && onSelectAdDetail(ad),
          });
        }
      } else if (views >= 100) {
        const notifId = `view_100_${ad.id}`;
        if (!isAlreadyKnown(notifId)) {
          candidateNotifications.push({
            id: notifId,
            type: 'VIEW_MILESTONE_100',
            title: 'Cap franchi : 100 consultations !',
            message: `Succès remarquable ! Votre annonce « ${ad.title} » a dépassé les 100 vues sur la plateforme.`,
            timestamp: createdAtMs + 7200000,
            adId: ad.id,
            badgeLabel: '100 Vues 🔥',
            actionLabel: 'Voir les stats',
            onAction: () => onSelectAdDetail && onSelectAdDetail(ad),
          });
        }
      } else if (views >= 10) {
        const notifId = `view_10_${ad.id}`;
        if (!isAlreadyKnown(notifId)) {
          candidateNotifications.push({
            id: notifId,
            type: 'VIEW_MILESTONE_10',
            title: 'Palier franchi : 10 consultations !',
            message: `Votre annonce « ${ad.title} » vient d'atteindre ses 10 premières consultations. L'intérêt commence !`,
            timestamp: createdAtMs + 3600000,
            adId: ad.id,
            badgeLabel: '10 Vues',
            actionLabel: 'Voir les stats',
            onAction: () => onSelectAdDetail && onSelectAdDetail(ad),
          });
        }
      }
    }

    // 6. Identité vérifiée (KYC validé)
    if (currentUser.isKycVerified || currentUser.idVerificationStatus === 'VERIFIED') {
      const notifId = `kyc_verified_${currentUser.id}`;
      if (!isAlreadyKnown(notifId)) {
        candidateNotifications.push({
          id: notifId,
          type: 'IDENTITY_VERIFIED',
          title: 'Identité validée avec succès !',
          message:
            'Félicitations, votre pièce d\'identité a été validée. Le badge de confiance « Annonceur Vérifié » est actif sur votre profil et vos annonces.',
          timestamp: now - 3600000,
          badgeLabel: 'Vérifié ✓',
        });
      }
    }

    // 7. Abonnement s'apprête à expirer (< 3 jours)
    if (
      currentUser.subscriptionExpiresAt &&
      currentUser.subscriptionTier &&
      currentUser.subscriptionTier !== 'STANDARD'
    ) {
      const subExpMs = new Date(currentUser.subscriptionExpiresAt).getTime();
      const diffMs = subExpMs - now;
      if (diffMs > 0 && diffMs <= 3 * 24 * 3600 * 1000) {
        const notifId = `sub_exp_${currentUser.subscriptionTier}_${currentUser.subscriptionExpiresAt}`;
        if (!isAlreadyKnown(notifId)) {
          const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 3600 * 1000)));
          candidateNotifications.push({
            id: notifId,
            type: 'SUBSCRIPTION_EXPIRING',
            title: 'Votre forfait s\'apprête à expirer',
            message: `Votre abonnement ${currentUser.subscriptionTier} expire dans ${daysLeft} jour(s). Renouvelez-le pour préserver vos avantages.`,
            timestamp: subExpMs - 3 * 24 * 3600 * 1000,
            badgeLabel: 'Forfait Proche Expiration',
            actionLabel: 'Renouveler',
            onAction: () => onOpenSubscriptions && onOpenSubscriptions(),
          });
        }
      }
    }

    // Tri chronologique des notifications à injecter
    candidateNotifications.sort((a, b) => a.timestamp - b.timestamp);

    if (candidateNotifications.length > 0) {
      // Verrouillage IMMÉDIAT des IDs (en mémoire, localement et sur Firebase)
      candidateNotifications.forEach((n) => {
        seenIdsRef.current.add(n.id);
        if (currentUser.id) {
          markNotificationAsSeenLocally(currentUser.id, n.id);
          saveDispatchedNotification(currentUser.id, n);
        }
      });

      queueRef.current = [...queueRef.current, ...candidateNotifications];
      processNextNotification();
    }
  }, [isSyncComplete, currentUser?.id, userAds]);

  // 5. Compte à rebours sécurisé plafonné à 30 secondes avec pause au survol
  useEffect(() => {
    if (!activeNotification) return;

    const intervalStep = 100; // Rafraîchissement tous les 100ms
    const timer = setInterval(() => {
      setRemainingTimeMs((prev) => {
        if (isHovered) {
          return prev; // Maintien du timer en pause tant que l'utilisateur lit
        }
        if (prev <= intervalStep) {
          clearInterval(timer);
          dismissActive();
          return 0;
        }
        return prev - intervalStep;
      });
    }, intervalStep);

    return () => clearInterval(timer);
  }, [activeNotification, isHovered]);

  const handleAction = () => {
    if (activeNotification?.onAction) {
      activeNotification.onAction();
    }
    dismissActive();
  };

  if (!activeNotification) return null;

  const theme = getNotificationTheme(activeNotification.type);
  const secondsLeft = Math.max(1, Math.ceil(remainingTimeMs / 1000));
  const progressPercent = Math.max(0, Math.min(100, (remainingTimeMs / MAX_DURATION_MS) * 100));

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg px-3 sm:px-4 select-none animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto"
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <div
        className={`backdrop-blur-xl text-white rounded-2xl border overflow-hidden transition-all duration-300 ${theme.containerClass} ${theme.ringClass}`}
      >
        <div className="p-4 sm:p-5 relative">
          <div className="flex items-start gap-3.5">
            {/* Icône thématique distinctive */}
            <div
              className={`w-11 h-11 rounded-2xl ${theme.iconBgClass} flex items-center justify-center shrink-0 shadow-inner`}
            >
              {theme.icon}
            </div>

            {/* Contenu textuel */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${theme.badgeClass}`}
                >
                  {activeNotification.badgeLabel}
                </span>

                <span className="text-[10px] text-slate-300 font-semibold tracking-wide">
                  {theme.categoryLabel}
                </span>

                {/* Indicateur de délai de lecture (30s) avec pause */}
                {isHovered ? (
                  <span className="text-[10px] bg-slate-800/90 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs animate-pulse">
                    <Pause className="w-2.5 h-2.5" />
                    <span>Lecture en pause</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-800/80 text-slate-300 border border-white/10 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{secondsLeft}s</span>
                  </span>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-black text-white leading-snug">
                {activeNotification.title}
              </h4>

              <p className="text-xs text-slate-200 mt-1 leading-relaxed whitespace-pre-line">
                {activeNotification.message}
              </p>

              {/* Bouton d'action contextuel personnalisé */}
              {activeNotification.actionLabel && (
                <div className="mt-3.5">
                  <button
                    onClick={handleAction}
                    className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer hover:scale-102 ${theme.actionBtnClass}`}
                  >
                    <span>{activeNotification.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Bouton de fermeture manuelle immédiate */}
            <button
              onClick={dismissActive}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="Fermer la notification (compte à rebours 30s)"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barre de progression fluide (Plafond 30 secondes max) */}
        <div className="h-1.5 bg-slate-950/80 w-full overflow-hidden">
          <div
            className={`h-full transition-all ease-linear ${theme.progressBarClass}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
