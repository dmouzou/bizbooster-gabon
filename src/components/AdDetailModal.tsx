import React, { useState } from 'react';
import { X, MapPin, Phone, MessageSquare, Clock, Calendar, CheckCircle2, RefreshCw, Shield, Share2, Video, Flag, ShieldAlert, Eye, Edit3, ShieldCheck, Heart, Download, FileText, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { Ad, UserProfile } from '../types';
import { formatFCFA, formatRemainingTime, getWhatsAppUrl, isAdOwner, formatPriceDisplay, getPriceOrSalaryLabel, formatPriceUnit, isJobAd, getAdTransactionBadge } from '../utils/formatters';
import { isAdVipCornerEligible } from '../utils/vipCorner';
import { ReportAdModal } from './ReportAdModal';
import { ShareAdModal } from './ShareAdModal';
import { VerifiedAdvertiserModal } from './VerifiedAdvertiserModal';
import { trackDownloadRequest } from '../services/platformMetrics';

interface AdDetailModalProps {
  ad: Ad | null;
  onClose: () => void;
  onOpenExtendModal: (ad: Ad) => void;
  onEditAd?: (ad: Ad) => void;
  currentUser?: UserProfile | null;
  isFavorite?: boolean;
  onToggleFavorite?: (adId: string) => void;
}

export const AdDetailModal: React.FC<AdDetailModalProps> = ({
  ad,
  onClose,
  onOpenExtendModal,
  onEditAd,
  currentUser,
  isFavorite = false,
  onToggleFavorite,
}) => {
  if (!ad) return null;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const images = (ad.images && ad.images.length > 0)
    ? ad.images
    : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80'];
  const currentImage = images[activeImageIndex] || images[0];
  const hasMultipleImages = images.length > 1;

  // Réinitialiser la première image lors de l'ouverture d'une nouvelle annonce
  React.useEffect(() => {
    setActiveImageIndex(0);
    setIsLightboxOpen(false);
  }, [ad.id]);

  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null || !hasMultipleImages) return;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      handleNextImage();
    } else if (diff < -45) {
      handlePrevImage();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Navigation clavier dans le lightbox plein écran
  React.useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, hasMultipleImages, images.length]);

  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);
  const isOwner = isAdOwner(ad, currentUser ?? null);
  const isVerified = Boolean(ad.isOwnerVerified || ad.isOwnerVip);
  const isVip = isAdVipCornerEligible(ad) && (ad.mainCategory === 'IMMOBILIER' || ad.mainCategory === 'MATERIEL_ROULANT');

  return (
    <div className="app-modal-overlay">
      <div
        className="app-modal-dialog bg-white max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-300/80 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/70 px-2.5 py-1 rounded-lg border border-amber-500/30 shrink-0">
              REF: {ad.id.toUpperCase()}
            </span>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline truncate">
              BIZBOOSTER Gabon
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(ad.id)}
                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isFavorite
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title={isFavorite ? 'Retirer des favoris' : 'Sauvegarder dans vos favoris'}
                id="toggle-detail-favorite"
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-white' : 'text-rose-400'}`} />
                <span className="hidden sm:inline">{isFavorite ? 'Favori' : 'Sauvegarder'}</span>
              </button>
            )}

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Partager sur WhatsApp, X, Telegram, Instagram..."
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Partager</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              id="close-detail-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Main Title & Badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {(() => {
                const badge = getAdTransactionBadge(ad);
                return (
                  <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${badge.badgeClass}`}>
                    {badge.label}
                  </span>
                );
              })()}

              {isVip && (
                <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-lg border border-amber-300 shadow-xs">
                  <span>👑 CORNER VIP</span>
                </span>
              )}

              {isVerified && (
                <button
                  type="button"
                  onClick={() => setShowVerifiedModal(true)}
                  className="inline-flex items-center gap-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs transition-colors cursor-pointer group/badge"
                  title="En savoir plus sur la vérification KYC de l'annonceur"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 group-hover/badge:scale-110 transition-transform" />
                  <span>Annonceur Vérifié</span>
                </button>
              )}

              {ad.propertyType && (
                <span className="text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                  {ad.propertyType}
                </span>
              )}

              {ad.vehicleData?.category && (
                <span className="text-xs font-bold bg-blue-100 text-blue-900 px-2.5 py-1 rounded-lg border border-blue-200">
                  {ad.vehicleData.category}
                </span>
              )}

              <div
                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                  isExpired
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{remainingTimeLabel}</span>
              </div>

              <div className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>{ad.viewsCount || 0} vue{(ad.viewsCount || 0) > 1 ? 's' : ''}</span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {ad.title}
            </h2>

            {/* Spatial details as per Section B-1 */}
            {ad.location && (
              <div className="mt-2.5 flex items-center gap-2 text-sm text-emerald-900 bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl font-semibold">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Province de <strong>{ad.location.province}</strong> • Ville de <strong>{ad.location.city}</strong> • Quartier <strong>{ad.location.neighborhood}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Photo Gallery: Présentation intégrale de chaque photo sans rognage */}
          <div className="space-y-2.5">
            <div
              className="relative aspect-16/10 sm:aspect-16/9 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center select-none group/gallery cursor-pointer"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => setIsLightboxOpen(true)}
              title="Cliquer pour afficher la photo en grand écran"
            >
              {/* Fond d'ambiance flouté pour harmoniser les marges et éliminer les bandes vides */}
              <img
                src={currentImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-35 select-none pointer-events-none z-0"
                referrerPolicy="no-referrer"
              />

              {/* Photo intégrale non rognée (object-contain) */}
              <img
                src={currentImage}
                alt={`${ad.title || 'Annonce'} - Photo ${activeImageIndex + 1}`}
                className="relative z-10 w-full h-full object-contain drop-shadow-md select-none transition-transform duration-300 group-hover/gallery:scale-[1.01]"
                referrerPolicy="no-referrer"
              />

              {/* Badge compteur de photos */}
              {hasMultipleImages && (
                <div className="absolute bottom-3 right-3 z-20 bg-slate-950/80 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-md">
                  <span>📷</span>
                  <span>{activeImageIndex + 1} / {images.length}</span>
                </div>
              )}

              {/* Bouton Agrandir / Plein écran */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLightboxOpen(true);
                }}
                className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-white backdrop-blur-xs border border-white/10 shadow-md transition-all hover:scale-105 cursor-pointer opacity-90 hover:opacity-100"
                title="Agrandir la photo en plein écran"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Flèches de navigation Précédent / Suivant */}
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Photo précédente"
                    title="Photo précédente"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center transition-all duration-200 shadow-lg backdrop-blur-xs z-20 hover:scale-110 cursor-pointer opacity-80 hover:opacity-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Photo suivante"
                    title="Photo suivante"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center transition-all duration-200 shadow-lg backdrop-blur-xs z-20 hover:scale-110 cursor-pointer opacity-80 hover:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Vignettes sous la photo principale */}
            {hasMultipleImages && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-16 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all bg-slate-900 cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-emerald-500 ring-2 ring-emerald-400/40 opacity-100 scale-102'
                        : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400'
                    }`}
                    title={`Afficher la photo ${idx + 1}`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {activeImageIndex === idx && (
                      <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Video Player if ad has video */}
          {ad.videoUrl && (
            <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-2 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wide">
                <Video className="w-4 h-4 text-purple-400" />
                <span>Vidéo descriptive du bien (Option vérifiée)</span>
              </div>
              <div className="aspect-16/9 rounded-xl overflow-hidden bg-black max-w-lg mx-auto">
                <video
                  src={ad.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  playsInline
                />
              </div>
            </div>
          )}

          {/* Pricing & Expiration Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {ad.mainCategory === 'NECROLOGIE' ? (
              <div>
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  🕊️ Hommage & Obsèques
                </span>
                <div className="text-xl font-black text-slate-900">
                  {ad.necrologieData?.deceasedName || ad.necroDeceasedName || "Avis de Décès National"}
                </div>
                {(ad.necrologieData?.ministry || ad.necroMinistry) && (
                  <span className="text-xs text-slate-600 font-semibold block mt-0.5">
                    Corps / Ministère : <strong>{ad.necrologieData?.ministry || ad.necroMinistry}</strong>
                  </span>
                )}
              </div>
            ) : ad.mainCategory === 'AVIS_DE_RECHERCHE' ? (
              <div>
                <span className="text-xs font-bold uppercase text-red-600 tracking-wider">
                  🚨 Avis de Recherche & Signalement
                </span>
                <div className="text-xl font-black text-slate-900">
                  {ad.avisRechercheData?.targetName || ad.title}
                </div>
                {ad.avisRechercheData?.hasReward && ad.avisRechercheData?.rewardAmount ? (
                  <span className="inline-block mt-1 bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs px-2.5 py-1 rounded-lg">
                    💰 Récompense promise : {ad.avisRechercheData.rewardAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                ) : null}
              </div>
            ) : (
              <div>
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  {getPriceOrSalaryLabel(ad)}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {formatPriceDisplay(ad.price, ad.priceMax)}
                  </span>
                  {ad.priceUnit && ad.priceUnit !== 'total' && (
                    <span className="text-sm font-bold text-slate-600">
                      {formatPriceUnit(ad.priceUnit, isJobAd(ad))}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500 font-medium">Validité initiale : {ad.durationDays} jours</div>
                <div className="text-xs text-slate-700 font-bold">
                  Publiée le {new Date(ad.publishedAt).toLocaleDateString('fr-FR')}
                </div>
              </div>

              {/* Owner actions: Edit & Prolonger */}
              {isOwner && (
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                    Votre annonce
                  </span>
                  {onEditAd && (
                    <button
                      onClick={() => {
                        if (isExpired) {
                          alert("Cette annonce est expirée. Conformément aux règles, vous devez la prolonger au préalable pour pouvoir la modifier.");
                          onOpenExtendModal(ad);
                          return;
                        }
                        onClose();
                        onEditAd(ad);
                      }}
                      className={`${
                        isExpired
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                      } font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors`}
                      id="modal-edit-button"
                      title={isExpired ? "Prolongez d'abord l'annonce pour pouvoir la modifier" : "Modifier l'annonce"}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-white" />
                      <span>Modifier l'annonce</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenExtendModal(ad);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                    id="modal-extend-button"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Prolonger la durée</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider mb-2">
              Description de l'annonce
            </h4>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed">
              {ad.description}
            </div>
          </div>

          {/* Technical Specifications details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {ad.vehicleData && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-500 block mb-1">Détails Véhicule / Matériel</span>
                <p className="font-semibold text-slate-900">Catégorie : {ad.vehicleData.category}</p>
                {ad.vehicleData.brand && <p className="text-slate-700">Marque : <strong>{ad.vehicleData.brand}</strong></p>}
                {ad.vehicleData.model && <p className="text-slate-700">Modèle : <strong>{ad.vehicleData.model}</strong></p>}
              </div>
            )}

            {ad.domesticJobType && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-500 block mb-1">Catégorie Emploi de maison</span>
                <p className="font-semibold text-slate-900">{ad.domesticJobType}</p>
                <p className="text-slate-600 mt-0.5">Disponibilité : Immédiate au Gabon</p>
              </div>
            )}

            {(ad.mainCategory === 'COURS_A_DOMICILE' || ad.tutoringSubject) && (
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                <span className="font-bold text-indigo-900 block mb-1">Détails Cours à Domicile</span>
                <p className="font-semibold text-slate-900">
                  {ad.tutoringKind === 'DEMANDE' ? 'Demande de tuteur' : 'Offre de répétiteur'}
                </p>
                {ad.tutoringSubject && <p className="text-slate-700">Matière : <strong>{ad.tutoringSubject}</strong></p>}
                {ad.tutoringLevel && <p className="text-slate-700">Niveau : <strong>{ad.tutoringLevel}</strong></p>}
              </div>
            )}

            {(ad.mainCategory === 'NECROLOGIE' || ad.necroMinistry) && (
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-300 space-y-1">
                <span className="font-bold text-slate-800 block mb-1">Avis de Décès & Nécrologie</span>
                {(ad.necrologieData?.ministry || ad.necroMinistry) && (
                  <p className="text-slate-800">Ministère / Corps : <strong>{ad.necrologieData?.ministry || ad.necroMinistry}</strong></p>
                )}
                {(ad.necrologieData?.deceasedName || ad.necroDeceasedName) && (
                  <p className="text-slate-900 font-bold">Défunt(e) : {ad.necrologieData?.deceasedName || ad.necroDeceasedName}</p>
                )}
                {(ad.necrologieData?.ceremonyDate || ad.necroCeremonyDate) && (
                  <p className="text-slate-700">Cérémonie : {ad.necrologieData?.ceremonyDate || ad.necroCeremonyDate}</p>
                )}
                {(ad.necrologieData?.ceremonyLocation || ad.necroCeremonyLocation) && (
                  <p className="text-slate-700">Lieu : {ad.necrologieData?.ceremonyLocation || ad.necroCeremonyLocation}</p>
                )}
                {(ad.necrologieData?.familyContact || ad.necroFamilyContact) && (
                  <p className="text-slate-700">Contact famille : <strong>{ad.necrologieData?.familyContact || ad.necroFamilyContact}</strong></p>
                )}
                {(ad.necrologieData?.funeralProgram || ad.necroFuneralProgram) && (
                  <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                    {ad.necrologieData?.funeralProgram || ad.necroFuneralProgram}
                  </p>
                )}
              </div>
            )}

            {/* AVIS DE RECHERCHE DETAIL CARD (Point 2) */}
            {(ad.mainCategory === 'AVIS_DE_RECHERCHE' || ad.avisRechercheData) && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2">
                <span className="font-extrabold text-red-950 block text-xs uppercase tracking-wide">
                  Détails de l'Avis de Recherche & Signalement
                </span>
                {ad.avisRechercheData?.category && <p className="text-slate-800 text-xs">Catégorie : <strong>{ad.avisRechercheData.category}</strong></p>}
                {ad.avisRechercheData?.targetName && <p className="text-slate-900 font-bold text-xs">Cible / Élément recherché : {ad.avisRechercheData.targetName}</p>}
                {ad.avisRechercheData?.lastSeenLocation && <p className="text-slate-700 text-xs">Dernier lieu vu : {ad.avisRechercheData.lastSeenLocation}</p>}
                {ad.avisRechercheData?.lastSeenDate && <p className="text-slate-700 text-xs">Date de disparition : {ad.avisRechercheData.lastSeenDate}</p>}
                {ad.avisRechercheData?.rewardAmount ? (
                  <p className="text-emerald-700 font-black text-xs bg-emerald-100/70 p-2 rounded-lg border border-emerald-300">
                    💰 Récompense promise : {ad.avisRechercheData.rewardAmount.toLocaleString('fr-FR')} FCFA
                  </p>
                ) : null}
                {ad.avisRechercheData?.contactEmergency && (
                  <p className="text-red-700 font-black text-xs bg-red-100/70 p-2 rounded-lg border border-red-300">
                    🚨 Contact direct d'urgence : {ad.avisRechercheData.contactEmergency}
                  </p>
                )}
              </div>
            )}

            {/* AUTRES EMPLOIS DETAIL CARD WITH CV DOWNLOAD (Point 2) */}
            {(ad.mainCategory === 'AUTRES_EMPLOIS' || ad.autresEmploisData || ad.cvUrl) && (
              <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 space-y-3">
                <span className="font-extrabold text-teal-950 block text-xs uppercase tracking-wide">
                  Informations sur l'Emploi & Candidature
                </span>
                {ad.autresEmploisData?.subCategory && (
                  <p className="text-slate-800 text-xs">Type : <strong>{ad.autresEmploisData.subCategory}</strong></p>
                )}
                {ad.autresEmploisData?.profession && (
                  <p className="text-slate-800 text-xs">Métier / Poste : <strong>{ad.autresEmploisData.profession}</strong></p>
                )}
                {ad.autresEmploisData?.contractType && (
                  <p className="text-slate-700 text-xs">Contrat : <strong>{ad.autresEmploisData.contractType}</strong></p>
                )}
                {ad.autresEmploisData?.experienceYears && (
                  <p className="text-slate-700 text-xs">Expérience : <strong>{ad.autresEmploisData.experienceYears}</strong></p>
                )}

                {(ad.cvUrl || ad.cvFileName || ad.jobDocUrl || ad.autresEmploisData?.jobDocUrl) && (() => {
                  const isSeeker = ad.autresEmploisData?.subCategory === "Demandeur d'emploi" || ad.transactionType === 'CHERCHE_EMPLOI';
                  const docUrl = ad.jobDocUrl || ad.autresEmploisData?.jobDocUrl || ad.cvUrl;
                  const docFileName = ad.jobDocFileName || ad.autresEmploisData?.jobDocFileName || ad.cvFileName || (isSeeker ? 'Curriculum_Vitae_candidat' : 'Fiche_Poste_Emploi');
                  const docFileType = ad.jobDocFileType || ad.autresEmploisData?.jobDocFileType || ad.cvFileType || 'PDF';
                  const docFileSize = ad.jobDocFileSize || ad.autresEmploisData?.jobDocFileSize || ad.cvFileSize;

                  return (
                    <div className="bg-white border border-teal-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                          {docFileType || (isSeeker ? 'CV' : 'DOC')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {docFileName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {docFileSize ? `${(docFileSize / 1024).toFixed(0)} Ko` : 'Document joint'} • Format {docFileType.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      {docUrl && (
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={docFileName}
                          onClick={() => {
                            trackDownloadRequest(docFileSize || 250000);
                          }}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isSeeker ? 'Télécharger CV' : 'Télécharger la fiche de poste'}</span>
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-xs uppercase text-slate-500 tracking-wider block">Garantie BIZBOOSTER</span>
              <p className="text-slate-700 text-xs sm:text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Paiement certifié {ad.paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'}</span>
              </p>
              {isVerified && (
                <button
                  type="button"
                  onClick={() => setShowVerifiedModal(true)}
                  className="w-full text-left flex items-center justify-between gap-2 p-2 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg text-emerald-900 transition-colors group/garantie cursor-pointer"
                  title="En savoir plus sur la certification de l'annonceur"
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 group-hover/garantie:scale-110 transition-transform" />
                    <span>Annonceur Vérifié (Identité & Contact certifiés KYC)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 underline shrink-0">Détails</span>
                </button>
              )}
            </div>
          </div>

          {/* Advertiser Contact Info & Actions */}
          <div className={`${
            ad.mainCategory === 'NECROLOGIE'
              ? 'bg-slate-900 border border-slate-700'
              : ad.mainCategory === 'AVIS_DE_RECHERCHE'
              ? 'bg-red-950 border border-red-800'
              : 'bg-emerald-900'
          } text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md`}>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider ${
                ad.mainCategory === 'NECROLOGIE'
                  ? 'text-amber-300'
                  : ad.mainCategory === 'AVIS_DE_RECHERCHE'
                  ? 'text-red-300'
                  : 'text-emerald-300'
              }`}>
                {ad.mainCategory === 'NECROLOGIE' ? 'Contact Famille / Hommage' : ad.mainCategory === 'AVIS_DE_RECHERCHE' ? 'Contact Urgent / Signalement' : "Contact de l'annonceur"}
              </div>
              <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                {ad.mainCategory === 'NECROLOGIE' && (ad.necrologieData?.familyContact || ad.necroFamilyContact)
                  ? `Famille ${ad.necrologieData?.deceasedName || ad.necroDeceasedName || ad.contactName}`
                  : ad.contactName}
              </div>
              <div className={`text-xs font-mono mt-0.5 ${
                ad.mainCategory === 'NECROLOGIE'
                  ? 'text-slate-300'
                  : ad.mainCategory === 'AVIS_DE_RECHERCHE'
                  ? 'text-red-200'
                  : 'text-emerald-200'
              }`}>
                {ad.mainCategory === 'NECROLOGIE' && (ad.necrologieData?.familyContact || ad.necroFamilyContact)
                  ? (ad.necrologieData?.familyContact || ad.necroFamilyContact)
                  : (ad.avisRechercheData?.contactEmergency || ad.contactPhone)}
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <a
                href={getWhatsAppUrl(ad.contactPhone, ad.title)}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 font-extrabold text-xs px-4 py-3 rounded-xl shadow-md transition-colors ${
                  ad.mainCategory === 'NECROLOGIE'
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : ad.mainCategory === 'AVIS_DE_RECHERCHE'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{ad.mainCategory === 'NECROLOGIE' ? 'Condoléances (WhatsApp)' : ad.mainCategory === 'AVIS_DE_RECHERCHE' ? 'Signaler (WhatsApp)' : 'WhatsApp Direct'}</span>
              </a>

              <a
                href={`tel:${ad.mainCategory === 'NECROLOGIE' && (ad.necrologieData?.familyContact || ad.necroFamilyContact) ? (ad.necrologieData?.familyContact || ad.necroFamilyContact) : (ad.avisRechercheData?.contactEmergency || ad.contactPhone)}`}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-4 py-3 rounded-xl shadow-md transition-colors"
              >
                <Phone className="w-4 h-4 text-slate-800" />
                <span>{ad.mainCategory === 'NECROLOGIE' ? 'Appeler la famille' : ad.mainCategory === 'AVIS_DE_RECHERCHE' ? 'Appeler d\'urgence' : 'Appeler'}</span>
              </a>
            </div>
          </div>

          {/* Fraud reporting link */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Un doute sur la véracité ou le prix de cette annonce ?</span>
            </span>
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 hover:underline cursor-pointer text-xs"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Signaler une fraude</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fraud Report Modal */}
      <ReportAdModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        ad={ad}
      />

      {/* Social Media & Direct Share Modal */}
      <ShareAdModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        ad={ad}
      />

      {/* Verified Advertiser Info Modal */}
      {showVerifiedModal && (
        <VerifiedAdvertiserModal
          isOpen={showVerifiedModal}
          onClose={() => setShowVerifiedModal(false)}
          advertiserName={ad.contactName}
        />
      )}

      {/* Lightbox / Visualiseur Plein Écran Haute Résolution */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-70 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Header Lightbox */}
          <div
            className="flex items-center justify-between text-white shrink-0 pb-2 z-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <span className="text-xs font-black uppercase text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-500/30 shrink-0">
                REF: {ad.id.toUpperCase()}
              </span>
              <span className="text-xs font-semibold text-slate-300 truncate">
                {ad.title}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {hasMultipleImages && (
                <span className="text-xs font-bold text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                  📷 {activeImageIndex + 1} / {images.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                title="Fermer le plein écran (Échap)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Corps Image Plein Écran */}
          <div
            className="relative flex-1 flex items-center justify-center p-2 min-h-0 select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImage}
              alt={`${ad.title || 'Annonce'} - Photo ${activeImageIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-xl drop-shadow-2xl select-none"
              referrerPolicy="no-referrer"
            />

            {/* Flèches de navigation en plein écran */}
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  aria-label="Photo précédente"
                  title="Photo précédente"
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-all duration-200 shadow-xl backdrop-blur-xs z-30 hover:scale-110 cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  aria-label="Photo suivante"
                  title="Photo suivante"
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-all duration-200 shadow-xl backdrop-blur-xs z-30 hover:scale-110 cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Vignettes Lightbox */}
          {hasMultipleImages && (
            <div
              className="flex justify-center gap-2 overflow-x-auto py-2 shrink-0 z-80"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-14 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all bg-slate-900 cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-emerald-500 ring-2 ring-emerald-400 opacity-100 scale-105'
                      : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                  }`}
                  title={`Photo ${idx + 1}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
