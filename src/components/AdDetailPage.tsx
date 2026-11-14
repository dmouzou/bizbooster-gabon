import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Share2,
  Heart,
  MapPin,
  Clock,
  Calendar,
  ShieldCheck,
  Flag,
  MessageCircle,
  Phone,
  Eye,
  Crown,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  X,
  Maximize2,
} from 'lucide-react';
import { Ad, UserProfile } from '../types';
import {
  formatAdPrice,
  formatPriceUnit,
  formatRemainingTime,
  getWhatsAppUrl,
  getAdTransactionBadge,
  isAdOwner,
  formatEventDate,
  getPriceOrSalaryLabel,
  isJobAd,
} from '../utils/formatters';
import { isAdVipCornerEligible } from '../utils/vipCorner';
import { isValidStorageUrl } from '../utils/ads';
import { Pill } from './ui/Pill';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { ShareAdModal } from './ShareAdModal';
import { ReportAdModal } from './ReportAdModal';
import { VerifiedAdvertiserModal } from './VerifiedAdvertiserModal';
import { trackDownloadRequest } from '../services/platformMetrics';

export interface AdDetailPageProps {
  ad: Ad;
  onClose: () => void;
  onOpenExtendModal: (ad: Ad) => void;
  onEditAd?: (ad: Ad) => void;
  currentUser?: UserProfile | null;
  isFavorite?: boolean;
  onToggleFavorite?: (adId: string) => void;
}

const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' width='400' height='250'%3E%3Crect width='100%25' height='100%25' fill='%23DCE3EA'/%3E%3Cpath d='M180 110l20 25 15-18 25 33h-80z' fill='%2394A3B8'/%3E%3Ccircle cx='185' cy='95' r='8' fill='%2394A3B8'/%3E%3C/svg%3E";

