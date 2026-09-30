import React from 'react';
import { AlertTriangle, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { Ad } from '../types';

interface ConfirmEditOnlineModalProps {
  ad: Ad | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmEditOnlineModal: React.FC<ConfirmEditOnlineModalProps> = ({
  ad,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !ad) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-950/10 text-slate-950">
              <ShieldAlert className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-950">
                Avertissement de Modération
              </h3>
              <p className="text-[11px] font-semibold text-slate-900/80">
                Annonce actuellement en ligne
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-900/70 hover:text-slate-950 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-black text-amber-950 mb-1">
                Retrait temporaire de l'espace public
              </strong>
              Votre annonce <em>« {ad.title} »</em> est actuellement validée et visible par tous les acheteurs.
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Conformément à la politique de sécurité et de lutte anti-fraude de <strong>BIZBOOSTER Gabon</strong>, toute modification apportée à une annonce déjà publiée nécessite une nouvelle vérification par notre équipe de modération.
          </p>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="font-bold text-slate-900">Conséquences de la modification :</div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
              <li>L'annonce sera immédiatement <strong>retirée du catalogue public</strong></li>
              <li>Son statut repassera en <strong>« En attente de vérification »</strong></li>
              <li>Elle sera réactivée dès validation par un superviseur</li>
            </ul>
          </div>

          <p className="text-xs font-bold text-slate-800">
            Souhaitez-vous continuer et ouvrir le formulaire de modification ?
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfirm();
              }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span>Continuer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
