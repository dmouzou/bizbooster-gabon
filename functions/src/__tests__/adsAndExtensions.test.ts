import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { resolveAdPayment } from "../index";

describe("Annonces et Prolongations (Phase 6)", () => {
  const db = getFirestore();
  const testUid = "user_test_p6_1";
  const otherUid = "user_test_p6_other";

  beforeEach(async () => {
    await db.collection("users").doc(testUid).set({
      subscriptionTier: "STANDARD",
      freeBoostsRemaining: 0,
      freeBoosts: 0,
      consumedFreeAdsCount: 0,
      updatedAt: new Date().toISOString(),
    });
  });

  describe("6.1 resolveAdPayment (Vérification stricte du paiement d'annonce)", () => {
    it("refuse si paymentReference est absent", async () => {
      const res = await resolveAdPayment("ad_123", testUid, null);
      expect(res.verified).toBe(false);
      expect(res.failureReason).toMatch(/Référence de paiement absente/);
    });

    it("refuse un faux paymentReference (introuvable dans Firestore)", async () => {
      const res = await resolveAdPayment("ad_123", testUid, "FAKE_PAY_REF");
      expect(res.verified).toBe(false);
      expect(res.failureReason).toMatch(/introuvable/);
    });

    it("refuse un paiement non validé (statut PENDING)", async () => {
      const payRef = "PAY_TEST_PENDING_AD";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: testUid,
        productId: "AD_PUBLISH",
        status: "PENDING",
      });

      const res = await resolveAdPayment("ad_123", testUid, payRef);
      expect(res.verified).toBe(false);
      expect(res.failureReason).toMatch(/non validé/);
    });

    it("refuse si le paiement appartient à un autre utilisateur", async () => {
      const payRef = "PAY_TEST_OTHER_USER";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: otherUid,
        productId: "AD_PUBLISH",
        status: "SUCCESS",
        metadata: { adId: "ad_123" },
      });

      const res = await resolveAdPayment("ad_123", testUid, payRef);
      expect(res.verified).toBe(false);
      expect(res.failureReason).toMatch(/autre compte/);
    });

    it("refuse si le produit n'est pas AD_PUBLISH", async () => {
      const payRef = "PAY_TEST_WRONG_PRODUCT";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: testUid,
        productId: "SUB_PRO",
        status: "SUCCESS",
      });

      const res = await resolveAdPayment("ad_123", testUid, payRef);
      expect(res.verified).toBe(false);
      expect(res.failureReason).toMatch(/invalide pour la publication/);
    });

    it("refuse si le paiement a déjà été consommé par une autre annonce", async () => {
      const payRef = "PAY_TEST_ALREADY_CONSUMED";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: testUid,
        productId: "AD_PUBLISH",
        status: "SUCCESS",
        consumedByAdId: "ad_previous",
      });

      const res = await resolveAdPayment("ad_123", testUid, payRef);
      expect(res.verified).toBe(false);
      expect(res.failureReason).toMatch(/déjà été consommé/);
    });

    it("valide un paiement AD_PUBLISH conforme et dérive les métadonnées", async () => {
      const payRef = "PAY_TEST_VALID_AD";
      const adId = "ad_legit_456";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: testUid,
        productId: "AD_PUBLISH",
        status: "SUCCESS",
        amount: 9500,
        operator: "MOOV_MONEY",
        metadata: {
          adId,
          durationDays: 30,
          photoCount: 5,
          withBoost: true,
        },
      });

      const res = await resolveAdPayment(adId, testUid, payRef);
      expect(res.verified).toBe(true);
      expect(res.durationDays).toBe(30);
      expect(res.paidAmount).toBe(9500);
      expect(res.paymentMethod).toBe("MOOV_MONEY");
      expect(res.maxPhotos).toBe(5);
      expect(res.boostRequested).toBe(true);
      expect(res.expiresAt).toBeDefined();

      // Vérifier que le paiement a été marqué comme consommé
      const payDoc = (await db.collection("payments").doc(payRef).get()).data();
      expect(payDoc?.consumedByAdId).toBe(adId);
    });

    it("B8: refuse les consommations concurrentes d'un même paiement par deux annonces différentes", async () => {
      const payRef = "PAY_TEST_CONCURRENT_CONSUME";
      const ad1 = "ad_concurrent_1";
      const ad2 = "ad_concurrent_2";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: testUid,
        productId: "AD_PUBLISH",
        status: "SUCCESS",
        amount: 9500,
        metadata: { durationDays: 30 },
      });

      const [r1, r2] = await Promise.all([
        resolveAdPayment(ad1, testUid, payRef),
        resolveAdPayment(ad2, testUid, payRef),
      ]);

      // Exactement un des deux doit réussir, l'autre doit être refusé
      const verifiedCount = [r1, r2].filter((r) => r.verified).length;
      expect(verifiedCount).toBe(1);
    });
  });
});
