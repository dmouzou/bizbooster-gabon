import { PRICING_CONFIG } from '../data/categoriesData';
import { SubscriptionTier } from '../types';

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

export function formatRemainingTime(expiresAtIso: string): {
  isExpired: boolean;
  label: string;
  days: number;
  hours: number;
} {
  const now = Date.now();
  const expires = new Date(expiresAtIso).getTime();
  const diffMs = expires - now;

  if (diffMs <= 0) {
    return {
      isExpired: true,
      label: 'Expirée',
      days: 0,
      hours: 0
    };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return {
      isExpired: false,
      label: `${days}j ${hours}h restants`,
      days,
      hours
    };
  }

  return {
    isExpired: false,
    label: `${hours}h restantes`,
    days: 0,
    hours
  };
}

/**
 * Nombre de photos gratuites incluses par niveau d'utilisateur (Point 10) :
 * - Standard : 3 photos
 * - Pro : 3 photos
 * - Élite : 4 photos
 * - Business : 5 photos
 */
export function getTierFreePhotosCount(tier?: SubscriptionTier): number {
  switch (tier) {
    case 'BUSINESS':
      return 5;
    case 'ELITE':
      return 4;
    case 'PRO':
    case 'STANDARD':
    default:
      return 3;
  }
}

export function calculateBill(
  durationDays: number,
  photoCount: number,
  hasVideo: boolean,
  subscriptionTier?: SubscriptionTier
): {
  basePrice: number;
  includedPhotos: number;
  extraPhotosCount: number;
  extraPhotosCost: number;
  videoCost: number;
  total: number;
} {
  const durationItem = PRICING_CONFIG.durations.find((d) => d.days === durationDays) || PRICING_CONFIG.durations[1];
  const basePrice = durationItem.price;

  const includedPhotos = getTierFreePhotosCount(subscriptionTier);
  const extraPhotosCount = Math.max(0, photoCount - includedPhotos);
  const extraPhotosCost = extraPhotosCount * PRICING_CONFIG.pricePerExtraImage;

  // Tarification vidéo descriptive (Point 10) :
  // - Standard / Pro : Plein tarif (2 000 FCFA)
  // - Élite : Réduction de 50% (1 000 FCFA)
  // - Business : 100% Gratuite (0 FCFA)
  let videoCost = 0;
  if (hasVideo) {
    if (subscriptionTier === 'BUSINESS') {
      videoCost = 0;
    } else if (subscriptionTier === 'ELITE') {
      videoCost = Math.round(PRICING_CONFIG.videoPrice * 0.5);
    } else {
      videoCost = PRICING_CONFIG.videoPrice;
    }
  }

  const total = basePrice + extraPhotosCost + videoCost;

  return {
    basePrice,
    includedPhotos,
    extraPhotosCount,
    extraPhotosCost,
    videoCost,
    total
  };
}

export function cleanGabonPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function getWhatsAppUrl(phone: string, adTitle: string): string {
  let cleaned = phone.replace(/[^\d]/g, '');
  if (!cleaned.startsWith('241') && cleaned.length >= 7) {
    if (cleaned.startsWith('0')) {
      cleaned = '241' + cleaned.substring(1);
    } else {
      cleaned = '241' + cleaned;
    }
  }
  const text = encodeURIComponent(
    `Bonjour, je vous contacte depuis BIZBOOSTER concernant votre annonce : "${adTitle}". Est-elle toujours disponible ?`
  );
  return `https://wa.me/${cleaned}?text=${text}`;
}

export function isAdOwner(
  ad: { userId?: string; contactPhone?: string },
  user: { id?: string; contactPhone?: string } | null
): boolean {
  if (!user) return false;
  if (ad.userId && user.id && ad.userId === user.id) return true;

  const phoneToTest = ad.contactPhone;
  if (phoneToTest && user.contactPhone) {
    const cleanAdPhone = phoneToTest.replace(/[^\d]/g, '');
    const cleanUserPhone = user.contactPhone.replace(/[^\d]/g, '');
    if (cleanAdPhone && cleanUserPhone) {
      if (cleanAdPhone === cleanUserPhone) return true;
      if (cleanAdPhone.endsWith(cleanUserPhone.slice(-8)) || cleanUserPhone.endsWith(cleanAdPhone.slice(-8))) {
        return true;
      }
    }
  }
  return false;
}

// Point 1: Utilitaires pour les offres et demandes d'emploi (EMPLOI & AUTRES_EMPLOIS)
export function isJobAd(ad: { mainCategory: string }): boolean {
  return ad.mainCategory === 'EMPLOI' || ad.mainCategory === 'AUTRES_EMPLOIS';
}

export function isJobSeekerAd(ad: {
  mainCategory?: string;
  jobKind?: string;
  transactionType?: string;
  autresEmploisData?: { subCategory?: string };
}): boolean {
  if (ad.autresEmploisData?.subCategory === "Demandeur d'emploi" || (ad.autresEmploisData?.subCategory as any) === 'DEMANDE_EMPLOI') return true;
  if (ad.jobKind === 'DEMANDE' || (ad.jobKind as any) === 'DEMANDE_EMPLOI') return true;
  if (ad.transactionType === 'CHERCHE_EMPLOI' || (ad.transactionType as any) === 'DEMANDE') return true;
  return false;
}

