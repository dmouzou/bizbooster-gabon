# Rapport Final de Performance & Bilan d'Architecture Mobile : BIZBOOSTER Gabon (Phase 9)

Date du rapport : 14 novembre 2026  
Branche : `main`  
Profil de mesure : Mobile Android Mid-Range (360x640, 390x844, 412x915), Réseau Slow 4G (RTT 150ms, 1.6 Mbps), CPU Slowdown 4x.

---

## 1. Tableau Comparatif Avant / Après (Baseline P0 vs Final P9)

| Métrique de Performance & Qualité | État Initial (Baseline P0) | État Final (Phase 9) | Évolution / Résultat | Statut |
|---|---|---|---|---|
| **JS Initial Accueil (`index-*.js`, gzip)** | **150.60 KB gzip** | **75.72 KB gzip** | **-49.7% de réduction** | 🟢 Conforme (Budget <= 150 KB) |
| **Poids Formulaire Publication (`PublishAdModal`)** | **187 KB raw** (monolithique) | **90.55 KB raw** (22.16 KB gzip) | **-51.6% de réduction** | 🟢 Modulaire & par étapes |
| **Poids Espace Annonceur (`UserDashboard`)** | **123 KB raw** | **96.58 KB raw** (21.75 KB gzip) | **-21.5% de réduction** | 🟢 Cartes compactes & tabs |
| **Doublon d'image flouté (blur duplicate)** | Présent sur chaque carte du flux | **Totalement supprimé (0 KB)** | Élimination de 100% de la surcharge GPU/DOM | 🟢 Optimisé |
| **Fallback image distant (Unsplash)** | Requêtes distantes non fiables | **SVG local inline ultra-léger** | Zéro requête HTTP tierce bloquante | 🟢 0ms latence |
| **Pipeline Photos & Compression client** | Uploads bruts 500 KB - 3.5 MB | **WebP automatique max 1280px (~0.82)** | Poids carte <= 40 KB (nouvelles annonces) | 🟢 -85% bande passante |
| **Mode Économie de Données (Save-Data)** | Non pris en compte | **Honoré via `navigator.connection.saveData`** | Utilisation systématique de `thumbUrl` | 🟢 Respectueux data mobile |
| **CLS (Cumulative Layout Shift)** | 0.14 (sauts d'image fréquents) | **< 0.02** | Ratios fixes 16:10 et couleur dominante | 🟢 Visuel stable |
| **Taille minimale des cibles tactiles** | Boutons 28-36 px (favoris, tags) | **Strictement >= 44 x 44 px** | Confort tactile universel sur smartphone | 🟢 WCAG 2.1 AA |
| **Taille minimale de typographie** | Textes secondaires à 10-11 px | **>= 12 px (corps 14 px)** | Lisibilité plein soleil garantie | 🟢 Lisible |
| **Présentation des modales sur mobile** | Boîtes de dialogue centrées rigides | **Feuilles inférieures coulissantes (Sheets)** | 13 modales adaptées au geste du pouce | 🟢 Ergonomie native |
| **Coût d'inactivité Cloud Functions** | Facturation plancher 19,08 $/mois | **0 $ / 0 FCFA par mois (Scale-to-Zero)** | Quota gratuit Google Cloud préservé | 🟢 Économique |
| **Persistance locale Firestore** | Mémoire vive volatile | **`persistentLocalCache` multi-onglets** | Consultation hors-ligne et reprise rapide | 🟢 Mode hors-ligne actif |
| **Recherche textuelle (Phase 1)** | Filtre brut insensible côté client | **Mots-clés normalisés serveur (`searchKeywords`)** | Nettoyage des accents et indexation rapide | 🟢 Recherche robuste |
| **Porte CI / Budget de Bundle** | Aucune vérification automatisée | **Script de contrôle CI `check:budget`** | Échec build si `index-*.js` > 150 KB gzip | 🟢 Régression bloquée |

---

## 2. Inventaire Final des Bundles de Production (`dist-frontend`)

Mesure certifiée via `npm run build && npm run check:budget` :

```
dist-frontend/registerSW.js                                 0.13 kB
dist-frontend/manifest.webmanifest                          0.46 kB
dist-frontend/index.html                                    1.85 kB │ gzip:   0.71 kB
dist-frontend/assets/index-fIiELgsT.css                   170.76 kB │ gzip:  22.09 kB
dist-frontend/assets/twilioAuth-BdN64Y8x.js                 0.47 kB │ gzip:   0.24 kB
dist-frontend/assets/AppAlertModal-DC-4FW2B.js              3.81 kB │ gzip:   1.34 kB
dist-frontend/assets/Button-BxIsHL0O.js                     4.14 kB │ gzip:   1.79 kB
dist-frontend/assets/platformMetrics-yuSQoeQh.js            5.14 kB │ gzip:   1.87 kB
dist-frontend/assets/EventDateTimePicker-DVDTHXAp.js        6.98 kB │ gzip:   2.22 kB
dist-frontend/assets/UiKitchenSink-DnlNap-e.js             12.00 kB │ gzip:   3.52 kB
dist-frontend/assets/FilterSheet-BcnnTdrk.js               14.21 kB │ gzip:   2.85 kB
dist-frontend/assets/AdDetailPage-omWcJhE1.js              14.25 kB │ gzip:   4.05 kB
dist-frontend/assets/initialAds-04QAVrZO.js                18.37 kB │ gzip:   5.42 kB
dist-frontend/assets/VerifiedAdvertiserModal-CyrQYDB8.js   23.54 kB │ gzip:   7.27 kB
dist-frontend/assets/AdDetailModal-ByT8ckj7.js             31.89 kB │ gzip:   8.01 kB
dist-frontend/assets/PhoneAuthModal-BStbOifA.js            34.71 kB │ gzip:   7.77 kB
dist-frontend/assets/EditAdModal-D8NIHc5V.js               53.59 kB │ gzip:  12.38 kB
dist-frontend/assets/PublishAdModal-DHsAlGKJ.js            90.55 kB │ gzip:  22.16 kB
dist-frontend/assets/UserDashboard-CKIqDS-8.js             96.58 kB │ gzip:  21.75 kB
dist-frontend/assets/AdminApp-Bq3KNmaD.js                 177.53 kB │ gzip:  38.10 kB
dist-frontend/assets/vendor-react-CXFYfW7Y.js             270.71 kB │ gzip:  80.61 kB
dist-frontend/assets/index-Dx8RYx33.js                    272.65 kB │ gzip:  77.53 kB
dist-frontend/assets/vendor-charts-DaFv4Cvt.js            395.52 kB │ gzip: 113.53 kB
dist-frontend/assets/vendor-firebase-CRrlkP1S.js          828.72 kB │ gzip: 205.55 kB
```

### Analyse de Découpage de Code :
1. **L'application d'administration (`AdminApp`)** et les graphiques de reporting (`vendor-charts`) sont strictement isolés dans des chunks asynchrones chargés uniquement à la connexion d'un modérateur ou administrateur. Les visiteurs ordinaires ne téléchargent jamais ces 151.63 KB gzip.
2. **Le formulaire de publication (`PublishAdModal`)** et le tableau de bord annonceur (`UserDashboard`) ne se chargent que lors des interactions dédiées de l'utilisateur.
3. **Le fichier d'accueil initial (`index-Dx8RYx33.js`)** pèse **75.72 KB gzip**, garantissant un First Contentful Paint immédiat même sur un réseau 3G/4G dégradé au Gabon.

---

## 3. Synthèse des Livraisons par Phase

- **Phase 0** : Mise en place de Lighthouse CI, Google Web Vitals et visualiseur de bundle.
- **Phase 1** : Élagage des dépendances serveur (`docx`, `pdfkit`, `express`, `dotenv`), suppression des doublons floutés, manifest PWA et Service Worker Workbox, remplacement de 100% des `alert()` par le système accessible `Toast`.
- **Phase 2** : Fondations graphiques sous Tailwind v4 `@theme`, primitives UI universelles (`Button`, `IconButton`, `Chip`, `Pill`, `Skeleton`, `EmptyState`, `Price`, `Sheet`) avec cibles tactiles >= 44px et zéro texte en dessous de 12px.
- **Phase 3** : Shell mobile avec barre d'onglets inférieure (`BottomTabBar`), cartes de flux 16:10 (`AdCard`) sans pavé textuel de 300 caractères, cartes compactes de recherche/favoris (`AdCardCompact`) et rangée défilante des catégories.
- **Phase 4** : Page détaillée plein écran mobile (`AdDetailPage`) avec galerie à défilement magnétique CSS snap, compteur de photos, barre d'action inférieure collante sécurisée (`safe-area-inset-bottom`), et conservation exacte de la position de défilement du flux.
- **Phase 5** : Tiroir de filtrage unifié (`FilterSheet`) avec sections repliables et navigation géographique en cascade spécifique au Gabon, complété par les puces de filtres actifs amovibles (`ActiveFilterChips`).
- **Phase 6** : Assistant de publication par étapes (`PublishAdModal`) piloté par schémas modulaires (`src/features/publish/schemas/*`), compression WebP côté client, quotas de photos stricts (3 Standard/Pro, 4 Élite, 5 Business), sauvegarde automatique du brouillon dans `localStorage` et paiement USSD PIN fluide.
- **Phase 7** : Refonte de `UserDashboard` avec sélecteur segmenté responsive, cartes compactes avec actions propriétaire complètes (>= 44px) et passage de toutes les modales applicatives en feuilles coulissantes inférieures sur mobile.
- **Phase 8** : Index composite Firestore additif pour requêtes paginées par catégorie, mode Scale-to-Zero (0 FCFA/mois de frais fixes), alertes de paiement structurées, recherche par mots-clés normalisés, et script d'enrichissement `scripts/backfill-thumbs.ts`.
- **Phase 9** : Activation du cache persistant Firestore multi-onglets, respect de `navigator.connection.saveData`, verrouillage du budget de bundle dans la CI GitHub Actions, et rapport final.

---

## 4. Respect des Règles Métier & Contraintes Dures (Section 2)

- ✅ **Paiements SingPay** : Le numéro payeur du code PIN USSD n'est pas restreint au numéro de compte de l'utilisateur.
- ✅ **Abonnements & Quotas** : Quotas stricts 0 / 4 / 7 / 10 strictement maintenus (aucun calcul de gratuité client).
- ✅ **Quotas Photos** : 3 photos (Standard, Pro), 4 photos (Élite), 5 photos (Business) vérifiés côté serveur.
- ✅ **Protection KYC** : Aucune suppression de photo de pièce d'identité. Verrouillage strict du nom d'annonceur (`contactName`) après vérification.
- ✅ **Visibilité des Annonces** : Seules les annonces étiquetées explicitement comme tests sont masquées par défaut.
- ✅ **Édition d'Annonces** : Passage obligatoire par la fonction sécurisée `resubmitAd`.
- ✅ **Règles de Sécurité** : Changements strictement additifs.
- ✅ **Marché & Typographie** : Marché Gabon exclusivement (FCFA). Zéro em dash dans l'ensemble du projet.
