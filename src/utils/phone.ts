/**
 * Utilitaires de normalisation, validation et détection opérateur Gabon et Inde
 * Conforme au plan de correction d'authentification BizBooster Gabon et expansion internationale (Inde)
 */

export const MOOV_PREFIXES = ['60', '62', '65', '66'] as const;
export const AIRTEL_PREFIXES = ['74', '76', '77'] as const;

export const GABON_MOBILE_PREFIXES = {
  MOOV: MOOV_PREFIXES,
  AIRTEL: AIRTEL_PREFIXES,
};

export type GabonOperator = 'MOOV' | 'AIRTEL';

export type SupportedCountry = 'GA' | 'IN';

export interface CountryInfo {
  code: SupportedCountry;
  name: string;
  flag: string;
  dialCode: string;
  placeholder: string;
  digitsLength: number;
  label: string;
}

export const COUNTRIES: Record<SupportedCountry, CountryInfo> = {
  GA: {
    code: 'GA',
    name: 'Gabon',
    flag: '🇬🇦',
    dialCode: '+241',
    placeholder: '074 56 78 21 ou 062 18 87 34',
    digitsLength: 8,
    label: 'Gabon (+241)',
  },
  IN: {
    code: 'IN',
    name: 'Inde',
    flag: '🇮🇳',
    dialCode: '+91',
    placeholder: '98765 43210',
    digitsLength: 10,
    label: 'Inde (+91)',
  },
};

/**
 * Normalise un numéro de téléphone gabonais brut pour extraire les 8 chiffres significatifs.
 * Gère +241, 241, 00241, espaces, tirets et supprime au plus un 0 initial local
 * uniquement lorsque la chaîne dépasserait 8 chiffres sans ce retrait.
 *
 * @param raw Numéro sous forme brute (+241 062 18 87 34, 066..., etc.)
 * @returns Chaîne de chiffres (idéalement 8 chiffres)
 */
export function normalizeGabonPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00241')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('241')) {
    digits = digits.slice(3);
  }

  // Si on a 9 chiffres et que le premier est un 0 local, retirer au plus un 0
  if (digits.length === 9 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro de téléphone indien brut pour extraire les 10 chiffres significatifs.
 * Gère +91, 0091, le préfixe 91 si longueur > 10, ainsi que le 0 initial local (11 chiffres).
 *
 * @param raw Numéro brut (+91 98765 43210, 09876543210, etc.)
 * @returns Chaîne de chiffres (idéalement 10 chiffres)
 */
export function normalizeIndiaPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('0091')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }

  // Si l'utilisateur saisit un 0 initial (numérotation nationale à 11 chiffres)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro selon le pays sélectionné ou par détection automatique du préfixe.
 */
export function normalizePhone(raw?: string | null, country: SupportedCountry = 'GA'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('+91') || trimmed.startsWith('0091')) {
    return normalizeIndiaPhone(trimmed);
  }
  if (trimmed.startsWith('+241') || trimmed.startsWith('00241')) {
    return normalizeGabonPhone(trimmed);
  }
  return country === 'IN' ? normalizeIndiaPhone(trimmed) : normalizeGabonPhone(trimmed);
}

/**
 * Convertit en format international E.164 (+241XXXXXXXX ou +91XXXXXXXXXX).
 * Ne contient jamais le 0 local pour le Gabon. Utilisé pour l'enregistrement du compte en base.
 */
export function toE164(digits: string, country: SupportedCountry = 'GA'): string {
  if (!digits) return '';
  const trimmed = digits.trim();
  if (country === 'IN' || trimmed.startsWith('+91') || trimmed.startsWith('0091')) {
    const clean = normalizeIndiaPhone(trimmed);
    return `+91${clean}`;
  }
  const clean = normalizeGabonPhone(trimmed);
  return `+241${clean}`;
}

/**
 * Convertit un numéro en format international SMS :
 * - Gabon : format international SMS à 9 chiffres (+2410XXXXXXXX)
 * - Inde  : format international standard à 10 chiffres (+91XXXXXXXXXX)
 *
 * Utilisé UNIQUEMENT pour l'envoi du SMS OTP (signInWithPhoneNumber).
 * Le compte utilisateur dans Firebase (Auth, Firestore, e-mail synthétique)
 * est quant à lui TOUJOURS enregistré sans 0 additionnel.
 */
export function toSmsE164(raw?: string | null, country: SupportedCountry = 'GA'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (country === 'IN' || trimmed.startsWith('+91') || trimmed.startsWith('0091')) {
    const clean = normalizeIndiaPhone(trimmed);
    return `+91${clean}`;
  }
  const clean = normalizeGabonPhone(trimmed);
  return `+2410${clean}`;
}

/**
 * Convertit les chiffres en e-mail synthétique unique (<chiffres>@bizbooster.ga).
 * - Gabon : <8chiffres>@bizbooster.ga (sans le 0 local)
 * - Inde  : <10chiffres>@bizbooster.ga
 */
export function toSyntheticEmail(digits: string, country?: SupportedCountry): string {
  if (!digits) return '';
  const trimmed = digits.trim();
  let clean: string;
  if (
    country === 'IN' ||
    trimmed.startsWith('+91') ||
    trimmed.startsWith('0091') ||
    (country !== 'GA' && trimmed.replace(/\D/g, '').length === 10)
  ) {
    clean = normalizeIndiaPhone(digits);
  } else {
    clean = normalizeGabonPhone(digits);
  }
  return `${clean}@bizbooster.ga`;
}

