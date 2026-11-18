const path = require('path');
const fs = require('fs').promises;

const SERVER_DIR = path.join(__dirname, '..');
// Your portfolio's file; PORTFOLIO_CONFIG points elsewhere (the tests use a temporary copy)
const CONFIG_PATH = process.env.PORTFOLIO_CONFIG || path.join(SERVER_DIR, 'portfolioConfig.json');

// The portfolio a request is about. The demo reads demoConfig.json and is marked, so caches keyed by
// fund id never mix the two portfolios.
async function loadConfig(req) {
    const demo = Boolean(req?.demo);
    const configPath = demo ? path.join(SERVER_DIR, 'demoConfig.json') : CONFIG_PATH;
    const raw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    if (demo) config.__demo = true;
    return config;
}

module.exports = { loadConfig, SERVER_DIR, CONFIG_PATH };
