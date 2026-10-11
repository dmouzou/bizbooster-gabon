/**
 * Script de migration des comptes et réconciliation Auth/Firestore (Phase 2)
 *
 * Objectif :
 * Chaque personne existante a exactement UN utilisateur Auth dont l'uid est égal à l'id de son document Firestore,
 * avec le numéro de téléphone (+241XXXXXXXX) et l'e-mail synthétique (<8chiffres>@bizbooster.ga) tous deux renseignés.
 *
 * Utilisation :
 *   npx tsx scripts/migrate_auth_users.ts --dry-run
 *   npx tsx scripts/migrate_auth_users.ts --execute
 *   npx tsx scripts/migrate_auth_users.ts --cleanup-passwords
 */

import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth, UserRecord } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon',
  });
}

const db = getFirestore();
const auth = getAuth();

const isDryRun = !process.argv.includes('--execute') && !process.argv.includes('--cleanup-passwords');
const isCleanupPasswords = process.argv.includes('--cleanup-passwords');

function normalizePhone(input: string): { e164: string; digits: string } {
  const digits = (input || '').replace(/\D/g, '');
  let clean = digits;
  if (clean.startsWith('241')) clean = clean.slice(3);
  if (clean.startsWith('0')) clean = clean.slice(1);
  return {
    e164: `+241${clean}`,
    digits: clean,
  };
}

async function cleanupPasswordsPhase() {
  console.log('--- NETTOYAGE POST-PHASE 3 : SUPPRESSION DES MOTS DE PASSE DANS FIRESTORE ---');
  const snap = await db.collection('users').get();
  let count = 0;
  for (const doc of snap.docs) {
    if (doc.data().password !== undefined) {
      if (!isDryRun) {
        await doc.ref.update({
          password: FieldValue.delete(),
        });
      }
      count++;
    }
  }
  console.log(`[${isDryRun ? 'SIMULATION' : 'REEL'}] ${count} champ(s) password supprimé(s) des documents users.`);
}