/**
 * Détecte l'opérateur mobile gabonais à partir des deux premiers chiffres.
 * Renvoie null si préfixe inconnu ou numéro non gabonais.
 */
export function detectOperator(digits: string): GabonOperator | null {
  const clean = normalizeGabonPhone(digits);
  if (clean.length < 2) return null;
  const prefix = clean.slice(0, 2);

  if ((MOOV_PREFIXES as readonly string[]).includes(prefix)) {
    return 'MOOV';
  }
  if ((AIRTEL_PREFIXES as readonly string[]).includes(prefix)) {
    return 'AIRTEL';
  }
  return null;
}

/**
 * Vérifie si le numéro est un mobile gabonais valide (8 chiffres et préfixe mobile officiel).
 */
export function isValidGabonMobile(digits: string): boolean {
  const clean = normalizeGabonPhone(digits);
  if (clean.length !== 8) return false;
  return detectOperator(clean) !== null;
}

/**
 * Vérifie si le numéro est un mobile indien valide (10 chiffres commençant par 6, 7, 8 ou 9).
 */
export function isValidIndiaMobile(digits: string): boolean {
  const clean = normalizeIndiaPhone(digits);
  if (clean.length !== 10) return false;
  return /^[6-9]\d{9}$/.test(clean);
}

/**
 * Vérifie si le numéro est valide selon le pays.
 */
export function isValidPhone(digits: string, country: SupportedCountry = 'GA'): boolean {
  return country === 'IN' ? isValidIndiaMobile(digits) : isValidGabonMobile(digits);
}

/**
 * Formate le numéro pour un affichage lisible utilisateur gabonais (+241 XX XX XX XX).
 */
export function formatGabonDisplay(digits: string): string {
  const clean = normalizeGabonPhone(digits);
  if (clean.length === 8) {
    return `+241 ${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)}`;
  }
  return clean ? `+241 ${clean}` : '';
}

/**
 * Formate le numéro pour affichage selon le pays.
 */
export function formatDisplayPhone(digits: string, country: SupportedCountry = 'GA'): string {
  if (country === 'IN' || digits.startsWith('+91')) {
    const clean = normalizeIndiaPhone(digits);
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 5)} ${clean.slice(5, 10)}`;
    }
    return clean ? `+91 ${clean}` : '';
  }
  return formatGabonDisplay(digits);
}

/**
 * Traduction stricte des codes d'erreur d'authentification en français (Annexe A).
 * N'utilise pas de tirets cadratins.
 */
export function getAuthErrorMessage(err: unknown, country: SupportedCountry = 'GA'): string {
  const errorObj = (err || {}) as { code?: string; message?: string };
  const code = (errorObj.code || '').toLowerCase();
  const rawMessage = errorObj.message || '';

  // Journalisation du code complet d'erreur
  console.error('Code d\'erreur d\'authentification capturé:', code, errorObj);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Numéro ou mot de passe incorrect.';

    case 'auth/too-many-requests':
      return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';

    case 'auth/network-request-failed':
      return 'Connexion internet indisponible. Réessayez.';

    case 'auth/invalid-verification-code':
      return 'Code incorrect. Vérifiez le SMS reçu.';

    case 'auth/code-expired':
      return 'Code expiré. Demandez un nouveau SMS.';

    case 'auth/session-expired':
    case 'auth/missing-verification-id':
      return 'Session expirée. Recommencez la vérification.';

    case 'auth/invalid-phone-number':
      return country === 'IN'
        ? 'Numéro indien invalide (10 chiffres).'
        : 'Numéro gabonais invalide (8 chiffres).';

    case 'auth/quota-exceeded':
      return 'Service SMS momentanément saturé. Réessayez plus tard.';

    case 'auth/operation-not-allowed':
      return country === 'IN'
        ? 'Connexion par SMS non activée pour l\'Inde. (Configuration à corriger en console.)'
        : 'Connexion par SMS non activée pour le Gabon. (Configuration à corriger en console.)';

    case 'auth/unauthorized-domain':
      return 'Domaine non autorisé. (Configuration à corriger en console.)';

    case 'auth/email-already-in-use':
    case 'auth/provider-already-linked':
    case 'auth/credential-already-in-use':
      return 'Ce numéro possède déjà un compte. Connectez-vous.';

    case 'auth/weak-password':
      return 'Mot de passe trop faible (6 caractères minimum).';

    case 'auth/requires-recent-login':
      return 'Pour votre sécurité, recommencez la vérification.';

    case 'functions/not-found':
    case 'functions/unavailable':
    case 'functions/internal':
      return 'Service momentanément indisponible. (Ne jamais l\'afficher comme "aucun compte".)';

    default:
      if (rawMessage.includes('already been rendered in this element')) {
        return 'Contrôle de sécurité reCAPTCHA réinitialisé. Veuillez renvoyer le code.';
      }
      if (code.includes('error-code:-39') || rawMessage.includes('error-code:-39')) {
        return 'Erreur inattendue (error-code:-39). Journalisez l\'erreur complète dans la console et vérifiez la configuration d\'App Check et de reCAPTCHA.';
      }
      if (code) {
        return `Erreur inattendue (${code}). Journalisez l'erreur complète dans la console et vérifiez la configuration d'App Check et de reCAPTCHA.`;
      }
      return rawMessage || 'Une erreur inattendue est survenue. Veuillez réessayer.';
  }
}
