import React from 'react';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Ad } from '../../../types';
import { formatFCFA, getAdTransactionBadge } from '../../../utils/formatters';

interface Step7ConfirmationProps {
  createdAd: Ad;
  onSwitchToUserDashboard?: () => void;
  onClose: () => void;
}

export const Step7Confirmation: React.FC<Step7ConfirmationProps> = ({
  createdAd,
  onSwitchToUserDashboard,
  onClose,
}) => {
  const badge = getAdTransactionBadge(createdAd);

  return (
    <div className="text-center py-6 space-y-4 animate-in fade-in">
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto border-2 border-amber-400 shadow-lg">
        <Clock className="w-8 h-8" />
      </div>

      <div>
        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
          Transmise à la modération
        </span>
        <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
          Votre annonce est en cours d'examen
        </h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 leading-relaxed">
          Afin de garantir la fiabilité du réseau et prévenir les fraudes au Gabon, un modérateur vérifie chaque publication avant sa mise en ligne publique (délai : sous 24 heures).
        </p>
      </div>

      {/* Verification Preview Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto text-left shadow-xs">
        <div className="flex items-center gap-3">
          {createdAd.images && createdAd.images[0] ? (
            <img
              src={createdAd.images[0]}
              alt=""
              className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
              Sans photo
            </div>
          )}
          <div className="overflow-hidden min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${badge.badgeClass}`}>
                {badge.label}
              </span>
              <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 px-1.5 py-0.5 rounded">
                En attente d'approbation
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 truncate">{createdAd.title}</h4>
            <p className="text-sm font-black text-emerald-700 mt-1">
              {formatFCFA(createdAd.price)}
            </p>
            <p className="text-[11px] text-slate-500">
              Durée de publication : {createdAd.durationDays} jours
            </p>
          </div>
        </div>
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
        {onSwitchToUserDashboard && (
          <button
            type="button"
            onClick={() => {
              onSwitchToUserDashboard();
              onClose();
            }}
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <span>Suivre dans Mon Espace Annonceur</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-5 py-3 rounded-xl transition-colors shadow-sm cursor-pointer min-h-[44px]"
        >
          Retourner au Catalogue
        </button>
      </div>
    </div>
  );
};

