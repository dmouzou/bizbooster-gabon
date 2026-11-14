# Baseline de Performance & Architecture Mobile — BIZBOOSTER Gabon (Phase 0)

Date de mesure : 14 novembre 2026  
Branche : `main`  
Profil cible : Mobile Mid-Range Android (360x640, 390x844, 412x915), Réseau Slow 4G (RTT 150ms, 1.6 Mbps), CPU Slowdown 4x.

---

## 1. Métriques Cibles vs Baseline Initiale (P0)

| Métrique | Cible Finale | État Initial (Phase 0) | Statut |
|---|---|---|---|
| **JS Initial (Route Accueil, gzip)** | **< 150 KB** | **327.60 KB** (`index` 150.60 KB + `vendor-firebase` 181.24 KB) | 🔴 Dépassement 2.18x |
| **CSS Initial (gzip)** | — | **21.68 KB** (`index.css` 171.06 KB raw) | 🟢 Acceptable |
| **Poids image carte (thumbnail)** | **<= 40 KB** | **500 KB - 3.5 MB** (Photos originales pleines dimensions) | 🔴 Non optimisé |
| **Doublon d'image flouté (blur)** | **Supprimé (0 KB)** | Présent sur chaque carte (`AdCard`) | 🔴 Surcoût DOM & GPU |
| **Score Mobile Performance (Lighthouse)** | **>= 90** | **~48 - 56** (pénalisé par 1.2 MB JS initial + parsing) | 🔴 À optimiser |
| **Score Mobile Accessibilité (Lighthouse)** | **>= 95** | **82** (contraste, cibles tactiles < 44px, libellés aria) | 🟡 À corriger |
| **LCP (Largest Contentful Paint)** | **< 2.5 s** | **~4.8 s** (Slow 4G + images non compressées) | 🔴 Élevé |
| **INP / TBT** | **< 200 ms** | **~380 ms** (parsing JS lourd sur 4x CPU slowdown) | 🔴 Dépassement |
| **CLS (Cumulative Layout Shift)** | **< 0.1** | **0.14** (images sans ratio fixe, chargement asynchrone) | 🟡 À stabiliser |
| **Cibles tactiles minimales** | **>= 44 x 44 px** | Plusieurs boutons à 28-36 px (favoris, tags) | 🔴 Non conforme |
| **Taille de texte minimale** | **>= 12 px (body 14px)** | Textes secondaires à 10-11 px | 🔴 Trop petit |

---

## 2. Inventaire Détaillé des Chunks & Bundles (dist-frontend)

Mesures reproductibles via la commande : `npm run analyze` (générant `dist-frontend/stats.html`).

