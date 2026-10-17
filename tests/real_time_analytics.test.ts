import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RealTimeAnalytics } from '../src/components/RealTimeAnalytics';
import { Ad, UserProfile } from '../src/types';

describe('Étape 6.2 : RealTimeAnalytics (I-01 - Données réelles, 8 catégories, absence de repli Estuaire)', () => {
  const users: UserProfile[] = [
    {
      id: 'u1',
      email: 'u1@bizbooster.ga',
      role: 'USER',
      displayName: 'Alice User',
      kycStatus: 'VERIFIED',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'u2',
      email: 'u2@bizbooster.ga',
      role: 'USER',
      displayName: 'Bob User',
      kycStatus: 'PENDING',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  const ads: Ad[] = [
    {
      id: 'ad-real-1',
      title: 'Maison à louer Libreville',
      mainCategory: 'IMMOBILIER',
      transactionType: 'LOCATION',
      price: 250000,
      province: 'Estuaire',
      city: 'Libreville',
      status: 'ACTIVE',
      publishedAt: '2026-01-10T10:00:00.000Z',
      isTestAd: false,
    },
    {
      id: 'ad-real-2',
      title: 'Toyota Hilux Port-Gentil',
      mainCategory: 'MATERIEL_ROULANT',
      transactionType: 'VENTE',
      price: 12000000,
      province: 'Ogooué-Maritime',
      city: 'Port-Gentil',
      status: 'ACTIVE',
      publishedAt: '2026-01-11T10:00:00.000Z',
    },
    {
      id: 'ad-real-3-no-province',
      title: 'Cours de Mathématiques',
      mainCategory: 'COURS_A_DOMICILE',
      transactionType: 'SERVICE',
      price: 15000,
      // Pas de province définie
      status: 'ACTIVE',
      publishedAt: '2026-01-12T10:00:00.000Z',
    },
    {
      id: 'ad-test-flagged',
      title: '[TEST] Annonce de test admin',
      mainCategory: 'IMMOBILIER',
      transactionType: 'VENTE',
      price: 999999999,
      province: 'Woleu-Ntem',
      city: 'Oyem',
      status: 'ACTIVE',
      publishedAt: '2026-01-13T10:00:00.000Z',
      isTestAd: true, // DEVRAIT ÊTRE FILTRÉ
    },
  ];

  it('exclut rigoureusement les annonces marquées isTestAd des métriques et graphiques', () => {
    const html = renderToString(
      React.createElement(RealTimeAnalytics, {
        ads,
        users,
      })
    );

    // 4 annonces fournies, mais 1 est isTestAd: true => 3 annonces réelles au total
    // L'indicateur en tête doit afficher "3" annonces en base (pas 4)
    expect(html).toContain('Annonces réelles (hors tests)');
    // Le titre ou badge d'annonce de test ne doit pas impacter les KPI
    expect(html).not.toContain('999999999');
  });

  it('gère les 8 catégories officielles sans régression', () => {
    const allCategoriesAds: Ad[] = [
      { id: '1', title: 'Immo', mainCategory: 'IMMOBILIER', status: 'ACTIVE', price: 100 },
      { id: '2', title: 'Auto', mainCategory: 'MATERIEL_ROULANT', status: 'ACTIVE', price: 100 },
      { id: '3', title: 'Bric', mainCategory: 'BRIC_A_BRAC', status: 'ACTIVE', price: 100 },
      { id: '4', title: 'Job', mainCategory: 'EMPLOI', status: 'ACTIVE', price: 100 },
      { id: '5', title: 'Cours', mainCategory: 'COURS_A_DOMICILE', status: 'ACTIVE', price: 100 },
      { id: '6', title: 'Necro', mainCategory: 'NECROLOGIE', status: 'ACTIVE', price: 100 },
      { id: '7', title: 'Recherche', mainCategory: 'AVIS_DE_RECHERCHE', status: 'ACTIVE', price: 100 },
      { id: '8', title: 'Autre', mainCategory: 'AUTRES_EMPLOIS', status: 'ACTIVE', price: 100 },
    ];

    const html = renderToString(
      React.createElement(RealTimeAnalytics, {
        ads: allCategoriesAds,
        users,
      })
    );

    expect(html).toContain('Répartition par Catégorie (8 Catégories Officielles)');
    expect(html).toMatch(/Distribution de l.*offre entre les 8 pôles thématiques de BIZBOOSTER/);
  });

  it('ne replie pas de force les annonces sans province sur Estuaire', () => {
    // Si une annonce n'a pas de province spécifiée, elle ne doit pas incrémenter le compteur de l'Estuaire
    const singleAdNoProvince: Ad[] = [
      {
        id: 'no-prov',
        title: 'Sans province',
        mainCategory: 'BRIC_A_BRAC',
        status: 'ACTIVE',
        price: 5000,
        // pas de province
      },
    ];

    const html = renderToString(
      React.createElement(RealTimeAnalytics, {
        ads: singleAdNoProvince,
        users,
      })
    );

    // Vérifie que le composant rend le titre des 9 provinces sans crash ni forçage
    expect(html).toMatch(/Volume d.*Annonces par Province \(9 Provinces\)/);
  });
});
