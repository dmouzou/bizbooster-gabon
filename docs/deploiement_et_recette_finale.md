# BIZBOOSTER Gabon - Guide de Déploiement et Recette Finale de Production (Phase 7 - Étape 7.2)

Document de recette et de déploiement officiel clôturant l'audit complet du Panneau Administratif, des Règles de Sécurité et du Système de Notifications In-App de BIZBOOSTER Gabon.

---

## 1. Synthèse de Réalisation des 7 Phases d'Audit

| Phase | Intitulé & Objectif | Réalisations Clés | Statut |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Cadrage, isolation et traçabilité | - Périmètre passerelle SingPay sanctuarisé (aucun fichier de paiement modifié).<br>- Stratégie de branches Git `audit/phase-*` avec commits atomiques par étape. | **Validé (100%)** |
| **Phase 1** | Sécurité Firestore & Données Critiques | - Élimination des 20 vulnérabilités (S-01 à S-20).<br>- Interdiction d'écriture des champs `password`, `rankingKeys`, `consumedFreeAdsCount`.<br>- Restriction KYC, ad_counters et system_counters. | **Validé (100%)** |
| **Phase 2** | Système de Notifications In-App | - Durée d'affichage fixée strictement à 15 secondes avec pause au survol (B-05).<br>- File d'attente FIFO persistée dans IndexedDB/LocalStorage.<br>- Déduplication 10 minutes anti-spam. | **Validé (100%)** |
| **Phase 3** | Sécurité Cloud Functions & Modération | - Callables modulaires sécurisés (`rejectAd`, `deleteAd`, `approveKyc`, `resubmitAd`).<br>- Dédoublonnage 24h et isolation de `registerView` sur `ad_counters/{adId}`.<br>- Transaction atomique sur le traitement des signalements anti-fraude. | **Validé (100%)** |
| **Phase 4** | Panneau d'Administration & Rôles | - Protection RBAC stricte (`ADMIN` vs `SUPER_ADMIN`).<br>- Nouvel onglet Scalabilité & Quotas avec calcul UTC+1 (fuseau horaire du Gabon).<br>- Script et tests de purge du champ `password` résiduel (S-03). | **Validé (100%)** |
| **Phase 5** | Application Publique & Profil Utilisateur | - Sécurisation du profil `useUserProfile` avec `id: fbUser.uid`.<br>- Correction B-03 : hooks déclarés avant tout early return dans `AdDetailModal`.<br>- Validation stricte des URLs média Firebase Storage / Unsplash (S-14). | **Validé (100%)** |
| **Phase 6** | Cohérence des Données & Accessibilité | - Types canoniques et script de backfill pour `necro*` et `tutoring*`.<br>- Filtrage rigoureux de `isTestAd` dans `RealTimeAnalytics` et prise en charge des 8 catégories.<br>- Harmonisation z-index (`z-40` notifications, `z-50` base, `z-60` confirmation/alertes).<br>- Accessibilité WCAG (`role="dialog"`, `aria-labelledby`, `motion-reduce`). | **Validé (100%)** |
| **Phase 7** | Capacité & Exploitation | - `setGlobalOptions` Cloud Functions v2 avec plafonds d'instances (`maxInstances: 10`).<br>- Documentation des quotas Firestore/SMS et alertes GCP Billing.<br>- Validation complète du build de production et tests de non-régression. | **Validé (100%)** |

---

## 2. Procédure de Déploiement en Production

### Pré-requis
1. Être authentifié sur le CLI Firebase : `firebase login`
2. Sélectionner le projet de production : `firebase use default` (ou projet cible BIZBOOSTER)
3. Valider que la suite de tests locale est verte :
   ```bash
   npm test
   npm run test:rules
   npx tsc --noEmit
   npm --prefix functions run build
   ```

### Ordre Séquentiel de Déploiement

#### Étape 1 : Règles de Sécurité et Index Firestore
Déployer les règles Firestore et les index en premier afin que les nouvelles contraintes de sécurité soient actives avant tout code applicatif :
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

#### Étape 2 : Règles de Sécurité Cloud Storage
Déployer les règles de stockage pour protéger les documents KYC et les images d'annonces :
```bash
firebase deploy --only storage
```

#### Étape 3 : Cloud Functions v2
Compiler et déployer les fonctions Cloud Functions durcies avec leurs limites d'instances :
```bash
npm --prefix functions run build
firebase deploy --only functions
```

#### Étape 4 : Applications Frontend & Admin (Hosting)
Compiler les deux applications puis déployer vers Firebase Hosting :
```bash
npm run build
firebase deploy --only hosting
```

---

## 3. Checklist de Recette Finale Post-Déploiement

### A. Sécurité et Authentification
- [ ] Tenter d'injecter un champ `password` via la console client ou le SDK ➔ Refusé avec `PERMISSION_DENIED`.
- [ ] Vérifier qu'un utilisateur standard ne peut pas s'auto-attribuer `role: 'ADMIN'` ni modifier `consumedFreeAdsCount`.
- [ ] Vérifier la connexion avec les numéros de test Firebase Auth sans débit SMS.
- [ ] Confirmer que les documents KYC dans Cloud Storage ne sont téléchargeables que par le propriétaire et les administrateurs.

### B. Modération et Annonces
- [ ] Rejeter une annonce depuis le Panneau Admin ➔ L'annonce passe à `REJECTED`, une notification est créée pour l'utilisateur, et une entrée atomique est inscrite dans `moderation_logs`.
- [ ] Corriger et réémettre l'annonce via `resubmitAd` ➔ L'annonce repasse à `PENDING_REVIEW` et nettoie `moderationReason`.
- [ ] Vérifier que `registerView` incrémente `ad_counters/{adId}` sans déclencher de relecture massive du catalogue `ads`.

### C. Expérience Utilisateur et Notifications
- [ ] Déclencher une notification In-App ➔ La bannière reste affichée 15 secondes.
- [ ] Survoler la notification avec la souris ➔ Le décompte et la barre de progression se mettent immédiatement en pause.
- [ ] Ouvrir une boîte de dialogue de confirmation (ex: suppression) ➔ La boîte s'affiche au-dessus des notifications (`z-60` vs `z-40`).
- [ ] Appuyer sur la touche `Escape` ➔ La modale se ferme proprement.

### D. Supervision et Budgets
- [ ] Vérifier la bonne réception des métriques dans l'onglet *Scalabilité & Quotas* de l'AdminPanel.
- [ ] Vérifier que les alertes budgétaires 50%, 90% et 100% sont actives dans GCP Cloud Billing.
