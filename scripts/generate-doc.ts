import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
} from 'docx';
import fs from 'fs';
import path from 'path';

async function generateArchitectureDoc() {
  const doc = new Document({
    creator: 'BIZBOOSTER Engineering Team',
    title: 'BIZBOOSTER Gabon - Architecture Connexion Multi-Applications Firebase',
    description: 'Guide technique complet pour connecter le Frontend Grand Public et le Back-Office Admin sur un même serveur Firebase',
    sections: [
      {
        properties: {},
        children: [
          // Titre Principal
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'BIZBOOSTER GABON',
                bold: true,
                size: 36,
                color: '047857', // emerald-700
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 200 },
            children: [
              new TextRun({
                text: 'GUIDE D\'ARCHITECTURE TECHNIQUE & INTERCONNEXION',
                bold: true,
                size: 24,
                color: '0F172A', // slate-900
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
            children: [
              new TextRun({
                text: 'Comment connecter l\'Application Frontend (Public) et l\'Application Back-Office (Admin) sur la même infrastructure serveur Google Firebase',
                italics: true,
                size: 20,
                color: 'D97706', // amber-600
              }),
            ],
          }),

          // Encadré Résumé
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
                    children: [
                      new Paragraph({
                        spacing: { before: 100, after: 100 },
                        children: [
                          new TextRun({
                            text: 'RÉSUMÉ EXÉCUTIF DU DÉCOUPLAGE :',
                            bold: true,
                            size: 19,
                            color: '0F172A',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 50, after: 50 },
                        children: [
                          new TextRun({
                            text: '• Frontend (App 1) : Dédié aux visiteurs et annonceurs gabonais (consultation gratuite, dépôt payant via Airtel/Moov Money, suivi de ses annonces avec login SMS +241).\n',
                            size: 18,
                          }),
                          new TextRun({
                            text: '• Back-Office Admin (App 2) : Découpé en application distincte pour les administrateurs (validation des annonces PENDING_REVIEW, Observatoire du Marché & BI, gestion des comptes).\n',
                            size: 18,
                          }),
                          new TextRun({
                            text: '• Infrastructure Centrale : 1 seul projet Firebase hébergeant Cloud Firestore, Firebase Auth, Cloud Storage et Firebase Hosting (multi-sites). Aucune duplication de base de données.',
                            size: 18,
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

          // Chapitre 1
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '1. Principes d\'Architecture & Pourquoi un Serveur Unique',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({
                text: 'Plutôt que d\'avoir deux serveurs séparés qui devraient communiquer par des API complexes ou des webhooks redondants, la meilleure pratique consiste à utiliser un seul et unique projet Firebase (ex: "bizbooster-gabon") sur lequel les deux applications se connectent avec des clés de configuration identiques mais des droits de sécurité différenciés.',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 50 },
            children: [
              new TextRun({
                text: 'Avantages déterminants de cette approche :\n',
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: '1. Synchronisation Temps Réel (0 latence) : Dès qu\'un administrateur clique sur "Approuver" dans le Back-Office, l\'annonce passe instantanément en ligne dans le catalogue public des utilisateurs grâce aux websockets natifs de Cloud Firestore.\n' +
                      '2. Facturation & Coûts réduits : Un seul forfait Firebase Spark (gratuit) ou Blaze (à l\'usage), sans surcoût d\'hébergement ou de maintenance d\'un second serveur backend.\n' +
                      '3. Intégrité des Données : Pas de risque de désynchronisation entre la base "Admin" et la base "Client". La source de vérité est unique.\n' +
                      '4. Sécurité étanche : Les règles Firestore Security Rules garantissent au niveau serveur qu\'un utilisateur public ne peut jamais modifier le statut d\'une annonce en "ACTIVE" par lui-même.',
                size: 19,
              }),
            ],
          }),

          // Chapitre 2
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '2. Schéma des Collections Cloud Firestore',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: 'Dans la console Firebase (Firestore Database), créez ou laissez l\'application instancier les collections suivantes :',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 50 },
            children: [
              new TextRun({
                text: '• Collection "ads" (Les Annonces) :\n',
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: 'Contient l\'ensemble des annonces. Chaque document a un statut parmi : "PENDING_REVIEW" (en attente), "ACTIVE" (en ligne), "REJECTED" (refusée), "EXPIRED" (expirée). L\'application Frontend lit uniquement "ACTIVE" dans le catalogue, et le Back-Office lit tous les documents pour la modération.\n\n',
                size: 19,
              }),
              new TextRun({
                text: '• Collection "users" (Comptes Annonceurs & Modérateurs) :\n',
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: 'Stocke le profil lié au numéro gabonais (+241), le nom, l\'opérateur (Airtel/Moov), le rôle ("user" ou "admin") et la date d\'inscription.\n\n',
                size: 19,
              }),
              new TextRun({
                text: '• Collection "moderation_logs" (Traçabilité des Décisions) :\n',
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: 'Enregistre chaque arbitrage (qui a validé/rejeté l\'annonce, à quelle heure, avec quel motif de rejet). Utile pour l\'audit interne et la prévention des fraudes.\n\n',
                size: 19,
              }),
              new TextRun({
                text: '• Collection "system_counters" (Compteurs de l\'Observatoire) :\n',
                bold: true,
                size: 20,
                color: '0F172A',
              }),
              new TextRun({
                text: 'Maintient les agrégats de scalabilité : total des annonces, volume financier en FCFA, moyenne des loyers par quartier, permettant à l\'Observatoire Marché de charger en moins de 100ms même avec des millions d\'annonces.',
                size: 19,
              }),
            ],
          }),

          // Chapitre 3
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '3. Règles de Sécurité Complètes (firestore.rules)',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: 'Copiez-collez le fichier suivant directement dans l\'onglet "Règles" de votre console Firestore dans Firebase. Ces règles assurent que le client public ne peut jamais pirater les statuts :',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Fonction utilitaire pour vérifier si l'utilisateur est administrateur
    function isAdmin() {
      return request.auth != null && 
        (request.auth.token.role == 'admin' || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // RÈGLES DE LA COLLECTION "ads"
    match /ads/{adId} {
      // Tout le monde (même sans compte) peut lire les annonces ACTIVES
      allow read: if resource.data.status == 'ACTIVE' || 
                     (request.auth != null && resource.data.userId == request.auth.uid) ||
                     isAdmin();

      // Un utilisateur connecté peut créer une annonce uniquement avec statut PENDING_REVIEW
      allow create: if request.auth != null 
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status in ['PENDING_REVIEW', 'PENDING_PAYMENT'];

      // Un utilisateur peut modifier ses informations de contact, mais SEUL l'admin peut modifier le statut
      allow update: if isAdmin() || 
                       (request.auth != null 
                        && resource.data.userId == request.auth.uid 
                        && request.resource.data.status == resource.data.status);

      // Seul l'administrateur peut supprimer une annonce
      allow delete: if isAdmin();
    }

    // RÈGLES DE LA COLLECTION "users"
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }

    // RÈGLES DES LOGS DE MODÉRATION & OBSERVATOIRE
    match /moderation_logs/{logId} {
      allow read, write: if isAdmin();
    }

    match /system_counters/{counterId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}`,
                font: 'Courier New',
                size: 17,
                color: '1E293B',
              }),
            ],
          }),

          // Chapitre 4
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '4. Fichiers de Configuration Firebase (.env)',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: 'Dans les deux applications (Frontend et Back-Office), vous utiliserez les MÊMES identifiants Firebase dans le fichier .env :',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: `VITE_FIREBASE_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
VITE_FIREBASE_AUTH_DOMAIN="bizbooster-gabon.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="bizbooster-gabon"
VITE_FIREBASE_STORAGE_BUCKET="bizbooster-gabon.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="XXXXXXXXXXXX"
VITE_FIREBASE_APP_ID="1:XXXXXXXXXXXX:web:XXXXXXXXXXXX"`,
                font: 'Courier New',
                size: 18,
                color: '0F172A',
              }),
            ],
          }),

          // Chapitre 5
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '5. Initialisation du SDK Firebase dans le Code (firebase.ts)',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: 'Créez un fichier src/services/firebase.ts identique dans chaque projet :',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: `import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);`,
                font: 'Courier New',
                size: 18,
                color: '0F172A',
              }),
            ],
          }),

          // Chapitre 6
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '6. Synchronisation Temps Réel (Code Exemple)',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: 'A. Côté Frontend (Écoute des annonces actives) :\n',
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: `import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';

const q = query(collection(db, 'ads'), where('status', '==', 'ACTIVE'));
onSnapshot(q, (snapshot) => {
  const activeAds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setAds(activeAds); // Mise à jour automatique de l'interface !
});`,
                font: 'Courier New',
                size: 17,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 150, after: 100 },
            children: [
              new TextRun({
                text: 'B. Côté Back-Office Admin (Approbation d\'une annonce) :\n',
                bold: true,
                size: 20,
              }),
              new TextRun({
                text: `import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from './services/firebase';

// L'administrateur clique sur "Approuver"
async function handleApproveAd(adId: string) {
  const adRef = doc(db, 'ads', adId);
  await updateDoc(adRef, {
    status: 'ACTIVE',
    publishedAt: new Date().toISOString(),
    moderatedAt: new Date().toISOString(),
  });

  // Enregistrement dans les logs d'audit
  await addDoc(collection(db, 'moderation_logs'), {
    adId,
    action: 'APPROVED',
    moderatorId: currentAdmin.id,
    timestamp: new Date().toISOString(),
  });
}`,
                font: 'Courier New',
                size: 17,
              }),
            ],
          }),

          // Chapitre 7
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '7. Hébergement Multi-Sites (Firebase Hosting)',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: 'Firebase permet d\'héberger plusieurs applications sur un même projet avec des noms de domaine distincts (ex: bizbooster.ga pour le frontend et admin.bizbooster.ga pour le back-office) via la commande "firebase target:apply" :\n\n' +
                      'Configuration dans firebase.json :\n',
                size: 20,
              }),
              new TextRun({
                text: `{
  "hosting": [
    {
      "target": "frontend",
      "public": "frontend-dist",
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "admin",
      "public": "admin-dist",
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  ]
}`,
                font: 'Courier New',
                size: 18,
              }),
            ],
          }),

          // Chapitre 8
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '8. Guide de Démarrage en 5 Étapes Rapides',
                bold: true,
                size: 24,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 50 },
            children: [
              new TextRun({
                text: 'Étape 1 : Allez sur https://console.firebase.google.com et cliquez sur "Ajouter un projet" -> Nommez-le "bizbooster-gabon".\n' +
                      'Étape 2 : Activez "Firestore Database" en mode Production et choisissez la région la plus proche (ex: europe-west1 ou europe-west3).\n' +
                      'Étape 3 : Activez "Authentication" -> Activez "Téléphone" pour le SMS OTP (+241 Gabon) et "Email/Mot de passe" pour le compte Super-Admin.\n' +
                      'Étape 4 : Déployez les règles "firestore.rules" fournies au chapitre 3.\n' +
                      'Étape 5 : Renseignez les clés Firebase dans le fichier .env de l\'application Frontend actuelle et dans le nouveau projet Back-Office Admin.',
                size: 19,
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 100 },
            children: [
              new TextRun({
                text: 'Document officiel rédigé pour le projet BIZBOOSTER Gabon • Reproduction et déploiement immédiat.',
                italics: true,
                size: 18,
                color: '64748B',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

// Generate the doc files
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

generateArchitectureDoc().then((buffer) => {
  // Save as .docx
  const publicDocxPath = path.join(publicDir, 'BIZBOOSTER_Architecture_Connexion_Firebase.docx');
  const rootDocxPath = path.resolve('BIZBOOSTER_Architecture_Connexion_Firebase.docx');
  fs.writeFileSync(publicDocxPath, buffer);
  fs.writeFileSync(rootDocxPath, buffer);
  console.log('Saved DOCX at', publicDocxPath, 'and', rootDocxPath);

  // Also save as .doc (both binary copy and html-doc format for universal compatibility)
  const publicDocPath = path.join(publicDir, 'BIZBOOSTER_Architecture_Connexion_Firebase.doc');
  const rootDocPath = path.resolve('BIZBOOSTER_Architecture_Connexion_Firebase.doc');
  fs.writeFileSync(publicDocPath, buffer);
  fs.writeFileSync(rootDocPath, buffer);
  console.log('Saved DOC at', publicDocPath, 'and', rootDocPath);
});
