import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

/**
 * Garde d'authentification et de rôle pour la modération côté serveur (Phase 3 - Étape 3.1)
 */
export async function assertAdmin(auth: any): Promise<{ uid: string; email?: string; isSuperAdmin: boolean }> {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }
  const role = auth.token?.role;
  if (role === "SUPER_ADMIN" || role === "SUPER ADMIN") {
    return { uid: auth.uid, email: auth.token?.email, isSuperAdmin: true };
  }
  if (role === "ADMIN") {
    return { uid: auth.uid, email: auth.token?.email, isSuperAdmin: false };
  }

  // Repli sécurisé sur le document Firestore si le claim n'est pas encore rechargé
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(auth.uid).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    const docRole = String(data.role || "").toUpperCase().replace(/[\s_-]+/g, "");
    if (docRole === "SUPERADMIN") {
      return { uid: auth.uid, email: auth.token?.email || data.email, isSuperAdmin: true };
    }
    if (docRole === "ADMIN") {
      return { uid: auth.uid, email: auth.token?.email || data.email, isSuperAdmin: false };
    }
  }

  throw new HttpsError("permission-denied", "Action réservée aux administrateurs.");
}

export async function assertSuperAdmin(auth: any): Promise<{ uid: string; email?: string }> {
  const admin = await assertAdmin(auth);
  if (!admin.isSuperAdmin) {
    throw new HttpsError("permission-denied", "Action strictement réservée au Super Administrateur.");
  }
  return admin;
}

const CALLABLE_OPTIONS = {
  region: process.env.FUNCTION_REGION || "us-central1",
  maxInstances: 5,
  memory: "256MiB" as const,
  timeoutSeconds: 30,
  cors: true,
};

/**
 * 1. rejectAd : Rejet d'annonce côté serveur en transaction atomique avec journal et notification
 */
export const rejectAd = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { adId, reason } = request.data || {};
  if (!adId || typeof adId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
  }
  const cleanReason = String(reason || "Critères de conformité non respectés.").trim();

  const db = getFirestore();
  const adRef = db.collection("ads").doc(adId);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const adDoc = await tx.get(adRef);
    if (!adDoc.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adDoc.data() || {};

    // Idempotence : si déjà rejetée avec le même motif, rien à réécrire
    if (ad.status === "REJECTED" && ad.moderationReason === cleanReason) {
      return;
    }

    tx.update(adRef, {
      status: "REJECTED",
      moderationReason: cleanReason,
      moderatedAt: nowIso,
      moderatedBy: admin.uid,
      updatedAt: nowIso,
    });

    // Journal d'audit atomique
    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "REJECT_AD",
      targetId: adId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      reason: cleanReason,
      adTitle: ad.title || "Sans titre",
      timestamp: FieldValue.serverTimestamp(),
    });

    // Notification utilisateur dans user_notifications
    if (ad.userId) {
      const notifId = `rej_${adId}_${nowIso}`;
      const notifRef = db.collection("user_notifications").doc(`${ad.userId}_${notifId}`);
      tx.set(notifRef, {
        id: notifId,
        notifId,
        userId: ad.userId,
        type: "AD_REJECTED",
        title: "Annonce non validée par la modération",
        message: `Votre annonce « ${ad.title || ""} » n'a pas été validée. Motif : ${cleanReason}`,
        adId,
        dispatchedAt: nowIso,
        timestamp: Date.now(),
        status: "DISPATCHED",
      });
    }
  });

  return { success: true, adId };
});

/**
 * 1b. rejectExtension (B-11) : Rejet d'une extension payée sans affecter le statut ACTIVE de l'annonce
 */
