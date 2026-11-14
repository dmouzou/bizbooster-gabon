import React from 'react';
import {
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  ShieldCheck,
  Heart,
  Crown,
  Calendar,
  AlertCircle,
  Camera,
} from 'lucide-react';
import { Ad } from '../types';
import {
  formatAdPrice,
  formatPriceUnit,
  formatRemainingTime,
  getWhatsAppUrl,
  getAdTransactionBadge,
  formatEventDate,
  isJobAd,
} from '../utils/formatters';
import { isAdBoostFeatured, recordAdInteraction } from '../utils/personalization';
import { isAdVipCornerEligible } from '../utils/vipCorner';
import { ResponsiveImage } from './ui/ResponsiveImage';
import { Pill } from './ui/Pill';

export interface AdCardProps {
  ad: Ad;
  onSelectAd: (ad: Ad) => void;
  onOpenExtendModal?: (ad: Ad) => void;
  onEditAd?: (ad: Ad) => void;
  isOwner?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (adId: string) => void;
}

const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' width='400' height='250'%3E%3Crect width='100%25' height='100%25' fill='%23DCE3EA'/%3E%3Cpath d='M180 110l20 25 15-18 25 33h-80z' fill='%2394A3B8'/%3E%3Ccircle cx='185' cy='95' r='8' fill='%2394A3B8'/%3E%3C/svg%3E";

