import React, { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  X,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  MessageSquare,
  Sparkles,
  ArrowRight,
  RefreshCw,
  User,
  ShieldAlert,
} from 'lucide-react';
import { UserProfile } from '../types';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: UserProfile) => void;
  initialMode?: 'LOGIN' | 'PUBLISH_TRIGGER';
}

const formatGabonPhone = (raw: string) => {
  let clean = raw.replace(/[^0-9]/g, '');
  if (clean.startsWith('241')) clean = clean.slice(3);
  if (clean.startsWith('0')) clean = clean.slice(1);
  return `+241${clean}`;
};

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  initialMode = 'LOGIN',
}) => {
  // Stages: 1 = Phone Input, 2 = SMS OTP Verification, 3 = Terms & Name
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // Form states
  const [contactPhone, setContactPhone] = useState('');
  const phoneNumber = contactPhone;
  const [detectedOperator, setDetectedOperator] = useState<'AIRTEL' | 'MOOV'>('AIRTEL');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [resendTimer, setResendTimer] = useState(45);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-detect Gabon operator from phone number
  useEffect(() => {
    const clean = contactPhone.replace(/[^0-9]/g, '');
    if (clean.includes('77') || clean.includes('74') || clean.includes('76') || clean.startsWith('07') || clean.startsWith('7')) {
      setDetectedOperator('AIRTEL');
    } else if (clean.includes('66') || clean.includes('65') || clean.includes('62') || clean.startsWith('06') || clean.startsWith('6')) {
      setDetectedOperator('MOOV');
    }
  }, [contactPhone]);

  // Resend countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stage === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stage, resendTimer]);

  const sendCode = async () => {
    setErrorMessage(null);
    const e164 = formatGabonPhone(phoneNumber);
    if (!/^\+241[67]\d{7}$/.test(e164)) {
      setErrorMessage('Numéro invalide (8 chiffres requis). Exemple : 77 45 20 18 (Airtel) ou 66 12 34 56 (Moov).');
      return false;
    }
    setIsLoading(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      confirmationRef.current = await signInWithPhoneNumber(auth, e164, recaptchaRef.current);
      return true;
    } catch (err: any) {
      console.error('Firebase signInWithPhoneNumber error:', err);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      const messages: Record<string, string> = {
        'auth/invalid-phone-number': 'Numéro de téléphone invalide.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
        'auth/quota-exceeded': 'Quota SMS dépassé. Réessayez plus tard.',
        'auth/captcha-check-failed': 'Vérification anti-robot échouée. Rechargez la page.',
        'auth/operation-not-allowed':
          'Politique de région SMS : vérifiez que le Gabon (+241) est activé dans Firebase Console > Authentication > Paramètres > Politique de région SMS (SMS Region Policy).',
      };
      setErrorMessage(messages[err.code] ?? (err.message || 'Impossible d\'envoyer le SMS. Réessayez.'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sendCode()) {
      setStage(2);
      setResendTimer(45);
    }
  };

  // Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const cred = await confirmationRef.current!.confirm(otpCode);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists() && snap.data().termsAccepted) {
        onSuccessLogin(snap.data() as UserProfile);
        return;
      }
      setStage(3);
    } catch {
      setErrorMessage('Code SMS incorrect ou expiré.');
    } finally {
      setIsLoading(false);
    }
  };

  // Finalize Registration & Accept Terms
  const handleAcceptTermsAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!termsAccepted) {
      setErrorMessage('Vous devez accepter les Conditions Générales et la Charte Annonceur pour continuer.');
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage('Veuillez indiquer votre nom complet ou le nom de votre agence.');
      return;
    }

    setIsLoading(true);
    try {
      const uid = auth.currentUser!.uid;
      const phone = auth.currentUser?.phoneNumber || contactPhone;
      const newUser: UserProfile = {
        id: uid,
        contactPhone: phone,
        phoneNumber: auth.currentUser!.phoneNumber!,
        name: fullName.trim(),
        operator: detectedOperator,
        isVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        role: 'USER',
        exemptFromPaymentAndKyc: false,
        idVerificationStatus: 'NOT_SUBMITTED',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), newUser);
      onSuccessLogin(newUser);
    } catch {
      setErrorMessage('Erreur lors de la création de votre profil. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Authentification Annonceur Gabon
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            {stage === 1 && 'Connexion par Numéro Gabon'}
            {stage === 2 && 'Vérification du Code SMS'}
            {stage === 3 && 'Charte & Conditions de Publication'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {stage === 1 && 'La consultation du site est 100% gratuite. Pour publier et gérer vos annonces, connectez votre numéro Airtel ou Moov.'}
            {stage === 2 && `Un code SMS à 6 chiffres a été envoyé au ${contactPhone}.`}
            {stage === 3 && 'Finalisez votre profil annonceur et acceptez les conditions légales en vigueur au Gabon.'}
          </p>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`h-1.5 rounded-full transition-all ${stage >= 1 ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700'}`} />
            <div className={`h-1.5 rounded-full transition-all ${stage >= 2 ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700'}`} />
            <div className={`h-1.5 rounded-full transition-all ${stage >= 3 ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700'}`} />
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6">
          <div id="recaptcha-container"></div>
          {errorMessage && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STAGE 1: PHONE NUMBER INPUT */}
          {stage === 1 && (
            <form onSubmit={handleRequestSms} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Numéro de téléphone au Gabon (+241)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      🇬🇦 +241
                    </span>
                  </div>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="77 45 20 18 ou 66 12 34 56"
                    className="w-full pl-24 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    autoFocus
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>Opérateurs supportés : <strong>Airtel Gabon</strong> et <strong>Moov Africa</strong></span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    detectedOperator === 'AIRTEL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {detectedOperator === 'AIRTEL' ? 'Airtel Money Détecté' : 'Moov Money Détecté'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Pourquoi un numéro de téléphone vérifié ?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Pour garantir la sécurité des transactions au Gabon et lutter contre les faux démarcheurs, chaque annonceur doit être joignable et vérifié par SMS.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Recevoir le code SMS de validation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STAGE 2: OTP CODE VERIFICATION */}
          {stage === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center space-y-1">
                <span className="text-xs text-slate-500">Code de sécurité à 6 chiffres envoyé au :</span>
                <p className="font-extrabold text-slate-800">{contactPhone}</p>
              </div>

              {formatGabonPhone(contactPhone) === '+24177905165' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold flex items-center gap-1">
                      🧪 Numéro de test Firebase
                    </span>
                    <p className="text-[11px] text-amber-700">Code configuré : <strong>000000</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpCode('000000')}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Remplir 000000
                  </button>
                </div>
              )}

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ex: 582104"
                  className="w-full tracking-widest text-center text-2xl font-black py-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  autoFocus
                  required
                />
                <div className="flex items-center justify-between mt-2.5 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => setStage(1)}
                    className="text-slate-600 hover:text-slate-900 underline font-medium"
                  >
                    Changer de numéro
                  </button>

                  {resendTimer > 0 ? (
                    <span className="text-slate-400">Renvoyer dans {resendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        if (await sendCode()) setResendTimer(45);
                      }}
                      className="text-emerald-600 hover:text-emerald-700 font-bold underline"
                    >
                      Renvoyer le code SMS
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Vérifier le code SMS</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STAGE 3: TERMS & ADVERTISER CHARTER ACCEPTANCE */}
          {stage === 3 && (
            <form onSubmit={handleAcceptTermsAndComplete} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Votre Nom ou Dénomination Commerciale
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: M. OBAME Paul ou Agence Ogooué"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                    autoFocus
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Charter & Terms Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 max-h-48 overflow-y-auto text-xs text-slate-600">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Charte de Déontologie & Conditions Générales (CGU Gabon)</span>
                </div>
                
                <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-700 leading-relaxed">
                  <li>
                    <strong>Modération préalable obligatoire :</strong> Chaque annonce soumise est systématiquement contrôlée par notre équipe d'administration avant toute diffusion publique.
                  </li>
                  <li>
                    <strong>Immobilier & Foncier :</strong> Interdiction stricte de publier des terrains ou parcelles sans titre de propriété légal ou mandat régulier.
                  </li>
                  <li>
                    <strong>Matériel Roulant :</strong> Mention impérative de l'état réel et interdiction formelle des véhicules volés ou gagés.
                  </li>
                  <li>
                    <strong>Exactitude des prix :</strong> Précision obligatoire si le bien est proposé à la <em>Vente</em> ou à la <em>Location</em> avec son tarif en Francs CFA (XAF).
                  </li>
                </ul>
              </div>

              {/* Acceptance Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  required
                />
                <span className="text-xs text-slate-700 font-semibold leading-tight">
                  J'atteste sur l'honneur l'authenticité de mes biens, j'accepte les Conditions Générales d'Utilisation et le contrôle préalable par l'équipe de modération.
                </span>
              </label>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
              >
                <span>Accepter et Finaliser mon Inscription</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
