const { readNAVDiskCache, writeNAVDiskCache } = require('./mfapi');

// The Nifty 50's own level in index points, from Yahoo Finance (^NSEI), only to show the level beside the chart.
// Returns are still measured with the index fund (services/funds.js), which counts dividends; the level does not.
// Kept 6 hours, falls back to the last saved copy, and the chart works without it.
let _niftyLevels = { data: null, ts: 0 };
async function fetchNiftyLevels() {
    if (_niftyLevels.data && Date.now() - _niftyLevels.ts < 6 * 60 * 60 * 1000) return _niftyLevels.data;
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?period1=1356998400&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const result = json?.chart?.result?.[0];
        const ts = result?.timestamp ?? [];
        const close = result?.indicators?.quote?.[0]?.close ?? [];
        // MFapi's shape (newest first, dd-mm-yyyy), so the same sampling applies; dates in IST
        const data = [];
        for (let i = ts.length - 1; i >= 0; i--) {
            if (close[i] == null) continue;
            const d = new Date((ts[i] + 5.5 * 3600) * 1000);
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            data.push({ date: `${dd}-${mm}-${d.getUTCFullYear()}`, nav: String(Math.round(close[i] * 100) / 100) });
        }
        if (!data.length) throw new Error('no data');
        _niftyLevels = { data: { data }, ts: Date.now() };
        writeNAVDiskCache('NSEI', { data });
        return _niftyLevels.data;
    } catch (err) {
        console.warn(`Nifty 50 level fetch failed (${err.message})`);
        const saved = _niftyLevels.data ?? (await readNAVDiskCache('NSEI'));
        if (saved) _niftyLevels = { data: saved, ts: Date.now() - 5 * 60 * 60 * 1000 }; // retry in about an hour
        return saved;
    }
}

module.exports = { fetchNiftyLevels };
