import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  Save,
  FlaskConical,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getTwilioAdminConfig,
  saveTwilioAdminConfig,
  testTwilioOtpSend,
  TwilioAdminConfig,
  TestTwilioOtpResponse,
} from '../services/twilioAuth';
import { COUNTRIES, SupportedCountry } from '../utils/phone';

interface TwilioAdminPanelProps {
  isSuper: boolean;
  onShowAlert?: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const TwilioAdminPanel: React.FC<TwilioAdminPanelProps> = ({ isSuper, onShowAlert }) => {
  const [config, setConfig] = useState<TwilioAdminConfig>({
    accountSid: '',
    hasAuthToken: false,
    verifyServiceSid: '',
    isLive: true,
    updatedAt: null,
    updatedBy: null,
    version: 1,
  });

  const [inputAccountSid, setInputAccountSid] = useState('');
  const [inputAuthToken, setInputAuthToken] = useState('');
  const [inputVerifyServiceSid, setInputVerifyServiceSid] = useState('');
  const [isLive, setIsLive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);

  // Tests en direct
  const [testCountry, setTestCountry] = useState<SupportedCountry>('GA');
  const [testPhone, setTestPhone] = useState('');
  const [testChannel, setTestChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: TestTwilioOtpResponse;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    if (!isSuper) return;
    setIsLoading(true);
    try {
      const data = await getTwilioAdminConfig();
      setConfig(data);
      setInputAccountSid(data.accountSid || '');
      setInputVerifyServiceSid(data.verifyServiceSid || '');
      setIsLive(data.isLive ?? true);
      setInputAuthToken('');
    } catch (err: any) {
      console.warn('Erreur chargement configuration Twilio:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSuper]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuper) {
      if (onShowAlert) {
        onShowAlert('Accès réservé exclusivement au Super Administrateur.', 'error', 'Accès Refusé');
      }
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload: {
        accountSid?: string;
        authToken?: string;
        verifyServiceSid?: string;
        isLive?: boolean;
      } = {
        isLive,
      };

      if (inputAccountSid.trim() && !inputAccountSid.includes('••')) {
        payload.accountSid = inputAccountSid.trim();
      }
      if (inputAuthToken.trim()) {
        payload.authToken = inputAuthToken.trim();
      }
      if (inputVerifyServiceSid.trim() && !inputVerifyServiceSid.includes('••')) {
        payload.verifyServiceSid = inputVerifyServiceSid.trim();
      }

      await saveTwilioAdminConfig(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
      await loadConfig();
    } catch (err: any) {
      const msg = err?.message || 'Erreur inconnue lors de l\'enregistrement.';
      if (onShowAlert) {
        onShowAlert(`Erreur: ${msg}`, 'error', 'Configuration Twilio');
      } else {
        alert(`Erreur: ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testTwilioOtpSend({
        testPhone: testPhone.trim(),
        channel: testChannel,
        country: testCountry,
      });
      setTestResult({
        success: true,
        message: res.message || 'Code envoyé avec succès !',
        details: res,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "Échec de l'envoi du code de test.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = Boolean(
    config.accountSid && (config.hasAuthToken || inputAuthToken) && config.verifyServiceSid
  );

  return (
    <div className="space-y-6">
      {/* 1. Header & Statut Général */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm">
                Vérification OTP Multi-Pays (7 pays)
              </span>
              {isConfigured ? (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  Twilio Verify Actif (SMS & WhatsApp)
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                  À configurer
                </span>
              )}
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                {isLive ? 'Mode Production' : 'Mode Test'}
              </span>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                Super Admin Uniquement
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              Passerelle Twilio Verify v2
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Acheminement des SMS et messages WhatsApp OTP pour le Gabon (+241), l'Inde (+91), le Cameroun (+237), le Sénégal (+221), le Mali (+223), le Togo (+228) et le Ghana (+233), en remplacement de Firebase Auth.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={loadConfig}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Alerte Géo-Permissions */}
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-black text-amber-950">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Configuration Requise dans la Console Twilio (Éviter l'erreur 60605)</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Par mesure de sécurité anti-fraude, Twilio désactive par défaut l'envoi international vers certains pays.
            Vous devez <strong>impérativement cocher les 7 pays supportés (Gabon, Inde, Cameroun, Sénégal, Mali, Togo, Ghana)</strong> dans :
            <br />
            <code className="bg-amber-100 px-2 py-0.5 rounded font-mono font-bold text-[10px] text-amber-950 mt-1 inline-block">
              Twilio Console &gt; Verify &gt; Services &gt; [Votre Service] &gt; Settings &gt; Geo-permissions &gt; SMS
            </code>
          </p>
        </div>
      </div>

      {/* 2. Formulaire des clés secrètes */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-slate-900 text-base">Identifiants de l'API Twilio Verify</h3>
          </div>
          {config.updatedAt && (
            <span className="text-[10px] text-slate-400 font-medium">
              Dernière mise à jour : {new Date(config.updatedAt).toLocaleString('fr-FR')} (v{config.version})
            </span>
          )}
        </div>

        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Configuration Twilio enregistrée avec succès. Prise en compte immédiate pour les connexions.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account SID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Twilio Account SID (Secret Manager / Surcharge)
              </label>
              <input
                type="text"
                value={inputAccountSid}
                onChange={(e) => setInputAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400">
                Commence par <code>AC</code> (34 caractères).
              </span>
            </div>

            {/* Verify Service SID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Verify Service SID (Secret Manager / Surcharge)
              </label>
              <input
                type="text"
                value={inputVerifyServiceSid}
                onChange={(e) => setInputVerifyServiceSid(e.target.value)}
                placeholder="VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400">
                Commence par <code>VA</code> (34 caractères).
              </span>
            </div>
          </div>

          {/* Auth Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Twilio Auth Token
              </label>
              {config.hasAuthToken && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Auth Token enregistré
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showAuthToken ? 'text' : 'password'}
                value={inputAuthToken}
                onChange={(e) => setInputAuthToken(e.target.value)}
                placeholder={
                  config.hasAuthToken
                    ? '•••••••••••••••••••••••••••••••• (Laisser vide pour conserver)'
                    : 'Entrez votre Auth Token Twilio'
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowAuthToken(!showAuthToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400">
              Le token secret n'est jamais renvoyé en clair au navigateur pour garantir la sécurité.
            </span>
          </div>

          {/* Mode Live */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800">Mode Production (Envoi réel de SMS / WhatsApp)</span>
              <p className="text-[11px] text-slate-500">
                Lorsque ce mode est actif, chaque demande d'OTP consomme du crédit sur votre compte Twilio.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isLive}
                onChange={(e) => setIsLive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Enregistrer la configuration Twilio</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Section Test en direct */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <FlaskConical className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Test en Direct de l'Acheminement OTP Multi-Pays</h3>
            <p className="text-xs text-slate-500">
              Déclenchez un test d'envoi vers un numéro de test (Gabon, Inde, Cameroun, Sénégal, Mali, Togo, Ghana) pour vérifier la liaison Twilio.
            </p>
          </div>
        </div>

        <form onSubmit={handleTestOtp} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pays cible
              </label>
              <select
                value={testCountry}
                onChange={(e) => {
                  setTestCountry(e.target.value as SupportedCountry);
                  setTestPhone('');
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {(Object.keys(COUNTRIES) as SupportedCountry[]).map((c) => (
                  <option key={c} value={c}>
                    {COUNTRIES[c].flag} {COUNTRIES[c].name} ({COUNTRIES[c].dialCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Numéro {COUNTRIES[testCountry].name} de test
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-[11px] font-bold text-slate-500">
                    {COUNTRIES[testCountry].dialCode}
                  </span>
                </div>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder={COUNTRIES[testCountry].placeholder}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-16 pr-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Canal de test
              </label>
              <select
                value={testChannel}
                onChange={(e) => setTestChannel(e.target.value as 'sms' | 'whatsapp')}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="sms">SMS standard</option>
                <option value="whatsapp">WhatsApp OTP</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isTesting || !testPhone.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Envoyer un OTP de test</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2 font-black">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.details && (
                <div className="text-[11px] text-slate-600 pt-1 font-mono">
                  <span>Destinataire : {testResult.details.to}</span> |{' '}
                  <span>Opérateur : {testResult.details.operator}</span> |{' '}
                  <span>SID : {testResult.details.sid}</span>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* 4. Rappel d'architecture & Sécurité */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-200">
            Architecture de Sécurité des Clés & Authentification
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-1.5">
            <span className="font-black text-white text-xs block">1. Secret Manager</span>
            <p className="text-[11px] text-slate-400">
              Les variables <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> et <code>TWILIO_VERIFY_SERVICE_SID</code> sont chargées depuis Google Secret Manager en production.
            </p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-1.5">
            <span className="font-black text-white text-xs block">2. Surcharge Cockpit</span>
            <p className="text-[11px] text-slate-400">
              La configuration enregistrée ici dans <code>private_config/twilio</code> est prioritaire et permet de modifier les identifiants à chaud sans redéploiement Cloud Functions.
            </p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-1.5">
            <span className="font-black text-white text-xs block">3. Firebase Custom Token</span>
            <p className="text-[11px] text-slate-400">
              Après validation du code par Twilio Verify, le serveur génère un Custom Token Firebase Auth, garantissant la pleine compatibilité avec les règles de sécurité Firestore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

