import { describe, it, expect } from "vitest";
import { generateSearchKeywords } from "../index";
import * as fs from "fs";
import * as path from "path";

describe("Phase 8 : Backend Tuning & Optimisations", () => {
  describe("generateSearchKeywords (Recherche Phase 1)", () => {
    it("génère des mots-clés normalisés en minuscules et sans accents", () => {
      const ad = {
        title: "Superbe Villa à Vendre à Libreville",
        description: "Très belle résidence sécurisée avec piscine et jardin clôturé",
        mainCategory: "IMMOBILIER",
        propertyType: "Villa",
        location: {
          city: "Libreville",
          province: "Estuaire",
          neighborhood: "La Sablière",
        },
        contactName: "Jean-Pierre Nguema",
      };

      const keywords = generateSearchKeywords(ad);

      expect(keywords).toContain("superbe");
      expect(keywords).toContain("villa");
      expect(keywords).toContain("vendre");
      expect(keywords).toContain("libreville");
      expect(keywords).toContain("residence"); // accent 'é' supprimé
      expect(keywords).toContain("securisee"); // accents 'é' supprimés
      expect(keywords).toContain("piscine");
      expect(keywords).toContain("sabliere"); // accent 'è' supprimé
      expect(keywords).toContain("nguema");
      expect(keywords).toContain("immobilier");

      // Vérifie que tous les mots-clés sont normalisés sans majuscules ni accents
      for (const kw of keywords) {
        expect(kw).toBe(kw.toLowerCase());
        expect(kw).not.toMatch(/[\u0300-\u036f]/);
      }
    });

    it("inclut la marque et le modèle pour un véhicule", () => {
      const ad = {
        title: "Toyota Prado TXL 2021",
        description: "Véhicule en parfait état révisé",
        mainCategory: "MATERIEL_ROULANT",
        vehicleData: {
          brand: "Toyota",
          model: "Prado",
        },
      };

      const keywords = generateSearchKeywords(ad);
      expect(keywords).toContain("toyota");
      expect(keywords).toContain("prado");
      expect(keywords).toContain("vehicule");
    });
  });

  describe("Index Composite Firestore pour Pagination par Catégorie", () => {
    it("firestore.indexes.json contient l'index composite status + mainCategory + publishedAt", () => {
      const indexesPath = path.resolve(__dirname, "../../../firestore.indexes.json");
      const content = JSON.parse(fs.readFileSync(indexesPath, "utf-8"));

      const hasCategoryIndex = content.indexes.some((idx: any) => {
        if (idx.collectionGroup !== "ads") return false;
        const fields = idx.fields || [];
        if (fields.length !== 3) return false;
        return (
          fields[0].fieldPath === "status" &&
          fields[1].fieldPath === "mainCategory" &&
          fields[2].fieldPath === "publishedAt" &&
          fields[2].order === "DESCENDING"
        );
      });

      expect(hasCategoryIndex).toBe(true);
    });
  });
});
