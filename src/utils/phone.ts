/**
 * Utilitaires de normalisation, validation et détection opérateur multi-pays
 * Supporte : Gabon (+241), Cameroun (+237), Mali (+223), Togo (+228), Sénégal (+221), Ghana (+233), Inde (+91)
 */

export const MOOV_PREFIXES = ['60', '62', '65', '66'] as const;
export const AIRTEL_PREFIXES = ['74', '76', '77'] as const;

export const GABON_MOBILE_PREFIXES = {
  MOOV: MOOV_PREFIXES,
  AIRTEL: AIRTEL_PREFIXES,
};

export type GabonOperator = 'MOOV' | 'AIRTEL';

export type SupportedCountry = 'GA' | 'IN' | 'CM' | 'ML' | 'TG' | 'SN' | 'GH';

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
    placeholder: '074 56 78 21 ou 062 00 00 00',
    digitsLength: 8,
    label: 'Gabon (+241)',
  },
  CM: {
    code: 'CM',
    name: 'Cameroun',
    flag: '🇨🇲',
    dialCode: '+237',
    placeholder: '670 12 34 56 ou 690 12 34 56',
    digitsLength: 9,
    label: 'Cameroun (+237)',
  },
  SN: {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    dialCode: '+221',
    placeholder: '77 123 45 67 ou 76 123 45 67',
    digitsLength: 9,
    label: 'Sénégal (+221)',
  },
  ML: {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    dialCode: '+223',
    placeholder: '70 12 34 56 ou 65 12 34 56',
    digitsLength: 8,
    label: 'Mali (+223)',
  },
  TG: {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    dialCode: '+228',
    placeholder: '90 12 34 56 ou 96 12 34 56',
    digitsLength: 8,
    label: 'Togo (+228)',
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    flag: '🇬🇭',
    dialCode: '+233',
    placeholder: '024 123 4567 ou 050 123 4567',
    digitsLength: 9,
    label: 'Ghana (+233)',
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
 * Normalise un numéro gabonais brut pour extraire les 8 chiffres significatifs.
 */
export function normalizeGabonPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00241')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('241')) {
    digits = digits.slice(3);
  }

  if (digits.length === 9 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro camerounais brut pour extraire les 9 chiffres significatifs.
 */
export function normalizeCameroonPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00237')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('237') && digits.length > 9) {
    digits = digits.slice(3);
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro sénégalais brut pour extraire les 9 chiffres significatifs.
 */
export function normalizeSenegalPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00221')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('221') && digits.length > 9) {
    digits = digits.slice(3);
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro malien brut pour extraire les 8 chiffres significatifs.
 */
export function normalizeMaliPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00223')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('223') && digits.length > 8) {
    digits = digits.slice(3);
  }

  if (digits.length === 9 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro togolais brut pour extraire les 8 chiffres significatifs.
 */
export function normalizeTogoPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00228')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('228') && digits.length > 8) {
    digits = digits.slice(3);
  }

  if (digits.length === 9 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro ghanéen brut pour extraire les 9 chiffres significatifs.
 */
export function normalizeGhanaPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00233')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('233') && digits.length > 9) {
    digits = digits.slice(3);
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalise un numéro indien brut pour extraire les 10 chiffres significatifs.
 */
export function normalizeIndiaPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('0091')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Détecte le pays à partir de l'indicatif international présent dans la chaîne.
 */
export function detectCountryFromPhone(raw?: string | null): SupportedCountry | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // 1. Détection prioritaire avec préfixe international explicite (+ ou 00)
  if (trimmed.startsWith('+241') || trimmed.startsWith('00241')) return 'GA';
  if (trimmed.startsWith('+237') || trimmed.startsWith('00237')) return 'CM';
  if (trimmed.startsWith('+221') || trimmed.startsWith('00221')) return 'SN';
  if (trimmed.startsWith('+223') || trimmed.startsWith('00223')) return 'ML';
  if (trimmed.startsWith('+228') || trimmed.startsWith('00228')) return 'TG';
  if (trimmed.startsWith('+233') || trimmed.startsWith('00233')) return 'GH';
  if (trimmed.startsWith('+91') || trimmed.startsWith('0091')) return 'IN';

  // 2. Détection sur chaîne de chiffres complète incluant l'indicatif
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length === 12) return 'CM';
  if (digits.startsWith('221') && digits.length === 12) return 'SN';
  if (digits.startsWith('223') && digits.length === 11) return 'ML';
  if (digits.startsWith('228') && digits.length === 11) return 'TG';
  if (digits.startsWith('233') && digits.length === 12) return 'GH';
  if (digits.startsWith('91') && digits.length === 12) return 'IN';
  if (digits.startsWith('241') && (digits.length === 11 || digits.length === 12)) return 'GA';

  return null;
}

