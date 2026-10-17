/**
 * Phase 6 : Script d'administration et de migration des données (backfill.ts)
 * 
 * Objectifs :
 * 1. Recalcule ownerTier, isOwnerVip, isOwnerVerified pour toutes les annonces selon le profil propriétaire.
 * 2. Supprime ou corrige isFeatured et featuredUntil incohérents (sans date, dans le passé, > now + 30j).
 * 3. Recalcule isVipCorner avec les règles métier du Coin VIP.
 * 4. Remet à zéro les viewsCount aberrants (> 10 fois la médiane).
 * 5. Journalise chaque modification dans un rapport et sauvegarde les valeurs initiales pour retour arrière.
 * 
 * Exécution :
 * Mode simulation (par défaut) : npx tsx scripts/backfill.ts --dry-run
 * Mode application réelle :      npx tsx scripts/backfill.ts --commit
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialisation Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon',
  });
}

const db = getFirestore();

interface AdMigrationRecord {
  adId: string;
  original: Record<string, any>;
  updates: Record<string, any>;
  reasons: string[];
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function computeEffectiveUserTier(userData: any, nowMs: number): 'STANDARD' | 'PRO' | 'ELITE' | 'BUSINESS' {
  if (userData.isExempt || userData.exemptFromPaymentAndKyc) {
    return userData.subscriptionTier || 'BUSINESS';
  }
  const tier = userData.subscriptionTier;
  if (!tier || tier === 'STANDARD') return 'STANDARD';
  const expiresAt = userData.subscriptionExpiresAt;
  if (!expiresAt) return 'STANDARD';
  const expMs = new Date(expiresAt).getTime();
  if (isNaN(expMs) || expMs <= nowMs) return 'STANDARD';
  return tier;
}

function isVipCornerEligible(adData: any): boolean {
  const cat = adData.mainCategory;
  if (cat !== 'IMMOBILIER' && cat !== 'MATERIEL_ROULANT') return false;

  const price = Number(adData.price) || 0;
  const unit = adData.priceUnit || 'total';

  if (cat === 'IMMOBILIER') {
    const tType = adData.transactionType;
    if (tType === 'LOCATION') {
      if (unit === 'jour') return price >= 100000;
      return price >= 1000000;
    }
    if (tType === 'VENTE') {
      return price >= 50000000;
    }
    return false;
  }

  if (cat === 'MATERIEL_ROULANT') {
    const vCat = adData.vehicleData?.category;
    const tType = adData.transactionType;
    if (vCat === 'Engins lourds' || vCat === 'Bateaux' || vCat === 'Aviation') {
      return true;
    }
    if (tType === 'LOCATION') {
      if (unit === 'jour') return price >= 80000;
      return price >= 1000000;
    }
    if (tType === 'VENTE') {
      return price >= 20000000;
    }
    return false;
  }

  return false;
}

export async function runBackfill(isCommit = false) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  console.log('================================================================');
  console.log(`🚀 BIZBOOSTER GABON - MIGRATION DES DONNÉES (PHASE 6)`);
  console.log(`Mode : ${isCommit ? '🔴 COMMIT RÉEL' : '🟢 SIMULATION (--dry-run)'}`);
  console.log(`Date d\'exécution : ${nowIso}`);
  console.log('================================================================\n');

  // 1. Charger tous les utilisateurs pour mise en cache mémoire
  console.log('Chargement des profils utilisateurs...');
  const usersSnap = await db.collection('users').get();
  const usersMap = new Map<string, any>();
  usersSnap.forEach((doc) => {
    usersMap.set(doc.id, doc.data());
  });
  console.log(`✓ ${usersMap.size} utilisateurs indexés.\n`);

  // 2. Charger toutes les annonces
  console.log('Chargement des annonces...');
  const adsSnap = await db.collection('ads').get();
  console.log(`✓ ${adsSnap.size} annonces trouvées.\n`);

  // 3. Calcul de la médiane des vues
  const allViews: number[] = [];
  adsSnap.forEach((doc) => {
    const views = Number(doc.data().viewsCount);
    if (!isNaN(views) && views >= 0) {
      allViews.push(views);
    }
  });

  const medianViews = calculateMedian(allViews);
  const aberrantViewsThreshold = Math.max(100, medianViews * 10);
  console.log(`Statistiques de vues :`);
  console.log(` - Médiane des vues : ${medianViews}`);
  console.log(` - Seuil d'aberration (> 10x médiane) : ${aberrantViewsThreshold}\n`);

  const recordsToUpdate: AdMigrationRecord[] = [];
  let statsTier = 0;
  let statsBoost = 0;
  let statsVipCorner = 0;
  let statsViews = 0;

  // 4. Analyse et calcul des corrections pour chaque annonce
  for (const doc of adsSnap.docs) {
    const adId = doc.id;
    const adData = doc.data();
    const updates: Record<string, any> = {};
    const reasons: string[] = [];
    const original: Record<string, any> = {};

    // 1. Recalcul du palier propriétaire et vérification
    const userId = adData.userId;
    const userProfile = userId ? usersMap.get(userId) : null;

    let targetTier: 'STANDARD' | 'PRO' | 'ELITE' | 'BUSINESS' = 'STANDARD';
    let targetIsVip = false;
    let targetIsVerified = false;

    if (userProfile) {
      targetTier = computeEffectiveUserTier(userProfile, now);
      targetIsVip = !!(userProfile.isVip || userProfile.isExempt || userProfile.exemptFromPaymentAndKyc);
      targetIsVerified = targetIsVip || userProfile.idVerificationStatus === 'VERIFIED';
    }

    if (adData.ownerTier !== targetTier) {
      original.ownerTier = adData.ownerTier;
      updates.ownerTier = targetTier;
      reasons.push(`ownerTier corrigé : '${adData.ownerTier || 'indéfini'}' -> '${targetTier}'`);
      statsTier++;
    }

    if (!!adData.isOwnerVip !== targetIsVip) {
      original.isOwnerVip = adData.isOwnerVip;
      updates.isOwnerVip = targetIsVip;
      reasons.push(`isOwnerVip corrigé : ${adData.isOwnerVip} -> ${targetIsVip}`);
    }

    if (!!adData.isOwnerVerified !== targetIsVerified) {
      original.isOwnerVerified = adData.isOwnerVerified;
      updates.isOwnerVerified = targetIsVerified;
      reasons.push(`isOwnerVerified corrigé : ${adData.isOwnerVerified} -> ${targetIsVerified}`);
    }

    // 2. Correction du boost isFeatured et featuredUntil
    const maxFutureBoostMs = now + 30 * 86400000;
    if (adData.isFeatured) {
      if (!adData.featuredUntil) {
        original.isFeatured = adData.isFeatured;
        updates.isFeatured = false;
        reasons.push(`isFeatured désactivé (featuredUntil manquant)`);
        statsBoost++;
      } else {
        const featExpMs = new Date(adData.featuredUntil).getTime();
        if (isNaN(featExpMs) || featExpMs <= now) {
          original.isFeatured = adData.isFeatured;
          updates.isFeatured = false;
          reasons.push(`isFeatured désactivé (featuredUntil échu le ${adData.featuredUntil})`);
          statsBoost++;
        } else if (featExpMs > maxFutureBoostMs) {
          original.featuredUntil = adData.featuredUntil;
          const cappedDate = new Date(maxFutureBoostMs).toISOString();
          updates.featuredUntil = cappedDate;
          reasons.push(`featuredUntil plafonné (> 30j dans le futur) : ${adData.featuredUntil} -> ${cappedDate}`);
          statsBoost++;
        }
      }
    } else if (adData.featuredUntil) {
      const featExpMs = new Date(adData.featuredUntil).getTime();
      if (!isNaN(featExpMs) && featExpMs <= now) {
        // Boost expiré avec isFeatured à false, cohérent
      }
    }

    // 3. Recalcul de isVipCorner
    const shouldBeVipCorner = isVipCornerEligible(adData);
    if (!!adData.isVipCorner !== shouldBeVipCorner) {
      original.isVipCorner = adData.isVipCorner;
      updates.isVipCorner = shouldBeVipCorner;
      reasons.push(`isVipCorner recalculé : ${adData.isVipCorner} -> ${shouldBeVipCorner}`);
      statsVipCorner++;
    }

    // 4. Vues aberrantes
    const currentViews = Number(adData.viewsCount) || 0;
    if (currentViews > aberrantViewsThreshold) {
      original.viewsCount = adData.viewsCount;
      updates.viewsCount = 0;
      reasons.push(`viewsCount aberrant remis à zéro : ${currentViews} -> 0`);
      statsViews++;
    }

    // 5. Alignement des champs canoniques (I-02)
    if (adData.rejectionReason && !adData.moderationReason) {
      original.moderationReason = adData.moderationReason;
      updates.moderationReason = adData.rejectionReason;
      reasons.push(`moderationReason aligné depuis rejectionReason`);
    }
    if (adData.paymentReference && !adData.transactionRef) {
      original.transactionRef = adData.transactionRef;
      updates.transactionRef = adData.paymentReference;
      reasons.push(`transactionRef aligné depuis paymentReference`);
    }
    if (adData.necroDeceasedName && !adData.necrologieData?.deceasedName) {
      original.necrologieData = adData.necrologieData;
      updates.necrologieData = {
        ministry: adData.necroMinistry || 'Autre',
        deceasedName: adData.necroDeceasedName,
        ceremonyDate: adData.necroCeremonyDate,
        ceremonyLocation: adData.necroCeremonyLocation,
        familyContact: adData.necroFamilyContact,
        funeralProgram: adData.necroFuneralProgram,
        ...adData.necrologieData,
      };
      reasons.push(`necrologieData structuré synchronisé depuis necro*`);
    }

    if (Object.keys(updates).length > 0) {
      recordsToUpdate.push({
        adId,
        original,
        updates,
        reasons,
      });
    }
  }

  console.log(`----------------------------------------------------------------`);
  console.log(`RÉSUMÉ DU DIAGNOSTIC :`);
  console.log(` - Annonces à modifier : ${recordsToUpdate.length} / ${adsSnap.size}`);
  console.log(` - Corrections de palier / VIP / vérification : ${statsTier}`);
  console.log(` - Corrections de boost (expirés / orphelins / plafonnés) : ${statsBoost}`);
  console.log(` - Recalculs Coin VIP : ${statsVipCorner}`);
  console.log(` - Vues aberrantes réinitialisées : ${statsViews}`);
  console.log(`----------------------------------------------------------------\n`);

  // 5. Sauvegarde du fichier de journalisation / rollback
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `backfill_report_${timestampStr}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        executedAt: nowIso,
        isCommit,
        totalAds: adsSnap.size,
        totalUpdated: recordsToUpdate.length,
        medianViews,
        aberrantViewsThreshold,
        records: recordsToUpdate,
      },
      null,
      2
    )
  );
  console.log(`📁 Fichier de rapport et de sauvegarde créé : ${backupFile}\n`);

  // 6. Application des modifications si --commit
  if (!isCommit) {
    console.log(`ℹ️ MODE SIMULATION (--dry-run) : Aucune modification écrite dans Firestore.`);
    console.log(`   Pour exécuter les corrections réelles, relancez avec :`);
    console.log(`   npx tsx scripts/backfill.ts --commit\n`);
    return { recordsToUpdate, backupFile, isCommit };
  }

  console.log(`Exécution des écritures par lots de 500 documents...`);
  const batchSize = 500;
  for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
    const chunk = recordsToUpdate.slice(i, i + batchSize);
    const batch = db.batch();
    for (const rec of chunk) {
      const docRef = db.collection('ads').doc(rec.adId);
      batch.update(docRef, {
        ...rec.updates,
        updatedAt: nowIso,
      });
    }
    await batch.commit();
    console.log(` - Lot ${Math.floor(i / batchSize) + 1} validé (${chunk.length} annonces)`);
  }

  console.log(`\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS.`);
  return { recordsToUpdate, backupFile, isCommit };
}

// Auto-exécution si lancé en CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const isCommit = args.includes('--commit');
  runBackfill(isCommit).catch((err) => {
    console.error('Erreur lors du backfill :', err);
    process.exit(1);
  });
}
