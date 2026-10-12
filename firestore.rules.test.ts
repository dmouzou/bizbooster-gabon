import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'bizbooster-gabon-test';

describe('Firestore Security Rules (Phase 1)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
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
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // 1. un utilisateur connecté ne peut pas créer une annonce avec status: 'ACTIVE' ou des clés de classement
  it('un utilisateur connecté ne peut pas créer une annonce avec status: ACTIVE ou rankingKeys', async () => {
    const userDb = testEnv.authenticatedContext('user_123').firestore();
    const adRef = doc(userDb, 'ads', 'ad_1');

    // Tentative de créer avec status ACTIVE -> doit échouer
    await assertFails(
      setDoc(adRef, {
        userId: 'user_123',
        title: 'Villa à louer',
        status: 'ACTIVE',
      })
    );

    // Tentative avec isFeatured -> doit échouer
    await assertFails(
      setDoc(adRef, {
        userId: 'user_123',
        title: 'Villa à louer',
        status: 'PENDING_REVIEW',
        isFeatured: true,
      })
    );

    // Tentative avec ownerTier -> doit échouer
    await assertFails(
      setDoc(adRef, {
        userId: 'user_123',
        title: 'Villa à louer',
        status: 'PENDING_REVIEW',
        ownerTier: 'BUSINESS',
      })
    );

    // Tentative avec isVipCorner -> doit échouer
    await assertFails(
      setDoc(adRef, {
        userId: 'user_123',
        title: 'Villa à louer',
        status: 'PENDING_REVIEW',
        isVipCorner: true,
      })
    );

    // Création légitime avec PENDING_REVIEW et sans rankingKeys -> doit réussir
    await assertSucceeds(
      setDoc(adRef, {
        userId: 'user_123',
        title: 'Villa à louer',
        status: 'PENDING_REVIEW',
        price: 500000,
        paymentReference: 'PAY-123456',
      })
    );
  });

  // 2. un propriétaire ne peut modifier aucune clé de rankingKeys(), ni userId, ni passer vers ACTIVE
  it('un propriétaire ne peut modifier aucune clé de rankingKeys(), ni userId, ni passer vers ACTIVE', async () => {
    // Pré-remplir l'annonce via contexte admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ads', 'ad_owned'), {
        userId: 'user_owner',
        title: 'Voiture',
        status: 'PENDING_REVIEW',
        isFeatured: false,
        viewsCount: 10,
      });
    });

    const ownerDb = testEnv.authenticatedContext('user_owner').firestore();
    const adRef = doc(ownerDb, 'ads', 'ad_owned');

    // Tentative de passer à ACTIVE -> doit échouer
    await assertFails(
      updateDoc(adRef, {
        status: 'ACTIVE',
      })
    );

    // Tentative de modifier isFeatured -> doit échouer
    await assertFails(
      updateDoc(adRef, {
        isFeatured: true,
      })
    );

    // Tentative de modifier userId -> doit échouer
    await assertFails(
      updateDoc(adRef, {
        userId: 'user_other',
      })
    );

    // Modification autorisée : changer le titre en gardant PENDING_REVIEW
    await assertSucceeds(
      updateDoc(adRef, {
        title: 'Voiture Toyota mise à jour',
        status: 'PENDING_REVIEW',
      })
    );
  });

  // 3. un visiteur anonyme ne lit pas une annonce PENDING_REVIEW
  it('un visiteur anonyme ne lit pas une annonce PENDING_REVIEW, mais lit une ACTIVE', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ads', 'ad_pending'), {
        userId: 'seller_1',
        title: 'Annonce en modération',
        status: 'PENDING_REVIEW',
        contactPhone: '+24107000000',
      });
      await setDoc(doc(context.firestore(), 'ads', 'ad_active'), {
        userId: 'seller_1',
        title: 'Annonce publique',
        status: 'ACTIVE',
      });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(unauthDb, 'ads', 'ad_pending')));
    await assertSucceeds(getDoc(doc(unauthDb, 'ads', 'ad_active')));
  });

  // 4. un utilisateur ne peut pas modifier consumedFreeAdsCount ni freeBoostsRemaining
  it('un utilisateur ne peut pas modifier consumedFreeAdsCount ni freeBoostsRemaining sur son profil', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user_me'), {
        name: 'Jean',
        role: 'USER',
        consumedFreeAdsCount: 1,
        freeBoostsRemaining: 2,
      });
    });

    const meDb = testEnv.authenticatedContext('user_me').firestore();
    const myProfileRef = doc(meDb, 'users', 'user_me');

    // Tentative de modifier consumedFreeAdsCount -> doit échouer
    await assertFails(
      updateDoc(myProfileRef, {
        consumedFreeAdsCount: 0,
      })
    );

    // Tentative de modifier freeBoostsRemaining -> doit échouer
    await assertFails(
      updateDoc(myProfileRef, {
        freeBoostsRemaining: 10,
      })
    );

    // Modification autorisée de son nom -> doit réussir
    await assertSucceeds(
      updateDoc(myProfileRef, {
        name: 'Jean Paul',
      })
    );
  });

  // 5. un utilisateur A ne lit pas les notifications de B
  it('un utilisateur A ne lit pas les notifications de B', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'user_notifications', 'notif_b'), {
        userId: 'user_b',
        title: 'Notification secrète',
        message: 'Bienvenue',
      });
    });

    const aDb = testEnv.authenticatedContext('user_a').firestore();
    await assertFails(getDoc(doc(aDb, 'user_notifications', 'notif_b')));

    const bDb = testEnv.authenticatedContext('user_b').firestore();
    await assertSucceeds(getDoc(doc(bDb, 'user_notifications', 'notif_b')));
  });

  // 6. un non-admin ne lit pas registeredPhones / system_config
  it('un non-admin ne lit pas registeredPhones / system_config, mais lit public_config', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'settings', 'system_config'), {
        registeredPhones: ['+24107000000', '+24162000000'],
        showTestAds: false,
      });
      await setDoc(doc(context.firestore(), 'settings', 'public_config'), {
        showTestAds: false,
      });
    });

    const normalUserDb = testEnv.authenticatedContext('user_regular').firestore();
    await assertFails(getDoc(doc(normalUserDb, 'settings', 'system_config')));
    await assertSucceeds(getDoc(doc(normalUserDb, 'settings', 'public_config')));
  });
});
