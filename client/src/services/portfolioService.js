// Portfolio Service – all API calls to the unified backend

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3002';

// ─── Frontend cache ────────────────────────────────────────────────────────────
let _portfolioCache = { data: null, timestamp: null };
const PORTFOLIO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/portfolio/complete
 * The primary function used by the app – returns the full portfolio with all
 * calculations already done by the backend.
 */
export const getCompletePortfolio = async () => {
  const now = Date.now();
  if (_portfolioCache.data && _portfolioCache.timestamp && now - _portfolioCache.timestamp < PORTFOLIO_CACHE_TTL) {
    console.log('📋 Using cached portfolio data');
    return _portfolioCache.data;
  }

  const response = await fetch(`${API_BASE_URL}/api/portfolio/complete`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');

  _portfolioCache = { data: result.data, timestamp: now };
  return result.data;
};

/** Clear frontend portfolio cache */
export const clearPortfolioCache = () => {
  _portfolioCache = { data: null, timestamp: null };
};

// ─── Investment Timeline ───────────────────────────────────────────────────────
let _timelineCache = { data: null, timestamp: null };
const TIMELINE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/portfolio/investment-timeline
 * Returns month-by-month investment data for bar + line charts.
 */
export const getInvestmentTimeline = async () => {
  const now = Date.now();
  if (_timelineCache.data && _timelineCache.timestamp && now - _timelineCache.timestamp < TIMELINE_CACHE_TTL) {
    return _timelineCache.data;
  }

  const response = await fetch(`${API_BASE_URL}/api/portfolio/investment-timeline`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');

  _timelineCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearTimelineCache = () => {
  _timelineCache = { data: null, timestamp: null };
};
