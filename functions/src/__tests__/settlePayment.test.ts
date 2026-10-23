import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { settlePayment } from "../index";

describe("Attribution transactionnelle (Phase 4)", () => {
  const db = getFirestore();
  const testUid = "user_test_settle_1";

  beforeEach(async () => {
    // Réinitialisation de l'utilisateur de test
    await db.collection("users").doc(testUid).set({
      subscriptionTier: "STANDARD",
      freeBoostsRemaining: 2,
      freeBoosts: 2,
      consumedFreeAdsCount: 1,
      updatedAt: new Date().toISOString(),
    });
  });

  it("4.1 applique la machine d'états et refuse les retours en arrière", async () => {
    const payRef = "PAY_TEST_STATE_MACHINE";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "SUB_PRO",
      amount: 29000,
      status: "INITIATING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    // INITIATING -> PENDING
    const r1 = await settlePayment(payRef, { status: "PENDING" });
    expect(r1.status).toBe("PENDING");

    // PENDING ne peut pas rétrograder vers INITIATING
    const r2 = await settlePayment(payRef, { status: "INITIATING" as any });
    expect(r2.status).toBe("PENDING");

    // PENDING -> SUCCESS
    const r3 = await settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 });
    expect(r3.status).toBe("SUCCESS");
    expect(r3.attributed).toBe(true);

    // Une fois SUCCESS, ne peut pas rétrograder vers PENDING ou FAILED
    const r4 = await settlePayment(payRef, { status: "FAILED" });
    expect(r4.status).toBe("SUCCESS");
  });

  it("4.1 autorise la transition EXPIRED -> SUCCESS (paiement mobile différé)", async () => {
    const payRef = "PAY_TEST_EXPIRED_TO_SUCCESS";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "SUB_PRO",
      amount: 29000,
      status: "EXPIRED",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    const res = await settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 });
    expect(res.status).toBe("SUCCESS");
    expect(res.attributed).toBe(true);

    const updatedUser = (await db.collection("users").doc(testUid).get()).data();
    expect(updatedUser?.subscriptionTier).toBe("PRO");
  });

  it("4.1 garantit une attribution unique lors de 5 appels simultanés (Promise.all)", async () => {
    const payRef = "PAY_TEST_CONCURRENT_SETTLE";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "SUB_PRO",
      amount: 29000,
      status: "PENDING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    // 5 appels simultanés
    const results = await Promise.all([
      settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 }),
      settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 }),
      settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 }),
      settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 }),
      settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 }),
    ]);

    expect(results.every((r) => r.status === "SUCCESS")).toBe(true);

    // Vérifier les compteurs utilisateur : boosters +1 (2 + 1 = 3), pas 2 + 5 !
    const userDoc = (await db.collection("users").doc(testUid).get()).data();
    expect(userDoc?.freeBoostsRemaining).toBe(3);
    expect(userDoc?.consumedFreeAdsCount).toBe(0);
  });

  it("4.2 attribue correctement un abonnement SUB_PRO (+1 boost, quota remis à 0)", async () => {
    const payRef = "PAY_TEST_SUB_PRO";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "SUB_PRO",
      amount: 29000,
      status: "PENDING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    await settlePayment(payRef, { status: "SUCCESS", amountReceived: 29000 });

    const userDoc = (await db.collection("users").doc(testUid).get()).data();
    expect(userDoc?.subscriptionTier).toBe("PRO");
    expect(userDoc?.consumedFreeAdsCount).toBe(0);
    expect(userDoc?.freeBoostsRemaining).toBe(3); // 2 + 1
  });

  it("4.2 prolonge une annonce avec AD_EXTEND selon les métadonnées assainies", async () => {
    const adId = "ad_test_extend_1";
    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString();
    await db.collection("ads").doc(adId).set({
      id: adId,
      userId: testUid,
      status: "ACTIVE",
      expiresAt: futureDate,
    });

    const payRef = "PAY_TEST_EXTEND_AD";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "AD_EXTEND",
      amount: 9500,
      metadata: { adId, days: 30 },
      status: "PENDING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    await settlePayment(payRef, { status: "SUCCESS", amountReceived: 9500 });

    const adDoc = (await db.collection("ads").doc(adId).get()).data();
    const newExp = new Date(adDoc?.expiresAt).getTime();
    const expectedExp = new Date(futureDate).getTime() + 30 * 86400000;
    // La nouvelle date doit être à environ 35 jours (5 + 30)
    expect(Math.abs(newExp - expectedExp)).toBeLessThan(5000);
  });

  it("4.3 passe en NEEDS_REVIEW si le montant est absent", async () => {
    const payRef = "PAY_TEST_AMOUNT_ABSENT";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "SUB_PRO",
      amount: 29000,
      status: "PENDING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    // SingPay renvoie SUCCESS sans amountReceived
    const res = await settlePayment(payRef, {
      status: "SUCCESS",
    });

    expect(res.status).toBe("NEEDS_REVIEW");
    expect(res.attributed).toBe(false);

    const payDoc = (await db.collection("payments").doc(payRef).get()).data();
    expect(payDoc?.status).toBe("NEEDS_REVIEW");
    expect(payDoc?.attributed).toBe(false);
  });

  it("4.3 passe en NEEDS_REVIEW et n'attribue rien si le montant reçu diffère", async () => {
    const payRef = "PAY_TEST_AMOUNT_MISMATCH";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "SUB_PRO",
      amount: 29000,
      status: "PENDING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    // SingPay rapporte seulement 15000 au lieu de 29000
    const res = await settlePayment(payRef, {
      status: "SUCCESS",
      amountReceived: 15000,
    });

    expect(res.status).toBe("NEEDS_REVIEW");
    expect(res.attributed).toBe(false);

    // Le document de paiement est en NEEDS_REVIEW et non attribué
    const payDoc = (await db.collection("payments").doc(payRef).get()).data();
    expect(payDoc?.status).toBe("NEEDS_REVIEW");
    expect(payDoc?.attributed).toBe(false);

    // L'utilisateur n'a pas reçu le forfait PRO
    const userDoc = (await db.collection("users").doc(testUid).get()).data();
    expect(userDoc?.subscriptionTier).toBe("STANDARD");
  });

  it("Lot 2 acceptance: annonce PENDING_REVIEW non réactivable par settlePayment AD_EXTEND", async () => {
    const adId = "ad_test_pending_review_extend";
    await db.collection("ads").doc(adId).set({
      id: adId,
      userId: testUid,
      status: "PENDING_REVIEW",
      createdAt: new Date().toISOString(),
    });

    const payRef = "PAY_TEST_PENDING_REVIEW_AD";
    await db.collection("payments").doc(payRef).set({
      reference: payRef,
      userId: testUid,
      productId: "AD_EXTEND",
      amount: 9500,
      metadata: { adId, days: 30 },
      status: "PENDING",
      attributed: false,
      createdAt: new Date().toISOString(),
    });

    await settlePayment(payRef, { status: "SUCCESS", amountReceived: 9500 });

    const adDoc = (await db.collection("ads").doc(adId).get()).data();
    // Le statut doit impérativement rester PENDING_REVIEW et non passer à ACTIVE
    expect(adDoc?.status).toBe("PENDING_REVIEW");
  });
});
