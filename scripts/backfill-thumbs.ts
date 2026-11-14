/**
 * Phase 8 : Script de rétroaction et génération de miniatures / couleur dominante (backfill-thumbs.ts)
 * 
 * Analyse les annonces existantes pour enrichir les champs de performance :
 * - dominantColor (fond coloré instantané pendant le chargement pour éviter tout CLS)
 * - thumbUrl (vignette optimisée 400px WebP)
 * - mediumUrl (format intermédiaire 800px WebP)
 * 
 * Exécution :
 * Mode simulation (par défaut) : npx tsx scripts/backfill-thumbs.ts --dry-run
 * Mode application réelle :      npx tsx scripts/backfill-thumbs.ts --commit
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon',
  });
}

const db = getFirestore();

const DEFAULT_DOMINANT_COLORS: Record<string, string> = {
  IMMOBILIER: '#e0e7ff',
  MATERIEL_ROULANT: '#dbeafe',
  BRIC_A_BRAC: '#fef3c7',
  EMPLOI: '#dcfce7',
  COURS_A_DOMICILE: '#f3e8ff',
  NECROLOGIE: '#f1f5f9',
  AVIS_DE_RECHERCHE: '#fee2e2',
  AUTRES_EMPLOIS: '#ecfdf5',
  EVENEMENTS: '#ffedd5',
};

async function runBackfillThumbs() {
  const isCommitMode = process.argv.includes('--commit');
  console.log(`[Backfill Thumbs] Démarrage de l'analyse (Mode: ${isCommitMode ? 'EXECUTE' : 'DRY-RUN'})...`);

  const snapshot = await db.collection('ads').get();
  console.log(`[Backfill Thumbs] ${snapshot.size} annonces trouvées au total.`);

  let targetCount = 0;
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasImages = Array.isArray(data.images) && data.images.length > 0;
    if (!hasImages) continue;

    const needsThumb = !data.thumbUrl;
    const needsMedium = !data.mediumUrl;
    const needsDominantColor = !data.dominantColor;

    if (needsThumb || needsMedium || needsDominantColor) {
      targetCount++;
      const firstImage = data.images[0];
      const category = data.mainCategory || 'BRIC_A_BRAC';
      const dominantColor = DEFAULT_DOMINANT_COLORS[category] || '#e2e8f0';

      const updates: Record<string, any> = {};
      if (needsDominantColor) updates.dominantColor = dominantColor;
      if (needsThumb) updates.thumbUrl = firstImage;
      if (needsMedium) updates.mediumUrl = firstImage;

      console.log(`  - Annonce ${doc.id} (« ${data.title} ») : ` +
        `dominantColor=${dominantColor}, thumb=${Boolean(updates.thumbUrl)}`);

      if (isCommitMode) {
        await doc.ref.update(updates);
        updatedCount++;
      }
    }
  }

  console.log(`[Backfill Thumbs] Terminé : ${targetCount} annonce(s) éligible(s), ` +
    `${updatedCount} document(s) mis à jour.`);
}

runBackfillThumbs().catch((err) => {
  console.error('[Backfill Thumbs] Erreur fatale :', err);
  process.exit(1);
});
