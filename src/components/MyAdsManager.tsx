import React from 'react';
import { RefreshCw, Clock, Eye, AlertCircle, PlusCircle, Calendar, ShieldCheck, Edit3 } from 'lucide-react';
import { Ad } from '../types';
import { formatFCFA, formatRemainingTime } from '../utils/formatters';

interface MyAdsManagerProps {
  ads: Ad[];
  onOpenExtendModal: (ad: Ad) => void;
  onEditAd: (ad: Ad) => void;
  onOpenPublishModal: () => void;
  onSelectAd: (ad: Ad) => void;
}

export const MyAdsManager: React.FC<MyAdsManagerProps> = ({
  ads,
  onOpenExtendModal,
  onEditAd,
  onOpenPublishModal,
  onSelectAd,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
              Espace Annonceur
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              Section C - Cahier des charges
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Gestion & Prolongation des Annonces
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Surveillez le temps imparti restant pour chacune de vos annonces et rechargez leur durée via Airtel Money ou Moov Money avant expiration automatique.
          </p>
        </div>

        <button
          onClick={onOpenPublishModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nouvelle Annonce</span>
        </button>
      </div>

      {/* Ads List Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ads.map((ad) => {
          const { isExpired, label: remainingLabel, days, hours } = formatRemainingTime(ad.expiresAt);

          return (
            <div
              key={ad.id}
              className={`bg-white rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all ${
                isExpired ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {ad.mainCategory === 'EMPLOI' || ad.transactionType === 'EMPLOYER' ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 border border-purple-300">
                        À EMPLOYER
                      </span>
                    ) : ad.transactionType ? (
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                          ad.transactionType === 'VENTE'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {ad.transactionType === 'VENTE' ? 'À VENDRE' : 'À LOUER'}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm">
                      {ad.mainCategory}
                    </span>
                  </div>

                  <div
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                      isExpired
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : days <= 3
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{remainingLabel}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <img
                    src={ad.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=500&q=80'}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="overflow-hidden">
                    <h4
                      onClick={() => onSelectAd(ad)}
                      className="font-bold text-xs text-slate-900 line-clamp-1 hover:text-emerald-700 cursor-pointer"
                    >
                      {ad.title}
                    </h4>
                    <p className="text-sm font-black text-emerald-700 mt-0.5">
                      {formatFCFA(ad.price)}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {ad.location ? `${ad.location.city} (${ad.location.neighborhood})` : 'Gabon'} • {ad.viewsCount || 0} vue{(ad.viewsCount || 0) > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-400 font-medium">
                  {ad.publishedAt ? `Publié le ${new Date(ad.publishedAt).toLocaleDateString('fr-FR')}` : 'En attente'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditAd(ad)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200"
                    title="Modifier cette annonce"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Modifier</span>
                  </button>

                  {/* Prolonger Button explicitly honoring section C-NB */}
                  <button
                    onClick={() => onOpenExtendModal(ad)}
                    className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    id={`prolong-my-ad-${ad.id}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Prolonger (+jours)</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
