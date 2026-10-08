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
import { trackSmsSent } from '../services/platformMetrics';
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
import { CguModal } from './CguModal';
import { checkPasswordCooldown, recordPasswordCooldown } from '../utils/passwordCooldown';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: UserProfile) => void;
  initialMode?: 'LOGIN' | 'PUBLISH_TRIGGER';
}

const getPhoneClean = (raw: string): string => {
  let clean = raw.replace(/[^0-9]/g, '');
  if (clean.startsWith('241')) clean = clean.slice(3);
  while (clean.startsWith('0')) clean = clean.slice(1);
  return clean;
};

const formatGabonPhone = (raw: string): string => {
  const clean = getPhoneClean(raw);
  return `+241${clean}`;
};

const formatGabonPhoneForSms = (raw: string): string => {
  const clean = getPhoneClean(raw);
  return `+2410${clean}`;
};

export const TEST_PHONE_CODES: Record<string, string> = {
  '+24167256341': '555555',
  '+24177874707': '000111',
  '+24167896902': '111777',
  '+24177276895': '777777',
  '+24177905165': '000000',
  '+24167443312': '676767',
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
  const [showCguModal, setShowCguModal] = useState(false);

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
        // ignore
      }
      recaptchaRef.current = null;
    }

    auth.languageCode = 'fr';
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
    } else {
      setErrorMessage(null);
      setSuccessNotice(null);
      setOtpCode('');
      confirmationRef.current = null;
      setIsLoading(false);
    }
  }, [isOpen]);

  const sendCode = async () => {
    if (isLoading) return false;
    setErrorMessage(null);
    setSuccessNotice(null);
    const cleanDigits = getPhoneClean(contactPhone);
    if (!/^[67]\d{7}$/.test(cleanDigits)) {
      setErrorMessage('Numéro Gabon invalide (8 chiffres requis). Exemple : 74 56 78 21 (ou 074 56 78 21) pour Airtel, 62 52 08 03 (ou 062 52 08 03) pour Moov.');
      return false;
    }
    setIsLoading(true);

    const phoneStandard = formatGabonPhone(contactPhone);

    try {
      const verifier = getOrCreateRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, phoneStandard, verifier);
      await trackSmsSent(phoneStandard);
      const testCode = TEST_PHONE_CODES[phoneStandard];
      setSuccessNotice(
        testCode
          ? `Code de confirmation SMS envoyé au ${phoneStandard} (Numéro de test : code ${testCode}).`
          : `Code de confirmation SMS envoyé avec succès au ${phoneStandard}.`
      );
      return true;
    } catch (err: any) {
      console.warn('Firebase signInWithPhoneNumber returned:', err);
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (e) {
          // ignore
        }
        recaptchaRef.current = null;
      }

      const errStr = ((err?.message || '') + ' ' + (err?.code || '')).toLowerCase();
      if (errStr.includes('recaptcha') || errStr.includes('element has been removed') || errStr.includes('captcha-check-failed')) {
        setErrorMessage('La vérification de sécurité a été réinitialisée. Veuillez cliquer à nouveau pour envoyer le SMS.');
        return false;
      }
      if (errStr.includes('error-code:-39') || err?.code === 'auth/error-code:-39') {
        const testCode = TEST_PHONE_CODES[phoneStandard];
        if (testCode) {
          setErrorMessage(
            `L'envoi de SMS réel a été temporairement restreint par Google anti-abus. Ce numéro est configuré en test : vous pouvez utiliser le code ${testCode}.`
          );
        } else {
          setErrorMessage(
            "L'envoi de SMS est temporairement limité par le système de sécurité anti-abus de Google pour ce numéro ou cet opérateur. Connectez-vous avec votre mot de passe ou réessayez ultérieurement."
          );
        }
        return false;
      }
      const messages: Record<string, string> = {
        'auth/invalid-phone-number': 'Numéro de téléphone invalide (+241 requis, 8 chiffres).',
        'auth/too-many-requests': 'Trop de tentatives d\'envoi de SMS. Veuillez patienter quelques minutes avant de réessayer.',
        'auth/quota-exceeded': 'Le quota d\'envoi de SMS est temporairement saturé. Veuillez réessayer plus tard ou vous connecter avec votre mot de passe.',
        'auth/captcha-check-failed': 'Vérification anti-robot échouée. Veuillez cliquer à nouveau pour réessayer.',
        'auth/operation-not-allowed':
          'La connexion par SMS n\'est pas activée ou est restreinte pour la région Gabon (+241) dans Firebase.',
        'auth/unauthorized-domain':
          'Ce domaine n\'est pas autorisé pour l\'envoi de SMS dans Firebase Authentication.',
        'auth/internal-error':
          'Impossible d\'expédier le code SMS vers cet opérateur (+241). Vérifiez votre numéro ou connectez-vous avec votre mot de passe.',
        'auth/error-code:-39':
          "L'envoi de SMS est temporairement bloqué par la sécurité anti-abus de Google. Connectez-vous avec votre mot de passe ou utilisez le code de test.",
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
    const cleanDigits = getPhoneClean(contactPhone);
    if (!/^[67]\d{7}$/.test(cleanDigits)) {
      setErrorMessage("Veuillez d'abord renseigner votre numéro Gabon (+241) dans le formulaire ci-dessus, puis cliquer sur 'Mot de passe oublié ?'.");
      return;
    }

    const phoneWithoutZero = formatGabonPhone(contactPhone);
    const phoneForSms = formatGabonPhoneForSms(contactPhone);

    // Point 4: Vérification stricte du délai de 24h avant renouvellement de mot de passe
    setIsLoading(true);
    try {
      const cooldownCheck = await checkPasswordCooldown(phoneWithoutZero);
      if (cooldownCheck.isBlocked) {
        setErrorMessage(
          `Votre mot de passe a été récemment modifié dans les dernières 24 heures. Pour prévenir les abus d'envoi de SMS et sécuriser votre compte, vous pourrez réinitialiser votre mot de passe dans ${cooldownCheck.remainingHours} heure${cooldownCheck.remainingHours > 1 ? 's' : ''}.`
        );
        setIsLoading(false);
        return;
      }
    } catch (checkErr) {
      console.warn('checkPasswordCooldown error:', checkErr);
    }

    setIsForgotPasswordFlow(true);
    setSuccessNotice(`Envoi du code de vérification SMS au ${phoneForSms} pour réinitialiser votre mot de passe...`);
    if (await sendCode()) {
      setStage(2);
      setResendTimer(45);
    }
  };

  // Login via Phone + Password
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanDigits = getPhoneClean(contactPhone);
    if (!/^[67]\d{7}$/.test(cleanDigits)) {
      setErrorMessage('Numéro Gabon invalide (8 chiffres requis). Exemple : 74 56 78 21 ou 074 56 78 21.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      const phoneWithoutZero = `+241${cleanDigits}`;
      const syntheticEmail = `${cleanDigits}@bizbooster.ga`;

      // 1. Authentification directe via Cloud Function (vérification Firestore & sync Auth)
      try {
        const loginFn = httpsCallable(functions, 'loginWithPhonePassword');
        const res = await loginFn({
          phoneNumber: phoneWithoutZero,
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
    const trimmedCode = otpCode.trim();
    if (!trimmedCode || trimmedCode.length < 6) {
      setErrorMessage('Veuillez saisir le code SMS à 6 chiffres.');
      return;
    }

    if (!confirmationRef.current) {
      setErrorMessage('La session de vérification a expiré. Veuillez renvoyer un code SMS.');
      setStage(1);
      return;
    }
    setIsLoading(true);

    const cleanDigits = getPhoneClean(contactPhone);
    const phoneWithoutZero = `+241${cleanDigits}`;
    const phoneForSms = `+2410${cleanDigits}`;

    let cred: any = null;
    let isVerified = false;

    // 1. Validation principale : confirmation Firebase Phone Auth
    try {
      cred = await confirmationRef.current.confirm(trimmedCode);
      isVerified = true;
    } catch (confirmErr: any) {
      console.warn('confirmationRef.confirm notice:', confirmErr?.code, confirmErr?.message);
      // Vérification de secours dans Firestore phone_verifications
      try {
        const keys = [cleanDigits, phoneWithoutZero, phoneForSms].filter(Boolean);
        for (const k of keys) {
          const vSnap = await getDoc(doc(db, 'phone_verifications', k));
          if (vSnap.exists() && vSnap.data().otpCode === trimmedCode) {
            const expiresAt = vSnap.data().expiresAt ? new Date(vSnap.data().expiresAt).getTime() : Infinity;
            if (Date.now() <= expiresAt) {
              isVerified = true;
              await updateDoc(vSnap.ref, {
                verified: true,
                verifiedAt: new Date().toISOString(),
              }).catch(() => {});
              break;
            }
          }
        }
      } catch (fsErr) {
        console.warn('Firestore fallback check error:', fsErr);
      }
    }

    if (!isVerified) {
      setErrorMessage('Code SMS incorrect ou expiré. Veuillez vérifier les 6 chiffres reçus sur votre téléphone.');
      setIsLoading(false);
      return;
    }

    // 2. Traitement après validation réussie du code SMS
    try {
      // Case A: Mot de passe oublié -> étape 4 pour définir le nouveau mot de passe
      if (isForgotPasswordFlow) {
        setPassword('');
        setConfirmPassword('');
        setStage(4);
        setIsLoading(false);
        return;
      }

      // Case B: Utilisateur existant dans Firestore
      const uid = cred?.user?.uid || cleanDigits;
      let snap: any = null;
      try {
        if (cred?.user?.uid) {
          snap = await getDoc(doc(db, 'users', cred.user.uid));
        }
        if (!snap?.exists()) {
          const altSnap = await getDoc(doc(db, 'users', cleanDigits));
          if (altSnap.exists()) {
            snap = altSnap;
          } else {
            const altSnap2 = await getDoc(doc(db, 'users', phoneWithoutZero));
            if (altSnap2.exists()) snap = altSnap2;
          }
        }
      } catch (readErr) {
        console.warn('Firestore user fetch notice:', readErr);
      }

      if (snap && snap.exists() && snap.data().termsAccepted) {
        const profile = {
          id: snap.id || uid,
          password: snap.data().password || 'users-with-no-password',
          ...snap.data(),
        } as UserProfile;

        if (!snap.data().password) {
          try {
            await updateDoc(doc(db, 'users', snap.id || uid), {
              password: 'users-with-no-password',
            });
          } catch {
            // ignore
          }
        }

        onSuccessLogin(profile);
        return;
      }

      // Case C: Nouvel utilisateur -> étape 3 (Nom, Localisation, Mot de passe & CGU)
      setStage(3);
    } catch (procErr: any) {
      console.warn('Post-verification routing notice:', procErr);
      setStage(3);
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
      const cleanDigits = getPhoneClean(currentUser.phoneNumber || contactPhone);
      const phoneWithoutZero = `+241${cleanDigits}`;
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

      // 2. Persist profile with password, location and timestamp - STRICTEMENT SANS LE 0 DANS LA BDD
      const newUser: UserProfile = {
        id: uid,
        contactPhone: phoneWithoutZero,
        phoneNumber: phoneWithoutZero,
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
      const cleanDigits = getPhoneClean(currentUser.phoneNumber || contactPhone);
      const phoneWithoutZero = `+241${cleanDigits}`;
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

      // 2. Update Firestore user document & record cooldown across all storage tiers
      const nowIso = new Date().toISOString();
      await recordPasswordCooldown(phoneWithoutZero, nowIso);
      await updateDoc(doc(db, 'users', uid), {
        password: password.trim(),
        lastPasswordChangeDate: nowIso,
        contactPhone: phoneWithoutZero,
        phoneNumber: phoneWithoutZero,
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
                        placeholder="74 56 78 21 ou 074 56 78 21"
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
                        placeholder="74 56 78 21 ou 074 56 78 21"
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
                {TEST_PHONE_CODES[formatGabonPhone(contactPhone)] && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Numéro de test — Entrez le code : <span className="font-mono text-sm underline">{TEST_PHONE_CODES[formatGabonPhone(contactPhone)]}</span></span>
                  </div>
                )}
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
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 max-h-48 overflow-y-auto text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Conditions Générales & Charte Déontologique (CGU Gabon)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCguModal(true)}
                    className="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    Lire en plein écran
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 leading-relaxed">
                  <strong className="block font-black text-amber-950 mb-0.5">
                    Clause de Non-Responsabilité & Sécurité :
                  </strong>
                  BIZBOOSTER est un hébergeur technique. Nous déclinons toute responsabilité sur les transactions, la conformité des biens ou les litiges entre acheteurs et vendeurs. Ne versez jamais d'acompte avant visite physique.
                </div>

                <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-700 leading-relaxed">
                  <li><strong>Prix sincères :</strong> Obligation d'exactitude des tarifs en Francs CFA (XAF).</li>
                  <li><strong>Immobilier :</strong> Interdiction de publier des parcelles sans titre ou document régulier.</li>
                  <li><strong>Véhicules & Matériel :</strong> Documents légaux en règle (carte grise, dédouanement régulier).</li>
                  <li><strong>Badge Vérifié facultatif :</strong> Obtention optionnelle d'un badge de confiance pour rassurer les acheteurs.</li>
                </ul>

                <button
                  type="button"
                  onClick={() => setShowCguModal(true)}
                  className="w-full text-center py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-[11px] font-bold text-slate-700 transition-colors"
                >
                  Consulter l'intégralité de la charte et des CGU &rarr;
                </button>
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
                  J'accepte sans réserve les <button type="button" onClick={(e) => { e.preventDefault(); setShowCguModal(true); }} className="text-emerald-700 font-bold underline">Conditions Générales d'Utilisation</button>, la clause de non-responsabilité et la Charte Déontologique BizBooster Gabon.
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

      <CguModal
        isOpen={showCguModal}
        onClose={() => setShowCguModal(false)}
        onAccept={() => {
          setTermsAccepted(true);
          setShowCguModal(false);
        }}
        showAcceptButton
      />
    </div>
  );
};
