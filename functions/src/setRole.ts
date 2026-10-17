import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const setRole = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }

  // Vérifier rôle SUPER_ADMIN (custom claim ou Firestore)
  const tokenRole = request.auth.token?.role;
  let isSuper = tokenRole === "SUPER_ADMIN" || tokenRole === "SUPER ADMIN";
  if (!isSuper) {
    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerDoc.data() || {};
    const normalized = String(callerData.role || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
    if (normalized === "SUPERADMIN" || callerData.role === "SUPER_ADMIN") {
      isSuper = true;
    }
  }

  if (!isSuper) {
    throw new HttpsError("permission-denied", "Accès réservé exclusivement au Super Administrateur.");
  }

  const { targetUid, role } = (request.data || {}) as { targetUid?: string; role?: string };
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "Identifiant utilisateur cible manquant.");
  }

  if (role !== "USER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new HttpsError("invalid-argument", "Rôle invalide. Les rôles acceptés sont 'USER', 'ADMIN' ou 'SUPER_ADMIN'.");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(targetUid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "Utilisateur cible introuvable.");
  }

  // 1. Poser le custom claim sur Firebase Auth
  await getAuth().setCustomUserClaims(targetUid, { role });

  // 2. Mettre à jour Firestore et journaliser dans la même transaction
  await db.runTransaction(async (tx) => {
    tx.update(userRef, {
      role,
      updatedAt: new Date().toISOString(),
    });

    const logRef = db.collection("moderation_logs").doc();
    tx.set(logRef, {
      action: "SET_ROLE",
      targetUid,
      role,
      actorUid: request.auth!.uid,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, targetUid, role };
});
