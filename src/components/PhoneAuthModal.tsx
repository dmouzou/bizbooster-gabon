import React, { useState, useEffect, useRef } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signInWithCustomToken,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, functions } from '../services/firebase';
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
  Eye,
  EyeOff,
  MapPin,
  KeyRound,
} from 'lucide-react';
import { UserProfile } from '../types';
import { GABON_PROVINCES } from '../data/gabonLocations';

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

const getPhoneClean = (raw: string) => {
  return raw.replace(/[^0-9]/g, '');
};

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessLogin,
  initialMode = 'LOGIN',
}) => {
  // Stages:
  // 1 = Phone / Password login OR Phone input for SMS
  // 2 = SMS OTP Verification
  // 3 = New User Registration (Name, Location, Password, Terms)
  // 4 = Reset Password (after successful OTP for forgot password)
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);

  // Mode on Stage 1: default to login (phone + password), or registration (new user)
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordFlow, setIsForgotPasswordFlow] = useState(false);

  // Form states
  const [contactPhone, setContactPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [detectedOperator, setDetectedOperator] = useState<'AIRTEL' | 'MOOV'>('AIRTEL');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedProvince, setSelectedProvince] = useState(GABON_PROVINCES[0]?.name || 'Estuaire');
  const [selectedCity, setSelectedCity] = useState(GABON_PROVINCES[0]?.cities[0]?.name || 'Libreville');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [resendTimer, setResendTimer] = useState(45);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Cities matching selected province
  const availableCities = GABON_PROVINCES.find((p) => p.name === selectedProvince)?.cities || [];

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

  // Safe RecaptchaVerifier initializer & recycler
  const getOrCreateRecaptcha = () => {
    let container = document.getElementById('recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);
    }

    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch (e) {
        console.warn('Recaptcha clear warn:', e);
      }
      recaptchaRef.current = null;
    }
    try {
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } catch (e) {
      // ignore
    }
    container.innerHTML = '';

    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        if (recaptchaRef.current) {
          try {
            recaptchaRef.current.clear();
          } catch (e) {
            // ignore
          }
          recaptchaRef.current = null;
        }
      },
    });

    return recaptchaRef.current;
  };

  // Cleanup recaptcha when modal closes or unmounts
  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (e) {
          // ignore
        }
        recaptchaRef.current = null;
      }
      try {
        if ((window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setSuccessNotice(null);
      setStage(1);
      setIsRegisterMode(false);
      setOtpCode('');
      setPassword('');
      setConfirmPassword('');
      setIsForgotPasswordFlow(false);
      confirmationRef.current = null;
      setIsLoading(false);
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (e) {
          // ignore
        }
        recaptchaRef.current = null;
      }
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
    } else {
      setErrorMessage(null);
      setSuccessNotice(null);
      setOtpCode('');
      confirmationRef.current = null;
      setIsLoading(false);
    }
  }, [isOpen]);

  const sendCode = async () => {
    setErrorMessage(null);
    const e164 = formatGabonPhone(contactPhone);
    if (!/^\+241[67]\d{7}$/.test(e164)) {
      setErrorMessage('Numéro Gabon invalide (8 chiffres requis). Exemple : 77 45 20 18 (Airtel) ou 66 12 34 56 (Moov).');
      return false;
    }
    setIsLoading(true);
    try {
      const verifier = getOrCreateRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, e164, verifier);
      return true;
    } catch (err: any) {
      console.error('Firebase signInWithPhoneNumber error:', err);
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (e) {
          // ignore
        }
        recaptchaRef.current = null;
      }
      const errStr = (err?.message || '') + ' ' + (err?.code || '');
      if (errStr.includes('reCAPTCHA') || errStr.includes('element has been removed') || errStr.includes('captcha-check-failed')) {
        setErrorMessage('La vérification de sécurité a été réinitialisée. Veuillez cliquer à nouveau pour envoyer le SMS.');
        return false;
      }
      const messages: Record<string, string> = {
        'auth/invalid-phone-number': 'Numéro de téléphone invalide.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
        'auth/quota-exceeded': 'Quota SMS dépassé. Réessayez plus tard.',
        'auth/captcha-check-failed': 'Vérification anti-robot échouée. Veuillez cliquer à nouveau pour réessayer.',
        'auth/operation-not-allowed':
          'Politique de région SMS : vérifiez que le Gabon (+241) est activé dans Firebase Console > Authentication > Paramètres > Politique de région SMS (SMS Region Policy).',
      };
      setErrorMessage(messages[err.code] ?? (err.message || "Impossible d'envoyer le SMS. Réessayez."));
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

  const handleStartForgotPassword = async () => {
    setErrorMessage(null);
    const e164 = formatGabonPhone(contactPhone);
    if (!/^\+241[67]\d{7}$/.test(e164)) {
      setErrorMessage("Veuillez d'abord renseigner votre numéro Gabon (+241) dans le formulaire ci-dessus, puis cliquer sur 'Mot de passe oublié ?'.");
      return;
    }
    setIsForgotPasswordFlow(true);
    setSuccessNotice("Envoi du code de vérification SMS pour réinitialiser votre mot de passe...");
    if (await sendCode()) {
      setSuccessNotice(`Code SMS envoyé au ${e164}. Saisissez-le pour créer un nouveau mot de passe.`);
      setStage(2);
      setResendTimer(45);
    }
  };

  // Login via Phone + Password
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const e164 = formatGabonPhone(contactPhone);
    if (!/^\+241[67]\d{7}$/.test(e164)) {
      setErrorMessage('Numéro Gabon invalide (8 chiffres requis). Exemple : 77 45 20 18 ou 66 12 34 56.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      const cleanDigits = getPhoneClean(e164);
      const syntheticEmail = `${cleanDigits}@bizbooster.ga`;

      // 1. Authentification directe via Cloud Function (vérification Firestore & sync Auth)
      try {
        const loginFn = httpsCallable(functions, 'loginWithPhonePassword');
        const res = await loginFn({
          phoneNumber: e164,
          password: password.trim(),
        });
        const data = res.data as any;

        if (data?.customToken) {
          const cred = await signInWithCustomToken(auth, data.customToken);
          onSuccessLogin({ id: cred.user.uid, ...data.user } as UserProfile);
          return;
        }

        if (data?.syntheticEmail) {
          const userCred = await signInWithEmailAndPassword(auth, data.syntheticEmail, password.trim());
          const snap = await getDoc(doc(db, 'users', userCred.user.uid));
          const profile = snap.exists() ? { id: snap.id, ...snap.data() } : data.user;
          onSuccessLogin(profile as UserProfile);
          return;
        }
      } catch (fnErr: any) {
        console.warn('Cloud Function login error:', fnErr?.code, fnErr?.message);
        const code = fnErr?.code || '';
        const msg = fnErr?.message || '';

        if (code === 'functions/unauthenticated' || code === 'unauthenticated' || msg.includes('mot de passe incorrect')) {
          setErrorMessage(
            "Numéro ou mot de passe incorrect. Si vous avez oublié votre mot de passe, cliquez sur 'Mot de passe oublié ?' ci-dessus pour le réinitialiser par code SMS."
          );
          setIsLoading(false);
          return;
        } else if (code === 'functions/not-found' || code === 'not-found' || msg.includes('Aucun compte')) {
          setErrorMessage(
            "Aucun compte annonceur associé à ce numéro. Cliquez sur 'Nouveau sur BizBooster ? Créer un compte' ci-dessous pour créer votre profil."
          );
          setIsLoading(false);
          return;
        }
      }

      // 2. Direct client fallback via Firebase Auth email/pass (synthetic email)
      try {
        const userCred = await signInWithEmailAndPassword(auth, syntheticEmail, password.trim());
        const snap = await getDoc(doc(db, 'users', userCred.user.uid));
        if (snap.exists()) {
          const profile = {
            id: userCred.user.uid,
            password: snap.data().password || password.trim(),
            ...snap.data(),
          } as UserProfile;
          onSuccessLogin(profile);
          return;
        }
      } catch (authErr: any) {
        console.warn('signInWithEmailAndPassword fallback error:', authErr?.code);
        setErrorMessage(
          "Numéro ou mot de passe incorrect. Veuillez vérifier votre saisie ou cliquer sur 'Mot de passe oublié ?' pour réinitialiser votre mot de passe."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP code (Stage 2)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!confirmationRef.current) {
      setErrorMessage('La session de vérification a expiré. Veuillez renvoyer un code SMS.');
      setStage(1);
      return;
    }
    setIsLoading(true);
    try {
      const cred = await confirmationRef.current.confirm(otpCode);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));

      // Case A: User came from "Forgot Password" flow
      if (isForgotPasswordFlow) {
        setPassword('');
        setConfirmPassword('');
        setStage(4); // Promptly leads to enter and confirm new password
        return;
      }

      // Case B: Existing user with profile already created
      if (snap.exists() && snap.data().termsAccepted) {
        const profile = {
          id: cred.user.uid,
          password: snap.data().password || 'users-with-no-password',
          ...snap.data(),
        } as UserProfile;

        // Ensure default password is saved in Firestore if absent
        if (!snap.data().password) {
          try {
            await updateDoc(doc(db, 'users', cred.user.uid), {
              password: 'users-with-no-password',
            });
          } catch {
            // ignore
          }
        }

        onSuccessLogin(profile);
        return;
      }

      // Case C: Brand new user registration -> Proceed to Stage 3 to set name, location and create password
      setStage(3);
    } catch {
      setErrorMessage('Code SMS incorrect ou expiré.');
    } finally {
      setIsLoading(false);
    }
  };

  // Finalize Registration (Stage 3): Name, Location, Password, Terms
  const handleAcceptTermsAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Veuillez indiquer votre nom complet ou le nom de votre agence.');
      return;
    }

    if (!password.trim() || password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Vous devez accepter les Conditions Générales et la Charte Annonceur pour continuer.');
      return;
    }

    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorMessage('Session expirée. Veuillez renvoyer un code SMS.');
        setStage(1);
        return;
      }
      const uid = currentUser.uid;
      const phone = currentUser.phoneNumber || contactPhone;
      const cleanDigits = getPhoneClean(phone);
      const syntheticEmail = `${cleanDigits}@bizbooster.ga`;

      // 1. Link email/password credentials to current authenticated user
      try {
        const credential = EmailAuthProvider.credential(syntheticEmail, password.trim());
        await linkWithCredential(currentUser, credential);
      } catch (authErr: any) {
        console.warn('linkWithCredential notice:', authErr?.code, authErr?.message);
        try {
          await updatePassword(currentUser, password.trim());
        } catch (pwErr) {
          console.warn('updatePassword fallback notice:', pwErr);
        }
      }

      // 2. Persist profile with password, location and timestamp
      const newUser: UserProfile = {
        id: uid,
        contactPhone: phone,
        phoneNumber: currentUser.phoneNumber || phone,
        name: fullName.trim(),
        operator: detectedOperator,
        isVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        role: 'USER',
        exemptFromPaymentAndKyc: false,
        idVerificationStatus: 'NOT_SUBMITTED',
        createdAt: new Date().toISOString(),
        password: password.trim(),
        lastPasswordChangeDate: new Date().toISOString(),
        location: {
          province: selectedProvince,
          city: selectedCity,
        },
      };

      await setDoc(doc(db, 'users', uid), newUser);
      onSuccessLogin(newUser);
    } catch (err: any) {
      console.error('Error creating user profile:', err);
      setErrorMessage('Erreur lors de la création de votre profil. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password (Stage 4) after OTP confirmation
  const handleResetPasswordComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password.trim() || password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorMessage('Session expirée. Veuillez renvoyer un code SMS.');
        setStage(1);
        return;
      }
      const uid = currentUser.uid;
      const phone = currentUser.phoneNumber || contactPhone;
      const cleanDigits = getPhoneClean(phone);
      const syntheticEmail = `${cleanDigits}@bizbooster.ga`;

      // 1. Update Firebase Auth credential
      try {
        await updatePassword(currentUser, password.trim());
      } catch (authErr: any) {
        try {
          const credential = EmailAuthProvider.credential(syntheticEmail, password.trim());
          await linkWithCredential(currentUser, credential);
        } catch {
          // ignore
        }
      }

      // 2. Update Firestore user document
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'users', uid), {
        password: password.trim(),
        lastPasswordChangeDate: nowIso,
      });

      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        onSuccessLogin({ id: uid, ...snap.data(), password: password.trim(), lastPasswordChangeDate: nowIso } as UserProfile);
      }
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setErrorMessage('Erreur lors de la mise à jour du mot de passe. Veuillez réessayer.');
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
            {stage === 1 && (!isRegisterMode ? 'Connexion Espace Annonceur' : 'Créer un Compte Annonceur')}
            {stage === 2 && (isForgotPasswordFlow ? 'Code SMS OTP (Mot de Passe Oublié)' : 'Vérification du Code SMS OTP')}
            {stage === 3 && 'Finalisation & Sécurité du Compte'}
            {stage === 4 && 'Nouveau Mot de Passe Sécurisé'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {stage === 1 &&
              (!isRegisterMode
                ? 'Connectez-vous rapidement avec votre numéro de téléphone et votre mot de passe.'
                : 'Renseignez votre numéro pour recevoir un code de vérification SMS.')}
            {stage === 2 && `Un code SMS à 6 chiffres a été envoyé au ${contactPhone}.`}
            {stage === 3 && 'Créez votre profil annonceur et définissez votre mot de passe.'}
            {stage === 4 && 'Votre numéro a été vérifié par SMS OTP. Veuillez saisir et confirmer votre nouveau mot de passe.'}
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
          {errorMessage && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* STAGE 1: LOGIN (PHONE + PASSWORD) OR REGISTRATION */}
          {stage === 1 && (
            <div className="space-y-4">
              {/* Form A: Returning advertiser login with Phone & Password */}
              {!isRegisterMode ? (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Mot de passe
                      </label>
                      <button
                        type="button"
                        onClick={handleStartForgotPassword}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        required
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Se connecter</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(true);
                        setErrorMessage(null);
                        setSuccessNotice(null);
                      }}
                      className="text-xs text-slate-600 hover:text-emerald-700 font-semibold underline cursor-pointer"
                    >
                      Nouveau sur BizBooster ? Créer un compte annonceur
                    </button>
                  </div>
                </form>
              ) : (
                /* Form B: New user registration via SMS OTP */
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
                      <span>Opérateurs : <strong>Airtel</strong> et <strong>Moov</strong></span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        detectedOperator === 'AIRTEL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {detectedOperator === 'AIRTEL' ? 'Airtel Gabon' : 'Moov Gabon'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Validation par SMS sécurisée</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Un code OTP de 6 chiffres vous sera envoyé gratuitement pour valider votre numéro et sécuriser votre compte.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Envoyer le code SMS OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(false);
                        setErrorMessage(null);
                        setSuccessNotice(null);
                      }}
                      className="text-xs text-slate-600 hover:text-emerald-700 font-semibold underline cursor-pointer"
                    >
                      Déjà un compte ? Se connecter avec mon mot de passe
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STAGE 2: OTP CODE VERIFICATION */}
          {stage === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center space-y-1">
                <span className="text-xs text-slate-500">Code de sécurité à 6 chiffres envoyé au :</span>
                <p className="font-extrabold text-slate-800">{contactPhone}</p>
              </div>

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
                disabled={isLoading || otpCode.length < 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Vérifier le code SMS</span>}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STAGE 3: NEW USER REGISTRATION (NAME, LOCATION, PASSWORD & TERMS) */}
          {stage === 3 && (
            <form onSubmit={handleAcceptTermsAndComplete} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Votre Nom complet ou Dénomination Commerciale
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

              {/* Location Picker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Province
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => {
                      const prov = e.target.value;
                      setSelectedProvince(prov);
                      const matchingCities = GABON_PROVINCES.find((p) => p.name === prov)?.cities || [];
                      if (matchingCities.length > 0) {
                        setSelectedCity(matchingCities[0].name);
                      }
                    }}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  >
                    {GABON_PROVINCES.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Ville
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  >
                    {availableCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password creation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Créer un mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 caractères"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Confirmer mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Charter & Terms Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 max-h-36 overflow-y-auto text-xs text-slate-600">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Conditions Générales & Charte Déontologique (CGU Gabon)</span>
                </div>
                <ul className="space-y-1 text-[11px] list-disc pl-4 text-slate-700 leading-relaxed">
                  <li>Contrôle préalable obligatoire par l'administration avant parution.</li>
                  <li>Interdiction de publier des terrains ou parcelles sans titre légal régulier.</li>
                  <li>Exactitude impérative des tarifs indiqués en Francs CFA (XAF).</li>
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
                  J'accepte les Conditions Générales et la Charte Annonceur BizBooster Gabon.
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Finaliser mon inscription</span>}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STAGE 4: FORGOT PASSWORD RESET */}
          {stage === 4 && (
            <form onSubmit={handleResetPasswordComplete} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Votre numéro a été vérifié par SMS OTP. Veuillez saisir votre nouveau mot de passe.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nouveau mot de passe (min. 6 caractères)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nouveau mot de passe"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez le nouveau mot de passe"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                    minLength={6}
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Mettre à jour mon mot de passe</span>}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
