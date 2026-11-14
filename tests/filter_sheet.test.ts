import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FilterSheet, FilterSheetProps } from '../src/components/FilterSheet';
import { ActiveFilterChips } from '../src/components/ActiveFilterChips';

describe('Phase 5 : FilterSheet & ActiveFilterChips', () => {
  describe('ActiveFilterChips', () => {
    it('rend les puces de filtres actifs et le bouton effacer tout', () => {
      const mockRemove = vi.fn();
      const mockReset = vi.fn();

      const html = renderToString(
        React.createElement(ActiveFilterChips, {
          chips: [
            { id: '1', label: 'À Louer', onRemove: mockRemove },
            { id: '2', label: 'Estuaire', onRemove: mockRemove },
          ],
          onResetAll: mockReset,
        })
      );

      expect(html).toContain('À Louer');
      expect(html).toContain('Estuaire');
      expect(html).toContain('Effacer tout');
    });

    it('ne rend rien si la liste de puces est vide', () => {
      const html = renderToString(
        React.createElement(ActiveFilterChips, {
          chips: [],
        })
      );

      expect(html).toBe('');
    });
  });

  describe('FilterSheet', () => {
    const defaultProps: FilterSheetProps = {
      isOpen: true,
      onClose: () => {},
      activeCategory: 'IMMOBILIER',
      resultsCount: 42,
      immoTransaction: 'LOCATION',
      onChangeImmoTransaction: () => {},
      immoPropertyType: 'Villa',
      onChangeImmoPropertyType: () => {},
      immoProvince: 'Estuaire',
      onChangeImmoProvince: () => {},
      immoCity: 'Libreville',
      onChangeImmoCity: () => {},
      immoNeighborhood: 'La Sablière',
      onChangeImmoNeighborhood: () => {},
      vehicleSubcategory: 'ALL',
      onChangeVehicleSubcategory: () => {},
      vehicleBrand: '',
      onChangeVehicleBrand: () => {},
      vehicleModel: '',
      onChangeVehicleModel: () => {},
      vehicleTransaction: 'ALL',
      onChangeVehicleTransaction: () => {},
      emploiJobKind: 'ALL',
      onChangeEmploiJobKind: () => {},
      emploiJobType: 'ALL',
      onChangeEmploiJobType: () => {},
      emploiProvince: '',
      onChangeEmploiProvince: () => {},
      emploiCity: '',
      onChangeEmploiCity: () => {},
      tutoringKind: 'ALL',
      onChangeTutoringKind: () => {},
      tutoringSubject: 'ALL',
      onChangeTutoringSubject: () => {},
      tutoringLevel: 'ALL',
      onChangeTutoringLevel: () => {},
      tutoringProvince: '',
      onChangeTutoringProvince: () => {},
      tutoringCity: '',
      onChangeTutoringCity: () => {},
      necroMinistry: 'ALL',
      onChangeNecroMinistry: () => {},
      avisFilterCategory: 'ALL',
      onChangeAvisFilterCategory: () => {},
      autresEmploisFilterSub: 'ALL',
      onChangeAutresEmploisFilterSub: () => {},
      eventFilterType: 'ALL',
      onChangeEventFilterType: () => {},
      globalTransaction: 'ALL',
      onChangeGlobalTransaction: () => {},
      isVipCornerActive: false,
      onToggleVipCorner: () => {},
      onResetAllFilters: () => {},
    };

    it('rend le titre, les sections repliables et le pied de page collant avec le nombre de résultats', () => {
      const html = renderToString(React.createElement(FilterSheet, defaultProps));

      expect(html).toContain('Filtrer les annonces');
      expect(html).toContain('Transaction &amp; Bien');
      expect(html).toContain('Localisation au Gabon');
      expect(html).toContain('Réinitialiser');
      expect(html).toContain('Voir 42 résultats');
    });

    it('affiche les options spécifiques de la catégorie Immobilier', () => {
      const html = renderToString(React.createElement(FilterSheet, defaultProps));

      expect(html).toContain('Type d&#x27;opération');
      expect(html).toContain('À Louer');
      expect(html).toContain('À Vendre');
      expect(html).toContain('Type de bien');
      expect(html).toContain('Toutes les 9 provinces');
      expect(html).toContain('Estuaire');
      expect(html).toContain('Libreville');
      expect(html).toContain('La Sablière');
    });

    it('affiche les options spécifiques de la catégorie Matériel Roulant', () => {
      const html = renderToString(
        React.createElement(FilterSheet, {
          ...defaultProps,
          activeCategory: 'MATERIEL_ROULANT',
          vehicleSubcategory: 'Voitures',
          vehicleBrand: 'Toyota',
        })
      );

      expect(html).toContain('Catégorie &amp; Transaction');
      expect(html).toContain('Marque &amp; Modèle');
      expect(html).toContain('Tous les véhicules et engins');
      expect(html).toContain('Toutes les marques');
      expect(html).toContain('TOYOTA');
    });

    it('affiche les options spécifiques de la catégorie Emploi', () => {
      const html = renderToString(
        React.createElement(FilterSheet, {
          ...defaultProps,
          activeCategory: 'EMPLOI',
          emploiJobKind: 'OFFRE_EMPLOI',
        })
      );

      expect(html).toContain('Offre / Demande &amp; Métier');
      expect(html).toContain('Offres d&#x27;emploi');
      expect(html).toContain('Demandeurs');
      expect(html).toContain('Tous les métiers domestiques');
    });

    it('affiche les options spécifiques de la catégorie Nécrologie', () => {
      const html = renderToString(
        React.createElement(FilterSheet, {
          ...defaultProps,
          activeCategory: 'NECROLOGIE',
        })
      );

      expect(html).toContain('Ministère / Corps de rattachement');
      expect(html).toContain('Tous les ministères et corps');
    });

    it('ne rend rien si isOpen est false', () => {
      const html = renderToString(
        React.createElement(FilterSheet, {
          ...defaultProps,
          isOpen: false,
        })
      );

      expect(html).toBe('');
    });
  });
});