export const rejectExtension = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { adId, reason } = request.data || {};
  if (!adId || typeof adId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
  }
  const cleanReason = String(reason || "Extension refusée par la modération").trim();

  const db = getFirestore();
  const adRef = db.collection("ads").doc(adId);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const adDoc = await tx.get(adRef);
    if (!adDoc.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adDoc.data() || {};
    if (!ad.pendingExtension) {
      return; // Déjà traitée
    }

    tx.update(adRef, {
      pendingExtension: FieldValue.delete(),
      updatedAt: nowIso,
    });

    // Journal d'audit
    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "REJECT_EXTENSION",
      targetId: adId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      reason: cleanReason,
      adTitle: ad.title || "Sans titre",
      timestamp: FieldValue.serverTimestamp(),
    });

    // Notification utilisateur
    if (ad.userId) {
      const notifId = `ext_rej_${adId}_${nowIso}`;
      const notifRef = db.collection("user_notifications").doc(`${ad.userId}_${notifId}`);
      tx.set(notifRef, {
        id: notifId,
        notifId,
        userId: ad.userId,
        type: "AD_REJECTED",
        title: "Prolongation non accordée",
        message: `Votre demande d'extension pour l'annonce « ${ad.title || ""} » n'a pas été validée. Motif : ${cleanReason}. Votre annonce reste active jusqu'à son échéance initiale.`,
        adId,
        dispatchedAt: nowIso,
        timestamp: Date.now(),
        status: "DISPATCHED",
      });
    }
  });

  return { success: true, adId };
});

/**
 * 2. deleteAd : Suppression d'annonce côté serveur avec résolution des signalements,
 * nettoyage Storage (B22) et audit (B28)
 */
