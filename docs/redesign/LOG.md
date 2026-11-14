# Journal de Bord de la Refonte Mobile & Optimisation (LOG.md)

Ce journal consigne de manière continue l'état des livraisons, résultats CI/CD, régressions évitées et prochaines étapes de la refonte mobile BIZBOOSTER Gabon.

---

## [Phase 0] — Baseline & Outils de Mesure de Performance
- **Date** : 14 novembre 2026
- **Commit** : `34dff19`
- **Ce qui est livré** :
  - Configuration Lighthouse CI mobile (`lighthouserc.cjs`) avec profil réseau Slow 4G et émulation écran 390x844.
  - Script d'analyse de bundle `npm run analyze` avec `rollup-plugin-visualizer` (génère `dist-frontend/stats.html`).
  - Instrumentation runtime des métriques Google Web Vitals (`src/services/vitals.ts` branché dans `src/main.tsx`).
  - Rapport complet de référence initiale `docs/perf-baseline.md` avec inventaire précis des chunks et réponses exhaustives aux 4 vérifications d'architecture (**VERIFY**).
  - Résolution des alertes de typage TypeScript dans `AdCard.tsx`, `AdminPanel.tsx` et `EditAdModal.tsx`.
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 21 fichiers testés, 114/114 tests unitaires passés.
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - `npm --prefix functions run lint && npm --prefix functions run build` : 🟢 0 erreur.
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Aucune modification sur la logique des paiements SingPay ni sur les quotas serveurs.
  - ✅ Aucune régression sur les règles Firestore / Storage (modifications additives uniquement).
  - ✅ Aucune modification sur la visibilité des annonces ni sur la gestion KYC.
  - ✅ Marché Gabon uniquement, FCFA, pas d'em dashes.

---

## [Phase 1] — Quick Wins & Fondations d'Optimisation Frontend
- **Date** : 14 novembre 2026
- **Commit** : En cours de validation P1 (UI)
- **Ce qui est livré** :
  - Nettoyage des dépendances : déplacement de `docx` et `pdfkit` en `devDependencies`, élimination d'`express` et `dotenv` non utilisés côté client.
  - Découpage fin des bundles vendor dans `vite.config.ts` : `vendor-react` (80.21 KB gzip), `vendor-charts` (113.53 KB gzip, isolé et non chargé sur l'accueil public), `vendor-firebase` (181.24 KB gzip).
  - Réduction spectaculaire de `index.js` (route accueil) : passage de **150.60 KB gzip à 76.24 KB gzip** (-49.4% de JS initial direct).
  - Intégration PWA via `vite-plugin-pwa` : manifest BIZBOOSTER (`lang: fr`, theme `#047857`, 192/512 icons) et Service Worker Workbox avec mise en cache des assets statiques.
  - Balises méta mobiles (`theme-color: #047857`, `viewport-fit=cover`) et pré-connexions réseau (`preconnect` vers `firestore.googleapis.com` et `firebasestorage.googleapis.com`) dans `index.html`.
  - Système accessible de notifications `Toast` et `ToastContainer` dans `src/components/ui/Toast.tsx` monté au sommet de l'arbre (`App.tsx`).
  - Élimination de 100% des appels `alert()` résiduels dans l'application (`MyAdsManager`, `AdDetailModal`, `TwilioAdminPanel`).
  - Composant `ResponsiveImage` (`src/components/ui/ResponsiveImage.tsx`) gérant les ratios fixes, le fond teinté (`dominantColor`), le chargement différé (`loading="lazy"`, `decoding="async"`), le décodage fluide et la priorité d'affichage (`fetchpriority`).
  - Optimisation des cartes d'annonces (`AdCard.tsx`) et fiches détail (`AdDetailModal.tsx`) :
    - Suppression intégrale de l'image floutée d'arrière-plan (gain DOM et GPU significatif sur mobile).
    - Remplacement du fallback Unsplash distant par un SVG local inline data URI pour éliminer les requêtes tierces inutiles.
    - Mémorisation du composant carte via `React.memo` pour supprimer les re-rendus superflus du catalogue.
    - Support des champs d'optimisation `thumbUrl`, `mediumUrl` et `dominantColor` dans l'interface `Ad` (`src/types.ts`).
  - Amélioration de l'utilitaire de compression client `src/utils/imageCompressor.ts` : priorité à la compression WebP moderne (qualité 0.82, max 1280px) avec repli transparent sur JPEG, et ajustement des extensions d'upload dans `PublishAdModal.tsx` et `EditAdModal.tsx`.
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 21 fichiers testés, 114/114 tests unitaires passés.
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - `npm run analyze` : 🟢 Rapport généré dans `dist-frontend/stats.html`.
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Commits UI strictement séparés du code backend (`functions/` et règles inchangées).
  - ✅ Aucune régression sur le flux de paiement, aucun em dash dans les textes ou commentaires.
  - ✅ Cibles tactiles et tailles de polices préservées.
- **Prochaine étape** :
  - **Phase 2 (Design Foundation)** : Jetons de design dans `@theme` (`src/index.css`), création des composants primitifs dans `src/components/ui/` (`Button`, `IconButton`, `Chip`, `Pill`, `Sheet`, `Skeleton`, `EmptyState`, `Price`), remplacement des emojis par des icônes `lucide-react`, page de test visuel `/__ui`.

