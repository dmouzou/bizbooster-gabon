import { describe, it, expect } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';
import { DeleteConfirmModal } from '../src/components/DeleteConfirmModal';
import { LogoutConfirmModal } from '../src/components/LogoutConfirmModal';
import { ReportAdModal } from '../src/components/ReportAdModal';
import { ShareAdModal } from '../src/components/ShareAdModal';
import { AdDetailModal } from '../src/components/AdDetailModal';
import { Ad } from '../src/types';

describe('Étape 6.3 : Modals, Accessibilité et Style (I-06)', () => {
  const sampleAd: Ad = {
    id: 'ad-modal-1',
    title: 'Maison duplex à vendre',
    mainCategory: 'IMMOBILIER',
    transactionType: 'VENTE',
    price: 65000000,
    status: 'ACTIVE',
    contactName: 'Jean Dupont',
    contactPhone: '+241 77 12 34 56',
  };

  it('DeleteConfirmModal intègre z-60, role dialog, aria-modal et aria-labelledby', () => {
    const html = renderToString(
      React.createElement(DeleteConfirmModal, {
        isOpen: true,
        onClose: () => {},
        onConfirm: () => {},
        adTitle: sampleAd.title,
      })
    );

    expect(html).toContain('z-60');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="delete-confirm-title"');
    expect(html).toContain('id="delete-confirm-title"');
    expect(html).toContain('aria-label="Fermer"');
  });

  it('LogoutConfirmModal intègre z-60, role dialog, aria-modal et aria-labelledby', () => {
    const html = renderToString(
      React.createElement(LogoutConfirmModal, {
        isOpen: true,
        onClose: () => {},
        onConfirm: () => {},
      })
    );

    expect(html).toContain('z-60');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="logout-confirm-title"');
    expect(html).toContain('id="logout-confirm-title"');
    expect(html).toContain('aria-label="Fermer"');
  });

  it('ReportAdModal intègre z-60, role dialog, aria-modal et support motion-reduce', () => {
    const html = renderToString(
      React.createElement(ReportAdModal, {
        isOpen: true,
        ad: sampleAd,
        onClose: () => {},
      })
    );

    expect(html).toContain('z-60');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="report-ad-title"');
    expect(html).toContain('id="report-ad-title"');
    expect(html).toContain('aria-label="Fermer"');
    expect(html).toContain('motion-reduce:animate-none');
  });

  it('ShareAdModal intègre z-60, role dialog, aria-modal et aria-labelledby', () => {
    const html = renderToString(
      React.createElement(ShareAdModal, {
        isOpen: true,
        ad: sampleAd,
        onClose: () => {},
      })
    );

    expect(html).toContain('z-60');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="share-ad-title"');
    expect(html).toContain('id="share-ad-title"');
    expect(html).toContain('aria-label="Fermer"');
  });

  it('AdDetailModal intègre role dialog, aria-modal, aria-labelledby et aria-label', () => {
    const html = renderToString(
      React.createElement(AdDetailModal, {
        ad: sampleAd,
        onClose: () => {},
        onOpenExtendModal: () => {},
      })
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="ad-detail-title"');
    expect(html).toContain('id="ad-detail-title"');
    expect(html).toContain('aria-label="Fermer"');
  });

  it('InAppNotificationModal applique z-40 (inférieur aux modals z-50/z-60) et motion-reduce', () => {
    const modalPath = path.resolve(__dirname, '../src/components/InAppNotificationModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    // Vérifie qu'il n'y a plus de z-[9999] et que z-40 est utilisé
    expect(content).not.toContain('z-[9999]');
    expect(content).toContain('z-40');
    expect(content).toContain('motion-reduce:animate-none');
    expect(content).toContain('aria-label="Fermer la notification"');
  });
});
