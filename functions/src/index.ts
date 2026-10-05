import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {initializeApp} from "firebase-admin/app";

initializeApp();

/**
 * Normalise un numéro de téléphone gabonais (+241).
 *
 * @param {string} input - Le numéro de téléphone saisi.
 * @return {{e164: string, rawDigits: string}} Format E.164 et chiffres bruts.
 */
function normalizeGabonPhone(input: string): {
  e164: string;
  rawDigits: string;
} {
  const digits = (input || "").replace(/\D/g, "");
  let clean = digits;
  if (clean.startsWith("241")) {
    clean = clean.slice(3);
  }
  if (clean.startsWith("0")) {
    clean = clean.slice(1);
  }
  return {
    e164: `+241${clean}`,
    rawDigits: clean,
  };
}

/**
 * 1. Authentification sécurisée par Téléphone + Mot de passe
 * Permet aux utilisateurs existants et nouveaux de se connecter directement
 * sans avoir à demander un SMS OTP à chaque fois.
 */
export const loginWithPhonePassword = onCall(
  {cors: true},
  async (request) => {
    const {phoneNumber, password} = request.data || {};

    if (!phoneNumber || !password) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro de téléphone et mot de passe requis."
      );
    }

    const {e164, rawDigits} = normalizeGabonPhone(String(phoneNumber));
    if (rawDigits.length < 8) {
      throw new HttpsError(
        "invalid-argument",
        "Numéro gabonais invalide (8 chiffres requis après +241)."
      );
    }

    const db = getFirestore();
    const authAdmin = getAuth();

    // Recherche dans la collection users de Firestore
    let snap = await db
      .collection("users")
      .where("contactPhone", "==", e164)
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("phoneNumber", "==", e164)
        .limit(1)
        .get();
    }

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("contactPhone", "==", rawDigits)
        .limit(1)
        .get();
    }

    if (!snap.empty) {
      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      const expectedPassword = userData.password || "users-with-no-password";

      if (String(password).trim() !== String(expectedPassword).trim()) {
        throw new HttpsError(
          "unauthenticated",
          "Numéro ou mot de passe incorrect."
        );
      }

      const syntheticEmail = `${rawDigits}@bizbooster.ga`;

      // 1. Sync email/password into Firebase Auth for client auth
      try {
        await authAdmin.updateUser(userDoc.id, {
          email: syntheticEmail,
          password: expectedPassword,
        });
      } catch (updateErr: unknown) {
        const errCode = (updateErr as { code?: string })?.code;
        if (errCode === "auth/user-not-found") {
          try {
            await authAdmin.createUser({
              uid: userDoc.id,
              phoneNumber: e164,
              email: syntheticEmail,
              password: expectedPassword,
            });
          } catch {
            // ignore
          }
        }
      }

      // 2. Try custom token if IAM allows, otherwise client signs in directly
      let customToken: string | null = null;
      try {
        customToken = await authAdmin.createCustomToken(userDoc.id);
      } catch (tokenErr) {
        console.warn("createCustomToken skipped (no signBlob IAM):", tokenErr);
      }

      return {
        success: true,
        customToken,
        syntheticEmail,
        user: {
          id: userDoc.id,
          ...userData,
          password: expectedPassword,
        },
      };
    }

    // Si non trouvé dans Firestore, vérifier si le compte existe dans Auth
    try {
      const fbUser = await authAdmin.getUserByPhoneNumber(e164);
      if (fbUser) {
        // Pour un utilisateur existant sans profil Firestore explicite
        if (String(password).trim() === "users-with-no-password") {
          const syntheticEmail = `${rawDigits}@bizbooster.ga`;
          try {
            await authAdmin.updateUser(fbUser.uid, {
              email: syntheticEmail,
              password: "users-with-no-password",
            });
          } catch {
            // ignore
          }
          let customToken: string | null = null;
          try {
            customToken = await authAdmin.createCustomToken(fbUser.uid);
          } catch {
            // ignore
          }
          const initialUser = {
            id: fbUser.uid,
            contactPhone: e164,
            phoneNumber: e164,
            name: "Annonceur BizBooster",
            role: "USER",
            password: "users-with-no-password",
            createdAt: new Date().toISOString(),
            termsAccepted: true,
            isVerified: true,
          };
          await db
            .collection("users")
            .doc(fbUser.uid)
            .set(initialUser, {merge: true});

          return {
            success: true,
            customToken,
            syntheticEmail,
            user: initialUser,
          };
        }
      }
    } catch {
      // ignore
    }

    throw new HttpsError(
      "not-found",
      "Aucun compte associé à ce numéro de téléphone. " +
        "Veuillez vous inscrire ou vérifier via code SMS OTP."
    );
  }
);

