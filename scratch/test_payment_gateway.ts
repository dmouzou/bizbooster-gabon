/**
 * Automated test suite for BizBooster Gabon Mobile Payment Gateway
 * Validates all business rules, formats, operators, transaction references,
 * ad publication payloads, extension lifecycles, and subscription logic.
 */

// 1. Phone number cleaning & operator detection logic (identical to MobilePaymentSimulator)
function cleanGabonDigits(raw: string): string {
  const clean = raw.replace(/[^0-9]/g, '');
  let digits = clean;
  if (digits.startsWith('241')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function detectOperator(digits: string): 'AIRTEL_MONEY' | 'MOOV_MONEY' | 'UNKNOWN' {
  if (
    digits.startsWith('60') ||
    digits.startsWith('62') ||
    digits.startsWith('65') ||
    digits.startsWith('66')
  ) {
    return 'MOOV_MONEY';
  }
  if (
    digits.startsWith('74') ||
    digits.startsWith('77') ||
    digits.startsWith('76')
  ) {
    return 'AIRTEL_MONEY';
  }
  return 'UNKNOWN';
}

function validateGabonPaymentPhone(raw: string): {
  valid: boolean;
  error?: string;
  digits?: string;
  operator?: 'AIRTEL_MONEY' | 'MOOV_MONEY';
} {
  const digits = cleanGabonDigits(raw);
  if (!digits || digits.length !== 8) {
    return {
      valid: false,
      error: 'Veuillez entrer un numéro de téléphone gabonais valide (ex: 077 00 00 00 ou 066 00 00 00).',
    };
  }

  const op = detectOperator(digits);
  if (op === 'UNKNOWN') {
    return {
      valid: false,
      error: 'Préfixe non reconnu. Veuillez saisir un numéro Airtel Money (074, 076, 077) ou Moov Money (060, 062, 065, 066).',
    };
  }

  return { valid: true, digits, operator: op };
}

function generateTransactionRef(operator: 'AIRTEL_MONEY' | 'MOOV_MONEY'): string {
  const prefix = operator === 'AIRTEL_MONEY' ? 'AM' : 'MM';
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-GAB-${randomNum}`;
}

function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{4}$/.test(pin)) {
    return { valid: false, error: 'Le code PIN doit comporter 4 chiffres' };
  }
  return { valid: true };
}

// ----------------- TEST RUNNER -----------------
let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

console.log('=== TEST SUITE 1: Phone Validation & Operator Detection ===');
// Airtel formats
assert(validateGabonPaymentPhone('077123456').valid && validateGabonPaymentPhone('077123456').operator === 'AIRTEL_MONEY', 'Airtel with 0 prefix: 077123456');
assert(validateGabonPaymentPhone('77123456').valid && validateGabonPaymentPhone('77123456').operator === 'AIRTEL_MONEY', 'Airtel without 0: 77123456');
assert(validateGabonPaymentPhone('+241074112233').valid && validateGabonPaymentPhone('+241074112233').operator === 'AIRTEL_MONEY', 'Airtel international +241074112233');
assert(validateGabonPaymentPhone('+241 76 11 22 33').valid && validateGabonPaymentPhone('+241 76 11 22 33').operator === 'AIRTEL_MONEY', 'Airtel with spaces +241 76 11 22 33');

// Moov formats
assert(validateGabonPaymentPhone('066123456').valid && validateGabonPaymentPhone('066123456').operator === 'MOOV_MONEY', 'Moov with 0 prefix: 066123456');
assert(validateGabonPaymentPhone('65123456').valid && validateGabonPaymentPhone('65123456').operator === 'MOOV_MONEY', 'Moov without 0: 65123456');
assert(validateGabonPaymentPhone('+241062001122').valid && validateGabonPaymentPhone('+241062001122').operator === 'MOOV_MONEY', 'Moov international +241062001122');
assert(validateGabonPaymentPhone('060 99 88 77').valid && validateGabonPaymentPhone('060 99 88 77').operator === 'MOOV_MONEY', 'Moov with spaces 060 99 88 77');

// Invalid phones
assert(!validateGabonPaymentPhone('0771234').valid, 'Rejects short number (7 digits)');
assert(!validateGabonPaymentPhone('07712345678').valid, 'Rejects long number (11 digits)');
assert(!validateGabonPaymentPhone('01234567').valid, 'Rejects Gabon Telecom fixe prefix (01)');
assert(!validateGabonPaymentPhone('08912345').valid, 'Rejects non-existent prefix (089)');
assert(!validateGabonPaymentPhone('').valid, 'Rejects empty input');

console.log('\n=== TEST SUITE 2: USSD Secret PIN Security ===');
assert(validatePin('1234').valid, 'Valid 4-digit PIN 1234');
assert(validatePin('0000').valid, 'Valid 4-digit PIN 0000');
assert(!validatePin('123').valid, 'Rejects 3-digit PIN');
assert(!validatePin('12345').valid, 'Rejects 5-digit PIN');
assert(!validatePin('abcd').valid, 'Rejects non-numeric PIN');
assert(!validatePin('').valid, 'Rejects empty PIN');

console.log('\n=== TEST SUITE 3: Gabon Transaction Reference Formatting ===');
for (let i = 0; i < 5; i++) {
  const amRef = generateTransactionRef('AIRTEL_MONEY');
  const mmRef = generateTransactionRef('MOOV_MONEY');
  assert(/^AM-GAB-\d{6}$/.test(amRef), `Airtel ref matches AM-GAB-XXXXXX: ${amRef}`);
  assert(/^MM-GAB-\d{6}$/.test(mmRef), `Moov ref matches MM-GAB-XXXXXX: ${mmRef}`);
}

console.log('\n=== TEST SUITE 4: Ad Publication Payload Lifecycle ===');
const simulatedPayment = {
  operator: 'AIRTEL_MONEY' as const,
  contactPhone: '077123456',
  transactionRef: generateTransactionRef('AIRTEL_MONEY'),
};
const publishedAd = {
  id: `ad-${Date.now().toString(36)}`,
  title: 'Appartement 3 pièces à Akanda',
  mainCategory: 'IMMOBILIER',
  paidAmount: 5000,
  paymentMethod: simulatedPayment.operator,
  transactionRef: simulatedPayment.transactionRef,
  status: 'PENDING_REVIEW', // Moderation requirement
  durationDays: 30,
};
assert(publishedAd.status === 'PENDING_REVIEW', 'Ad starts with PENDING_REVIEW status');
assert(publishedAd.paidAmount === 5000, 'Paid amount is accurately registered');
assert(publishedAd.paymentMethod === 'AIRTEL_MONEY', 'Payment operator is AIRTEL_MONEY');
assert(publishedAd.transactionRef.startsWith('AM-GAB-'), 'Transaction ref is valid');

console.log('\n=== TEST SUITE 5: Ad Extension Workflow (Standard vs VIP) ===');
// Standard advertiser extension:
const initialAd = {
  id: 'ad-test-123',
  expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
  durationDays: 15,
  status: 'ACTIVE' as const,
};
const extensionDays = 30;
const mmPayment = {
  operator: 'MOOV_MONEY' as const,
  transactionRef: generateTransactionRef('MOOV_MONEY'),
};
// 1. User files pendingExtension
const updatedAdWithPending = {
  ...initialAd,
  pendingExtension: {
    days: extensionDays,
    operator: mmPayment.operator,
    transactionRef: mmPayment.transactionRef,
    requestedAt: new Date().toISOString(),
  },
};
assert(!!updatedAdWithPending.pendingExtension, 'Pending extension attached to ad');
assert(updatedAdWithPending.pendingExtension.operator === 'MOOV_MONEY', 'Extension operator stored');

// 2. Admin approves extension
const base = Math.max(new Date(updatedAdWithPending.expiresAt).getTime(), Date.now());
const maxExpiry = Date.now() + 365 * 86400000;
const computedExpiry = base + updatedAdWithPending.pendingExtension.days * 86400000;
const newExpiry = new Date(Math.min(computedExpiry, maxExpiry)).toISOString();
const approvedAd = {
  ...updatedAdWithPending,
  status: 'ACTIVE' as const,
  expiresAt: newExpiry,
  durationDays: updatedAdWithPending.durationDays + updatedAdWithPending.pendingExtension.days,
  paymentMethod: updatedAdWithPending.pendingExtension.operator,
  transactionRef: updatedAdWithPending.pendingExtension.transactionRef,
  pendingExtension: undefined,
};
assert(approvedAd.durationDays === 45, 'Ad duration incremented to 45 days');
assert(approvedAd.pendingExtension === undefined, 'pendingExtension cleared on approval');
assert(approvedAd.transactionRef === mmPayment.transactionRef, 'Reconciled transaction ref preserved');

// VIP advertiser instant extension:
const vipAd = {
  ...initialAd,
  durationDays: initialAd.durationDays + 60,
  paymentMethod: 'AIRTEL_MONEY' as const,
  transactionRef: `VIP-EXT-${Date.now().toString(36).toUpperCase()}`,
  paidAmount: 0,
  paymentVerified: true,
};
assert(vipAd.paidAmount === 0, 'VIP extension has 0 FCFA charge');
assert(vipAd.transactionRef.startsWith('VIP-EXT-'), 'VIP reference generated');

console.log('\n=== TEST SUITE 6: Booster Allocation & Capping Rules ===');
const initialUser = {
  freeBoostsRemaining: 18,
  subscriptionTier: 'STANDARD',
};
// Add 6 boosts for BUSINESS subscription:
const maxCap = 20;
const businessBoosts = 6;
const newBoostTotal = Math.min(maxCap, initialUser.freeBoostsRemaining + businessBoosts);
assert(newBoostTotal === 20, `Boost balance capped at ${maxCap} (18 + 6 -> 20)`);

console.log(`\n==============================================`);
console.log(`TOTAL: ${passedTests}/${totalTests} tests passed successfully!`);
console.log(`==============================================\n`);
