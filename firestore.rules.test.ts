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

  // 11. Étape 1.5 : Rôles et custom claims (S-12)
  it('un utilisateur avec custom claim ADMIN ou SUPER_ADMIN accède sans document users/{uid}', async () => {
    // admin_ghost n'a aucun document dans users
    const ghostAdminDb = testEnv.authenticatedContext('admin_ghost', { role: 'ADMIN' }).firestore();
    await assertSucceeds(getDoc(doc(ghostAdminDb, 'settings', 'system_config')));

    const ghostSuperAdminDb = testEnv.authenticatedContext('super_ghost', { role: 'SUPER_ADMIN' }).firestore();
    await assertSucceeds(getDoc(doc(ghostSuperAdminDb, 'system_counters', 'scalability_metrics')));
  });

  // 12. Étape 1.6 : Suppression et interdiction absolue du champ password (S-03)
  it('interdit la création ou la mise à jour d un champ password dans users', async () => {
    const userDb = testEnv.authenticatedContext('user_pwd_test').firestore();
    const userRef = doc(userDb, 'users', 'user_pwd_test');

    // Tentative de création avec champ password -> refusé
    await assertFails(
      setDoc(userRef, {
        role: 'USER',
        name: 'Tentative Password',
        password: 'plain_password',
      })
    );

    // Création normale sans password -> autorisé
    await assertSucceeds(
      setDoc(userRef, {
        role: 'USER',
        name: 'Utilisateur Sans Mot De Passe',
      })
    );

    // Tentative de mise à jour avec password -> refusé
    await assertFails(
      updateDoc(userRef, {
        password: 'hacked_password',
      })
    );
  });

  // 13. Étape 3.3 : Compteurs de vues répartis ad_counters (O-08, C-03)
  it('autorise la lecture publique de ad_counters mais interdit toute écriture client', async () => {
    // 1. Visiteur anonyme ou connecté peut lire un compteur
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const userDb = testEnv.authenticatedContext('user_viewer').firestore();
    const counterRefAnon = doc(anonDb, 'ad_counters', 'ad_123');
    const counterRefUser = doc(userDb, 'ad_counters', 'ad_123');

    // Lecture autorisée
    await assertSucceeds(getDoc(counterRefAnon));
    await assertSucceeds(getDoc(counterRefUser));

    // Tentative d'écriture client -> refusé
    await assertFails(
      setDoc(counterRefUser, {
        views: 9999,
      })
    );
    await assertFails(
      setDoc(counterRefAnon, {
        views: 1,
      })
    );
  });

  // 14. Priorité R1 : Inscription PhoneAuthModal (isVerified interdit au client)
  it('R1: refuse la création de compte avec isVerified mais accepte le payload conforme PhoneAuthModal', async () => {
    const userDb = testEnv.authenticatedContext('user_r1').firestore();
    const userRef = doc(userDb, 'users', 'user_r1');

    // Tentative avec isVerified: true (défaut initial de PhoneAuthModal) -> doit échouer
    await assertFails(
      setDoc(userRef, {
        name: 'Jean Paul',
        country: 'GA',
        operator: 'AIRTEL',
        role: 'USER',
        isVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        contactPhone: '+24177000000',
        phoneNumber: '+24177000000',
      })
    );

    // Payload conforme corrigé sans isVerified -> doit réussir
    await assertSucceeds(
      setDoc(userRef, {
        name: 'Jean Paul',
        country: 'GA',
        operator: 'AIRTEL',
        role: 'USER',
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        contactPhone: '+24177000000',
        phoneNumber: '+24177000000',
        location: {
          province: 'Estuaire',
          city: 'Libreville',
        },
      })
    );
  });

  // 15. B1 & B17 : Verrouillage strict boostRequested, withBoost, featuredPausedAt, publishedAt, moderatedAt
  it('B1 & B17: refuse la création avec boostRequested, withBoost, featuredPausedAt, publishedAt ou moderatedAt', async () => {
    const userDb = testEnv.authenticatedContext('user_b1').firestore();
    const adRef = doc(userDb, 'ads', 'ad_b1');

    // Création avec withBoost -> refusée
    await assertFails(
      setDoc(adRef, {
        userId: 'user_b1',
        title: 'Appartement vue mer',
        status: 'PENDING_REVIEW',
        price: 250000,
        withBoost: true,
      })
    );

    // Création avec boostRequested -> refusée
    await assertFails(
      setDoc(adRef, {
        userId: 'user_b1',
        title: 'Appartement vue mer',
        status: 'PENDING_REVIEW',
        price: 250000,
        boostRequested: true,
      })
    );

    // Création avec featuredPausedAt -> refusée
    await assertFails(
      setDoc(adRef, {
        userId: 'user_b1',
        title: 'Appartement vue mer',
        status: 'PENDING_REVIEW',
        price: 250000,
        featuredPausedAt: new Date().toISOString(),
      })
    );

    // Création avec publishedAt -> refusée (B17)
    await assertFails(
      setDoc(adRef, {
        userId: 'user_b1',
        title: 'Appartement vue mer',
        status: 'PENDING_REVIEW',
        price: 250000,
        publishedAt: new Date().toISOString(),
      })
    );

    // Création avec moderatedAt -> refusée (B17)
    await assertFails(
      setDoc(adRef, {
        userId: 'user_b1',
        title: 'Appartement vue mer',
        status: 'PENDING_REVIEW',
        price: 250000,
        moderatedAt: new Date().toISOString(),
      })
    );
  });

  // 16. B2 : freeBoosts (champ historique) verrouillé dans privilegedKeys
  it('B2: interdit l auto-attribution de freeBoosts sur le profil utilisateur', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user_b2'), {
        role: 'USER',
        name: 'Test B2',
        freeBoostsRemaining: 0,
      });
    });

    const userDb = testEnv.authenticatedContext('user_b2').firestore();
    const userRef = doc(userDb, 'users', 'user_b2');

    // Tentative de modification de freeBoosts -> refusée
    await assertFails(
      updateDoc(userRef, {
        freeBoosts: 20,
      })
    );
  });

  // 17. B4 : Le contenu d une annonce ACTIVE est verrouillé en mise à jour directe (doit passer par resubmitAd)
  it('B4: interdit au propriétaire de modifier directement le contenu d une annonce ACTIVE', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ads', 'ad_active_b4'), {
        userId: 'user_b4',
        title: 'Titre Original Approuve',
        description: 'Description initiale',
        status: 'ACTIVE',
        price: 100000,
      });
    });

    const userDb = testEnv.authenticatedContext('user_b4').firestore();
    const adRef = doc(userDb, 'ads', 'ad_active_b4');

    // Tentative de mise à jour directe du titre sur annonce ACTIVE -> refusée
    await assertFails(
      updateDoc(adRef, {
        title: 'Titre Frauduleux Modifie Sans Moderation',
      })
    );

    // Tentative de mise à jour du prix sur annonce ACTIVE -> refusée
    await assertFails(
      updateDoc(adRef, {
        price: 500,
      })
    );
  });

  // 18. B31 : idVerificationStatus ne peut pas être repassé à PENDING si déjà VERIFIED
  it('B31: interdit de repasser idVerificationStatus à PENDING si le statut est déjà VERIFIED', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user_b31_kyc'), {
        role: 'USER',
        name: 'Verified User',
        idVerificationStatus: 'VERIFIED',
      });
    });

    const userDb = testEnv.authenticatedContext('user_b31_kyc').firestore();
    const userRef = doc(userDb, 'users', 'user_b31_kyc');

    // Tentative de réinitialisation vers PENDING -> refusée
    await assertFails(
      updateDoc(userRef, {
        idVerificationStatus: 'PENDING',
      })
    );
  });

  // 19. B31 : settings/system_config protégé pour super admin uniquement, notifications auto-créables interdites
  it('B31: seul un SUPER_ADMIN peut écrire settings/system_config, les clients ne créent pas de notifications', async () => {
    const adminDb = testEnv.authenticatedContext('admin_simple', { role: 'ADMIN' }).firestore();
    const superAdminDb = testEnv.authenticatedContext('super_admin', { role: 'SUPER_ADMIN' }).firestore();
    const userDb = testEnv.authenticatedContext('user_notif').firestore();

    const sysConfigAdmin = doc(adminDb, 'settings', 'system_config');
    const sysConfigSuper = doc(superAdminDb, 'settings', 'system_config');

    // Admin simple tente d'écrire system_config -> refusé
    await assertFails(
      setDoc(sysConfigAdmin, {
        registeredPhones: ['+24177112233'],
      })
    );

    // Super Admin écrit system_config -> autorisé
    await assertSucceeds(
      setDoc(sysConfigSuper, {
        registeredPhones: ['+24177112233'],
      })
    );

    // Client tente de s'auto-créer une notification -> refusé
    const notifRef = doc(userDb, 'user_notifications', 'user_notif_n1');
    await assertFails(
      setDoc(notifRef, {
        userId: 'user_notif',
        title: 'Fausse notification',
        createdAt: new Date().toISOString(),
      })
    );
  });
});


