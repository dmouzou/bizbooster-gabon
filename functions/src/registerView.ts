import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "crypto";

/**
 * registerView durci (Annexe C, S-05, C-03, Étape 3.2 & 3.3)
 * - Identité d'affichage indépendante du client (req.auth.uid sinon hash de l'adresse IP)
 * - Dédoublonnage 24h par clé SHA-256 et date du jour
 * - Exclusion stricte des vues du propriétaire de l'annonce
 * - Déplacement de l'incrément vers `ad_counters/{adId}` pour supprimer la diffusion de lecture aux visiteurs du catalogue
 */
export const registerView = onCall(
  {
    region: process.env.FUNCTION_REGION || "us-central1",
    maxInstances: 20,
    memory: "256MiB" as const,
    timeoutSeconds: 15,
    cors: true,
  },
  async (req) => {
    const adId = String(req.data?.adId ?? "");
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(adId)) {
      throw new HttpsError("invalid-argument", "Identifiant d annonce invalide.");
    }

    // Identité que le client ne contrôle pas : uid authentifié sinon adresse IP
    const who = req.auth?.uid ?? req.rawRequest?.ip ?? "unknown";
    const key = createHash("sha256").update(who).digest("hex").slice(0, 24);
    const day = new Date().toISOString().slice(0, 10);

    const db = getFirestore();
    const viewRef = db.doc(`ad_views/${adId}_${key}_${day}`);
    const adRef = db.doc(`ads/${adId}`);
    const counterRef = db.doc(`ad_counters/${adId}`);

    let counted = false;

    await db.runTransaction(async (tx) => {
      const [view, ad] = await Promise.all([tx.get(viewRef), tx.get(adRef)]);

      if (!ad.exists || ad.get("status") !== "ACTIVE") {
        return;
      }

      // Vue déjà comptée pour cet utilisateur aujourd'hui ou consultation par le propriétaire
      if (view.exists || ad.get("userId") === req.auth?.uid) {
        return;
      }

      // Enregistrer la vue et incrémenter le compteur dédié
      tx.set(viewRef, { adId, at: FieldValue.serverTimestamp() });
      tx.set(counterRef, { views: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      counted = true;
    });

    return { success: true, counted };
  }
);
