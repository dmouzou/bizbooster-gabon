/**
 * Script de migration idempotent des rôles utilisateurs BIZBOOSTER (Phase 1 - Étape 1.5)
 *
 * Normalise tous les rôles en 'USER' | 'ADMIN' | 'SUPER_ADMIN' et pose les custom claims correspondants.
 *
 * Utilisation :
 *   npx tsx scripts/migrate_roles.ts --dry-run
 *   npx tsx scripts/migrate_roles.ts --execute
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { normalizeRole } from '../src/utils/roles';

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon',
  });
}

const db = getFirestore();
const auth = getAuth();
const isDryRun = !process.argv.includes('--execute');

async function migrateRoles() {
  console.log(`=== MIGRATION DES RÔLES BIZBOOSTER [${isDryRun ? 'MODE SIMULATION (DRY-RUN)' : 'MODE EXECUTION REELLE'}] ===`);
  const snap = await db.collection('users').get();
  console.log(`Documents analysés dans 'users' : ${snap.size}`);

  let updatedCount = 0;
  let alreadyNormalizedCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const currentRole = data.role;
    const normalized = normalizeRole(currentRole);

    // Vérifier si le rôle est déjà strictement conforme
    if (currentRole === normalized) {
      alreadyNormalizedCount++;
      continue;
    }

    console.log(`Utilisateur ${docSnap.id} : rôle actuel '${currentRole}' -> normalisé '${normalized}'`);
    updatedCount++;

    if (!isDryRun) {
      // 1. Mise à jour Firestore
      await docSnap.ref.update({
        role: normalized,
        updatedAt: new Date().toISOString(),
      });

      // 2. Poser le custom claim si l'utilisateur Auth existe
      try {
        await auth.setCustomUserClaims(docSnap.id, { role: normalized });
      } catch (err: any) {
        console.warn(`  [Notice] Impossible de poser le custom claim Auth pour ${docSnap.id}:`, err?.message);
      }
    }
  }

  console.log(`--- BILAN ---`);
  console.log(`Déjà normalisés : ${alreadyNormalizedCount}`);
  console.log(`À normaliser / modifiés : ${updatedCount}`);
  if (isDryRun) {
    console.log(`Pour appliquer ces modifications en base, relancez avec : npx tsx scripts/migrate_roles.ts --execute`);
  } else {
    console.log(`Migration des rôles exécutée avec succès.`);
  }
}

migrateRoles().catch((err) => {
  console.error('Erreur lors de la migration des rôles :', err);
  process.exit(1);
});
