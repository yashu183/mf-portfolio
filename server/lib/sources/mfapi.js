// Mutual fund NAV history from MFapi (newest first, dates dd-mm-yyyy), cached in memory and on disk
const path = require('path');
const fs = require('fs').promises;
const { SERVER_DIR } = require('../config');

const MF_API_BASE_URL = 'https://api.mfapi.in/mf';
const _navCache = {};
const _navCacheTs = {};
const NAV_CACHE_DURATION = parseInt(
    process.env.NAV_CACHE_DURATION_MS || String(60 * 60 * 1000),
    10,
);

// MFapi rate-limits bursts (HTTP 429), so requests go out a few at a time, a scheme already
// being fetched is shared rather than requested twice, and 429s/5xx are retried with backoff.
// The last good history is kept on disk, so a failed fetch (even right after a restart)
// falls back to slightly old NAVs instead of counting the fund as ₹0.
const NAV_CONCURRENCY = Math.max(1, parseInt(process.env.MF_API_CONCURRENCY || '4', 10));
const NAV_MAX_RETRIES = 3;
const NAV_DISK_CACHE_DIR = path.join(SERVER_DIR, '.nav-cache');
const _navInFlight = new Map();
// schemes whose last fetch failed: 'stale' (served from a saved copy) or 'missing' (nothing saved)
const _navProblem = new Map();
let _navActive = 0;
const _navQueue = [];

async function withNavSlot(task) {
    if (_navActive >= NAV_CONCURRENCY) await new Promise((resolve) => _navQueue.push(resolve));
    _navActive++;
    try {
        return await task();
    } finally {
        _navActive--;
        _navQueue.shift()?.();
    }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestNAVHistory(schemeCode) {
    for (let attempt = 0; ; attempt++) {
        let status = 0;
        let retryAfterMs = 0;
        try {
            const response = await withNavSlot(() => fetch(`${MF_API_BASE_URL}/${schemeCode}`));
            if (response.ok) {
                const navData = await response.json();
                if (!navData?.data?.length) throw new Error('empty NAV history');
                return navData;
            }
            status = response.status;
            retryAfterMs = (parseInt(response.headers.get('retry-after') || '0', 10) || 0) * 1000;
            if (status !== 429 && status < 500) throw new Error(`HTTP error ${status}`);
            if (attempt >= NAV_MAX_RETRIES) throw new Error(`HTTP error ${status}`);
        } catch (err) {
            if (status && (status !== 429 && status < 500)) throw err;
            if (attempt >= NAV_MAX_RETRIES) throw err;
        }
        // 1s, 2s, 4s (or what the server asks for), with jitter so retries don't arrive together
        await wait(Math.min(Math.max(retryAfterMs, 1000 * 2 ** attempt), 10000) + Math.random() * 500);
    }
}

// The saved copies also hold the Nifty 50 level (lib/sources/yahoo.js), under 'NSEI'
async function readNAVDiskCache(schemeCode) {
    try {
        return JSON.parse(await fs.readFile(path.join(NAV_DISK_CACHE_DIR, `${schemeCode}.json`), 'utf8'));
    } catch {
        return null;
    }
}

function writeNAVDiskCache(schemeCode, navData) {
    fs
        .mkdir(NAV_DISK_CACHE_DIR, { recursive: true })
        .then(() => fs.writeFile(path.join(NAV_DISK_CACHE_DIR, `${schemeCode}.json`), JSON.stringify(navData)))
        .catch((err) => console.error(`NAV disk cache write failed for ${schemeCode}:`, err.message));
}

async function fetchCompleteNAVHistory(schemeCode) {
    const now = Date.now();
    if (
        _navCache[schemeCode] &&
        _navCacheTs[schemeCode] &&
        now - _navCacheTs[schemeCode] < NAV_CACHE_DURATION
    ) {
        return _navCache[schemeCode];
    }
    if (_navInFlight.has(schemeCode)) return _navInFlight.get(schemeCode);

    const pending = (async () => {
        try {
            const navData = await requestNAVHistory(schemeCode);
            _navCache[schemeCode] = navData;
            _navCacheTs[schemeCode] = Date.now();
            _navProblem.delete(schemeCode);
            writeNAVDiskCache(schemeCode, navData);
            return navData;
        } catch (err) {
            const stale = _navCache[schemeCode] ?? (await readNAVDiskCache(schemeCode));
            if (stale) {
                // keep it in memory but leave the timestamp, so the next request tries the network again
                _navCache[schemeCode] = stale;
                _navProblem.set(schemeCode, 'stale');
                console.warn(`NAV fetch failed for ${schemeCode} (${err.message}); using cached NAV from ${stale.data[0]?.date}`);
                return stale;
            }
            console.error(`NAV fetch failed for ${schemeCode}:`, err.message);
            _navProblem.set(schemeCode, 'missing');
            return null;
        } finally {
            _navInFlight.delete(schemeCode);
        }
    })();
    _navInFlight.set(schemeCode, pending);
    return pending;
}

// 'stale' or 'missing' when the scheme's last fetch failed, otherwise undefined
const navProblem = (schemeCode) => _navProblem.get(schemeCode);

// The NAV on a date, or the nearest one within a week (weekends, holidays)
function getNAVByDate(navHistory, targetDate) {
    if (!navHistory?.data?.length) return null;
    const target = new Date(targetDate);
    const dd = String(target.getDate()).padStart(2, '0');
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const yyyy = target.getFullYear();
    const targetStr = `${dd}-${mm}-${yyyy}`;

    const exact = navHistory.data.find((e) => e.date === targetStr);
    if (exact) return parseFloat(exact.nav);

    let closestNav = null;
    let minDiff = Infinity;
    for (const entry of navHistory.data) {
        const [d, m, y] = entry.date.split('-');
        const entryDate = new Date(y, m - 1, d);
        const diff = Math.abs(target - entryDate);
        if (diff / (1000 * 60 * 60 * 24) <= 7 && diff < minDiff) {
            minDiff = diff;
            closestNav = parseFloat(entry.nav);
        }
    }
    return closestNav;
}

module.exports = { fetchCompleteNAVHistory, getNAVByDate, navProblem, readNAVDiskCache, writeNAVDiskCache };
