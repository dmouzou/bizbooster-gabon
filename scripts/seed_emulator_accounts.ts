/**
 * Script de création des 5 comptes de test dans les émulateurs Auth et Firestore :
 * 1. Standard (utilisateur standard)
 * 2. Pro (abonné PRO)
 * 3. Business (abonné BUSINESS)
 * 4. Super Admin (rôle SUPER_ADMIN)
 * 5. Admin (rôle ADMIN)
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'bizbooster-gabon';

if (getApps().length === 0) {
  initializeApp({ projectId });
}

const auth = getAuth();
const db = getFirestore();

interface TestUserDef {
  uid: string;
  email: string;
  phoneNumber: string;
  displayName: string;
  role: string;
  subscriptionTier?: 'STANDARD' | 'PRO' | 'ELITE' | 'BUSINESS' | 'VIP';
  freeBoostsRemaining?: number;
  consumedFreeAdsCount?: number;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

const TEST_USERS: TestUserDef[] = [
  {
    uid: 'user_test_standard',
    email: 'standard@bizbooster.ga',
    phoneNumber: '+24160000001',
    displayName: 'Utilisateur Standard',
    role: 'USER',
    subscriptionTier: 'STANDARD',
    freeBoostsRemaining: 0,
    consumedFreeAdsCount: 0,
  },
  {
    uid: 'user_test_pro',
    email: 'pro@bizbooster.ga',
    phoneNumber: '+24160000002',
    displayName: 'Utilisateur Pro',
    role: 'USER',
    subscriptionTier: 'PRO',
    freeBoostsRemaining: 2,
    consumedFreeAdsCount: 0,
  },
  {
    uid: 'user_test_business',
    email: 'business@bizbooster.ga',
    phoneNumber: '+24160000003',
    displayName: 'Utilisateur Business',
    role: 'USER',
    subscriptionTier: 'BUSINESS',
    freeBoostsRemaining: 6,
    consumedFreeAdsCount: 0,
  },
  {
    uid: 'user_test_superadmin',
    email: 'superadmin@bizbooster.ga',
    phoneNumber: '+24160000004',
    displayName: 'Super Admin',
    role: 'SUPER_ADMIN',
    subscriptionTier: 'VIP',
    isSuperAdmin: true,
  },
  {
    uid: 'user_test_admin',
    email: 'admin@bizbooster.ga',
    phoneNumber: '+24160000005',
    displayName: 'Admin Simple',
    role: 'ADMIN',
    isAdmin: true,
  },
];

async function seed() {
  console.log('Seeding test accounts into Auth and Firestore...');
  const now = new Date().toISOString();

  for (const u of TEST_USERS) {
    // 1. Auth user
    try {
      await auth.getUser(u.uid);
      console.log(`Auth user ${u.uid} already exists.`);
    } catch {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        phoneNumber: u.phoneNumber,
        displayName: u.displayName,
        password: 'Password123!',
      });
      console.log(`Created Auth user: ${u.email} (${u.uid})`);
    }

    // Set custom claims
    await auth.setCustomUserClaims(u.uid, {
      role: u.role,
      isSuperAdmin: Boolean(u.isSuperAdmin),
      isAdmin: Boolean(u.isAdmin || u.isSuperAdmin),
    });

    // 2. Firestore user doc
    const userDocRef = db.collection('users').doc(u.uid);
    const docData: Record<string, unknown> = {
      id: u.uid,
      name: u.displayName,
      email: u.email,
      phoneNumber: u.phoneNumber,
      contactPhone: u.phoneNumber,
      role: u.role,
      isVerified: true,
      termsAccepted: true,
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (u.subscriptionTier) {
      docData.subscriptionTier = u.subscriptionTier;
      docData.subscriptionStartedAt = now;
      docData.subscriptionExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    if (u.freeBoostsRemaining !== undefined) {
      docData.freeBoostsRemaining = u.freeBoostsRemaining;
    }
    if (u.consumedFreeAdsCount !== undefined) {
      docData.consumedFreeAdsCount = u.consumedFreeAdsCount;
    }
    if (u.isSuperAdmin) {
      docData.isSuperAdmin = true;
    }
    if (u.isAdmin) {
      docData.isAdmin = true;
    }

    await userDocRef.set(docData, { merge: true });
    console.log(`Created/updated Firestore document users/${u.uid}`);
  }

  console.log('Successfully seeded 5 test accounts (Standard, Pro, Business, Super Admin, Admin).');
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
