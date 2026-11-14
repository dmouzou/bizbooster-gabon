import React from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { PublishStep } from '../publishTypes';

interface PublishFooterProps {
  step: PublishStep;
  onPrevStep: () => void;
  onNextStep: () => void;
  isSubmitting: boolean;
  isDisabled?: boolean;
  nextLabel?: string;
}

export const PublishFooter: React.FC<PublishFooterProps> = ({
  step,
  onPrevStep,
  onNextStep,
  isSubmitting,
  isDisabled,
  nextLabel,
}) => {
  if (step >= 6) {
    return null;
  }

  const defaultNextLabel =
    step === 1
      ? 'Passer aux photos'
      : step === 2
      ? 'Passer aux détails'
      : step === 3
      ? 'Définir prix et durée'
      : step === 4
      ? "Voir l'aperçu"
      : 'Passer au paiement';

  const label = nextLabel || defaultNextLabel;

  return (
    <footer className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {step > 1 ? (
        <button
          type="button"
          onClick={onPrevStep}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Précédent</span>
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        disabled={isDisabled || isSubmitting}
        onClick={onNextStep}
        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-black px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
        id="publish-next-step"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Chargement...</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </footer>
  );
};
