import {
  normalizeGabonPhone,
  normalizeIndiaPhone,
  normalizePhone,
  toE164,
  toSmsE164,
  toSyntheticEmail,
  detectOperator,
  isValidGabonMobile,
  isValidIndiaMobile,
  isValidPhone,
  formatDisplayPhone,
  getAuthErrorMessage,
} from '../src/utils/phone';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Échec test : ${message}`);
  }
}

console.log('🧪 Lancement des tests unitaires de src/utils/phone.ts (Gabon & Inde)...');

// 1. Normalisation Gabon
assert(normalizeGabonPhone('+241 62 18 87 34') === '62188734', 'Normalisation Gabon +241 avec espaces');
assert(normalizeGabonPhone('00241 74 12 34 56') === '74123456', 'Normalisation Gabon 00241');
assert(normalizeGabonPhone('24165998877') === '65998877', 'Normalisation Gabon 241 collé');
assert(normalizeGabonPhone('060-11-22-33') === '60112233', 'Normalisation Gabon 0 local à 9 chiffres');
assert(normalizeGabonPhone('66112233') === '66112233', 'Normalisation Gabon déjà 8 chiffres sans 0');
assert(normalizeGabonPhone('077123456') === '77123456', 'Normalisation Gabon Airtel avec 0 initial');

// 2. Normalisation Inde
assert(normalizeIndiaPhone('+91 98765 43210') === '9876543210', 'Normalisation Inde +91 avec espaces');
assert(normalizeIndiaPhone('0091 9876543210') === '9876543210', 'Normalisation Inde 0091');
assert(normalizeIndiaPhone('919876543210') === '9876543210', 'Normalisation Inde 91 collé 12 chiffres');
assert(normalizeIndiaPhone('09876543210') === '9876543210', 'Normalisation Inde 0 local à 11 chiffres');
assert(normalizeIndiaPhone('9876543210') === '9876543210', 'Normalisation Inde déjà 10 chiffres');
assert(normalizeIndiaPhone('9123456789') === '9123456789', 'Normalisation Inde 10 chiffres commençant par 91');

// 3. Normalisation polymorphe (normalizePhone)
assert(normalizePhone('+24162188734') === '62188734', 'normalizePhone auto Gabon');
assert(normalizePhone('+919876543210') === '9876543210', 'normalizePhone auto Inde');
assert(normalizePhone('9876543210', 'IN') === '9876543210', 'normalizePhone explicite Inde');
assert(normalizePhone('062188734', 'GA') === '62188734', 'normalizePhone explicite Gabon');

// 4. Conversion E.164, SMS & e-mail synthétique Gabon
assert(toE164('62188734') === '+24162188734', 'Gabon toE164 (sans 0)');
assert(toE164('062188734') === '+24162188734', 'Gabon toE164 avec 0 en entrée doit retirer le 0');
assert(toSyntheticEmail('62188734') === '62188734@bizbooster.ga', 'Gabon toSyntheticEmail (sans 0)');
assert(toSyntheticEmail('062188734') === '62188734@bizbooster.ga', 'Gabon toSyntheticEmail avec 0 en entrée doit retirer le 0');
assert(toSmsE164('66780104') === '+241066780104', 'Gabon toSmsE164 ajoute un 0 sur 8 chiffres');
assert(toSmsE164('066780104') === '+241066780104', 'Gabon toSmsE164 conserve le 0 existant');
assert(toSmsE164('+24166780104') === '+241066780104', 'Gabon toSmsE164 sur +241 à 8 chiffres');
assert(toSmsE164('+241066780104') === '+241066780104', 'Gabon toSmsE164 sur +241 à 9 chiffres');

// 5. Conversion E.164, SMS & e-mail synthétique Inde
assert(toE164('9876543210', 'IN') === '+919876543210', 'Inde toE164');
assert(toE164('+919876543210') === '+919876543210', 'Inde toE164 avec +91');
assert(toSmsE164('9876543210', 'IN') === '+919876543210', 'Inde toSmsE164 (standard 10 chiffres sans 0 local)');
assert(toSmsE164('+919876543210') === '+919876543210', 'Inde toSmsE164 avec +91');
assert(toSyntheticEmail('9876543210', 'IN') === '9876543210@bizbooster.ga', 'Inde toSyntheticEmail');
assert(toSyntheticEmail('+919876543210') === '9876543210@bizbooster.ga', 'Inde toSyntheticEmail avec +91');

// 6. Détection opérateur Gabon
assert(detectOperator('60123456') === 'MOOV', 'Moov 60');
assert(detectOperator('62123456') === 'MOOV', 'Moov 62');
assert(detectOperator('65123456') === 'MOOV', 'Moov 65');
assert(detectOperator('66123456') === 'MOOV', 'Moov 66');
assert(detectOperator('74123456') === 'AIRTEL', 'Airtel 74');
assert(detectOperator('76123456') === 'AIRTEL', 'Airtel 76');
assert(detectOperator('77123456') === 'AIRTEL', 'Airtel 77');
assert(detectOperator('70123456') === null, '70 doit être null');

// 7. Validation Gabon
assert(isValidGabonMobile('062 18 87 34') === true, 'Validation Moov valide');
assert(isValidGabonMobile('+241 77 12 34 56') === true, 'Validation Airtel valide');
assert(isValidGabonMobile('12345678') === false, 'Validation numéro gabonais invalide');
assert(isValidGabonMobile('7412345') === false, 'Validation longueur < 8');

// 8. Validation Inde
assert(isValidIndiaMobile('9876543210') === true, 'Validation Inde valide (commence par 9)');
assert(isValidIndiaMobile('8123456789') === true, 'Validation Inde valide (commence par 8)');
assert(isValidIndiaMobile('7000123456') === true, 'Validation Inde valide (commence par 7)');
assert(isValidIndiaMobile('6321654987') === true, 'Validation Inde valide (commence par 6)');
assert(isValidIndiaMobile('+91 98765 43210') === true, 'Validation Inde avec préfixe et espaces');
assert(isValidIndiaMobile('5123456789') === false, 'Validation Inde invalide (commence par 5)');
assert(isValidIndiaMobile('987654321') === false, 'Validation Inde trop court (9 chiffres)');
assert(isValidIndiaMobile('98765432100') === false, 'Validation Inde trop long (11 chiffres sans 0 initial)');

// 9. Formatage d'affichage
assert(formatDisplayPhone('62188734', 'GA') === '+241 62 18 87 34', 'Affichage Gabon');
assert(formatDisplayPhone('9876543210', 'IN') === '+91 98765 43210', 'Affichage Inde');

// 10. Erreurs d'authentification
assert(
  getAuthErrorMessage({ code: 'auth/wrong-password' }) === 'Numéro ou mot de passe incorrect.',
  'Traduction auth/wrong-password'
);
assert(
  getAuthErrorMessage({ code: 'auth/invalid-verification-code' }) === 'Code incorrect. Vérifiez le SMS reçu.',
  'Traduction auth/invalid-verification-code'
);
assert(
  getAuthErrorMessage({ code: 'auth/email-already-in-use' }) === 'Ce numéro possède déjà un compte. Connectez-vous.',
  'Traduction auth/email-already-in-use'
);
assert(
  getAuthErrorMessage({ code: 'auth/invalid-phone-number' }, 'IN') === 'Numéro indien invalide (10 chiffres).',
  'Traduction auth/invalid-phone-number pour Inde'
);
assert(
  getAuthErrorMessage({ code: 'auth/invalid-phone-number' }, 'GA') === 'Numéro gabonais invalide (8 chiffres).',
  'Traduction auth/invalid-phone-number pour Gabon'
);

console.log('✅ Tous les tests unitaires de src/utils/phone.ts ont réussi avec succès !');