export function formatPriceDisplay(price: number, priceMax?: number): string {
  if (priceMax && priceMax > price) {
    return `${new Intl.NumberFormat('fr-FR').format(price)} - ${new Intl.NumberFormat('fr-FR').format(priceMax)} FCFA`;
  }
  return formatFCFA(price);
}

export function getPriceOrSalaryLabel(ad: {
  mainCategory: string;
  jobKind?: string;
  transactionType?: string;
  autresEmploisData?: { subCategory?: string };
}): string {
  if (isJobAd(ad)) {
    return isJobSeekerAd(ad) ? 'Salaire désiré' : 'Salaire proposé';
  }
  return 'Prix demandé';
}

export function formatPriceUnit(priceUnit?: string, isJob?: boolean): string {
  if (!priceUnit || priceUnit === 'total') return '';
  if (isJob) {
    if (priceUnit === 'mois') return '/ mois';
    if (priceUnit === 'jour') return '/ jour';
  }
  if (priceUnit === 'mois') return '/ mois';
  if (priceUnit === 'jour') return '/ jour';
  return `/${priceUnit}`;
}

export interface AdBadgeDetails {
  label: string;
  badgeClass: string;
  cardBadgeClass: string;
}

export function getAdTransactionBadge(ad?: {
  mainCategory?: string;
  transactionType?: string;
  jobKind?: string;
  jobOfferType?: string;
  jobType?: string;
  autresEmploisData?: { subCategory?: string };
  tutoringData?: { kind?: string };
  courseType?: string;
} | null): AdBadgeDetails {
  if (!ad) {
    return {
      label: 'À VENDRE',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
      cardBadgeClass: 'bg-amber-500 text-slate-950 ring-1 ring-amber-400',
    };
  }

  const cat = ad.mainCategory;

  // 1. Emploi & Autres Emplois
  if (cat === 'EMPLOI' || cat === 'AUTRES_EMPLOIS') {
    const isDemand =
      ad.jobKind === 'DEMANDE' ||
      ad.jobKind === 'DEMANDE_EMPLOI' ||
      ad.transactionType === 'CHERCHE_EMPLOI' ||
      ad.transactionType === 'DEMANDE' ||
      ad.autresEmploisData?.subCategory === "Demandeur d'emploi" ||
      (ad.autresEmploisData?.subCategory as any) === 'DEMANDE_EMPLOI';

    if (isDemand) {
      return {
        label: "DEMANDE D'EMPLOI",
        badgeClass: 'bg-teal-100 text-teal-900 border border-teal-300',
        cardBadgeClass: 'bg-teal-600 text-white ring-1 ring-teal-400',
      };
    }
    return {
      label: "OFFRE D'EMPLOI",
      badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300',
      cardBadgeClass: 'bg-purple-600 text-white ring-1 ring-purple-400',
    };
  }

  // 2. Avis de Recherche
  if (cat === 'AVIS_DE_RECHERCHE') {
    return {
      label: 'AVIS DE RECHERCHE',
      badgeClass: 'bg-red-100 text-red-900 border border-red-300',
      cardBadgeClass: 'bg-red-600 text-white ring-1 ring-red-400',
    };
  }

  // 3. Nécrologie
  if (cat === 'NECROLOGIE') {
    return {
      label: "AVIS D'OBSÈQUES",
      badgeClass: 'bg-slate-900 text-white border border-slate-700',
      cardBadgeClass: 'bg-slate-950 text-white ring-1 ring-slate-700',
    };
  }

  // 4. Cours à Domicile
  if (cat === 'COURS_A_DOMICILE') {
    const isDemand = ad.tutoringData?.kind === 'DEMANDE' || ad.courseType === 'DEMANDE';
    if (isDemand) {
      return {
        label: 'DEMANDE DE COURS',
        badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300',
        cardBadgeClass: 'bg-purple-600 text-white ring-1 ring-purple-400',
      };
    }
    return {
      label: 'OFFRE DE COURS',
      badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-300',
      cardBadgeClass: 'bg-indigo-600 text-white ring-1 ring-indigo-400',
    };
  }

  // 5. Prestations & Services
  if (cat === 'PRESTATIONS_SERVICES') {
    return {
      label: 'PRESTATION DE SERVICE',
      badgeClass: 'bg-sky-100 text-sky-900 border border-sky-300',
      cardBadgeClass: 'bg-sky-600 text-white ring-1 ring-sky-400',
    };
  }

  // 6. Événements
  if (cat === 'EVENEMENTS') {
    return {
      label: 'ÉVÉNEMENT',
      badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-300',
      cardBadgeClass: 'bg-fuchsia-600 text-white ring-1 ring-fuchsia-400',
    };
  }

  // 7. Bric-à-Brac
  if (cat === 'BRIC_A_BRAC') {
    return {
      label: 'À VENDRE',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
      cardBadgeClass: 'bg-amber-500 text-slate-950 ring-1 ring-amber-400',
    };
  }

  // 8. General / Real Estate / Vehicles / Multimedia / etc.
  if (ad.transactionType === 'LOCATION') {
    return {
      label: 'À LOUER',
      badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
      cardBadgeClass: 'bg-emerald-600 text-white ring-1 ring-emerald-400',
    };
  }

  return {
    label: 'À VENDRE',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
    cardBadgeClass: 'bg-amber-500 text-slate-950 ring-1 ring-amber-400',
  };
}
