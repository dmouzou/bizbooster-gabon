import React from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { PublishStep } from '../publishTypes';

interface PublishHeaderProps {
  step: PublishStep;
  onPrevStep: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  isWaitingPayment: boolean;
  isExempt?: boolean;
}

const STEP_TITLES: Record<PublishStep, string> = {
  1: '1. Catégorie & Localisation spatiale',
  2: '2. Photos & Médias descriptifs',
  3: '3. Détails & Caractéristiques',
  4: '4. Prix, Durée & Options',
  5: "5. Aperçu de l'annonce",
  6: '6. Facturation & Paiement Mobile',
  7: '7. Annonce Transmise à la Modération',
};

export const PublishHeader: React.FC<PublishHeaderProps> = ({
  step,
  onPrevStep,
  onClose,
  isSubmitting,
  isWaitingPayment,
  isExempt,
}) => {
  const title =
    step === 6 && isExempt
      ? '6. Validation Partenaire VIP (Gratuit)'
      : STEP_TITLES[step];

  const progressPercent =
    step >= 7 ? 100 : Math.round(((step - 0.5) / 6) * 100);

  return (
    <header className="bg-emerald-950 text-white border-b border-emerald-900 shrink-0">
      <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {step > 1 && step < 7 && (
            <button
              type="button"
              onClick={onPrevStep}
              disabled={isSubmitting || isWaitingPayment}
              aria-label="Retour à l'étape précédente"
              className="p-2 -ml-2 text-emerald-300 hover:text-white hover:bg-emerald-900/60 rounded-xl transition-colors cursor-pointer disabled:opacity-40 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                BIZBOOSTER Gabon
              </span>
              <span className="text-xs text-emerald-300 font-semibold">
                {step < 7 ? `Étape ${step} sur 6` : 'Confirmation'}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-black tracking-tight text-white mt-0.5 truncate">
              {title}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isWaitingPayment || isSubmitting) return;
            onClose();
          }}
          disabled={isSubmitting || isWaitingPayment}
          aria-label={isWaitingPayment ? 'Paiement en cours' : 'Fermer la fenêtre'}
          className="text-emerald-400 hover:text-white p-2 rounded-xl hover:bg-emerald-900/60 disabled:opacity-30 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          title={isWaitingPayment ? 'Paiement en cours... Ne fermez pas la fenêtre' : 'Fermer'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Barre de progression fluide */}
      <div className="bg-emerald-900/80 h-1.5 w-full overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="bg-amber-400 h-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </header>
  );
};

