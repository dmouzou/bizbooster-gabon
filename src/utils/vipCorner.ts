// VIP Corner Constants and Utilities for BizBooster Gabon
// Restricted to IMMOBILIER and MATERIEL_ROULANT

export const VIP_THRESHOLDS = {
  IMMOBILIER: {
    VENTE: 75_000_000, // >= 75 Millions FCFA (Villas haut standing, immeubles, terrains viabilisés de prestige)
    LOCATION_MOIS: 1_000_000, // >= 1 Million FCFA/mois (Résidences standing, villas avec piscine)
    LOCATION_JOUR: 100_000, // >= 100 000 FCFA/jour
    LOCATION_TRIMESTRE: 3_000_000,
    LOCATION_AN: 12_000_000,
  },
  MATERIEL_ROULANT: {
    VENTE: 25_000_000, // >= 25 Millions FCFA (4x4 de luxe, Land Cruiser, Prado récents, engins lourds, camions)
    LOCATION_JOUR: 50_000, // >= 50 000 FCFA/jour (Véhicules premium, minibus, engins BTP)
    LOCATION_MOIS: 1_000_000,
    LOCATION_HEURE: 15_000,
  },
};

export interface VipCheckParams {
  mainCategory?: string;
  transactionType?: string;
  price?: number | string;
  priceUnit?: string;
  isVipCorner?: boolean;
}

/**
 * Checks whether an ad qualifies for the VIP Corner.
 * Limited to IMMOBILIER and MATERIEL_ROULANT.
 */
export function isAdVipCornerEligible(params: VipCheckParams): boolean {
  if (!params) return false;
  if (params.isVipCorner) return true;

  const numPrice = Number(params.price) || 0;
  if (numPrice <= 0) return false;

  const category = params.mainCategory;
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
      ? '≥ 75 000 000 FCFA'
      : '≥ 1 000 000 FCFA/mois (ou ≥ 100 000 FCFA/jour)';
  }
  if (mainCategory === 'MATERIEL_ROULANT') {
    return transactionType === 'VENTE'
      ? '≥ 25 000 000 FCFA'
      : '≥ 50 000 FCFA/jour (ou ≥ 1 000 000 FCFA/mois)';
  }
  return '';
}

export const VIP_CORNER_INFO = {
  title: 'Corner VIP BizBooster',
  badge: 'PRESTIGE GABON',
  summary:
    'Espace d\'exception dédié aux biens immobiliers et matériels roulants de grand standing au Gabon.',
  explanation:
    'Le Corner VIP rassemble les offres immobilières de standing (dès 75M FCFA à la vente ou 1M FCFA/mois en location) et les véhicules ou engins de prestige (dès 25M FCFA à la vente ou 50 000 FCFA/jour). Les annonces qualifiées y sont intégrées automatiquement sans aucun frais supplémentaire pour l\'annonceur.',
  freeOfChargeNotice: 'Placement offert sans aucun frais',
};
