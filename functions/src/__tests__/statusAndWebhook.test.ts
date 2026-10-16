import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import {
  mapSingPayResult,
  settlePayment,
} from "../index";

describe("Statut, Webhook et Réconciliation (Phase 5)", () => {
  const db = getFirestore();
  const testUid = "user_test_p5_1";

  beforeEach(async () => {
    await db.collection("users").doc(testUid).set({
      subscriptionTier: "STANDARD",
      freeBoostsRemaining: 0,
      freeBoosts: 0,
      consumedFreeAdsCount: 0,
      updatedAt: new Date().toISOString(),
    });
  });

  describe("5.2 mapSingPayResult (Table de correspondance unique)", () => {
    it("mappe Success vers SUCCESS", () => {
      const res = mapSingPayResult({ result: "Success", status: "Terminate" });
      expect(res.status).toBe("SUCCESS");
      expect(res.result).toBe("Success");
    });

    it("mappe PasswordError vers FAILED avec message PIN", () => {
      const res = mapSingPayResult({ result: "PasswordError", status: "Terminate" });
      expect(res.status).toBe("FAILED");
      expect(res.failureReason).toMatch(/PIN erroné/);
    });

    it("mappe BalanceError vers FAILED avec message solde", () => {
      const res = mapSingPayResult({ result: "BalanceError", status: "Terminate" });
      expect(res.status).toBe("FAILED");
      expect(res.failureReason).toMatch(/Solde mobile insuffisant/);
    });

    it("mappe TimeOutError vers FAILED avec message timeout", () => {
      const res = mapSingPayResult({ result: "TimeOutError", status: "Terminate" });
      expect(res.status).toBe("FAILED");
      expect(res.failureReason).toMatch(/timeout USSD/);
    });

    it("mappe Error vers FAILED avec message refus/annulation", () => {
      const res = mapSingPayResult({ result: "Error", status: "Terminate" });
      expect(res.status).toBe("FAILED");
      expect(res.failureReason).toMatch(/refusé ou annulé/);
    });

    it("mappe une transaction en cours vers PENDING", () => {
      const res = mapSingPayResult({ result: "", status: "Start" });
      expect(res.status).toBe("PENDING");
    });
  });

  describe("5.3 & 5.1 Robustesse et Idempotence Settle / Webhook", () => {
    it("5.3 Rejeu x5 d'un paiement SUCCESS donne une attribution unique", async () => {
      const payRef = "PAY_TEST_REPLAY_X5";
      await db.collection("payments").doc(payRef).set({
        reference: payRef,
        userId: testUid,
        productId: "SUB_PRO",
        amount: 29000,
        status: "PENDING",
        attributed: false,
        createdAt: new Date().toISOString(),
      });

      // 5 rejeux successifs
      for (let i = 0; i < 5; i++) {
        const res = await settlePayment(payRef, {
          status: "SUCCESS",
          singpayResult: "Success",
          singpayStatus: "Terminate",
        });
        expect(res.status).toBe("SUCCESS");
      }

      // Vérifier les compteurs utilisateur : boosters +1, pas +5
      const user = (await db.collection("users").doc(testUid).get()).data();
      expect(user?.subscriptionTier).toBe("PRO");
      expect(user?.freeBoostsRemaining).toBe(1);
    });
  });
});
