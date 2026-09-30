/**
 * Utility to determine the public frontend URL from any environment
 * (local dev port 3001 vs port 3000, production hosting targets, etc.)
 */
export function getFrontendUrl(): string {
  // If explicitly configured via env
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FRONTEND_URL) {
    return import.meta.env.VITE_FRONTEND_URL;
  }

  const { protocol, hostname, port, pathname } = window.location;

  // 1. Local development: admin runs on 3001, frontend on 3000
  if (port === '3001') {
    return `${protocol}//${hostname}:3000/`;
  }

  // 2. If running on same port (e.g. 3000) with /admin pathname
  if (pathname.startsWith('/admin')) {
    return `${protocol}//${window.location.host}/`;
  }

  // 3. Localhost fallback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return `${protocol}//${hostname}:3000/`;
  }

  // 4. Firebase Hosting multi-target
  // Admin hosting: bizbooster-admin.web.app -> Frontend: bizbooster-gabon.web.app
  if (hostname.includes('bizbooster-admin.web.app')) {
    return 'https://bizbooster-gabon.web.app/';
  }
  if (hostname.includes('bizbooster-admin.firebaseapp.com')) {
    return 'https://bizbooster-gabon.firebaseapp.com/';
  }

  // 5. Custom domain (e.g. admin.bizbooster.ga -> bizbooster.ga)
  if (hostname.startsWith('admin.')) {
    return `${protocol}//${hostname.replace(/^admin\./, '')}/`;
  }

  // 6. Default fallback
  return 'https://bizbooster-gabon.web.app/';
}
