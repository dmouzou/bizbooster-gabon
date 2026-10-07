import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
 * Récupère l'ensemble des IDs de notifications déjà envoyées/affichées à l'utilisateur.
 * Synchronise les données enregistrées dans Firestore (users/{userId}) avec le cache local.
 */
export async function fetchSeenNotificationIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();

  // 1. Initialisation synchrone immédiate
  const seenSet = getLocalSeenNotificationIds(userId);

  // 2. Synchronisation avec Firestore pour garantir la persistance multi-appareils
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const firestoreIds: string[] = data?.seenNotificationIds || [];
      firestoreIds.forEach((id) => seenSet.add(String(id)));

      // Mettre à jour le cache local avec la fusion
      try {
        localStorage.setItem(
          `${LOCAL_STORAGE_PREFIX}${userId}`,
          JSON.stringify(Array.from(seenSet))
        );
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[NotificationService] Erreur synchronisation Firestore:', err);
  }

  return seenSet;
}

/**
 * Sauvegarde de façon atomique et permanente l'envoi d'une notification dans Firebase :
 * 1. Enregistrement synchrone immédiat dans localStorage (immunité totale au reload)
 * 2. Ajout de l'ID dans `seenNotificationIds` du document utilisateur (`users/{userId}`) via arrayUnion
 * 3. Enregistrement d'un document d'audit dans la collection `user_notifications`
 * Cela garantit zéro répétition intempestive lors des reconnexions ou rechargements de page.
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
  if (!userId || !notif.id) return;

  // 1. Sauvegarde locale SYNCHRONE immédiate
  markNotificationAsSeenLocally(userId, notif.id);

  // 2. Sauvegarde persistante dans Firebase
  try {
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        seenNotificationIds: arrayUnion(notif.id),
      });
    } catch (_) {
      await setDoc(
        userRef,
        {
          seenNotificationIds: arrayUnion(notif.id),
        },
        { merge: true }
      );
    }

    // 3. Document de log détaillé dans `user_notifications`
    try {
      const logDocRef = doc(db, 'user_notifications', `${userId}_${notif.id}`);
      const logData: PersistedNotificationLog = {
        id: notif.id,
        userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        adId: notif.adId || null,
        dispatchedAt: new Date().toISOString(),
        timestamp: Date.now(),
        status: 'DISPATCHED',
      };

      await setDoc(logDocRef, logData, { merge: true });
    } catch (logErr) {
      console.warn('[NotificationService] Erreur écriture log audit notification:', logErr);
    }
  } catch (err) {
    console.warn('[NotificationService] Erreur écriture Firestore notification:', err);
  }
}