async function runMigration() {
  if (isCleanupPasswords) {
    await cleanupPasswordsPhase();
    return;
  }

  console.log('================================================================');
  console.log(`🚀 SCRIPT DE MIGRATION AUTH & FIRESTORE (Mode: ${isDryRun ? 'DRY-RUN / SIMULATION' : 'EXECUTION REELLE'})`);
  console.log('================================================================\n');

  const usersSnap = await db.collection('users').get();
  console.log(`Nombre total de documents dans users: ${usersSnap.size}`);

  let reconciledCount = 0;
  let reallocatedAdsCount = 0;
  let deletedOrphanDocsCount = 0;

  for (const doc of usersSnap.docs) {
    const docId = doc.id;
    const userData = doc.data();
    const rawPhone = userData.phoneNumber || userData.contactPhone || docId;
    const { e164, digits } = normalizePhone(rawPhone);
    const syntheticEmail = `${digits}@bizbooster.ga`;

    console.log(`\nTraitement du document users/${docId} (Tel: ${e164})`);

    // 1. Résolution de l'utilisateur Auth E : par docId sinon par e-mail synthétique
    let userE: UserRecord | null = null;
    try {
      userE = await auth.getUser(docId);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/user-not-found') {
        console.error(`   Erreur getUser(${docId}):`, err);
      }
    }

    if (!userE) {
      try {
        userE = await auth.getUserByEmail(syntheticEmail);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== 'auth/user-not-found') {
          console.error(`   Erreur getUserByEmail(${syntheticEmail}):`, err);
        }
      }
    }

    // Si E n'existe toujours pas dans Auth, le créer avec l'uid docId (ou nouvel uid si docId numérique)
    if (!userE) {
      console.log(`   ℹ️ Aucun utilisateur Auth pour users/${docId}. Création en cours...`);
      const randomPassword = crypto.randomBytes(16).toString('hex') + 'A1!';
      const initialPassword =
        userData.password && userData.password !== 'users-with-no-password'
          ? userData.password
          : randomPassword;

      if (!isDryRun) {
        try {
          userE = await auth.createUser({
            uid: docId.length > 20 ? docId : undefined,
            email: syntheticEmail,
            password: initialPassword,
            displayName: userData.name || 'Annonceur BizBooster',
          });
        } catch (createErr) {
          console.error(`   Erreur createUser:`, createErr);
          continue;
        }
      } else {
        console.log(`   [DRY-RUN] Utilisateur Auth E serait créé avec email ${syntheticEmail}`);
      }
    }

    const targetUid = userE?.uid || docId;

    // 2. Gestion de l'utilisateur uniquement téléphone P
    let userP: UserRecord | null = null;
    try {
      userP = await auth.getUserByPhoneNumber(e164);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/user-not-found') {
        console.error(`   Erreur getUserByPhoneNumber(${e164}):`, err);
      }
    }

    if (userP && userP.uid !== targetUid) {
      console.log(`   ⚠️ Conflit détecté : utilisateur téléphone P (${userP.uid}) distinct de E (${targetUid})`);

      // A. Réaffecter les annonces de P vers E
      const pAdsSnap = await db.collection('ads').where('userId', '==', userP.uid).get();
      if (!pAdsSnap.empty) {
        console.log(`   Réaffectation de ${pAdsSnap.size} annonce(s) de ${userP.uid} vers ${targetUid}`);
        if (!isDryRun) {
          const batch = db.batch();
          pAdsSnap.forEach((adDoc) => {
            batch.update(adDoc.ref, { userId: targetUid });
          });
          await batch.commit();
        }
        reallocatedAdsCount += pAdsSnap.size;
      }

      // B. Réaffecter les paiements de P vers E
      const pPaymentsSnap = await db.collection('payments').where('userId', '==', userP.uid).get();
      if (!pPaymentsSnap.empty) {
        console.log(`   Réaffectation de ${pPaymentsSnap.size} paiement(s) de ${userP.uid} vers ${targetUid}`);
        if (!isDryRun) {
          const batch = db.batch();
          pPaymentsSnap.forEach((pDoc) => {
            batch.update(pDoc.ref, { userId: targetUid });
          });
          await batch.commit();
        }
      }

      // C. Supprimer l'utilisateur P
      console.log(`   Suppression de l'utilisateur Auth temporaire P (${userP.uid})`);
      if (!isDryRun) {
        await auth.deleteUser(userP.uid);
      }

      // D. Attribuer le numéro de téléphone à E
      console.log(`   Affectation du numéro ${e164} à E (${targetUid})`);
      if (!isDryRun) {
        await auth.updateUser(targetUid, { phoneNumber: e164 });
      }
    } else if (!userP && userE) {
      // Définir le numéro de téléphone sur E
      console.log(`   Définition du numéro de téléphone ${e164} sur E (${targetUid})`);
      if (!isDryRun) {
        try {
          await auth.updateUser(targetUid, { phoneNumber: e164 });
        } catch (phoneErr) {
          console.warn(`   Impossible de lier le téléphone à E:`, phoneErr);
        }
      }
    }

    // 3. Assurer que E possède l'email synthétique et le mot de passe
    const passwordToSet =
      userData.password && userData.password !== 'users-with-no-password'
        ? userData.password
        : crypto.randomBytes(16).toString('hex') + 'A1!';

    if (!isDryRun && userE) {
      try {
        await auth.updateUser(targetUid, {
          email: syntheticEmail,
          password: passwordToSet,
        });
      } catch (updateErr) {
        console.warn(`   Avertissement updateUser (${targetUid}):`, updateErr);
      }
    }

    // 4. Normaliser le document Firestore (ID == targetUid, format E.164)
    const normalizedData = {
      ...userData,
      id: targetUid,
      contactPhone: e164,
      phoneNumber: e164,
      updatedAt: new Date().toISOString(),
    };

    if (docId !== targetUid) {
      console.log(`   Migration du document users/${docId} vers users/${targetUid}`);
      if (!isDryRun) {
        await db.collection('users').doc(targetUid).set(normalizedData, { merge: true });
        await doc.ref.delete();
      }
      deletedOrphanDocsCount++;
    } else {
      if (!isDryRun) {
        await doc.ref.set(
          {
            contactPhone: e164,
            phoneNumber: e164,
          },
          { merge: true }
        );
      }
    }

    reconciledCount++;
  }

  console.log('\n================================================================');
  console.log(`🏁 RESULTAT MIGRATION (${isDryRun ? 'SIMULATION' : 'REEL'}) :`);
  console.log(`   - Utilisateurs réconciliés : ${reconciledCount}`);
  console.log(`   - Annonces réaffectées : ${reallocatedAdsCount}`);
  console.log(`   - Documents orphelins renommés/nettoyés : ${deletedOrphanDocsCount}`);
  console.log('================================================================\n');
}

runMigration().catch((err) => {
  console.error('Erreur migration:', err);
});
