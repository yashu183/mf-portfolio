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

// ─── Gold ──────────────────────────────────────────────────────────────────────
let _goldCache = { data: null, timestamp: null };

/** GET /api/portfolio/gold – returns { holdings, totals, pricePerGram, fetchedAt } */
export const getGoldPortfolio = async () => {
  const now = Date.now();
  if (_goldCache.data && _goldCache.timestamp && now - _goldCache.timestamp < CACHE_TTL) {
    console.log('📋 Using cached gold data');
    return _goldCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/gold`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _goldCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearGoldCache = () => { _goldCache = { data: null, timestamp: null }; };

// ─── Silver ────────────────────────────────────────────────────────────────────
let _silverCache = { data: null, timestamp: null };

/** GET /api/portfolio/silver – returns { holdings, totals, pricePerGram, fetchedAt } */
export const getSilverPortfolio = async () => {
  const now = Date.now();
  if (_silverCache.data && _silverCache.timestamp && now - _silverCache.timestamp < CACHE_TTL) {
    console.log('📋 Using cached silver data');
    return _silverCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/silver`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _silverCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearSilverCache = () => { _silverCache = { data: null, timestamp: null }; };

// ─── EPF ───────────────────────────────────────────────────────────────────────
let _epfCache = { data: null, timestamp: null };

/** GET /api/portfolio/epf – returns EPF corpus data */
export const getEPFPortfolio = async () => {
  const now = Date.now();
  if (_epfCache.data && _epfCache.timestamp && now - _epfCache.timestamp < CACHE_TTL) {
    return _epfCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/epf`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _epfCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearEPFCache = () => { _epfCache = { data: null, timestamp: null }; };

// ─── Overview ──────────────────────────────────────────────────────────────────
let _overviewCache = { data: null, timestamp: null };

/** GET /api/portfolio/overview – returns aggregated overview data for all assets */
export const getOverview = async () => {
  const now = Date.now();
  if (_overviewCache.data && _overviewCache.timestamp && now - _overviewCache.timestamp < CACHE_TTL) {
    console.log('📋 Using cached overview data');
    return _overviewCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/portfolio/overview`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message ?? 'Unknown server error');
  _overviewCache = { data: result.data, timestamp: now };
  return result.data;
};

export const clearOverviewCache = () => { _overviewCache = { data: null, timestamp: null }; };