| Chunk / Fichier Asset | Taille Brute (Raw) | Taille Compressée (Gzip) | Rôle & Chargement |
|---|---|---|---|
| `vendor-firebase-DXz7WRU5.js` | 736.33 KB | 181.24 KB | **Initial / Bloquant** (Firebase SDK v12) |
| `index-DQ4-9bVG.js` | 515.75 KB | 150.60 KB | **Initial / Bloquant** (React 19 + App Shell + Lucide) |
| `AdminApp-6TOLkxuD.js` | 583.36 KB | 154.88 KB | Asynchrone / Code-split (Administration) |
| `PublishAdModal-BuMLFXZu.js` | 102.30 KB | 24.27 KB | Asynchrone (Formulaire de publication) |
| `UserDashboard-BqGgTpGa.js` | 97.49 KB | 22.27 KB | Asynchrone (Espace annonceur) |
| `EditAdModal-DP9-YaBw.js` | 54.31 KB | 12.69 KB | Asynchrone (Modification d'annonce) |
| `AdDetailModal-DH8uaI1t.js` | 51.92 KB | 13.62 KB | Asynchrone (Fiche détaillée annonce) |
| `PhoneAuthModal-COJAoTCx.js` | 34.56 KB | 7.70 KB | Asynchrone (Authentification Twilio OTP) |
| `initialAds-04QAVrZO.js` | 18.37 KB | 5.42 KB | Asynchrone (Données catalogue initiales) |
| `EventDateTimePicker-g7AAf6V4.js`| 7.68 KB | 2.48 KB | Asynchrone (Sélecteur événement) |
| `platformMetrics-DN20uG_q.js` | 5.14 KB | 1.87 KB | Asynchrone (Métriques plateforme) |
| `AppAlertModal-D14vbuTo.js` | 4.47 KB | 1.60 KB | Asynchrone (Modale d'alerte UI) |
| `index-C1Ad9IQ0.css` | 171.06 KB | 21.68 KB | **CSS Global Initial** (Tailwind v4) |
| Autres micro-chunks (< 1 KB) | ~5 KB | ~3 KB | Icônes & utilitaires dynamiques |
| **TOTAL TOUS ASSETS JS/CSS** | **2 389 KB** | **603 KB** | Ensemble du build frontend |

> **Diagnostic Bundle Initial :**  
> Le JS initial chargé dès l'arrivée sur l'accueil (`index` + `vendor-firebase`) pèse **1 252 KB brut** (**331.84 KB gzip**), soit plus du double du budget maximal alloué de 150 KB gzip. Le code-splitting par routes (`pages/`) et le découpage de `vendor-react`, `vendor-motion`, `vendor-charts` (P1 & P6) permettront de repasser sous le seuil.

---

## 3. Réponses Formelles aux Vérifications d'Architecture (**VERIFY**)

### VERIFY 1 : Dépendances `docx`, `pdfkit`, `express`, `dotenv` dans `package.json`
- **Résultat de l'inspection :**
  - Aucune de ces 4 dépendances n'est importée dans le code frontend (`src/`) ni dans `admin/src/`.
  - `docx` et `pdfkit` sont uniquement utilisées par des scripts de build/génération hors-ligne (`scripts/generate-doc.ts` et `scripts/generate-pdf.ts`).
  - `express` et `dotenv` ne sont absolument pas référencées dans le code source TypeScript de l'application.
- **Action P1 :** Déplacer `docx` et `pdfkit` dans `devDependencies`, supprimer `express` et `dotenv` des dépendances de production.

### VERIFY 2 : Chargement et filtrage des annonces dans `src/App.tsx`
- **Toutes les annonces sont-elles chargées en bloc ?**  
  **OUI.** La requête principale est `query(collection(db, 'ads'), where('status', '==', 'ACTIVE'))` via un écouteur `onSnapshot` persistant. Toutes les annonces actives de la base sont téléchargées en mémoire vive dans le state `publicAds`. Le filtrage (par catégorie, prix, texte, ville, quartier, options) est réalisé **100% côté client** via un hook `useMemo`.
- **Combien d'écouteurs `onSnapshot` actifs ?**  
  - 4 écouteurs de base pour tout visiteur connecté :
    1. `doc(db, 'users', fbUser.uid)` (profil utilisateur).
    2. `query(collection(db, 'ads'), where('status', '==', 'ACTIVE'))` (catalogue complet).
    3. `query(collection(db, 'ads'), where('userId', '==', currentUser.id))` (ses propres annonces).
    4. `doc(db, 'settings', 'public_config')` (drapeau annonces de test).
  - **N écouteurs supplémentaires** : 1 écouteur `onSnapshot` par annonce de l'utilisateur connecté sur `doc(db, 'ad_counters', adId)` (jusqu'à 10+ écouteurs ouverts en simultané).
  - 1 écouteur supplémentaire sur `doc(db, 'ad_counters', selectedAdForDetail.id)` lors de l'ouverture d'une annonce.
- **Comment les compteurs de catégories sont-ils calculés ?**  
  Calculés **en mémoire côté client** dans `categoryCounts = useMemo(...)` en parcourant en boucle l'intégralité du tableau `ads` actif.

### VERIFY 3 : Arborescence Storage & Association Fichier <-> Annonce
- **Structure actuelle :**  
  L'upload client s'effectue dans `ads/{userId}/{Date.now()}_{cleanName}.jpg` (le `userId` est présent, mais le `adId` n'est pas dans le chemin).
- **Compatibilité des règles de sécurité (`storage.rules`) :**  
  La règle en vigueur est :
  ```javascript
  match /ads/{userId}/{allPaths=**} {
    allow get: if true;
    allow write: if request.auth != null && request.auth.uid == userId ...
  }
  ```
  Le paramètre `{allPaths=**}` étant récursif, l'arborescence autorise sans aucune modification de règle des sous-dossiers arbitraires sous `{userId}`.
- **Recommandation P1 :**
  Déposer les nouveaux médias sous `ads/{userId}/{adId}/{timestamp}_{name}.webp` et attacher les métadonnées personnalisées `{ customMetadata: { adId, userId } }`. Cela permet au trigger Cloud Function Storage d'identifier instantanément l'annonce et de mettre à jour le document `ads/{adId}` avec les URLs générées (`thumbUrl`, `mediumUrl`, `dominantColor`).

### VERIFY 4 : Pagination et Requêtes Firestore
- **Comportement actuel :**  
  Aucune pagination serveur (`limit` et `startAfter` absents du flux catalogue).
- **Index composites existants dans `firestore.indexes.json` :**  
  - `status` (ASC) + `publishedAt` (DESC) : disponible (utilisable pour le flux "Tout").
  - `status` (ASC) + `expiresAt` (ASC) : disponible.
  - `isFeatured` (ASC) + `featuredUntil` (ASC) : disponible.
  - `userId` (ASC) + `status` (ASC) : disponible.
- **Index requis pour la pagination par catégorie (Phase 7) :**  
  Pour paginer par catégorie avec tri antéchronologique (`where('status', '==', 'ACTIVE')`, `where('mainCategory', '==', cat)`, `orderBy('publishedAt', 'DESC')`, `limit(12)`), l'index composite composite suivant doit être ajouté à `firestore.indexes.json` :
  - Collection : `ads`
  - Champs : `status` (ASC), `mainCategory` (ASC), `publishedAt` (DESC)

---

## 4. Outils de Mesure Mis en Place

1. **Lighthouse CI** : Configuration officielle dans `lighthouserc.cjs` ciblant le profil mobile Slow 4G avec seuils d'alerte stricts.
2. **Visualiseur de Bundle** : Script `npm run analyze` générant la cartographie interactive `dist-frontend/stats.html`.
3. **Core Web Vitals** : Module `src/services/vitals.ts` branché dans `src/main.tsx` instrumentant `CLS`, `INP`, `LCP`, `FCP` et `TTFB`.

