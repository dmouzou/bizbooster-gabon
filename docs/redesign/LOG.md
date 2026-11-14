# Journal de Bord de la Refonte Mobile & Optimisation (LOG.md)

Ce journal consigne de manière continue l'état des livraisons, résultats CI/CD, régressions évitées et prochaines étapes de la refonte mobile BIZBOOSTER Gabon.

---

## [Phase 0] : Baseline & Outils de Mesure de Performance
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

## [Phase 1] : Quick Wins & Fondations d'Optimisation Frontend
- **Date** : 14 novembre 2026
- **Commit** : `5b1ca3c`
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

---

## [Phase 2] : Design Foundation & Primitives UI Accessibles
- **Date** : 14 novembre 2026
- **Commit** : `2ea9b5d`
- **Ce qui est livré** :
  - Jetons de design dans `@theme` (`src/index.css`) via Tailwind v4 : couleurs de marque (`--color-brand-primary: #047857`, hover `#059669`, surface `#ecfdf5`), accents (`--color-accent-primary: #f59e0b`, hover `#fbbf24`), canevas `#f8fafc`, surface carte `#ffffff`, police `Inter` avec pile système robuste, et rayons d'arrondis calibrés.
  - Ensemble complet de composants primitifs réutilisables dans `src/components/ui/` :
    - `Button` : variantes (`primary`, `secondary`, `outline`, `ghost`, `danger`), cibles tactiles strictement `>= 44x44 px`, spinner de chargement accessible.
    - `IconButton` : zone cliquable minimale garantie `>= 44x44 px`, attribut `aria-label` obligatoire, états de survol et focus-visible.
    - `Chip` : sélecteur de catégorie/filtre accessible (`role="radio"` / `aria-checked`), badge de compteur d'annonces, navigation clavier et défilement horizontal fluide.
    - `Pill` : badges de statut haute visibilité (`vip`, `verified`, `success`, `warning`, `error`, `urgent`, `neutral`), typographie micro 11px uppercase bold, contraste renforcé.
    - `Skeleton` : squelettes animés de préchargement avec support des ratios d'aspect pour éliminer le CLS.
    - `EmptyState` : affichage élégant d'état vide avec icône, titre, description et bouton d'action contextuel.
    - `Price` : formatage monétaire certifié FCFA (marché Gabon) basé sur `Intl.NumberFormat('fr-FR')` avec suffixe optionnel (`/mois`, `/jour`).
    - `Sheet` : tiroir coulissant mobile (pattern Drawer) avec détection du glissement vers le bas (swipe down), verrouillage du scroll, gestion de la touche Échap, respect de `safe-area-inset-bottom`, et conversion responsive automatique en dialogue centré au-dessus de 640px.
  - Page de revue visuelle et d'accessibilité sans dépendance externe (`src/components/ui/UiKitchenSink.tsx`) accessible via la route de dev `/__ui`.
  - Suite de tests unitaires et d'accessibilité dédiée `tests/ui_primitives.test.ts` (10 nouveaux tests unitaires).
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 22 fichiers testés, 124/124 tests unitaires passés (+10 tests).
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - Découpage code-split : `UiKitchenSink` isolé dans son propre micro-chunk de 5.41 KB gzip, zéro surcoût sur le chargement initial de l'accueil.
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Commits UI strictement séparés du code backend.
  - ✅ Aucun texte interactif en dessous de 12 px (10 px proscrit).
  - ✅ Cibles tactiles strictement `>= 44x44 px`.
  - ✅ Aucun em dash dans le code ou les libellés.

---

