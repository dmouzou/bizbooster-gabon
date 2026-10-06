import { PRICING_CONFIG } from '../data/categoriesData';

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

export function calculateBill(
  durationDays: number,
  photoCount: number,
  hasVideo: boolean
): {
  basePrice: number;
  extraPhotosCount: number;
  extraPhotosCost: number;
  videoCost: number;
  total: number;
} {
  const durationItem = PRICING_CONFIG.durations.find((d) => d.days === durationDays) || PRICING_CONFIG.durations[1];
  const basePrice = durationItem.price;

  const extraPhotosCount = Math.max(0, photoCount - PRICING_CONFIG.includedImages);
  const extraPhotosCost = extraPhotosCount * PRICING_CONFIG.pricePerExtraImage;
  const videoCost = hasVideo ? PRICING_CONFIG.videoPrice : 0;
  const total = basePrice + extraPhotosCost + videoCost;

  return {
    basePrice,
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
    return isJobSeekerAd(ad) ? 'Salaire demandé' : 'Salaire proposé';
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
