import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';

export interface PasswordCooldownResult {
  isBlocked: boolean;
  remainingHours: number;
  lastPasswordChangeDate?: string;
}

/**
 * Normalizes any Gabon phone number into its different representations:
 * - digits8: e.g. "77452018"
 * - digits241: e.g. "24177452018"
 * - e164: e.g. "+24177452018"
 */
export function normalizePhoneVariants(raw: string) {
  let clean = (raw || '').replace(/\D/g, '');
  if (clean.startsWith('241')) clean = clean.slice(3);
  if (clean.startsWith('0')) clean = clean.slice(1);
  const digits8 = clean;
  const digits241 = `241${clean}`;
  const e164 = `+241${clean}`;
  return { digits8, digits241, e164 };
}

/**
 * Records that a password change has occurred for this phone number.
 * Saves to localStorage under all key variants, updates the registry,
 * and syncs with Firestore settings/pwd_cooldown_* if authenticated.
 */
export async function recordPasswordCooldown(rawPhone: string, isoTimestamp?: string): Promise<void> {
  if (!rawPhone) return;
  const nowIso = isoTimestamp || new Date().toISOString();
  const { digits8, digits241, e164 } = normalizePhoneVariants(rawPhone);

  // 1. Save in localStorage for all variants
  try {
    localStorage.setItem(`bizbooster_last_pwd_change_${digits8}`, nowIso);
    localStorage.setItem(`bizbooster_last_pwd_change_${digits241}`, nowIso);
    localStorage.setItem(`bizbooster_last_pwd_change_${e164}`, nowIso);

    // Save in global registry
    const rawRegistry = localStorage.getItem('bizbooster_pwd_cooldown_registry');
    const registry = rawRegistry ? JSON.parse(rawRegistry) : {};
    registry[digits8] = nowIso;
    registry[digits241] = nowIso;
    registry[e164] = nowIso;
    localStorage.setItem('bizbooster_pwd_cooldown_registry', JSON.stringify(registry));
  } catch (err) {
    console.warn('localStorage password cooldown record warning:', err);
  }

  // 2. Sync to Firestore (allowed for signed-in users on settings/{settingId})
  try {
    await setDoc(
      doc(db, 'settings', `pwd_cooldown_${digits8}`),
      {
        lastPasswordChangeDate: nowIso,
        phone: e164,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  } catch (err) {
    // Non-fatal if unauthenticated or network error
    console.warn('Firestore password cooldown write warning:', err);
  }
}

/**
 * Checks if a user has changed their password within the last 24 hours.
 * Inspects all localStorage variants, Firestore public settings doc, and Cloud Functions.
 */
export async function checkPasswordCooldown(rawPhone: string): Promise<PasswordCooldownResult> {
  if (!rawPhone) return { isBlocked: false, remainingHours: 0 };
  const { digits8, digits241, e164 } = normalizePhoneVariants(rawPhone);

  let candidateDate: string | null = null;

  // 1. Check all possible localStorage keys
  try {
    const keys = [
      `bizbooster_last_pwd_change_${digits8}`,
      `bizbooster_last_pwd_change_${digits241}`,
      `bizbooster_last_pwd_change_${e164}`,
    ];
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val) {
        candidateDate = val;
        break;
      }
    }

    if (!candidateDate) {
      const rawRegistry = localStorage.getItem('bizbooster_pwd_cooldown_registry');
      if (rawRegistry) {
        const registry = JSON.parse(rawRegistry);
        if (registry[digits8]) candidateDate = registry[digits8];
        else if (registry[digits241]) candidateDate = registry[digits241];
        else if (registry[e164]) candidateDate = registry[e164];
      }
    }
  } catch (err) {
    console.warn('localStorage check warning:', err);
  }

  // 2. Check Firestore /settings/pwd_cooldown_* (public read allowed by security rules)
  if (!candidateDate) {
    try {
      const snap = await getDoc(doc(db, 'settings', `pwd_cooldown_${digits8}`));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.lastPasswordChangeDate) {
          candidateDate = data.lastPasswordChangeDate;
        }
      }
    } catch (err) {
      console.warn('Firestore check warning:', err);
    }
  }

  // 3. Fallback to Cloud Function checkPasswordResetEligibility if available
  if (!candidateDate) {
    try {
      const checkFn = httpsCallable(functions, 'checkPasswordResetEligibility');
      const res = await checkFn({ phoneNumber: e164 });
      const data = res.data as { allowed: boolean; remainingHours: number; lastPasswordChangeDate?: string };
      if (!data.allowed) {
        if (data.lastPasswordChangeDate) {
          candidateDate = data.lastPasswordChangeDate;
        } else {
          return {
            isBlocked: true,
            remainingHours: data.remainingHours || 24,
          };
        }
      }
    } catch {
      // Cloud Function might not be deployed or failed
    }
  }

  // Evaluate candidateDate
  if (candidateDate) {
    const lastTime = new Date(candidateDate).getTime();
    if (!isNaN(lastTime)) {
      const diffMs = Date.now() - lastTime;
      const dayMs = 24 * 3600 * 1000;
      if (diffMs < dayMs) {
        const remainingHours = Math.max(1, Math.ceil((dayMs - diffMs) / (3600 * 1000)));
        return {
          isBlocked: true,
          remainingHours,
          lastPasswordChangeDate: candidateDate,
        };
      }
    }
  }

  return { isBlocked: false, remainingHours: 0 };
}
