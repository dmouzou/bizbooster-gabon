import React, { useState, useEffect, useRef } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { trackSmsSent } from '../services/platformMetrics';
import {
  X,
  Phone,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  ArrowRight,
  RefreshCw,
  User,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '../types';
import { COUNTRY_LOCATIONS } from '../data/countryLocations';
import { CguModal } from './CguModal';
import {
  normalizePhone,
  toE164,
  toSmsE164,
  toSyntheticEmail,
  detectOperator,
  isValidPhone,
  getAuthErrorMessage,
  detectCountryFromPhone,
  GabonOperator,
  SupportedCountry,
  COUNTRIES,
} from '../utils/phone';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin?: (user: UserProfile) => void;
  initialMode?: 'LOGIN' | 'PUBLISH_TRIGGER' | 'REGISTER';
}

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'LOGIN',
}) => {
  // Modes d'authentification
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>(
    initialMode === 'REGISTER' ? 'REGISTER' : 'LOGIN'
  );

  // Pays sélectionné (Gabon par défaut, ou l'un des 6 autres pays)
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountry>('GA');

  // Étapes :
  // REGISTER: 1 = Saisie numéro -> 2 = Code SMS OTP -> 3 = Profil & Mot de passe
  // FORGOT_PASSWORD: 1 = Saisie numéro -> 2 = Code SMS OTP -> 4 = Nouveau mot de passe
  // LOGIN: étape unique
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [contactPhone, setContactPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');

  // Initialisation localisation
  const initialRegions = COUNTRY_LOCATIONS.GA || [];
  const [selectedProvince, setSelectedProvince] = useState(initialRegions[0]?.name || 'Estuaire');
  const [selectedCity, setSelectedCity] = useState(initialRegions[0]?.cities[0]?.name || 'Libreville');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showCguModal, setShowCguModal] = useState(false);

  // Verrous & Références
  const sendLockRef = useRef(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [resendTimer, setResendTimer] = useState(45);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Régions et villes associées au pays sélectionné
  const availableRegions = COUNTRY_LOCATIONS[selectedCountry] || [];
  const availableCities = availableRegions.find((r) => r.name === selectedProvince)?.cities || [];

  // Détection opérateur dynamique pour Gabon
  const rawDigits = normalizePhone(contactPhone, selectedCountry);
  const detectedOp: GabonOperator | null = selectedCountry === 'GA' ? detectOperator(rawDigits) : null;
  const isCurrentPhoneValid = isValidPhone(contactPhone, selectedCountry);

  // Basculement de pays
  const handleSelectCountry = (country: SupportedCountry) => {
    if (country === selectedCountry) return;
    setSelectedCountry(country);
    setContactPhone('');
    setErrorMessage(null);
    setSuccessNotice(null);

    const countryRegions = COUNTRY_LOCATIONS[country] || [];
    const firstRegion = countryRegions[0]?.name || '';
    const firstCity = countryRegions[0]?.cities[0]?.name || '';
    setSelectedProvince(firstRegion);
    setSelectedCity(firstCity);
  };

  // Détection automatique lors de la saisie / collage
  const handlePhoneChange = (val: string) => {
    const detected = detectCountryFromPhone(val);
    if (detected && detected !== selectedCountry) {
      setSelectedCountry(detected);
      const countryRegions = COUNTRY_LOCATIONS[detected] || [];
      const firstRegion = countryRegions[0]?.name || '';
      const firstCity = countryRegions[0]?.cities[0]?.name || '';
      setSelectedProvince(firstRegion);
      setSelectedCity(firstCity);
    }
    setContactPhone(val);
  };

  // Gestion du compte à rebours de renvoi SMS (Hygiène : ReturnType<typeof setInterval>)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (stage === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [stage, resendTimer]);

  // Initialiseur paresseux de RecaptchaVerifier invisible (Section 3.3)
  const getOrCreateRecaptcha = (): RecaptchaVerifier => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch (e) {
        console.error('Erreur clear reCAPTCHA:', e);
      }
      recaptchaRef.current = null;
    }

    const oldContainer = document.getElementById('recaptcha-container');
    const wrapper = document.getElementById('recaptcha-wrapper');

    let targetElement: HTMLElement;
    if (oldContainer && oldContainer.parentNode) {
      const freshContainer = document.createElement('div');
      freshContainer.id = 'recaptcha-container';
      oldContainer.parentNode.replaceChild(freshContainer, oldContainer);
      targetElement = freshContainer;
    } else if (wrapper) {
      wrapper.innerHTML = '';
      const freshContainer = document.createElement('div');
      freshContainer.id = 'recaptcha-container';
      wrapper.appendChild(freshContainer);
      targetElement = freshContainer;
    } else {
      const freshContainer = document.createElement('div');
      freshContainer.id = 'recaptcha-container';
      document.body.appendChild(freshContainer);
      targetElement = freshContainer;
    }

    auth.languageCode = 'fr';
    recaptchaRef.current = new RecaptchaVerifier(auth, targetElement, {
      size: 'invisible',
      callback: () => {
        setErrorMessage(null);
      },
      'expired-callback': () => {
        if (recaptchaRef.current) {
          try {
            recaptchaRef.current.clear();
          } catch (e) {
            console.error('Erreur expiration reCAPTCHA:', e);
          }
          recaptchaRef.current = null;
        }
      },
    });

    return recaptchaRef.current;
  };

  // Réinitialisation de reCAPTCHA lors du basculement de mode
  useEffect(() => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch (e) {
        console.error('Erreur clear reCAPTCHA mode switch:', e);
      }
      recaptchaRef.current = null;
    }
    const oldContainer = document.getElementById('recaptcha-container');
    if (oldContainer && oldContainer.parentNode) {
      const freshContainer = document.createElement('div');
      freshContainer.id = 'recaptcha-container';
      oldContainer.parentNode.replaceChild(freshContainer, oldContainer);
    }
  }, [authMode]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (e) {
          console.error('Erreur nettoyage reCAPTCHA unmount:', e);
        }
        recaptchaRef.current = null;
      }
    };
  }, []);

  // Réinitialisation et nettoyage lors de la fermeture
  const handleModalClose = async () => {
    if ((stage === 3 || stage === 4) && auth.currentUser) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Erreur signOut fermeture modal:', e);
      }
    }

    setContactPhone('');
    setFullName('');
    setTermsAccepted(false);
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setErrorMessage(null);
    setSuccessNotice(null);
    setStage(1);
    setAuthMode(initialMode === 'REGISTER' ? 'REGISTER' : 'LOGIN');
    confirmationRef.current = null;
    setIsLoading(false);
    sendLockRef.current = false;
    setSelectedCountry('GA');
    const gaRegions = COUNTRY_LOCATIONS.GA || [];
    setSelectedProvince(gaRegions[0]?.name || 'Estuaire');
    setSelectedCity(gaRegions[0]?.cities[0]?.name || 'Libreville');

    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch (e) {
        console.error('Erreur clear reCAPTCHA close:', e);
      }
      recaptchaRef.current = null;
    }

    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode === 'REGISTER' ? 'REGISTER' : 'LOGIN');
      setStage(1);
      setErrorMessage(null);
      setSuccessNotice(null);
    }
  }, [isOpen, initialMode]);

  /**
   * Envoi du SMS avec reCAPTCHA invisible et verrou anti double-clic (Section 3.3)
   */
  const sendCode = async (): Promise<boolean> => {
    if (sendLockRef.current || isLoading) return false;

    const digitsToVerify = normalizePhone(contactPhone, selectedCountry);
    const countryInfo = COUNTRIES[selectedCountry];

    if (!isValidPhone(digitsToVerify, selectedCountry)) {
      setErrorMessage(
        `Numéro ${countryInfo.name.toLowerCase()} invalide (${countryInfo.digitsLength} chiffres requis). Exemple : ${countryInfo.placeholder}.`
      );
      return false;
    }

    sendLockRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    // Format SMS : +2410XXXXXXXX pour le Gabon, standard international pour les autres
    const smsE164 = toSmsE164(contactPhone, selectedCountry);

    try {
      const verifier = getOrCreateRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, smsE164, verifier);
      try {
        await trackSmsSent(smsE164);
      } catch (trackErr) {
        console.warn('Erreur trackSmsSent (non bloquante):', trackErr);
      }
      setSuccessNotice(`Code de confirmation SMS envoyé au ${smsE164}.`);
      return true;
    } catch (err: unknown) {
      console.error('Erreur envoi SMS Firebase:', err);
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch (clearErr) {
          console.error('Erreur clear reCAPTCHA catch:', clearErr);
        }
        recaptchaRef.current = null;
      }
      setErrorMessage(getAuthErrorMessage(err, selectedCountry));
      return false;
    } finally {
      setIsLoading(false);
      sendLockRef.current = false;
    }
  };

  /**
   * FLUX DE CONNEXION DIRECTE (Section 3.5)
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const digitsToLogin = normalizePhone(contactPhone, selectedCountry);
    const countryInfo = COUNTRIES[selectedCountry];

    if (!digitsToLogin || digitsToLogin.length < countryInfo.digitsLength) {
      setErrorMessage(
        `Numéro ${countryInfo.name.toLowerCase()} invalide (${countryInfo.digitsLength} chiffres requis).`
      );
      return;
    }

    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      const syntheticEmail = toSyntheticEmail(digitsToLogin, selectedCountry);
      // Ne jamais appliquer trim() aux mots de passe
      await signInWithEmailAndPassword(auth, syntheticEmail, password);
      handleModalClose();
    } catch (err: unknown) {
      console.error('Erreur connexion:', err);
      setErrorMessage(getAuthErrorMessage(err, selectedCountry));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * FLUX D'INSCRIPTION : Étape 1 (Validation numéro et envoi SMS)
   */
  const handleStartRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendCode();
    if (success) {
      setStage(2);
      setResendTimer(45);
    }
  };

  /**
   * FLUX MOT DE PASSE OUBLIÉ : Étape 1 (Validation numéro et envoi SMS)
   */
  const handleStartForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendCode();
    if (success) {
      setStage(2);
      setResendTimer(45);
    }
  };

  /**
   * ÉTAPE 2 : VÉRIFICATION DU CODE SMS OTP (Sections 3.2, 3.4, 3.6)
   */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = otpCode.replace(/\D/g, '');
    if (cleanCode.length < 6) {
      setErrorMessage('Veuillez saisir le code à 6 chiffres.');
      return;
    }

    if (!confirmationRef.current) {
      setErrorMessage('Session expirée. Recommencez la vérification.');
      setStage(1);
      return;
    }

    setIsLoading(true);

    try {
      const userCred = await confirmationRef.current.confirm(cleanCode);
      const user = userCred.user;

      if (authMode === 'REGISTER') {
        const userDocSnap = await getDoc(doc(db, 'users', user.uid));
        if (userDocSnap.exists()) {
          await signOut(auth);
          setErrorMessage('Ce numéro a déjà un compte, connectez-vous.');
          setAuthMode('LOGIN');
          setStage(1);
          return;
        }
        setStage(3);
      } else if (authMode === 'FORGOT_PASSWORD') {
        const userDocSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userDocSnap.exists()) {
          await signOut(auth);
          setErrorMessage('Aucun compte pour ce numéro.');
          return;
        }
        setPassword('');
        setConfirmPassword('');
        setStage(4);
      }
    } catch (err: unknown) {
      console.error('Erreur confirmation OTP:', err);
      setErrorMessage(getAuthErrorMessage(err, selectedCountry));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ÉTAPE 3 INSCRIPTION : Création de profil et liaison e-mail/mot de passe (Section 3.4)
   */
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Veuillez renseigner votre nom complet ou raison sociale.');
      return;
    }

    // Ne jamais appliquer trim() aux mots de passe
    if (!password || password.length < 6) {
      setErrorMessage('Mot de passe trop faible (6 caractères minimum).');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Veuillez accepter les Conditions Générales d\'Utilisation.');
      return;
    }

    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('SESSION_LOST');
      }

      const digitsForReg = normalizePhone(contactPhone, selectedCountry);
      const emailCred = EmailAuthProvider.credential(
        toSyntheticEmail(digitsForReg, selectedCountry),
        password
      );

      try {
        await linkWithCredential(user, emailCred);
      } catch (linkErr: unknown) {
        const code = (linkErr as { code?: string })?.code;
        const isCurrentLinked = code === 'auth/provider-already-linked' ||
          user.email === toSyntheticEmail(digitsForReg, selectedCountry) ||
          user.providerData.some((p) => p.email === toSyntheticEmail(digitsForReg, selectedCountry) || p.providerId === 'password');

        if (
          code === 'auth/email-already-in-use' ||
          code === 'auth/provider-already-linked' ||
          code === 'auth/credential-already-in-use'
        ) {
          if (!isCurrentLinked) {
            setErrorMessage('Ce numéro possède déjà un compte. Connectez-vous.');
            return;
          }
          // Si déjà lié pour cette session (reprise après échec Firestore), on poursuit la création du document
        } else if (code === 'auth/weak-password') {
          setErrorMessage('Mot de passe trop faible (6 caractères minimum).');
          return;
        } else {
          throw linkErr;
        }
      }

      // Création du profil Firestore (sans isVerified ni clés privilégiées côté client)
      await setDoc(doc(db, 'users', user.uid), {
        name: fullName.trim(),
        country: selectedCountry,
        operator: selectedCountry === 'GA' ? detectOperator(digitsForReg) : null,
        role: 'USER',
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        contactPhone: toE164(digitsForReg, selectedCountry),
        phoneNumber: toE164(digitsForReg, selectedCountry),
        location: {
          province: selectedProvince,
          city: selectedCity,
        },
      });

      handleModalClose();
    } catch (err: unknown) {
      console.error('Erreur finalisation inscription:', err);
      setErrorMessage(getAuthErrorMessage(err, selectedCountry));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ÉTAPE 4 MOT DE PASSE OUBLIÉ : Mise à jour du mot de passe dans Auth (Section 3.6)
   */
  const handleCompleteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Ne jamais appliquer trim() aux mots de passe
    if (!password || password.length < 6) {
      setErrorMessage('Mot de passe trop faible (6 caractères minimum).');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage('Session expirée. Recommencez la vérification.');
        setStage(1);
        return;
      }

      try {
        await updatePassword(user, password);
      } catch (upErr: unknown) {
        const code = (upErr as { code?: string })?.code;
        if (code === 'auth/requires-recent-login') {
          setErrorMessage('Pour votre sécurité, recommencez la vérification.');
          setStage(2);
          return;
        }
        throw upErr;
      }

      setSuccessNotice('Votre mot de passe a été mis à jour avec succès.');
      setTimeout(() => {
        handleModalClose();
      }, 1200);
    } catch (err: unknown) {
      console.error('Erreur mise à jour mot de passe:', err);
      setErrorMessage(getAuthErrorMessage(err, selectedCountry));
    } finally {
      setIsLoading(false);
    }
  };

  // Sélecteur de pays élégant et accessible
  const renderCountrySelector = () => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
          Pays d'authentification
        </label>
        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
          <span>{COUNTRIES[selectedCountry].flag}</span>
          <span>{COUNTRIES[selectedCountry].name}</span>
          <span className="text-slate-400">({COUNTRIES[selectedCountry].dialCode})</span>
        </span>
      </div>
      <div className="relative">
        <select
          value={selectedCountry}
          onChange={(e) => handleSelectCountry(e.target.value as SupportedCountry)}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
        >
          {Object.values(COUNTRIES).map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.dialCode})
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-base">
          {COUNTRIES[selectedCountry].flag}
        </div>
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Conteneur unique invisible pour reCAPTCHA monté à la racine du modal */}
      <div id="recaptcha-wrapper">
        <div id="recaptcha-container" />
      </div>

      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative my-auto">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <button
            onClick={handleModalClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <span>Authentification Annonceur</span>
              <span className="opacity-60">•</span>
              <span>{COUNTRIES[selectedCountry].flag} {COUNTRIES[selectedCountry].name} ({COUNTRIES[selectedCountry].dialCode})</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            {authMode === 'LOGIN' && 'Connexion Espace Annonceur'}
            {authMode === 'REGISTER' && stage === 1 && 'Inscription Annonceur (Étape 1/3)'}
            {authMode === 'REGISTER' && stage === 2 && 'Vérification SMS OTP (Étape 2/3)'}
            {authMode === 'REGISTER' && stage === 3 && 'Informations Annonceur (Étape 3/3)'}
            {authMode === 'FORGOT_PASSWORD' && stage === 1 && 'Mot de Passe Oublié (Étape 1/3)'}
            {authMode === 'FORGOT_PASSWORD' && stage === 2 && 'Vérification SMS OTP (Étape 2/3)'}
            {authMode === 'FORGOT_PASSWORD' && stage === 4 && 'Nouveau Mot de Passe (Étape 3/3)'}
          </h2>

          <p className="text-xs text-slate-300 mt-1">
            {authMode === 'LOGIN' && `Connectez-vous avec votre numéro (${COUNTRIES[selectedCountry].label}) et mot de passe.`}
            {authMode === 'REGISTER' && stage === 1 && 'Entrez votre numéro pour recevoir un code de vérification SMS sécurisé.'}
            {authMode === 'REGISTER' && stage === 2 && `Saisissez le code SMS envoyé au ${toSmsE164(contactPhone, selectedCountry)}.`}
            {authMode === 'REGISTER' && stage === 3 && 'Complétez votre profil pour finaliser la création de votre compte.'}
            {authMode === 'FORGOT_PASSWORD' && stage === 1 && 'Entrez votre numéro pour recevoir un code de réinitialisation par SMS.'}
            {authMode === 'FORGOT_PASSWORD' && stage === 2 && `Saisissez le code SMS reçu au ${toSmsE164(contactPhone, selectedCountry)}.`}
            {authMode === 'FORGOT_PASSWORD' && stage === 4 && 'Définissez votre nouveau mot de passe sécurisé.'}
          </p>

          {/* Stepper Dots */}
          {authMode !== 'LOGIN' && (
            <div className="flex items-center gap-2 mt-4">
              <div className={`h-1.5 rounded-full transition-all ${stage >= 1 ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700'}`} />
              <div className={`h-1.5 rounded-full transition-all ${stage >= 2 ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700'}`} />
              <div className={`h-1.5 rounded-full transition-all ${stage >= 3 ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700'}`} />
            </div>
          )}
        </div>

        {/* Corps du modal */}
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

          {/* 1. FLUX DE CONNEXION */}
          {authMode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {renderCountrySelector()}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Numéro de téléphone ({COUNTRIES[selectedCountry].label})
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {COUNTRIES[selectedCountry].flag} {COUNTRIES[selectedCountry].dialCode}
                    </span>
                  </div>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={COUNTRIES[selectedCountry].placeholder}
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
                    onClick={() => {
                      setAuthMode('FORGOT_PASSWORD');
                      setStage(1);
                      setErrorMessage(null);
                      setSuccessNotice(null);
                    }}
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
                    setAuthMode('REGISTER');
                    setStage(1);
                    setErrorMessage(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-slate-600 hover:text-emerald-700 font-semibold underline cursor-pointer"
                >
                  Nouveau sur BizBooster ? Créer un compte annonceur
                </button>
              </div>
            </form>
          )}

          {/* 2. FLUX D'INSCRIPTION : ÉTAPE 1 */}
          {authMode === 'REGISTER' && stage === 1 && (
            <form onSubmit={handleStartRegister} className="space-y-4">
              {renderCountrySelector()}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Numéro de téléphone ({COUNTRIES[selectedCountry].label})
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {COUNTRIES[selectedCountry].flag} {COUNTRIES[selectedCountry].dialCode}
                    </span>
                  </div>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={COUNTRIES[selectedCountry].placeholder}
                    className="w-full pl-24 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    autoFocus
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* Indication opérateur Gabon */}
                {selectedCountry === 'GA' && detectedOp && (
                  <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Opérateur détecté :</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      detectedOp === 'AIRTEL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {detectedOp === 'AIRTEL' ? 'Airtel Gabon (074, 076, 077)' : 'Moov Gabon (060, 062, 065, 066)'}
                    </span>
                  </div>
                )}

                {/* Validation mobile valide */}
                {isCurrentPhoneValid && selectedCountry !== 'GA' && (
                  <div className="mt-1.5 text-[11px] text-emerald-700 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Numéro mobile {COUNTRIES[selectedCountry].name.toLowerCase()} valide ({COUNTRIES[selectedCountry].digitsLength} chiffres)</span>
                  </div>
                )}
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
                    <span>Envoyer le code SMS de vérification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setStage(1);
                    setErrorMessage(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-slate-600 hover:text-emerald-700 font-semibold underline cursor-pointer"
                >
                  Déjà un compte ? Se connecter
                </button>
              </div>
            </form>
          )}

          {/* 3. FLUX MOT DE PASSE OUBLIÉ : ÉTAPE 1 */}
          {authMode === 'FORGOT_PASSWORD' && stage === 1 && (
            <form onSubmit={handleStartForgotPassword} className="space-y-4">
              {renderCountrySelector()}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Numéro de téléphone de votre compte ({COUNTRIES[selectedCountry].label})
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {COUNTRIES[selectedCountry].flag} {COUNTRIES[selectedCountry].dialCode}
                    </span>
                  </div>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={COUNTRIES[selectedCountry].placeholder}
                    className="w-full pl-24 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    autoFocus
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
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
                    <span>Envoyer le code SMS de récupération</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setStage(1);
                    setErrorMessage(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-slate-600 hover:text-emerald-700 font-semibold underline cursor-pointer"
                >
                  Retour à la connexion
                </button>
              </div>
            </form>
          )}

          {/* 4. ÉTAPE 2 : VÉRIFICATION OTP SMS */}
          {stage === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center space-y-1">
                <span className="text-xs text-slate-500">Code SMS envoyé au numéro :</span>
                <p className="font-extrabold text-slate-800 text-base">
                  {toSmsE164(contactPhone, selectedCountry)}
                </p>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 555555"
                  className="w-full tracking-widest text-center text-2xl font-black py-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  autoFocus
                  required
                />
                <div className="flex items-center justify-between mt-2.5 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => {
                      confirmationRef.current = null;
                      setStage(1);
                      setOtpCode('');
                    }}
                    className="text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
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
                      className="text-emerald-600 hover:text-emerald-700 font-bold underline cursor-pointer"
                    >
                      Renvoyer un SMS
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Vérifier le code reçu</span>}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 5. ÉTAPE 3 INSCRIPTION : INFORMATIONS ANNONCEUR & PROFIL */}
          {authMode === 'REGISTER' && stage === 3 && (
            <form onSubmit={handleCompleteRegistration} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Numéro vérifié avec succès. Complétez vos identifiants pour finaliser votre inscription.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nom complet ou Nom de l'Agence
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Paul OBAME ou Agence Partenaire"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    autoFocus
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Localisation : Province / Région et Ville */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    {selectedCountry === 'GA' ? 'Province' : selectedCountry === 'IN' ? 'État' : 'Région'}
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => {
                      const prov = e.target.value;
                      setSelectedProvince(prov);
                      const matchingCities = availableRegions.find((r) => r.name === prov)?.cities || [];
                      if (matchingCities.length > 0) {
                        setSelectedCity(matchingCities[0].name);
                      }
                    }}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    {availableRegions.map((r) => (
                      <option key={r.code || r.name} value={r.name}>
                        {r.name}
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
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    {availableCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mots de passe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      className="w-full pr-8 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Confirmer
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez"
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Charte déontologique */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    Charte Déontologique Annonceur BizBooster
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCguModal(true)}
                    className="text-[10px] text-emerald-700 font-bold underline hover:text-emerald-800 cursor-pointer"
                  >
                    Lire les CGU complètes
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-600">
                  BIZBOOSTER est un hébergeur technique. Vous vous engagez à publier des annonces sincères, vérifiées et conformes aux lois en vigueur.
                </p>
              </div>

              {/* Case à cocher CGU */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  required
                />
                <span className="text-[11px] text-slate-700 font-semibold leading-tight">
                  J'accepte sans réserve les <button type="button" onClick={(e) => { e.preventDefault(); setShowCguModal(true); }} className="text-emerald-700 font-bold underline cursor-pointer">Conditions Générales d'Utilisation</button> et la Charte Déontologique BizBooster.
                </span>
              </label>

              {/* Bouton de finalisation */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Finaliser mon Inscription & Accéder</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 6. ÉTAPE 4 MOT DE PASSE OUBLIÉ : NOUVEAU MOT DE PASSE */}
          {authMode === 'FORGOT_PASSWORD' && stage === 4 && (
            <form onSubmit={handleCompleteResetPassword} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Votre identité a été vérifiée par SMS. Veuillez définir votre nouveau mot de passe.</span>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Enregistrer mon nouveau mot de passe</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
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
