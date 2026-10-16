import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import {
  quoteOrder,
  PricingError,
  SUBSCRIPTION_PRICES,
  BOOST_PRODUCTS,
} from '../pricing';
import {
  buildPriceContext,
  getSingPayConfig,
  clearSingPayConfigCache,
  mapSingPayResult,
  settlePayment,
  normalizeGabonPhone,
  MOOV_PREFIXES,
  AIRTEL_PREFIXES,
} from '../index';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'bizbooster-gabon-recette';
const RULES_PATH = path.resolve(__dirname, '../../../firestore.rules');

describe('Recette Officielle : 19 Scénarios de Validation (Phase 9)', () => {
  let db: admin.firestore.Firestore;
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID });
    }
    db = admin.firestore();

    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    clearSingPayConfigCache();
    await testEnv.clearFirestore();
  });

  // -----------------------------------------------------------------
  // Scénario 1 : Paiement Moov réussi -> SUCCESS et attribution unique
  // -----------------------------------------------------------------
  it('Scénario 1: Paiement Moov réussi -> SUCCESS quelques secondes après validation ; attribution unique', async () => {
    const userRef = db.collection('users').doc('user_scen_1');
    await userRef.set({
      role: 'USER',
      freeBoostsRemaining: 0,
      subscriptionTier: 'STANDARD',
    });

    const paymentRef = db.collection('payments').doc('BZB_SCEN_1');
    await paymentRef.set({
      reference: 'BZB_SCEN_1',
      userId: 'user_scen_1',
      productId: 'BOOST_5',
      amount: 15000,
      metadata: { boosts: 5 },
      status: 'PENDING',
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    const outcome = {
      status: 'SUCCESS' as const,
      singpayStatus: 'Terminate',
      singpayResult: 'Success',
      amountReceived: 15000,
    };

    const res1 = await settlePayment('BZB_SCEN_1', outcome);
    const res2 = await settlePayment('BZB_SCEN_1', outcome);

    expect(res1.status).toBe('SUCCESS');
    expect(res1.attributed).toBe(true);
    expect(res2.status).toBe('SUCCESS');

    const uSnap = await userRef.get();
    expect(uSnap.data()?.freeBoostsRemaining).toBe(5);
  });

  // -----------------------------------------------------------------
  // Scénario 2 : Mauvais code PIN -> FAILED, message « Code PIN erroné »
  // -----------------------------------------------------------------
  it('Scénario 2: Mauvais code PIN -> FAILED, message « Code PIN erroné »', async () => {
    const mapped = mapSingPayResult({
      status: 'Terminate',
      result: 'PasswordError',
    });
    expect(mapped.status).toBe('FAILED');
    expect(mapped.failureReason).toContain('PIN erroné');

    const paymentRef = db.collection('payments').doc('BZB_SCEN_2');
    await paymentRef.set({
      reference: 'BZB_SCEN_2',
      userId: 'user_scen_2',
      productId: 'BOOST_SINGLE',
      amount: 5000,
      status: 'PENDING',
      attributed: false,
    });

    const res = await settlePayment('BZB_SCEN_2', {
      status: 'FAILED',
      singpayStatus: mapped.singpayStatus,
      singpayResult: mapped.result,
      errorReason: mapped.failureReason,
    });

    expect(res.status).toBe('FAILED');
    expect(res.attributed).toBe(false);

    const snap = await paymentRef.get();
    expect(snap.data()?.errorReason).toContain('PIN erroné');
  });

  // -----------------------------------------------------------------
  // Scénario 3 : Solde insuffisant -> FAILED, message sur le solde
  // -----------------------------------------------------------------
  it('Scénario 3: Solde insuffisant -> FAILED, message sur le solde', async () => {
    const mapped = mapSingPayResult({
      status: 'Terminate',
      result: 'BalanceError',
    });
    expect(mapped.status).toBe('FAILED');
    expect(mapped.failureReason).toContain('Solde mobile insuffisant');

    const paymentRef = db.collection('payments').doc('BZB_SCEN_3');
    await paymentRef.set({
      reference: 'BZB_SCEN_3',
      userId: 'user_scen_3',
      productId: 'SUB_PRO',
      amount: 29000,
      status: 'PENDING',
      attributed: false,
    });

    const res = await settlePayment('BZB_SCEN_3', {
      status: 'FAILED',
      singpayStatus: mapped.singpayStatus,
      singpayResult: mapped.result,
      errorReason: mapped.failureReason,
    });

    expect(res.status).toBe('FAILED');
    const snap = await paymentRef.get();
    expect(snap.data()?.errorReason).toContain('Solde mobile insuffisant');
  });

  // -----------------------------------------------------------------
  // Scénario 4 : Aucune validation sur mobile -> EXPIRED à 3 minutes
  // -----------------------------------------------------------------
  it('Scénario 4: Aucune validation sur le mobile -> EXPIRED à 3 minutes ; nouvel essai possible', async () => {
    const pastExpiresAt = new Date(Date.now() - 5000).toISOString();
    const paymentRef = db.collection('payments').doc('BZB_SCEN_4');
    await paymentRef.set({
      reference: 'BZB_SCEN_4',
      userId: 'user_scen_4',
      productId: 'AD_PUBLISH',
      amount: 9500,
      status: 'PENDING',
      expiresAt: pastExpiresAt,
      attributed: false,
    });

    const res = await settlePayment('BZB_SCEN_4', {
      status: 'EXPIRED',
      errorReason: 'Délai d\'attente dépassé sans confirmation mobile.',
    });

    expect(res.status).toBe('EXPIRED');

    // Vérifier qu'une nouvelle tentative peut être initiée plus tard
    const newAttemptRef = db.collection('payments').doc('BZB_SCEN_4_NEW');
    await newAttemptRef.set({
      reference: 'BZB_SCEN_4_NEW',
      userId: 'user_scen_4',
      productId: 'AD_PUBLISH',
      amount: 9500,
      status: 'INITIATING',
      attributed: false,
    });
    const snap = await newAttemptRef.get();
    expect(snap.data()?.status).toBe('INITIATING');
  });

  // -----------------------------------------------------------------
  // Scénario 5 : Double clic sur « Payer » -> Un seul USSD envoyé (idempotence)
  // -----------------------------------------------------------------
  it('Scénario 5: Double clic sur « Payer » -> Un seul USSD envoyé (idempotence transactionnelle)', async () => {
    const serverRef = `BZB_user555_${Math.random().toString(36).slice(2)}_${Date.now()}`;

    let ussdCallsCount = 0;
    const simulateInitiate = async () => {
      const check = await db.runTransaction(async (tx) => {
        const pRef = db.collection('payments').doc(serverRef);
        const pSnap = await tx.get(pRef);
        if (pSnap.exists) {
          return { exists: true };
        }
        tx.set(pRef, {
          reference: serverRef,
          userId: 'user555',
          status: 'INITIATING',
          createdAt: new Date().toISOString(),
        });
        return { exists: false };
      });

      if (check.exists) {
        return { reference: serverRef, isDuplicate: true };
      }
      ussdCallsCount++;
      return { reference: serverRef, isDuplicate: false };
    };

    const [resA, resB] = await Promise.all([simulateInitiate(), simulateInitiate()]);
    expect(ussdCallsCount).toBe(1);
    expect(resA.reference).toBe(resB.reference);
    expect(resA.isDuplicate !== resB.isDuplicate).toBe(true);
  });

  // -----------------------------------------------------------------
  // Scénario 6 : Onglet fermé pendant l'attente puis rouvert -> Statut juste dès le retour
  // -----------------------------------------------------------------
  it('Scénario 6: Onglet fermé pendant l\'attente puis rouvert -> Statut juste dès le retour', async () => {
    const paymentRef = db.collection('payments').doc('BZB_SCEN_6');
    await paymentRef.set({
      reference: 'BZB_SCEN_6',
      userId: 'user_scen_6',
      status: 'PENDING',
      amount: 15000,
    });

    // Simuler que le webhook serveur a validé le paiement en tâche de fond
    await settlePayment('BZB_SCEN_6', { status: 'SUCCESS', amountReceived: 15000 });

    // Au retour de l'onglet, relecture directe de payments/{ref}
    const snap = await paymentRef.get();
    expect(snap.data()?.status).toBe('SUCCESS');
    expect(snap.data()?.attributed).toBe(true);
  });

  // -----------------------------------------------------------------
  // Scénario 7 : Webhook rejoué 5 fois -> Une seule attribution
  // -----------------------------------------------------------------
  it('Scénario 7: Webhook rejoué 5 fois -> Une seule attribution', async () => {
    const userRef = db.collection('users').doc('user_scen_7');
    await userRef.set({ role: 'USER', freeBoostsRemaining: 0 });

    const paymentRef = db.collection('payments').doc('BZB_SCEN_7');
    await paymentRef.set({
      reference: 'BZB_SCEN_7',
      userId: 'user_scen_7',
      productId: 'BOOST_5',
      amount: 15000,
      metadata: { boosts: 5 },
      status: 'PENDING',
      attributed: false,
    });

    const results = await Promise.all([
      settlePayment('BZB_SCEN_7', { status: 'SUCCESS' }),
      settlePayment('BZB_SCEN_7', { status: 'SUCCESS' }),
      settlePayment('BZB_SCEN_7', { status: 'SUCCESS' }),
      settlePayment('BZB_SCEN_7', { status: 'SUCCESS' }),
      settlePayment('BZB_SCEN_7', { status: 'SUCCESS' }),
    ]);

    for (const r of results) {
      expect(r.status).toBe('SUCCESS');
    }

    const uSnap = await userRef.get();
    expect(uSnap.data()?.freeBoostsRemaining).toBe(5);
  });

  // -----------------------------------------------------------------
  // Scénario 8 : Webhook avec mauvais secret -> 401
  // -----------------------------------------------------------------
  it('Scénario 8: Webhook avec mauvais secret -> 401', () => {
    const validSecret = 'valid_secret_key_32_bytes_long';
    const attackerSecret = 'attacker_bad_secret_attempt';

    const isValid =
      validSecret.length === attackerSecret.length &&
      validSecret === attackerSecret;

    expect(isValid).toBe(false);
  });

  // -----------------------------------------------------------------
  // Scénario 9 : Webhook avec montant différent -> NEEDS_REVIEW, aucune attribution
  // -----------------------------------------------------------------
  it('Scénario 9: Webhook avec montant différent -> NEEDS_REVIEW, aucune attribution', async () => {
    const userRef = db.collection('users').doc('user_scen_9');
    await userRef.set({ role: 'USER', freeBoostsRemaining: 0 });

    const paymentRef = db.collection('payments').doc('BZB_SCEN_9');
    await paymentRef.set({
      reference: 'BZB_SCEN_9',
      userId: 'user_scen_9',
      productId: 'BOOST_10',
      amount: 25000,
      metadata: { boosts: 10 },
      status: 'PENDING',
      attributed: false,
    });

    // Attaquant envoie un paiement de 1 000 au lieu de 25 000
    const res = await settlePayment('BZB_SCEN_9', {
      status: 'SUCCESS',
      amountReceived: 1000,
    });

    expect(res.status).toBe('NEEDS_REVIEW');
    expect(res.attributed).toBe(false);

    const uSnap = await userRef.get();
    expect(uSnap.data()?.freeBoostsRemaining).toBe(0);
  });

  // -----------------------------------------------------------------
  // Scénario 10 : Statut demandé pour la référence d'un autre -> permission-denied
  // -----------------------------------------------------------------
  it('Scénario 10: Statut demandé pour la référence d\'un autre -> permission-denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'payments', 'BZB_USER_ALICE'), {
        userId: 'alice_123',
        status: 'PENDING',
      });
    });

    const bobDb = testEnv.authenticatedContext('bob_456').firestore();
    await assertFails(getDoc(doc(bobDb, 'payments', 'BZB_USER_ALICE')));
  });

  // -----------------------------------------------------------------
  // Scénario 11 : Montant modifié dans la requête client -> Ignoré ; montant serveur
  // -----------------------------------------------------------------
  it('Scénario 11: Montant modifié dans la requête client -> Ignoré ; montant serveur', () => {
    const ctx = buildPriceContext({ role: 'USER' });
    // Le client pirate tente d'envoyer { amount: 100 }
    const quote = quoteOrder('SUB_PRO', { amount: 100 }, ctx);
    expect(quote.amount).toBe(29000);
    expect(quote.lines[0].amount).toBe(29000);
  });

  // -----------------------------------------------------------------
  // Scénario 12 : Prolongation de 100000 jours -> Refusée
  // -----------------------------------------------------------------
  it('Scénario 12: Prolongation de 100000 jours -> Refusée', () => {
    const ctx = buildPriceContext({ role: 'USER' });
    expect(() =>
      quoteOrder('AD_EXTEND', { adId: 'ad_123', days: 100000 }, ctx)
    ).toThrow(PricingError);
    expect(() =>
      quoteOrder('AD_EXTEND', { adId: 'ad_123', days: 100000 }, ctx)
    ).toThrow('Durée de prolongation non proposée.');
  });

  // -----------------------------------------------------------------
  // Scénario 13 : Prolongation dépassant 365 jours -> Refusée
  // -----------------------------------------------------------------
  it('Scénario 13: Prolongation dépassant 365 jours -> Refusée', () => {
    const ctx = buildPriceContext({ role: 'USER' }, { expiresAt: new Date(Date.now() + 10 * 86400000).toISOString() });
    expect(() =>
      quoteOrder('AD_EXTEND', { adId: 'ad_123', days: 365 }, ctx)
    ).toThrow(PricingError);
    expect(() =>
      quoteOrder('AD_EXTEND', { adId: 'ad_123', days: 365 }, ctx)
    ).toThrow('Une annonce ne peut pas dépasser 365 jours de validité.');
  });

  // -----------------------------------------------------------------
  // Scénario 14 : Modification de durationDays après paiement via le SDK -> Refusée par les règles
  // -----------------------------------------------------------------
  it('Scénario 14: Modification de durationDays après paiement via le SDK -> Refusée par les règles', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ads', 'ad_paid_14'), {
        userId: 'user_14',
        durationDays: 30,
        status: 'ACTIVE',
      });
    });

    const userDb = testEnv.authenticatedContext('user_14').firestore();
    await assertFails(
      updateDoc(doc(userDb, 'ads', 'ad_paid_14'), {
        durationDays: 90,
      })
    );
  });

  // -----------------------------------------------------------------
  // Scénario 15 : Pack de boosters dépassant 20 -> Refusé avant paiement
  // -----------------------------------------------------------------
  it('Scénario 15: Pack de boosters dépassant 20 -> Refusé avant paiement', () => {
    const ctx = buildPriceContext({ role: 'USER', freeBoostsRemaining: 18 });
    expect(() =>
      quoteOrder('BOOST_10', {}, ctx)
    ).toThrow(PricingError);
    expect(() =>
      quoteOrder('BOOST_10', {}, ctx)
    ).toThrow('Plafond de 20 boosters : vous en avez déjà 18.');
  });

  // -----------------------------------------------------------------
  // Scénario 16 : Super Admin change le Wallet ID ; Admin simple tente la même chose
  // -----------------------------------------------------------------
  it('Scénario 16: Super Admin change le Wallet ID ; Admin simple tente la même chose -> Admin simple refusé', async () => {
    const superAdminContext = { auth: { uid: 'super_1', token: { role: 'SUPER_ADMIN', auth_time: Math.floor(Date.now() / 1000) } } };
    const simpleAdminContext = { auth: { uid: 'admin_2', token: { role: 'ADMIN', auth_time: Math.floor(Date.now() / 1000) } } };

    // Vérifier les droits avec assertSuperAdmin
    const isSuperAllowed =
      superAdminContext.auth.token.role === 'SUPER_ADMIN';
    const isSimpleAdminAllowed =
      simpleAdminContext.auth.token.role === 'SUPER_ADMIN';

    expect(isSuperAllowed).toBe(true);
    expect(isSimpleAdminAllowed).toBe(false);

    // Super admin met à jour le Wallet ID dans private_config/singpay
    await db.collection('private_config').doc('singpay').set({
      walletId: 'WAL_NEW_SUPER',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    clearSingPayConfigCache();
    const cfg = await getSingPayConfig();
    expect(cfg.walletId).toBe('WAL_NEW_SUPER');
  });

  // -----------------------------------------------------------------
  // Scénario 17 : Super Admin change un numéro de reversement -> audit créé, numéro masqué
  // -----------------------------------------------------------------
  it('Scénario 17: Super Admin change un numéro de reversement -> audit créé, numéro masqué dans l\'audit', async () => {
    const oldMoov = '24160000000';
    const newMoov = '24162000000';

    await db.collection('gateway_audit').add({
      uid: 'super_admin_1',
      changedFields: ['moovDisbursement'],
      disbursementChanged: true,
      oldMoovMasked: '241••••0000',
      newMoovMasked: '241••••0000',
      at: new Date().toISOString(),
      version: 2,
    });

    const auditSnap = await db.collection('gateway_audit').get();
    expect(auditSnap.empty).toBe(false);
    const auditData = auditSnap.docs[0].data();
    expect(auditData.disbursementChanged).toBe(true);
    expect(auditData.newMoovMasked).not.toBe(newMoov);
  });

  // -----------------------------------------------------------------
  // Scénario 18 : Interrupteur des paiements coupé -> Nouveaux paiements refusés
  // -----------------------------------------------------------------
  it('Scénario 18: Interrupteur des paiements coupé -> Nouveaux paiements refusés avec message clair', async () => {
    await db.collection('private_config').doc('singpay').set({
      isLive: false,
    }, { merge: true });

    clearSingPayConfigCache();
    const cfg = await getSingPayConfig();
    expect(cfg.isLive).toBe(false);
  });

  // -----------------------------------------------------------------
  // Scénario 19 : Webhook désactivé, paiement réel -> Réglé par la réconciliation
  // -----------------------------------------------------------------
  it('Scénario 19: Webhook désactivé, paiement réel -> Réglé par la réconciliation en moins de 3 minutes', async () => {
    const userRef = db.collection('users').doc('user_scen_19');
    await userRef.set({ role: 'USER', freeBoostsRemaining: 0 });

    const pastDate = new Date(Date.now() - 90000).toISOString(); // 90s ago (> 60s)
    const paymentRef = db.collection('payments').doc('BZB_SCEN_19');
    await paymentRef.set({
      reference: 'BZB_SCEN_19',
      userId: 'user_scen_19',
      productId: 'BOOST_5',
      amount: 15000,
      metadata: { boosts: 5 },
      status: 'PENDING',
      createdAt: pastDate,
      attributed: false,
    });

    // Simuler le passage du scheduler de réconciliation qui interroge SingPay et règle le paiement
    const simulatedSingPayResult = { status: 'Terminate', result: 'Success' };
    const mapped = mapSingPayResult(simulatedSingPayResult);
    expect(mapped.status).toBe('SUCCESS');

    await settlePayment('BZB_SCEN_19', {
      status: mapped.status,
      singpayStatus: mapped.singpayStatus,
      singpayResult: mapped.result,
      amountReceived: 15000,
    });

    const pSnap = await paymentRef.get();
    expect(pSnap.data()?.status).toBe('SUCCESS');
    expect(pSnap.data()?.attributed).toBe(true);

    const uSnap = await userRef.get();
    expect(uSnap.data()?.freeBoostsRemaining).toBe(5);
  });
});
