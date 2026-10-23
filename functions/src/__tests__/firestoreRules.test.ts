import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'bizbooster-gabon-rules-test';
const RULES_PATH = path.resolve(__dirname, '../../../firestore.rules');

describe('Règles de sécurité Firestore (Phase 7)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
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
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // -------------------------------------------------------------
  // 7.1 & 7.2 : Annonces (ads)
  // -------------------------------------------------------------
  describe('7.1 & 7.2 : match /ads/{adId}', () => {
    const ownerUid = 'user_owner_123';
    const otherUid = 'user_stranger_456';
    const adminUid = 'admin_user_789';

    beforeEach(async () => {
      // Setup admin user doc and an existing active ad in Firestore via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', adminUid), {
          role: 'ADMIN',
        });
        await setDoc(doc(db, 'ads', 'ad_test_1'), {
          userId: ownerUid,
          title: 'Table en bois massif',
          description: 'Très bon état',
          price: 25000,
          status: 'ACTIVE',
          durationDays: 30,
          paymentReference: 'BZB_12345',
          paidAmount: 9500,
          isFeatured: false,
          expiresAt: '2026-11-15T00:00:00.000Z',
          publishedAt: '2026-10-16T00:00:00.000Z',
        });
      });
    });

    it('7.2 refuse la création si userId ne correspond pas au token auth', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        setDoc(doc(db, 'ads', 'ad_new_fail_uid'), {
          userId: otherUid,
          title: 'Voiture Toyota',
          status: 'PENDING_REVIEW',
        })
      );
    });

    it('7.2 refuse la création d\'une annonce directement ACTIVE', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        setDoc(doc(db, 'ads', 'ad_new_fail_active'), {
          userId: ownerUid,
          title: 'Voiture Toyota',
          status: 'ACTIVE',
        })
      );
    });

    it('7.2 refuse la création d\'une annonce avec isFeatured présent', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        setDoc(doc(db, 'ads', 'ad_new_fail_featured'), {
          userId: ownerUid,
          title: 'Voiture Toyota',
          status: 'PENDING_REVIEW',
          isFeatured: true,
        })
      );
    });

    it('7.2 refuse la création d\'une annonce avec une échéance expiresAt fournie', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        setDoc(doc(db, 'ads', 'ad_new_fail_expires'), {
          userId: ownerUid,
          title: 'Voiture Toyota',
          status: 'PENDING_REVIEW',
          expiresAt: '2026-11-20T00:00:00.000Z',
        })
      );
    });

    it('7.2 autorise la création valide d\'une annonce en attente sans clés de classement ni expiresAt', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertSucceeds(
        setDoc(doc(db, 'ads', 'ad_new_ok'), {
          userId: ownerUid,
          title: 'Téléphone Samsung S21',
          description: 'Parfait état de marche',
          price: 150000,
          status: 'PENDING_REVIEW',
          durationDays: 30,
          paymentReference: 'BZB_PAY_INIT_1',
        })
      );
    });

    it('7.1 refuse la modification de durationDays par le propriétaire', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          durationDays: 60,
        })
      );
    });

    it('7.1 refuse la modification de boostRequested ou isFeatured par le propriétaire', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          isFeatured: true,
        })
      );
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          boostRequested: true,
        })
      );
    });

    it('7.1 refuse la modification de paymentReference ou paidAmount par le propriétaire', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          paymentReference: 'BZB_HACKED_REF',
        })
      );
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          paidAmount: 0,
        })
      );
    });

    it('7.1 refuse la modification de expiresAt par le propriétaire', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          expiresAt: '2027-12-31T00:00:00.000Z',
        })
      );
    });

    it('7.1 refuse la modification de status (e.g. vers ACTIVE ou SUSPENDED) par le propriétaire', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      // ad_test_1 is currently ACTIVE, so changing it to SUSPENDED or PENDING_PAYMENT changes status
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          status: 'SUSPENDED',
        })
      );
    });

    it('7.1 refuse l\'activation directe d\'une annonce en attente par son propriétaire', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'ads', 'ad_pending_test'), {
          userId: ownerUid,
          title: 'Annonce en attente',
          status: 'PENDING_REVIEW',
        });
      });
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_pending_test'), {
          status: 'ACTIVE',
        })
      );
    });

    it('7.1 refuse la modification directe d\'une annonce ACTIVE sans repasser par modération (B4)', async () => {
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertFails(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          title: 'Table en chêne massif rénovée',
          price: 28000,
          description: 'Description mise à jour sans passer par modération.',
        })
      );
    });

    it('7.1 autorise la modification légitime des informations d\'une annonce en attente', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'ads', 'ad_test_pending_edit'), {
          userId: ownerUid,
          title: 'Table en bois massif',
          description: 'Très bon état',
          price: 25000,
          status: 'PENDING_REVIEW',
          durationDays: 30,
        });
      });
      const db = testEnv.authenticatedContext(ownerUid).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'ads', 'ad_test_pending_edit'), {
          title: 'Table en chêne massif rénovée',
          price: 28000,
          description: 'Description mise à jour sans toucher aux métadonnées sensibles.',
        })
      );
    });

    it('autorise un administrateur à mettre à jour les champs statut/classement', async () => {
      const db = testEnv.authenticatedContext(adminUid, { role: 'ADMIN' }).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'ads', 'ad_test_1'), {
          status: 'ACTIVE',
          isFeatured: true,
          durationDays: 60,
        })
      );
    });
  });

  // -------------------------------------------------------------
  // 7.3 : Paiements (payments)
  // -------------------------------------------------------------
  describe('7.3 : match /payments/{paymentId}', () => {
    const payerUid = 'payer_123';
    const strangerUid = 'stranger_456';
    const adminUid = 'admin_789';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', adminUid), { role: 'ADMIN' });
        await setDoc(doc(db, 'payments', 'BZB_PAY_777'), {
          userId: payerUid,
          amount: 9500,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
      });
    });

    it('autorise le propriétaire à lire son paiement', async () => {
      const db = testEnv.authenticatedContext(payerUid).firestore();
      await assertSucceeds(getDoc(doc(db, 'payments', 'BZB_PAY_777')));
    });

    it('refuse à un autre utilisateur de lire le paiement', async () => {
      const db = testEnv.authenticatedContext(strangerUid).firestore();
      await assertFails(getDoc(doc(db, 'payments', 'BZB_PAY_777')));
    });

    it('refuse à un utilisateur non authentifié de lire le paiement', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, 'payments', 'BZB_PAY_777')));
    });

    it('autorise un admin à lire le paiement', async () => {
      const db = testEnv.authenticatedContext(adminUid, { role: 'ADMIN' }).firestore();
      await assertSucceeds(getDoc(doc(db, 'payments', 'BZB_PAY_777')));
    });

    it('refuse toute écriture client sur la collection payments', async () => {
      const dbOwner = testEnv.authenticatedContext(payerUid).firestore();
      await assertFails(
        updateDoc(doc(dbOwner, 'payments', 'BZB_PAY_777'), {
          status: 'SUCCESS',
        })
      );
      await assertFails(
        setDoc(doc(dbOwner, 'payments', 'BZB_NEW_FAKE'), {
          userId: payerUid,
          amount: 0,
          status: 'SUCCESS',
        })
      );
    });
  });

  // -------------------------------------------------------------
  // 2.4 : private_config, settings/payment_gateway & gateway_audit
  // -------------------------------------------------------------
  describe('2.4 : Documents de configuration fermés au client', () => {
    const superAdminUid = 'super_admin_001';
    const regularAdminUid = 'admin_002';
    const userUid = 'user_003';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', superAdminUid), { role: 'SUPER_ADMIN' });
        await setDoc(doc(db, 'users', regularAdminUid), { role: 'ADMIN' });
        await setDoc(doc(db, 'users', userUid), { role: 'USER' });

        await setDoc(doc(db, 'private_config', 'singpay'), {
          clientId: 'secret_client_id',
          clientSecret: 'super_secret',
        });
        await setDoc(doc(db, 'settings', 'payment_gateway'), {
          clientId: 'legacy_client_id',
        });
        await setDoc(doc(db, 'gateway_audit', 'audit_1'), {
          uid: superAdminUid,
          changedFields: ['walletId'],
        });
      });
    });

    it('refuse formellement tout accès client (read et write) sur private_config', async () => {
      const superAdminDb = testEnv.authenticatedContext(superAdminUid, { role: 'SUPER_ADMIN' }).firestore();
      const userDb = testEnv.authenticatedContext(userUid).firestore();

      await assertFails(getDoc(doc(superAdminDb, 'private_config', 'singpay')));
      await assertFails(getDoc(doc(userDb, 'private_config', 'singpay')));
      await assertFails(
        setDoc(doc(superAdminDb, 'private_config', 'singpay'), { hacked: true })
      );
    });

    it('refuse tout accès client (read et write) sur settings/payment_gateway', async () => {
      const superAdminDb = testEnv.authenticatedContext(superAdminUid, { role: 'SUPER_ADMIN' }).firestore();
      const userDb = testEnv.authenticatedContext(userUid).firestore();

      await assertFails(getDoc(doc(superAdminDb, 'settings', 'payment_gateway')));
      await assertFails(getDoc(doc(userDb, 'settings', 'payment_gateway')));
      await assertFails(
        setDoc(doc(superAdminDb, 'settings', 'payment_gateway'), { hacked: true })
      );
    });

    it('autorise uniquement Super Admin à lire gateway_audit et interdit toute écriture client', async () => {
      const superAdminDb = testEnv.authenticatedContext(superAdminUid, { role: 'SUPER_ADMIN' }).firestore();
      const regularAdminDb = testEnv.authenticatedContext(regularAdminUid, { role: 'ADMIN' }).firestore();
      const userDb = testEnv.authenticatedContext(userUid).firestore();

      await assertSucceeds(getDoc(doc(superAdminDb, 'gateway_audit', 'audit_1')));
      await assertFails(getDoc(doc(regularAdminDb, 'gateway_audit', 'audit_1')));
      await assertFails(getDoc(doc(userDb, 'gateway_audit', 'audit_1')));

      await assertFails(
        setDoc(doc(superAdminDb, 'gateway_audit', 'audit_2'), { uid: superAdminUid })
      );
    });
  });
});
