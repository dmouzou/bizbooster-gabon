# BIZBOOSTER Gabon - Capacité, Quotas et Alertes Budgétaires (Phase 7 - Étape 7.1)

Document de référence technique et opérationnel pour l'exploitation et la protection financière de la plateforme BIZBOOSTER Gabon en environnement Google Cloud Platform (GCP) et Firebase.

---

## 1. Architecture et Dimensionnement des Cloud Functions v2

Toutes les Cloud Functions v2 sont protégées contre les risques de dérive budgétaire et d'emballement d'instances concurrentes (*concurrency spike*) par des plafonds globaux et par fonction :

| Paramètre | Valeur Globale / Défaut | Fonctions Spécifiques | Justification Opérationnelle |
| :--- | :--- | :--- | :--- |
| **Région** | `us-central1` *(configurable via `FUNCTION_REGION`)* | Toutes alignées | Aligné avec Firebase Auth et Firestore (Annexe A & C). |
| **Max Instances (`maxInstances`)** | `10` instances simultanées | `registerView`: 20 max<br>`setRole`: 5 max<br>`moderation`: 5 max | Bloque les attaques DDoS et l'épuisement de budget. |
| **Mémoire par instance** | `256 MiB` | Standardisée | Réduit le coût à l'inactivité et accélère le démarrage à froid. |
| **Timeout maximal** | `60 secondes` | `reports`, `registerView`: 15s<br>`resubmitAd`: 20s<br>`moderation`: 30s | Interrompt immédiatement les requêtes bloquées. |
| **Concurrency v2** | `80` requêtes / instance | Standard Cloud Run | Optimise l'absorption des pics de trafic gabonais. |

---

## 2. Quotas Firestore & Dédoublonnage d'Écritures

Afin de respecter le budget gratuit ou maîtriser la facturation Blaze :
1. **Comptage global agrégé** :
   - Remplacement de `getDocs()` par `getCountFromServer()` et `AggregateField.count()`.
   - Coût : 1 lecture facturée par tranche de 1 000 documents comptés au lieu de 1 lecture par document.
2. **Isolation des consultations (`registerView`)** :
   - Écriture sur `ad_counters/{adId}` plutôt que sur `ads/{adId}`.
   - Évite la réémission en temps réel vers tous les clients écoutant le catalogue `ads`.
   - Dédoublonnage sur 24h par clé SHA-256 (`ad_views/{adId}_{key}_{date}`).
3. **Paiements et réconciliation** :
   - Traitement par lot avec `db.batch()` limité à 500 opérations atomiques par commit.

---

## 3. Quotas d'Authentification SMS (Anti-Fraude)

1. **Numéros de test autorisés** :
   - Liste blanche sans envoi de SMS réel configurée dans la console Firebase Auth.
2. **Protection contre l'abus de SMS** :
   - Enforce App Check sur les points d'entrée de vérification.
   - Limite de tentatives par numéro et par adresse IP (3 requêtes par 15 minutes).
   - Validation stricte du format gabonais (+241) et des préfixes opérateurs reconnus (Airtel `74`, `76`, `77` ; Moov `60`, `62`, `65`, `66`).

---

## 4. Seuils d'Alertes et Budget GCP Cloud Billing

Trois seuils d'alertes automatisés doivent être configurés dans *GCP Console > Facturation > Budgets et alertes* :

1. **Seuil d'Avertissement (50% du budget mensuel)** :
   - Notification par e-mail à l'équipe technique (`admin@bizbooster.ga`).
   - Analyse préventive de la consommation quotidienne Firestore et Cloud Functions.
2. **Seuil Critique (90% du budget mensuel)** :
   - Notification prioritaire par e-mail et canal de supervision.
   - Vérification immédiate du nombre de SMS envoyés et des logs Cloud Functions (recherche d'anomalies ou tentatives de scraping).
3. **Seuil Plafond (100% du budget mensuel)** :
   - Notification d'urgence.
   - Option Cloud Monitoring / PubSub : bascule automatique des callables secondaires en mode dégradé si activée.

---

## 5. Procédure d'Intervention en Cas d'Anomalie de Trafic

En cas d'attaque ou de pic anormal :
1. Accéder à *GCP Cloud Run > Services* et abaisser `max-instances` à 2 ou 3 temporairement.
2. Vérifier les métriques de la console admin BIZBOOSTER (*Onglet Scalabilité & Quotas*).
3. Bloquer l'IP ou le réseau suspect via Cloud Armor ou Firebase App Check.
