# NOTES & Journal de Bord - Durcissement Passerelle SingPay

## 1. Inventaire des usages existants (Phase 0.3)

### `calculateServerPrice`
- `functions/src/pricing.ts:64` : Déclaration originale de la fonction `calculateServerPrice`.
- `functions/src/index.ts:17` : Import `import {calculateServerPrice} from "./pricing";`.
- `functions/src/index.ts:451` : Export `export {calculateServerPrice};`.
- `functions/src/index.ts:764` : Appel dans `initiateSingPayPayment` pour calculer le montant de la commande côté serveur.
- `tests/pricing_and_vip.test.ts:3` : Import dans la suite de tests racine.
- `tests/pricing_and_vip.test.ts:15, 20-25, 37, 45, 53, 62, 72-75` : Tests unitaires de `calculateServerPrice`.

### `getSingPayConfig`
- `functions/src/index.ts:421` : Définition de la fonction (synchrone, lecture Secret Manager / env, repli webhookSecret = clientSecret).
- `functions/src/index.ts:793` : Appel dans `initiateSingPayPayment` (l.793).
- `functions/src/index.ts:962` : Appel dans `checkSingPayPaymentStatus` (l.962).
- `functions/src/index.ts:1101` : Appel dans `singpayWebhook` (l.1101).

### `applyPaymentAttribution`
- `functions/src/index.ts:461` : Définition de la fonction (l.461-687).
- `functions/src/index.ts:951` : Appel dans `checkSingPayPaymentStatus` lorsque le statut est déjà SUCCESS.
- `functions/src/index.ts:1060` : Appel dans `checkSingPayPaymentStatus` après mise à jour vers SUCCESS.
- `functions/src/index.ts:1196` : Appel dans `singpayWebhook` après mise à jour vers SUCCESS.
- `functions/src/index.ts:1218` : Appel dans `onPaymentStatusChange` (trigger Firestore `onDocumentWritten("payments/{paymentId}")`).
- `functions/src/index.ts:1261` : Appel dans `claimPaymentBenefits` (callable).

### `SERVER_PRODUCTS`
- `functions/src/pricing.ts:6` : Définition de la constante `SERVER_PRODUCTS: Record<string, number>`.
- `functions/src/pricing.ts:73, 74` : Lecture dans `calculateServerPrice` pour vérification des prix catalogue.
- `functions/src/pricing.ts:99, 100` : Lecture pour `SUB_${selectedTier}`.
- `functions/src/index.ts:402` : Définition dupliquée de `SERVER_PRODUCTS` dans `index.ts`.

### `SUBSCRIPTION_QUOTAS`
- `functions/src/index.ts:155` : Définition de `SUBSCRIPTION_QUOTAS: Record<string, number>` (`STANDARD: 3`, `PRO: 8`, `ELITE: 14`, `BUSINESS: 20`, `VIP_EXEMPT: 20`).
- `functions/src/index.ts:268` : Lecture du quota standard (`SUBSCRIPTION_QUOTAS.STANDARD || 3`).
- `functions/src/index.ts:757` : Lecture du quota de l'utilisateur dans `initiateSingPayPayment`.
- `functions/src/index.ts:1384` : Lecture du quota dans `onAdCreated`.

---

## 2. Décisions & Arbitrages

### Décision D3 : Quota pour les utilisateurs Standard
- **Question** : Les 3 premières annonces sont-elles gratuites pour les utilisateurs Standard ?
- **Réponse du Propriétaire / Medd** : **NON**, les 3 premières annonces **NE SONT PAS GRATUITES** pour les utilisateurs Standard.
- **Application** :
  - `SUBSCRIPTION_QUOTAS.STANDARD` fixé à `0` côté serveur.
  - Aucune annonce gratuite attribuée pour Standard sans abonnement actif.
  - Le client facture la publication Standard conformément au devis serveur (`quoteOrder`).

### Décision D4 : Secrets Secret Manager
- Les secrets Secret Manager sont conservés en repli immédiat pendant la phase de migration.

---

## 3. Dépendances ajoutées (Justification - Annexe B)

- **`functions/`** :
  - `vitest` (devDependency) : Requis par la Phase 0.4 du plan d'exécution pour exécuter les tests unitaires de `pricing.ts`, des Cloud Functions et de l'attribution.
  - `@firebase/rules-unit-testing` (devDependency) : Requis par la Phase 0.4 et Phase 7.5 pour valider les règles de sécurité Firestore.

---

## 4. Analyse Technique SingPay

### Transport du secret de Webhook (Phase 5.4)
- La documentation officielle SingPay et l'implémentation existante acceptent :
  - L'en-tête `x-webhook-secret`
  - L'en-tête `x-client-secret`
  - Le paramètre de requête URL `?secret=...`
- **Choix retenu** :
  - Pour une sécurité maximale et flexibilité, validation via `crypto.timingSafeEqual`.
  - Le secret de webhook dédié (`singpayWebhookSecret`) est exigé. Le repli sur `clientSecret` est supprimé comme demandé en Phase 2.1 & 5.3.
  - Le webhook accepte `x-webhook-secret` ou `?secret=` (utile pour l'URL configurée dans le dashboard SingPay).

### Test de connexion Gateway (Phase 2.3 & Annexe A)
- Dans la documentation d'API SingPay standard, il n'existe pas d'endpoint officiel dédié `GET /ping` sans effet secondaire.
- En conséquence, selon la règle stricte de l'annexe A ("À implémenter seulement si la documentation SingPay décrit un appel GET en lecture seule qui valide les identifiants. Sinon, ne pas l'écrire et le noter dans NOTES.md. Ne pas deviner un endpoint"), `testGatewayConnection` ne sera pas inventé avec un endpoint fictif. Si le wallet et les identifiants sont validés, une vérification de format et de présence est effectuée.