/**
 * Vérifie l'éligibilité au renouvellement de mot de passe (règle des 24 heures).
 * Empêche le spam de SMS OTP si le mot de passe a été modifié récemment.
 */
export const checkPasswordResetEligibility = onCall(
  {cors: true},
  async (request) => {
    const {phoneNumber} = request.data || {};
    if (!phoneNumber) {
      throw new HttpsError("invalid-argument", "Numéro de téléphone requis.");
    }

    const {e164, rawDigits} = normalizeGabonPhone(String(phoneNumber));
    const db = getFirestore();

    let snap = await db
      .collection("users")
      .where("contactPhone", "==", e164)
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("phoneNumber", "==", e164)
        .limit(1)
        .get();
    }

    if (snap.empty) {
      snap = await db
        .collection("users")
        .where("contactPhone", "==", rawDigits)
        .limit(1)
        .get();
    }

    if (!snap.empty) {
      const userData = snap.docs[0].data();
      const lastChange = userData.lastPasswordChangeDate;
      if (lastChange) {
        const lastTime = new Date(lastChange).getTime();
        const now = Date.now();
        const diffHours = (now - lastTime) / (1000 * 60 * 60);
        if (diffHours < 24) {
          const remainingHours = Math.ceil(24 - diffHours);
          return {
            allowed: false,
            remainingHours,
            lastPasswordChangeDate: lastChange,
          };
        }
      }
    }

    return {
      allowed: true,
      remainingHours: 0,
    };
  }
);

/**
 * 2. Expiration automatique des annonces et gestion des dépassements de quota :
 * - Expire les annonces actives dont la date de validité est passée.
 * - Rétrograde les abonnements expirés (PRO/ELITE/BUSINESS vers STANDARD).
 * - Suspend automatiquement les annonces excédentaires (les plus récentes)
 *   au-delà du quota de 3 annonces du forfait Standard.
 */
export const expireAds = onSchedule("every 60 minutes", async () => {
  const db = getFirestore();
  const now = new Date().toISOString();

  // A. Expirer les annonces dont expiresAt <= now
  const expiredAdsSnap = await db
    .collection("ads")
    .where("status", "==", "ACTIVE")
    .where("expiresAt", "<=", now)
    .get();

  const batch = db.batch();
  expiredAdsSnap.forEach((doc) => batch.update(doc.ref, {status: "EXPIRED"}));
  await batch.commit();

  // B. Détecter les utilisateurs dont l'abonnement mensuel a expiré
  const expiredUsersSnap = await db
    .collection("users")
    .where("subscriptionTier", "in", ["PRO", "ELITE", "BUSINESS"])
    .where("subscriptionExpiresAt", "<=", now)
    .get();

  for (const userDoc of expiredUsersSnap.docs) {
    const userId = userDoc.id;

    // Rétrograde en STANDARD
    await userDoc.ref.update({
      subscriptionTier: "STANDARD",
      subscriptionExpiredAt: now,
    });

    // Quota Standard = 3 annonces actives max
    const activeAdsSnap = await db
      .collection("ads")
      .where("userId", "==", userId)
      .where("status", "==", "ACTIVE")
      .get();

    if (activeAdsSnap.size > 3) {
      // Trier par date croissante (les plus anciennes restent actives)
      const sortedDocs = [...activeAdsSnap.docs].sort((a, b) => {
        const tA = new Date(
          a.data().createdAt || a.data().publishedAt || 0
        ).getTime();
        const tB = new Date(
          b.data().createdAt || b.data().publishedAt || 0
        ).getTime();
        return tA - tB;
      });

      // Les 3 premières restent actives, les excédentaires sont suspendues
      const excessDocs = sortedDocs.slice(3);
      const quotaBatch = db.batch();
      excessDocs.forEach((doc) => {
        quotaBatch.update(doc.ref, {
          status: "SUSPENDED",
          suspensionReason: "FORFAIT_EXPIRE_QUOTA",
          suspendedAt: now,
        });
      });
      await quotaBatch.commit();
    }
  }
});

/**
 * 3. Mise à jour des compteurs de l'Observatoire (system_counters)
 * à chaque écriture sur la collection ads.
 */
export const updateCounters = onDocumentWritten("ads/{adId}", async () => {
  const db = getFirestore();
  const activeSnap = await db
    .collection("ads")
    .where("status", "==", "ACTIVE")
    .get();

  const totalValue = activeSnap.docs.reduce(
    (sum, d) => sum + (d.data().price || 0),
    0
  );

  await db.doc("system_counters/global").set(
    {
      totalActiveAds: activeSnap.size,
      totalCatalogValueFCFA: totalValue,
      updatedAt: new Date().toISOString(),
    },
    {merge: true}
  );
});
