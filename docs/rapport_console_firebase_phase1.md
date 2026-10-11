# Rapport de Vérification de la Console Firebase (Phase 1)

Ce rapport documente les vérifications obligatoires et les configurations à acter dans la **Console Firebase** pour assurer le bon fonctionnement de l'authentification et éliminer les erreurs SMS aléatoires.

---

### 1. Fournisseurs d'Authentification (Sign-in providers)
- **Téléphone (Phone)** : Activé. Obligatoire pour la réception des SMS OTP via `signInWithPhoneNumber`.
- **E-mail / Mot de passe (Email/Password)** : Activé. Requis pour le nouveau flux où chaque utilisateur porte un identifiant e-mail synthétique lié `<8chiffres>@bizbooster.ga` et son mot de passe.

---

### 2. Politique de Région SMS & Domaines Autorisés
- **Régions SMS autorisées** : S'assurer explicitement que le **Gabon (+241)** est inclus dans la liste blanche des pays autorisés pour l'expédition de SMS.
- **Domaines autorisés (Authorized Domains)** :
  - `bizbooster-gabon.web.app`
  - `bizbooster-gabon.firebaseapp.com`
  - `localhost` (pour le développement local et les émulateurs)
  - Tout domaine personnalisé de production (ex: `bizbooster.ga`).

---

### 3. Facturation & Quotas (Spark vs Blaze)
- Le forfait gratuit **Firebase Spark** limite l'expédition à **10 SMS par jour**, provoquant rapidement des erreurs `auth/quota-exceeded` ou `auth/error-code:-39`.
- **Recommandation** : Passer le projet au forfait **Blaze (Pay as you go)** dès que le volume de trafic réel démarre.

---

### 4. App Check & reCAPTCHA Enterprise
- Activer **Firebase App Check** avec reCAPTCHA v3 ou reCAPTCHA Enterprise.
- Appliquer l'application forcée (Enforce) sur **Firebase Auth** et **Cloud Functions** une fois les tests terminés pour bloquer les robots et limiter les abus de facturation SMS.

---

### 5. Protection contre l'Énumération d'E-mails (Email Enumeration Protection)
- Vérifier l'état dans *Authentication > Paramètres > Protection contre l'énumération d'adresses e-mail*.
- Si activée, Firebase renvoie un code générique `auth/invalid-credential` au lieu de `auth/user-not-found` ou `auth/wrong-password`. Le code client prend en compte ces deux cas via la table d'erreurs (Annexe A).

---

### 6. Région des Cloud Functions
- Le client appelle la région `us-central1`.
- Toutes les Cloud Functions v2 sont déployées sur `us-central1` afin d'éviter l'erreur `functions/not-found`.

---

### 7. Numéros de Téléphone de Test (White-list Firebase Auth)
- Configurer les numéros de test fictifs directement dans *Authentication > Méthode de connexion > Téléphone > Numéros de téléphone de test*.
- Exemples de numéros de test à configurer avec codes statiques (6 chiffres) :
  - `+24167256341` ➔ Code: `555555`
  - `+24167896902` ➔ Code: `111777`
  - `+24177276895` ➔ Code: `777777`
  - `+24177905165` ➔ Code: `000000`
- Ces numéros fonctionnent avec le véritable appel `confirm()` de Firebase SDK, sans nécessiter de code codé en dur ni de contournement dans le code source du client React.
