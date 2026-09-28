import React, { useState } from 'react';
import {
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  PlusCircle,
  RefreshCw,
  LogOut,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  Trash2,
  Building2,
  Car,
  Package,
  Briefcase,
  Sparkles,
  ShieldAlert,
  FileText,
  X,
} from 'lucide-react';
import { Ad, UserProfile } from '../types';
import { formatFCFA, formatRemainingTime, isAdOwner } from '../utils/formatters';
import { KycUploadModal } from './KycUploadModal';

interface UserDashboardProps {
  currentUser: UserProfile;
  ads: Ad[];
  onOpenPublishModal: () => void;
  onOpenExtendModal: (ad: Ad) => void;
  onSelectAdDetail: (ad: Ad) => void;
  onDeleteAd: (adId: string) => void;
  onLogout: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  ads,
  onOpenPublishModal,
  onOpenExtendModal,
  onSelectAdDetail,
  onDeleteAd,
  onLogout,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'REJECTED'>('ALL');
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<string | null>(null);

  const isExempt = !!(currentUser.exemptFromPaymentAndKyc || currentUser.isExempt);
  const kycStatus = currentUser.idVerificationStatus || 'NOT_SUBMITTED';

  // Filter ads strictly belonging to this user
  const myAds = ads.filter((ad) => isAdOwner(ad, currentUser));

  const activeCount = myAds.filter((a) => a.status === 'ACTIVE').length;
  const pendingCount = myAds.filter((a) => a.status === 'PENDING_REVIEW').length;
  const rejectedCount = myAds.filter((a) => a.status === 'REJECTED').length;
  const totalViews = myAds.reduce((sum, a) => sum + (a.viewsCount || 0), 0);

