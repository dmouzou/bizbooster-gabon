import React, { useState } from 'react';
import { MapPin, Phone, MessageSquare, Clock, ArrowUpRight, Eye, Calendar, RefreshCw, Edit3, Sparkles, CheckCircle2, ShieldCheck, Heart } from 'lucide-react';
import { Ad } from '../types';
import { formatFCFA, formatRemainingTime, getWhatsAppUrl } from '../utils/formatters';
import { isAdBoostFeatured, recordAdInteraction } from '../utils/personalization';
import { VerifiedAdvertiserModal } from './VerifiedAdvertiserModal';

interface AdCardProps {
  ad: Ad;
  onSelectAd: (ad: Ad) => void;
  onOpenExtendModal?: (ad: Ad) => void;
  onEditAd?: (ad: Ad) => void;
  isOwner?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (adId: string) => void;
}

export const AdCard: React.FC<AdCardProps> = ({
  ad,
  onSelectAd,
  onOpenExtendModal,
  onEditAd,
  isOwner = false,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);
  const isBoosted = isAdBoostFeatured(ad);
  const isVerified = Boolean(ad.isOwnerVerified || ad.isOwnerVip);

  const handleCardClick = () => {
    recordAdInteraction(ad);
    onSelectAd(ad);
  };

  return (
    <div
      className={`group bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-0.5 ${
        isBoosted
          ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md'
          : isExpired
          ? 'border-red-200 opacity-75 bg-slate-50/70'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
      id={`ad-card-${ad.id}`}
    >
      {/* Image container */}
      <div
        className="relative aspect-16/10 bg-slate-100 overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <img
          src={ad.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}
          alt={ad.title || 'Annonce'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Top Badges overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none">
          {/* Transaction Type: VENTE, LOCATION or À EMPLOYER */}
          <div className="flex flex-col gap-1">
            {isBoosted && (
              <span className="text-[10px] font-black tracking-wide uppercase px-2 py-0.5 rounded-lg shadow-sm bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 flex items-center gap-1 border border-amber-300">
                <Sparkles className="w-3 h-3 fill-slate-950" />
                <span>En Tête</span>
              </span>
            )}
            {ad.mainCategory === 'EMPLOI' ? (
              <span
                className={`text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs ${
                  ad.jobKind === 'DEMANDE_EMPLOI' || ad.transactionType === 'CHERCHE_EMPLOI'
                    ? 'bg-teal-600 text-white ring-1 ring-teal-400'
                    : 'bg-purple-600 text-white ring-1 ring-purple-400'
                }`}
              >
                {ad.jobKind === 'DEMANDE_EMPLOI' || ad.transactionType === 'CHERCHE_EMPLOI'
                  ? "Demande d'Emploi"
                  : "Offre d'Emploi"}
              </span>
            ) : ad.mainCategory === 'BRIC_A_BRAC' ? (
              <span className="text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs bg-amber-500 text-slate-950 ring-1 ring-amber-400">
                À Vendre
              </span>
            ) : ad.mainCategory === 'COURS_A_DOMICILE' ? (
              <span className={`text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs ${
                ad.tutoringData?.kind === 'DEMANDE'
                  ? 'bg-purple-600 text-white ring-1 ring-purple-400'
                  : 'bg-indigo-600 text-white ring-1 ring-indigo-400'
              }`}>
                {ad.tutoringData?.kind === 'DEMANDE' ? 'Demande de Cours' : 'Offre de Cours'}
              </span>
            ) : ad.mainCategory === 'NECROLOGIE' ? (
              <span className="text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs bg-slate-950 text-white ring-1 ring-slate-700">
                Avis d'Obsèques
              </span>
            ) : ad.transactionType ? (
              <span
                className={`text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs ${
                  ad.transactionType === 'VENTE'
                    ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-400'
                    : 'bg-emerald-600 text-white ring-1 ring-emerald-400'
                }`}
              >
                {ad.transactionType === 'VENTE' ? 'À Vendre' : 'À Louer'}
              </span>
            ) : null}

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
            {ad.tutoringData?.subject && (
              <span className="text-[10px] font-bold bg-indigo-900/90 text-indigo-100 px-2 py-0.5 rounded-md shadow-xs">
                {ad.tutoringData.subject}
              </span>
            )}
            {ad.necrologieData?.ministry && (
              <span className="text-[10px] font-bold bg-slate-900/90 text-amber-300 px-2 py-0.5 rounded-md shadow-xs">
                {ad.necrologieData.ministry}
              </span>
            )}
          </div>

          {/* Right badges: Expiration Countdown and Favorite button */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
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

            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(ad.id);
                }}
                className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 shadow-md cursor-pointer ${
                  isFavorite
                    ? 'bg-rose-500 text-white hover:bg-rose-600 scale-105 ring-2 ring-white/60'
                    : 'bg-slate-950/60 hover:bg-slate-950/85 text-white hover:text-rose-400 border border-white/20'
                }`}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                id={`favorite-btn-${ad.id}`}
              >
                <Heart className={`w-3.5 h-3.5 transition-transform duration-200 ${isFavorite ? 'fill-current scale-110' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Media indicators (Photo count / Video badge) */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
          {(ad.images?.length || 0) > 1 && (
            <span className="bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
              📷 {ad.images?.length} photos
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
          <span>{ad.viewsCount || 0} vue{(ad.viewsCount || 0) > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Spatial breadcrumb + Annonceur Vérifié in card content */}
          <div className="flex items-center justify-between gap-1 mb-2 flex-wrap">
            {ad.location && (
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md w-fit">
                <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {ad.location.province} • {ad.location.city} • <strong className="text-slate-900">{ad.location.neighborhood}</strong>
                </span>
              </div>
            )}
            {isVerified && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVerifiedModal(true);
                }}
                className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300 px-2 py-0.5 rounded-md shrink-0 transition-colors cursor-pointer group/badge"
                title="En savoir plus sur la vérification KYC de l'annonceur"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0 group-hover/badge:scale-110 transition-transform" />
                <span>Annonceur Vérifié</span>
              </button>
            )}
          </div>

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
            {ad.mainCategory !== 'NECROLOGIE' ? (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {ad.mainCategory === 'EMPLOI' ? 'Salaire proposé' : 'Prix demandé'}
                </span>
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
            ) : (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Rubrique
                </span>
                <span className="text-xs font-extrabold text-slate-800">
                  Nécrologie & Obsèques
                </span>
              </div>
            )}

            {/* Owner action buttons */}
            {isOwner && (
              <div className="flex items-center gap-1.5">
                {onEditAd && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAd(ad);
                    }}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    title="Modifier cette annonce"
                    id={`edit-button-${ad.id}`}
                  >
                    <Edit3 className="w-3 h-3 text-emerald-700" />
                    <span>Modifier</span>
                  </button>
                )}

                {onOpenExtendModal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenExtendModal(ad);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    title="Prolonger la durée de votre annonce"
                    id={`extend-button-${ad.id}`}
                  >
                    <RefreshCw className="w-3 h-3 text-amber-600" />
                    <span>Prolonger</span>
                  </button>
                )}
              </div>
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

      {showVerifiedModal && (
        <VerifiedAdvertiserModal
          isOpen={showVerifiedModal}
          onClose={() => setShowVerifiedModal(false)}
          advertiserName={ad.contactName}
        />
      )}
    </div>
  );
};