export const deleteAd = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { adId, reason } = request.data || {};
  if (!adId || typeof adId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
  }
  const cleanReason = String(reason || "Suppression administrative").trim();

  const db = getFirestore();
  const adRef = db.collection("ads").doc(adId);

  let deletedAdData: Record<string, unknown> | null = null;

  await db.runTransaction(async (tx) => {
    const adDoc = await tx.get(adRef);
    if (!adDoc.exists) {
      return; // Idempotent
    }
    const ad = adDoc.data() || {};
    deletedAdData = ad;
    tx.delete(adRef);

    // Journal d'audit atomique
    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "DELETE_AD",
      targetId: adId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      reason: cleanReason,
      adTitle: ad.title || "Sans titre",
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  // B28: Résoudre les signalements associés en tâche de fond par lots <= 450 (uniquement PENDING pour ne pas écraser DISMISSED)
  try {
    const reportsSnap = await db
      .collection("reports")
      .where("adId", "==", adId)
      .where("status", "==", "PENDING")
      .get();
    const docs = reportsSnap.docs;
    const CHUNK_SIZE = 450;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach((rep) => {
        batch.update(rep.ref, {
          status: "RESOLVED",
          resolutionNote: "Annonce supprimée par la modération.",
          resolutionNotes: "Annonce supprimée par la modération.",
          resolvedAt: FieldValue.serverTimestamp(),
          resolvedBy: admin.uid,
        });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn("[deleteAd] Résolution des rapports associée:", err);
  }

  // B22: Nettoyage Storage des fichiers associés (photos, vidéo, CV, jobDoc)
  if (deletedAdData) {
    try {
      const bucket = getStorage().bucket();
      const filesToDelete: string[] = [];
      const ad = deletedAdData as Record<string, unknown>;
      if (Array.isArray(ad.images)) {
        for (const imgUrl of ad.images) {
          if (typeof imgUrl === "string") filesToDelete.push(imgUrl);
        }
      }
      if (ad.videoUrl && typeof ad.videoUrl === "string") {
        filesToDelete.push(ad.videoUrl);
      }
      if (ad.cvUrl && typeof ad.cvUrl === "string") {
        filesToDelete.push(ad.cvUrl);
      }
      if (ad.jobDocUrl && typeof ad.jobDocUrl === "string") {
        filesToDelete.push(ad.jobDocUrl);
      }
      const autresEmplois = ad.autresEmploisData as Record<string, unknown> | undefined;
      if (autresEmplois?.cvUrl && typeof autresEmplois.cvUrl === "string") {
        filesToDelete.push(autresEmplois.cvUrl);
      }
      if (autresEmplois?.jobDocUrl && typeof autresEmplois.jobDocUrl === "string") {
        filesToDelete.push(autresEmplois.jobDocUrl);
      }

      for (const fileUrl of filesToDelete) {
        try {
          const decoded = decodeURIComponent(fileUrl);
          const match = decoded.match(/\/o\/([^?]+)/) || decoded.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
          if (match && match[1]) {
            const objectPath = match[1];
            // S9 : Vérifier que le chemin appartient bien aux répertoires applicatifs autorisés
            if (
              objectPath.startsWith("ads/") ||
              objectPath.startsWith("cvs/") ||
              objectPath.startsWith("videos/")
            ) {
              await bucket.file(objectPath).delete({ ignoreNotFound: true });
            }
          }
        } catch (e) {
          console.warn("[deleteAd] Échec suppression fichier storage:", fileUrl, e);
        }
      }
    } catch (storageErr) {
      console.warn("[deleteAd] Erreur nettoyage storage:", storageErr);
    }
  }

  return { success: true, adId };
});

/**
 * 3. approveKyc : Approbation KYC côté serveur avec contrôle d'intégrité de l'image (S-06, B20)
 */
export const approveKyc = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { uid, idDocumentUrl } = request.data || {};
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur requis.");
  }
  // B20: idDocumentUrl obligatoire
  if (!idDocumentUrl || typeof idDocumentUrl !== "string") {
    throw new HttpsError("invalid-argument", "idDocumentUrl est obligatoire pour approuver un KYC.");
  }

  // B20: Valider que le chemin cible kyc/{uid}/
  const expectedPath = `kyc/${uid}/`;
  const encodedExpectedPath = `kyc%2F${uid}%2F`;
  if (!idDocumentUrl.includes(expectedPath) && !idDocumentUrl.includes(encodedExpectedPath)) {
    throw new HttpsError(
      "invalid-argument",
      "L'URL du document KYC doit appartenir au sous-dossier kyc/{uid}/ de l'utilisateur."
    );
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Utilisateur introuvable.");
    }
    const data = userDoc.data() || {};

    // Idempotence : si déjà validé, aucun effet redondant
    if (data.idVerificationStatus === "VERIFIED") {
      return;
    }

    // Vérifier que le statut était PENDING et que idDocumentUrl correspond
    if (data.idVerificationStatus !== "PENDING") {
      throw new HttpsError("failed-precondition", "Le KYC de cet utilisateur n'est pas en attente (PENDING).");
    }
    if (data.idDocumentUrl !== idDocumentUrl) {
      throw new HttpsError("invalid-argument", "Le document affiché ne correspond plus à la soumission en cours.");
    }

    tx.update(userRef, {
      idVerificationStatus: "VERIFIED",
      isKycVerified: true,
      isVerified: true,
      idVerifiedAt: nowIso,
      verifiedName: data.name || data.contactName || null,
      idRejectionReason: FieldValue.delete(),
      updatedAt: nowIso,
    });

    // Journal d'audit
    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "APPROVE_KYC",
      targetId: uid,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    // Notification utilisateur
    const notifId = `kyc_verified_${uid}`;
    const notifRef = db.collection("user_notifications").doc(`${uid}_${notifId}`);
    tx.set(notifRef, {
      id: notifId,
      notifId,
      userId: uid,
      type: "IDENTITY_VERIFIED",
      title: "Identité validée avec succès !",
      message: "Félicitations, votre pièce d'identité a été validée. Le badge de confiance « Annonceur Vérifié » est actif.",
      dispatchedAt: nowIso,
      timestamp: Date.now(),
      status: "DISPATCHED",
    });
  });

  return { success: true, uid };
});

/**
 * 4. rejectKyc : Rejet KYC côté serveur avec motif propre (S-06)
 */
