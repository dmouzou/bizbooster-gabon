// Coin VIP Constants and Utilities for BizBooster Gabon
// Restricted to IMMOBILIER (Villa, Maison, Appartement, Terrain/Parcelle)
// and MATERIEL_ROULANT (Voitures, Motos)

export const VIP_THRESHOLDS = {
  IMMOBILIER: {
    VENTE: 75_000_000, // >= 75 Millions FCFA (Villas, Maisons, Appartements, Terrains/Parcelles)
    LOCATION_MOIS: 1_000_000, // >= 1 Million FCFA/mois (Résidences standing, villas avec piscine)
    LOCATION_JOUR: 100_000, // >= 100 000 FCFA/jour
    LOCATION_TRIMESTRE: 3_000_000,
    LOCATION_AN: 12_000_000,
  },
  MATERIEL_ROULANT: {
    VENTE: 25_000_000, // >= 25 Millions FCFA (Voitures et Motos de luxe/prestige)
    LOCATION_JOUR: 50_000, // >= 50 000 FCFA/jour (Véhicules premium, berlines de luxe, motos)
    LOCATION_MOIS: 1_000_000,
    LOCATION_HEURE: 15_000,
  },
};

export const VIP_ALLOWED_IMMOBILIER_TYPES = [
  'villa',
  'maison',
  'appartement',
  'terrain / parcelle',
  'terrain',
  'parcelle',
];

export const VIP_ALLOWED_MATERIEL_ROULANT_CATEGORIES = [
  'voitures',
  'voiture',
  'motos',
  'moto',
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
 * Checks whether an ad qualifies for the Coin VIP.
 * Limited strictly to:
 * - IMMOBILIER: Villa, Maison, Appartement, Terrain / Parcelle
 * - MATERIEL_ROULANT: Voitures, Motos
 */
export function isAdVipCornerEligible(params: VipCheckParams): boolean {
  if (!params) return false;

  const category = params.mainCategory;
  if (category !== 'IMMOBILIER' && category !== 'MATERIEL_ROULANT') {
    return false;
  }

  // 1. Filtrage strict Immobilier : uniquement villa, maison, appartement, terrain/parcelle
  if (category === 'IMMOBILIER') {
    const propType = (params.propertyType || '').toLowerCase().trim();
    if (propType) {
      const isAllowed = VIP_ALLOWED_IMMOBILIER_TYPES.some((t) => propType.includes(t));
      if (!isAllowed) {
        return false;
      }
    }
  }

  // 2. Filtrage strict Matériel Roulant : uniquement voitures et motos
  if (category === 'MATERIEL_ROULANT') {
    const vehCat = (
      params.vehicleData?.category ||
      params.rollingStockCategory ||
      params.vehicleCategory ||
      ''
    )
      .toLowerCase()
      .trim();
    if (vehCat) {
      const isAllowed = VIP_ALLOWED_MATERIEL_ROULANT_CATEGORIES.some((t) => vehCat.includes(t));
      if (!isAllowed) {
        return false;
      }
    }
  }

  const numPrice = Number(params.price) || 0;
  if (numPrice <= 0 && !params.isVipCorner) return false;

  const transType = (params.transactionType || 'VENTE').toUpperCase();
  const unit = params.priceUnit || (transType === 'VENTE' ? 'total' : 'mois');

  if (category === 'IMMOBILIER') {
    if (transType === 'VENTE' || unit === 'total') {
      return numPrice >= VIP_THRESHOLDS.IMMOBILIER.VENTE;
    }
    // Location units
    if (unit === 'jour') return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_JOUR;
    if (unit === 'an') return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_AN;
    if (unit === 'trimestre') return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_TRIMESTRE;
    // Default location: per month
    return numPrice >= VIP_THRESHOLDS.IMMOBILIER.LOCATION_MOIS;
  }

  if (category === 'MATERIEL_ROULANT') {
    if (transType === 'VENTE' || unit === 'total') {
      return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.VENTE;
    }
    // Location units
    if (unit === 'jour') return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_JOUR;
    if (unit === 'mois') return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_MOIS;
    if (unit === 'heure') return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_HEURE;
    return numPrice >= VIP_THRESHOLDS.MATERIEL_ROULANT.LOCATION_JOUR;
  }

  return false;
}

/**
 * Description of VIP threshold for helper text during publishing
 */
export function getVipThresholdDescription(mainCategory: string, transactionType: string): string {
  if (mainCategory === 'IMMOBILIER') {
    return transactionType === 'VENTE'
      ? '≥ 75 000 000 FCFA (Villas, Maisons, Appartements, Terrains/Parcelles)'
      : '≥ 1 000 000 FCFA/mois ou ≥ 100 000 FCFA/jour (Villas, Maisons, Appartements)';
  }
  if (mainCategory === 'MATERIEL_ROULANT') {
    return transactionType === 'VENTE'
      ? '≥ 25 000 000 FCFA (Voitures et Motos de prestige)'
      : '≥ 50 000 FCFA/jour ou ≥ 1 000 000 FCFA/mois (Voitures et Motos)';
  }
  return '';
}

export const VIP_CORNER_INFO = {
  title: 'Coin VIP BizBooster',
  badge: 'PRESTIGE GABON',
  summary:
    'Espace d\'exception dédié aux villas, maisons, appartements, terrains ainsi qu\'aux voitures et motos de grand standing au Gabon.',
  explanation:
    'Le Coin VIP rassemble les offres immobilières de standing (villas, maisons, appartements, terrains dès 75M FCFA à la vente ou 1M FCFA/mois en location) et les voitures ou motos de prestige (dès 25M FCFA à la vente ou 50 000 FCFA/jour). Les annonces qualifiées y sont intégrées automatiquement sans aucun frais supplémentaire pour l\'annonceur.',
  freeOfChargeNotice: 'Placement offert sans aucun frais',
};
