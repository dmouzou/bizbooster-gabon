# Guide de Déploiement, Migration et Exploitation (Phase 10)
## Passerelle de Paiement SingPay - BizBooster Gabon

Ce document détaille les procédures opérationnelles de mise en production, migration des clés, retour arrière (rollback) et surveillance de la passerelle durcie SingPay.

---

## 1. Phase 10.1 : Ordre de Déploiement en Production

Pour garantir une transition sans coupure de service ni régression, le déploiement doit être exécuté rigoureusement dans cet ordre :

### Étape 1 : Déploiement des Règles de Sécurité et Index Firestore
Les index et règles de sécurité doivent être actifs **avant** le nouveau code serveur et client afin d'éviter tout rejet d'accès ou blocage de requêtes composées.

```bash
# 1. Déployer les règles de sécurité Firestore
firebase deploy --only firestore:rules

# 2. Déployer les index composites
firebase deploy --only firestore:indexes
```

**Critère de validation :**
- Ouvrir la Console Firebase > Firestore > Onglet **Index**.
- Vérifier que l'index composite suivant est à l'état **Activé** (Enabled) :
  - Collection : `payments`
  - Champs indexés : `status` (Ascendant), `createdAt` (Ascendant), `__name__` (Ascendant)
  - Portée de la collection : Collection unique

---

### Étape 2 : Déploiement des Cloud Functions (Backend v2)
Le predeploy compile le TypeScript (`tsc`) et valide la qualité du code (`eslint`).

```bash
# Déployer uniquement les Cloud Functions
firebase deploy --only functions
```

**Critère de validation :**
- Toutes les fonctions v2 sont déployées avec succès :
  - `initiateSingPayPayment` (Callable)
  - `checkSingPayPaymentStatus` (Callable)
  - `previewQuote` (Callable)
  - `getGatewayConfig` (Callable)
  - `saveGatewayConfig` (Callable)
  - `migrateGatewayConfig` (Callable)
  - `extendAdVip` (Callable)
  - `requestExtension` (Callable)
  - `singpayWebhook` (HTTP / Webhook)
  - `reconcilePayments` (onSchedule - toutes les 2 minutes)
  - `onPaymentStatusChange` (onDocumentWritten)
  - `onAdCreated` (onDocumentCreated)
  - `expireAds` (onSchedule - quotidien)
- À ce stade, le serveur fonctionne en mode repli transparent sur Secret Manager / variables d'environnement tant que la configuration Firestore n'est pas initialisée.

---

### Étape 3 : Initialisation & Migration de la Configuration Super Admin
1. Se connecter sur l'interface d'administration avec le compte **Super Admin**.
2. Accéder à l'onglet **Paiements**.
3. **Migration ou Saisie des paramètres :**
   - **Option A (Migration automatique) :** Si des clés existaient dans l'ancien document `settings/payment_gateway`, exécuter `migrateGatewayConfig()` depuis le panneau pour transférer automatiquement le Client ID, Client Secret, Wallet ID et numéros de reversement vers `private_config/singpay`, puis supprimer l'ancien document ouvert au client.
   - **Option B (Saisie manuelle directe) :**
     - Saisir le **Client ID**.
     - Saisir le **Client Secret** (masqué dans un champ de mot de passe).
     - Saisir le **Wallet ID**.
     - Saisir le numéro de reversement **Moov Money** (préfixes valides : 60, 62, 65, 66).
     - Saisir le numéro de reversement **Airtel Money** (préfixes valides : 74, 76, 77).
     - Activer l'interrupteur **Paiements actifs** (`isLive: true`).
     - Cliquer sur **Enregistrer les modifications**.
     - Si un numéro de reversement a été modifié, confirmer l'action en saisissant « CONFIRMER » dans le modal de confirmation renforcée.
     - Si la session date de plus de 10 minutes, ressaisir le mot de passe lorsque la demande de reconnexion apparaît.
4. **Configuration du Webhook SingPay :**
   - Cliquer sur **Régénérer le secret** pour générer un secret aléatoire de 32 octets.
   - Copier l'URL complète du webhook affichée (contenant le secret) :
     `https://singpaywebhook-xxxxxx.run.app?secret=<webhookSecret>`
   - Coller cette URL dans le tableau de bord marchand SingPay (section Webhooks / Notifications).

**Critère de validation :**
- L'audit `gateway_audit` contient une entrée sans secret en clair.
- Les badges « Moov Actif » et « Airtel Actif » s'affichent en vert.
- Le document `private_config/singpay` n'est pas lisible par le SDK client (accès refusé par les règles).

---

### Étape 4 : Validation par un Paiement Réel (Test Pilote)
Effectuer un paiement réel avec le produit au montant minimal :
- **Produit :** Publication d'annonce pour 3 jours.
- **Montant attendu :** 1 500 FCFA.
- **Validation :**
  1. Le mobile de test reçoit le push USSD.
  2. L'utilisateur valide avec son code PIN.
  3. L'écran passe automatiquement de `WAITING` à `SUCCESS` en temps réel sans rechargement de page.
  4. L'attribution est effectuée **une seule fois** (`attributed: true`).
  5. L'annonce est publiée avec le statut actif et une expiration fixée à J+3.

---

