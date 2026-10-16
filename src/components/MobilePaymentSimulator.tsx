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
  Clock,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PaymentOperator } from '../types';
import { formatFCFA } from '../utils/formatters';
import { initiateSingPay, pollSingPayStatus, QuoteLine } from '../services/singpay';
import { GABON_MOBILE_PREFIXES, detectOperator, normalizeGabonPhone } from '../utils/phone';

interface MobilePaymentSimulatorProps {
  amount?: number;
  itemDescription: string;
  productId: string;
  metadata?: Record<string, unknown>;
  onSuccess: (paymentInfo: {
    operator: PaymentOperator;
    contactPhone: string;
    transactionRef: string;
    amount?: number;
  }) => void;
  onCancel: () => void;
  initialPhone?: string;
}

export type PaymentStep =
  | 'FORM'
  | 'SENDING'
  | 'WAITING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED';

const to8Digits = (raw?: string) => {
  if (!raw) return '';
  const clean = normalizeGabonPhone(raw);
  if (clean.length === 8) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)}`;
  }
  return clean;
};

export const MobilePaymentSimulator: React.FC<MobilePaymentSimulatorProps> = ({
  amount: initialAmount = 0,
  itemDescription,
  productId,
  metadata,
  onSuccess,
  onCancel,
  initialPhone,
}) => {
  const [operator, setOperator] = useState<PaymentOperator>('MOOV_MONEY');
  const [mobileNumber, setMobileNumber] = useState(to8Digits(initialPhone) || '');
  const [phoneError, setPhoneError] = useState('');

  const [step, setStep] = useState<PaymentStep>('FORM');
  const [transactionRef, setTransactionRef] = useState('');
  const [serverAmount, setServerAmount] = useState<number>(initialAmount);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [expiresAtIso, setExpiresAtIso] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [isCheckingManual, setIsCheckingManual] = useState(false);

  // Clé d'idempotence unique par tentative
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2)
  );

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubscribeSnapshotRef = useRef<(() => void) | null>(null);
  const transactionRefRef = useRef<string>('');
  const stepRef = useRef<PaymentStep>('FORM');

  useEffect(() => {
    transactionRefRef.current = transactionRef;
  }, [transactionRef]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();
    };
  }, []);

  // Détection automatique de l'opérateur selon la saisie
  const handlePhoneChange = (val: string) => {
    setMobileNumber(val);
    setPhoneError('');

    const clean = normalizeGabonPhone(val);
    if (clean.length >= 2) {
      const detected = detectOperator(clean);
      if (detected === 'MOOV') {
        setOperator('MOOV_MONEY');
      } else if (detected === 'AIRTEL') {
        setOperator('AIRTEL_MONEY');
      }
    }
  };

  const cleanDigits = (raw: string) => normalizeGabonPhone(raw);

  // Relecture du document au retour sur l'onglet (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && stepRef.current === 'WAITING' && transactionRefRef.current) {
        try {
          const res = await pollSingPayStatus({ reference: transactionRefRef.current });
          if (res.status === 'SUCCESS') {
            handleFinalSuccess(transactionRefRef.current, res.amount);
          } else if (res.status === 'FAILED') {
            handleFinalFailure(res.failureReason || res.message || 'Paiement échoué.');
          } else if (res.status === 'EXPIRED') {
            handleFinalExpired();
          }
        } catch (e) {
          console.warn('Relecture visibilité:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleFinalSuccess = (ref: string, paidAmt?: number) => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();

    setStep('SUCCESS');
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}

    const digits = cleanDigits(mobileNumber);
    setTimeout(() => {
      onSuccess({
        operator,
        contactPhone: digits,
        transactionRef: ref,
        amount: paidAmt ?? serverAmount,
      });
    }, 1800);
  };

  const handleFinalFailure = (reason: string) => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();

    setStep('FAILED');
    setFailureReason(reason);
  };

  const handleFinalExpired = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();

    setStep('EXPIRED');
    setFailureReason("Le délai de validation de 3 minutes est dépassé. Vous pouvez réessayer un nouveau paiement.");
  };

  // Démarrer le compte à rebours basé sur expiresAt
  const startCountdownFromExpiresAt = (expiresIso: string) => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const targetTime = new Date(expiresIso).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.round((targetTime - now) / 1000));
      setCountdown(remainingSeconds);

      if (remainingSeconds <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        handleFinalExpired();
      }
    };

    updateTimer();
    countdownIntervalRef.current = setInterval(updateTimer, 1000);
  };

  // Déclencher le paiement
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = cleanDigits(mobileNumber);
    if (!digits || digits.length !== 8) {
      setPhoneError('Veuillez entrer un numéro de téléphone gabonais valide à 8 chiffres.');
      return;
    }

    if (operator === 'MOOV_MONEY') {
      const isMoov = (GABON_MOBILE_PREFIXES.MOOV as readonly string[]).some((p) => digits.startsWith(p));
      if (!isMoov) {
        setPhoneError('Préfixe Moov Money requis : le numéro doit commencer par 060, 062, 065 ou 066.');
        return;
      }
    } else if (operator === 'AIRTEL_MONEY') {
      const isAirtel = (GABON_MOBILE_PREFIXES.AIRTEL as readonly string[]).some((p) => digits.startsWith(p));
      if (!isAirtel) {
        setPhoneError('Préfixe Airtel Money requis : le numéro doit commencer par 074, 076 ou 077.');
        return;
      }
    }

    setPhoneError('');
    setStep('SENDING');
    setStatusMessage('Connexion à la passerelle SingPay Gabon...');

    try {
      const initResult = await initiateSingPay({
        productId,
        metadata,
        phoneNumber: digits,
        operator,
        idempotencyKey: idempotencyKeyRef.current,
      });

      const canonicalRef = initResult.reference;
      setTransactionRef(canonicalRef);
      setServerAmount(initResult.amount);
      if (initResult.lines) setQuoteLines(initResult.lines);
      if (initResult.expiresAt) {
        setExpiresAtIso(initResult.expiresAt);
        startCountdownFromExpiresAt(initResult.expiresAt);
      }

      const operatorLabel = operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money';
      setStep('WAITING');
      setStatusMessage(`Demande USSD Push transmise sur votre mobile ${operatorLabel}.`);

      // Écoute onSnapshot en temps réel sur payments/{canonicalRef}
      if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();

      const payDocRef = doc(db, 'payments', canonicalRef);
      unsubscribeSnapshotRef.current = onSnapshot(payDocRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        if (data.amount !== undefined) setServerAmount(data.amount);
        if (data.lines) setQuoteLines(data.lines);

        if (data.status === 'SUCCESS') {
          handleFinalSuccess(canonicalRef, data.amount);
        } else if (data.status === 'FAILED') {
          handleFinalFailure(data.errorReason || data.failureReason || 'Paiement non validé ou rejeté sur le téléphone mobile.');
        } else if (data.status === 'EXPIRED') {
          handleFinalExpired();
        }
      }, (err) => {
        console.warn('Erreur écoute payment snapshot:', err);
      });

    } catch (err: any) {
      console.error('SingPay initiation error:', err);
      setStep('FAILED');
      const msg = err.message || "Impossible d'initialiser le paiement avec SingPay.";
      setFailureReason(msg);
    }
  };

  // Bouton "Vérifier maintenant" en secours
  const handleCheckNow = async () => {
    if (!transactionRef || isCheckingManual) return;
    setIsCheckingManual(true);
    try {
      const res = await pollSingPayStatus({ reference: transactionRef });
      if (res.status === 'SUCCESS') {
        handleFinalSuccess(transactionRef, res.amount);
      } else if (res.status === 'FAILED') {
        handleFinalFailure(res.failureReason || res.message || 'Paiement rejeté.');
      } else if (res.status === 'EXPIRED') {
        handleFinalExpired();
      } else {
        setStatusMessage(res.message || 'Paiement toujours en attente sur votre téléphone...');
      }
    } catch (err: any) {
      console.warn('Erreur vérification manuelle:', err);
    } finally {
      setIsCheckingManual(false);
    }
  };

  const handleRetry = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();

    // Renouveler la clé d'idempotence pour la nouvelle tentative
    idempotencyKeyRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2);

    setStep('FORM');
    setFailureReason('');
    setPhoneError('');
    setExpiresAtIso(null);
    setCountdown(180);
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95">
      {/* En-tête */}
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
          <span className="text-xl font-black text-amber-400">{formatFCFA(serverAmount)}</span>
        </div>
      </div>

      {/* ÉTAPE 1: FORMULAIRE */}
      {step === 'FORM' && (
        <form onSubmit={handleInitiatePayment} className="space-y-4">
          {/* Sélecteur d'opérateur */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Opérateur de paiement mobile
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Moov Money */}
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

              {/* Airtel Money */}
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

          {/* Bandeau d'information */}
          <div
            className={`border rounded-2xl p-3 text-xs flex items-start gap-2.5 ${
              operator === 'AIRTEL_MONEY'
                ? 'bg-red-500/10 border-red-500/30 text-red-200'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
            }`}
          >
            <Radio
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'
              }`}
            />
            <div className="space-y-1">
              <p
                className={`font-bold ${
                  operator === 'AIRTEL_MONEY' ? 'text-red-300' : 'text-blue-300'
                }`}
              >
                Passerelle SingPay Gabon (USSD Push {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'})
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {operator === 'AIRTEL_MONEY'
                  ? "Paiement direct sécurisé via SingPay. La demande USSD Push s'affichera instantanément sur votre mobile Airtel pour validation par code PIN."
                  : "Paiement direct sécurisé via SingPay. La demande USSD Push s'affichera instantanément sur votre mobile Moov pour validation par code PIN."}
              </p>
            </div>
          </div>

          {/* Champ Téléphone */}
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
                placeholder={
                  operator === 'AIRTEL_MONEY'
                    ? 'Ex: 074 56 78 21 ou 77 00 00 00'
                    : 'Ex: 062 00 00 00 ou 66 00 00 00'
                }
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
              L'opérateur est détecté automatiquement d'après votre numéro.
            </p>
          </div>

          {/* Boutons d'action */}
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

      {/* ÉTAPE 2: SENDING */}
      {step === 'SENDING' && (
        <div className="text-center py-8 space-y-3">
          <Loader2
            className={`w-10 h-10 animate-spin mx-auto ${
              operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'
            }`}
          />
          <h4 className="font-bold text-sm text-white">Initialisation du paiement SingPay...</h4>
          <p className="text-xs text-slate-400">{statusMessage}</p>
        </div>
      )}

      {/* ÉTAPE 3: WAITING */}
      {step === 'WAITING' && (
        <div className="space-y-4 text-center py-2">
          <div className="relative inline-block mx-auto">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg ${
                operator === 'AIRTEL_MONEY'
                  ? 'bg-red-500/20 text-red-400 border-red-400'
                  : 'bg-blue-500/20 text-blue-400 border-blue-400'
              }`}
            >
              <PhoneCall
                className={`w-8 h-8 animate-pulse ${
                  operator === 'AIRTEL_MONEY' ? 'text-red-300' : 'text-blue-300'
                }`}
              />
            </div>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-ping">
              •
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="font-black text-base text-white">Demande USSD Push transmise !</h4>
            <p
              className={`text-xs font-semibold ${
                operator === 'AIRTEL_MONEY' ? 'text-red-300' : 'text-blue-300'
              }`}
            >
              Consultez maintenant l'écran de votre téléphone mobile
            </p>
          </div>

          <div
            className={`bg-slate-800/90 border rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-200 ${
              operator === 'AIRTEL_MONEY' ? 'border-red-500/40' : 'border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-slate-400">Opérateur :</span>
              <span
                className={`font-mono font-bold ${
                  operator === 'AIRTEL_MONEY' ? 'text-red-400' : 'text-blue-400'
                }`}
              >
                {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-slate-400">Numéro à débiter :</span>
              <span className="font-mono font-bold text-white">+241 {cleanDigits(mobileNumber)}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-slate-400">Montant calculé :</span>
              <span className="font-bold text-amber-400">{formatFCFA(serverAmount)}</span>
            </div>

            {quoteLines && quoteLines.length > 0 && (
              <div className="pb-2 border-b border-slate-700 space-y-1">
                <span className="text-slate-400 text-[11px] block font-semibold">Détail du devis :</span>
                {quoteLines.map((line, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-300">
                    <span className="truncate pr-2">{line.label}</span>
                    <span className="font-mono shrink-0">{formatFCFA(line.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Référence SingPay :</span>
              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[170px]">
                {transactionRef}
              </span>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2 text-left">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {operator === 'AIRTEL_MONEY' ? (
                <>
                  Une invite Airtel Money s'affiche sur votre téléphone. Saisissez votre{' '}
                  <strong>code secret (PIN) Airtel Money</strong> sur votre appareil pour valider le débit.
                </>
              ) : (
                <>
                  Une invite Moov Money s'affiche sur votre téléphone. Saisissez votre{' '}
                  <strong>code secret (PIN) Moov Money à 4 chiffres</strong> sur votre appareil pour valider le débit.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Délai de validation : {countdown}s restantes</span>
          </div>

          {/* Bouton Vérifier maintenant (Secours) */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCheckNow}
              disabled={isCheckingManual}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isCheckingManual ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Vérification en cours...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vérifier maintenant</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-slate-400 hover:text-white py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              Annuler la transaction
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 4: SUCCESS */}
      {step === 'SUCCESS' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/40">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h4 className="font-black text-lg text-emerald-400">
            Paiement {operator === 'AIRTEL_MONEY' ? 'Airtel Money' : 'Moov Money'} Validé !
          </h4>
          <p className="text-xs text-slate-300">
            Votre transaction SingPay a été confirmée avec succès. Vos avantages sont activés en temps réel.
          </p>
          <div className="text-[11px] font-mono text-slate-400 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            Réf : {transactionRef}
          </div>
        </div>
      )}

      {/* ÉTAPE 5: FAILED */}
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

      {/* ÉTAPE 6: EXPIRED */}
      {step === 'EXPIRED' && (
        <div className="text-center py-6 space-y-4">
          <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border-2 border-amber-500/40">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-base text-amber-400">Délai d'attente dépassé</h4>
            <p className="text-xs text-slate-300 leading-relaxed px-2">
              {failureReason || "Le délai de 3 minutes pour confirmer le paiement sur votre mobile a expiré."}
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
              <span>Nouvel essai</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
