import {
  normalizeGabonPhone,
  normalizeIndiaPhone,
  normalizeCameroonPhone,
  normalizeSenegalPhone,
  normalizeMaliPhone,
  normalizeTogoPhone,
  normalizeGhanaPhone,
  normalizePhone,
  toE164,
  toSmsE164,
  toSyntheticEmail,
  detectOperator,
  isValidGabonMobile,
  isValidIndiaMobile,
  isValidCameroonMobile,
  isValidSenegalMobile,
  isValidMaliMobile,
  isValidTogoMobile,
  isValidGhanaMobile,
  isValidPhone,
  formatDisplayPhone,
  getAuthErrorMessage,
  detectCountryFromPhone,
} from '../src/utils/phone';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Échec test : ${message}`);
  }
}

console.log('🧪 Lancement des tests unitaires de src/utils/phone.ts (7 pays)...');

// 1. Gabon (+241)
assert(normalizeGabonPhone('+241 62 18 87 34') === '62188734', 'Gabon +241');
assert(normalizeGabonPhone('060-11-22-33') === '60112233', 'Gabon 0 local');
assert(toE164('62188734', 'GA') === '+24162188734', 'Gabon toE164');
assert(toSmsE164('66780104', 'GA') === '+241066780104', 'Gabon toSmsE164 (avec 0 pour SMS)');
assert(toSyntheticEmail('62188734', 'GA') === '62188734@bizbooster.ga', 'Gabon toSyntheticEmail sans dialCode');
assert(isValidGabonMobile('062 18 87 34') === true, 'Gabon Moov valide');
assert(detectOperator('74123456') === 'AIRTEL', 'Gabon Airtel 74');

// 2. Cameroun (+237) - 9 chiffres commençant par 6
assert(normalizeCameroonPhone('+237 670 12 34 56') === '670123456', 'Cameroun +237');
assert(normalizeCameroonPhone('0690123456') === '690123456', 'Cameroun 0 initial');
assert(toE164('670123456', 'CM') === '+237670123456', 'Cameroun toE164');
assert(toSmsE164('670123456', 'CM') === '+237670123456', 'Cameroun toSmsE164');
assert(toSyntheticEmail('670123456', 'CM') === '237670123456@bizbooster.ga', 'Cameroun toSyntheticEmail');
assert(isValidCameroonMobile('670123456') === true, 'Cameroun mobile valide');
assert(isValidCameroonMobile('222123456') === false, 'Cameroun fixe invalide');

// 3. Sénégal (+221) - 9 chiffres commençant par 7
assert(normalizeSenegalPhone('+221 77 123 45 67') === '771234567', 'Sénégal +221');
assert(normalizeSenegalPhone('0761234567') === '761234567', 'Sénégal 0 initial');
assert(toE164('771234567', 'SN') === '+221771234567', 'Sénégal toE164');
assert(toSmsE164('771234567', 'SN') === '+221771234567', 'Sénégal toSmsE164');
assert(toSyntheticEmail('771234567', 'SN') === '221771234567@bizbooster.ga', 'Sénégal toSyntheticEmail');
assert(isValidSenegalMobile('771234567') === true, 'Sénégal mobile valide');
assert(isValidSenegalMobile('338123456') === false, 'Sénégal fixe invalide');

// 4. Mali (+223) - 8 chiffres commençant par 5-9
assert(normalizeMaliPhone('+223 70 12 34 56') === '70123456', 'Mali +223');
assert(toE164('70123456', 'ML') === '+22370123456', 'Mali toE164');
assert(toSmsE164('70123456', 'ML') === '+22370123456', 'Mali toSmsE164');
assert(toSyntheticEmail('70123456', 'ML') === '22370123456@bizbooster.ga', 'Mali toSyntheticEmail');
assert(isValidMaliMobile('70123456') === true, 'Mali mobile valide');
assert(isValidMaliMobile('20123456') === false, 'Mali fixe invalide');

// 5. Togo (+228) - 8 chiffres commençant par 9 ou 7
assert(normalizeTogoPhone('+228 90 12 34 56') === '90123456', 'Togo +228');
assert(toE164('90123456', 'TG') === '+22890123456', 'Togo toE164');
assert(toSmsE164('90123456', 'TG') === '+22890123456', 'Togo toSmsE164');
assert(toSyntheticEmail('90123456', 'TG') === '22890123456@bizbooster.ga', 'Togo toSyntheticEmail');
assert(isValidTogoMobile('90123456') === true, 'Togo mobile valide');
assert(isValidTogoMobile('22123456') === false, 'Togo fixe invalide');

// 6. Ghana (+233) - 9 chiffres commençant par 2 ou 5
assert(normalizeGhanaPhone('+233 24 123 4567') === '241234567', 'Ghana +233');
assert(normalizeGhanaPhone('0241234567') === '241234567', 'Ghana 0 initial');
assert(toE164('241234567', 'GH') === '+233241234567', 'Ghana toE164');
assert(toSmsE164('241234567', 'GH') === '+233241234567', 'Ghana toSmsE164');
assert(toSyntheticEmail('241234567', 'GH') === '233241234567@bizbooster.ga', 'Ghana toSyntheticEmail');
assert(isValidGhanaMobile('241234567') === true, 'Ghana mobile valide');
assert(isValidGhanaMobile('302123456') === false, 'Ghana fixe invalide');

// 7. Inde (+91) - 10 chiffres commençant par 6-9
assert(normalizeIndiaPhone('+91 98765 43210') === '9876543210', 'Inde +91');
assert(toE164('9876543210', 'IN') === '+919876543210', 'Inde toE164');
assert(toSmsE164('9876543210', 'IN') === '+919876543210', 'Inde toSmsE164');
assert(toSyntheticEmail('9876543210', 'IN') === '919876543210@bizbooster.ga', 'Inde toSyntheticEmail');
assert(isValidIndiaMobile('9876543210') === true, 'Inde mobile valide');

// 8. Auto-détection de l'indicatif
assert(detectCountryFromPhone('+24162188734') === 'GA', 'Détection GA');
assert(detectCountryFromPhone('+237670123456') === 'CM', 'Détection CM');
assert(detectCountryFromPhone('+221771234567') === 'SN', 'Détection SN');
assert(detectCountryFromPhone('+22370123456') === 'ML', 'Détection ML');
assert(detectCountryFromPhone('+22890123456') === 'TG', 'Détection TG');
assert(detectCountryFromPhone('+233241234567') === 'GH', 'Détection GH');
assert(detectCountryFromPhone('+919876543210') === 'IN', 'Détection IN');

// 9. Polymorphic toSyntheticEmail à partir de numéros stockés en E.164
assert(toSyntheticEmail('+24162188734') === '62188734@bizbooster.ga', 'E-mail depuis E.164 Gabon');
assert(toSyntheticEmail('+237670123456') === '237670123456@bizbooster.ga', 'E-mail depuis E.164 Cameroun');
assert(toSyntheticEmail('+221771234567') === '221771234567@bizbooster.ga', 'E-mail depuis E.164 Sénégal');
assert(toSyntheticEmail('+22370123456') === '22370123456@bizbooster.ga', 'E-mail depuis E.164 Mali');
assert(toSyntheticEmail('+22890123456') === '22890123456@bizbooster.ga', 'E-mail depuis E.164 Togo');
assert(toSyntheticEmail('+233241234567') === '233241234567@bizbooster.ga', 'E-mail depuis E.164 Ghana');
assert(toSyntheticEmail('+919876543210') === '919876543210@bizbooster.ga', 'E-mail depuis E.164 Inde');

// 10. Formatage d'affichage
assert(formatDisplayPhone('62188734', 'GA') === '+241 62 18 87 34', 'Affichage Gabon');
assert(formatDisplayPhone('670123456', 'CM') === '+237 670 12 34 56', 'Affichage Cameroun');
assert(formatDisplayPhone('771234567', 'SN') === '+221 77 123 45 67', 'Affichage Sénégal');
assert(formatDisplayPhone('70123456', 'ML') === '+223 70 12 34 56', 'Affichage Mali');
assert(formatDisplayPhone('90123456', 'TG') === '+228 90 12 34 56', 'Affichage Togo');
assert(formatDisplayPhone('241234567', 'GH') === '+233 24 123 4567', 'Affichage Ghana');
assert(formatDisplayPhone('9876543210', 'IN') === '+91 98765 43210', 'Affichage Inde');

// 11. Erreurs d'authentification par pays
assert(
  getAuthErrorMessage({ code: 'auth/invalid-phone-number' }, 'CM') === 'Numéro cameroun invalide (9 chiffres).',
  'Erreur numéro Cameroun'
);
assert(
  getAuthErrorMessage({ code: 'auth/invalid-phone-number' }, 'SN') === 'Numéro sénégal invalide (9 chiffres).',
  'Erreur numéro Sénégal'
);

console.log('✅ Tous les tests unitaires de src/utils/phone.ts ont réussi pour les 7 pays !');
