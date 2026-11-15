const express = require('express');
const rateLimit = require('express-rate-limit');
const { ok, fail, handle } = require('../lib/http');
const { loadConfig } = require('../lib/config');
const { generateRecommendations } = require('../services/recommendations');

// Bedrock calls cost money, so they are limited per hour (configurable via env). The demo's recommendation
// is a saved sample, so it doesn't spend the allowance.
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(60 * 60 * 1000), 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    message: { status: 'error', message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const router = express.Router();

/** POST /api/recommendations */
router.post('/', (req, res, next) => (req.demo ? next() : limiter(req, res, next)),
    handle('Recommendation error', 'Failed to generate recommendations', async (req, res) => {
        if (req.demo) return ok(res, (await loadConfig(req)).sampleRecommendations);
        const { portfolioData, currentValues } = req.body;
        if (!portfolioData || !currentValues) return fail(res, 400, 'Missing required portfolio data');
        return ok(res, await generateRecommendations(await loadConfig(req), { portfolioData, currentValues }));
    }));

module.exports = router;
