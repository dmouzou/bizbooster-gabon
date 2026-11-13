import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalizeGabonPhoneForTwilio,
  normalizePhoneForTwilio,
  toSyntheticEmailBackend,
  detectCountryFromPhoneBackend,
  getTwilioConfig,
  invalidateTwilioConfigCache,
} from '../functions/src/twilio';

describe('Twilio Verify Gabon - Normalisation et validation des numéros (+241)', () => {
  it('identifie et normalise correctement les numéros Airtel Gabon (074, 076, 077)', () => {
    const res1 = normalizeGabonPhoneForTwilio('077 12 34 56');
    expect(res1.isValid).toBe(true);
    expect(res1.operator).toBe('AIRTEL');
    expect(res1.e164).toBe('+24177123456');
    expect(res1.rawDigits).toBe('77123456');

    const res2 = normalizeGabonPhoneForTwilio('+24174001122');
    expect(res2.isValid).toBe(true);
    expect(res2.operator).toBe('AIRTEL');
    expect(res2.e164).toBe('+24174001122');

    const res3 = normalizeGabonPhoneForTwilio('0024176998877');
    expect(res3.isValid).toBe(true);
    expect(res3.operator).toBe('AIRTEL');
    expect(res3.e164).toBe('+24176998877');
  });

  it('identifie et normalise correctement les numéros Moov Africa Gabon (060, 062, 065, 066)', () => {
    const res1 = normalizeGabonPhoneForTwilio('066 90 80 70');
    expect(res1.isValid).toBe(true);
    expect(res1.operator).toBe('MOOV');
    expect(res1.e164).toBe('+24166908070');
    expect(res1.rawDigits).toBe('66908070');

    const res2 = normalizeGabonPhoneForTwilio('062123456');
    expect(res2.isValid).toBe(true);
    expect(res2.operator).toBe('MOOV');
    expect(res2.e164).toBe('+24162123456');

    const res3 = normalizeGabonPhoneForTwilio('+241065112233');
    expect(res3.isValid).toBe(true);
    expect(res3.operator).toBe('MOOV');
    expect(res3.e164).toBe('+24165112233');
  });

  it('rejette les numéros non gabonais ou mal formatés', () => {
    // Trop court
    const res1 = normalizeGabonPhoneForTwilio('077 12 34');
    expect(res1.isValid).toBe(false);

    // Préfixe non attribué
    const res2 = normalizeGabonPhoneForTwilio('055 12 34 56');
    expect(res2.isValid).toBe(false);
    expect(res2.operator).toBe('UNKNOWN');

    // Chiffres vides
    const res3 = normalizeGabonPhoneForTwilio('');
    expect(res3.isValid).toBe(false);
  });
});

