import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const CALLABLE_OPTIONS = {
  region: process.env.FUNCTION_REGION || "us-central1",
  maxInstances: 10,
  memory: "256MiB" as const,
  timeoutSeconds: 20,
  cors: true,
};

// Liste blanche stricte des champs modifiables par l'annonceur lors d'une correction / réémission
const ALLOWED_RESUBMIT_FIELDS = [
  "title",
  "description",
  "price",
  "priceUnit",
  "location",
  "contactName",
  "contactPhone",
  "images",
  "mainCategory",
  "propertyType",
  "bedrooms",
  "vehicleMake",
  "vehicleModel",
  "vehicleYear",
  "mileage",
  "condition",
  "jobTitle",
  "salary",
  "experience",
  "availability",
  "company",
  "subCategory",
  "tutoringSubjects",
  "tutoringLevels",
];

/**
 * resubmitAd : Réémission / correction d'une annonce par son propriétaire (B-02, Étape 3.4).
 * Permet la transition ACTIVE | REJECTED -> PENDING_REVIEW sans faille de privilèges.
 */
export const resubmitAd = onCall(CALLABLE_OPTIONS, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentification requise pour modifier une annonce.");
  }

  const { adId, updates } = request.data || {};
  if (!adId || typeof adId !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant d'annonce requis.");
  }

  if (!updates || typeof updates !== "object") {
    throw new HttpsError("invalid-argument", "Champs de mise à jour requis.");
  }

  // Filtrage strict par liste blanche
  const filteredUpdates: Record<string, any> = {};
  for (const field of ALLOWED_RESUBMIT_FIELDS) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  }

  const db = getFirestore();
  const adRef = db.collection("ads").doc(adId);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const adDoc = await tx.get(adRef);
    if (!adDoc.exists) {
      throw new HttpsError("not-found", "Annonce introuvable.");
    }
    const ad = adDoc.data() || {};

    // Contrôle d'appartenance : seul le propriétaire authentifié peut réémettre son annonce
    if (ad.userId && ad.userId !== request.auth!.uid) {
      throw new HttpsError("permission-denied", "Vous n êtes pas le propriétaire de cette annonce.");
    }

    const currentStatus = ad.status;
    if (currentStatus !== "ACTIVE" && currentStatus !== "REJECTED" && currentStatus !== "PENDING_REVIEW") {
      throw new HttpsError("failed-precondition", `Une annonce au statut ${currentStatus} ne peut pas être réémise.`);
    }

    const nextPayload: Record<string, any> = {
      ...filteredUpdates,
      status: "PENDING_REVIEW",
      moderatedAt: FieldValue.delete(),
      moderationReason: FieldValue.delete(),
      updatedAt: nowIso,
      resubmittedAt: FieldValue.serverTimestamp(),
    };

    // Si l'annonce était active avec un boost en cours, geler le boost pendant la modération
    if (currentStatus === "ACTIVE" && ad.isFeatured && ad.featuredUntil) {
      const featUntilMs = new Date(ad.featuredUntil).getTime();
      if (featUntilMs > Date.now()) {
        nextPayload.featuredPausedAt = nowIso;
        nextPayload.isFeatured = false;
      }
    }

    tx.update(adRef, nextPayload);
  });

  return { success: true, adId };
});
