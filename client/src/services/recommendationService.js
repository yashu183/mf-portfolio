// Recommendation Service – calls the unified backend

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3002';

const CACHE_KEY = 'portfolio_recommendations';
const CACHE_TS_KEY = 'portfolio_recommendations_timestamp';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/recommendations
 * Generates AI-powered recommendations via the secure backend.
 */
export const generatePortfolioRecommendations = async (portfolioData, currentValues) => {
  const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioData, currentValues }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait before requesting new recommendations.');
    }
    throw new Error(body.message ?? `HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  return result.data; // { recommendations, recommendedAllocation }
};

/**
 * Wraps generatePortfolioRecommendations with localStorage caching.
 */
export const getCachedRecommendations = async (portfolioData, currentValues, forceRefresh = false) => {
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const ts = localStorage.getItem(CACHE_TS_KEY);
      if (cached && ts && Date.now() - parseInt(ts, 10) < CACHE_TTL) {
        console.log('📋 Using cached recommendations');
        return JSON.parse(cached);
      }
    } catch {
      // ignore parse errors
    }
  }

  const data = await generatePortfolioRecommendations(portfolioData, currentValues);

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {
    // Storage may be full or unavailable
  }

  return data;
};

/** Clear the cached recommendations from localStorage */
export const clearRecommendationsCache = () => {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TS_KEY);
};

/** GET /api/health */
export const checkServiceHealth = async () => {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal });
    clearTimeout(tid);
    return response.ok;
  } catch {
    return false;
  }
};