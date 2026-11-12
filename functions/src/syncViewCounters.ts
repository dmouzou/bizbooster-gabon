import {Firestore} from "firebase-admin/firestore";

const GET_ALL_CHUNK_SIZE = 100;
const BATCH_WRITE_LIMIT = 500;

/**
 * Synchronizes incremented view counters from `ad_counters/{adId}` into
 * `ads/{adId}.viewsCount` without updating `ads` on every single view.
 */
export async function syncAdViewCounters(
  db: Firestore
): Promise<{checked: number; updated: number}> {
  const countersSnap = await db.collection("ad_counters").get();
  if (countersSnap.empty) {
    return {checked: 0, updated: 0};
  }

  const counterEntries: Array<{adId: string; views: number}> = [];
  for (const counterDoc of countersSnap.docs) {
    const rawViews = counterDoc.data()?.views;
    if (typeof rawViews === "number" && Number.isFinite(rawViews) && rawViews >= 0) {
      counterEntries.push({adId: counterDoc.id, views: rawViews});
    }
  }

  if (counterEntries.length === 0) {
    return {checked: 0, updated: 0};
  }

  const pendingUpdates: Array<{ref: FirebaseFirestore.DocumentReference; views: number}> = [];

  for (let i = 0; i < counterEntries.length; i += GET_ALL_CHUNK_SIZE) {
    const chunk = counterEntries.slice(i, i + GET_ALL_CHUNK_SIZE);
    const refs = chunk.map((entry) => db.collection("ads").doc(entry.adId));
    const adSnaps = await db.getAll(...refs);

    for (let j = 0; j < adSnaps.length; j++) {
      const adSnap = adSnaps[j];
      if (!adSnap.exists) continue;
      const counterViews = chunk[j].views;
      const existingViews = adSnap.data()?.viewsCount;
      const currentViews = typeof existingViews === "number" ? existingViews : 0;

      if (counterViews > currentViews) {
        pendingUpdates.push({ref: adSnap.ref, views: counterViews});
      }
    }
  }

  for (let i = 0; i < pendingUpdates.length; i += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    const slice = pendingUpdates.slice(i, i + BATCH_WRITE_LIMIT);
    for (const item of slice) {
      batch.update(item.ref, {viewsCount: item.views});
    }
    await batch.commit();
  }

  return {
    checked: counterEntries.length,
    updated: pendingUpdates.length,
  };
}

