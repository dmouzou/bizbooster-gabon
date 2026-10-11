/**
 * Utilitaires de normalisation, validation et détection opérateur Gabon
 * Conforme au plan de correction d'authentification BizBooster Gabon (Section 3.1 & Annexe A)
 */

export const MOOV_PREFIXES = ['60', '62', '65', '66'] as const;
export const AIRTEL_PREFIXES = ['74', '76', '77'] as const;

export const GABON_MOBILE_PREFIXES = {
  MOOV: MOOV_PREFIXES,
  AIRTEL: AIRTEL_PREFIXES,
};

export type GabonOperator = 'MOOV' | 'AIRTEL';

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
 * Convertit 8 chiffres en format international E.164 (+241XXXXXXXX).
 * Ne contient jamais le 0 local. Utilisé pour l'enregistrement du compte en base.
 */
export function toE164(digits: string): string {
  const clean = normalizeGabonPhone(digits);
  return `+241${clean}`;
}

/**
 * Convertit un numéro gabonais en format international SMS à 9 chiffres (+2410XXXXXXXX).
 * Ajoute un '0' si le numéro a 8 chiffres, le conserve s'il est déjà présent.
 *
 * Exemple : '66780104'    -> '+241066780104'
 *           '066780104'   -> '+241066780104'
 *           '+24166780104' -> '+241066780104'
 *
 * Utilisé UNIQUEMENT pour l'envoi du SMS OTP (signInWithPhoneNumber).
 * Le compte utilisateur dans Firebase (Auth, Firestore, e-mail synthétique)
 * est quant à lui TOUJOURS enregistré sur 8 chiffres sans le 0 (+241XXXXXXXX).
 */
export function toSmsE164(raw?: string | null): string {
  const clean = normalizeGabonPhone(raw);
  return `+2410${clean}`;
}

/**
 * Convertit 8 chiffres en e-mail synthétique unique (<8chiffres>@bizbooster.ga).
 * Ne contient jamais le 0 local.
 */
export function toSyntheticEmail(digits: string): string {
  const clean = normalizeGabonPhone(digits);
  return `${clean}@bizbooster.ga`;
}

/**
 * Détecte l'opérateur mobile gabonais à partir des deux premiers chiffres uniquement.
 * Renvoie null si préfixe inconnu (ne se rabat pas par défaut sur Airtel ou Moov).
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
 * Formate le numéro pour un affichage lisible utilisateur (+241 XX XX XX XX).
 */
export function formatGabonDisplay(digits: string): string {
  const clean = normalizeGabonPhone(digits);
  if (clean.length === 8) {
    return `+241 ${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)}`;
  }
  return clean ? `+241 ${clean}` : '';
}

/**
 * Traduction stricte des codes d'erreur d'authentification en français (Annexe A).
 * N'utilise pas de tirets cadratins.
 */
export function getAuthErrorMessage(err: unknown): string {
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
      return 'Numéro gabonais invalide (8 chiffres).';

    case 'auth/quota-exceeded':
      return 'Service SMS momentanément saturé. Réessayez plus tard.';

    case 'auth/operation-not-allowed':
      return 'Connexion par SMS non activée pour le Gabon. (Configuration à corriger en console.)';

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