/**
 * Normalise un numéro selon le pays sélectionné ou par détection automatique de l'indicatif.
 */
export function normalizePhone(raw?: string | null, country: SupportedCountry = 'GA'): string {
  if (!raw) return '';
  const detected = detectCountryFromPhone(raw);
  const targetCountry = detected || country;

  switch (targetCountry) {
    case 'CM':
      return normalizeCameroonPhone(raw);
    case 'SN':
      return normalizeSenegalPhone(raw);
    case 'ML':
      return normalizeMaliPhone(raw);
    case 'TG':
      return normalizeTogoPhone(raw);
    case 'GH':
      return normalizeGhanaPhone(raw);
    case 'IN':
      return normalizeIndiaPhone(raw);
    case 'GA':
    default:
      return normalizeGabonPhone(raw);
  }
}

/**
 * Convertit en format international E.164.
 * Pour le Gabon : ne contient jamais le 0 local (+241XXXXXXXX).
 */
export function toE164(digits: string, country: SupportedCountry = 'GA'): string {
  if (!digits) return '';
  const detected = detectCountryFromPhone(digits);
  const targetCountry = detected || country;

  switch (targetCountry) {
    case 'CM':
      return `+237${normalizeCameroonPhone(digits)}`;
    case 'SN':
      return `+221${normalizeSenegalPhone(digits)}`;
    case 'ML':
      return `+223${normalizeMaliPhone(digits)}`;
    case 'TG':
      return `+228${normalizeTogoPhone(digits)}`;
    case 'GH':
      return `+233${normalizeGhanaPhone(digits)}`;
    case 'IN':
      return `+91${normalizeIndiaPhone(digits)}`;
    case 'GA':
    default:
      return `+241${normalizeGabonPhone(digits)}`;
  }
}

/**
 * Convertit un numéro en format international SMS :
 * - Gabon : format international SMS à 9 chiffres avec 0 local (+2410XXXXXXXX)
 * - Autres pays : format international standard E.164 (+237..., +221..., +223..., +228..., +233..., +91...)
 */
export function toSmsE164(raw?: string | null, country: SupportedCountry = 'GA'): string {
  if (!raw) return '';
  const detected = detectCountryFromPhone(raw);
  const targetCountry = detected || country;

  if (targetCountry === 'GA') {
    const clean = normalizeGabonPhone(raw);
    return `+2410${clean}`;
  }

  return toE164(raw, targetCountry);
}

/**
 * Convertit les chiffres en e-mail synthétique unique (<chiffres>@bizbooster.ga).
 * - Gabon : <8chiffres>@bizbooster.ga (conforme aux comptes existants)
 * - Autres pays : <indicatifSansPlus><chiffres>@bizbooster.ga (garantit l'unicité et zéro collision)
 */
export function toSyntheticEmail(digits: string, country?: SupportedCountry): string {
  if (!digits) return '';
  const detected = detectCountryFromPhone(digits);
  const targetCountry = country || detected || 'GA';

  switch (targetCountry) {
    case 'CM':
      return `237${normalizeCameroonPhone(digits)}@bizbooster.ga`;
    case 'SN':
      return `221${normalizeSenegalPhone(digits)}@bizbooster.ga`;
    case 'ML':
      return `223${normalizeMaliPhone(digits)}@bizbooster.ga`;
    case 'TG':
      return `228${normalizeTogoPhone(digits)}@bizbooster.ga`;
    case 'GH':
      return `233${normalizeGhanaPhone(digits)}@bizbooster.ga`;
    case 'IN':
      return `91${normalizeIndiaPhone(digits)}@bizbooster.ga`;
    case 'GA':
    default:
      return `${normalizeGabonPhone(digits)}@bizbooster.ga`;
  }
}

/**
 * Détecte l'opérateur mobile gabonais à partir des deux premiers chiffres.
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
 * Vérifie si le numéro est un mobile camerounais valide (9 chiffres commençant par 6).
 */
export function isValidCameroonMobile(digits: string): boolean {
  const clean = normalizeCameroonPhone(digits);
  if (clean.length !== 9) return false;
  return /^6\d{8}$/.test(clean);
}

/**
 * Vérifie si le numéro est un mobile sénégalais valide (9 chiffres commençant par 7).
 */
