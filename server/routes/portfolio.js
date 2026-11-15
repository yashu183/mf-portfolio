// The portfolio API: one route per page of the app, each reading the request's portfolio (yours or the demo)
const express = require('express');
const { ok, fail, handle } = require('../lib/http');
const { loadConfig } = require('../lib/config');
const { fetchMetalSpotPricesINR } = require('../lib/sources/bullions');
const { computeMFData } = require('../services/funds');
const { computeNavHistory } = require('../services/navHistory');
const { calculateFixedDeposits } = require('../services/fds');
const { computeMetalHoldings } = require('../services/metals');
const { computeEPF } = require('../services/epf');
const { computeTimeline } = require('../services/timeline');
const { computeCalendar } = require('../services/calendar');
const { computeOverview } = require('../services/overview');

const router = express.Router();

/** GET /api/auth/session – whether the session cookie is still good (requireSession has already decided) */
router.get('/auth/session', (_req, res) => res.json({ status: 'success' }));

/** GET /api/health */
router.get('/health', (_req, res) =>
    ok(res, { service: 'mf-portfolio-api', timestamp: new Date().toISOString() }),
);

/** GET /api/portfolio/overview – every asset class, and grand totals */
router.get('/portfolio/overview', handle('Overview portfolio error', 'Failed to calculate overview', async (req, res) => {
    ok(res, await computeOverview(await loadConfig(req)));
}));

/** GET /api/portfolio/funds – mutual funds only */
router.get('/portfolio/funds', handle('Funds portfolio error', 'Failed to calculate mutual funds', async (req, res) => {
    const { funds, totals } = await computeMFData(await loadConfig(req));
    ok(res, { funds, totals });
}));

/**
 * GET /api/portfolio/nav-history – the NAV of every fund and of the Nifty 50 tracker, oldest first, as
 * [ISO date, NAV], the Nifty 50 level, and each fund's money against the same money in the Nifty 50
 */
router.get('/portfolio/nav-history', handle('NAV history error', 'Failed to load NAV history', async (req, res) => {
    ok(res, await computeNavHistory(await loadConfig(req)));
}));

/** GET /api/portfolio/fds – fixed deposits only */
router.get('/portfolio/fds', handle('FDs portfolio error', 'Failed to calculate fixed deposits', async (req, res) => {
    const config = await loadConfig(req);
    ok(res, { fixedDeposits: calculateFixedDeposits(config.fixedDeposits ?? []) });
}));

/** GET /api/portfolio/complete – kept for backward compatibility: funds + totals + fixedDeposits in one go */
router.get('/portfolio/complete', handle('Complete portfolio error', 'Failed to calculate portfolio', async (req, res) => {
    const config = await loadConfig(req);
    const { funds, totals } = await computeMFData(config);
    ok(res, { funds, totals, fixedDeposits: calculateFixedDeposits(config.fixedDeposits ?? []) });
}));

/** GET /api/portfolio/investment-timeline – month-by-month SIP + lump sum amounts and SIP commitment history */
router.get('/portfolio/investment-timeline', handle('Investment timeline error', 'Failed to calculate timeline', async (req, res) => {
    ok(res, computeTimeline(await loadConfig(req)));
}));

/** GET /api/portfolio/gold and /api/portfolio/silver */
for (const metal of ['gold', 'silver']) {
    const label = metal[0].toUpperCase() + metal.slice(1);
    router.get(`/portfolio/${metal}`, handle(`${label} portfolio error`, `Failed to fetch ${metal} data`, async (req, res) => {
        const [config, prices] = await Promise.all([loadConfig(req), fetchMetalSpotPricesINR()]);
        const { pricePerGram } = prices[metal];
        const { holdings, totals, sets } = computeMetalHoldings(config[metal] ?? [], pricePerGram);
        ok(res, { holdings, totals, sets, pricePerGram, fetchedAt: prices.fetchedAt });
    }));
}

/** GET /api/portfolio/epf – every EPF account, and totals */
router.get('/portfolio/epf', handle('EPF portfolio error', 'Failed to calculate EPF', async (req, res) => {
    const config = await loadConfig(req);
    if (!config.epf) return fail(res, 404, 'EPF config not found');
    return ok(res, computeEPF(config));
}));

/** GET /api/portfolio/calendar – every dated investment, renewal and maturity, for the calendar */
router.get('/portfolio/calendar', handle('Calendar error', 'Failed to build the calendar', async (req, res) => {
    ok(res, await computeCalendar(await loadConfig(req)));
}));

module.exports = router;
