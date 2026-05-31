// Portfolio Service – all API calls to the unified backend

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3002';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Per-asset caches ──────────────────────────────────────────────────────────
let _mfCache        = { data: null, timestamp: null };
let _fdCache        = { data: null, timestamp: null };
let _portfolioCache = { data: null, timestamp: null }; // legacy /complete cache
let _timelineCache  = { data: null, timestamp: null };

// ─── Mutual Funds ──────────────────────────────────────────────────────────────
/** GET /api/portfolio/funds – returns { funds, totals } */
export const getMutualFunds = async () => {
  const now = Date.now();
  if (_mfCache.data && _mfCache.timestamp && now - _mfCache.timestamp < CACHE_TTL) {
    console.log('📋 Using cached MF data');
    return _mfCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/funds`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _mfCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearMFCache = () => { _mfCache = { data: null, timestamp: null }; };

// ─── Fixed Deposits ────────────────────────────────────────────────────────────
/** GET /api/portfolio/fds – returns { fixedDeposits } */
export const getFixedDeposits = async () => {
  const now = Date.now();
  if (_fdCache.data && _fdCache.timestamp && now - _fdCache.timestamp < CACHE_TTL) {
    console.log('📋 Using cached FD data');
    return _fdCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/fds`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _fdCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearFDCache = () => { _fdCache = { data: null, timestamp: null }; };

// ─── Legacy: /complete (kept for backward compatibility) ──────────────────────
export const getCompletePortfolio = async () => {
  const now = Date.now();
  if (_portfolioCache.data && _portfolioCache.timestamp && now - _portfolioCache.timestamp < CACHE_TTL) {
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

export const clearPortfolioCache = () => { _portfolioCache = { data: null, timestamp: null }; };

// ─── Investment Timeline ───────────────────────────────────────────────────────
export const getInvestmentTimeline = async () => {
  const now = Date.now();
  if (_timelineCache.data && _timelineCache.timestamp && now - _timelineCache.timestamp < CACHE_TTL) {
    return _timelineCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/investment-timeline`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _timelineCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearTimelineCache = () => { _timelineCache = { data: null, timestamp: null }; };