export function isValidSenegalMobile(digits: string): boolean {
  const clean = normalizeSenegalPhone(digits);
  if (clean.length !== 9) return false;
  return /^7[05-8]\d{7}$/.test(clean);
}

/**
 * Vérifie si le numéro est un mobile malien valide (8 chiffres commençant par 5, 6, 7, 8 ou 9).
 */
export function isValidMaliMobile(digits: string): boolean {
  const clean = normalizeMaliPhone(digits);
  if (clean.length !== 8) return false;
  return /^[5-9]\d{7}$/.test(clean);
}

/**
 * Vérifie si le numéro est un mobile togolais valide (8 chiffres commençant par 9 ou 7).
 */
export function isValidTogoMobile(digits: string): boolean {
  const clean = normalizeTogoPhone(digits);
  if (clean.length !== 8) return false;
  return /^[79]\d{7}$/.test(clean);
}

/**
 * Vérifie si le numéro est un mobile ghanéen valide (9 chiffres commençant par 2 ou 5).
 */
export function isValidGhanaMobile(digits: string): boolean {
  const clean = normalizeGhanaPhone(digits);
  if (clean.length !== 9) return false;
  return /^(2[03-9]|5[0-9])\d{7}$/.test(clean);
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
  switch (country) {
    case 'CM':
      return isValidCameroonMobile(digits);
    case 'SN':
      return isValidSenegalMobile(digits);
    case 'ML':
      return isValidMaliMobile(digits);
    case 'TG':
      return isValidTogoMobile(digits);
    case 'GH':
      return isValidGhanaMobile(digits);
    case 'IN':
      return isValidIndiaMobile(digits);
    case 'GA':
    default:
      return isValidGabonMobile(digits);
  }
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
  const detected = detectCountryFromPhone(digits);
  const targetCountry = detected || country;

  switch (targetCountry) {
    case 'CM': {
      const clean = normalizeCameroonPhone(digits);
      if (clean.length === 9) {
        return `+237 ${clean.slice(0, 3)} ${clean.slice(3, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)}`;
      }
      return clean ? `+237 ${clean}` : '';
    }
    case 'SN': {
      const clean = normalizeSenegalPhone(digits);
      if (clean.length === 9) {
        return `+221 ${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)}`;
      }
      return clean ? `+221 ${clean}` : '';
    }
    case 'ML': {
      const clean = normalizeMaliPhone(digits);
      if (clean.length === 8) {
        return `+223 ${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)}`;
      }
      return clean ? `+223 ${clean}` : '';
    }
    case 'TG': {
      const clean = normalizeTogoPhone(digits);
      if (clean.length === 8) {
        return `+228 ${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)}`;
      }
      return clean ? `+228 ${clean}` : '';
    }
    case 'GH': {
      const clean = normalizeGhanaPhone(digits);
      if (clean.length === 9) {
        return `+233 ${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 9)}`;
      }
      return clean ? `+233 ${clean}` : '';
    }
    case 'IN': {
      const clean = normalizeIndiaPhone(digits);
      if (clean.length === 10) {
        return `+91 ${clean.slice(0, 5)} ${clean.slice(5, 10)}`;
      }
      return clean ? `+91 ${clean}` : '';
    }
    case 'GA':
    default:
      return formatGabonDisplay(digits);
  }
}

/**
 * Traduction stricte des codes d'erreur d'authentification en français (Annexe A).
 */
export function getAuthErrorMessage(err: unknown, country: SupportedCountry = 'GA'): string {
  const errorObj = (err || {}) as { code?: string; message?: string };
  const code = (errorObj.code || '').toLowerCase();
  const rawMessage = errorObj.message || '';

  console.error('Code d\'erreur d\'authentification capturé:', code, errorObj);

  const countryInfo = COUNTRIES[country] || COUNTRIES.GA;

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
      return `Numéro ${countryInfo.name.toLowerCase()} invalide (${countryInfo.digitsLength} chiffres).`;

    case 'auth/quota-exceeded':
      return 'Service SMS momentanément saturé. Réessayez plus tard.';

    case 'auth/operation-not-allowed':
      return `Connexion par SMS non activée pour ${countryInfo.name}. (Configuration à corriger en console.)`;

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
        return `Erreur inattendue (${code}). Journalisez l'erreur complète dans la console et vérifiez la configuration d\'App Check et de reCAPTCHA.`;
      }
      return rawMessage || 'Une erreur inattendue est survenue. Veuillez réessayer.';
  }
}
