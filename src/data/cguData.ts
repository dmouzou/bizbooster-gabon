export interface CguSection {
  id: string;
  title: string;
  content: string[];
}

export const CGU_METADATA = {
  version: '2.4',
  effectiveDate: '3 Octobre 2026',
  jurisdiction: 'République Gabonaise (Tribunaux de Libreville)',
  platform: 'BIZBOOSTER Gabon',
  supportContact: '+241 65 40 30 20 / contact@bizbooster-gabon.ga'
};

export const CGU_SECTIONS: CguSection[] = [
  {
    id: 'preambule',
    title: 'Préambule & Présentation de la Plateforme',
    content: [
      "La plateforme BIZBOOSTER Gabon (ci-après désignée « BIZBOOSTER » ou « la Plateforme ») est un portail numérique d'annonces classées et de mise en relation au Gabon, couvrant l'ensemble des neuf (9) provinces (Estuaire, Haut-Ogooué, Moyen-Ogooué, Ngounié, Nyanga, Ogooué-Ivindo, Ogooué-Lolo, Ogooué-Maritime, Woleu-Ntem).",
      "BIZBOOSTER met à la disposition des personnes physiques et morales résidant ou exerçant une activité au Gabon une infrastructure technique leur permettant de diffuser et de consulter des annonces dans des rubriques spécialisées : Immobilier, Matériel Roulant (Véhicules, Camions, Engins), Bric-à-Brac & Équipements, Emploi & Services à domicile, Cours à domicile, et Nécrologie.",
      "L'accès, l'inscription, la navigation et l'utilisation de BIZBOOSTER impliquent l'acceptation sans réserve de l'intégralité des présentes Conditions Générales d'Utilisation (CGU) et de la Charte Déontologique Annonceur."
    ]
  },
  {
    id: 'acces-compte',
    title: 'Article 1 : Accès au Service, Inscription & Sécurité du Compte',
    content: [
      "L'inscription sur BIZBOOSTER s'effectue au moyen d'un numéro de téléphone mobile gabonais actif et valide (+241 sous opérateur Airtel Gabon ou Moov Africa Gabon Telecom), validé par code de confirmation SMS (OTP).",
      "Chaque utilisateur est personnellement et exclusivement responsable du maintien de la confidentialité de ses identifiants de connexion et de son mot de passe. Toute action réalisée depuis un compte authentifié est réputée avoir été effectuée par le titulaire du compte.",
      "L'utilisateur s'engage à fournir des informations véridiques, exactes et tenues à jour au moment de son inscription et de la publication de ses annonces."
    ]
  },
  {
    id: 'regles-publication',
    title: 'Article 2 : Règles Impératives de Publication des Annonces',
    content: [
      "2.1. Exactitude et réalité des prix : Tout bien, service ou prestation proposé doit comporter un tarif réel, sincère et exprimé en Francs CFA (XAF). Les prix fictifs (ex. 0 FCFA ou 1 FCFA dans l'intention de tromper les filtres) ou manifestement fantaisistes sont formellement prohibés.",
      "2.2. Conformité du descriptif et des photos : Les photographies et vidéos jointes à l'annonce doivent impérativement correspondre à l'objet ou au bien réel proposé. L'utilisation d'images trompeuses, de visuels d'autrui sans droit, ou de photos à caractère diffamatoire ou indécent est strictement interdite.",
      "2.3. Biens et services prohibés : Sont formellement interdits à la publication : les armes à feu et munitions, drogues et stupéfiants, médicaments soumis à prescription médicale, produits contrefaits ou issus de recel, fausse monnaie, espèces protégées de la faune gabonaise, ainsi que tout contenu incitant à la haine, à la violence ou contraire aux bonnes mœurs.",
      "2.4. Spécificités Immobilières : L'annonceur garantit qu'il est propriétaire légitime, mandataire dûment habilité ou agence immobilière mandatée pour le bien proposé. La publication de parcelles sans droit de propriété légitime, sans titre foncier ou sans attestation de cession coutumière authentifiée est interdite.",
      "2.5. Spécificités Véhicules & Matériel Roulant : Tout véhicule mis en vente ou en location doit être en situation douanière régulière au Gabon, disposer d'une carte grise en règle ou de documents douaniers authentiques de dédouanement (SYDONIA / Douanes Gabonaises).",
      "2.6. Spécificités Nécrologie & Avis de Décès : Les annonces d'obsèques et avis de décès doivent émaner des familles légitimes ou de représentants mandatés, dans le strict respect de la dignité humaine et des défunts.",
      "2.7. Spécificités Cours à Domicile : Les enseignants et répétiteurs doivent indiquer loyalement leurs matières d'expertise et leur niveau d'intervention (primaire, collège, lycée, université)."
    ]
  },
  {
    id: 'badge-verifie',
    title: 'Article 3 : Badge « Vérifié » Facultatif & Égalité de Traitement',
    content: [
      "3.1. Caractère optionnel : Conformément aux réalités locales et économiques, la vérification de pièce d'identité (CNI gabonaise, passeport en cours de validité ou carte de séjour) est purement FACULTATIVE. Elle ne constitue en aucun cas une condition obligatoire pour publier une annonce, prolonger une publication ou utiliser les services de paiement.",
      "3.2. Signal de confiance : Le badge « Vérifié » permet aux annonceurs qui le souhaitent de rassurer les acheteurs en confirmant la transmission d'un document officiel d'identification à l'administration de BIZBOOSTER.",
      "3.3. Égalité stricte des annonces : Les annonces publiées par des utilisateurs non vérifiés et celles publiées par des utilisateurs vérifiés sont traitées sur un pied d'égalité absolu en termes de visibilité, d'accès aux catégories, d'indexation, de tarification et de durée."
    ]
  },
  {
    id: 'tarifs-duree',
    title: 'Article 4 : Durée des Annonces, Forfaits & Paiements Mobiles',
    content: [
      "4.1. Durée de validité : Toute annonce est active pour la durée choisie lors de sa publication (de 3 jours à 60 jours renouvelables). Conformément aux règles de sécurité de BIZBOOSTER, le plafond cumulé maximal de validité continue est de 365 jours. Aucune annonce ne peut rester en ligne plus de 365 jours consécutifs sans actualisation.",
      "4.2. Quota gratuit & Abonnements : Tout utilisateur bénéficie de 3 annonces simultanées gratuites (formule Standard). Pour diffuser plus de 3 annonces simultanées, l'annonceur peut souscrire à un forfait professionnel mensuel (Pro : jusqu'à 8 annonces, Élite : jusqu'à 14 annonces, Business : jusqu'à 20 annonces simultanées, plafond maximal absolu de la plateforme).",
      "4.3. Moyens de paiement acceptés : Les options payantes (durée prolongée, photos additionnelles au-delà de 5, vidéo descriptive, boosts En Tête de Liste, forfaits d'abonnement) sont réglées via les solutions de Mobile Money nationales gabonaises : Airtel Money Gabon et Moov Money Gabon.",
      "4.4. Tout achat de boost ou d'option de parution est ferme et non remboursable dès lors que la prestation technique de diffusion a été amorcée."
    ]
  },
  {
    id: 'clause-non-responsabilite',
    title: 'Article 5 : CLAUSE EXHAUSTIVE DE NON-RESPONSABILITÉ (DISCLAIMER OBLIGATOIRE)',
    content: [
      "5.1. Rôle strict d'hébergeur technique : BIZBOOSTER intervient en qualité exclusive d'intermédiaire technique et d'hébergeur de contenus en ligne. La Plateforme n'intervient à aucun titre comme vendeur, acheteur, mandataire, courtier, employeur, garant ou partie aux contrats et transactions convenus entre les utilisateurs.",
      "5.2. Absence de contrôle et d'agrément des biens : BIZBOOSTER n'a pas la possession physique des biens mis en vente ou en location, n'effectue aucun contrôle matériel préalable de leur état de marche, de leur sécurité, de leur authenticité ou de leur conformité aux normes légales ou réglementaires applicables en République Gabonaise.",
      "5.3. Dénégation de garantie : BIZBOOSTER décline expressément toute responsabilité concernant :",
      "- L'exactitude, la véracité ou la mise à jour des descriptifs, caractéristiques, tarifs ou photographies d'annonces rédigées par les annonceurs ;",
      "- L'état mécanique, les vices cachés, l'usure, la légalité douanière ou les pannes des véhicules, engins et matériels roulants achetés ou loués ;",
      "- La validité juridique des titres fonciers, droits coutumiers, litiges successoraux ou autorisations de construire relatifs aux biens immobiliers ;",
      "- La solvabilité financière, la bonne foi, la compétence ou l'honnêteté des acheteurs, vendeurs, locataires, bailleurs, candidats ou employeurs ;",
      "- Les vols, dégradations, escroqueries, litiges financiers ou défauts de livraison survenant dans le cadre de transactions de particulier à particulier ou avec des professionnels.",
      "5.4. Recommandations impératives de sécurité pour les utilisateurs gabonais :",
      "Il est expressément recommandé à tout utilisateur :",
      "a) De toujours organiser les rencontres physiques en plein jour, dans des lieux publics sécurisés, très fréquentés et surveillés (gares routières principales, centres commerciaux, carrefours centraux, à proximité d'établissements administratifs ou commissariats) ;",
      "b) De ne JAMAIS verser d'argent d'avance (acompte, frais de transport, arrhes de réservation, frais de visite de logement ou de terrain) via Mobile Money avant d'avoir vu et inspecté en personne le bien, le logement ou le véhicule et vérifié l'identité du propriétaire ;",
      "c) Pour les véhicules, de faire examiner la voiture par un mécanicien de confiance et de vérifier auprès des services compétents des Transports Terrestres la régularité de la carte grise et du certificat de non-gage avant tout achat ;",
      "d) Pour l'immobilier, d'exiger la présentation physique du titre de propriété original ou de l'acte de cession coutumière validé par l'autorité administrative compétente avant toute transaction financière."
    ]
  },
  {
    id: 'moderation-suspension',
    title: 'Article 6 : Modération des Contenus & Suspension de Compte',
    content: [
      "BIZBOOSTER se réserve le droit de modérer, refuser ou supprimer sans préavis ni indemnité toute annonce ne respectant pas les présentes CGU, la législation gabonaise ou signalée pour tentative de fraude par plusieurs membres.",
      "En cas d'agissements frauduleux avérés, usurpation d'identité, escroquerie avérée ou propos injurieux, BIZBOOSTER se réserve le droit de bloquer définitivement le numéro de téléphone associé et de transmettre les éléments probants aux autorités judiciaires gabonaises compétentes."
    ]
  },
  {
    id: 'donnees-personnelles',
    title: 'Article 7 : Protection des Données & Confidentialité',
    content: [
      "Les données collectées (numéro de téléphone, nom d'annonceur, historique d'annonces) sont traitées conformément aux bonnes pratiques de protection de la vie privée et de sécurité numérique.",
      "BIZBOOSTER s'engage à ne jamais céder, louer ni commercialiser les coordonnées téléphoniques des annonceurs à des tiers à des fins de prospection publicitaire extérieure."
    ]
  },
  {
    id: 'droit-applicable',
    title: 'Article 8 : Droit Applicable & Juridiction Compétente',
    content: [
      "Les présentes Conditions Générales d'Utilisation sont régies et interprétées selon le droit en vigueur en République Gabonaise.",
      "Tout différend, litige ou contestation relatif à l'interprétation, la validité ou l'exécution des présentes CGU, qui n'aurait pu trouver de règlement amiable dans un délai de trente (30) jours, sera soumis à la compétence exclusive des Tribunaux civils et commerciaux de Libreville."
    ]
  }
];
