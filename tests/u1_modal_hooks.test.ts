import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReportAdModal } from '../src/components/ReportAdModal';
import { ShareAdModal } from '../src/components/ShareAdModal';
import { KycUploadModal } from '../src/components/KycUploadModal';
import { ExtendAdModal } from '../src/components/ExtendAdModal';
import { AppAlertModal } from '../src/components/AppAlertModal';
import type { Ad, UserProfile } from '../src/types';

const SAMPLE_AD: Ad = {
  id: 'sample-ad-1',
  title: 'Annonce exemple',
  mainCategory: 'IMMOBILIER',
  price: 150000,
  description: 'Description exemple',
  contactPhone: 'Non renseigné',
  contactName: 'Annonceur Exemple',
  durationDays: 14,
  status: 'ACTIVE',
  userId: 'sample-owner-1',
};

const SAMPLE_USER: UserProfile = {
  id: 'sample-owner-1',
  name: 'Annonceur Exemple',
  isVerified: false,
  termsAccepted: true,
  termsAcceptedAt: '2026-01-01T00:00:00.000Z',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
  subscriptionTier: 'STANDARD',
};

describe('U1 : Ordre des hooks React dans les modales', () => {
  it('rend ReportAdModal fermé puis ouvert sans erreur et exécute useEffect avant le return null', () => {
    const closedHtml = renderToString(
      React.createElement(ReportAdModal, {
        isOpen: false,
        onClose: () => {},
        ad: SAMPLE_AD,
      })
    );
    expect(closedHtml).toBe('');

    const openHtml = renderToString(
      React.createElement(ReportAdModal, {
        isOpen: true,
        onClose: () => {},
        ad: SAMPLE_AD,
      })
    );
    expect(openHtml).toContain('Signaler cette annonce');
    expect(openHtml).toContain('Annonce exemple');
  });

  it('rend ShareAdModal, KycUploadModal, ExtendAdModal et AppAlertModal fermés puis ouverts sans erreur de hooks', () => {
    expect(
      renderToString(
        React.createElement(ShareAdModal, { isOpen: false, onClose: () => {}, ad: null })
      )
    ).toBe('');
    expect(
      renderToString(
        React.createElement(ShareAdModal, { isOpen: true, onClose: () => {}, ad: SAMPLE_AD })
      )
    ).toContain('Partager');

    expect(
      renderToString(
        React.createElement(KycUploadModal, {
          isOpen: false,
          onClose: () => {},
          currentUser: SAMPLE_USER,
        })
      )
    ).toBe('');
    expect(
      renderToString(
        React.createElement(KycUploadModal, {
          isOpen: true,
          onClose: () => {},
          currentUser: SAMPLE_USER,
        })
      )
    ).toContain('Transmettre ma pièce d’identité');

    expect(
      renderToString(
        React.createElement(ExtendAdModal, {
          ad: null,
          currentUser: SAMPLE_USER,
          onClose: () => {},
          onExtendSuccess: () => {},
        })
      )
    ).toBe('');
    expect(
      renderToString(
        React.createElement(ExtendAdModal, {
          ad: SAMPLE_AD,
          currentUser: SAMPLE_USER,
          onClose: () => {},
          onExtendSuccess: () => {},
        })
      )
    ).toContain('Prolonger');

    expect(
      renderToString(
        React.createElement(AppAlertModal, {
          config: null,
          onClose: () => {},
        })
      )
    ).toBe('');
  });

  it('ne place aucun hook après un return anticipé dans les composants modaux corrigés', () => {
    const modalFiles = [
      'src/components/ReportAdModal.tsx',
      'src/components/ShareAdModal.tsx',
      'src/components/KycUploadModal.tsx',
      'src/components/ExtendAdModal.tsx',
      'src/components/AppAlertModal.tsx',
    ];

    for (const relPath of modalFiles) {
      const source = readFileSync(resolve(process.cwd(), relPath), 'utf8');
      const exportIdx = source.indexOf('export const ');
      expect(exportIdx).toBeGreaterThan(-1);

      // For outer component using early return null before rendering inner *Content,
      // ensure there are no hook calls between the early return and the component body end.
      const earlyReturnMatch = source.slice(exportIdx).match(/if\s*\([^)]*\)\s*return\s+null;/);
      if (earlyReturnMatch && earlyReturnMatch.index !== undefined) {
        const afterEarlyReturn = source.slice(exportIdx + earlyReturnMatch.index);
        const endOfComponent = afterEarlyReturn.indexOf('\n};');
        const tailOfOuter = endOfComponent > -1 ? afterEarlyReturn.slice(0, endOfComponent) : afterEarlyReturn;
        expect(tailOfOuter).not.toMatch(/\b(React\.)?(useState|useEffect|useMemo|useCallback|useRef)\s*\(/);
      }
    }
  });
});

