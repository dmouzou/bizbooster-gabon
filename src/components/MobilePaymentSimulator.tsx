import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, CheckCircle, AlertCircle, Loader2, Lock, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PaymentOperator } from '../types';
import { formatFCFA } from '../utils/formatters';

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
  const formattedInitial = to8Digits(initialPhone);
  const initialOperator: PaymentOperator =
    formattedInitial.startsWith('65') || formattedInitial.startsWith('66') || formattedInitial.startsWith('62')
      ? 'MOOV_MONEY'
      : 'AIRTEL_MONEY';

  const [operator, setOperator] = useState<PaymentOperator>(initialOperator);
  const [mobileNumber, setMobileNumber] = useState(
    formattedInitial || (initialOperator === 'AIRTEL_MONEY' ? '77 45 20 18' : '65 12 89 04')
  );
  const [step, setStep] = useState<'FORM' | 'PUSH_SENT' | 'PIN_ENTRY' | 'PROCESSING' | 'SUCCESS'>('FORM');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [countdown, setCountdown] = useState(45);

  // Switch default phone placeholder based on Gabon operator (8 digits)
  const handleOperatorChange = (op: PaymentOperator) => {
    setOperator(op);
    const clean = mobileNumber.replace(/[^0-9]/g, '');
    if (op === 'AIRTEL_MONEY' && (clean.startsWith('65') || clean.startsWith('66') || clean.startsWith('62'))) {
      setMobileNumber('77 45 20 18');
    } else if (op === 'MOOV_MONEY' && (clean.startsWith('74') || clean.startsWith('77') || clean.startsWith('76'))) {
      setMobileNumber('65 12 89 04');
    }
  };

  // Trigger simulated push
  const handleInitiatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || mobileNumber.length < 8) {
      return;
    }
    setStep('PUSH_SENT');

    // Simulate phone receiving the USSD push after 1.5 seconds
    setTimeout(() => {
      setStep('PIN_ENTRY');
    }, 1500);
  };

  // Countdown timer during push
  useEffect(() => {
    if (step === 'PIN_ENTRY' || step === 'PUSH_SENT') {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  // Validate PIN and complete
  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setPinError('Le code PIN doit comporter 4 chiffres');
      return;
    }
    setPinError('');
    setStep('PROCESSING');

    setTimeout(() => {
      setStep('SUCCESS');
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // Safe fallback
      }

      const ref = `${operator === 'AIRTEL_MONEY' ? 'AM' : 'MM'}-GAB-${Math.floor(100000 + Math.random() * 900000)}`;
      setTimeout(() => {
        onSuccess({
          operator,
          contactPhone: mobileNumber,
          transactionRef: ref
        });
      }, 1800);
    }, 2000);
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95">
      {/* Title */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 mb-3 shadow-inner">
          <Smartphone className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-white">
          Paiement Mobile au Gabon
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {itemDescription}
        </p>
        <div className="mt-3 bg-slate-800/80 border border-slate-700 py-2 px-4 rounded-xl inline-block">
          <span className="text-xs text-slate-400 mr-2">Montant à régler :</span>
          <span className="text-xl font-black text-amber-400">{formatFCFA(amount)}</span>
        </div>
      </div>

      {step === 'FORM' && (
        <form onSubmit={handleInitiatePayment} className="space-y-4">
          {/* Operator Selector: Airtel vs Moov */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Choisissez votre opérateur
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Airtel Money */}
              <button
                type="button"
                onClick={() => handleOperatorChange('AIRTEL_MONEY')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  operator === 'AIRTEL_MONEY'
                    ? 'bg-red-950/70 border-red-500 ring-2 ring-red-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
                  AM
                </div>
                <span className="font-bold text-xs">Airtel Money</span>
                <span className="text-[10px] text-red-300">74 / 77 / 76</span>
              </button>

              {/* Moov Money */}
              <button
                type="button"
                onClick={() => handleOperatorChange('MOOV_MONEY')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  operator === 'MOOV_MONEY'
                    ? 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
                  MM
                </div>
                <span className="font-bold text-xs">Moov Money</span>
                <span className="text-[10px] text-blue-300">65 / 66 / 62</span>
              </button>
            </div>
          </div>

          {/* Phone Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Numéro de téléphone Gabon ({operator === 'AIRTEL_MONEY' ? 'Airtel' : 'Moov'} • 8 chiffres)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                +241
              </span>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder={operator === 'AIRTEL_MONEY' ? '77 45 20 18' : '65 12 89 04'}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-14 pr-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-slate-400">Numéros test (8 chiffres) :</span>
              <button
                type="button"
                onClick={() => {
                  setOperator('AIRTEL_MONEY');
                  setMobileNumber('77 45 20 18');
                }}
                className="text-[10px] font-bold bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Airtel : 77 45 20 18
              </button>
              <button
                type="button"
                onClick={() => {
                  setOperator('MOOV_MONEY');
                  setMobileNumber('65 12 89 04');
                }}
                className="text-[10px] font-bold bg-blue-950/80 hover:bg-blue-900 border border-blue-500/50 text-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Moov : 65 12 89 04
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Une notification USSD push sera envoyée sur ce téléphone pour confirmation.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-2 flex items-center justify-center gap-2 text-white text-xs font-black py-2.5 rounded-xl shadow-lg transition-all ${
                operator === 'AIRTEL_MONEY'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>Valider et Payer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}

      {step === 'PUSH_SENT' && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
          <h4 className="font-bold text-sm text-white">Envoi de la requête de paiement...</h4>
          <p className="text-xs text-slate-400">
            Connexion au réseau {operator === 'AIRTEL_MONEY' ? 'Airtel Money Gabon' : 'Moov Money Gabon'} en cours
          </p>
        </div>
      )}

      {step === 'PIN_ENTRY' && (
        <form onSubmit={handleConfirmPin} className="space-y-4">
          <div className="bg-slate-800/90 border-2 border-amber-500/60 rounded-2xl p-4 text-center">
            <div className="inline-flex p-2 bg-amber-500/20 text-amber-400 rounded-full mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="font-black text-sm text-amber-300">Invite USSD Direct</h4>
            <p className="text-xs text-slate-200 mt-1">
              "Confirmez le débit de <strong>{formatFCFA(amount)}</strong> pour BIZBOOSTER. Entrez votre code PIN secret :"
            </p>

            <div className="mt-3">
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setPinError('');
                }}
                placeholder="• • • •"
                className="w-32 mx-auto tracking-[0.6em] text-center text-xl font-mono font-black bg-slate-900 border border-amber-400 rounded-xl py-2 text-amber-400 focus:outline-hidden"
              />
              {pinError && <p className="text-xs text-red-400 mt-1">{pinError}</p>}
            </div>

            <div className="text-[11px] text-slate-400 mt-3">
              Expire dans {countdown}s • Code de démo: tapez 4 chiffres quelconques (ex: 1234)
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Confirmer le paiement sécurisé</span>
          </button>
        </form>
      )}

      {step === 'PROCESSING' && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
          <h4 className="font-bold text-sm text-white">Traitement de la transaction...</h4>
          <p className="text-xs text-slate-400">
            Vérification du solde et débit en cours via le serveur de compensation.
          </p>
        </div>
      )}

      {step === 'SUCCESS' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h4 className="font-black text-base text-emerald-400">Paiement Réussi !</h4>
          <p className="text-xs text-slate-300">
            Votre annonce est automatiquement activée et mise en ligne sur le réseau BIZBOOSTER.
          </p>
        </div>
      )}
    </div>
  );
};
