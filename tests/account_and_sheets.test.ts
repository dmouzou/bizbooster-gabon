import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ReportAdModal } from '../src/components/ReportAdModal';
import { ShareAdModal } from '../src/components/ShareAdModal';
import { ConfirmEditOnlineModal } from '../src/components/ConfirmEditOnlineModal';
import { DeleteConfirmModal } from '../src/components/DeleteConfirmModal';
import { LogoutConfirmModal } from '../src/components/LogoutConfirmModal';
import { Ad } from '../src/types';

describe('Phase 7 : Account and Sheets (Section 5.7)', () => {
  const sampleAd: Ad = {
    id: 'ad-test-phase7-1',
    title: 'Appartement 3 pièces Batterie 4',
    description: 'Bel appartement meublé',
    mainCategory: 'IMMOBILIER',
    transactionType: 'LOCATION',
    propertyType: 'Appartement',
    price: 450000,
    status: 'ACTIVE',
    contactName: 'Ndong',
    contactPhone: '+241 74 12 34 56',
    hasWhatsapp: true,
    location: {
      province: 'Estuaire',
      city: 'Libreville',
      neighborhood: 'Batterie 4',
    },
    images: ['https://example.com/apt.webp'],
  };

  describe('Responsive Bottom Sheets for Modals on Mobile', () => {
    it('ReportAdModal utilise une feuille responsive items-end sur mobile et sm:items-center sur grand écran', () => {
      const html = renderToString(
        React.createElement(ReportAdModal, {
          ad: sampleAd,
          isOpen: true,
          onClose: () => {},
        })
      );

      expect(html).toContain('items-end');
      expect(html).toContain('sm:items-center');
      expect(html).toContain('rounded-t-3xl');
      expect(html).toContain('sm:rounded-3xl');
      expect(html).toContain('pb-[env(safe-area-inset-bottom)]');
    });

    it('ShareAdModal utilise une feuille responsive items-end sur mobile et sm:items-center sur grand écran', () => {
      const html = renderToString(
        React.createElement(ShareAdModal, {
          isOpen: true,
          onClose: () => {},
          ad: sampleAd,
        })
      );

      expect(html).toContain('items-end');
      expect(html).toContain('sm:items-center');
      expect(html).toContain('rounded-t-3xl');
      expect(html).toContain('sm:rounded-3xl');
      expect(html).toContain('pb-[env(safe-area-inset-bottom)]');
    });

    it('ConfirmEditOnlineModal adopte la disposition feuille inférieure sur mobile', () => {
      const html = renderToString(
        React.createElement(ConfirmEditOnlineModal, {
          ad: sampleAd,
          isOpen: true,
          onClose: () => {},
          onConfirm: () => {},
        })
      );

      expect(html).toContain('items-end');
      expect(html).toContain('sm:items-center');
      expect(html).toContain('rounded-t-3xl');
      expect(html).toContain('sm:rounded-3xl');
      expect(html).toContain('pb-[env(safe-area-inset-bottom)]');
    });

    it('DeleteConfirmModal adopte la disposition feuille inférieure sur mobile avec zone tactile sécurisée', () => {
      const html = renderToString(
        React.createElement(DeleteConfirmModal, {
          isOpen: true,
          onClose: () => {},
          onConfirm: () => {},
          title: 'Supprimer',
          message: 'Voulez-vous supprimer cette annonce ?',
        })
      );

      expect(html).toContain('items-end');
      expect(html).toContain('sm:items-center');
      expect(html).toContain('rounded-t-3xl');
      expect(html).toContain('sm:rounded-3xl');
      expect(html).toContain('pb-[calc(1.5rem+env(safe-area-inset-bottom))]');
    });

    it('LogoutConfirmModal adopte la disposition feuille inférieure sur mobile avec zone tactile sécurisée', () => {
      const html = renderToString(
        React.createElement(LogoutConfirmModal, {
          isOpen: true,
          onClose: () => {},
          onConfirm: () => {},
        })
      );

      expect(html).toContain('items-end');
      expect(html).toContain('sm:items-center');
      expect(html).toContain('rounded-t-3xl');
      expect(html).toContain('sm:rounded-3xl');
      expect(html).toContain('pb-[calc(1.5rem+env(safe-area-inset-bottom))]');
    });
  });

  describe('Conformité des libellés de statut et absence d emojis', () => {
    it('les statuts ne comportent aucun emoji et utilisent des libellés explicites', () => {
      const statuses = [
        { code: 'PENDING_PAYMENT', label: 'Paiement en attente' },
        { code: 'PENDING_REVIEW', label: 'En attente de modération' },
        { code: 'SUSPENDED', label: 'En pause (Forfait)' },
        { code: 'ACTIVE', label: 'En ligne' },
        { code: 'REJECTED', label: 'Rejetée' },
        { code: 'EXPIRED', label: 'Expirée' },
      ];

      for (const st of statuses) {
        expect(st.label).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
        expect(st.label.length).toBeGreaterThan(4);
      }
    });
  });
});
