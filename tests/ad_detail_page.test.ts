import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdDetailPage } from '../src/components/AdDetailPage';
import { Ad } from '../src/types';

describe('Phase 4 : AdDetailPage (Mobile Detail View)', () => {
  const standardAd: Ad = {
    id: 'ad-detail-test-1',
    title: 'Magnifique Villa 5 pièces avec piscine',
    description: 'Une superbe villa située dans le quartier résidentiel de la Sablière avec toutes les commodités, groupe électrogène et forage.',
    mainCategory: 'IMMOBILIER',
    transactionType: 'VENTE',
    propertyType: 'Villa',
    price: 185000000,
    status: 'ACTIVE',
    contactName: 'Alain Bongo',
    contactPhone: '+241 74 11 22 33',
    hasWhatsapp: true,
    isOwnerVerified: true,
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'La Sablière',
    },
    images: [
      'https://firebasestorage.googleapis.com/v0/b/bizbooster.appspot.com/o/ads%2Fp1.webp?alt=media',
      'https://firebasestorage.googleapis.com/v0/b/bizbooster.appspot.com/o/ads%2Fp2.webp?alt=media',
    ],
  };

  it('rend la galerie d images avec scroll-snap CSS natif', () => {
    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: standardAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    // Vérifie le scroll-snap natif CSS
    expect(html).toContain('snap-x snap-mandatory');
    expect(html).toContain('scroll-snap-type:x mandatory');
    // Vérifie le compteur d images (2 photos)
    expect(html).toContain('1 / 2');
    // Vérifie le bouton d agrandissement
    expect(html).toContain('Agrandir en plein écran');
  });

  it('affiche le prix en grand, le titre, la localisation et le badge de transaction', () => {
    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: standardAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('185');
    expect(html).toContain('FCFA');
    expect(html).toContain('Magnifique Villa 5 pièces avec piscine');
    expect(html).toContain('La Sablière');
    expect(html).toContain('À VENDRE');
    expect(html).toContain('Vérifié');
  });

  it('affiche la barre d actions collante en bas avec WhatsApp et Appel de 48px min', () => {
    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: standardAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('WhatsApp');
    expect(html).toContain('Appeler');
    expect(html).toContain('safe-area-inset-bottom');
  });

  it('affiche les caractéristiques clés et la description', () => {
    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: standardAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('Caractéristiques Principales');
    expect(html).toContain('Type de bien');
    expect(html).toContain('Villa');
    expect(html).toContain('Description Détaillée');
    expect(html).toContain('Une superbe villa située dans le quartier résidentiel');
    expect(html).toContain('Alain Bongo');
  });

  it('adapte les libellés et actions pour la catégorie Nécrologie', () => {
    const necrologieAd: Ad = {
      ...standardAd,
      id: 'ad-necro-1',
      mainCategory: 'NECROLOGIE',
      title: 'Avis d obsèques de M. Jean Dupont',
      contactPhone: '+241 77 99 88 77',
    };

    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: necrologieAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('Avis d&#x27;Obsèques &amp; Hommage');
    expect(html).toContain('Condoléances');
    expect(html).toContain('Famille');
    expect(html).not.toContain('FCFA');
  });

  it('adapte les libellés et actions pour la catégorie Avis de recherche', () => {
    const avisAd: Ad = {
      ...standardAd,
      id: 'ad-avis-1',
      mainCategory: 'AVIS_DE_RECHERCHE',
      title: 'Disparition inquiétante d un adolescent',
      contactPhone: '+241 74 55 66 77',
    };

    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: avisAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('Avis de Recherche &amp; Vigilance');
    expect(html).toContain('Signaler');
    expect(html).toContain('Urgence');
    expect(html).not.toContain('FCFA');
  });

  it('affiche les caractéristiques spécifiques d un véhicule', () => {
    const vehicleAd: Ad = {
      ...standardAd,
      id: 'ad-auto-1',
      mainCategory: 'VEHICULES',
      title: 'Toyota Hilux 4x4 Double Cabine',
      vehicleData: {
        category: '4x4, SUV & Pick-up',
        brand: 'Toyota',
        model: 'Hilux',
      },
    };

    const html = renderToString(
      React.createElement(AdDetailPage, {
        ad: vehicleAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('Catégorie véhicule');
    expect(html).toContain('Toyota');
    expect(html).toContain('Hilux');
  });
});
