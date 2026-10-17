import { describe, it, expect } from 'vitest';
import { normalizeRole, isUserAdmin, isUserSuperAdmin } from '../src/types';

describe('Role Normalization and Authorization (Étape 1.5 - S-12)', () => {
  it('normalise correctement toutes les variantes de rôles', () => {
    expect(normalizeRole('admin')).toBe('ADMIN');
    expect(normalizeRole('ADMIN')).toBe('ADMIN');
    expect(normalizeRole(' Admin ')).toBe('ADMIN');
    expect(normalizeRole('super-admin')).toBe('SUPER_ADMIN');
    expect(normalizeRole('SUPER_ADMIN')).toBe('SUPER_ADMIN');
    expect(normalizeRole('SUPER ADMIN')).toBe('SUPER_ADMIN');
    expect(normalizeRole('superadmin')).toBe('SUPER_ADMIN');
    expect(normalizeRole('user')).toBe('USER');
    expect(normalizeRole('USER')).toBe('USER');
    expect(normalizeRole('')).toBe('USER');
    expect(normalizeRole(undefined)).toBe('USER');
    expect(normalizeRole(null)).toBe('USER');
    expect(normalizeRole('hacker')).toBe('USER');
  });

  it('isUserAdmin valide ADMIN et SUPER_ADMIN quel que soit le format', () => {
    expect(isUserAdmin({ role: 'ADMIN' })).toBe(true);
    expect(isUserAdmin({ role: 'admin' })).toBe(true);
    expect(isUserAdmin({ role: 'SUPER_ADMIN' })).toBe(true);
    expect(isUserAdmin({ role: 'super-admin' })).toBe(true);
    expect(isUserAdmin({ role: 'USER' })).toBe(false);
    expect(isUserAdmin(null)).toBe(false);
  });

  it('isUserSuperAdmin valide uniquement SUPER_ADMIN', () => {
    expect(isUserSuperAdmin({ role: 'SUPER_ADMIN' })).toBe(true);
    expect(isUserSuperAdmin({ role: 'super-admin' })).toBe(true);
    expect(isUserSuperAdmin({ role: 'ADMIN' })).toBe(false);
    expect(isUserSuperAdmin({ role: 'USER' })).toBe(false);
  });
});
