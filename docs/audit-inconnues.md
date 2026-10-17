# Inventaire des Inconnues (Phase 0 - Étape 0.2)

Document établi le 17 octobre 2026 suite à l'inspection exhaustive des fichiers du dépôt BIZBOOSTER Gabon :
`src/services/firebase.ts`, `functions/src/index.ts`, `src/services/platformMetrics.ts`, `src/components/Header.tsx`, `src/components/UserDashboard.tsx`, `src/components/PhoneAuthModal.tsx`, `src/utils/formatters.ts`, `storage.rules`.

---

## 1. Où sont écrits `system_counters` ?
- **Statut : CONFIRMÉ.**
- **Détails constatés :**
  - Le document `system_counters/scalability_metrics` est écrit côté client par le service `src/services/platformMetrics.ts` via les méthodes `trackDownloadRequest`, `trackSmsSent`, `resetSmsCounters` et `resetDownloadCounters`.
  - Le document `system_counters/global` est écrit côté serveur dans `functions/src/index.ts` (L365) lors des règlements SingPay.
  - Le document `system_counters/scalability_metrics` est également mis à jour côté serveur dans `functions/src/index.ts` (L2287) lors des réinitialisations de compteurs de passerelle.
  - `firestore.rules` autorise actuellement tout utilisateur administrateur à écrire sur `/system_counters/{counterId}` sans passer par une transaction serveur, ce qui rend les compteurs falsifiables depuis le SDK client.

---

## 2. Que font les Cloud Functions auditées ?
- **`registerView` : CONFIRMÉ.**
  - Implémenté dans `functions/src/index.ts` (L2884-2941).
  - Prend `{ adId, deviceId }`. Exclut le propriétaire de l'annonce si connecté. Dédoublonne sur 24h via `ad_views/{adId}_{viewerKey}`.
  - Écrit directement une mise à jour sur le document de l'annonce : `adRef.update({ viewsCount: FieldValue.increment(1) })`.
  - Problème confirmé : pas d'App Check forcé, deviceId falsifiable par un client non connecté, et mise à jour de l'annonce qui déclenche la relecture en temps réel du catalogue pour tous les visiteurs connectés (problème C-03).
- **`approveAd` : CONFIRMÉ.**
  - Implémenté dans `functions/src/index.ts` (L2624-2724).
  - Valide les annonces en attente ou les prolongations payées (`pendingExtension`).
  - Vérifie le rôle admin via `checkIsAdmin` (Firestore lookup ou claim).
  - Calcule `expiresAt`, `durationDays`, active le boost initial de 7 jours si demandé, passe le statut à `ACTIVE`.
  - Problème confirmé : n'écrit pas dans `moderation_logs` de manière atomique (le client tentait de logger à part, causant des erreurs B-13).
- **`boostAd` : CONFIRMÉ.**
  - Implémenté dans `functions/src/index.ts` (L2730-2815).
  - Décrémente `freeBoostsRemaining` sur le profil de l'utilisateur et active l'option « En Tête de Liste » pour 7 jours (`featuredUntil`) en transaction Firestore.
- **`extendAdVip` : CONFIRMÉ.**
  - Implémenté dans `functions/src/index.ts` (L2946-3025).
  - Prolongation sans frais réservée aux membres VIP exemptés ou abonnés `BUSINESS` actifs. Vérifie le profil et met à jour `expiresAt` et `durationDays`.
- **`requestExtension` : CONFIRMÉ.**
  - Implémenté dans `functions/src/index.ts` (L3030-3120).
  - Vérifie un paiement Mobile Money préalable valide et lie la prolongation à l'annonce.

---

## 3. Quelles règles Storage protègent `idDocumentUrl` ?
- **Statut : CONFIRMÉ.**
- **Détails constatés dans `storage.rules` :**
  - Les pièces d'identité KYC sont stockées sous `/kyc/{userId}/{allPaths=**}`.
  - La lecture est restreinte à l'utilisateur propriétaire ou à un compte avec token claim `role in ['ADMIN', 'SUPER_ADMIN']`.
  - L'écriture est restreinte au propriétaire (taille < 10 Mo, types image/* ou PDF).
  - Problème de sécurité confirmé (S-14) : le client enregistre une URL publique ou signée sans vérifier le domaine de l'URL (`storage.googleapis.com` ou Firebase Storage), permettant potentiellement à un utilisateur d'injecter une URL tierce arbitraire dans `users/{uid}.idDocumentUrl`.

---

## 4. App Check est-il actif ?
- **Statut : INFIRMÉ (inactif).**
- **Détails constatés :**
  - `src/services/firebase.ts` initialise Firebase sans provider App Check (ni `initializeAppCheck`, ni `ReCaptchaEnterpriseProvider` / `ReCaptchaV3Provider`).
  - `functions/src/index.ts` déclare les fonctions sans l'option `enforceAppCheck: true`.
  - Recommandation validée : activer App Check avec reCAPTCHA Enterprise et l'appliquer sur les callables publics sensibles (`registerView`, signalements).

---

## 5. Le champ `password` existe-t-il réellement ?
- **Statut : CONFIRMÉ (présent dans les règles et le client, en cours d'extinction).**
- **Détails constatés :**
  - `src/App.tsx` (L167) effectue explicitement `const { password, ...safeData } = data as any;` pour filtrer le mot de passe extrait du snapshot Firestore.
  - `firestore.rules` (L54) protège expressément le champ `password` dans `privilegedKeys()`.
  - Le script `scripts/migrate_auth_users.ts` possède une routine `cleanupPasswordsPhase()` attestant que des mots de passe avaient été stockés dans les documents Firestore des utilisateurs lors d'une ancienne version.
  - Il est donc nécessaire de finaliser la purge définitive de ce champ et de le retirer des règles et du code client.
