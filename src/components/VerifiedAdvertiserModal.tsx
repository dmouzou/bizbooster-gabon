import React from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, CheckCircle2, AlertTriangle, UserCheck, Lock } from 'lucide-react';

interface VerifiedAdvertiserModalProps {
  isOpen: boolean;
  onClose: () => void;
  advertiserName?: string;
}

export const VerifiedAdvertiserModal: React.FC<VerifiedAdvertiserModalProps> = ({
  isOpen,
  onClose,
  advertiserName,
}) => {
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with emerald gradient */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-emerald-200 mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-emerald-300" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full inline-block mb-1">
            Certification Officielle
          </span>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Annonceur Vérifié
          </h3>
          <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
            Identité civile certifiée par l'équipe de modération BIZBOOSTER Gabon
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
          {advertiserName && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Identité vérifiée pour
                </span>
                <span className="text-sm font-extrabold text-emerald-950">
                  {advertiserName}
                </span>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-extrabold text-sm text-slate-900 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Qu'est-ce que ce badge garantit ?</span>
            </h4>
            <p className="text-slate-600">
              Cet annonceur a volontairement soumis une <strong>pièce d'identité officielle en cours de validité</strong> (Carte Nationale d'Identité gabonaise, Passeport biométrique ou Titre de séjour régulier au Gabon).
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block font-bold">Vérification manuelle</strong>
                <span>Le document a été contrôlé individuellement par notre service de conformité avant l'attribution de ce badge.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block font-bold">Lutte anti-fraude & anti-usurpation</strong>
                <span>Ce badge réduit considérablement les risques de faux profils et de publications frauduleuses.</span>
              </div>
            </div>
          </div>

          {/* Safety Reminder */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-amber-900 block font-bold">Rappel de prudence BIZBOOSTER :</strong>
              <p className="text-[11px] text-amber-800 leading-normal">
                Même avec un annonceur vérifié, privilégiez toujours les rencontres en plein jour dans des lieux publics et <strong>ne versez jamais d'argent d'avance</strong> via Mobile Money avant d'avoir inspecté le bien en personne.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