export const rejectKyc = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { uid, reason } = request.data || {};
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur requis.");
  }
  const cleanReason = String(reason || "Document illisible ou non conforme.").trim();

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Utilisateur introuvable.");
    }

    tx.update(userRef, {
      idVerificationStatus: "REJECTED",
      isKycVerified: false,
      isVerified: false,
      idRejectionReason: cleanReason,
      idRejectedAt: nowIso,
      updatedAt: nowIso,
    });

    // Journal d'audit
    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "REJECT_KYC",
      targetId: uid,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      reason: cleanReason,
      timestamp: FieldValue.serverTimestamp(),
    });

    // Notification utilisateur
    const notifId = `kyc_rej_${uid}_${Date.now()}`;
    const notifRef = db.collection("user_notifications").doc(`${uid}_${notifId}`);
    tx.set(notifRef, {
      id: notifId,
      notifId,
      userId: uid,
      type: "AD_REJECTED",
      title: "Vérification d'identité non validée",
      message: `Votre document d'identité n'a pas pu être validé. Motif : ${cleanReason}`,
      dispatchedAt: nowIso,
      timestamp: Date.now(),
      status: "DISPATCHED",
    });
  });

  return { success: true, uid };
});

/**
 * 5. setSubscription : Gestion des abonnements côté serveur en transaction (S-17)
 */
export const setSubscription = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertSuperAdmin(request.auth);
  const { userId, subscriptionTier, durationDays } = request.data || {};
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur requis.");
  }
  const validTiers = ["STANDARD", "PRO", "ELITE", "BUSINESS"];
  if (!validTiers.includes(subscriptionTier)) {
    throw new HttpsError("invalid-argument", "Forfait invalide.");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  const now = Date.now();
  const days = Math.max(1, Math.min(365, Number(durationDays) || 30));
  const newExpiresAt = new Date(now + days * 86400000).toISOString();
  const nowIso = new Date(now).toISOString();

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Utilisateur introuvable.");
    }
    const data = userDoc.data() || {};
    const oldTier = data.subscriptionTier || "STANDARD";

    tx.update(userRef, {
      subscriptionTier,
      subscriptionExpiresAt: subscriptionTier === "STANDARD" ? FieldValue.delete() : newExpiresAt,
      subscriptionStartedAt: FieldValue.serverTimestamp(),
      updatedAt: nowIso,
    });

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "SET_SUBSCRIPTION",
      targetId: userId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      oldTier,
      newTier: subscriptionTier,
      expiresAt: newExpiresAt,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, userId, subscriptionTier };
});

/**
 * 6. adjustBoosters : Ajustement sécurisé des boosters avec plafond (S-17)
 */
export const adjustBoosters = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertSuperAdmin(request.auth);
  const { userId, delta } = request.data || {};
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur requis.");
  }
  const numericDelta = Number(delta);
  if (isNaN(numericDelta) || numericDelta === 0) {
    throw new HttpsError("invalid-argument", "Variation de boosters invalide.");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  let newTotal = 0;

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Utilisateur introuvable.");
    }
    const data = userDoc.data() || {};
    const current = Number(data.freeBoostsRemaining) || 0;
    newTotal = Math.max(0, Math.min(20, current + numericDelta));

    tx.update(userRef, {
      freeBoostsRemaining: newTotal,
      updatedAt: new Date().toISOString(),
    });

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "ADJUST_BOOSTERS",
      targetId: userId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      delta: numericDelta,
      previous: current,
      newTotal,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, userId, freeBoostsRemaining: newTotal };
});

/**
 * 7. resolveReport : Résolution de signalement côté serveur (F4)
 */
export const resolveReport = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { reportId, note } = request.data || {};
  if (!reportId || typeof reportId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant de signalement requis.");
  }

  const cleanNote = String(note || "").trim();
  const db = getFirestore();
  const reportRef = db.collection("reports").doc(reportId);

  await db.runTransaction(async (tx) => {
    const repDoc = await tx.get(reportRef);
    if (!repDoc.exists) {
      throw new HttpsError("not-found", "Signalement introuvable.");
    }
    const reportData = repDoc.data() || {};

    tx.update(reportRef, {
      status: "RESOLVED",
      resolutionNote: cleanNote,
      resolutionNotes: cleanNote,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: admin.uid,
    });

    // F4: Décrémenter le compteur de signalements de l'annonce si le rapport était PENDING
    if (reportData.status === "PENDING" && reportData.adId) {
      const adRef = db.collection("ads").doc(reportData.adId);
      const adDoc = await tx.get(adRef);
      if (adDoc.exists) {
        const currentCount = Number(adDoc.data()?.reportsCount || 0);
        tx.update(adRef, {
          reportsCount: Math.max(0, currentCount - 1),
        });
      }
    }

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "RESOLVE_REPORT",
      targetId: reportId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      note: cleanNote,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, reportId };
});

