import React from 'react';
import { MapPin, MessageCircle, ShieldCheck, Heart } from 'lucide-react';
import { Ad } from '../types';
import {
  formatAdPrice,
  formatPriceUnit,
  getWhatsAppUrl,
  isAdOwner,
  isJobAd,
} from '../utils/formatters';
import { isAdBoostFeatured, recordAdInteraction } from '../utils/personalization';
import { ResponsiveImage } from './ui/ResponsiveImage';
import { Pill } from './ui/Pill';
import { IconButton } from './ui/IconButton';

export interface AdCardCompactProps {
  ad: Ad;
  onSelectAd: (ad: Ad) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (adId: string) => void;
}

export const AdCardCompactComponent: React.FC<AdCardCompactProps> = ({
  ad,
  onSelectAd,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const isBoosted = isAdBoostFeatured(ad);
  const isVerified = Boolean(ad.isOwnerVerified || ad.isOwnerVip);
  const isNecrologie = ad.mainCategory === 'NECROLOGIE';
  const isAvisRecherche = ad.mainCategory === 'AVIS_DE_RECHERCHE';
  const isEvenement = ad.mainCategory === 'EVENEMENTS';

  const handleClick = () => {
    recordAdInteraction(ad);
    onSelectAd(ad);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getWhatsAppUrl(ad.contactPhone || '', ad.title || 'Annonce');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
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

  return (
    <div
      onClick={handleClick}
      id={`ad-compact-${ad.id}`}
      className={`group cursor-pointer bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex items-stretch p-3 gap-3.5 hover:shadow-md active:scale-[0.99] select-none ${
        isBoosted
          ? 'border-amber-400 ring-1 ring-amber-400/30'
          : 'border-slate-200/90 hover:border-emerald-300'
      }`}
    >
      {/* 104x104 px square thumbnail */}
      <div className="w-[104px] h-[104px] shrink-0 rounded-xl overflow-hidden relative bg-slate-100">
        <ResponsiveImage
          thumbUrl={ad.thumbUrl}
          mediumUrl={ad.mediumUrl}
          src={ad.images?.[0]}
          dominantColor={ad.dominantColor || '#E2E8F0'}
          alt={ad.title || 'Annonce'}
          aspectRatio="1/1"
          className="w-full h-full object-cover"
        />
        {onToggleFavorite && (
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white flex items-center justify-center transition-transform active:scale-90"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white'
              }`}
            />
          </button>
        )}
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Header row: Price or category label + Boost badge */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="truncate">
              {isNecrologie ? (
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Avis d'Obsèques
                </span>
              ) : isAvisRecherche ? (
                <span className="text-xs font-black uppercase tracking-wider text-rose-600">
                  Avis de Recherche
                </span>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-[17px] font-extrabold text-emerald-800 leading-tight">
                    {priceText}
                  </span>
                  {unitText && (
                    <span className="text-xs font-semibold text-slate-500">
                      {unitText}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isBoosted && (
              <Pill variant="warning" className="shrink-0 text-[10px]">
                Sponsorisée
              </Pill>
            )}
          </div>

          {/* Title: 14/700, 2 lines */}
          <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
            {ad.title}
          </h3>
        </div>

        {/* Location & Actions row */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100/80 mt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 truncate">{locationText}</span>
            {isVerified && (
              <Pill variant="verified" icon={<ShieldCheck className="w-3 h-3 text-emerald-700" />} className="ml-1 shrink-0">
                Vérifié
              </Pill>
            )}
          </div>

          {/* 44x44 px WhatsApp Icon Button */}
          {ad.hasWhatsapp !== false && (
            <IconButton
              aria-label="Contacter sur WhatsApp"
              variant="ghost"
              size="sm"
              icon={<MessageCircle className="w-4 h-4 text-emerald-600" />}
              onClick={handleWhatsApp}
              className="text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const AdCardCompact = React.memo(
  AdCardCompactComponent,
  (prev, next) =>
    prev.ad.id === next.ad.id &&
    prev.ad.status === next.ad.status &&
    prev.ad.viewsCount === next.ad.viewsCount &&
    prev.isFavorite === next.isFavorite
);