## [Phase 3] : Shell Mobile & Refonte Complète du Flux d'Annonces
- **Date** : 14 novembre 2026
- **Commit** : `087aeec`
- **Ce qui est livré** :
  - Nouvelle carte de flux grand public (`src/components/AdCard.tsx`) conforme à la spécification 5.2 :
    - Format d'image optimisé 16:10 avec `ResponsiveImage` (placeholder solide `#DCE3EA` sans décalage de mise en page).
    - Cibles tactiles certifiées : bouton favori 44x44 px en incrustation haute, bouton WhatsApp de 48px de hauteur, bouton d'appel direct de 48x48 px.
    - Suppression intégrale du bloc de description de 300 caractères (réservé désormais à la fiche détail).
    - Migration des puces de sous-catégories (type de bien, marque véhicule, métier) dans le corps de carte.
    - Prise en charge des variantes catégorielles (ruban d'obsèques Nécrologie avec diffusion nationale, bandeau Avis de recherche avec badge récompense, badge VIP, bordure et pilule Sponsorisée).
    - Mémorisation `React.memo` avec comparateur ciblé (`id`, `status`, `viewsCount`, `expiresAt`, `isFavorite`).
  - Nouvelle carte compacte en ligne (`src/components/AdCardCompact.tsx`) pour les résultats de recherche et la liste des favoris :
    - Vignette carrée de 104x104 px à gauche avec `ResponsiveImage`.
    - Colonne droite avec prix en 17px/800, titre sur 2 lignes, localisation avec épingle, badge Vérifié et bouton d'action WhatsApp 44px.
    - Bouton bascule Grille / Liste (`Grid` vs `List`) intégré dans le catalogue.
  - Barre de navigation mobile inférieure fixe (`src/components/navigation/BottomTabBar.tsx`) :
    - 5 onglets tactiles conformes à la zone d'atteinte du pouce : Accueil, Recherche, bouton central circulaire surélevé de 56px pour Publier, Favoris (avec badge dynamique de compteur), et Compte.
    - Respect des zones de sécurité mobile (`env(safe-area-inset-bottom)`).
  - Rangée de puces de catégories défilante (`src/components/navigation/CategoryChipsRow.tsx`) :
    - Ordre officiel : Tout, Immobilier, Véhicules, Emploi, Événements, Bric-à-brac, Cours & Soutien, Autres Métiers, Nécrologie, Avis de Recherche.
    - Défilement horizontal fluide avec point d'accroche (`snap-x`), scrollbar masquée et état actif teinté de couleur primaire.
  - Barre supérieure mobile (`src/components/navigation/TopBar.tsx`) et ligne de recherche avec debounce 250ms (`src/components/navigation/SearchRow.tsx`).
  - Suite de tests unitaires et d'accessibilité dédiée `tests/feed_and_shell.test.ts` (8 nouveaux tests).
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 23 fichiers testés, 132/132 tests unitaires passés (+8 tests).
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - Poids du chunk initial `index.js` maintenu à **75.74 KB gzip** (très inférieur au budget de 150 KB).
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Commits UI strictement séparés du code backend (`functions/` et règles inchangées).
  - ✅ Aucun texte interactif en dessous de 12 px (10 px proscrit).
  - ✅ Cibles tactiles strictement `>= 44x44 px`.
  - ✅ Navigation et grille desktop (>= 1024px) parfaitement préservées.
  - ✅ Aucun em dash dans les textes ou commentaires.

---

## [Phase 4] : Fiche Détail Mobile & Routage par Liens Profonds
- **Date** : 14 novembre 2026
- **Commit** : `87699d8`
- **Ce qui est livré** :
  - Composant mobile dédié pleine page `src/components/AdDetailPage.tsx` monté sur les écrans `< 1024px`, tandis que `AdDetailModal` est conservé pour les écrans bureau (`>= 1024px`) :
    - En-tête fixe avec bouton retour 44x44 px, titre et catégorie, bouton favori et bouton de partage rapide.
    - Galerie photo ultra-fluide basée sur le scroll-snap CSS natif matériel (`overflow-x: auto; scroll-snap-type: x mandatory`) sans gestionnaire tactile JavaScript bloquant le thread principal.
    - Compteur de photos dynamique et bouton d'agrandissement en plein écran (lightbox).
    - Corps d'annonce structuré selon l'ordre strict de la spécification 5.4 :
      1. Prix en grand format (24-30px, vert émeraude épuré) avec suffixe d'unité, ou ruban solennel pour Nécrologie / Avis de recherche.
      2. Badges contextuels (Vérifié avec bouclier, VIP Corner avec couronne, Transaction Vente/Location/etc.).
      3. Titre et localisation détaillée (quartier, ville, province) avec temps restant avant expiration.
      4. Grille de caractéristiques principales par catégorie (type de bien, véhicule marque/modèle/sous-type, cours matière/niveau, événement date/lieu, référence annonce).
      5. Description détaillée repliable après 6 lignes avec bascule accessible "Lire toute la description" / "Voir moins".
      6. Bloc annonceur avec avatar, nom, statut vérifié par BIZBOOSTER et bouton d'ouverture de badge.
      7. Bloc localisation au Gabon certifiée géolocalisée.
      8. Actions de signalement (`ReportAdModal` en modale/tiroir) et partage social (`ShareAdModal`).
    - Barre d'action inférieure collante fixe respectant la zone de sécurité (`env(safe-area-inset-bottom)`) avec bouton principal WhatsApp (hauteur 48px) et bouton d'appel direct (hauteur 48px), et adaptation textuelle selon la catégorie (Condoléances/Famille, Signaler/Urgence).
    - Espacement inférieur généreux (`pb-28`) assurant qu'aucun contenu ni lien de signalement ne soit masqué par la barre d'action inférieure.
  - Gestion du routage et des liens profonds dans `src/App.tsx` :
    - Prise en charge des URL partagées sous forme `#ad-<id>` et `?ad=<id>`.
    - Sauvegarde automatique de la position de défilement du catalogue (`savedDetailScrollYRef`) à l'ouverture d'une annonce.
    - Restauration instantanée de la position de défilement au retour dans le catalogue, que ce soit via le bouton retour de l'interface ou le bouton Précédent du navigateur (`popstate`).
  - Suite de tests unitaires et de rendu dédiée `tests/ad_detail_page.test.ts` (7 nouveaux tests unitaires).
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 24 fichiers testés, 139/139 tests unitaires passés (+7 tests).
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - Chunk `AdDetailPage` découpé et chargé à la demande (4.05 KB gzip), poids de `index.js` initial à **76.04 KB gzip** (très inférieur au budget de 150 KB).
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Commits UI strictement séparés du code backend (`functions/` et règles inchangées).
  - ✅ Cibles tactiles strictement `>= 44x44 px`.
  - ✅ Pas d'em dash dans le code, les commentaires ou les textes.
  - ✅ `AdDetailModal` préservé pour desktop (>= 1024px).
  - ✅ Marché Gabon, FCFA.
## [Phase 5] : Tiroir de Filtrage Mobile Unifié & Puces Actives
- **Date** : 14 novembre 2026
- **Commit** : `bd2b7e3`
- **Ce qui est livré** :
  - Composant tiroir de filtrage mobile unifié `src/components/FilterSheet.tsx` basé sur le primitif accessible `Sheet` (Drawer coulissant avec swipe down et respect de la zone de sécurité) :
    - Piloté dynamiquement selon la catégorie active (Immobilier, Matériel Roulant, Emploi, Cours à Domicile, Nécrologie, Avis de Recherche, Autres Métiers, Événements, Global).
    - Sections repliables (Accordéons) avec chevrons d'état : Opération & Bien, Localisation en cascade au Gabon (9 provinces, villes et quartiers), Spécificités (marques, modèles, niveaux, ministères, types).
    - Bascule accessible dédiée pour le Coin VIP Gabon.
    - Pied de page collant sécurisé avec bouton secondaire "Réinitialiser" et bouton d'action principal dynamique "Voir N résultats".
  - Ligne de puces de filtres actifs amovibles `src/components/ActiveFilterChips.tsx` positionnée immédiatement sous la barre de recherche :
    - Affiche chaque critère filtré avec libellé clair et icône de suppression directe (`X`).
    - Bouton global "Effacer tout" dès que 2 filtres ou plus sont actifs.
  - Intégration ergonomique dans `src/App.tsx` :
    - Sur mobile (`md:hidden`), remplacement des 5 barres de filtres encombrantes par le bouton de filtre 48px dans `SearchRow` (avec point indicateur orange dès qu'un filtre est actif) et la rangée `ActiveFilterChips`.
    - Sur bureau (`isDesktop` / `hidden md:block`), préservation complète des barres de filtres détaillées pour les utilisateurs sur grand écran.
  - Suite de tests unitaires et d'accessibilité dédiée `tests/filter_sheet.test.ts` (8 nouveaux tests unitaires).
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 25 fichiers testés, 147/147 tests unitaires passés (+8 tests).
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - Chunk `FilterSheet` découpé et chargé à la demande (2.85 KB gzip), poids de `index.js` initial maintenu à **77.74 KB gzip** (très inférieur au budget de 150 KB).
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Commits UI strictement séparés du code backend (`functions/` et règles inchangées).
  - ✅ Cibles tactiles strictement `>= 44x44 px`.
  - ✅ Pas d'em dash dans le code, les commentaires ou les textes.
  - ✅ Marché Gabon, FCFA.
- **Prochaine étape** :
  - **Phase 6 (Publish Stepper Refactoring)** : Complétée.

---

## [Phase 6] : Assistant de Publication Mobile par Étapes (Publish Stepper)
- **Date** : 14 novembre 2026
- **Commit** : à pousser
- **Ce qui est livré** :
  - Refonte complète de `PublishAdModal` en assistant modulaire à 6 étapes (+ confirmation) :
    - Étape 1 : Catégorie & Localisation spatiale au Gabon (8 catégories principales, nature de transaction Vente vs Location pour Immobilier et Véhicules, 9 provinces, villes et quartiers détaillés avec quartier habituel du profil).
    - Étape 2 : Galerie Photos & Médias (compression WebP côté client max 1280px qualité 0.82 via `compressImageForUpload`, réorganisation des photos gauche/droite, suppression avec libération mémoire URL blob, option vidéo descriptive <= 30s <= 50 Mo, et attachement obligatoire de CV en .pdf, .docx ou .md pour les demandeurs d'emploi).
    - Étape 3 : Détails & Caractéristiques pilotés par schémas de catégories dédiés (`src/features/publish/schemas/*`), génération automatique assistée du titre, description obligatoire avec décompte en direct (min 50 caractères), et nom de l'annonceur strictement verrouillé si le compte est vérifié KYC.
    - Étape 4 : Prix, Durée & Options (validation du salaire pour les catégories d'emploi, gratuité automatique pour Nécrologie, Avis de recherche et Événements entrée libre, durées 15 ou 30 jours, détection automatique de l'éligibilité au Coin VIP, option Boost En tête de liste 7 jours avec utilisation prioritaire des boosts offerts, et devis officiel en direct avec garde de disponibilité `quoteReady`).
    - Étape 5 : Aperçu avant validation (reproduction fidèle du rendu en carte de flux mobile avec badges de transaction, localisation, photo principale, et lien vers les CGU).
    - Étape 6 : Facturation & Paiement Mobile (validation instantanée en 1 clic pour les comptes partenaires VIP exonérés ou annonces gratuites, simulateur `MobilePaymentSimulator` avec attente de validation du code PIN USSD sur le téléphone de l'annonceur sans restriction sur le numéro payeur).
    - Étape 7 : Confirmation et transmission à la modération (carte récapitulative, statut en cours d'examen, accès direct au suivi dans Mon Espace Annonceur ou retour au catalogue).
  - Architecture modulaire dans `src/features/publish/` :
    - Schémas par catégorie (`schemas/types.ts`, `immobilier.ts`, `vehicules.ts`, `emploi.ts`, `cours.ts`, `necrologie.ts`, `avisRecherche.ts`, `evenements.ts`, `bricABrac.ts`, `autresEmplois.ts`).
    - Constructeur de charge utile canonique `payloadBuilder.ts` garantissant une structure de document strictement identique et conforme aux règles de sécurité Firestore.
    - Composants d'étapes ciblés : `PublishHeader.tsx`, `PublishFooter.tsx`, `Step1Category.tsx`, `Step2Photos.tsx`, `Step3Details.tsx`, `Step4Pricing.tsx`, `Step5Preview.tsx`, `Step6Payment.tsx`, `Step7Confirmation.tsx`.
  - Application stricte des quotas de photos depuis le serveur :
    - Standard / Pro : 3 photos maximum.
    - Élite : 4 photos maximum.
    - Business : 5 photos maximum.
  - Sauvegarde automatique du brouillon dans `localStorage` (`bizbooster_publish_draft_${userId}`) avec invite de restauration fluide ou de réinitialisation complète au lancement.
  - Présentation ergonomique plein écran sur mobile (`< 640px`) avec pied de page collant sécurisé (`env(safe-area-inset-bottom)`) et modale centrée élégante sur grand écran (`>= 640px`).
  - Suite de tests unitaires et de cohérence de charge utile `tests/publish_stepper.test.ts` (12 nouveaux tests unitaires).
- **Résultats des tests & validations locales** :
  - `npm run lint` (`tsc --noEmit`) : 🟢 0 erreur.
  - `npm test` : 🟢 26 fichiers testés, 159/159 tests unitaires passés (+12 tests).
  - `npm run build` : 🟢 0 erreur (`dist-frontend` et `dist-admin`).
  - Le poids de `PublishAdModal.js` est passé de **187 KB raw** à **90.55 KB raw** (**22.16 KB gzip**).
  - Poids du chunk initial `index.js` maintenu à **77.37 KB gzip** (très inférieur au budget de 150 KB).
- **Vérification des contraintes dures (Section 2 du brief)** :
  - ✅ Commits UI strictement séparés du code backend (`functions/` et règles inchangées).
  - ✅ Plafonds d'annonces stricts (10 max absolu, forfaits respectés) et aucun calcul de gratuité côté client.
  - ✅ Quotas photos stricts (3 Standard/Pro, 4 Élite, 5 Business).
  - ✅ Nom d'annonceur (`contactName`) verrouillé pour les utilisateurs vérifiés KYC.
  - ✅ Paiement USSD PIN sans contrainte de correspondance avec le numéro de compte.
  - ✅ Pas d'em dash dans le code, les commentaires ou les textes.
  - ✅ Cibles tactiles `>= 44x44 px`.
  - ✅ Marché Gabon, FCFA.
- **Prochaine étape** :
  - **Phase 7 (Account & Sheets)** : Passer en revue `UserDashboard` pour mobile (contrôle segmenté des onglets, cartes compactes), et convertir les modales listées (`PhoneAuthModal`, `KycUploadModal`, `ExtendAdModal`, `ReactivateAdModal`, `SubscriptionUpgradeModal`, `UserPreferencesModal`, `CguModal`, `ReportAdModal`, `ShareAdModal`) en tiroirs `Sheet` coulissants sur mobile.