/**
 * 8. dismissReport : Rejet de signalement infondé côté serveur (F4)
 */
export const dismissReport = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { reportId, note } = request.data || {};
  if (!reportId || typeof reportId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant de signalement requis.");
  }

  const cleanNote = String(note || "").trim();
  const db = getFirestore();
  const reportRef = db.collection("reports").doc(reportId);

  await db.runTransaction(async (tx) => {
    const repDoc = await tx.get(reportRef);
    if (!repDoc.exists) {
      throw new HttpsError("not-found", "Signalement introuvable.");
    }
    const reportData = repDoc.data() || {};

    tx.update(reportRef, {
      status: "DISMISSED",
      dismissalNote: cleanNote,
      dismissedAt: FieldValue.serverTimestamp(),
      dismissedBy: admin.uid,
    });

    // F4: Décrémenter le compteur de signalements de l'annonce si le rapport était PENDING
    if (reportData.status === "PENDING" && reportData.adId) {
      const adRef = db.collection("ads").doc(reportData.adId);
      const adDoc = await tx.get(adRef);
      if (adDoc.exists) {
        const currentCount = Number(adDoc.data()?.reportsCount || 0);
        tx.update(adRef, {
          reportsCount: Math.max(0, currentCount - 1),
        });
      }
    }

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "DISMISS_REPORT",
      targetId: reportId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      note: cleanNote,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, reportId };
});

/**
 * 9. setExemption : Exonération VIP / paiement côté serveur (Super Admin only)
 */
export const setExemption = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertSuperAdmin(request.auth);
  const { userId, isExempt } = request.data || {};
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur requis.");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  const boolExempt = Boolean(isExempt);

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Utilisateur introuvable.");
    }

    tx.update(userRef, {
      exemptFromPaymentAndKyc: boolExempt,
      isExempt: boolExempt,
      updatedAt: new Date().toISOString(),
    });

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: boolExempt ? "EXEMPTION_GRANTED" : "EXEMPTION_REVOKED",
      targetId: userId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, userId, isExempt: boolExempt };
});

/**
 * 10. logKycView (S-14) : Journalise la consultation d'un document KYC par un administrateur
 */
