/**
 * Coin VIP Constants and Utilities for BizBooster Gabon (Cloud Functions)
 * Strict parity with src/utils/vipCorner.ts
 */

export const VIP_THRESHOLDS = {
  IMMOBILIER: {
    VENTE: 75_000_000,
    LOCATION_MOIS: 1_000_000,
    LOCATION_JOUR: 100_000,
    LOCATION_TRIMESTRE: 3_000_000,
    LOCATION_AN: 12_000_000,
  },
  MATERIEL_ROULANT: {
    VENTE: 25_000_000,
    LOCATION_JOUR: 50_000,
    LOCATION_MOIS: 1_000_000,
    LOCATION_HEURE: 15_000,
  },
};

export const VIP_ALLOWED_IMMOBILIER_TYPES = [
  "villa",
  "maison",
  "appartement",
  "terrain / parcelle",
  "terrain",
  "parcelle",
];

export const VIP_ALLOWED_MATERIEL_ROULANT_CATEGORIES = [
  "voitures",
  "voiture",
  "motos",
  "moto",
];

export interface VipCheckParams {
  mainCategory?: string;
  transactionType?: string;
  price?: number | string;
  priceUnit?: string;
  isVipCorner?: boolean;
  propertyType?: string;
  vehicleData?: {
    category?: string;
    brand?: string;
    model?: string;
    subType?: string;
  };
  rollingStockCategory?: string;
  vehicleCategory?: string;
}

/**
 * Checks if an ad meets Coin VIP criteria.
 * @param {VipCheckParams} params - The ad parameters.
 * @return {boolean} True if eligible for Coin VIP.
 */
export function isAdVipCornerEligible(params: VipCheckParams): boolean {
  if (!params) return false;

  const category = params.mainCategory;
  if (category !== "IMMOBILIER" && category !== "MATERIEL_ROULANT") {
    return false;
  }

  // 1. Filtrage strict Immobilier
  if (category === "IMMOBILIER") {
    const propType = (params.propertyType || "").toLowerCase().trim();
    if (propType) {
      const isAllowed = VIP_ALLOWED_IMMOBILIER_TYPES.some((t) =>
        propType.includes(t)
      );
      if (!isAllowed) {
        return false;
      }
    }
  }

  // 2. Filtrage strict Matériel Roulant
  if (category === "MATERIEL_ROULANT") {
    const vehCat = (
      params.vehicleData?.category ||
      params.rollingStockCategory ||
      params.vehicleCategory ||
      ""
    )
      .toLowerCase()
      .trim();
    if (vehCat) {
      const isAllowed = VIP_ALLOWED_MATERIEL_ROULANT_CATEGORIES.some((t) =>
        vehCat.includes(t)
      );
      if (!isAllowed) {
        return false;
      }
    }
  }

  const numPrice = Number(params.price) || 0;
  if (numPrice <= 0 && !params.isVipCorner) return false;

  const transType = (params.transactionType || "VENTE").toUpperCase();
  const unit = params.priceUnit || (transType === "VENTE" ? "total" : "mois");

  if (category === "IMMOBILIER") {
    if (transType === "VENTE" || unit === "total") {
      return numPrice >= VIP_THRESHOLDS.IMMOBILIER.VENTE;
    }
    if (unit === "jour") {
      return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_JOUR;
    }
    if (unit === "an") {
      return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_AN;
    }
    if (unit === "trimestre") {
      return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_TRIMESTRE;
    }
    return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_MOIS;
  }

  if (category === "MATERIEL_ROULANT") {
    if (transType === "VENTE" || unit === "total") {
      return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.VENTE;
    }
    if (unit === "jour") {
      return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_JOUR;
    }
    if (unit === "mois") {
      return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_MOIS;
    }
    if (unit === "heure") {
      return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_HEURE;
    }
    return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_JOUR;
  }

  return false;
}
