import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdCard } from '../src/components/AdCard';
import { AdCardCompact } from '../src/components/AdCardCompact';
import { BottomTabBar } from '../src/components/navigation/BottomTabBar';
import { SearchRow } from '../src/components/navigation/SearchRow';
import { CategoryChipsRow, CATEGORY_ITEMS } from '../src/components/navigation/CategoryChipsRow';
import { Ad } from '../src/types';

describe('Phase 3 : Shell & Feed Components', () => {
  const sampleAd: Ad = {
    id: 'ad-test-feed-1',
    title: 'Superbe Villa 4 chambres à louer - Sablière',
    description: 'Une description longue qui ne doit plus apparaître sur la carte du flux selon la spécification 5.2.',
    mainCategory: 'IMMOBILIER',
    transactionType: 'LOCATION',
    propertyType: 'Villa',
    price: 850000,
    status: 'ACTIVE',
    contactName: 'Mamadou',
    contactPhone: '+241 74 00 11 22',
    hasWhatsapp: true,
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'La Sablière',
    },
    images: ['https://example.com/photo1.webp'],
  };

  describe('AdCard (Refonte Flux)', () => {
    it('rend le conteneur photo 16:10, le prix en grand (21px), le titre et le lieu', () => {
      const html = renderToString(
        React.createElement(AdCard, {
          ad: sampleAd,
          onSelectAd: () => {},
        })
      );

      expect(html).toContain('aspect-16/10');
      expect(html).toContain('text-[21px]');
      expect(html).toContain('850');
      expect(html).toContain('FCFA');
      expect(html).toContain('Superbe Villa 4 chambres à louer');
      expect(html).toContain('La Sablière');
    });

    it('supprime le bloc de description de 300 caractères conformément au brief 5.2', () => {
      const html = renderToString(
        React.createElement(AdCard, {
          ad: sampleAd,
          onSelectAd: () => {},
        })
      );

      expect(html).not.toContain('Une description longue qui ne doit plus apparaître');
    });

    it('affiche le bouton WhatsApp de 48px et le bouton d appel de 48px', () => {
      const html = renderToString(
        React.createElement(AdCard, {
          ad: sampleAd,
          onSelectAd: () => {},
        })
      );

      expect(html).toContain('min-h-[48px]');
      expect(html).toContain('WhatsApp');
      expect(html).toContain('Appeler par téléphone');
    });

    it('affiche le ruban distinctif pour une annonce Nécrologie', () => {
      const necroAd: Ad = {
        ...sampleAd,
        id: 'ad-necro-1',
        mainCategory: 'NECROLOGIE',
        title: 'Hommage à feu M. Ondo',
      };
      const html = renderToString(
        React.createElement(AdCard, {
          ad: necroAd,
          onSelectAd: () => {},
        })
      );

      expect(html).toContain('Obsèques &amp; Hommage');
      expect(html).toContain('diffusion nationale');
    });
  });

  describe('AdCardCompact (Carte Compacte)', () => {
    it('rend une vignette carrée de 104px, le prix (17px), le titre et le bouton WhatsApp 44px', () => {
      const html = renderToString(
        React.createElement(AdCardCompact, {
          ad: sampleAd,
          onSelectAd: () => {},
        })
      );

      expect(html).toContain('w-[104px]');
      expect(html).toContain('h-[104px]');
      expect(html).toContain('text-[17px]');
      expect(html).toContain('Superbe Villa 4 chambres à louer');
      expect(html).toContain('aria-label="Contacter sur WhatsApp"');
    });
  });

  describe('BottomTabBar (Barre de Navigation Mobile)', () => {
    it('affiche les 5 onglets avec le bouton Publier circulaire de 56px surélevé au centre', () => {
      const html = renderToString(
        React.createElement(BottomTabBar, {
          activeTab: 'home',
          onTabChange: () => {},
          onPublishClick: () => {},
          favoritesCount: 3,
        })
      );

      expect(html).toContain('Accueil');
      expect(html).toContain('Recherche');
      expect(html).toContain('w-14 h-14'); // 56px (14 * 4 = 56px)
      expect(html).toContain('Favoris');
      expect(html).toContain('Compte');
      expect(html).toContain('3'); // Compteur favoris
    });
  });

  describe('CategoryChipsRow (Bandeau de Catégories)', () => {
    it('respecte l ordre des catégories fixé par le brief (Tout, Immobilier, Véhicules, Emploi, Événements...)', () => {
      expect(CATEGORY_ITEMS[0].id).toBe('ALL');
      expect(CATEGORY_ITEMS[1].id).toBe('IMMOBILIER');
      expect(CATEGORY_ITEMS[2].id).toBe('MATERIEL_ROULANT');
      expect(CATEGORY_ITEMS[3].id).toBe('EMPLOI');
      expect(CATEGORY_ITEMS[4].id).toBe('EVENEMENTS');

      const html = renderToString(
        React.createElement(CategoryChipsRow, {
          selectedCategory: 'IMMOBILIER',
          onSelectCategory: () => {},
          categoryCounts: { IMMOBILIER: 25 },
        })
      );

      expect(html).toContain('Immobilier');
      expect(html).toContain('25');
    });
  });

  describe('SearchRow (Ligne de Recherche 48px)', () => {
    it('rend un champ de recherche et un bouton de filtre de 48px minimum', () => {
      const html = renderToString(
        React.createElement(SearchRow, {
          value: '',
          onChange: () => {},
          onOpenFilterSheet: () => {},
          hasActiveFilters: true,
        })
      );

      expect(html).toContain('min-h-[48px]');
      expect(html).toContain('aria-label="Ouvrir les filtres avancés"');
    });
  });
});
