import React from 'react';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { MobilePaymentSimulator } from '../../../components/MobilePaymentSimulator';
import { PaymentOperator } from '../../../types';
import { formatFCFA } from '../../../utils/formatters';

interface Step6PaymentProps {
  isExempt: boolean;
  totalBillCalculated: number;
  itemDescription: string;
  preGeneratedAdId: string;
  durationDays: number;
  photoCount: number;
  hasVideo: boolean;
  isBoostFeatured: boolean;
  requiresSubscription: boolean;
  selectedTierToBuy: 'PRO' | 'ELITE' | 'BUSINESS';
  onPaymentSuccess: (paymentInfo: {
    operator: PaymentOperator;
    contactPhone: string;
    transactionRef: string;
    amount?: number;
  }) => void;
  onCancel: () => void;
  onPaymentPendingChange: (isPending: boolean) => void;
  initialPhone?: string;
  isSubmitting: boolean;
}

export const Step6Payment: React.FC<Step6PaymentProps> = ({
  isExempt,
  totalBillCalculated,
  itemDescription,
  preGeneratedAdId,
  durationDays,
  photoCount,
  hasVideo,
  isBoostFeatured,
  requiresSubscription,
  selectedTierToBuy,
  onPaymentSuccess,
  onCancel,
  onPaymentPendingChange,
  initialPhone,
  isSubmitting,
}) => {
  // Cas 1: Exonération VIP ou Montant nul (Gratuit)
  if (isExempt || totalBillCalculated === 0) {
    return (
      <div className="space-y-5 py-4 animate-in fade-in text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-300">
            {isExempt ? 'Partenaire VIP Exonéré' : 'Publication Gratuite'}
          </span>
          <h3 className="text-lg font-black text-slate-900 mt-2">
            Validation immédiate de votre publication
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 leading-relaxed">
            {isExempt
              ? "Votre compte dispose d'une exemption intégrale sur les frais de publication et les options de mise en avant."
              : "Cette publication est gratuite. Aucun paiement mobile n'est requis."}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              onPaymentSuccess({
                operator: 'AIRTEL_MONEY',
                contactPhone: initialPhone || '+24100000000',
                transactionRef: `VIP-EXEMPT-${Date.now()}`,
                amount: 0,
              })
            }
            className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm px-6 py-3.5 rounded-xl shadow-md transition-all cursor-pointer min-h-[48px] disabled:opacity-40"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Valider et transmettre à la modération</span>
          </button>
        </div>
      </div>
    );
  }

  // Cas 2: Paiement Mobile (Airtel Money / Moov Money)
  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Notice explicative USSD PIN */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-extrabold text-blue-950">
            Paiement sécurisé par notification Push USSD
          </p>
          <p className="text-blue-800 mt-0.5 leading-relaxed">
            Vous pouvez payer avec n'importe quel numéro Mobile Money du Gabon (Airtel ou Moov), même différent de votre compte. Vous recevrez une demande push sur votre téléphone pour confirmer avec votre code secret PIN.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-2 sm:p-4 shadow-xs">
        <MobilePaymentSimulator
          productId="AD_PUBLISH"
          metadata={{
            adId: preGeneratedAdId,
            durationDays,
            photoCount,
            hasVideo,
            withBoost: isBoostFeatured,
            requiresSubscription,
            selectedTierToBuy,
          }}
          amount={totalBillCalculated}
          itemDescription={itemDescription}
          onSuccess={onPaymentSuccess}
          onCancel={onCancel}
          onPaymentPendingChange={onPaymentPendingChange}
          initialPhone={initialPhone || ''}
        />
      </div>
    </div>
  );
};
