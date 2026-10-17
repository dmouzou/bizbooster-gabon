import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Étape 7.1 : Capacité, Quotas et Paramètres Cloud Functions (C-04, S-07)', () => {
  const indexTsPath = path.resolve(__dirname, '../functions/src/index.ts');
  const moderationTsPath = path.resolve(__dirname, '../functions/src/moderation/index.ts');
  const reportsTsPath = path.resolve(__dirname, '../functions/src/reports.ts');
  const resubmitTsPath = path.resolve(__dirname, '../functions/src/resubmitAd.ts');
  const registerViewTsPath = path.resolve(__dirname, '../functions/src/registerView.ts');
  const setRoleTsPath = path.resolve(__dirname, '../functions/src/setRole.ts');
  const docsPath = path.resolve(__dirname, '../docs/capacite_quotas_et_alertes.md');

  it('définit setGlobalOptions avec maxInstances, memory, timeoutSeconds et FUNCTION_REGION dans functions/src/index.ts', () => {
    const content = fs.readFileSync(indexTsPath, 'utf-8');

    expect(content).toContain('setGlobalOptions');
    expect(content).toContain('maxInstances: 10');
    expect(content).toContain('memory: "256MiB"');
    expect(content).toContain('timeoutSeconds: 60');
    expect(content).toContain('FUNCTION_REGION');
  });

  it('aligne la région et définit des limites d instances strictes sur tous les callables modulaires', () => {
    const moderationContent = fs.readFileSync(moderationTsPath, 'utf-8');
    const reportsContent = fs.readFileSync(reportsTsPath, 'utf-8');
    const resubmitContent = fs.readFileSync(resubmitTsPath, 'utf-8');
    const registerViewContent = fs.readFileSync(registerViewTsPath, 'utf-8');
    const setRoleContent = fs.readFileSync(setRoleTsPath, 'utf-8');

    // Vérifie que FUNCTION_REGION est utilisé comme repli ou override
    expect(moderationContent).toContain('process.env.FUNCTION_REGION');
    expect(reportsContent).toContain('process.env.FUNCTION_REGION');
    expect(resubmitContent).toContain('process.env.FUNCTION_REGION');
    expect(registerViewContent).toContain('process.env.FUNCTION_REGION');
    expect(setRoleContent).toContain('process.env.FUNCTION_REGION');

    // Vérifie les plafonds d'instances (max 5 à 20)
    expect(moderationContent).toContain('maxInstances: 5');
    expect(reportsContent).toContain('maxInstances: 10');
    expect(resubmitContent).toContain('maxInstances: 10');
    expect(registerViewContent).toContain('maxInstances: 20');
    expect(setRoleContent).toContain('maxInstances: 5');
  });

  it('fournit la documentation complète de capacité, quotas et alertes budgétaires dans docs/capacite_quotas_et_alertes.md', () => {
    expect(fs.existsSync(docsPath)).toBe(true);
    const content = fs.readFileSync(docsPath, 'utf-8');

    expect(content).toContain('Cloud Functions v2');
    expect(content).toContain('maxInstances');
    expect(content).toContain('Quotas Firestore');
    expect(content).toContain('Alertes et Budget GCP Cloud Billing');
    expect(content).toContain('50%');
    expect(content).toContain('90%');
    expect(content).toContain('100%');
  });
});