export const AdDetailPage: React.FC<AdDetailPageProps> = ({
  ad,
  onClose,
  onOpenExtendModal,
  onEditAd,
  currentUser,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const images = useMemo(() => {
    if (!ad?.images || !Array.isArray(ad.images) || ad.images.length === 0) {
      return [FALLBACK_SVG];
    }
    const valid = ad.images.filter((img) => isValidStorageUrl(img) || img.startsWith('data:'));
    return valid.length > 0 ? valid : [FALLBACK_SVG];
  }, [ad?.images]);

  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);
  const isOwner = isAdOwner(ad, currentUser);
  const isVerified = Boolean(ad.isOwnerVerified || ad.isOwnerVip);
  const isVip = isAdVipCornerEligible(ad);
  const isNecrologie = ad.mainCategory === 'NECROLOGIE';
  const isAvisRecherche = ad.mainCategory === 'AVIS_DE_RECHERCHE';
  const isEvenement = ad.mainCategory === 'EVENEMENTS' && !!ad.eventData;

  const handleGalleryScroll = () => {
    if (!galleryRef.current) return;
    const { scrollLeft, clientWidth } = galleryRef.current;
    const index = Math.round(scrollLeft / clientWidth);
    if (index !== activeImageIndex && index >= 0 && index < images.length) {
      setActiveImageIndex(index);
    }
  };

  const handleWhatsApp = () => {
    const url = getWhatsAppUrl(ad.contactPhone || '', ad.title || 'Annonce');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCall = () => {
    if (ad.contactPhone) {
      window.location.href = `tel:${ad.contactPhone}`;
    }
  };

  const locationText =
    [ad.location?.neighborhood, ad.location?.city, ad.location?.province]
      .filter(Boolean)
      .join(' · ') || 'Gabon';

  const transactionBadge = getAdTransactionBadge(ad);
  const priceText = formatAdPrice(ad);
  const unitText = formatPriceUnit(ad.priceUnit, isJobAd(ad));

  return (
    <div
      role="main"
      className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto pb-28 select-none"
    >
      {/* 1. Top bar: Back, Title/Category, Favorite, Share */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 py-2 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <IconButton
            aria-label="Retour au catalogue"
            variant="ghost"
            size="md"
            icon={<ArrowLeft className="w-5 h-5 text-slate-800" />}
            onClick={onClose}
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {ad.title}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {ad.mainCategory}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleFavorite && (
            <IconButton
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              variant="ghost"
              size="md"
              icon={
                <Heart
                  className={`w-5 h-5 ${
                    isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-700'
                  }`}
                />
              }
              onClick={() => onToggleFavorite(ad.id)}
            />
          )}

          <IconButton
            aria-label="Partager cette annonce"
            variant="ghost"
            size="md"
            icon={<Share2 className="w-5 h-5 text-slate-700" />}
            onClick={() => setIsShareModalOpen(true)}
          />
        </div>
      </header>

      {/* 2. Gallery: Native CSS scroll-snap (no JS touch listeners) */}
      <div className="relative w-full aspect-16/10 bg-slate-950 overflow-hidden">
        <div
          ref={galleryRef}
          onScroll={handleGalleryScroll}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar w-full h-full"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              className="w-full h-full shrink-0 snap-center relative flex items-center justify-center cursor-pointer"
              onClick={() => setIsLightboxOpen(true)}
            >
              <img
                src={idx === 0 && ad.mediumUrl ? ad.mediumUrl : img}
                alt={`${ad.title || 'Annonce'} - Photo ${idx + 1}`}
                className="w-full h-full object-contain"
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
          ))}
        </div>

        {/* Photo counter badge */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 z-10 bg-slate-950/80 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10 shadow-md">
            {`${activeImageIndex + 1} / ${images.length}`}
          </div>
        )}

        {/* Lightbox button overlay */}
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          aria-label="Agrandir en plein écran"
          className="absolute bottom-3 left-3 z-10 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center backdrop-blur-xs cursor-pointer shadow-md"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Main content body (in exact spec order) */}
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5 select-text">
        {/* Price & Primary Badges */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {isNecrologie ? (
              <span className="text-sm font-black uppercase text-slate-800 tracking-wider">
                Avis d'Obsèques & Hommage
              </span>
            ) : isAvisRecherche ? (
              <span className="text-sm font-black uppercase text-rose-700 tracking-wider">
                Avis de Recherche & Vigilance
              </span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight leading-none">
                  {priceText}
                </span>
                {unitText && (
                  <span className="text-sm font-bold text-slate-500 lowercase">
                    {unitText}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {transactionBadge.label && (
                <Pill variant="neutral">{transactionBadge.label}</Pill>
              )}
              {isVip && (
                <Pill variant="vip" icon={<Crown className="w-3.5 h-3.5 text-amber-950" />}>
                  VIP Corner
                </Pill>
              )}
              {isVerified && (
                <Pill variant="verified" icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />}>
                  Vérifié
                </Pill>
              )}
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            {ad.title}
          </h2>

          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{locationText}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{remainingTimeLabel}</span>
            </div>
          </div>
        </div>

        {/* Key facts grid (category specific) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
            Caractéristiques Principales
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {ad.propertyType && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Type de bien</span>
                <span className="font-bold text-slate-800">{ad.propertyType}</span>
              </div>
            )}
            {ad.vehicleData?.category && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Catégorie véhicule</span>
                <span className="font-bold text-slate-800">{ad.vehicleData.category}</span>
              </div>
            )}
            {ad.vehicleData?.brand && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Marque</span>
                <span className="font-bold text-slate-800">{ad.vehicleData.brand}</span>
              </div>
            )}
            {ad.vehicleData?.model && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Modèle</span>
                <span className="font-bold text-slate-800">{ad.vehicleData.model}</span>
              </div>
            )}
            {ad.vehicleData?.subType && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Sous-type</span>
                <span className="font-bold text-slate-800">{ad.vehicleData.subType}</span>
              </div>
            )}
            {ad.domesticJobType && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Métier</span>
                <span className="font-bold text-slate-800">{ad.domesticJobType}</span>
              </div>
            )}
            {ad.tutoringData?.subject && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Matière</span>
                <span className="font-bold text-slate-800">{ad.tutoringData.subject}</span>
              </div>
            )}
            {ad.tutoringData?.level && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Niveau</span>
                <span className="font-bold text-slate-800">{ad.tutoringData.level}</span>
              </div>
            )}
            {isEvenement && ad.eventData?.eventDate && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Date de l'événement</span>
                <span className="font-bold text-slate-800">{formatEventDate(ad.eventData.eventDate)}</span>
              </div>
            )}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Référence annonce</span>
              <span className="font-mono font-bold text-slate-800">#{ad.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Description (expandable after 6 lines) */}
        {ad.description && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Description Détaillée
            </h3>
            <p
              className={`text-sm text-slate-700 whitespace-pre-line leading-relaxed ${
                !isDescriptionExpanded ? 'line-clamp-6' : ''
              }`}
            >
              {ad.description}
            </p>
            {ad.description.length > 250 && (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>{isDescriptionExpanded ? 'Voir moins' : 'Lire toute la description'}</span>
                {isDescriptionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}

        {/* Seller Block */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 font-black text-lg flex items-center justify-center shrink-0">
              {(ad.contactName || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {ad.contactName || 'Annonceur'}
              </h4>
              <p className="text-xs text-slate-500">
                {isVerified ? 'Identité vérifiée par BIZBOOSTER' : 'Annonceur Particulier'}
              </p>
            </div>
          </div>

          {isVerified && (
            <button
              type="button"
              onClick={() => setShowVerifiedModal(true)}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0 cursor-pointer"
            >
              Voir badge
            </button>
          )}
        </div>

        {/* Location Block */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Localisation au Gabon
          </h3>
          <div className="flex items-start gap-2 text-xs text-slate-700">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-slate-900">{locationText}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Gabon • Publication certifiée géolocalisée
              </p>
            </div>
          </div>
        </div>

        {/* Report and Safety Links */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 pb-6 px-1">
          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 hover:text-rose-600 cursor-pointer transition-colors"
          >
            <Flag className="w-4 h-4 text-slate-400" />
            <span>Signaler un problème sur cette annonce</span>
          </button>
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 hover:text-slate-800 cursor-pointer transition-colors"
          >
            <Share2 className="w-4 h-4 text-slate-400" />
            <span>Partager</span>
          </button>
        </div>
      </div>

      {/* 4. Sticky bottom action bar (Safe area aware, flex WhatsApp + Call) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2.5 shadow-xl max-w-lg mx-auto sm:max-w-xl">
        {ad.hasWhatsapp !== false ? (
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex-1 min-h-[48px] bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <MessageCircle className="w-5 h-5 text-white" />
            <span>{isNecrologie ? 'Condoléances' : isAvisRecherche ? 'Signaler' : 'WhatsApp'}</span>
          </button>
        ) : (
          <div className="flex-1 min-h-[48px] bg-slate-100 text-slate-600 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2">
            <span>Contact Direct</span>
          </div>
        )}

        {ad.contactPhone && (
          <button
            type="button"
            onClick={handleCall}
            aria-label="Appeler l'annonceur"
            className="min-h-[48px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Phone className="w-5 h-5 text-slate-700" />
            <span>{isNecrologie ? 'Famille' : isAvisRecherche ? 'Urgence' : 'Appeler'}</span>
          </button>
        )}
      </div>

      {/* Lightbox full-screen */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Fermer l'agrandissement"
            className="absolute top-4 right-4 z-50 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={images[activeImageIndex]}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-xl select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Sub-modals rendered as sheets */}
      {isShareModalOpen && (
        <ShareAdModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          ad={ad}
        />
      )}

      {isReportOpen && (
        <ReportAdModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          ad={ad}
        />
      )}

      {showVerifiedModal && (
        <VerifiedAdvertiserModal
          isOpen={showVerifiedModal}
          onClose={() => setShowVerifiedModal(false)}
          advertiserName={ad.contactName || 'Annonceur'}
        />
      )}
    </div>
  );
};
