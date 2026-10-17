import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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

  // 7. Étape 1.1 : Fermer l'élévation de privilèges (S-01)
  it('un ADMIN ne peut pas sécrire isSuperAdmin, isAdmin, role ou subscription, mais peut approuver le KYC', async () => {
    // Pré-créer un utilisateur et un admin dans Firestore
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'admin_1'), {
        role: 'ADMIN',
        name: 'Modérateur',
      });
      await setDoc(doc(context.firestore(), 'users', 'target_user'), {
        role: 'USER',
        name: 'Utilisateur Cible',
        idVerificationStatus: 'PENDING',
      });
    });

    const adminDb = testEnv.authenticatedContext('admin_1', { role: 'ADMIN' }).firestore();
    const adminSelfRef = doc(adminDb, 'users', 'admin_1');
    const targetRef = doc(adminDb, 'users', 'target_user');

    // Tentative de l'ADMIN de s'écrire isSuperAdmin: true -> doit échouer
    await assertFails(updateDoc(adminSelfRef, { isSuperAdmin: true }));

    // Tentative de l'ADMIN de modifier son rôle en SUPER_ADMIN -> doit échouer
    await assertFails(updateDoc(adminSelfRef, { role: 'SUPER_ADMIN' }));

    // Tentative de l'ADMIN de s'attribuer un forfait VIP -> doit échouer
    await assertFails(updateDoc(adminSelfRef, { subscriptionTier: 'VIP' }));

    // Par contre, l'ADMIN peut approuver le KYC d'un utilisateur (champs de adminAllowedUserKeys) -> doit réussir
    await assertSucceeds(
      updateDoc(targetRef, {
        idVerificationStatus: 'VERIFIED',
        isKycVerified: true,
        isVerified: true,
        idVerifiedAt: new Date().toISOString(),
      })
    );
  });

  // 8. Étape 1.2 : Verrouiller KYC et badges (S-02, S-06)
  it('un propriétaire ne peut pas auto-attribuer VERIFIED, ni isKycVerified, et changer idDocumentUrl impose PENDING', async () => {
    const userDb = testEnv.authenticatedContext('user_kyc_test').firestore();
    const profileRef = doc(userDb, 'users', 'user_kyc_test');

    // Tentative de création avec idVerificationStatus: 'VERIFIED' -> doit échouer
    await assertFails(
      setDoc(profileRef, {
        role: 'USER',
        name: 'Frauduleux',
        idVerificationStatus: 'VERIFIED',
      })
    );

    // Tentative de création avec isKycVerified: true -> doit échouer
    await assertFails(
      setDoc(profileRef, {
        role: 'USER',
        name: 'Frauduleux',
        isKycVerified: true,
      })
    );

    // Création légitime en NOT_SUBMITTED -> doit réussir
    await assertSucceeds(
      setDoc(profileRef, {
        role: 'USER',
        name: 'Honnête',
        idVerificationStatus: 'NOT_SUBMITTED',
      })
    );

    // Tentative de mise à jour pour s'auto-attribuer isKycVerified -> doit échouer
    await assertFails(
      updateDoc(profileRef, {
        isKycVerified: true,
      })
    );

    // Pré-valider le compte via le contexte de règles désactivées
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'user_kyc_test'), {
        idVerificationStatus: 'VERIFIED',
        idDocumentUrl: 'https://storage.googleapis.com/kyc/doc1.png',
      });
    });

    // Tentative de remplacer idDocumentUrl en restant VERIFIED -> doit échouer
    await assertFails(
      updateDoc(profileRef, {
        idDocumentUrl: 'https://storage.googleapis.com/kyc/doc2.png',
      })
    );

    // Remplacer idDocumentUrl en repassant le statut à PENDING -> doit réussir
    await assertSucceeds(
      updateDoc(profileRef, {
        idDocumentUrl: 'https://storage.googleapis.com/kyc/doc2.png',
        idVerificationStatus: 'PENDING',
      })
    );

    // Tentative de changer son numéro de téléphone -> doit échouer
    await assertFails(
      updateDoc(profileRef, {
        phone: '+24177999999',
      })
    );
  });

  // 9. Étape 1.3 : Signalements et compteurs (S-04, S-07)
  it('rapport anonyme refusé, second rapport ou incrément public refusé, system_counters super admin only', async () => {
    // 1. Rapport anonyme -> refusé
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(unauthDb, 'reports', 'ad_1_anon'), {
        adId: 'ad_1',
        reason: 'Arnaque',
        details: 'Détails...',
        reporterId: 'anon',
        reporterPhone: '+24100000000',
        status: 'PENDING',
        createdAt: new Date(),
      })
    );

    // 2. Rapport authentifié avec bon ID adId_uid et status PENDING -> réussi
    const reporterDb = testEnv.authenticatedContext('reporter_123').firestore();
    const validReportRef = doc(reporterDb, 'reports', 'ad_1_reporter_123');
    await assertSucceeds(
      setDoc(validReportRef, {
        adId: 'ad_1',
        reason: 'Arnaque financière',
        details: 'Demande un transfert Mobile Money préalable',
        reporterId: 'reporter_123',
        reporterPhone: '+24160000000',
        status: 'PENDING',
        createdAt: serverTimestamp(),
      })
    );

    // 3. Rapport avec mauvais ID (pas adId_uid) -> refusé
    const invalidIdReportRef = doc(reporterDb, 'reports', 'random_id');
    await assertFails(
      setDoc(invalidIdReportRef, {
        adId: 'ad_1',
        reason: 'Arnaque',
        details: 'Détails...',
        reporterId: 'reporter_123',
        reporterPhone: '+24160000000',
        status: 'PENDING',
        createdAt: new Date(),
      })
    );

    // 4. Incrément public de reportsCount sur une annonce -> refusé
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ads', 'ad_reported'), {
        userId: 'other_user',
        title: 'Annonce légitime',
        status: 'ACTIVE',
        reportsCount: 0,
      });
    });

    const adRef = doc(reporterDb, 'ads', 'ad_reported');
    await assertFails(
      updateDoc(adRef, {
        reportsCount: 1,
      })
    );

    // 5. system_counters : écriture par un admin simple -> refusé
    const adminDb = testEnv.authenticatedContext('admin_simple', { role: 'ADMIN' }).firestore();
    await assertFails(
      setDoc(doc(adminDb, 'system_counters', 'scalability_metrics'), {
        totalSmsSent: 0,
      })
    );

    // 6. system_counters : écriture par un SUPER_ADMIN -> réussi
    const superAdminDb = testEnv.authenticatedContext('super_admin_user', { role: 'SUPER_ADMIN' }).firestore();
    await assertSucceeds(
      setDoc(doc(superAdminDb, 'system_counters', 'scalability_metrics'), {
        totalSmsSent: 0,
      })
    );
  });

  // 10. Étape 1.4 : Réglages et notifications (S-08, S-09)
  it('settings liste blanche stricte et user_notifications non modifiable par le client', async () => {
    // Pré-créer un document dans settings autre que public_config
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'settings', 'secret_internal_config'), {
        secretKey: 'top_secret',
      });
      await setDoc(doc(context.firestore(), 'user_notifications', 'user_notif_1_notif_abc'), {
        userId: 'user_notif_1',
        notifId: 'notif_abc',
        title: 'Notification d origine',
      });
    });

    // 1. Lecture de secret_internal_config par un utilisateur normal -> doit échouer (liste blanche)
    const normalDb = testEnv.authenticatedContext('user_notif_1').firestore();
    await assertFails(getDoc(doc(normalDb, 'settings', 'secret_internal_config')));

    // 2. Création de notification par le propriétaire avec ID deterministe userId_notifId -> doit réussir
    await assertSucceeds(
      setDoc(doc(normalDb, 'user_notifications', 'user_notif_1_notif_new'), {
        userId: 'user_notif_1',
        notifId: 'notif_new',
        title: 'Validation annonce',
      })
    );

    // 3. Tentative de falsification / mise à jour de la notification par le propriétaire -> doit échouer
    await assertFails(
      updateDoc(doc(normalDb, 'user_notifications', 'user_notif_1_notif_abc'), {
        title: 'Notification modifiée frauduleusement',
      })
    );

    // 4. Tentative de suppression par le propriétaire -> doit échouer
    await assertFails(
      deleteDoc(doc(normalDb, 'user_notifications', 'user_notif_1_notif_abc'))
    );
  });
});
