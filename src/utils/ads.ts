import { Ad, UserProfile } from '../types';

/**
 * isTestAd (B-04) : Détection robuste des annonces de test / simulation.
 * S'appuie strictement sur le drapeau serveur `ad.isTest` ou sur les préfixes explicites `test_` / `ad-test`.
 * Ne pénalise plus les annonces légitimes contenant 'test' dans leur titre (ex: Testament, Attestation).
 */
export function isTestAd(ad: Ad): boolean {
  if (ad.isTest) return true;
  const id = (ad.id || '').toLowerCase();
  if (id.startsWith('test_') || id.startsWith('test-') || id.startsWith('ad-test')) return true;
  return false;
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
 * Validation d'origine de ressource Storage (S-14)
 * N'autorise que les domaines officiels Google Cloud / Firebase Storage.
 */
export function isValidStorageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const validHosts = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'storage.cloud.google.com',
    ];
    return validHosts.includes(parsed.hostname) || parsed.hostname.endsWith('.appspot.com');
  } catch {
    return false;
  }
}

