import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Button,
  IconButton,
  Chip,
  Pill,
  Skeleton,
  EmptyState,
  Price,
  Sheet,
} from '../src/components/ui';

describe('Phase 2 : Primitives UI & Design System', () => {
  describe('Button', () => {
    it('rend un bouton avec min-h-[44px] pour conformité tactile mobile', () => {
      const html = renderToString(
        React.createElement(Button, { variant: 'primary', size: 'md' }, 'Confirmer')
      );
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('min-w-[44px]');
      expect(html).toContain('Confirmer');
    });

    it('affiche le loader et désactive le clic en état isLoading', () => {
      const html = renderToString(
        React.createElement(Button, { isLoading: true }, 'Enregistrer')
      );
      expect(html).toContain('disabled=""');
      expect(html).toContain('animate-spin');
      expect(html).toContain('Chargement...');
    });
  });

  describe('IconButton', () => {
    it('impose aria-label et respecte une zone tactile >= 44x44 px', () => {
      const html = renderToString(
        React.createElement(IconButton, {
          'aria-label': 'Fermer la boîte de dialogue',
          icon: React.createElement('span', null, 'X'),
        })
      );
      expect(html).toContain('aria-label="Fermer la boîte de dialogue"');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('min-w-[44px]');
    });
  });

  describe('Chip', () => {
    it('supporte active=true (aria-checked=true) et affiche le compteur', () => {
      const html = renderToString(
        React.createElement(Chip, {
          label: 'Immobilier',
          count: 42,
          active: true,
        })
      );
      expect(html).toContain('role="radio"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('Immobilier');
      expect(html).toContain('42');
      expect(html).toContain('min-h-[44px]');
    });

    it('supporte active=false (aria-checked=false)', () => {
      const html = renderToString(
        React.createElement(Chip, {
          label: 'Véhicules',
          active: false,
        })
      );
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('Véhicules');
    });
  });

  describe('Pill', () => {
    it('rend un badge de statut ou VIP haute visibilité sans texte inférieur à 11px', () => {
      const html = renderToString(
        React.createElement(Pill, { variant: 'vip' }, 'VIP Corner')
      );
      expect(html).toContain('VIP Corner');
      expect(html).toContain('text-[11px]');
      expect(html).toContain('uppercase');
    });
  });

  describe('Price', () => {
    it('formate correctement en FCFA pour le Gabon', () => {
      const html = renderToString(
        React.createElement(Price, { amount: 150000, period: 'mois' })
      );
      expect(html).toContain('150');
      expect(html).toContain('FCFA');
      expect(html).toContain('/mois');
    });

    it('affiche Gratuit si isFree est true', () => {
      const html = renderToString(
        React.createElement(Price, { isFree: true })
      );
      expect(html).toContain('Gratuit');
    });
  });

  describe('EmptyState', () => {
    it('affiche icône, titre, description et bouton d action', () => {
      const html = renderToString(
        React.createElement(EmptyState, {
          icon: React.createElement('div', null, 'icon'),
          title: 'Aucun résultat',
          description: 'Modifiez vos filtres',
          actionLabel: 'Réinitialiser',
          onAction: () => {},
        })
      );
      expect(html).toContain('Aucun résultat');
      expect(html).toContain('Modifiez vos filtres');
      expect(html).toContain('Réinitialiser');
    });
  });

  describe('Sheet', () => {
    it('rend un tiroir dialog accessible avec gestion du safe-area-inset-bottom', () => {
      const html = renderToString(
        React.createElement(
          Sheet,
          {
            isOpen: true,
            onClose: () => {},
            title: 'Filtres de recherche',
            description: 'Sous-titre explicatif',
          },
          React.createElement('p', null, 'Contenu du filtre')
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('id="sheet-title"');
      expect(html).toContain('Filtres de recherche');
      expect(html).toContain('safe-area-inset-bottom');
      expect(html).toContain('Contenu du filtre');
    });
  });
});

