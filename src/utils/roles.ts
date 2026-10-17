export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

/**
 * Normalisateur canonique unique pour les rôles BIZBOOSTER.
 * Accepte les variantes historiques ('admin', 'ADMIN', 'super-admin', 'SUPER_ADMIN', etc.)
 * et retourne strictement 'USER' | 'ADMIN' | 'SUPER_ADMIN'.
 */
export function normalizeRole(raw?: string | null): UserRole {
  if (!raw) return 'USER';
  const cleaned = String(raw).trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (cleaned === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (cleaned === 'ADMIN') return 'ADMIN';
  return 'USER';
}
