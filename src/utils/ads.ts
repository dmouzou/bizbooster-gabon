import { Ad, UserProfile } from '../types';
export { validateEventSchedule, isValidDateString, isValidTimeString, parseEventDateTime } from './eventValidation';

const TEST_AD_ID_PREFIXES = ['test_', 'test-', 'ad-test', 'ad_test', 'demo_', 'demo-'];
const TEST_USER_ID_PREFIXES = ['test_', 'test-', 'user_test_', 'demo_', 'demo-'];

/**
 * isTestAd (B-04 / F1) : Détection robuste des annonces de test / simulation.
 * S'appuie sur le drapeau serveur `ad.isTest` ou sur les préfixes explicites de test/démo.
 * Ne pénalise plus les annonces légitimes contenant 'test' dans leur titre (ex: Testament, Attestation).
 */
export function isTestAd(ad: Ad): boolean {
  if (ad.isTest) return true;
  const id = (ad.id || '').trim().toLowerCase();
  if (TEST_AD_ID_PREFIXES.some((prefix) => id.startsWith(prefix))) return true;
  const uid = (ad.userId || '').trim().toLowerCase();
  if (TEST_USER_ID_PREFIXES.some((prefix) => uid.startsWith(prefix))) return true;
  return false;
}

/**
 * Determines whether an ad is visible in the public catalog.
 * Active, non-expired ads from real users are always visible;
 * test/demo ads are hidden unless showTestAds is enabled.
 */
export function isPublicCatalogAd(ad: Ad, showTestAds: boolean, now: number = Date.now()): boolean {
  if (ad.status !== 'ACTIVE') return false;
  if (!ad.expiresAt) return false;
  const expiresMs = new Date(ad.expiresAt).getTime();
  if (Number.isNaN(expiresMs) || expiresMs <= now) return false;
  if (isEventPast(ad, now)) return false;
  return showTestAds || !isTestAd(ad);
}

/**
 * isEventPast : une annonce Événements dont la date est passée (fin de journée locale) n'est plus affichée au catalogue public.
 */
export function isEventPast(ad: Pick<Ad, 'mainCategory' | 'eventData'>, now: number = Date.now()): boolean {
  if (ad.mainCategory !== 'EVENEMENTS') return false;
  const day = ad.eventData?.eventDate;
  if (!day) return false;
  const endOfDay = new Date(`${day}T23:59:59`).getTime();
  return !Number.isNaN(endOfDay) && endOfDay < now;
}

/**
 * adBelongsToUser (S-16) : Vérification d'appartenance stricte par identifiant utilisateur (userId).
 */
export function adBelongsToUser(ad: Ad, user: UserProfile): boolean {
  if (!user?.id || !ad?.userId) return false;
  return ad.userId === user.id;
}

/**
 * Tables de poids et priorité des forfaits (I-03 partagé)
 */
export const TIER_WEIGHTS: Record<string, number> = {
  BUSINESS: 4,
  ELITE: 3,
  PRO: 2,
  STANDARD: 1,
};

export function isPriorityTier(tier?: string): boolean {
  return tier === 'PRO' || tier === 'ELITE' || tier === 'BUSINESS';
}

/**
 * Motifs prédéfinis de rejet d'annonce (Point 2, I-08)
 */
export const MODERATION_PRESET_REASONS = [
  'Photos non conformes, floues, avec filigranes ou sans rapport avec le bien réel (CGU Art. 2.2).',
  'Prix irréaliste, fictif ou manifestement erroné (ex: 0 FCFA ou 1 FCFA pour tromper les filtres - CGU Art. 2.1).',
  'Non-respect de la catégorie ou description trompeuse / incohérente (CGU Art. 2).',
  'Contenu prohibé ou illicite : bien ou service interdit par la loi gabonaise (armes, stupéfiants, contrefaçons, faune protégée - CGU Art. 2.3).',
  'Propos injurieux, diffamatoires, indécents ou portant atteinte aux bonnes mœurs et à la dignité (CGU Art. 2.2 & 2.6).',
  'Annonce en double ou publication répétée (spam) d’un même bien ou service.',
  'Coordonnées de contact, liens externes ou publicités incrustés directement dans le titre ou les visuels.',
  'Avis d’obsèques ou Avis de recherche : signalement frauduleux, informations invérifiables ou atteinte à la dignité (CGU Art. 2.6).',
];

