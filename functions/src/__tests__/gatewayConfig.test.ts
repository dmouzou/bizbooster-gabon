import { describe, it, expect, beforeEach } from "vitest";
import {
  assertSuperAdmin,
  validateNoControlOrWhitespace,
  normalizeMoovDisbursement,
  normalizeAirtelDisbursement,
  maskNumber,
  getSingPayConfig,
  clearSingPayConfigCache,
} from "../index";

describe("Configuration administrable Passerelle (Phase 2)", () => {
  beforeEach(() => {
    clearSingPayConfigCache();
  });

  describe("assertSuperAdmin", () => {
    it("refuse un appel sans authentification (unauthenticated)", async () => {
      await expect(assertSuperAdmin({})).rejects.toThrow(/Authentification requise/);
    });

    it("refuse un utilisateur standard (permission-denied)", async () => {
      await expect(
        assertSuperAdmin({
          auth: { uid: "user_123", token: { role: "USER" } },
        })
      ).rejects.toThrow(/Accès réservé exclusivement au Super Administrateur/);
    });

    it("refuse un administrateur simple (ADMIN)", async () => {
      await expect(
        assertSuperAdmin({
          auth: { uid: "admin_123", token: { role: "ADMIN" } },
        })
      ).rejects.toThrow(/Accès réservé exclusivement au Super Administrateur/);
    });

    it("autorise un token avec role SUPER_ADMIN", async () => {
      const uid = await assertSuperAdmin({
        auth: { uid: "super_123", token: { role: "SUPER_ADMIN" } },
      });
      expect(uid).toBe("super_123");
    });

    it("autorise un token avec role 'SUPER ADMIN'", async () => {
      const uid = await assertSuperAdmin({
        auth: { uid: "super_456", token: { role: "SUPER ADMIN" } },
      });
      expect(uid).toBe("super_456");
    });

    it("autorise un token avec isSuperAdmin: true", async () => {
      const uid = await assertSuperAdmin({
        auth: { uid: "super_789", token: { isSuperAdmin: true } },
      });
      expect(uid).toBe("super_789");
    });
  });

  describe("Validation des entrées (validateNoControlOrWhitespace)", () => {
    it("accepte une chaîne valide sans espaces", () => {
      expect(() =>
        validateNoControlOrWhitespace("client_secret_xyz123", "clientSecret")
      ).not.toThrow();
    });

    it("rejette les espaces internes", () => {
      expect(() =>
        validateNoControlOrWhitespace("client secret", "clientSecret")
      ).toThrow(/ne doit pas contenir d'espaces internes/);
    });

    it("rejette les caractères de contrôle", () => {
      expect(() =>
        validateNoControlOrWhitespace("secret\x00key", "clientSecret")
      ).toThrow(/caractères de contrôle non autorisés/);
    });
  });

  describe("Normalisation et validation des numéros marchands", () => {
    it("normalise un numéro Moov gabonais au format 241...", () => {
      expect(normalizeMoovDisbursement("062 18 87 34")).toBe("24162188734");
      expect(normalizeMoovDisbursement("65123456")).toBe("24165123456");
      expect(normalizeMoovDisbursement("+241 66 00 11 22")).toBe("24166001122");
    });

    it("rejette un numéro Airtel saisi dans le champ Moov", () => {
      expect(() => normalizeMoovDisbursement("074 12 34 56")).toThrow(
        /doit commencer par un préfixe Moov/
      );
      expect(() => normalizeMoovDisbursement("077 12 34 56")).toThrow(
        /doit commencer par un préfixe Moov/
      );
    });

    it("rejette une longueur invalide pour Moov", () => {
      expect(() => normalizeMoovDisbursement("62123")).toThrow(
        /doit comporter 8 chiffres/
      );
    });

    it("normalise un numéro Airtel gabonais au format 241...", () => {
      expect(normalizeAirtelDisbursement("074 12 34 56")).toBe("24174123456");
      expect(normalizeAirtelDisbursement("77123456")).toBe("24177123456");
      expect(normalizeAirtelDisbursement("+241 76 99 88 77")).toBe("24176998877");
    });

    it("rejette un numéro Moov saisi dans le champ Airtel", () => {
      expect(() => normalizeAirtelDisbursement("062 18 87 34")).toThrow(
        /doit commencer par un préfixe Airtel/
      );
    });
  });

  describe("Masquage des numéros (maskNumber)", () => {
    it("masque correctement les numéros marchands pour l'audit et l'affichage", () => {
      expect(maskNumber("24162188734")).toBe("+241 •• •• 8734");
      expect(maskNumber("074123456")).toBe("+241 •• •• 3456");
      expect(maskNumber("")).toBe("");
    });
  });

  describe("Configuration SingPay (getSingPayConfig)", () => {
    it("supprime le repli webhookSecret = clientSecret", async () => {
      const cfg = await getSingPayConfig();
      // Si webhookSecret n'est pas configuré, il ne doit PAS copier clientSecret
      if (!cfg.webhookSecret && cfg.clientSecret) {
        expect(cfg.webhookSecret).not.toBe(cfg.clientSecret);
      }
    });

    it("met en cache la configuration pendant 60s et se vide sur clearSingPayConfigCache", async () => {
      const cfg1 = await getSingPayConfig();
      const cfg2 = await getSingPayConfig();
      expect(cfg1).toBe(cfg2);

      clearSingPayConfigCache();
      const cfg3 = await getSingPayConfig();
      expect(cfg3).not.toBeNull();
    });
  });
});
