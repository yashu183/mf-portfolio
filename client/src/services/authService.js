import { API_ROOT } from '../utils/demo';

export const authenticatedFetch = async (url, options = {}) => {
  const response = await fetch(url, { ...options, credentials: 'include' });
  if (response.status === 401) window.dispatchEvent(new Event('portfolio:locked'));
  return response;
};

export const hasActiveSession = async () => {
  try {
    const response = await fetch(`${API_ROOT}/auth/session`, { credentials: 'include' });
    return response.ok;
  } catch {
    return false;
  }
};

export const verifyAccessCode = async (code) => {
  const response = await fetch(`${API_ROOT}/auth/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || 'Unable to verify access. Please try again.');
  }
};
// Ends the session on the server. Locking must still work offline, so a failed request is ignored:
// the caller locks the app either way, and the cookie can't outlive its hour.
export const logout = async () => {
  try {
    await fetch(`${API_ROOT}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {}
};
