import React from 'react';
import { MapPin, Phone, MessageSquare, Clock, ArrowUpRight, Eye, Calendar, RefreshCw } from 'lucide-react';
import { Ad } from '../types';
import { formatFCFA, formatRemainingTime, getWhatsAppUrl } from '../utils/formatters';

interface AdCardProps {
  ad: Ad;
  onSelectAd: (ad: Ad) => void;
  onOpenExtendModal?: (ad: Ad) => void;
  isOwner?: boolean;
}

export const AdCard: React.FC<AdCardProps> = ({ ad, onSelectAd, onOpenExtendModal, isOwner = false }) => {
  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);

  return (
    <div
      className={`group bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-0.5 ${
        isExpired
          ? 'border-red-200 opacity-75 bg-slate-50/70'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
      id={`ad-card-${ad.id}`}
    >
      {/* Image container */}
      <div
        className="relative aspect-16/10 bg-slate-100 overflow-hidden cursor-pointer"
        onClick={() => onSelectAd(ad)}
      >
        <img
          src={ad.images[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}
          alt={ad.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Top Badges overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none">
          {/* Transaction Type: VENTE vs LOCATION (Highlighting the critical requirement) */}
          <div className="flex flex-col gap-1">
            {ad.transactionType && (
              <span
                className={`text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs ${
                  ad.transactionType === 'VENTE'
                    ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-400'
                    : 'bg-emerald-600 text-white ring-1 ring-emerald-400'
                }`}
              >
                {ad.transactionType === 'VENTE' ? 'À Vendre' : 'À Louer'}
              </span>
            )}
            {ad.propertyType && (
              <span className="text-[10px] font-bold bg-slate-900/85 text-slate-100 px-2 py-0.5 rounded-md shadow-xs">
                {ad.propertyType}
              </span>
            )}
            {ad.vehicleData?.category && (
              <span className="text-[10px] font-bold bg-blue-900/85 text-blue-100 px-2 py-0.5 rounded-md shadow-xs">
                {ad.vehicleData.category}
              </span>
            )}
            {ad.domesticJobType && (
              <span className="text-[10px] font-bold bg-purple-900/85 text-purple-100 px-2 py-0.5 rounded-md shadow-xs">
                {ad.domesticJobType}
              </span>
            )}
          </div>

          {/* Expiration Countdown badge */}
          <div
            className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm backdrop-blur-xs ${
              isExpired
                ? 'bg-red-600 text-white'
                : 'bg-slate-950/80 text-white border border-white/20'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-300" />
            <span>{remainingTimeLabel}</span>
          </div>
        </div>

        {/* Media indicators (Photo count / Video badge) */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
          {ad.images.length > 1 && (
            <span className="bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
              📷 {ad.images.length} photos
            </span>
          )}
          {ad.videoUrl && (
            <span className="bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
              ▶ Vidéo
            </span>
          )}
        </div>

        {/* Views counter */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white/90 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs">
          <Eye className="w-3 h-3" />
          <span>{ad.viewsCount} vues</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Spatial breadcrumb: Province > Ville > Quartier */}
          {ad.location && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md mb-2 w-fit">
              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">
                {ad.location.province} • {ad.location.city} • <strong className="text-slate-900">{ad.location.neighborhood}</strong>
              </span>
            </div>
          )}

          {/* Vehicle specific: Marque & Modèle */}
          {ad.vehicleData?.brand && (
            <div className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md mb-2 w-fit">
              🚗 {ad.vehicleData.brand} {ad.vehicleData.model ? `• ${ad.vehicleData.model}` : ''}
            </div>
          )}

          {/* Title */}
          <h4
            onClick={() => onSelectAd(ad)}
            className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-emerald-700 cursor-pointer transition-colors mb-1.5"
            title={ad.title}
          >
            {ad.title}
          </h4>

          {/* Short description with max character limit respect */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
            {ad.description}
          </p>
        </div>

        <div>
          {/* Price Tag */}
          <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Prix demandé</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black tracking-tight text-emerald-700">
                  {formatFCFA(ad.price)}
                </span>
                {ad.priceUnit && ad.priceUnit !== 'total' && (
                  <span className="text-xs font-semibold text-slate-500">
                    /{ad.priceUnit}
                  </span>
                )}
              </div>
            </div>

            {/* Prolonger button - Strictly restricted to the owner of this ad */}
            {isOwner && onOpenExtendModal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenExtendModal(ad);
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                title="Prolonger la durée de votre annonce"
                id={`extend-button-${ad.id}`}
              >
                <RefreshCw className="w-3 h-3 text-amber-600" />
                <span>Prolonger</span>
              </button>
            )}
          </div>

          {/* Action buttons: WhatsApp & Tel */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={getWhatsAppUrl(ad.contactPhone, ad.title)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-2.5 rounded-xl transition-colors shadow-xs"
              id={`whatsapp-button-${ad.id}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <a
              href={`tel:${ad.contactPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-2.5 rounded-xl transition-colors"
              id={`call-button-${ad.id}`}
            >
              <Phone className="w-3.5 h-3.5 text-slate-600" />
              <span>Appeler</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
