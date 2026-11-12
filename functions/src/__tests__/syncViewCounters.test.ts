import {describe, it, expect, beforeEach} from "vitest";
import {getFirestore} from "firebase-admin/firestore";
import {syncAdViewCounters} from "../index";

describe("F6 : syncAdViewCounters", () => {
  const db = getFirestore();

  beforeEach(async () => {
    const [adsSnap, countersSnap] = await Promise.all([
      db.collection("ads").get(),
      db.collection("ad_counters").get(),
    ]);
    const batch = db.batch();
    adsSnap.docs.forEach((d) => batch.delete(d.ref));
    countersSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

  it("synchronise ad_counters.views vers ads.viewsCount uniquement quand nécessaire", async () => {
    await db.collection("ads").doc("ad_sync_1").set({
      title: "Annonce 1",
      status: "ACTIVE",
      viewsCount: 2,
    });
    await db.collection("ads").doc("ad_sync_2").set({
      title: "Annonce 2",
      status: "ACTIVE",
      viewsCount: 14,
    });
    await db.collection("ads").doc("ad_sync_3").set({
      title: "Annonce 3",
      status: "ACTIVE",
    });

    await db.collection("ad_counters").doc("ad_sync_1").set({views: 23});
    await db.collection("ad_counters").doc("ad_sync_2").set({views: 14});
    await db.collection("ad_counters").doc("ad_sync_3").set({views: 7});
    await db.collection("ad_counters").doc("ad_missing").set({views: 99});

    const result = await syncAdViewCounters(db);
    expect(result.checked).toBe(4);
    expect(result.updated).toBe(2);

    const [ad1, ad2, ad3] = await Promise.all([
      db.collection("ads").doc("ad_sync_1").get(),
      db.collection("ads").doc("ad_sync_2").get(),
      db.collection("ads").doc("ad_sync_3").get(),
    ]);
    expect(ad1.data()?.viewsCount).toBe(23);
    expect(ad2.data()?.viewsCount).toBe(14);
    expect(ad3.data()?.viewsCount).toBe(7);

    const secondPass = await syncAdViewCounters(db);
    expect(secondPass.checked).toBe(4);
    expect(secondPass.updated).toBe(0);
  });
});

