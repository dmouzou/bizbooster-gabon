import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { Ad, UserProfile } from '../types';

export interface FirebaseQuotaComparison {
  // SMS Phone Auth
  smsSentToday: number;
  smsSentAllTime: number;
  smsDailyQuota: number; // 10 SMS/jour (Plan Spark)
  smsExcessCount: number; // au-delà de 10
  smsExtraUnitPriceUSD: number; // $0.21 / SMS
  smsAccruedCostUSD: number;
  smsAccruedCostFCFA: number;
  isSmsQuotaExceeded: boolean;

  // Firebase Storage
  totalStorageBytes: number;
  totalStorageGB: number;
  storageFreeTierGB: number; // 5.0 GB
  storageExcessGB: number;
  storageExtraUnitPriceUSD: number; // $0.026 / GB / mois
  storageAccruedCostUSD: number;
  storageAccruedCostFCFA: number;
  isStorageQuotaExceeded: boolean;

  // Total Download Requests & Bandwidth
  totalDownloadRequests: number;
  totalDownloadBandwidthGB: number;
  downloadFreeTierOpsPerDay: number; // 50 000 requêtes
  downloadFreeTierBandwidthGB: number; // 1.0 GB / jour
  downloadExcessGB: number;
  downloadAccruedCostUSD: number;
  downloadAccruedCostFCFA: number;
  isDownloadQuotaExceeded: boolean;

  // Global Accrued Costs
  totalAccruedCostUSD: number;
  totalAccruedCostFCFA: number;
  isAnyQuotaExceeded: boolean;
  alerts: string[];
}

const FCFA_EXCHANGE_RATE = 615; // 1 USD ≈ 615 FCFA (XAF)

// Local storage keys
const SMS_SENT_TODAY_KEY = 'bizbooster_sms_sent_today';
const SMS_SENT_DATE_KEY = 'bizbooster_sms_sent_date';
const SMS_SENT_ALL_TIME_KEY = 'bizbooster_sms_sent_all_time';
const DOWNLOAD_REQUESTS_KEY = 'bizbooster_download_requests_count';
const DOWNLOAD_BANDWIDTH_BYTES_KEY = 'bizbooster_download_bandwidth_bytes';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Numéros de téléphone de test déclarés dans Firebase Authentication
 * (Ces numéros ne consomment pas de SMS réels et sont 100% gratuits).
 */
export const FIREBASE_TEST_PHONE_NUMBERS = [
  '+24177905165',
  '+24177000000',
  '+24166000000',
  '+24174000000',
  '+24101010101',
  '+24100000000',
  '+24111111111',
  '+24177112233',
  '+24177452018',
];

export function isFirebaseTestPhoneNumber(phone?: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[^0-9+]/g, '');
  const digits = clean.replace(/[^0-9]/g, '');

  if (FIREBASE_TEST_PHONE_NUMBERS.some((testNum) => clean === testNum || digits === testNum.replace(/[^0-9]/g, ''))) {
    return true;
  }
  if (/(\d)\1{5,}/.test(digits)) return true;
  if (digits.endsWith('000000') || digits.endsWith('123456')) return true;
  return false;
}

/**
 * Enregistre un envoi de SMS OTP (authentification ou renouvellement mot de passe).
 * N'incrémente PAS le compteur pour les numéros de test Firebase Authentication (gratuits).
 */
