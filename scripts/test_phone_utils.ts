import {
  normalizeGabonPhone,
  toE164,
  toSmsE164,
  toSyntheticEmail,
  detectOperator,
  isValidGabonMobile,
  getAuthErrorMessage,
} from '../src/utils/phone';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Échec test : ${message}`);
  }
}

console.log('🧪 Lancement des tests unitaires de src/utils/phone.ts...');

// 1. Normalisation
assert(normalizeGabonPhone('+241 62 18 87 34') === '62188734', 'Normalisation +241 avec espaces');
assert(normalizeGabonPhone('00241 74 12 34 56') === '74123456', 'Normalisation 00241');
assert(normalizeGabonPhone('24165998877') === '65998877', 'Normalisation 241 collé');
assert(normalizeGabonPhone('060-11-22-33') === '60112233', 'Normalisation 0 local à 9 chiffres');
assert(normalizeGabonPhone('66112233') === '66112233', 'Normalisation déjà 8 chiffres sans 0');
assert(normalizeGabonPhone('077123456') === '77123456', 'Normalisation Airtel avec 0 initial');

// 2. Conversion E.164, SMS 9 chiffres & e-mail synthétique
assert(toE164('62188734') === '+24162188734', 'toE164 (sans 0)');
assert(toE164('062188734') === '+24162188734', 'toE164 avec 0 en entrée doit retirer le 0');
assert(toSyntheticEmail('62188734') === '62188734@bizbooster.ga', 'toSyntheticEmail (sans 0)');
assert(toSyntheticEmail('062188734') === '62188734@bizbooster.ga', 'toSyntheticEmail avec 0 en entrée doit retirer le 0');
assert(toSmsE164('66780104') === '+241066780104', 'toSmsE164 ajoute un 0 sur 8 chiffres');
assert(toSmsE164('066780104') === '+241066780104', 'toSmsE164 conserve le 0 existant');
assert(toSmsE164('+24166780104') === '+241066780104', 'toSmsE164 sur +241 à 8 chiffres');
assert(toSmsE164('+241066780104') === '+241066780104', 'toSmsE164 sur +241 à 9 chiffres');

// 3. Détection opérateur Moov (60, 62, 65, 66)
assert(detectOperator('60123456') === 'MOOV', 'Moov 60');
assert(detectOperator('62123456') === 'MOOV', 'Moov 62');
assert(detectOperator('65123456') === 'MOOV', 'Moov 65');
assert(detectOperator('66123456') === 'MOOV', 'Moov 66');

// 4. Détection opérateur Airtel (74, 76, 77)
assert(detectOperator('74123456') === 'AIRTEL', 'Airtel 74');
assert(detectOperator('76123456') === 'AIRTEL', 'Airtel 76');
assert(detectOperator('77123456') === 'AIRTEL', 'Airtel 77');

// 5. Préfixe inconnu / non mobile
assert(detectOperator('70123456') === null, '70 doit être null');
assert(detectOperator('01123456') === null, '01 doit être null');
assert(detectOperator('88123456') === null, '88 doit être null');

// 6. Validation mobile gabonais
assert(isValidGabonMobile('062 18 87 34') === true, 'Validation Moov valide');
assert(isValidGabonMobile('+241 77 12 34 56') === true, 'Validation Airtel valide');
assert(isValidGabonMobile('12345678') === false, 'Validation numéro invalide');
assert(isValidGabonMobile('7412345') === false, 'Validation longueur < 8');

// 7. Erreurs Annexe A
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

console.log('✅ Tous les tests unitaires de src/utils/phone.ts ont réussi avec succès !');
