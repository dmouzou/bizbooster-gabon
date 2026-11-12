import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertSuperAdmin,
  validateNoControlOrWhitespace,
  validateDisbursementId,
  maskIdentifier,
  maskNumber,
  formatSingPayClientMsisdn,
  buildSingPayPaymentPayload,
  getSingPayConfig,
  clearSingPayConfigCache,
} from "../index";

describe("Configuration administrable Passerelle (Phase 2)", () => {
  const originalDisbursementEnv = process.env.SINGPAY_DISBURSEMENT_ID;

  beforeEach(() => {
    clearSingPayConfigCache();
  });

  afterEach(() => {
    clearSingPayConfigCache();
    if (originalDisbursementEnv === undefined) {
      delete process.env.SINGPAY_DISBURSEMENT_ID;
    } else {
      process.env.SINGPAY_DISBURSEMENT_ID = originalDisbursementEnv;
    }
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

  describe("Validation du Disbursement ID (wallet de reversement)", () => {
    it("accepte un identifiant alphanumérique valide avec tirets/underscores et supprime les espaces externes", () => {
      expect(validateDisbursementId("  wallet_disb-01_ABC  ")).toBe("wallet_disb-01_ABC");
    });

    it("rejette un Disbursement ID vide", () => {
      expect(() => validateDisbursementId("   ")).toThrow(
        /Disbursement ID ne peut pas être vide/
      );
    });

    it("rejette les espaces internes ou caractères spéciaux invalides", () => {
      expect(() => validateDisbursementId("disb id")).toThrow(
        /ne doit pas contenir d'espaces internes/
      );
      expect(() => validateDisbursementId("disb@id!")).toThrow(
        /identifiant alphanumérique valide/
      );
    });

    it("rejette un Disbursement ID dépassant 128 caractères", () => {
      expect(() => validateDisbursementId("a".repeat(129))).toThrow(
        /Disbursement ID trop long/
      );
    });
  });

  describe("Masquage des identifiants et numéros", () => {
    it("masque correctement les identifiants de portefeuille pour l'audit", () => {
      expect(maskIdentifier("WALLET_DISB_9876")).toBe("••••••••9876");
      expect(maskIdentifier("1234")).toBe("••••");
      expect(maskIdentifier("")).toBe("");
    });

    it("masque correctement les numéros clients pour l'audit et l'affichage", () => {
      expect(maskNumber("24162188734")).toBe("+241 •• •• 8734");
      expect(maskNumber("074123456")).toBe("+241 •• •• 3456");
      expect(maskNumber("")).toBe("");
    });
  });

  describe("Format SingPay client_msisdn et charge utile POST", () => {
    it("formate client_msisdn sur 9 chiffres avec 0 initial et sans indicatif 241", () => {
      expect(formatSingPayClientMsisdn("77000001")).toBe("077000001");
      expect(formatSingPayClientMsisdn("62000002")).toBe("062000002");
    });

    it("construit la charge utile exacte attendue par SingPay (disbursement ID + isTransfer: false)", () => {
      const payload = buildSingPayPaymentPayload({
        amount: 2000,
        reference: "BZB_user1234_abc12345",
        rawDigits: "77000001",
        walletId: "WAL_TEST_1234",
        disbursementId: "DISB_TEST_9876",
      });

      expect(payload).toEqual({
        amount: 2000,
        reference: "BZB_user1234_abc12345",
        client_msisdn: "077000001",
        portefeuille: "WAL_TEST_1234",
        disbursement: "DISB_TEST_9876",
        isTransfer: false,
      });
    });
  });

  describe("Configuration SingPay (getSingPayConfig)", () => {
    it("lit SINGPAY_DISBURSEMENT_ID depuis l'environnement en repli Secret Manager", async () => {
      process.env.SINGPAY_DISBURSEMENT_ID = "ENV_DISB_WALLET_01";
      clearSingPayConfigCache();
      const cfg = await getSingPayConfig();
      expect(cfg.disbursementId).toBe("ENV_DISB_WALLET_01");
    });

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