export async function trackSmsSent(phoneNumber?: string): Promise<{ today: number; allTime: number }> {
  // Exclusion formelle des numéros de test Firebase
  if (isFirebaseTestPhoneNumber(phoneNumber)) {
    const currentToday = Number(localStorage.getItem(SMS_SENT_TODAY_KEY) || '0');
    const currentAllTime = Number(localStorage.getItem(SMS_SENT_ALL_TIME_KEY) || '0');
    return { today: currentToday, allTime: currentAllTime };
  }

  const today = getTodayString();
  const metricsRef = doc(db, 'system_counters', 'scalability_metrics');
  let finalToday = 1;
  let finalAllTime = 1;

  try {
    const snap = await getDoc(metricsRef);
    if (snap.exists()) {
      const data = snap.data();
      const isSameDay = data.todayDate === today;
      finalToday = isSameDay ? (Number(data.smsSentToday) || 0) + 1 : 1;
      finalAllTime = (Number(data.smsSentAllTime) || 0) + 1;
      await setDoc(
        metricsRef,
        {
          todayDate: today,
          smsSentToday: finalToday,
          smsSentAllTime: finalAllTime,
          lastSmsSentAt: new Date().toISOString(),
          lastSmsRecipient: phoneNumber || 'unknown',
        },
        { merge: true }
      );
    } else {
      await setDoc(metricsRef, {
        todayDate: today,
        smsSentToday: 1,
        smsSentAllTime: 1,
        lastSmsSentAt: new Date().toISOString(),
        lastSmsRecipient: phoneNumber || 'unknown',
      });
    }
  } catch (err) {
    console.warn('Could not sync SMS metric to Firestore:', err);
  }

  localStorage.setItem(SMS_SENT_DATE_KEY, today);
  localStorage.setItem(SMS_SENT_TODAY_KEY, String(finalToday));
  localStorage.setItem(SMS_SENT_ALL_TIME_KEY, String(finalAllTime));
  window.dispatchEvent(new Event('bizbooster_metric_updated'));

  return { today: finalToday, allTime: finalAllTime };
}

/**
 * Enregistre une requête de téléchargement (téléchargement CV, fiche de poste, rapport PDF, export, aperçu document).
 * Met à jour à la fois le cache local et le document Firestore scalability_metrics de manière atomique.
 */
