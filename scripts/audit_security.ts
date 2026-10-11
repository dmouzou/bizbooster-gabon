/**
 * Script d'audit de sécurité BizBooster Gabon (Section 0.7)
 * Vérifie si les failles de sécurité ont déjà été exploitées :
 * - Users avec isAdmin à true, rôle inattendu, exemptions non autorisées, tier sans paiement
 * - Auth users sans profil Firestore correspondant
 * - Documents suspects dans phone_verifications
 * - Paiements au statut SUCCESS sans singpayTransactionId ou payloads anormaux
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon',
  });
}

const db = getFirestore();
const auth = getAuth();

async function runSecurityAudit() {
  console.log('====================================================');
  console.log('🔍 RAPPORT D AUDIT DE SECURITE BIZBOOSTER GABON');
  console.log('====================================================\n');

  let anomaliesCount = 0;

  // 1. Audit Firestore users
  console.log('1. Audit de la collection users...');
  const usersSnap = await db.collection('users').get();
  console.log(`   Nombre total de documents utilisateurs: ${usersSnap.size}`);

  const suspiciousUsers: Array<Record<string, unknown>> = [];
  const validPaymentRefs = new Set<string>();

  // Pré-charger les références de paiements validés
  const paymentsSnap = await db.collection('payments').where('status', '==', 'SUCCESS').get();
  paymentsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.userId) validPaymentRefs.add(data.userId);
  });

  usersSnap.forEach((doc) => {
    const data = doc.data();
    const docId = doc.id;
    const issues: string[] = [];

    if (data.isAdmin === true) {
      issues.push("Champ 'isAdmin: true' détecté (faille auto-promotion)");
    }
    if (data.isSuperAdmin === true) {
      issues.push("Champ 'isSuperAdmin: true' détecté");
    }
    if (data.role && !['USER', 'ADMIN', 'SUPER_ADMIN', 'SUPER ADMIN'].includes(data.role)) {
      issues.push(`Rôle inattendu: ${data.role}`);
    }
    if (data.isExempt === true || data.exemptFromPaymentAndKyc === true) {
      issues.push('Exemption VIP/KYC activée (vérifier légitimité manuelle)');
    }
    if (
      data.subscriptionTier &&
      data.subscriptionTier !== 'STANDARD' &&
      !validPaymentRefs.has(docId) &&
      !data.exemptFromPaymentAndKyc &&
      !data.isExempt
    ) {
      issues.push(`Abonnement ${data.subscriptionTier} sans trace de paiement validé`);
    }

    if (issues.length > 0) {
      anomaliesCount++;
      suspiciousUsers.push({
        id: docId,
        phone: data.phoneNumber || data.contactPhone,
        name: data.name,
        role: data.role,
        issues,
      });
    }
  });

  if (suspiciousUsers.length === 0) {
    console.log('   ✅ Aucun utilisateur Firestore avec escalade de privilèges ou anomalie détectée.');
  } else {
    console.log(`   ⚠️ ${suspiciousUsers.length} document(s) utilisateur(s) avec signalement(s) :`);
    console.dir(suspiciousUsers, { depth: null });
  }

  // 2. Audit phone_verifications
  console.log('\n2. Audit de la collection phone_verifications...');
  const phoneVerifSnap = await db.collection('phone_verifications').get();
  if (phoneVerifSnap.empty) {
    console.log('   ✅ Aucun document dans phone_verifications.');
  } else {
    console.log(`   ⚠️ ${phoneVerifSnap.size} document(s) trouvé(s) dans phone_verifications.`);
    console.log('      (À purger en Phase 4 car cette collection présentait une faille béante)');
    anomaliesCount += phoneVerifSnap.size;
  }

  // 3. Audit payments
  console.log('\n3. Audit des paiements SingPay (collection payments)...');
  const allPaymentsSnap = await db.collection('payments').get();
  console.log(`   Nombre total de paiements: ${allPaymentsSnap.size}`);

  const suspiciousPayments: Array<Record<string, unknown>> = [];
  allPaymentsSnap.forEach((doc) => {
    const data = doc.data();
    const issues: string[] = [];

    if (data.status === 'SUCCESS' && !data.singpayTransactionId) {
      issues.push('Statut SUCCESS sans singpayTransactionId officiel');
    }
    if (data.rawWebhookPayload && typeof data.rawWebhookPayload === 'object') {
      const payload = data.rawWebhookPayload as Record<string, unknown>;
      if (!payload.transaction && !payload.reference) {
        issues.push("Payload webhook d'origine inhabituelle");
      }
    }

    if (issues.length > 0) {
      anomaliesCount++;
      suspiciousPayments.push({
        id: doc.id,
        reference: data.reference,
        amount: data.amount,
        status: data.status,
        issues,
      });
    }
  });

  if (suspiciousPayments.length === 0) {
    console.log('   ✅ Aucun paiement suspect détecté.');
  } else {
    console.log(`   ⚠️ ${suspiciousPayments.length} paiement(s) suspect(s) :`);
    console.dir(suspiciousPayments, { depth: null });
  }

  // 4. Audit Firebase Auth
  console.log('\n4. Audit Firebase Auth...');
  try {
    const listUsersResult = await auth.listUsers(1000);
    console.log(`   Nombre total de comptes Auth: ${listUsersResult.users.length}`);

    const orphanAuthUsers: string[] = [];
    const unknownAdminClaims: string[] = [];

    for (const u of listUsersResult.users) {
      const userDoc = await db.collection('users').doc(u.uid).get();
      if (!userDoc.exists) {
        orphanAuthUsers.push(
          `Uid: ${u.uid} | Tel: ${u.phoneNumber || 'aucun'} | Email: ${u.email || 'aucun'}`
        );
      }
      if (u.customClaims?.role && !['ADMIN', 'SUPER_ADMIN'].includes(u.customClaims.role as string)) {
        unknownAdminClaims.push(`Uid: ${u.uid} | Role Claim: ${u.customClaims.role}`);
      }
    }

    if (orphanAuthUsers.length === 0) {
      console.log('   ✅ Aucun compte Auth orphelin sans profil Firestore.');
    } else {
      console.log(`   ℹ️ ${orphanAuthUsers.length} compte(s) Auth sans document Firestore (à migrer Phase 2) :`);
      orphanAuthUsers.slice(0, 10).forEach((msg) => console.log(`      - ${msg}`));
      if (orphanAuthUsers.length > 10) console.log(`      ... et ${orphanAuthUsers.length - 10} autres.`);
    }

    if (unknownAdminClaims.length === 0) {
      console.log('   ✅ Aucune claim admin inconnue détectée.');
    } else {
      console.log(`   ⚠️ Claims inattendues :`, unknownAdminClaims);
      anomaliesCount++;
    }
  } catch (authErr: unknown) {
    console.log(`   ℹ️ Lecture Auth ignorée ou non connectée (émulateur ou clés cloud requises): ${(authErr as Error).message}`);
  }

  console.log('\n====================================================');
  console.log(`🏁 FIN DU RAPPORT. Total anomalies prioritaires: ${anomaliesCount}`);
  console.log('====================================================\n');
}

runSecurityAudit().catch((err) => {
  console.error("Erreur d'exécution de l'audit:", err);
});
