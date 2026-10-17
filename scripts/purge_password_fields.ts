/**
 * Script de purge idempotent du champ password dans Firestore (Étape 1.6 - S-03)
 *
 * Scanne tous les documents de la collection 'users' et supprime tout champ
 * 'password' ou 'lastPasswordChangeDate'.
 *
 * Utilisation :
 *   npx tsx scripts/purge_password_fields.ts --dry-run
 *   npx tsx scripts/purge_password_fields.ts --execute
 */

export function extractPasswordFieldsToPurge(data: Record<string, any>): string[] {
  const fields: string[] = [];
  if (data && data.password !== undefined) fields.push('password');
  if (data && data.lastPasswordChangeDate !== undefined) fields.push('lastPasswordChangeDate');
  return fields;
}

export async function runPurge(db: any, FieldValue: any, dryRun = true) {
  console.log(`[Purge Passwords] Démarrage du scan des collections (Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'})...`);
  const usersSnap = await db.collection('users').get();
  let purgedUsers = 0;

  for (const doc of usersSnap.docs) {
    const fields = extractPasswordFieldsToPurge(doc.data());
    if (fields.length > 0) {
      if (!dryRun) {
        const payload: Record<string, any> = {};
        for (const f of fields) payload[f] = FieldValue.delete();
        await doc.ref.update(payload);
      }
      purgedUsers++;
      console.log(`  - Utilisateur ${doc.id} : champs ${fields.join(', ')} purgé(s)`);
    }
  }

  console.log(`[Purge Passwords] Terminé : ${purgedUsers} document(s) nettoyé(s) sur ${usersSnap.size} utilisateurs.`);
  return { purgedUsers, totalScanned: usersSnap.size };
}

if (process.argv[1]?.endsWith('purge_password_fields.ts')) {
  (async () => {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    if (getApps().length === 0) {
      initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon',
      });
    }
    const db = getFirestore();
    const isDryRun = !process.argv.includes('--execute');
    const res = await runPurge(db, FieldValue, isDryRun);
    console.log(`[Purge Passwords] Résultat final (${isDryRun ? 'DRY-RUN' : 'REEL'}) : ${res.purgedUsers}/${res.totalScanned}`);
  })().catch((err) => {
    console.error('[Purge Passwords] Erreur :', err);
    process.exit(1);
  });
}
