import { Ad } from '../types';

export const INITIAL_ADS: Ad[] = [
  // 1. IMMOBILIER - LOCATION
  {
    id: 'ad-immo-1',
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
  // 3. IMMOBILIER - LOCATION
  {
    id: 'ad-immo-3',
    title: 'Appartement F3 meublé haut standing',
    mainCategory: 'IMMOBILIER',
    transactionType: 'LOCATION',
    propertyType: 'Appartement',
    location: {
      province: 'Ogooué-Maritime',
      city: 'Port-Gentil',
      neighborhood: 'Chic (Quartier Chic)'
    },
    price: 650000,
    priceUnit: 'mois',
    description: 'Appartement tout équipé 2 chambres avec placards, cuisine américaine, wifi fibre, idéal cadre expatrié ou mission professionnelle à Port-Gentil. Parking sécurisé.',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 74 33 55 90',
    hasWhatsapp: true,
    contactName: 'Agence POG Habitat',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 10000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-POG-772911',
    viewsCount: 198
  },
  // 4. MATÉRIEL ROULANT - VOITURE - VENTE
  {
    id: 'ad-auto-1',
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
  // 5. MATÉRIEL ROULANT - VOITURE - LOCATION
  {
    id: 'ad-auto-2',
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
  // 6. MATÉRIEL ROULANT - CAMIONS BENNES
  {
    id: 'ad-truck-1',
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
  // 7. MATÉRIEL ROULANT - ENGINS DE CHANTIER
  {
    id: 'ad-machinery-1',
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
  // 8. BRIC-À-BRAC
  {
    id: 'ad-bric-1',
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
  // 9. BRIC-À-BRAC - MEUBLE
  {
    id: 'ad-bric-2',
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
  // 10. EMPLOI - NOUNOU
  {
    id: 'ad-emp-1',
    title: 'Nounou expérimentée et attentionnée (garde-bébé)',
    mainCategory: 'EMPLOI',
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
    viewsCount: 312
  },
  // 11. EMPLOI - CUISINIER
  {
    id: 'ad-emp-2',
    title: 'Chef cuisinier spécialités africaines et européennes',
    mainCategory: 'EMPLOI',
    domesticJobType: 'Cuisiniers',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Louis'
    },
    price: 180000,
    priceUnit: 'mois',
    description: 'Cuisinier professionnel diplômé hôtellerie. Maîtrise cuisine locale (Nyembwé, Odika, Poissons braisés) et cuisine internationale. Propre, discret et ponctuel.',
    images: [
      'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 74 11 00 29',
    hasWhatsapp: true,
    contactName: 'Chef Patrick M.',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 9500,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-EMP-992011',
    viewsCount: 220
  },
  // 12. EMPLOI - GARDIEN
  {
    id: 'ad-emp-3',
    title: 'Gardien de nuit vigilant et rigoureux pour villa ou dépôt',
    mainCategory: 'EMPLOI',
    domesticJobType: 'Gardiens de nuit / de jour',
    location: {
      province: 'Estuaire',
      city: 'Owendo',
      neighborhood: 'Alénakiri'
    },
    price: 110000,
    priceUnit: 'mois',
    description: 'Homme 40 ans, ancien agent de sécurité, excellente acuité nocturne. Disponible immédiatement pour surveillance villa privée, entrepôt ou chantier.',
    images: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 65 33 21 80',
    hasWhatsapp: true,
    contactName: 'Samuel O.',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 5500,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-GAR-661029',
    viewsCount: 145
  },
  // 13. IMMOBILIER - VENTE
  {
    id: 'ad-immo-4',
    title: 'Villa moderne neuve 5 pièces finitions soignées',
    mainCategory: 'IMMOBILIER',
    transactionType: 'VENTE',
    propertyType: 'Villa',
    location: {
      province: 'Haut-Ogooué',
      city: 'Franceville',
      neighborhood: 'Ondimba'
    },
    price: 45000000,
    priceUnit: 'total',
    description: 'Belle villa neuve à Ondimba Franceville. 3 chambres avec douches attenantes, grand séjour, cuisine équipée, garage 2 véhicules, clôture avec portail coulissant.',
    images: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 88 12 34',
    hasWhatsapp: true,
    contactName: 'Promoteur Franceville Immo',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'ACTIVE',
    paidAmount: 9500,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-FCV-401923',
    viewsCount: 290
  },
  // 14. EXEMPLE EN ATTENTE DE MODÉRATION (PENDING_REVIEW)
  {
    id: 'ad-pending-1',
    title: 'Appartement meublé 2 chambres - Port-Gentil Bord de Mer',
    mainCategory: 'IMMOBILIER',
    transactionType: 'LOCATION',
    propertyType: 'Appartement',
    location: {
      province: 'Ogooué-Maritime',
      city: 'Port-Gentil',
      neighborhood: 'Grand Village'
    },
    price: 450000,
    priceUnit: 'mois',
    description: 'Appartement T3 entièrement meublé et équipé. Climatisation dans toutes les pièces, terrasse avec vue dégagée, citerne d\'eau et groupe de secours. Idéal expatriés ou cadres pétroliers.',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 66 33 22 11',
    hasWhatsapp: true,
    contactName: 'Mme NGOUELE Sylvie',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'PENDING_REVIEW',
    paidAmount: 9000,
    paymentMethod: 'MOOV_MONEY',
    transactionRef: 'MM-POG-992314',
    viewsCount: 0,
    userId: 'user-sylvie-pog'
  },
  // 15. EXEMPLE EN ATTENTE DE MODÉRATION (MATÉRIEL ROULANT)
  {
    id: 'ad-pending-2',
    title: 'Toyota Hilux Double Cabine 4x4 D4D Diesel 2021',
    mainCategory: 'MATERIEL_ROULANT',
    transactionType: 'VENTE',
    vehicleData: {
      category: 'Voitures',
      brand: 'Toyota',
      model: 'Hilux',
      subType: 'Pick-up 4x4'
    },
    price: 19500000,
    priceUnit: 'total',
    description: 'Toyota Hilux 2.8 D4D boîte manuelle 6 rapports, 65 000 km d\'origine, carnet d\'entretien CFAO Gabon à jour. Pneus tout-terrain neufs, pare-buffle et arceau inox.',
    images: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 77 14 55 90',
    hasWhatsapp: true,
    contactName: 'ETS Gabon Auto Import',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'PENDING_REVIEW',
    paidAmount: 5000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-LBV-551290',
    viewsCount: 0,
    userId: 'user-gabon-auto'
  },
  // 16. EXEMPLE D'ANNONCE REJETÉE AVEC MOTIF
  {
    id: 'ad-rejected-1',
    title: 'Terrain 1000m2 Sabliere pas cher urgent',
    mainCategory: 'IMMOBILIER',
    transactionType: 'VENTE',
    propertyType: 'Terrain / Parcelle',
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'La Sablière'
    },
    price: 3000000,
    priceUnit: 'total',
    description: 'Vend terrain 1000 m2 sablière prix sacrifié urgent besoin argent.',
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80'
    ],
    contactPhone: '+241 62 00 11 22',
    hasWhatsapp: false,
    contactName: 'Particulier',
    durationDays: 365,
    publishedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    status: 'REJECTED',
    moderationReason: 'Prix suspect et absence de référence de titre foncier certifié à La Sablière. Risque avéré de litige foncier.',
    moderatedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    paidAmount: 3000,
    paymentMethod: 'AIRTEL_MONEY',
    transactionRef: 'AM-LBV-102938',
    viewsCount: 0,
    userId: 'user-particulier-sb'
  }
];
