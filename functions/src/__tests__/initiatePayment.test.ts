import { describe, it, expect } from "vitest";
import {
  buildPriceContext,
  singpayFetch,
} from "../index";

describe("Initiation de paiement (Phase 3)", () => {
  describe("buildPriceContext", () => {
    it("dégrade un abonnement expiré vers STANDARD", () => {
      const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const ctx = buildPriceContext({
        subscriptionTier: "PRO",
        subscriptionExpiresAt: pastDate,
      });
      expect(ctx.effectiveTier).toBe("STANDARD");
    });

    it("conserve un abonnement actif non expiré", () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
      const ctx = buildPriceContext({
        subscriptionTier: "PRO",
        subscriptionExpiresAt: futureDate,
      });
      expect(ctx.effectiveTier).toBe("PRO");
    });

    it("applique la règle D3 : quota gratuit = 0 pour utilisateur STANDARD", () => {
      const ctx = buildPriceContext({
        subscriptionTier: "STANDARD",
        consumedFreeAdsCount: 0,
      });
      // STANDARD a 0 annonce gratuite
      expect(ctx.hasFreeAdQuota).toBe(false);
    });

    it("accorde le quota gratuit pour un abonné PRO actif sous le quota", () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
      const ctx = buildPriceContext({
        subscriptionTier: "PRO",
        subscriptionExpiresAt: futureDate,
        consumedFreeAdsCount: 2, // Quota PRO = 8
      });
      expect(ctx.hasFreeAdQuota).toBe(true);
    });

    it("calcule l'ancienneté d'abonnement en jours", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString();
      const ctx = buildPriceContext({
        subscriptionTier: "PRO",
        subscriptionStartedAt: fiveDaysAgo,
        subscriptionExpiresAt: futureDate,
      });
      expect(ctx.subscriptionAgeDays).toBe(5);
    });

    it("calcule les jours restants d'une annonce pour AD_EXTEND", () => {
      const adExpiresIn15Days = new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString();
      const ctx = buildPriceContext(
        { subscriptionTier: "STANDARD" },
        { expiresAt: adExpiresIn15Days }
      );
      expect(ctx.adRemainingDays).toBe(15);
    });

    it("force le quota et l'exemption si l'utilisateur est exempté", () => {
      const ctx = buildPriceContext({
        subscriptionTier: "STANDARD",
        isExempt: true,
      });
      expect(ctx.isExempt).toBe(true);
      expect(ctx.hasFreeAdQuota).toBe(true);
    });
  });

  describe("singpayFetch", () => {
    it("déclenche un abandon par timeout si le serveur ne répond pas", async () => {
      // Test avec un timeout très court (10ms) vers une URL factice
      await expect(
        singpayFetch(
          "https://10.255.255.1",
          { method: "POST" },
          15
        )
      ).rejects.toThrow(/Délai d'attente SingPay dépassé/);
    });
  });
});
