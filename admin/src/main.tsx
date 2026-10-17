import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from '../../src/AdminApp';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Anomalie d'affichage dans le Cockpit Administrateur">
      <AdminApp />
    </ErrorBoundary>
  </StrictMode>
);

