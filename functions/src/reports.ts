import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const CALLABLE_OPTIONS = {
  region: process.env.FUNCTION_REGION || "us-central1",
  maxInstances: 10,
  memory: "256MiB" as const,
  timeoutSeconds: 15,
  cors: true,
};

/**
 * reportAd : Signalement d'annonce sécurisé côté serveur (S-04, Étape 3.2).
 * - Authentification obligatoire
 * - Dédoublonnage strict par adId_uid
 * - Validation des longueurs
 * - Incrémentation atomique du compteur de signalements PENDING
 */
export const reportAd = onCall(CALLABLE_OPTIONS, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vous devez être connecté pour signaler une annonce.");
  }

  const { adId, reason, details, reporterPhone } = request.data || {};
  if (!adId || typeof adId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant d'annonce manquant ou invalide.");
  }

  const cleanReason = String(reason || "").trim();
  if (!cleanReason || cleanReason.length > 200) {
    throw new HttpsError("invalid-argument", "Motif de signalement invalide (max 200 caractères).");
  }

  const cleanDetails = String(details || "").trim();
  if (cleanDetails.length > 2000) {
    throw new HttpsError("invalid-argument", "Détails du signalement trop longs (max 2000 caractères).");
  }

  const reporterUid = request.auth.uid;
  const reportDocId = `${adId}_${reporterUid}`;
  const db = getFirestore();

  const reportRef = db.collection("reports").doc(reportDocId);
  const adRef = db.collection("ads").doc(adId);

  await db.runTransaction(async (tx) => {
    const [adDoc, reportDoc] = await Promise.all([tx.get(adRef), tx.get(reportRef)]);

    if (!adDoc.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }

    if (reportDoc.exists) {
      throw new HttpsError("already-exists", "Vous avez déjà signalé cette annonce.");
    }

    const now = FieldValue.serverTimestamp();

    // 1. Création du rapport PENDING
    tx.set(reportRef, {
      adId,
      reporterId: reporterUid,
      reporterPhone: String(reporterPhone || "").trim(),
      reason: cleanReason,
      details: cleanDetails,
      status: "PENDING",
      createdAt: now,
    });

    // 2. Incrémentation sécurisée côté serveur du nombre de signalements sur l'annonce
    tx.update(adRef, {
      reportsCount: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });
  });

  return { success: true, reportId: reportDocId };
});
