// The public demo: the whole app under /demo, reading a made-up portfolio from the server's open
// /api/demo routes, with no access code. The mode is fixed for a page load (entering or leaving the
// demo is a full navigation), so module caches never hold the two portfolios at once.
export const DEMO_BASE = '/demo';

export const IS_DEMO = typeof window !== 'undefined'
  && (window.location.pathname === DEMO_BASE || window.location.pathname.startsWith(`${DEMO_BASE}/`));

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3002';

/** Root for API calls: /api for the owner's portfolio, /api/demo for the demo. */
export const API_ROOT = `${API_BASE_URL}${IS_DEMO ? '/api/demo' : '/api'}`;
