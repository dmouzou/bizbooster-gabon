import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  Radio,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PaymentOperator } from '../types';
import { formatFCFA } from '../utils/formatters';
import { initiateSingPay, pollSingPayStatus, MOOV_MERCHANT_NUMBER } from '../services/singpay';

interface MobilePaymentSimulatorProps {
  amount: number;
  itemDescription: string;
  onSuccess: (paymentInfo: { operator: PaymentOperator; contactPhone: string; transactionRef: string }) => void;
  onCancel: () => void;
  initialPhone?: string;
}

const to8Digits = (raw?: string) => {
  if (!raw) return '';
  let clean = raw.replace(/[^0-9]/g, '');
  if (clean.startsWith('241')) clean = clean.slice(3);
  if (clean.startsWith('0')) clean = clean.slice(1);
  if (clean.length === 8) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)}`;
  }
  return clean;
};

export const MobilePaymentSimulator: React.FC<MobilePaymentSimulatorProps> = ({
  amount,
  itemDescription,
  onSuccess,
  onCancel,
  initialPhone,
}) => {
  // Moov Money is active via SingPay; Airtel Money is on standby
  const [operator, setOperator] = useState<PaymentOperator>('MOOV_MONEY');
  const [mobileNumber, setMobileNumber] = useState(to8Digits(initialPhone) || '');
  const [phoneError, setPhoneError] = useState('');

  type PaymentStep =
    | 'FORM'
    | 'INITIATING'
    | 'WAITING_USSD_CONFIRMATION'
    | 'SUCCESS'
    | 'FAILED';

  const [step, setStep] = useState<PaymentStep>('FORM');
  const [transactionRef, setTransactionRef] = useState('');
  const [transactionId, setTransactionId] = useState<string | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [countdown, setCountdown] = useState(90);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handlePhoneChange = (val: string) => {
    setMobileNumber(val);
    setPhoneError('');
  };

  const cleanDigits = (raw: string) => {
    let clean = raw.replace(/[^0-9]/g, '');
    if (clean.startsWith('241')) clean = clean.slice(3);
    if (clean.startsWith('0')) clean = clean.slice(1);
    return clean;
  };

  // Trigger real SingPay USSD Push
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = cleanDigits(mobileNumber);
    if (!digits || digits.length !== 8) {
      setPhoneError('Veuillez entrer un numéro de téléphone gabonais à 8 chiffres.');
      return;
    }

    if (operator === 'MOOV_MONEY') {
      const isMoov =
        digits.startsWith('60') ||
        digits.startsWith('62') ||
        digits.startsWith('65') ||
        digits.startsWith('66');
      if (!isMoov) {
        setPhoneError('Préfixe Moov Money requis : le numéro doit commencer par 060, 062, 065 ou 066.');
        return;
      }
    } else if (operator === 'AIRTEL_MONEY') {
      const isAirtel =
        digits.startsWith('74') ||
        digits.startsWith('76') ||
        digits.startsWith('77') ||
        digits.startsWith('70') ||
        digits.startsWith('7');
      if (!isAirtel) {
        setPhoneError('Préfixe Airtel Money requis : le numéro doit commencer par 074, 076 ou 077.');
        return;
      }
    }

    setPhoneError('');
    setStep('INITIATING');
    setStatusMessage('Connexion à la passerelle SingPay Gabon...');

    const refPrefix = operator === 'AIRTEL_MONEY' ? 'SP-AM' : 'SP-MM';
    const generatedRef = `${refPrefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setTransactionRef(generatedRef);

    try {
      const initResult = await initiateSingPay({
        amount,
        phoneNumber: digits,
        reference: generatedRef,
        itemDescription,
        operator: operator,
      });

      const operatorLabel = operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money';
      setTransactionId(initResult.transactionId);
      setStep('WAITING_USSD_CONFIRMATION');
      setCountdown(90);
      setStatusMessage(`Demande USSD Push transmise sur votre mobile ${operatorLabel}.`);

      // Start countdown timer
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setStep('FAILED');
            setFailureReason('Délai d\'attente dépassé (timeout 90s). La transaction a expiré sans confirmation sur le téléphone.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start polling SingPay status every 3 seconds
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await pollSingPayStatus({
            transactionId: initResult.transactionId,
            reference: generatedRef,
          });

          if (statusRes.status === 'SUCCESS') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

            setStep('SUCCESS');
            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
              });
            } catch {}

            setTimeout(() => {
              onSuccess({
                operator: 'MOOV_MONEY',
                contactPhone: digits,
                transactionRef: generatedRef,
              });
            }, 1800);
          } else if (statusRes.status === 'FAILED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

            setStep('FAILED');
            setFailureReason(
              statusRes.failureReason ||
                statusRes.message ||
                'Paiement non validé ou rejeté sur le téléphone mobile.'
            );
          }
        } catch (err: any) {
          console.warn('Polling error:', err);
        }
      }, 3000);
    } catch (err: any) {
      console.error('SingPay initiation error:', err);
      setStep('FAILED');
      const msg = err.message || 'Impossible d\'initialiser le paiement avec SingPay.';
      setFailureReason(msg);
    }
  };

  const handleRetry = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setStep('FORM');
    setFailureReason('');
    setPhoneError('');
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 mb-2 shadow-inner">
          <Smartphone className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-white">
          Paiement Mobile au Gabon (SingPay)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
          {itemDescription}
        </p>
        <div className="mt-2.5 bg-slate-800/80 border border-slate-700 py-1.5 px-3.5 rounded-xl inline-block">
          <span className="text-xs text-slate-400 mr-2">Montant à régler :</span>
          <span className="text-xl font-black text-amber-400">{formatFCFA(amount)}</span>
        </div>
      </div>

      {/* STEP 1: FORM */}
      {step === 'FORM' && (
        <form onSubmit={handleInitiatePayment} className="space-y-4">
          {/* Operator Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Opérateur de paiement mobile
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Moov Money (ACTIVE) */}
              <button
                type="button"
                onClick={() => {
                  setOperator('MOOV_MONEY');
                  setPhoneError('');
                }}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer relative ${
                  operator === 'MOOV_MONEY'
                    ? 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
                  MM
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs">Moov Money</span>
                  {operator === 'MOOV_MONEY' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                </div>
                <span className="text-[10px] text-blue-300">060 / 062 / 065 / 066</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  SingPay Actif
                </span>
              </button>

              {/* Airtel Money (ACTIVE) */}
              <button
                type="button"
                onClick={() => {
                  setOperator('AIRTEL_MONEY');
                  setPhoneError('');
                }}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer relative ${
                  operator === 'AIRTEL_MONEY'
                    ? 'bg-red-950/70 border-red-500 ring-2 ring-red-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
                  AM
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs">Airtel Money</span>
                  {operator === 'AIRTEL_MONEY' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                </div>
                <span className="text-[10px] text-red-300">074 / 076 / 077</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  SingPay Actif
                </span>
              </button>
            </div>
          </div>

          {/* Info notice */}
          <div className={`border rounded-2xl p-3 text-xs flex items-start gap-2.5 ${
            operator === 'AIRTEL_MONEY'
              ? 'bg-red-500/10 border-red-500/30 text-red-200'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
          }`}>
            <Radio className={`w-4 h-4 shrink-0 mt-0.5 ${operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'}`} />
            <div className="space-y-1">
              <p className={`font-bold ${operator === 'AIRTEL_MONEY' ? 'text-red-300' : 'text-blue-300'}`}>
                Passerelle SingPay Gabon (USSD Push {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'})
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {operator === 'AIRTEL_MONEY'
                  ? 'Paiement direct sécurisé via SingPay. La demande USSD Push s\'affichera instantanément sur votre mobile Airtel pour validation par code PIN.'
                  : `Paiement direct sécurisé via SingPay. La demande USSD Push s'affichera instantanément sur votre mobile Moov pour validation par code PIN.`}
              </p>
            </div>
          </div>

          {/* Phone Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Votre numéro {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'} payeur
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                +241
              </span>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={operator === 'AIRTEL_MONEY' ? 'Ex: 074 56 78 21 ou 77 00 00 00' : 'Ex: 062 18 87 34 ou 66 00 00 00'}
                required
                className={`w-full bg-slate-800 border border-slate-700 rounded-xl pl-14 pr-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-hidden focus:ring-2 ${
                  operator === 'AIRTEL_MONEY' ? 'focus:ring-red-500' : 'focus:ring-blue-500'
                }`}
              />
            </div>
            {phoneError && (
              <p className="text-xs text-red-400 font-medium mt-1.5">{phoneError}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5">
              Un message de validation USSD apparaîtra automatiquement sur ce téléphone.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-2 flex items-center justify-center gap-2 text-white text-xs font-black py-2.5 rounded-xl shadow-lg transition-all cursor-pointer ${
                operator === 'AIRTEL_MONEY'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>Valider et Payer avec {operator === 'AIRTEL_MONEY' ? 'Airtel' : 'Moov'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: INITIATING */}
      {step === 'INITIATING' && (
        <div className="text-center py-8 space-y-3">
          <Loader2 className={`w-10 h-10 animate-spin mx-auto ${operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'}`} />
          <h4 className="font-bold text-sm text-white">Initialisation du paiement SingPay...</h4>
          <p className="text-xs text-slate-400">{statusMessage}</p>
        </div>
      )}

      {/* STEP 3: WAITING USSD CONFIRMATION ON USER'S ACTUAL MOBILE */}
      {step === 'WAITING_USSD_CONFIRMATION' && (
        <div className="space-y-4 text-center py-2">
          <div className="relative inline-block mx-auto">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg ${
              operator === 'AIRTEL_MONEY'
                ? 'bg-red-500/20 text-red-400 border-red-400'
                : 'bg-blue-500/20 text-blue-400 border-blue-400'
            }`}>
              <PhoneCall className={`w-8 h-8 animate-pulse ${operator === 'AIRTEL_MONEY' ? 'text-red-300' : 'text-blue-300'}`} />
            </div>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-ping">
              •
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="font-black text-base text-white">Demande USSD Push transmise !</h4>
            <p className={`text-xs font-semibold ${operator === 'AIRTEL_MONEY' ? 'text-red-300' : 'text-blue-300'}`}>
              Consultez maintenant l'écran de votre téléphone mobile
            </p>
          </div>

          <div className={`bg-slate-800/90 border rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-200 ${
            operator === 'AIRTEL_MONEY' ? 'border-red-500/40' : 'border-blue-500/40'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-slate-400">Opérateur :</span>
              <span className={`font-mono font-bold ${operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'}`}>
                {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-slate-400">Numéro à débiter :</span>
              <span className="font-mono font-bold text-white">+241 {cleanDigits(mobileNumber)}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-slate-400">Montant :</span>
              <span className="font-bold text-amber-400">{formatFCFA(amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Référence SingPay :</span>
              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[170px]">{transactionRef}</span>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2 text-left">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {operator === 'AIRTEL_MONEY' ? (
                <>Une invite Airtel Money s'affiche sur votre téléphone. Saisissez votre <strong>code secret (PIN) Airtel Money</strong> sur votre appareil pour valider le débit.</>
              ) : (
                <>Une invite Moov Money s'affiche sur votre téléphone. Saisissez votre <strong>code secret (PIN) Moov Money à 4 chiffres</strong> sur votre appareil pour valider le débit.</>
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1">
            <Loader2 className={`w-3.5 h-3.5 animate-spin ${operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'}`} />
            <span>En attente de votre confirmation... ({countdown}s restantes)</span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-xs text-slate-400 hover:text-white py-2 rounded-xl transition-colors cursor-pointer"
          >
            Annuler la transaction
          </button>
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {step === 'SUCCESS' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/40">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h4 className="font-black text-lg text-emerald-400">
            Paiement {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'} Validé !
          </h4>
          <p className="text-xs text-slate-300">
            Votre transaction SingPay a été confirmée avec succès. Votre opération est en cours d'activation.
          </p>
          <div className="text-[11px] font-mono text-slate-400 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            Réf : {transactionRef}
          </div>
        </div>
      )}

      {/* STEP 5: FAILED */}
      {step === 'FAILED' && (
        <div className="text-center py-6 space-y-4">
          <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/40">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-base text-red-400">Échec du paiement</h4>
            <p className="text-xs text-slate-300 leading-relaxed px-2">
              {failureReason}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex-2 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 rounded-xl shadow-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer le paiement</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