describe('Twilio Verify Multi-Pays - Normalisation et validation', () => {
  it('normalise et valide les numéros pour l\'Inde (IN, +91, 10 chiffres)', () => {
    const res1 = normalizePhoneForTwilio('9876543210', 'IN');
    expect(res1.isValid).toBe(true);
    expect(res1.country).toBe('IN');
    expect(res1.e164).toBe('+919876543210');
    expect(res1.rawDigits).toBe('9876543210');

    const res2 = normalizePhoneForTwilio('+91 91234 56789');
    expect(res2.isValid).toBe(true);
    expect(res2.country).toBe('IN');
    expect(res2.e164).toBe('+919123456789');

    // Invalide (trop court)
    const res3 = normalizePhoneForTwilio('987654321', 'IN');
    expect(res3.isValid).toBe(false);
  });

  it('normalise et valide les numéros pour le Cameroun (CM, +237, 9 chiffres)', () => {
    const res = normalizePhoneForTwilio('670123456', 'CM');
    expect(res.isValid).toBe(true);
    expect(res.country).toBe('CM');
    expect(res.e164).toBe('+237670123456');
    expect(res.rawDigits).toBe('670123456');
  });

  it('normalise et valide les numéros pour le Sénégal (SN, +221, 9 chiffres)', () => {
    const res = normalizePhoneForTwilio('771234567', 'SN');
    expect(res.isValid).toBe(true);
    expect(res.country).toBe('SN');
    expect(res.e164).toBe('+221771234567');
    expect(res.rawDigits).toBe('771234567');
  });

  it('normalise et valide les numéros pour le Mali (ML, +223, 8 chiffres)', () => {
    const res = normalizePhoneForTwilio('70123456', 'ML');
    expect(res.isValid).toBe(true);
    expect(res.country).toBe('ML');
    expect(res.e164).toBe('+22370123456');
    expect(res.rawDigits).toBe('70123456');
  });

  it('normalise et valide les numéros pour le Togo (TG, +228, 8 chiffres)', () => {
    const res = normalizePhoneForTwilio('90123456', 'TG');
    expect(res.isValid).toBe(true);
    expect(res.country).toBe('TG');
    expect(res.e164).toBe('+22890123456');
    expect(res.rawDigits).toBe('90123456');
  });

  it('normalise et valide les numéros pour le Ghana (GH, +233, 9 chiffres)', () => {
    const res = normalizePhoneForTwilio('0241234567', 'GH');
    expect(res.isValid).toBe(true);
    expect(res.country).toBe('GH');
    expect(res.e164).toBe('+233241234567');
    expect(res.rawDigits).toBe('241234567');
  });

  it('génère les emails synthétiques conformément aux conventions multi-pays', () => {
    expect(toSyntheticEmailBackend('77123456', 'GA')).toBe('77123456@bizbooster.ga');
    expect(toSyntheticEmailBackend('9876543210', 'IN')).toBe('919876543210@bizbooster.ga');
    expect(toSyntheticEmailBackend('670123456', 'CM')).toBe('237670123456@bizbooster.ga');
    expect(toSyntheticEmailBackend('771234567', 'SN')).toBe('221771234567@bizbooster.ga');
    expect(toSyntheticEmailBackend('70123456', 'ML')).toBe('22370123456@bizbooster.ga');
    expect(toSyntheticEmailBackend('90123456', 'TG')).toBe('22890123456@bizbooster.ga');
    expect(toSyntheticEmailBackend('241234567', 'GH')).toBe('233241234567@bizbooster.ga');
  });

  it('détecte le pays à partir de l\'indicatif international', () => {
    expect(detectCountryFromPhoneBackend('+919876543210')).toBe('IN');
    expect(detectCountryFromPhoneBackend('+237670123456')).toBe('CM');
    expect(detectCountryFromPhoneBackend('+221771234567')).toBe('SN');
    expect(detectCountryFromPhoneBackend('+22370123456')).toBe('ML');
    expect(detectCountryFromPhoneBackend('+22890123456')).toBe('TG');
    expect(detectCountryFromPhoneBackend('+233241234567')).toBe('GH');
    expect(detectCountryFromPhoneBackend('+24177123456')).toBe('GA');
  });
});

describe('Twilio Verify - Configuration et Cache', () => {
  const originalAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const originalAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const originalServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  beforeEach(() => {
    invalidateTwilioConfigCache();
  });

  afterEach(() => {
    invalidateTwilioConfigCache();
    if (originalAccountSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalAccountSid;

    if (originalAuthToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalAuthToken;

    if (originalServiceSid === undefined) delete process.env.TWILIO_VERIFY_SERVICE_SID;
    else process.env.TWILIO_VERIFY_SERVICE_SID = originalServiceSid;
  });

  it('charge la configuration depuis process.env lorsque Secret Manager est simulé', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC11111111111111111111111111111111';
    process.env.TWILIO_AUTH_TOKEN = 'secret_auth_token_123';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA22222222222222222222222222222222';

    const cfg = await getTwilioConfig();
    expect(cfg.accountSid).toBe('AC11111111111111111111111111111111');
    expect(cfg.authToken).toBe('secret_auth_token_123');
    expect(cfg.verifyServiceSid).toBe('VA22222222222222222222222222222222');
    expect(cfg.isLive).toBe(true);
  });
});
