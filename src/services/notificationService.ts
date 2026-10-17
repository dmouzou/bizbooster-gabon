import { doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

const LOCAL_STORAGE_PREFIX = 'bizbooster_seen_notifications_';

export interface PersistedNotificationLog {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  adId?: string | null;
  dispatchedAt: string;
  timestamp: number;
  status: 'DISPATCHED';
}

/**
 * Générateur partagé et déterministe d'identifiant de notification de rejet (B-09).
 * Évite les collisions silencieuses si moderatedAt est identique ou absent.
 */
export function rejectionNotifId(ad: {
  id: string;
  moderatedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}): string {
  const timestamp = ad.moderatedAt || ad.updatedAt || ad.createdAt || 'rejected';
  return `rej_${ad.id}_${timestamp}`;
}

/**
 * Récupération synchrone immédiate du cache local (0ms, aucun délai de promesse)
 * Garantit qu'aucun rechargement de page ne rejoue une notification déjà vue.
 */
export function getLocalSeenNotificationIds(userId: string): Set<string> {
  const seenSet = new Set<string>();
  if (!userId) return seenSet;
  try {
    const localRaw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => seenSet.add(String(id)));
      }
    }
  } catch (err) {
    console.warn('[NotificationService] Erreur lecture sync localStorage:', err);
  }
  return seenSet;
}

/**
 * Enregistrement synchrone immédiat dans le cache local (atomique, instantané).
 */
export function markNotificationAsSeenLocally(userId: string, notifId: string): void {
  if (!userId || !notifId) return;
  try {
    const key = `${LOCAL_STORAGE_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    let ids: string[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) ids = parsed;
      } catch {}
    }
    if (!ids.includes(notifId)) {
      ids.push(notifId);
      localStorage.setItem(key, JSON.stringify(ids));
    }
  } catch (err) {
    console.warn('[NotificationService] Erreur écriture synchrone locale:', err);
  }
}

/**
 * Persistance unique à l'affichage en 1 seul batch atomique (B-06, Étape 2.3).
 * Effectue au plus 2 écritures (1 update users + 1 set user_notifications).
 */
export async function persistSeenOnce(
  userId: string,
  notif: {
    id: string;
    type: string;
    title: string;
    message: string;
    adId?: string | null;
  }
): Promise<void> {
  if (!userId || !notif.id) return;

  // 1. Sauvegarde locale synchrone immédiate
  markNotificationAsSeenLocally(userId, notif.id);

  // 2. Persistance atomique unique en 1 seul batch Firestore
  try {
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      seenNotificationIds: arrayUnion(notif.id),
    });

    const logDocRef = doc(db, 'user_notifications', `${userId}_${notif.id}`);
    batch.set(logDocRef, {
      id: notif.id,
      notifId: notif.id,
      userId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      adId: notif.adId || null,
      dispatchedAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'DISPATCHED',
    });

    await batch.commit();
  } catch (err: any) {
    // Si permission-denied (règle anti-falsification) ou échec réseau temporaire, consigner
    console.warn('[NotificationService] Persistance Firestore batch note:', err?.message || err);
  }
}

/**
 * Alias conservé pour rétrocompatibilité
 */
export async function saveDispatchedNotification(
  userId: string,
  notif: {
    id: string;
    type: string;
    title: string;
    message: string;
    adId?: string;
  }
): Promise<void> {
  return persistSeenOnce(userId, notif);
}
