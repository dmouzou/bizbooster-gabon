import { describe, it, expect } from "vitest";
import {
  quoteOrder,
  PricingError,
  PriceContext,
} from "../pricing";

describe("Tarification serveur durcie (pricing.ts)", () => {
  const baseStandardCtx: PriceContext = {
    isExempt: false,
    effectiveTier: "STANDARD",
    subscriptionAgeDays: 0,
    hasFreeAdQuota: false,
    freeBoosts: 0,
  };

  // 1. Prolongation de 100000 jours : Rejetée (« Durée de prolongation non proposée. »)
  it("rejette une prolongation de 100000 jours", () => {
    expect(() =>
      quoteOrder(
        "AD_EXTEND",
        { adId: "ad_123", days: 100000 },
        baseStandardCtx
      )
    ).toThrowError(PricingError);
  });

  // 2. Prolongation 30 jours, Standard / Pro : 9500 / 7125 (remise Pro de 25 %)
  it("calcule la prolongation 30 jours pour Standard (9500) et Pro (7125)", () => {
    const qStandard = quoteOrder(
      "AD_EXTEND",
      { adId: "ad_123", days: 30 },
      baseStandardCtx
    );
    expect(qStandard.amount).toBe(9500);

    const proCtx: PriceContext = {
      ...baseStandardCtx,
      effectiveTier: "PRO",
    };
    const qPro = quoteOrder(
      "AD_EXTEND",
      { adId: "ad_123", days: 30 },
      proCtx
    );
    expect(qPro.amount).toBe(7125);
  });

  // 3. Prolongation 365 jours sur une annonce avec 10 jours restants : Rejetée (plafond de 365 jours de validité)
  it("rejette une prolongation de 365 jours sur une annonce avec 10 jours restants", () => {
    const ctxWith10Days: PriceContext = {
      ...baseStandardCtx,
      adRemainingDays: 10,
    };
    expect(() =>
      quoteOrder(
        "AD_EXTEND",
        { adId: "ad_123", days: 365 },
        ctxWith10Days
      )
    ).toThrowError("Une annonce ne peut pas dépasser 365 jours de validité.");
  });

  // 4. Publication 3 jours, 3 photos, sans quota : 1500
  it("calcule la publication 3 jours, 3 photos sans quota à 1500 FCFA", () => {
    const q = quoteOrder(
      "AD_PUBLISH",
      { adId: "ad_123", durationDays: 3, photoCount: 3 },
      baseStandardCtx
    );
    expect(q.amount).toBe(1500);
  });

  // 5. Publication avec durée 3650 : Rejetée
  it("rejette une publication avec une durée inconnue (3650)", () => {
    expect(() =>
      quoteOrder(
        "AD_PUBLISH",
        { adId: "ad_123", durationDays: 3650 },
        baseStandardCtx
      )
    ).toThrowError("Durée de publication non proposée.");
  });

  // 6. Publication sur quota gratuit, 5 photos, vidéo, boost, durée 30 jours :
  // 8000 (2 photos en plus 1000, vidéo 2000, boost 5000)
  it("calcule publication sur quota avec 5 photos, vidéo, boost à 8000 FCFA", () => {
    const ctxQuota: PriceContext = {
      ...baseStandardCtx,
      hasFreeAdQuota: true,
    };
    const q = quoteOrder(
      "AD_PUBLISH",
      {
        adId: "ad_123",
        durationDays: 30,
        photoCount: 5,
        hasVideo: true,
        withBoost: true,
      },
      ctxQuota
    );
    expect(q.amount).toBe(8000);
  });

  // 7. Publication sur quota gratuit avec un boost gratuit en solde :
  // 0, source de boost FREE_BALANCE
  it("calcule publication sur quota avec boost en solde à 0 FCFA et source FREE_BALANCE", () => {
    const ctxFreeBoost: PriceContext = {
      ...baseStandardCtx,
      hasFreeAdQuota: true,
      freeBoosts: 1,
    };
    const q = quoteOrder(
      "AD_PUBLISH",
      {
        adId: "ad_123",
        durationDays: 30,
        photoCount: 3,
        hasVideo: false,
        withBoost: true,
      },
      ctxFreeBoost
    );
    expect(q.amount).toBe(0);
    expect(q.metadata.boostSource).toBe("FREE_BALANCE");
  });

  // 8. Pro vers Elite dans les 7 jours (3e jour) / après 20 jours : 30000 / 59000
  it("calcule la mise à niveau Pro vers Elite à 30000 sous 7 jours et 59000 après", () => {
    const ctxUnder7Days: PriceContext = {
      ...baseStandardCtx,
      effectiveTier: "PRO",
      subscriptionAgeDays: 3,
    };
    const qUnder7 = quoteOrder("SUB_ELITE", {}, ctxUnder7Days);
    expect(qUnder7.amount).toBe(30000);

    const ctxAfter20Days: PriceContext = {
      ...baseStandardCtx,
      effectiveTier: "PRO",
      subscriptionAgeDays: 20,
    };
    const qAfter20 = quoteOrder("SUB_ELITE", {}, ctxAfter20Days);
    expect(qAfter20.amount).toBe(59000);
  });

  // 9. Business vers Pro : Rejeté (forfait identique ou inférieur)
  it("rejette le changement Business vers Pro", () => {
    const ctxBusiness: PriceContext = {
      ...baseStandardCtx,
      effectiveTier: "BUSINESS",
      subscriptionAgeDays: 5,
    };
    expect(() =>
      quoteOrder("SUB_PRO", {}, ctxBusiness)
    ).toThrowError("Ce forfait est identique ou inférieur à votre forfait actif.");
  });

  // 10. Pack 10 boosters avec 18 déjà en solde : Rejeté (plafond de 20)
  it("rejette l'achat d'un Pack 10 boosters si 18 déjà en solde", () => {
    const ctx18Boosts: PriceContext = {
      ...baseStandardCtx,
      freeBoosts: 18,
    };
    expect(() =>
      quoteOrder("BOOST_10", {}, ctx18Boosts)
    ).toThrowError(/Plafond de 20 boosters/);
  });

  // 11. Boost unitaire sans annonce : Rejeté
  it("rejette un boost unitaire sans annonce", () => {
    expect(() =>
      quoteOrder("BOOST_SINGLE", {}, baseStandardCtx)
    ).toThrowError("Annonce requise pour un boost unitaire.");
  });

  // 12. Utilisateur exempté : 0
  it("accorde la gratuité totale (0 FCFA) à un utilisateur exempté", () => {
    const ctxExempt: PriceContext = {
      ...baseStandardCtx,
      isExempt: true,
    };
    const q = quoteOrder(
      "AD_PUBLISH",
      {
        adId: "ad_123",
        durationDays: 30,
        photoCount: 8,
        hasVideo: true,
        withBoost: true,
      },
      ctxExempt
    );
    expect(q.amount).toBe(0);
  });

  // 13. Produit inconnu : Rejeté
  it("rejette un produit inconnu", () => {
    expect(() =>
      quoteOrder("UNKNOWN_PRODUCT", {}, baseStandardCtx)
    ).toThrowError("Produit inconnu.");
  });
});
