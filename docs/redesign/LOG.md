# Journal de Bord de la Refonte Mobile & Optimisation (LOG.md)

Ce journal consigne de manière continue l'état des livraisons, résultats CI/CD, régressions évitées et prochaines étapes de la refonte mobile BIZBOOSTER Gabon.

---

## [Phase 0] — Baseline & Outils de Mesure de Performance
- **Date** : 14 novembre 2026
- **Commit** : En cours de validation P0
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
- **Prochaine étape** :
  - **Phase 1 (Quick wins)** : Nettoyage des dépendances (`docx`, `pdfkit`, `express`, `dotenv`), découpage fin des chunks vendor (`vendor-react`, `vendor-motion`, `vendor-charts`), balises méta / preconnect dans `index.html`, PWA manifest + SW basique, suppression du double blur et fallback Unsplash dans `AdCard`, `React.memo` sur les cartes, remplacement des `alert()` par `Toast`.