### Étape 5 : Déploiement des Applications Web (Hosting)
Une fois les fonctions validées par le test réel, compiler et déployer les interfaces utilisateur :

```bash
# Compiler le frontend public et le panneau d'administration
npm run build

# Déployer sur Firebase Hosting
firebase deploy --only hosting
```

**Critère de validation :**
- Le site public et le panneau admin sont en ligne.
- Aucun montant en dur n'apparaît dans les requêtes d'initiation.

---

## 2. Phase 10.2 : Retrait des Secrets après 7 Jours

Pendant les 7 jours suivant la mise en service, les secrets Secret Manager restent configurés en secours dans les Cloud Functions.
Une fois la période d'observation de 7 jours écoulée sans incident :

1. **Suppression du repli dans le code serveur :**
   - Dans `functions/src/index.ts`, retirer les déclarations `defineSecret(...)` et les options `{ secrets: [...] }` des fonctions `initiateSingPayPayment`, `checkSingPayPaymentStatus`, `singpayWebhook`, etc.
   - `getSingPayConfig` ne lira plus que `private_config/singpay` (avec rejet explicite si le document est absent ou incomplet).

2. **Redéploiement des Cloud Functions :**
   ```bash
   firebase deploy --only functions
   ```

3. **Suppression des secrets dans Google Cloud Secret Manager :**
   ```bash
   gcloud secrets delete SINGPAY_CLIENT_ID --project <PROJECT_ID> --quiet
   gcloud secrets delete SINGPAY_CLIENT_SECRET --project <PROJECT_ID> --quiet
   gcloud secrets delete SINGPAY_WALLET_ID --project <PROJECT_ID> --quiet
   gcloud secrets delete SINGPAY_WEBHOOK_SECRET --project <PROJECT_ID> --quiet
   gcloud secrets delete SINGPAY_MOOV_DISBURSEMENT --project <PROJECT_ID> --quiet
   gcloud secrets delete SINGPAY_AIRTEL_DISBURSEMENT --project <PROJECT_ID> --quiet
   ```

**Critère de validation :**
- Les Cloud Functions se déploient sans paramètre de secret.
- Les paiements continuent de fonctionner normalement via la configuration administrable.

---

## 3. Phase 10.3 : Procédure de Retour Arrière (Rollback)

Si une anomalie bloquante est détectée lors du déploiement initial :

### A. Retour arrière des Cloud Functions
```bash
# Identifier le tag ou commit précédant le durcissement
git checkout singpay-hardening-base

# Redéployer l'ancienne version des fonctions
firebase deploy --only functions
```
- **Préservation des données :** Le document `private_config/singpay` reste stocké dans Firestore mais est simplement ignoré par l'ancienne version.
- **Continuité des paiements :** L'ancienne version des fonctions continue de s'exécuter immédiatement grâce aux secrets toujours présents dans Secret Manager.

### B. Retour arrière du Frontend
```bash
git checkout singpay-hardening-base
npm run build
firebase deploy --only hosting
```

**Test à blanc :**
La structure du document `private_config/singpay` est totalement isolée et n'affecte en rien les collections `ads` ou `users`. Un retour arrière ne provoque aucune perte de données ni rupture de schéma.

---

## 4. Phase 10.4 : Surveillance et Alertes en Production

### 1. Alertes sur les Paiements `NEEDS_REVIEW` (Montants Altérés)
Lorsqu'un montant notifié par SingPay ne correspond pas exactement au montant attendu du devis serveur, le paiement passe en `NEEDS_REVIEW` et aucune attribution n'a lieu.

- **Requête Firestore de surveillance :**
  ```javascript
  const needsReviewSnap = await db.collection("payments")
    .where("status", "==", "NEEDS_REVIEW")
    .get();
  ```
- **Alerte Cloud Monitoring (Log-based Alert) :**
  - **Filtre de journal :**
    ```
    resource.type="cloud_run_revision" OR resource.type="cloud_function"
    textPayload=~"settlePayment: Montant altéré"
    ```
  - **Condition :** Déclenchement dès que le nombre d'occurrences est > 0 sur 5 minutes.
  - **Canal de notification :** Notification immédiate par e-mail / SMS aux administrateurs.

### 2. Surveillance du Taux d'Échec (`FAILED`)
- Surveiller quotidiennement le ratio :
  $$\text{Taux d'échec} = \frac{\text{Paiements FAILED}}{\text{Paiements SUCCESS} + \text{Paiements FAILED}}$$
- Un pic supérieur à 15% sur 1 heure indique généralement une indisponibilité réseau chez l'opérateur mobile (Moov ou Airtel) ou un Wallet marchand dont le solde ou les plafonds sont atteints.

### 3. Contrôle de la Réconciliation Automatique
- La fonction planifiée `reconcilePayments` tourne toutes les 2 minutes (`*/2 * * * *`).
- Elle s'assure que :
  - Aucun paiement `PENDING` ne reste bloqué plus de 3 minutes (passage automatique en `EXPIRED` si SingPay ne valide pas).
  - Aucun paiement `INITIATING` ne reste bloqué plus de 2 minutes (passage automatique en `FAILED`).
  - Tout paiement prélevé avec succès côté opérateur est régularisé en `SUCCESS` sous 2 à 3 minutes même si le webhook opérateur a été interrompu.
