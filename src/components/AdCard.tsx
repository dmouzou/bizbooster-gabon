import React, { useState, useRef } from 'react';
import { MapPin, Phone, MessageSquare, Clock, ArrowUpRight, Eye, Calendar, RefreshCw, Edit3, Sparkles, CheckCircle2, ShieldCheck, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Ad } from '../types';
import { formatFCFA, formatRemainingTime, getWhatsAppUrl, formatPriceDisplay, getPriceOrSalaryLabel, formatPriceUnit, isJobAd, getAdTransactionBadge } from '../utils/formatters';
import { isAdBoostFeatured, recordAdInteraction } from '../utils/personalization';
import { isAdVipCornerEligible } from '../utils/vipCorner';
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const images = ad.images && ad.images.length > 0
    ? ad.images
    : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'];
  const hasMultipleImages = images.length > 1;

  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
      const diffX = touchStartXRef.current - touchEndXRef.current;
      if (diffX > 35) {
        e.stopPropagation();
        handleNextImage();
      } else if (diffX < -35) {
        e.stopPropagation();
        handlePrevImage();
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);
  const isBoosted = isAdBoostFeatured(ad);
  const isVerified = Boolean(ad.isOwnerVerified || ad.isOwnerVip);
  const isVip = isAdVipCornerEligible(ad) && (ad.mainCategory === 'IMMOBILIER' || ad.mainCategory === 'MATERIEL_ROULANT');

  const isNecrologie = ad.mainCategory === 'NECROLOGIE';
  const isAvisRecherche = ad.mainCategory === 'AVIS_DE_RECHERCHE';

  // Point 4: Description limitée au maximum à 300 caractères avec césure propre
  const displayDescription = React.useMemo(() => {
    if (!ad.description) return '';
    const trimmed = ad.description.trim();
    if (trimmed.length <= 300) return trimmed;
    const sliced = trimmed.slice(0, 300);
    const lastSpace = sliced.lastIndexOf(' ');
    return (lastSpace > 240 ? sliced.slice(0, lastSpace) : sliced) + '...';
  }, [ad.description]);

  const handleCardClick = () => {
    recordAdInteraction(ad);
    onSelectAd(ad);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group cursor-pointer bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-0.5 ${
        isNecrologie
          ? 'border-slate-800 ring-1 ring-slate-800/30 shadow-md bg-white hover:border-slate-900'
          : isAvisRecherche
          ? 'border-red-400 ring-2 ring-red-400/20 shadow-md bg-white hover:border-red-500'
          : isBoosted
          ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md'
          : isExpired
          ? 'border-red-200 opacity-75 bg-slate-50/70'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
      id={`ad-card-${ad.id}`}
    >
      {/* Ribbon distinctif Nécrologie (Point 3) */}
      {isNecrologie && (
        <div className="bg-slate-950 text-amber-300 text-[11px] font-black uppercase px-3 py-1.5 flex items-center justify-between tracking-wide border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <span>🕊️</span>
            <span>Avis d'Obsèques & Hommage</span>
          </span>
          <span className="text-[10px] text-slate-300 font-semibold lowercase">diffusion nationale</span>
        </div>
      )}

      {/* Ribbon distinctif Avis de Recherche (Point 3) */}
      {isAvisRecherche && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white text-[11px] font-black uppercase px-3 py-1.5 flex items-center justify-between tracking-wide shadow-xs">
          <span className="flex items-center gap-1.5">
            <span>🚨</span>
            <span>Avis de Recherche & Vigilance</span>
          </span>
          {ad.avisRechercheData?.hasReward && ad.avisRechercheData?.rewardAmount ? (
            <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-sm">
              💰 Récompense
            </span>
          ) : (
            <span className="text-[10px] text-red-100 font-semibold">signalement actif</span>
          )}
        </div>
      )}
      {/* Image container: Affichage intégral sans recadrage agressif (Point 2) */}
      <div
        className="relative aspect-16/10 bg-slate-950 overflow-hidden select-none group/img"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Fond d'ambiance flouté pour harmoniser les marges sans bandes vides */}
        <img
          src={images[activeImageIndex]}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30 select-none pointer-events-none z-0"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />

        {/* Photo intégrale non rognée (object-contain) au niveau z-0 */}
        <img
          src={images[activeImageIndex]}
          alt={`${ad.title || 'Annonce'} - Photo ${activeImageIndex + 1}`}
          className="relative z-0 w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300 drop-shadow-xs"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />

        {/* PC Arrows: Left and Right (Point 6) au niveau z-30 */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              aria-label="Photo précédente"
              title="Photo précédente"
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white items-center justify-center opacity-0 group-hover:opacity-100 group-hover/img:opacity-100 transition-all duration-200 shadow-md backdrop-blur-xs z-30 hover:scale-110 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              aria-label="Photo suivante"
              title="Photo suivante"
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white items-center justify-center opacity-0 group-hover:opacity-100 group-hover/img:opacity-100 transition-all duration-200 shadow-md backdrop-blur-xs z-30 hover:scale-110 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Pagination Dots indicator */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 pointer-events-none">
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeImageIndex ? 'bg-white w-3 shadow-xs' : 'bg-white/50 w-1.5'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Top Badges overlay: z-20 impératif pour flotter au-dessus de la photo */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none z-20">
          {/* Transaction Type: VENTE, LOCATION or À EMPLOYER */}
          <div className="flex flex-col gap-1">
            {isVip && (
              <span className="text-[10px] font-black tracking-wide uppercase px-2 py-0.5 rounded-lg shadow-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 flex items-center gap-1 border border-amber-300">
                👑 VIP
              </span>
            )}

            {(() => {
              const badge = getAdTransactionBadge(ad);
              return (
                <span
                  className={`text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-xs ${badge.cardBadgeClass}`}
                >
                  {badge.label}
                </span>
              );
            })()}

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
            {ad.avisRechercheData?.category && (
              <span className="text-[10px] font-bold bg-red-950/90 text-red-100 px-2 py-0.5 rounded-md shadow-xs">
                {ad.avisRechercheData.category}
              </span>
            )}
            {ad.autresEmploisData?.profession && (
              <span className="text-[10px] font-bold bg-teal-950/90 text-teal-100 px-2 py-0.5 rounded-md shadow-xs">
                {ad.autresEmploisData.profession}
              </span>
            )}
            {(ad.cvUrl || ad.cvFileName || ad.jobDocUrl || ad.autresEmploisData?.jobDocUrl) && (() => {
              const isSeeker = ad.autresEmploisData?.subCategory === "Demandeur d'emploi" || ad.transactionType === 'CHERCHE_EMPLOI';
              const ext = (ad.jobDocFileType || ad.autresEmploisData?.jobDocFileType || ad.cvFileType || 'doc').toLowerCase();
              return (
                <span className="text-[10px] font-bold bg-indigo-700/90 text-white px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                  📄 {isSeeker ? `CV .${ext}` : `Fiche poste .${ext}`}
                </span>
              );
            })()}
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
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none z-20">
          {hasMultipleImages && (
            <span className="bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs shadow-xs">
              📷 {activeImageIndex + 1}/{images.length}
            </span>
          )}
          {ad.videoUrl && (
            <span className="bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
              ▶ Vidéo
            </span>
          )}
        </div>

        {/* Views counter */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white/90 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs z-20">
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

          {/* Description : limitée à un maximum de 300 caractères avec espacement aéré garanti (Point 4) */}
          {displayDescription && (
            <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed mb-3 whitespace-pre-line">
              {displayDescription}
            </p>
          )}

          {/* Point 3: Informations Nécrologie visibles sur l'annonce en ligne */}
          {isNecrologie && (
            <div className="bg-slate-900 text-white rounded-xl p-3 border border-slate-700 space-y-1.5 text-xs mb-3 shadow-xs">
              {(ad.necrologieData?.deceasedName || ad.necroDeceasedName) && (
                <div className="font-black text-amber-300 text-sm flex items-center gap-1.5">
                  <span>🕊️</span>
                  <span className="line-clamp-1">{ad.necrologieData?.deceasedName || ad.necroDeceasedName}</span>
                </div>
              )}
              {(ad.necrologieData?.ministry || ad.necroMinistry) && (
                <div className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                  <span>🏛️</span>
                  <span>Corps / Ministère : <strong>{ad.necrologieData?.ministry || ad.necroMinistry}</strong></span>
                </div>
              )}
              {(ad.necrologieData?.ceremonyLocation || ad.necroCeremonyLocation) && (
                <div className="text-[11px] text-slate-300 flex items-start gap-1">
                  <span className="shrink-0">📍</span>
                  <span className="line-clamp-1"><strong>Lieu / Veillée :</strong> {ad.necrologieData?.ceremonyLocation || ad.necroCeremonyLocation}</span>
                </div>
              )}
              {(ad.necrologieData?.ceremonyDate || ad.necroCeremonyDate) && (
                <div className="text-[11px] text-slate-300 flex items-center gap-1">
                  <span>📅</span>
                  <span><strong>Date :</strong> {ad.necrologieData?.ceremonyDate || ad.necroCeremonyDate}</span>
                </div>
              )}
              {(ad.necrologieData?.funeralProgram || ad.necroFuneralProgram) && (
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 line-clamp-2 leading-relaxed">
                  <strong className="text-slate-200">Programme sommaire :</strong> {ad.necrologieData?.funeralProgram || ad.necroFuneralProgram}
                </div>
              )}
            </div>
          )}

          {/* Point 3: Informations Avis de recherche visibles sur l'annonce en ligne */}
          {isAvisRecherche && (
            <div className="bg-red-50 text-slate-900 rounded-xl p-3 border border-red-200 space-y-1.5 text-xs mb-3 shadow-xs">
              {(ad.avisRechercheData?.targetName || ad.title) && (
                <div className="font-black text-red-900 text-sm flex items-center gap-1.5">
                  <span>🚨</span>
                  <span className="line-clamp-1">{ad.avisRechercheData?.targetName || ad.title}</span>
                </div>
              )}
              {ad.avisRechercheData?.category && (
                <div className="text-[11px] font-bold text-red-800">
                  📌 Type : {ad.avisRechercheData.category}
                </div>
              )}
              {(ad.avisRechercheData?.lastSeenLocation || ad.avisRechercheData?.lastSeenDate) && (
                <div className="text-[11px] text-slate-700 flex items-start gap-1">
                  <span className="shrink-0">📍</span>
                  <span className="line-clamp-1">
                    <strong>Vu à :</strong> {ad.avisRechercheData?.lastSeenLocation || 'Non précisé'}
                    {ad.avisRechercheData?.lastSeenDate ? ` (${ad.avisRechercheData.lastSeenDate})` : ''}
                  </span>
                </div>
              )}
              {ad.avisRechercheData?.rewardAmount ? (
                <div className="text-emerald-800 font-extrabold text-[11px] bg-emerald-100/90 p-1.5 rounded-lg border border-emerald-300 flex items-center gap-1">
                  <span>💰 Récompense promise :</span>
                  <span>{ad.avisRechercheData.rewardAmount.toLocaleString('fr-FR')} FCFA</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div>
          {/* Price Tag or Rubrique Header (NO price for Avis de recherche & Nécrologie - Point 3) */}
          <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between gap-2 mb-3">
            {isNecrologie ? (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  🕊️ Recueillement
                </span>
                <span className="text-xs font-black text-slate-900">
                  Diffusion Nationale
                </span>
              </div>
            ) : isAvisRecherche ? (
              <div>
                <span className="text-[10px] uppercase font-bold text-red-600 block">
                  🚨 Signalement
                </span>
                <span className="text-xs font-black text-slate-900">
                  {ad.avisRechercheData?.category || 'Avis Actif'}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPriceOrSalaryLabel(ad)}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black tracking-tight text-emerald-700">
                    {formatPriceDisplay(ad.price, ad.priceMax)}
                  </span>
                  {ad.priceUnit && ad.priceUnit !== 'total' && (
                    <span className="text-xs font-semibold text-slate-500">
                      {formatPriceUnit(ad.priceUnit, isJobAd(ad))}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Owner action buttons */}
            {isOwner && (
              <div className="flex items-center gap-1.5">
                {onEditAd && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isExpired) {
                        alert("Cette annonce est expirée. Conformément aux règles, vous devez la prolonger au préalable pour pouvoir la modifier.");
                        if (onOpenExtendModal) onOpenExtendModal(ad);
                        return;
                      }
                      onEditAd(ad);
                    }}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      isExpired
                        ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
                        : 'text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                    title={isExpired ? "Prolongez d'abord l'annonce pour la modifier" : "Modifier cette annonce"}
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

          {/* Action buttons: WhatsApp & Tel (Contextualized for Necrologie and Avis de recherche) */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={getWhatsAppUrl(ad.contactPhone, ad.title)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center justify-center gap-1.5 font-bold text-xs py-2 px-2.5 rounded-xl transition-colors shadow-xs ${
                isNecrologie
                  ? 'bg-slate-900 hover:bg-slate-800 text-amber-300'
                  : isAvisRecherche
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              id={`whatsapp-button-${ad.id}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isNecrologie ? 'Condoléances' : isAvisRecherche ? 'Signaler' : 'WhatsApp'}</span>
            </a>

            <a
              href={`tel:${ad.contactPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-2.5 rounded-xl transition-colors"
              id={`call-button-${ad.id}`}
            >
              <Phone className="w-3.5 h-3.5 text-slate-600" />
              <span>{isNecrologie ? 'Famille' : isAvisRecherche ? 'Urgence' : 'Appeler'}</span>
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
