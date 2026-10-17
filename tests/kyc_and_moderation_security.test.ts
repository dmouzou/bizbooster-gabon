import { describe, it, expect } from 'vitest';
import { isValidStorageUrl, isTestAd, TIER_WEIGHTS, isPriorityTier } from '../src/utils/ads';

describe('Étape 4.4 : Sécurisation KYC & URLs de stockage (S-06, S-14)', () => {
  it('valide uniquement les URLs HTTPS provenant des domaines Google/Firebase Storage', () => {
    // Valid URLs
    expect(isValidStorageUrl('https://firebasestorage.googleapis.com/v0/b/bizbooster.appspot.com/o/kyc%2Fuser1.jpg?alt=media')).toBe(true);
    expect(isValidStorageUrl('https://storage.googleapis.com/bizbooster.appspot.com/kyc/user1.jpg')).toBe(true);
    expect(isValidStorageUrl('https://storage.cloud.google.com/bizbooster.appspot.com/kyc/user1.jpg')).toBe(true);
    expect(isValidStorageUrl('https://bizbooster-gabon.appspot.com/kyc/user1.jpg')).toBe(true);

    // Invalid URLs (SSRF, arbitrary external domains, non-https)
    expect(isValidStorageUrl('http://firebasestorage.googleapis.com/v0/b/bizbooster/o/img.jpg')).toBe(false);
    expect(isValidStorageUrl('https://evil-attacker.com/fake-cni.png')).toBe(false);
    expect(isValidStorageUrl('https://attacker.com/firebasestorage.googleapis.com')).toBe(false);
    expect(isValidStorageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidStorageUrl('')).toBe(false);
    expect(isValidStorageUrl(undefined)).toBe(false);
  });

  it('détecte correctement les annonces de test (B-04)', () => {
    expect(isTestAd({ id: '1', isTest: true } as any)).toBe(true);
    expect(isTestAd({ id: '2', isTest: false } as any)).toBe(false);
    expect(isTestAd({ id: '3' } as any)).toBe(false);
  });

  it('attribue les poids corrects par formule de visibilité', () => {
    expect(TIER_WEIGHTS.BUSINESS).toBe(4);
    expect(TIER_WEIGHTS.ELITE).toBe(3);
    expect(TIER_WEIGHTS.PRO).toBe(2);
    expect(TIER_WEIGHTS.STANDARD).toBe(1);
    expect(isPriorityTier('BUSINESS')).toBe(true);
    expect(isPriorityTier('PRO')).toBe(true);
    expect(isPriorityTier('STANDARD')).toBe(false);
  });
});
