import React, { useState } from 'react';
import { X, MapPin, Phone, MessageSquare, Clock, Calendar, CheckCircle2, RefreshCw, Shield, Share2, Video, Flag, ShieldAlert, Eye, Edit3 } from 'lucide-react';
import { Ad, UserProfile } from '../types';
import { formatFCFA, formatRemainingTime, getWhatsAppUrl, isAdOwner } from '../utils/formatters';
import { ReportAdModal } from './ReportAdModal';
import { ShareAdModal } from './ShareAdModal';

interface AdDetailModalProps {
  ad: Ad | null;
  onClose: () => void;
  onOpenExtendModal: (ad: Ad) => void;
  onEditAd?: (ad: Ad) => void;
  currentUser?: UserProfile | null;
}

export const AdDetailModal: React.FC<AdDetailModalProps> = ({ ad, onClose, onOpenExtendModal, onEditAd, currentUser }) => {
  if (!ad) return null;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { isExpired, label: remainingTimeLabel } = formatRemainingTime(ad.expiresAt);
  const isOwner = isAdOwner(ad, currentUser ?? null);

  return (
    <div className="app-modal-overlay">
      <div
        className="app-modal-dialog bg-white max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-300/80 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/70 px-2.5 py-1 rounded-lg border border-amber-500/30 shrink-0">
              REF: {ad.id.toUpperCase()}
            </span>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              BIZBOOSTER Gabon
            </span>
          </div>

          <div className="flex items-center gap-2">
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
              {ad.mainCategory === 'EMPLOI' ? (
                <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-300">
                  À EMPLOYER (Emploi)
                </span>
              ) : ad.transactionType ? (
                <span
                  className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                    ad.transactionType === 'VENTE'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {ad.transactionType === 'VENTE' ? 'À VENDRE (Achat)' : 'À LOUER (Location)'}
                </span>
              ) : null}

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

          {/* Photo Gallery */}
          <div>
            <div className="aspect-16/10 sm:aspect-16/9 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={ad.images?.[activeImageIndex] || ad.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80'}
                alt={ad.title || 'Annonce'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {(ad.images?.length || 0) > 1 && (
              <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1">
                {(ad.images || []).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      activeImageIndex === idx ? 'border-emerald-600 ring-2 ring-emerald-400' : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
            <div>
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                {ad.mainCategory === 'EMPLOI' ? "Salaire proposé par l'employeur" : "Prix fixé par l'annonceur"}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                  {formatFCFA(ad.price)}
                </span>
                {ad.priceUnit && ad.priceUnit !== 'total' && (
                  <span className="text-sm font-bold text-slate-600">
                    /{ad.priceUnit}
                  </span>
                )}
              </div>
            </div>

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
                        onClose();
                        onEditAd(ad);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                      id="modal-edit-button"
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

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500 block mb-1">Garantie BIZBOOSTER</span>
              <p className="text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Paiement certifié {ad.paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'}</span>
              </p>
              <p className="text-slate-500 text-[11px] mt-1">Réf transac: {ad.transactionRef || 'AM-GAB-LIVE'}</p>
            </div>
          </div>

          {/* Advertiser Contact Info & Actions */}
          <div className="bg-emerald-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">Contact de l'annonceur</div>
              <div className="text-base sm:text-lg font-bold text-white mt-0.5">{ad.contactName}</div>
              <div className="text-xs text-emerald-200 font-mono mt-0.5">{ad.contactPhone}</div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <a
                href={getWhatsAppUrl(ad.contactPhone, ad.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-xs px-4 py-3 rounded-xl shadow-md transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-emerald-950" />
                <span>WhatsApp Direct</span>
              </a>

              <a
                href={`tel:${ad.contactPhone}`}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-4 py-3 rounded-xl shadow-md transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-700" />
                <span>Appeler</span>
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
    </div>
  );
};
