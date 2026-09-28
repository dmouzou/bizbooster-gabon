import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

function createAdminSpecPDF(outputPath: string) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Helper colors
  const primaryColor = '#047857'; // emerald-700
  const secondaryColor = '#0f172a'; // slate-900
  const accentColor = '#d97706'; // amber-600
  const mutedColor = '#64748b'; // slate-500
  const lightBg = '#f8fafc';

  // Helper functions
  const addHeader = (title: string, level = 1) => {
    if (doc.y > 680) doc.addPage();
    doc.moveDown(level === 1 ? 1.2 : 0.8);
    if (level === 1) {
      doc.rect(50, doc.y, 495, 26).fill('#ecfdf5');
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
         .text(title, 58, doc.y + 6);
      doc.moveDown(0.8);
    } else if (level === 2) {
      doc.fillColor(secondaryColor).fontSize(12).font('Helvetica-Bold')
         .text(title);
      doc.moveDown(0.3);
    } else {
      doc.fillColor(accentColor).fontSize(10.5).font('Helvetica-Bold')
         .text(title);
      doc.moveDown(0.2);
    }
  };

  const addParagraph = (text: string) => {
    if (doc.y > 720) doc.addPage();
    doc.fillColor('#334155').fontSize(9.5).font('Helvetica').lineGap(2.5)
       .text(text, { align: 'justify' });
    doc.moveDown(0.4);
  };

  const addBullet = (label: string, text: string) => {
    if (doc.y > 730) doc.addPage();
    doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold')
       .text(`• ${label}: `, { continued: true })
       .fillColor('#334155').font('Helvetica')
       .text(text);
    doc.moveDown(0.25);
  };

  // --- PAGE 1: COVER PAGE ---
  doc.rect(50, 50, 495, 742).stroke('#cbd5e1');
  doc.rect(55, 55, 485, 732).lineWidth(2).stroke(primaryColor);

  doc.moveDown(4);
  doc.fillColor(primaryColor).fontSize(28).font('Helvetica-Bold')
     .text('BIZBOOSTER GABON', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor(secondaryColor).fontSize(16).font('Helvetica-Bold')
     .text('CAHIER DES CHARGES FONCTIONNEL & TECHNIQUE', { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor(accentColor).fontSize(13).font('Helvetica-Bold')
     .text('APPLICATION BACK-OFFICE / ADMIN PANEL & OBSERVATOIRE MARCHÉ', { align: 'center' });

  doc.moveDown(2);
  doc.rect(100, doc.y, 395, 2).fill(primaryColor);
  doc.moveDown(2);

  doc.fillColor('#475569').fontSize(10.5).font('Helvetica').lineGap(4)
     .text(
       'Document de spécification intégrale destiné à la création autonome de la seconde application (Back-Office d\'Administration, File de Modération & Observatoire du Marché) pour la plateforme BIZBOOSTER au Gabon.\n\n' +
       'Ce document détaille chaque écran, composant, workflow d\'approbation, métrique décisionnelle, modèle de données et règle de sécurité nécessaires au développement immédiat de l\'application Admin.',
       120, doc.y, { width: 355, align: 'center' }
     );

  doc.moveDown(4);
  const infoY = 560;
  doc.rect(100, infoY, 395, 130).fill('#f1f5f9');
  doc.fillColor(secondaryColor).fontSize(10).font('Helvetica-Bold')
     .text('RÉSUMÉ DU PROJET & MÉTADONNÉES', 120, infoY + 15);
  doc.font('Helvetica').fontSize(9).fillColor('#334155');
  doc.text('• Application Cible : BIZBOOSTER Back-Office Admin & Observatoire BI', 120, infoY + 35);
  doc.text('• Marché Visé : République Gabonaise (9 Provinces, 100% Mobile Money)', 120, infoY + 52);
  doc.text('• Architecture : App React/TypeScript autonome connectée à Firebase', 120, infoY + 69);
  doc.text('• Devise monétaire : Franc CFA (XAF / FCFA) sans décimale', 120, infoY + 86);
  doc.text('• Version du document : v2.0 - Édition Spéciale Découplage', 120, infoY + 103);

  // --- PAGE 2: TABLE DES MATIÈRES & INTRODUCTION ---
  doc.addPage();
  doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold')
     .text('SOMMAIRE DU CAHIER DES CHARGES');
  doc.rect(50, doc.y + 4, 495, 2).fill(primaryColor);
  doc.moveDown(1.5);

  const tocItems = [
    '1. Contexte, Rôle & Philosophie du Back-Office BIZBOOSTER',
    '2. Architecture Logicielle & Découplage avec le Frontend Public',
    '3. Authentification Admin, Contrôle d\'Accès & Sécurité (RBAC)',
    '4. Module 1 : File de Modération des Annonces (Workflow Avant-Publication)',
    '5. Module 2 : Observatoire du Marché en Temps Réel & Business Intelligence',
    '6. Module 3 : Gestion du Répertoire des Annonceurs (+241)',
    '7. Module 4 : Audit de Scalabilité, Sizing & Métriques de Performance',
    '8. Modèle de Données Partagé (TypeScript Interfaces & Firestore Collections)',
    '9. Matrice des Rôles & Règles de Sécurité Firestore (firestore.rules)',
    '10. Guide de Recette, Tests d\'Acceptation & Déploiement',
  ];

  tocItems.forEach((item, index) => {
    doc.fillColor(secondaryColor).fontSize(10.5).font('Helvetica-Bold')
       .text(item, { continued: true })
       .font('Helvetica').fillColor(mutedColor)
       .text(` .............................................................. Page ${index + 2}`, { align: 'right' });
    doc.moveDown(0.5);
  });

  addHeader('1. Contexte, Rôle & Philosophie du Back-Office BIZBOOSTER');
  addParagraph(
    'BIZBOOSTER est la plateforme numérique de référence d\'annonces classées et commerciales au Gabon. Afin de garantir une intégrité absolue et un niveau de qualité irréprochable sur le catalogue public, aucune annonce payée par un annonceur (via Airtel Money ou Moov Money) n\'est immédiatement diffusée en direct. Chaque annonce soumise transite d\'abord par un sas de vérification sous le statut PENDING_REVIEW.'
  );
  addParagraph(
    'L\'application Back-Office / Admin est une application distincte, autonome, réservée aux modérateurs, administrateurs et analystes économiques de BIZBOOSTER. Elle concentre tous les pouvoirs d\'arbitrage éditorial, de surveillance de la fraude, de pilotage financier et d\'analyse macroéconomique du marché gabonais (immobilier, véhicules, biens de consommation, opportunités d\'emploi).'
  );

  // --- PAGE 3: ARCHITECTURE & AUTHENTIFICATION ---
  doc.addPage();
  addHeader('2. Architecture Logicielle & Découplage Frontend / Admin');
  addParagraph(
    'Le système BIZBOOSTER est rigoureusement séparé en deux applications indépendantes :'
  );
  addBullet(
    'Application 1 (Frontend Public)',
    'Dédiée au grand public et aux annonceurs. Consultation 100% libre et gratuite, recherche géolocalisée par Province/Ville/Quartier, dépôt d\'annonces avec simulation Mobile Money (+241) et espace personnel annonceur.'
  );
  addBullet(
    'Application 2 (Back-Office Admin)',
    'Dédiée exclusivement au personnel habilité. Interface sombre/dense de type cockpit opérationnel, file de modération temps réel, observatoire économique BI, gestion des comptes annonceurs et surveillance de la charge infrastructure.'
  );
  addBullet(
    'Niveau de Liaison',
    'Les deux applications partagent la même base de données Cloud Firestore et le même bucket de stockage Cloud Storage, garantissant une propagation instantanée des décisions de modération vers le catalogue public.'
  );

  addHeader('3. Authentification Admin, Contrôle d\'Accès & Sécurité (RBAC)');
  addParagraph(
    'L\'accès au Back-Office est strictement restreint. Contrairement au Frontend public qui utilise l\'authentification par SMS OTP sur les numéros gabonais (+241), le Back-Office implémente une double barrière de contrôle :'
  );
  addBullet(
    'Authentification Super-Admin / Opérateur',
    'Connexion par identifiant sécurisé / email d\'entreprise avec mot de passe fort et/ou Code PIN Superviseur (ex: code 2410 en environnement de supervision).'
  );
  addBullet(
    'Session Guard & Persistance Sécurisée',
    'La session d\'administration est stockée en sessionStorage chiffré ou via Firebase Auth Custom Claims (role: "admin"). Toute fermeture de navigateur ou inactivité prolongée (15 minutes) verrouille instantanément le cockpit.'
  );
  addBullet(
    'Matrice des Niveaux de Privilèges',
    'Modérateur Junior (validation/rejet d\'annonces avec motifs), Super-Admin (suppression définitive, statistiques financières, bannissement d\'annonceurs frauduleux), Analyste BI (accès exclusif en lecture à l\'Observatoire du Marché).'
  );

  // --- PAGE 4: MODULE 1 FILE DE MODÉRATION ---
  doc.addPage();
  addHeader('4. Module 1 : File de Modération des Annonces');
  addParagraph(
    'Ce module constitue le cœur opérationnel quotidien des équipes de modération BIZBOOSTER. Il garantit la propreté du catalogue public, la vérification des photos et le respect des rubriques géographiques du Gabon.'
  );

  addHeader('4.1 Filtres & Vues de la File', 2);
  addParagraph(
    'L\'administrateur dispose de 4 onglets d\'état pour filtrer la file :'
  );
  addBullet('En attente (PENDING_REVIEW)', 'Priorité absolue. Affiche le compteur rouge/ambre des annonces soumises venant d\'être payées et nécessitant une décision.');
  addBullet('En ligne (ACTIVE)', 'Annonces approuvées visibles par les acheteurs sur le Frontend public.');
  addBullet('Rejetées (REJECTED)', 'Annonces refusées avec motif explicite communiqué à l\'annonceur.');
  addBullet('Expirées (EXPIRED)', 'Annonces ayant dépassé leur durée de validité (7, 14 ou 30 jours).');

  addHeader('4.2 Anatomie d\'une Fiche d\'Annonce en Modération', 2);
  addParagraph(
    'Chaque fiche de modération présente de manière condensée et ultra-lisible :'
  );
  addBullet('Galerie Visuelle Haute Définition', 'Carrousel de photos avec zoom inspecteur + badge vidéo si l\'annonceur a fourni un lien vidéo/visite virtuelle.');
  addBullet('Rubriques Géographiques Strictes', 'Province (Estuaire, Woleu-Ntem, Haut-Ogooué, etc.), Ville (Libreville, Port-Gentil, Franceville, Oyem, etc.), Quartier précis (ex: Louis, Batterie IV, Glass, Angondjé) et Carrefour de repère.');
  addBullet('Transaction & Typologie', 'Distinction impérative VENTE vs LOCATION, nature du bien (Villa, Appartement, Studio, Terrain 500m², Pick-up 4x4 Hilux, Berline, etc.).');
  addBullet('Données Financières & Paiement', 'Prix affiché en FCFA, montant acquitté (ex: 2 000 FCFA pour 7j, 3 500 FCFA pour 14j, 6 000 FCFA pour 30j), Opérateur (Airtel Money ou Moov Money) et Référence de Transaction (ex: AM-9481023).');
  addBullet('Identité de l\'Annonceur', 'Nom ou raison sociale, numéro de téléphone (+241 07X ou 06X) avec bouton direct WhatsApp pour vérification d\'authenticité.');

  addHeader('4.3 Actions & Arbitrages de Modération', 2);
  addBullet('Bouton Approuver & Publier', 'Bascule le statut en ACTIVE, calcule la date d\'expiration (publishedAt + durationDays), génère le log d\'audit et rend l\'annonce visible immédiatement sur le Frontend.');
  addBullet('Bouton Rejeter avec Motif', 'Ouvre une modale avec sélection obligatoire d\'un motif parmi les standards prédéfinis :');
  doc.fillColor('#475569').fontSize(9).font('Helvetica-Oblique')
     .text('    1. Photos floues, non conformes ou comportant des filigranes interdits\n' +
           '    2. Non-respect de la catégorie ou localisation erronée\n' +
           '    3. Prix manifestement irréaliste, sous-évalué ou suspect\n' +
           '    4. Contenu frauduleux, contrefaçon ou escroquerie potentielle\n' +
           '    5. Numéro de téléphone gabonais invalide ou non joignable', { indent: 20 });
  doc.moveDown(0.3);
  addParagraph(
    'L\'administrateur peut compléter par un message personnalisé. L\'annonceur verra ce motif directement dans son espace utilisateur sur le Frontend pour corriger son annonce.'
  );
  addBullet('Bouton Supprimer Définitivement', 'Réservé aux cas de spams manifestes ou d\'escroqueries récurrentes avec suppression irréversible du document.');

  // --- PAGE 5: MODULE 2 OBSERVATOIRE DU MARCHÉ ---
  doc.addPage();
  addHeader('5. Module 2 : Observatoire du Marché en Temps Réel & Business Intelligence');
  addParagraph(
    'Exclusivement intégré au Back-Office Admin (conformément aux directives du projet), l\'Observatoire du Marché transforme les flux d\'annonces bruts en un outil décisionnel stratégique sur l\'économie gabonaise.'
  );

  addHeader('5.1 Indicateurs Clés de Performance (KPIs Globaux)', 2);
  addBullet('Volume Financier du Catalogue', 'Somme des valeurs vénales de tous les biens immobiliers et matériels roulants actifs (exprimé en Francs CFA et Millions/Milliards de FCFA).');
  addBullet('Recettes Mobile Money Collectées', 'Total cumulé des paiements des annonces ventilé entre Airtel Money Gabon et Moov Money Africa.');
  addBullet('Taux d\'Approbation Editorial', 'Ratio annonces validées vs rejetées avec délai moyen de modération (objectif < 15 minutes).');

  addHeader('5.2 Observatoire Immobilier Gabon', 2);
  addBullet('Distribution Vente vs Location', 'Ratio comparatif des offres à la vente par rapport aux biens proposés en location mensuelle.');
  addBullet('Argus des Loyers par Province & Quartier', 'Moyenne des loyers mensuels à Libreville (Angondjé, Akanda, Batterie IV, Louis, Mont-Bouët), Port-Gentil, Franceville et Oyem.');
  addBullet('Typologie des Biens', 'Répartition entre Appartements (2-3 pièces), Villas de standing, Terrains titrés (surfaces en m²) et Locaux commerciaux.');

  addHeader('5.3 Observatoire Matériel Roulant & Véhicules', 2);
  addBullet('Palmarès des Marques Leader au Gabon', 'Classement des véhicules en stock (Toyota avec Hilux/Prado/RAV4, Mitsubishi Pajero, Nissan Patrol/Qashqai, Hyundai, Suzuki, Mercedes-Benz).');
  addBullet('Véhicules Vente vs Location Journalière', 'Analyse du marché de la location de voitures à la journée (25 000 à 60 000 FCFA/jour) vs achat comptant.');

  addHeader('5.4 Observatoire Financier & Trésorerie Mobile Money', 2);
  addBullet('Répartition par Opérateur Télécom', 'Part de marché d\'Airtel Money (074, 076, 077) vs Moov Money (060, 062, 065, 066) dans les règlements de dépôts.');
  addBullet('Formules Privilégiées', 'Statistiques de souscription : Formule Flash 7 jours (2 000 F), Formule Standard 14 jours (3 500 F), Formule Sérénité 30 jours (6 000 F).');

  // --- PAGE 6: MODULES 3 & 4 (ANNONCEURS & SCALABILITÉ) ---
  doc.addPage();
  addHeader('6. Module 3 : Gestion du Répertoire des Annonceurs (+241)');
  addParagraph(
    'Le Back-Office Admin intègre un CRM simplifié dédié à la base d\'utilisateurs identifiés par leur numéro gabonais :'
  );
  addBullet('Annuaire des Annonceurs', 'Tableau récapitulatif : Nom, Numéro vérifié (+241), Opérateur détecté (logo Airtel / Moov), Date du premier dépôt, Total d\'annonces déposées, Annonces actives et Total des paiements injectés.');
  addBullet('Filtre de Réputation & Fraude', 'Possibilité de trier par annonceurs ayant subi des rejets multiples et action de blocage / mise sur liste noire du numéro en cas d\'abus.');
  addBullet('Export des Données', 'Capacité d\'exporter au format CSV ou JSON la liste des contacts pour des campagnes SMS de fidélisation commerciale.');

  addHeader('7. Module 4 : Audit de Scalabilité, Sizing & Métriques de Performance');
  addParagraph(
    'Le tableau de bord technique assure la supervision de la montée en charge pour couvrir l\'ensemble du territoire gabonais :'
  );
  addBullet('Trafic Lecture Grand Public (CDN)', 'Dimensionné pour absorber de 100 000 à plus de 1 000 000 de visiteurs simultanés consultant le catalogue public sans toucher la base de données centrale grâce à la mise en cache HTTP et CDN Firebase/Cloudflare.');
  addBullet('Trafic Écriture & Base de Données', 'Capacité de 10 000 écritures par seconde avec Firestore, sharding automatique des compteurs de vues et gestion asynchrone des transactions de paiement.');
  addBullet('Débit Passerelle SMS OTP (+241)', 'Capacité d\'envoi de 500 à 1 000 SMS par seconde sur les plages télécoms gabonaises (Airtel Gabon & Moov Africa) via agrégateurs SMS (Twilio, Infobip ou Africa\'s Talking).');

  // --- PAGE 7: MODÈLE DE DONNÉES & RÈGLES FIRESTORE ---
  doc.addPage();
  addHeader('8. Modèle de Données Partagé (TypeScript Interfaces)');
  addParagraph(
    'Pour assurer une synchronisation parfaite entre le Frontend et ce Back-Office, l\'entité Ad doit respecter exactement les champs suivants :'
  );
  doc.fillColor('#0f172a').fontSize(8).font('Courier')
     .text(
`export interface Ad {
  id: string;
  title: string;
  description: string;
  mainCategory: 'IMMOBILIER' | 'MATERIEL_ROULANT' | 'BRIC_A_BRAC' | 'EMPLOI';
  transactionType: 'VENTE' | 'LOCATION';
  price: number; // En FCFA
  priceUnit?: 'GLOBAL' | 'PAR_MOIS' | 'PAR_JOUR' | 'PAR_M2';
  
  // Localisation Gabon
  location: {
    province: string;     // Ex: Estuaire, Ogooué-Maritime, etc.
    city: string;         // Ex: Libreville, Port-Gentil, etc.
    neighborhood: string; // Ex: Angondjé, Louis, etc.
    crossroad?: string;   // Ex: Carrefour Camp de Police
  };
  
  // Médias
  images: string[];
  videoUrl?: string;

  // Données métiers spécialisées
  propertyType?: string;
  vehicleData?: {
    category: string;
    brand: string;
    model: string;
    year?: number;
    mileage?: number;
    transmission?: 'MANUELLE' | 'AUTOMATIQUE';
    fuelType?: 'ESSENCE' | 'DIESEL' | 'HYBRIDE';
  };

  // Statuts & Workflow de Modération
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'REJECTED';
  moderationReason?: string;
  moderatedAt?: string;

  // Coordonnées Annonceur
  contactPhone: string; // Format +241 XX XX XX XX
  contactName: string;
  userId?: string;

  // Paiement & Validité
  durationDays: number;
  publishedAt: string;
  expiresAt: string;
  paidAmount: number;
  paymentMethod: 'AIRTEL_MONEY' | 'MOOV_MONEY';
  transactionRef: string;
  viewsCount: number;
}`, { lineGap: 1.5 });

  doc.moveDown(0.8);
  addHeader('9. Matrice des Rôles & Sécurité Firestore');
  addParagraph(
    'Les règles de sécurité firestore.rules garantissent l\'étanchéité des deux applications :'
  );
  addBullet('Frontend Public (visiteur non authentifié)', 'Droit de lecture restreint aux documents où status == "ACTIVE". Aucune écriture directe.');
  addBullet('Frontend Annonceur (authentifié par SMS)', 'Droit de créer une annonce uniquement avec status == "PENDING_REVIEW" ou "PENDING_PAYMENT". Modification restreinte à ses propres annonces.');
  addBullet('Back-Office Admin (token admin ou secret claim)', 'Droit absolu de lecture sur tous les statuts et droit de mise à jour des champs status, moderationReason et moderatedAt.');

  // --- PAGE 8: TESTS & RECETTE ---
  doc.addPage();
  addHeader('10. Guide de Recette, Tests d\'Acceptation & Déploiement');
  addParagraph(
    'Pour valider la conformité de l\'application Back-Office développée, l\'équipe de développement devra vérifier les scénarios d\'acceptation suivants :'
  );
  addBullet('Test 1 - Contrôle d\'accès', 'L\'application doit refuser l\'accès au cockpit tant que le code PIN ou l\'authentification admin n\'est pas validée.');
  addBullet('Test 2 - Réception d\'une nouvelle annonce', 'Lorsqu\'une annonce est soumise sur le Frontend avec succès, elle doit apparaître instantanément dans l\'onglet "En attente" du Back-Office avec le statut PENDING_REVIEW.');
  addBullet('Test 3 - Approbation & Bascule live', 'Le clic sur "Approuver & Mettre en Ligne" doit immédiatement basculer l\'annonce en ACTIVE et la rendre visible dans le catalogue public sans rafraîchir la page.');
  addBullet('Test 4 - Rejet motivé', 'Le rejet d\'une annonce avec motif doit empêcher sa publication sur le Frontend et afficher le motif exact dans l\'Espace Annonceur.');
  addBullet('Test 5 - Observatoire temps réel', 'Les graphiques et statistiques de l\'Observatoire doivent recalculer automatiquement les moyennes des loyers et le volume du catalogue dès qu\'une annonce est modifiée.');

  doc.moveDown(2);
  doc.rect(50, doc.y, 495, 60).fill('#ecfdf5');
  doc.fillColor(primaryColor).fontSize(10.5).font('Helvetica-Bold')
     .text('CONCLUSION & PROCHAINES ÉTAPES', 65, doc.y + 12);
  doc.font('Helvetica').fontSize(9).fillColor('#065f46')
     .text(
       'Ce document constitue le référentiel complet pour instancier la seconde application BIZBOOSTER Admin. En fournissant ce fichier au générateur d\'application, l\'ensemble de l\'architecture, des écrans et des logiques métiers seront reproduits à l\'identique.',
       65, doc.y + 4, { width: 465 }
     );

  // Add page numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
       .text(
         `BIZBOOSTER Gabon • Back-Office Cahier des Charges • Page ${i + 1} sur ${pages.count}`,
         50,
         795,
         { align: 'center', width: 495 }
       );
  }

  doc.end();
}

// Generate to both public and root directory
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const targetPublicPath = path.join(publicDir, 'BIZBOOSTER_Cahier_des_Charges_BackOffice_Admin.pdf');
const targetRootPath = path.resolve('BIZBOOSTER_Cahier_des_Charges_BackOffice_Admin.pdf');

createAdminSpecPDF(targetPublicPath);
console.log(`Generated PDF at ${targetPublicPath}`);

// Copy to root as well
setTimeout(() => {
  if (fs.existsSync(targetPublicPath)) {
    fs.copyFileSync(targetPublicPath, targetRootPath);
    console.log(`Copied PDF to ${targetRootPath}`);
  }
}, 500);