export async function trackDownloadRequest(estimatedBytes = 250000): Promise<number> {
  const rawReq = localStorage.getItem(DOWNLOAD_REQUESTS_KEY);
  const currentRequests = rawReq && rawReq !== '85' && rawReq !== '240' ? Number(rawReq) : 0;
  const nextRequests = currentRequests + 1;
  localStorage.setItem(DOWNLOAD_REQUESTS_KEY, String(nextRequests));

  const rawBytes = localStorage.getItem(DOWNLOAD_BANDWIDTH_BYTES_KEY);
  const currentBytes = rawBytes && rawBytes !== '24500000' && rawBytes !== '185000000' ? Number(rawBytes) : 0;
  const nextBytes = currentBytes + estimatedBytes;
  localStorage.setItem(DOWNLOAD_BANDWIDTH_BYTES_KEY, String(nextBytes));

  try {
    const metricsRef = doc(db, 'system_counters', 'scalability_metrics');
    await setDoc(
      metricsRef,
      {
        totalDownloadRequests: increment(1),
        totalDownloadBandwidthBytes: increment(estimatedBytes),
        lastDownloadAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not sync download metric to Firestore:', err);
  }

  window.dispatchEvent(new Event('bizbooster_metric_updated'));
  return nextRequests;
}

/**
 * Réinitialise le compteur de téléchargements et de bande passante à 0.
 */
export async function resetDownloadCounters(): Promise<{ requests: number; bytes: number }> {
  localStorage.setItem(DOWNLOAD_REQUESTS_KEY, '0');
  localStorage.setItem(DOWNLOAD_BANDWIDTH_BYTES_KEY, '0');

  try {
    const metricsRef = doc(db, 'system_counters', 'scalability_metrics');
    await setDoc(
      metricsRef,
      {
        totalDownloadRequests: 0,
        totalDownloadBandwidthBytes: 0,
        lastDownloadResetAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not reset download metrics in Firestore:', err);
  }

  window.dispatchEvent(new Event('bizbooster_metric_updated'));
  return { requests: 0, bytes: 0 };
}

/**
 * Calcule la taille totale en octets des fichiers stockés dans Firebase Storage
 * (images d'annonces, vidéos, CV, fiches de poste, documents KYC).
 */
export function calculateTotalStorageBytes(ads: Ad[], users: UserProfile[] = []): number {
  let totalBytes = 0;

  // Base du bucket (assets système, presets)
  totalBytes += 18 * 1024 * 1024; // 18 Mo de base

  for (const ad of ads) {
    // Images : moyenne ~1.4 Mo par photo stockée
    const imgCount = (ad.images && ad.images.length) || 0;
    totalBytes += imgCount * 1450000;

    // Vidéo descriptive
    if (ad.videoUrl) {
      totalBytes += 12 * 1024 * 1024; // ~12 Mo
    }

    // CV ou Document de poste
    if (ad.cvFileSize && ad.cvFileSize > 0) {
      totalBytes += ad.cvFileSize;
    } else if (ad.cvUrl || ad.jobDocUrl) {
      totalBytes += 220000; // ~220 Ko par défaut
    }
  }

  // Documents KYC des utilisateurs
  for (const user of users) {
    if (user.idDocumentUrl) {
      totalBytes += 2200000; // ~2.2 Mo par justificatif d'identité
    }
  }

  return totalBytes;
}

/**
 * Réinitialise le compteur de SMS à 0 (demande utilisateur).
 * Met à jour à la fois le cache local et le document Firestore scalability_metrics.
 */
export async function resetSmsCounters(): Promise<{ today: number; allTime: number }> {
  const today = getTodayString();
  localStorage.setItem(SMS_SENT_DATE_KEY, today);
  localStorage.setItem(SMS_SENT_TODAY_KEY, '0');
  localStorage.setItem(SMS_SENT_ALL_TIME_KEY, '0');

  try {
    const metricsRef = doc(db, 'system_counters', 'scalability_metrics');
    await setDoc(
      metricsRef,
      {
        lastSmsResetAt: new Date().toISOString(),
        todayDate: today,
        smsSentToday: 0,
        smsSentAllTime: 0,
      },
      { merge: true }
    );
  } catch (err) {
    // ignore
  }

  window.dispatchEvent(new Event('bizbooster_metric_updated'));
  return { today: 0, allTime: 0 };
}

/**
 * Génère le comparatif complet avec le forfait gratuit de Firebase (Spark)
 * et calcule les frais supplémentaires encourus (Blaze).
 */
export function getFirebaseQuotaComparison(
  ads: Ad[],
  users: UserProfile[] = [],
  liveMetrics?: {
    smsSentToday?: number;
    smsSentAllTime?: number;
    totalDownloadRequests?: number;
    totalDownloadBandwidthBytes?: number;
  }
): FirebaseQuotaComparison {
  const today = getTodayString();
  const savedDate = localStorage.getItem(SMS_SENT_DATE_KEY);

  // 1. SMS (Priorité aux métriques Firestore temps réel si disponibles)
  let smsSentToday = 0;
  let smsSentAllTime = 0;

  if (liveMetrics?.smsSentToday !== undefined) {
    smsSentToday = liveMetrics.smsSentToday;
    smsSentAllTime = liveMetrics.smsSentAllTime ?? 0;
  } else {
    if (savedDate === today) {
      const rawToday = localStorage.getItem(SMS_SENT_TODAY_KEY);
      smsSentToday = rawToday && rawToday !== '12' ? Number(rawToday) : 0;
    } else {
      smsSentToday = 0;
    }
    const rawAllTime = localStorage.getItem(SMS_SENT_ALL_TIME_KEY);
    smsSentAllTime = rawAllTime && rawAllTime !== '154' ? Number(rawAllTime) : 0;
  }

  const smsDailyQuota = 10;
  const smsExcessCount = Math.max(0, smsSentToday - smsDailyQuota);
  const smsExtraUnitPriceUSD = 0.21;
  const smsAccruedCostUSD = Number((smsExcessCount * smsExtraUnitPriceUSD).toFixed(2));
  const smsAccruedCostFCFA = Math.round(smsAccruedCostUSD * FCFA_EXCHANGE_RATE);
  const isSmsQuotaExceeded = smsExcessCount > 0;

  // 2. Storage
  const totalStorageBytes = calculateTotalStorageBytes(ads, users);
  const totalStorageGB = Number((totalStorageBytes / (1024 * 1024 * 1024)).toFixed(3));
  const storageFreeTierGB = 5.0; // 5 Go inclus
  const storageExcessGB = Number(Math.max(0, totalStorageGB - storageFreeTierGB).toFixed(3));
  const storageExtraUnitPriceUSD = 0.026; // $0.026 / GB
  const storageAccruedCostUSD = Number((storageExcessGB * storageExtraUnitPriceUSD).toFixed(3));
  const storageAccruedCostFCFA = Math.round(storageAccruedCostUSD * FCFA_EXCHANGE_RATE);
  const isStorageQuotaExceeded = storageExcessGB > 0;

  // 3. Downloads & Operations (Priorité aux métriques Firestore temps réel si disponibles)
  let totalDownloadRequests = 0;
  let bandwidthBytes = 0;

  if (liveMetrics?.totalDownloadRequests !== undefined) {
    totalDownloadRequests = liveMetrics.totalDownloadRequests;
    bandwidthBytes = liveMetrics.totalDownloadBandwidthBytes ?? 0;
  } else {
    const rawReq = localStorage.getItem(DOWNLOAD_REQUESTS_KEY);
    totalDownloadRequests = rawReq && rawReq !== '85' && rawReq !== '240' ? Number(rawReq) : 0;
    const rawBytes = localStorage.getItem(DOWNLOAD_BANDWIDTH_BYTES_KEY);
    bandwidthBytes = rawBytes && rawBytes !== '24500000' && rawBytes !== '185000000' ? Number(rawBytes) : 0;
  }

  const totalDownloadBandwidthGB = Number((bandwidthBytes / (1024 * 1024 * 1024)).toFixed(3));
  const downloadFreeTierOpsPerDay = 50000;
  const downloadFreeTierBandwidthGB = 1.0; // 1 Go/jour gratuit
  const downloadExcessGB = Number(Math.max(0, totalDownloadBandwidthGB - downloadFreeTierBandwidthGB).toFixed(3));
  const downloadExtraUnitPriceUSD = 0.12; // $0.12 / GB
  const downloadAccruedCostUSD = Number((downloadExcessGB * downloadExtraUnitPriceUSD).toFixed(3));
  const downloadAccruedCostFCFA = Math.round(downloadAccruedCostUSD * FCFA_EXCHANGE_RATE);
  const isDownloadQuotaExceeded = downloadExcessGB > 0 || totalDownloadRequests > downloadFreeTierOpsPerDay;

  // Total
  const totalAccruedCostUSD = Number((smsAccruedCostUSD + storageAccruedCostUSD + downloadAccruedCostUSD).toFixed(2));
  const totalAccruedCostFCFA = Math.round(totalAccruedCostUSD * FCFA_EXCHANGE_RATE);
  const isAnyQuotaExceeded = isSmsQuotaExceeded || isStorageQuotaExceeded || isDownloadQuotaExceeded;

  const alerts: string[] = [];
  if (isSmsQuotaExceeded) {
    alerts.push(
      `Quota SMS gratuit dépassé : ${smsSentToday} SMS envoyés aujourd'hui (${smsExcessCount} supplémentaires). Frais SMS : $${smsAccruedCostUSD.toFixed(2)} USD (${smsAccruedCostFCFA.toLocaleString('fr-FR')} FCFA).`
    );
  }
  if (isStorageQuotaExceeded) {
    alerts.push(
      `Quota Cloud Storage dépassé : ${totalStorageGB} Go utilisés (${storageExcessGB} Go excédentaires au-delà des 5 Go gratuits). Frais : $${storageAccruedCostUSD.toFixed(2)} USD.`
    );
  }
  if (isDownloadQuotaExceeded) {
    alerts.push(
      `Bande passante téléchargement dépassée : ${totalDownloadBandwidthGB} Go transférés au-delà du quota journalier d'1 Go.`
    );
  }

  return {
    smsSentToday,
    smsSentAllTime,
    smsDailyQuota,
    smsExcessCount,
    smsExtraUnitPriceUSD,
    smsAccruedCostUSD,
    smsAccruedCostFCFA,
    isSmsQuotaExceeded,

    totalStorageBytes,
    totalStorageGB,
    storageFreeTierGB,
    storageExcessGB,
    storageExtraUnitPriceUSD,
    storageAccruedCostUSD,
    storageAccruedCostFCFA,
    isStorageQuotaExceeded,

    totalDownloadRequests,
    totalDownloadBandwidthGB,
    downloadFreeTierOpsPerDay,
    downloadFreeTierBandwidthGB,
    downloadExcessGB,
    downloadAccruedCostUSD,
    downloadAccruedCostFCFA,
    isDownloadQuotaExceeded,

    totalAccruedCostUSD,
    totalAccruedCostFCFA,
    isAnyQuotaExceeded,
    alerts,
  };
}
