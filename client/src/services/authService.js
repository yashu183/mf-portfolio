const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3002';

export const authenticatedFetch = async (url, options = {}) => {
  const response = await fetch(url, { ...options, credentials: 'include' });
  if (response.status === 401) window.dispatchEvent(new Event('portfolio:locked'));
  return response;
};

export const hasActiveSession = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' });
    return response.ok;
  } catch {
    return false;
  }
};

export const verifyAccessCode = async (code) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
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