  const displayedAds = myAds.filter((ad) => {
    if (filterStatus === 'ACTIVE') return ad.status === 'ACTIVE';
    if (filterStatus === 'PENDING') return ad.status === 'PENDING_REVIEW';
    if (filterStatus === 'REJECTED') return ad.status === 'REJECTED';
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* User Identity & Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-2xl shadow-lg border border-emerald-400/30 shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">{currentUser.name}</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Numéro Gabon Vérifié
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                currentUser.operator === 'AIRTEL' ? 'bg-red-900/60 text-red-200 border border-red-500/30' : 'bg-blue-900/60 text-blue-200 border border-blue-500/30'
              }`}>
                {currentUser.operator === 'AIRTEL' ? 'Airtel Gabon' : 'Moov Africa Gabon'}
              </span>
            </div>

            <p className="text-xs text-slate-300 flex items-center gap-2">
              <span className="font-bold text-white tracking-wide">{currentUser.contactPhone}</span>
              <span>•</span>
              <span>Charte CGU acceptée</span>
              <span>•</span>
              <span className="text-slate-400">Inscrit le {new Date(currentUser.createdAt).toLocaleDateString('fr-FR')}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onOpenPublishModal}
            className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Déposer une nouvelle annonce</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* KYC / VIP Status Banner */}
      {isExempt ? (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border border-amber-400/50 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm text-slate-900">Statut Privilégié / Partenaire VIP</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                  0 FCFA • Exemption Totale Active
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Votre compte bénéficie d'une dispense spéciale accordée par l'administration BizBooster. Vous publiez immédiatement sans frais et sans exigence de pièce d'identité.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenPublishModal}
            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Déposer sans frais</span>
          </button>
        </div>
      ) : kycStatus === 'VERIFIED' ? (
        <div className="bg-emerald-50/70 border border-emerald-300 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm text-slate-900">Identité Certifiée & Conforme</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {currentUser.idDocumentType === 'CNI' ? 'CNI Gabonaise' : currentUser.idDocumentType === 'PASSPORT' ? 'Passeport' : 'Titre de Séjour'} Validé
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Votre document d'identité a été validé par la modération. Vos annonces publiées bénéficient du badge officiel de confiance anti-fraude.
              </p>
            </div>
          </div>
          {currentUser.idDocumentUrl && (
            <button
              onClick={() => setPreviewDocModal(currentUser.idDocumentUrl || null)}
              className="text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100/70 border border-emerald-200 px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Voir ma pièce d'identité</span>
            </button>
          )}
        </div>
      ) : kycStatus === 'PENDING' ? (
        <div className="bg-amber-50/70 border border-amber-300 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm text-slate-900">Pièce d'identité en cours de vérification</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                  Examen par la modération
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Votre pièce d'identité a bien été reçue et est en cours d'examen. Vous pouvez déjà préparer vos annonces.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentUser.idDocumentUrl && (
              <button
                onClick={() => setPreviewDocModal(currentUser.idDocumentUrl || null)}
                className="text-xs font-bold text-amber-800 bg-white hover:bg-amber-100/70 border border-amber-200 px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Voir le document</span>
              </button>
            )}
            <button
              onClick={() => setIsKycModalOpen(true)}
              className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>Remplacer</span>
            </button>
          </div>
        </div>
      ) : kycStatus === 'REJECTED' ? (
        <div className="bg-red-50 border border-red-300 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 border border-red-300 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm text-red-950">Vérification d'identité refusée</span>
                <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-300">
                  Action obligatoire
                </span>
              </div>
              <p className="text-xs text-red-800 mt-1">
                <span className="font-bold">Motif : </span>
                {currentUser.idRejectionReason || 'Document illisible, expiré ou incomplet. Veuillez déposer un document valide.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsKycModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-colors flex items-center gap-1.5 shrink-0"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Soumettre un nouveau document</span>
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-50 via-amber-50/50 to-orange-50/30 border border-amber-300/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm text-slate-900">Vérification d'identité obligatoire avant publication</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                  Anti-Fraude Obligatoire
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Conformément aux règles anti-fraude BizBooster Gabon, les annonceurs doivent déposer une photo nette d'une pièce d'identité officielle (CNI, Titre de séjour ou Passeport valide) pour publier des annonces.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsKycModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Vérifier mon identité maintenant</span>
          </button>
        </div>
      )}

      {/* KPI Cards for the User */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'ALL' ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block mb-1">Total Déposées</span>
          <div className="text-2xl font-black text-slate-900">{myAds.length}</div>
          <span className="text-[10px] text-slate-400">Toutes rubriques</span>
        </div>

        <div
          onClick={() => setFilterStatus('PENDING')}
          className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700">En cours de modération</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
          <span className="text-[10px] text-amber-700">En examen par l'équipe</span>
        </div>

        <div
          onClick={() => setFilterStatus('ACTIVE')}
          className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'ACTIVE' ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700">En ligne (Actives)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
          <span className="text-[10px] text-emerald-700">Visibles sur le catalogue</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">Consultations</span>
            <Eye className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalViews}</div>
          <span className="text-[10px] text-slate-400">Vues totales générées</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Toutes ({myAds.length})
          </button>
          <button
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterStatus === 'PENDING' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>En attente de modération</span>
            <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            En ligne ({activeCount})
          </button>
          {rejectedCount > 0 && (
            <button
              onClick={() => setFilterStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-red-700 ${
                filterStatus === 'REJECTED' ? 'bg-red-600 text-white' : 'hover:bg-red-50'
              }`}
            >
              Rejetées ({rejectedCount})
            </button>
          )}
        </div>
      </div>

      {/* List of User's Ads */}
      {displayedAds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedAds.map((ad) => {
            const isPending = ad.status === 'PENDING_REVIEW';
            const isActive = ad.status === 'ACTIVE';
            const isRejected = ad.status === 'REJECTED';
            const { isExpired, label: remainingLabel } = formatRemainingTime(ad.expiresAt);

            return (
              <div
                key={ad.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all shadow-xs ${
                  isPending
                    ? 'border-amber-300 bg-amber-50/15'
                    : isRejected
                    ? 'border-red-300 bg-red-50/20'
                    : isExpired
                    ? 'border-red-200 bg-red-50/10'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div>
                  {/* Status Banner */}
                  {isPending && (
                    <div className="mb-3 p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black">En cours de vérification par l'administrateur</strong>
                        <span className="text-[11px] text-amber-800">
                          Votre annonce a bien été transmise avec votre paiement. Elle sera examinée et validée par l'équipe sous 24 heures.
                        </span>
                      </div>
                    </div>
                  )}

                  {isRejected && (
                    <div className="mb-3 p-3 bg-red-100/80 border border-red-300 rounded-xl text-xs text-red-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black">Publication refusée par la modération</strong>
                        <span className="text-[11px] text-red-800">
                          Motif : {ad.moderationReason || 'Non-respect des conditions de diffusion.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Header badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {ad.transactionType && (
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                            ad.transactionType === 'VENTE'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {ad.transactionType === 'VENTE' ? 'À VENDRE' : 'À LOUER'}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm">
                        {ad.mainCategory}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : isActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isRejected
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isPending ? 'En attente' : isActive ? 'En ligne' : isRejected ? 'Rejetée' : 'Expirée'}
                    </span>
                  </div>

                  <h3
                    onClick={() => onSelectAdDetail(ad)}
                    className="font-black text-slate-900 text-base hover:text-emerald-700 cursor-pointer line-clamp-1 mb-1"
                  >
                    {ad.title}
                  </h3>

                  <div className="text-emerald-700 font-black text-sm mb-3">
                    {formatFCFA(ad.price)}
                    {ad.priceUnit && ad.priceUnit !== 'total' && (
                      <span className="text-xs text-slate-500 font-medium">/{ad.priceUnit}</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-4">
                    {ad.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{ad.location.city}, quartier {ad.location.neighborhood} ({ad.location.province})</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">Durée souscrite : {ad.durationDays} jours</span>
                      {isActive && (
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {remainingLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onSelectAdDetail(ad)}
                    className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Aperçu</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isActive && (
                      <button
                        onClick={() => onOpenExtendModal(ad)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-xs flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Prolonger</span>
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteAd(ad.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer mon annonce"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <PlusCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-900">
              {filterStatus === 'ALL' ? 'Vous n\'avez pas encore déposé d\'annonce' : 'Aucune annonce dans ce statut'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Publiez votre bien immobilier (vente ou location), véhicule, objet ou offre d'emploi au Gabon en quelques minutes.
            </p>
          </div>

          <button
            onClick={onOpenPublishModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Déposer ma première annonce</span>
          </button>
        </div>
      )}

      {/* Identity Verification Upload Modal */}
      <KycUploadModal
        isOpen={isKycModalOpen}
        onClose={() => setIsKycModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Document Lightbox Preview Modal */}
      {previewDocModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-5 border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="font-black text-sm text-slate-900">Pièce d'identité enregistrée</h4>
                <p className="text-[11px] text-slate-500">Document transmis pour vérification anti-fraude</p>
              </div>
              <button
                onClick={() => setPreviewDocModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950/5 flex items-center justify-center p-2">
              <img src={previewDocModal} alt="Pièce d'identité" className="max-w-full max-h-[65vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
