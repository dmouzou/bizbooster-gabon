import { Ad } from '../types';

export const INITIAL_ADS: Ad[] = [
  // 1. IMMOBILIER - LOCATION
  {
    id: 'ad-immo-1',
    isTest: true,
    title: 'Superbe Villa 4 chambres avec piscine et groupe',
    mainCategory: 'IMMOBILIER',
    transactionType: 'LOCATION',
    propertyType: 'Villa',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'La Sablière'
    },
    price: 1500000,
    priceUnit: 'mois',
    description: 'Villa de standing à La Sablière. 4 chambres autonomes, grand salon climatisé, piscine, bâche à eau, surpresseur et groupe électrogène automatique. Gardiennage 24/7.',
    images: [
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 45 20 18',
    hasWhatsapp: true,
    contactName: 'Cabinet Immobilier Ogooué Prestige',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 10000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-GAB-849204',
    viewsCount: 245
  },
  // 2. IMMOBILIER - VENTE
  {
    id: 'ad-immo-2',
    isTest: true,
    title: 'Parcelle clôturée 800 m² avec titre foncier',
    mainCategory: 'IMMOBILIER',
    transactionType: 'VENTE',
    propertyType: 'Terrain / Parcelle',
    location: {
      province: 'Estuaire',
      city: 'Akanda',
      neighborhood: 'Angondjé Château'
    },
    price: 28000000,
    priceUnit: 'total',
    description: 'Belle parcelle plate de 800 m² prête à bâtir. Titre foncier global disponible, bornage officiel fait. Zone viabilisée SEEG eau et électricité à proximité immédiate.',
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 66 12 89 04',
    hasWhatsapp: true,
    contactName: 'M. MBA Jean-Pierre',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 5500,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-LBV-391028',
    viewsCount: 389
  },
  // 3. MATÉRIEL ROULANT - VOITURE - VENTE
  {
    id: 'ad-auto-1',
    isTest: true,
    title: 'Toyota Hilux Double Cabine 4x4 D4D climatisé',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'VENTE',
    vehicleData: {
      category: 'Voitures',
      brand: 'TOYOTA',
      model: 'Hilux'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Louis'
    },
    price: 18500000,
    priceUnit: 'total',
    description: 'Toyota Hilux 2021 boîte manuelle, moteur diesel D4D en parfait état. 68 000 km réels. Pneus neufs tout terrain, pare-buffle et marchepieds. Documents douanes ok.',
    images: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 65 88 41 22',
    hasWhatsapp: true,
    contactName: 'Auto Gabon Import',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 10000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-AUT-992140',
    viewsCount: 512
  },
  // 4. MATÉRIEL ROULANT - VOITURE - LOCATION
  {
    id: 'ad-auto-2',
    isTest: true,
    title: 'Hyundai Santa Fe 2022 Tout Confort pour location',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'LOCATION',
    vehicleData: {
      category: 'Voitures',
      brand: 'HYUNDAI',
      model: 'Santa Fe'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Batterie 4'
    },
    price: 60000,
    priceUnit: 'jour',
    description: 'Hyundai Santa Fe 7 places disponible pour courses en ville ou déplacements province. Boîte automatique, intérieur cuir noir, climatisation glaciale. Chauffeur sur demande.',
    images: [
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 19 40 55',
    hasWhatsapp: true,
    contactName: 'Prestige Car Rental Libreville',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 5500,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-AUT-110482',
    viewsCount: 310
  },
  // 5. MATÉRIEL ROULANT - CAMIONS BENNES
  {
    id: 'ad-truck-1',
    isTest: true,
    title: 'Camion Benne HOWO Sinotruk 10 roues 20m³',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'VENTE',
    vehicleData: {
      category: 'Camions Bennes',
      brand: 'HOWO / SINOTRUK',
      model: 'Benne 371 HP'
    },
    location: {
      province: 'Estuaire',
      city: 'Owendo',
      neighborhood: 'Port d\'Owendo'
    },
    price: 34000000,
    priceUnit: 'total',
    description: 'Camion Benne Sinotruk HOWO 6x4, benne renforcée pour carrière de sable ou gravier. Moteur 371 CV révisé, ponts lourds, benne hydraulique impeccable. Prêt à travailler.',
    images: [
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 62 10 90 80',
    hasWhatsapp: true,
    contactName: 'BTP & Logistique Gabon',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 9500,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-TRK-449102',
    viewsCount: 420
  },
  // 6. MATÉRIEL ROULANT - ENGINS DE CHANTIER
  {
    id: 'ad-machinery-1',
    isTest: true,
    title: 'Pelleteuse CAT 320D sur chenilles disponible',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'LOCATION',
    vehicleData: {
      category: 'Engins de chantiers',
      model: 'Pelleteuses (Excavatrices)'
    },
    location: {
      province: 'Haut-Ogooué',
      city: 'Moanda',
      neighborhood: 'Commercial'
    },
    price: 350000,
    priceUnit: 'jour',
    description: 'Pelleteuse Caterpillar 320D en excellent état de marche avec chauffeur opérateur qualifié. Idéal terrassement, déforestage ou travaux miniers vers Moanda/Franceville.',
    images: [
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 74 99 22 15',
    hasWhatsapp: true,
    contactName: 'Engins TP Haut-Ogooué',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 16000,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-TP-830219',
    viewsCount: 160
  },
  // 7. BRIC-À-BRAC - SMARTPHONE
  {
    id: 'ad-bric-1',
    isTest: true,
    title: 'iPhone 14 Pro Max 256Go Gold état neuf',
    mainCategory: 'BRIC_A_BRAC',
    transactionType: 'VENTE',
    bricCategory: 'Électronique & Smartphones',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Mont-Bouët'
    },
    price: 490000,
    priceUnit: 'total',
    description: 'iPhone 14 Pro Max 256 Go original avec facture et boîte. Batterie 94%. Vendu avec chargeur d\'origine 20W rapide et coque de protection offerte.',
    images: [
      'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 65 40 30 20',
    hasWhatsapp: true,
    contactName: 'Boutique Tech Express',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 3000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-TEL-552199',
    viewsCount: 275
  },
  // 8. BRIC-À-BRAC - MEUBLE
  {
    id: 'ad-bric-2',
    isTest: true,
    title: 'Salon d\'angle en cuir beige 6 places avec table',
    mainCategory: 'BRIC_A_BRAC',
    transactionType: 'VENTE',
    bricCategory: 'Meubles & Décoration',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Charbonnages'
    },
    price: 320000,
    priceUnit: 'total',
    description: 'Grand salon en cuir véritable, très propre, aucune déchirure. Cause déménagement vers Franceville. Table basse vitrée offerte avec le lot.',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 56 43 11',
    hasWhatsapp: true,
    contactName: 'Mme Ondeno',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 5500,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-MEU-741289',
    viewsCount: 188
  },
  // 9. EMPLOI - NOUNOU (DEMANDE D'EMPLOI)
  {
    id: 'ad-emp-1',
    isTest: true,
    title: 'Nounou expérimentée et attentionnée (garde-bébé)',
    mainCategory: 'EMPLOI',
    jobKind: 'DEMANDE_EMPLOI',
    transactionType: 'CHERCHE_EMPLOI',
    domesticJobType: 'Nounous (garde-bébé)',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Angondjé'
    },
    price: 130000,
    priceUnit: 'mois',
    description: 'Dame gabonaise 34 ans sérieuse avec 8 ans d\'expérience auprès des nourrissons et tout-petits. Références vérifiables disponibles, patiente et formée aux premiers secours.',
    images: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 66 70 82 14',
    hasWhatsapp: true,
    contactName: 'Clarisse B.',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 9500,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-EMP-102938',
    viewsCount: 312,
    isOwnerVerified: true
  },
  // 10. COURS À DOMICILE - OFFRE MATHS & PC
  {
    id: 'ad-cours-1',
    isTest: true,
    title: 'Cours de soutien en Mathématiques et Physique-Chimie (Collège & Lycée)',
    mainCategory: 'COURS_A_DOMICILE',
    transactionType: 'VENTE',
    tutoringData: {
      kind: 'OFFRE',
      subject: 'Mathématiques',
      level: 'Lycée'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Angondjé'
    },
    price: 35000,
    priceUnit: 'mois',
    description: 'Enseignant certifié avec 8 ans d\'expérience propose suivi personnalisé et remise à niveau en Mathématiques et Sciences Physiques. Préparation intensive aux épreuves du BAC C et D. Déplacements à domicile sur Akanda et Libreville nord.',
    images: [
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 66 12 34 56',
    hasWhatsapp: true,
    contactName: 'Prof. Jean-Marc M.',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 3000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-EDU-881290',
    viewsCount: 142,
    isOwnerVerified: true
  },
  // 11. NÉCROLOGIE - ÉDUCATION NATIONALE
  {
    id: 'ad-necro-1',
    isTest: true,
    title: 'Avis d\'obsèques et hommage - M. Paul-Émile MVE (Inspecteur Pédagogique retraité)',
    mainCategory: 'NECROLOGIE',
    necrologieData: {
      ministry: 'Éducation nationale',
      deceasedName: 'Paul-Émile MVE',
      ceremonyDate: 'Samedi 10 Octobre 2026',
      ceremonyLocation: 'Église Sainte-Marie de Libreville',
      funeralProgram: 'Veillée mortuaire au domicile familial de Glass le vendredi soir, messe de requiem à Sainte-Marie le samedi à 10h, suivie de l\'inhumation au cimetière de Lalala.',
      familyContact: '+241 62 44 55 66'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Glass'
    },
    price: 0,
    priceUnit: 'total',
    description: 'La grande famille MVE et alliés ont la profonde douleur d\'annoncer le rappel à Dieu de leur père, grand-père et collègue Paul-Émile MVE, survenu dans sa 74e année. Le programme des obsèques est communiqué à l\'attention de la communauté éducative nationale.',
    images: [
      'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 62 44 55 66',
    hasWhatsapp: true,
    contactName: 'Famille MVE',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 43200000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 3000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-NEC-102931',
    viewsCount: 450,
    isOwnerVerified: true
  },
  // 12. IMMOBILIER - CORNER VIP (VENTE PRESTIGE)
  {
    id: 'ad-immo-vip-1',
    isTest: true,
    isVipCorner: true,
    title: 'Propriété de Maître - Villa Prestige vue océan avec piscine à débordement',
    mainCategory: 'IMMOBILIER',
    transactionType: 'VENTE',
    propertyType: 'Villa',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'La Sablière'
    },
    price: 195000000,
    priceUnit: 'total',
    description: 'Propriété d\'exception située à La Sablière. 6 suites de maître climatisées, vaste salon cathédrale, cuisine italienne équipée, piscine à débordement avec vue sur l\'océan, guérite de sécurité avec caméras, groupe électrogène 100 kVA automatique et bâche à eau 10 000L. Titre foncier individuel disponible.',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 10 20 30',
    hasWhatsapp: true,
    contactName: 'Agence Immobilière Prestige Gabon',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 16000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-VIP-994821',
    viewsCount: 520,
    isOwnerVerified: true
  },
  // 13. MATÉRIEL ROULANT - CORNER VIP (VENTE VÉHICULE DE LUXE)
  {
    id: 'ad-auto-vip-1',
    isTest: true,
    isVipCorner: true,
    title: 'Toyota Land Cruiser 300 ZX V6 Twin-Turbo 2024 - Neuf 0 km',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'VENTE',
    vehicleData: {
      category: 'Voitures',
      brand: 'TOYOTA',
      model: 'Land Cruiser 300 ZX'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Batterie IV'
    },
    price: 88000000,
    priceUnit: 'total',
    description: 'Toyota Land Cruiser Série 300 ZX, moteur V6 Bi-Turbo essence 415 ch, boîte automatique 10 rapports, intérieur cuir beige ventilé, écran multimédia 12.3 pouces, système audio JBL 14 haut-parleurs, suspension adaptative AVS, toit ouvrant. Véhicule dédouané, carte grise gabonaise immédiate.',
    images: [
      'https://images.unsplash.com/photo-1594502184342-2e12f877aa73?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 65 33 22 11',
    hasWhatsapp: true,
    contactName: 'Prestige Motors Libreville',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 16000,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-VIP-338210',
    viewsCount: 680,
    isOwnerVerified: true
  },
  // 14. MATÉRIEL ROULANT - CORNER VIP (LOCATION HAUT DE GAMME)
  {
    id: 'ad-auto-vip-2',
    isTest: true,
    isVipCorner: true,
    title: 'Range Rover V8 Autobiography avec chauffeur de sécurité - Mise à disposition',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'LOCATION',
    vehicleData: {
      category: 'Voitures',
      brand: 'LAND ROVER',
      model: 'Range Rover Autobiography'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Centre-ville'
    },
    price: 150000,
    priceUnit: 'jour',
    description: 'Location exclusive Range Rover Autobiography pour personnalités d\'affaires, délégations diplomatiques et événements officiels. Chauffeur professionnel bilingue formé à la conduite sécurisée, climatisation quadrizone, vitres teintées sécurisées, confort d\'exception.',
    images: [
      'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 74 88 99 00',
    hasWhatsapp: true,
    contactName: 'VIP Executive Transport Gabon',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 9500,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-VIP-773120',
    viewsCount: 310,
    isOwnerVerified: true
  },
  // 15. AVIS DE RECHERCHE - TITRE FONCIER ET DOCUMENTS ÉGARÉS
  {
    id: 'ad-avis-1',
    isTest: true,
    title: 'Avis de recherche urgent - Pochette avec Titre Foncier et Passeports égarés',
    mainCategory: 'AVIS_DE_RECHERCHE',
    avisRechercheData: {
      category: 'Document ou Titre officiel perdu',
      targetName: 'Titre Foncier N° 5812 & 2 Passeports gabonais',
      lastSeenLocation: 'Zone PK8 / Gare routière de Libreville',
      lastSeenDate: 'Lundi 5 Octobre 2026 vers 16h',
      hasReward: true,
      rewardAmount: 250000,
      contactEmergency: '+241 77 90 12 34'
    },
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'PK8'
    },
    price: 0,
    priceUnit: 'total',
    description: 'Une sacoche noire en cuir contenant le dossier original d\'un Titre Foncier ainsi que deux passeports gabonais au nom de la famille OBIANG a été oubliée dans un taxi collectif vers le rond-point du PK8. Forte récompense de 250 000 FCFA promise à toute personne rapportant le dossier intact.',
    images: [
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 90 12 34',
    hasWhatsapp: true,
    contactName: 'M. OBIANG Marc',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 3000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-AVIS-194021',
    viewsCount: 420,
    isOwnerVerified: true
  },
  // 16. AUTRES EMPLOIS - DEMANDEUR D'EMPLOI AVEC CV ATTACHÉ (SANS PHOTO OBLIGATOIRE)
  {
    id: 'ad-emploi-cv-1',
    isTest: true,
    title: 'Comptable Senior & Contrôleur de Gestion (10 ans d\'expérience) - CV disponible',
    mainCategory: 'AUTRES_EMPLOIS',
    transactionType: 'CHERCHE_EMPLOI',
    autresEmploisData: {
      subCategory: "Demandeur d'emploi",
      profession: 'Comptable Senior / Chef Comptable',
      experienceYears: 'Plus de 8 ans',
      contractType: 'CDI',
      cvFileName: 'CV_Serge_Ndong_Chef_Comptable_2026.pdf',
      cvFileType: 'pdf',
      cvFileSize: 145000
    },
    cvUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cvFileName: 'CV_Serge_Ndong_Chef_Comptable_2026.pdf',
    cvFileType: 'pdf',
    cvFileSize: 145000,
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Mont-Bouët'
    },
    price: 650000,
    priceMax: 850000,
    priceUnit: 'mois',
    description: 'Cadre comptable diplômé Bac+5 en audit et contrôle de gestion. Maîtrise avancée de Sage 100 Cloud, SYSCOHADA révisé, déclarations fiscales DGI/CNSS et reporting financier. Disponible immédiatement pour poste de Responsable Administratif et Financier ou Chef Comptable. CV ci-joint.',
    images: [],
    contactPhone: '+241 66 78 90 12',
    hasWhatsapp: true,
    contactName: 'Serge-Arsène NDONG',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 3000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-EMP-849201',
    viewsCount: 290,
    isOwnerVerified: true
  },
  // 17. AUTRES EMPLOIS - OFFRE D'EMPLOI AVEC FICHE DE POSTE TÉLÉVERSÉE (OPTIONNELLE)
  {
    id: 'ad-emploi-offre-1',
    isTest: true,
    title: 'Recrutement : Responsable Logistique et Opérations Flotte (H/F)',
    mainCategory: 'AUTRES_EMPLOIS',
    transactionType: 'EMPLOYER',
    autresEmploisData: {
      subCategory: "Offre d'emploi",
      profession: 'Responsable Logistique & Flotte',
      experienceYears: '5 à 7 ans',
      contractType: 'CDI',
      jobDocUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      jobDocFileName: 'Fiche_Poste_Responsable_Logistique.pdf',
      jobDocFileType: 'pdf',
      jobDocFileSize: 185000
    },
    jobDocUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    jobDocFileName: 'Fiche_Poste_Responsable_Logistique.pdf',
    jobDocFileType: 'pdf',
    jobDocFileSize: 185000,
    cvUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cvFileName: 'Fiche_Poste_Responsable_Logistique.pdf',
    cvFileType: 'pdf',
    cvFileSize: 185000,
    location: {
      province: 'Estuaire',
      city: 'Owendo',
      neighborhood: 'Port d\'Owendo'
    },
    price: 750000,
    priceUnit: 'mois',
    description: 'Société de transport et logistique basée à Owendo recherche son Responsable Logistique et Flotte. Missions : supervision de la flotte poids lourds, optimisation des tournées, gestion des stocks et maintenance préventive. Fiche de poste complète disponible en téléchargement.',
    images: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 74 15 26 37',
    hasWhatsapp: true,
    contactName: 'Direction des Ressources Humaines',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 5500,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-EMP-991204',
    viewsCount: 512,
    isOwnerVerified: true
  }
];
