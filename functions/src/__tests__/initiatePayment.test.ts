import { describe, it, expect } from "vitest";
import {
  buildPriceContext,
  computeFrozenRemainingMs,
  singpayFetch,
  validateAdTargetForPayment,
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
        consumedFreeAdsCount: 2, // Quota PRO = 4
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

    it("calcule les jours restants gelés entre suspendedAt et expiresAt pour AD_REACTIVATE", () => {
      const suspendedAt = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const ad = {
        status: "SUSPENDED",
        suspendedAt,
        expiresAt,
        images: ["p1", "p2", "p3", "p4"],
        videoUrl: "https://example.com/v.mp4",
      };
      const frozenMs = computeFrozenRemainingMs(ad);
      expect(Math.round(frozenMs / (24 * 3600 * 1000))).toBe(12);

      const ctx = buildPriceContext({ subscriptionTier: "STANDARD" }, ad);
      expect(ctx.adFrozenRemainingDays).toBe(12);
      expect(ctx.adPhotoCount).toBe(4);
      expect(ctx.adHasVideo).toBe(true);
    });
  });

  describe("singpayFetch", () => {
    it("déclenche un abandon par timeout si le serveur ne répond pas", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = ((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            return reject(err);
          }
          init?.signal?.addEventListener("abort", () => {
            const abortErr = new Error("This operation was aborted");
            abortErr.name = "AbortError";
            reject(abortErr);
          });
        });
      }) as any;

      try {
        await expect(
          singpayFetch(
            "https://10.255.255.1",
            { method: "POST" },
            15
          )
        ).rejects.toThrow(/Délai d'attente SingPay dépassé/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("validateAdTargetForPayment (P0 Correctif AD_PUBLISH)", () => {
    it("AD_PUBLISH avec adId inexistant : ne lève pas not-found, autorise l'initiation", () => {
      const res = validateAdTargetForPayment(
        "AD_PUBLISH",
        "pre_generated_new_ad_id",
        false, // doc.exists === false
        null,
        "caller_user_1",
        false
      );
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("AD_PUBLISH avec adId appartenant à un autre utilisateur : permission-denied", () => {
      const res = validateAdTargetForPayment(
        "AD_PUBLISH",
        "ad_other_user",
        true, // doc.exists === true
        { userId: "other_user_999", status: "PENDING_PAYMENT" },
        "caller_user_1",
        false
      );
      expect(res.isValid).toBe(false);
      expect(res.error?.code).toBe("permission-denied");
    });

    it("AD_PUBLISH avec adId d'une annonce ACTIVE : already-exists", () => {
      const res = validateAdTargetForPayment(
        "AD_PUBLISH",
        "ad_already_active",
        true,
        { userId: "caller_user_1", status: "ACTIVE" },
        "caller_user_1",
        false
      );
      expect(res.isValid).toBe(false);
      expect(res.error?.code).toBe("already-exists");
    });

    it("BOOST_SINGLE ou AD_EXTEND avec adId inexistant : not-found (comportement conservé)", () => {
      const resBoost = validateAdTargetForPayment(
        "BOOST_SINGLE",
        "nonexistent_ad_id",
        false,
        null,
        "caller_user_1",
        false
      );
      expect(resBoost.isValid).toBe(false);
      expect(resBoost.error?.code).toBe("not-found");

      const resExtend = validateAdTargetForPayment(
        "AD_EXTEND",
        "nonexistent_ad_id",
        false,
        null,
        "caller_user_1",
        false
      );
      expect(resExtend.isValid).toBe(false);
      expect(resExtend.error?.code).toBe("not-found");
    });
  });
});
