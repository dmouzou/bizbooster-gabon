import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {initializeApp} from "firebase-admin/app";

initializeApp();

/**
 * A. Expiration automatique des annonces :
 * À la fin du temps imparti, l'annonce passe automatiquement en EXPIRED.
 */
export const expireAds = onSchedule("every 60 minutes", async () => {
  const db = getFirestore();
  const now = new Date().toISOString();
  const snap = await db
    .collection("ads")
    .where("status", "==", "ACTIVE")
    .where("expiresAt", "<=", now)
    .get();

  const batch = db.batch();
  snap.forEach((doc) => batch.update(doc.ref, {status: "EXPIRED"}));
  await batch.commit();
});

/**
 * B. Mise à jour des compteurs de l'Observatoire (system_counters)
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