/**
 * Motifs prédéfinis de rejet KYC (B-12, I-08)
 */
export const KYC_PRESET_REASONS = [
  'Photo du document floue ou illisible.',
  'Pièce d’identité expirée (date de validité dépassée).',
  'Document non conforme (seuls CNI, Carte de séjour ou Passeport sont acceptés).',
  'Nom ou prénom ne correspondant pas aux informations du compte.',
  'Document rogné ou incomplet.',
];

/**
 * Validation d'origine de ressource Storage (S-14, R7)
 * N'autorise que les domaines officiels Google Cloud / Firebase Storage
 * ET exige le bucket du projet pour bloquer les buckets tiers.
 */
export function isValidStorageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const allowedBuckets = [
      'bizbooster-gabon.appspot.com',
      'bizbooster-gabon.firebasestorage.app',
      'bizbooster.appspot.com',
    ];
    const envBucket = (import.meta as any)?.env?.VITE_FIREBASE_STORAGE_BUCKET;
    if (envBucket && typeof envBucket === 'string' && !allowedBuckets.includes(envBucket)) {
      allowedBuckets.push(envBucket);
    }

    // Direct domain hosting bucket, e.g. https://bizbooster-gabon.appspot.com/path
    const isDirectBucketHost = allowedBuckets.some(
      (b) => parsed.hostname === b || parsed.hostname === b.replace(/\.appspot\.com$/, '') + '.appspot.com'
    );

    // Google Cloud Storage / Firebase Storage APIs with bucket in path
    const isGoogleStorageHost = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'storage.cloud.google.com',
    ].includes(parsed.hostname);

    const hasAllowedBucketPath = allowedBuckets.some(
      (b) =>
        parsed.pathname.includes(`/b/${b}/`) ||
        parsed.pathname.startsWith(`/${b}/`) ||
        parsed.pathname.includes(`/b/${b.replace(/\.appspot\.com$/, '')}/`)
    );

    return isDirectBucketHost || (isGoogleStorageHost && hasAllowedBucketPath);
  } catch {
    return false;
  }
}

/**
 * Validation d'origine de médias (S-14)
 * Autorise Firebase / Google Cloud Storage, les images data/blob, ainsi que le domaine Unsplash pour les images de démonstration.
 */
export function isTrustedMediaUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:image/') || url.startsWith('blob:')) return true;
  if (isValidStorageUrl(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      if (
        [
          'firebasestorage.googleapis.com',
          'storage.googleapis.com',
          'storage.cloud.google.com',
        ].includes(parsed.hostname)
      ) {
        return true;
      }
      if (parsed.hostname === 'images.unsplash.com' || parsed.hostname.endsWith('.unsplash.com')) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * FORBIDDEN_AD_CREATE_KEYS: Clés strictement interdites lors de la création d'une annonce
 * selon firestore.rules (pas d'échéance, pas de publication anticipée, pas de ranking/boost/tier auto-attribués).
 */
export const FORBIDDEN_AD_CREATE_KEYS = [
  'publishedAt',
  'expiresAt',
  'moderatedAt',
  'moderationReason',
  'isFeatured',
  'featuredUntil',
  'featuredAt',
  'featuredPausedAt',
  'boostRequested',
  'withBoost',
  'ownerTier',
  'isOwnerVip',
  'isOwnerVerified',
  'isVipCorner',
  'paidAmount',
  'paymentMethod',
  'transactionRef',
  'paymentVerified',
  'viewsCount',
  'reportsCount',
  'pendingExtension',
  'suspensionReason',
  'suspendedAt',
  'lastExtendedAt',
] as const;

/**
 * Assainit les données d'une annonce avant enregistrement dans Firestore sur la collection /ads,
 * garantissant qu'aucune clé protégée ou privilégiée par firestore.rules n'est envoyée.
 */
export function sanitizeAdForCreation(ad: Partial<Ad>): Record<string, any> {
  const sanitized: Record<string, any> = { ...ad };
  for (const key of FORBIDDEN_AD_CREATE_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}