const AdCardComponent: React.FC<AdCardProps> = ({
  ad,
  onSelectAd,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const isBoosted = isAdBoostFeatured(ad);
  const isVerified = Boolean(ad.isOwnerVerified || ad.isOwnerVip);
  const isVip = isAdVipCornerEligible(ad);
  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);

  const isNecrologie = ad.mainCategory === 'NECROLOGIE';
  const isAvisRecherche = ad.mainCategory === 'AVIS_DE_RECHERCHE';
  const isEvenement = ad.mainCategory === 'EVENEMENTS' && !!ad.eventData;

  const images = ad.images && ad.images.length > 0 ? ad.images : [FALLBACK_SVG];
  const photoCount = images.length;

  const handleCardClick = () => {
    recordAdInteraction(ad);
    onSelectAd(ad);
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getWhatsAppUrl(ad.contactPhone || '', ad.title || 'Annonce');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ad.contactPhone) {
      window.location.href = `tel:${ad.contactPhone}`;
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(ad.id);
    }
  };

  const locationText =
    [ad.location?.neighborhood, ad.location?.city, ad.location?.province]
      .filter(Boolean)
      .join(' · ') || 'Gabon';

  const priceText = formatAdPrice(ad);
  const unitText = formatPriceUnit(ad.priceUnit, isJobAd(ad));
  const transactionBadge = getAdTransactionBadge(ad);

  return (
    <article
      onClick={handleCardClick}
      id={`ad-card-${ad.id}`}
      className={`group cursor-pointer bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col hover:shadow-lg active:scale-[0.99] select-none ${
        isNecrologie
          ? 'border-slate-800 shadow-md'
          : isAvisRecherche
          ? 'border-red-400 ring-1 ring-red-400/20 shadow-md'
          : isBoosted
          ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-md'
          : isExpired
          ? 'border-red-200 opacity-80 bg-slate-50/70'
          : 'border-slate-200/90 hover:border-emerald-300'
      }`}
    >
      {/* Ribbon distinctif Nécrologie */}
      {isNecrologie && (
        <div className="bg-slate-950 text-amber-300 text-xs font-black uppercase px-3.5 py-1.5 flex items-center justify-between tracking-wide border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <span>Avis d'Obsèques & Hommage</span>
          </span>
          <span className="text-[11px] text-slate-300 font-semibold lowercase">diffusion nationale</span>
        </div>
      )}

      {/* Ribbon distinctif Avis de Recherche */}
      {isAvisRecherche && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white text-xs font-black uppercase px-3.5 py-1.5 flex items-center justify-between tracking-wide">
          <span className="flex items-center gap-1.5">
            <span>Avis de Recherche & Vigilance</span>
          </span>
          {ad.avisRechercheData?.hasReward && ad.avisRechercheData?.rewardAmount ? (
            <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-1.5 py-0.5 rounded-sm">
              Récompense
            </span>
          ) : (
            <span className="text-[11px] text-red-100 font-semibold">signalement actif</span>
          )}
        </div>
      )}

      {/* 1. Photo container: 16:10 aspect ratio */}
      <div className="relative aspect-16/10 bg-slate-100 overflow-hidden">
        <ResponsiveImage
          thumbUrl={ad.thumbUrl}
          mediumUrl={ad.mediumUrl}
          src={images[0]}
          dominantColor={ad.dominantColor || '#DCE3EA'}
          alt={ad.title || 'Annonce'}
          aspectRatio="16/10"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* Overlay Top-Left: Transaction Badge */}
        {!isNecrologie && !isAvisRecherche && transactionBadge.label && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="bg-white/95 backdrop-blur-xs text-slate-900 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm border border-slate-200/60">
              {transactionBadge.label}
            </span>
          </div>
        )}

        {/* Overlay Top-Right: Favorite Button (Strictly >= 44x44 px bounding box) */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="absolute top-2 right-2 z-10 w-11 h-11 rounded-full bg-slate-950/50 hover:bg-slate-950/80 active:bg-slate-950 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-md"
          >
            <Heart
              className={`w-5 h-5 transition-transform ${
                isFavorite ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white'
              }`}
            />
          </button>
        )}

        {/* Overlay Bottom-Right: Photo Counter Pill */}
        {photoCount > 1 && (
          <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none bg-slate-950/75 backdrop-blur-xs text-white text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
            <Camera className="w-3.5 h-3.5 text-slate-300" />
            <span>{photoCount}</span>
          </div>
        )}
      </div>

      {/* 2. Body (padding 14px, gap 8px) */}
      <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between">
        <div className="space-y-1.5">
          {/* Price & Badges row */}
          <div className="flex items-center justify-between gap-2 min-h-[26px]">
            {isNecrologie ? (
              <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                À la mémoire de
              </span>
            ) : isAvisRecherche ? (
              <span className="text-sm font-black text-rose-700 uppercase tracking-wide">
                Personne / Bien recherché
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-[21px] font-extrabold text-emerald-800 tracking-tight leading-none">
                  {priceText}
                </span>
                {unitText && (
                  <span className="text-sm font-semibold text-slate-500 lowercase">
                    {unitText}
                  </span>
                )}
              </div>
            )}

            {/* Badges in body (Sponsorisée / VIP) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isVip && (
                <Pill variant="vip" icon={<Crown className="w-3 h-3 text-amber-950" />}>
                  VIP
                </Pill>
              )}
              {isBoosted && (
                <Pill variant="warning">
                  Sponsorisée
                </Pill>
              )}
            </div>
          </div>

          {/* Title: 15/700, 2 lines */}
          <h2 className="text-[15px] font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
            {ad.title}
          </h2>

          {/* Location line with map-pin icon */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>

          {/* Category specific chips (moved into the body) */}
          {(ad.propertyType || ad.vehicleData?.category || ad.domesticJobType || ad.tutoringData?.subject) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ad.propertyType && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                  {ad.propertyType}
                </span>
              )}
              {ad.vehicleData?.category && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                  {ad.vehicleData.category}
                </span>
              )}
              {ad.domesticJobType && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                  {ad.domesticJobType}
                </span>
              )}
              {ad.tutoringData?.subject && (
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                  {ad.tutoringData.subject}
                </span>
              )}
            </div>
          )}

          {/* Meta row: Vérifié pill left, remaining time right */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
            <div>
              {isVerified ? (
                <Pill variant="verified" icon={<ShieldCheck className="w-3 h-3 text-emerald-700" />}>
                  Vérifié
                </Pill>
              ) : (
                <span className="text-xs text-slate-400">Annonceur particulier</span>
              )}
            </div>

            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{remainingTimeLabel}</span>
            </div>
          </div>
        </div>

        {/* 3. Actions: WhatsApp button (flex 1, 48px high) + 48px square call button */}
        <div className="pt-2 flex items-center gap-2">
          {ad.hasWhatsapp !== false ? (
            <button
              type="button"
              onClick={handleWhatsAppClick}
              className="flex-1 min-h-[48px] bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span>WhatsApp</span>
            </button>
          ) : (
            <div className="flex-1 min-h-[48px] bg-slate-100 text-slate-600 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2">
              <span>Contact direct</span>
            </div>
          )}

          {ad.contactPhone && (
            <button
              type="button"
              onClick={handleCallClick}
              aria-label={`Appeler ${ad.contactName || "l'annonceur"}`}
              title="Appeler par téléphone"
              className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Phone className="w-5 h-5 text-slate-700" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export const AdCard = React.memo(
  AdCardComponent,
  (prev, next) =>
    prev.ad.id === next.ad.id &&
    prev.ad.status === next.ad.status &&
    prev.ad.viewsCount === next.ad.viewsCount &&
    prev.ad.expiresAt === next.ad.expiresAt &&
    prev.isFavorite === next.isFavorite
);
