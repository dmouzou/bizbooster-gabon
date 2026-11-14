import {HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

export const MOOV_PREFIXES = ["60", "62", "65", "66"];
export const AIRTEL_PREFIXES = ["74", "76", "77"];

/**
 * Vérifie les privilèges Super Admin.
 * Exige request.auth, puis vérifie le rôle SUPER_ADMIN ou SUPER ADMIN
 * dans le jeton ou dans users/{uid}.role (ou users/{uid}.isSuperAdmin === true).
 */
export async function assertSuperAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}): Promise<string> {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Authentification requise pour cette opération."
    );
  }

  const tokenRole = request.auth.token.role;
  const isTokenSuperAdmin =
    tokenRole === "SUPER_ADMIN" ||
    tokenRole === "SUPER ADMIN" ||
    request.auth.token.isSuperAdmin === true;

  if (isTokenSuperAdmin) {
    return request.auth.uid;
  }

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data() || {};
    const dbRole = userData.role;
    if (
      dbRole === "SUPER_ADMIN" ||
      dbRole === "SUPER ADMIN" ||
      userData.isSuperAdmin === true
    ) {
      return request.auth.uid;
    }
  }

  throw new HttpsError(
    "permission-denied",
    "Accès réservé exclusivement au Super Administrateur."
  );
}