export const logKycView = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { targetUserId } = request.data || {};
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur requis.");
  }

  const db = getFirestore();

  // R2: Déduplication côté serveur (ignorer si déjà consulté par le même admin il y a moins de 15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  try {
    const recentSnap = await db
      .collection("moderation_logs")
      .where("action", "==", "KYC_VIEWED")
      .where("targetId", "==", targetUserId)
      .where("adminId", "==", admin.uid)
      .where("timestamp", ">=", fifteenMinutesAgo)
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      return { success: true, deduplicated: true };
    }
  } catch (dedupErr) {
    // Si l'index composite manque pour la requête de dédup, continuer sans bloquer
    console.warn("[logKycView] Déduplication ignorée:", dedupErr);
  }

  const logRef = db.collection("moderation_logs").doc();
  await logRef.set({
    action: "KYC_VIEWED",
    targetId: targetUserId,
    adminId: admin.uid,
    adminEmail: admin.email || null,
    timestamp: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * 11. banUser (F9) : Fonction de blocage permanent d'un utilisateur par un administrateur.
 * - Désactive le compte Firebase Auth et révoque ses jetons.
 * - Marque le document utilisateur comme isBanned: true.
 * - Suspend immédiatement toutes ses annonces (ACTIVE / PENDING_REVIEW -> SUSPENDED).
 * - Enregistre ses numéros et email dans la collection 'blocklist'.
 * - Journalise l'action dans 'moderation_logs'.
 */
export const banUser = onCall(CALLABLE_OPTIONS, async (request) => {
  const admin = await assertAdmin(request.auth);
  const { targetUserId, reason } = request.data || {};
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur cible requis.");
  }

  if (targetUserId === admin.uid) {
    throw new HttpsError("failed-precondition", "Impossible de vous bannir vous-même.");
  }

  const cleanReason = String(reason || "Non-respect grave des conditions d'utilisation").trim();
  const db = getFirestore();
  const authAdmin = getAuth();
  const userRef = db.collection("users").doc(targetUserId);

  // 1. Interdire le ban d'un administrateur
  const targetDoc = await userRef.get();
  if (targetDoc.exists) {
    const targetData = targetDoc.data() || {};
    const targetRole = String(targetData.role || "").toUpperCase().replace(/[\s_-]+/g, "");
    if (targetRole === "ADMIN" || targetRole === "SUPERADMIN" || targetData.isSuperAdmin) {
      throw new HttpsError("permission-denied", "Impossible de bannir un compte administrateur.");
    }
  }

  // 2. Désactiver le compte Auth et révoquer les tokens
  try {
    await authAdmin.updateUser(targetUserId, { disabled: true });
    await authAdmin.revokeRefreshTokens(targetUserId);
  } catch (err: any) {
    console.warn(`[banUser] Avertissement désactivation Auth (${targetUserId}):`, err?.message);
  }

  const nowIso = new Date().toISOString();
  const userData = targetDoc.exists ? targetDoc.data() || {} : {};
  const phoneNumbersToBlock: string[] = [];
  if (userData.phoneNumber) phoneNumbersToBlock.push(String(userData.phoneNumber).trim());
  if (userData.contactPhone) phoneNumbersToBlock.push(String(userData.contactPhone).trim());
  const emailToBlock = userData.email ? String(userData.email).trim().toLowerCase() : null;

  await db.runTransaction(async (tx) => {
    tx.set(
      userRef,
      {
        isBanned: true,
        bannedAt: nowIso,
        banReason: cleanReason,
        bannedBy: admin.uid,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    for (const phone of phoneNumbersToBlock) {
      const cleanDigits = phone.replace(/\D/g, "");
      if (cleanDigits) {
        const blockRef = db.collection("blocklist").doc(`phone_${cleanDigits}`);
        tx.set(blockRef, {
          type: "PHONE",
          value: phone,
          userId: targetUserId,
          reason: cleanReason,
          bannedBy: admin.uid,
          createdAt: nowIso,
        });
      }
    }
    if (emailToBlock) {
      const blockRef = db.collection("blocklist").doc(`email_${emailToBlock.replace(/[^a-z0-9]/g, "_")}`);
      tx.set(blockRef, {
        type: "EMAIL",
        value: emailToBlock,
        userId: targetUserId,
        reason: cleanReason,
        bannedBy: admin.uid,
        createdAt: nowIso,
      });
    }

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "BAN_USER",
      targetId: targetUserId,
      adminId: admin.uid,
      adminEmail: admin.email || null,
      reason: cleanReason,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  try {
    const userAdsSnap = await db.collection("ads").where("userId", "==", targetUserId).get();
    const batch = db.batch();
    userAdsSnap.docs.forEach((adDocSnap) => {
      const ad = adDocSnap.data();
      if (ad.status === "ACTIVE" || ad.status === "PENDING_REVIEW") {
        batch.update(adDocSnap.ref, {
          status: "SUSPENDED",
          suspensionReason: "COMPTE_BLOQUE",
          suspendedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    });
    await batch.commit();
  } catch (err) {
    console.warn(`[banUser] Erreur lors de la suspension des annonces de ${targetUserId}:`, err);
  }

  return { success: true, targetUserId };
});

