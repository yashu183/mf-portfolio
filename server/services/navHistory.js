// The funds-vs-Nifty chart: NAV histories, the Nifty 50 level, and what each fund's money was worth over time
const { fetchCompleteNAVHistory, getNAVByDate } = require('../lib/sources/mfapi');
const { fetchNiftyLevels } = require('../lib/sources/yahoo');
const { calculateFundValue, NIFTY_SCHEME } = require('./funds');

// A NAV history oldest first as [ISO date, NAV]
function weeklyNavPoints(history) {
    const rows = history?.data ?? [];
    const iso = (r) => { const [d, m, y] = r.date.split('-'); return `${y}-${m}-${d}`; };
    const cutoff = Date.now() - 460 * 86400000;
    const out = [];
    // MFapi lists newest first. Older than about 15 months: one point in five (weekly), since only the shape
    // matters. Newer: every trading day, so a fund bought a few months ago is drawn in detail.
    let i = rows.length - 1;
    for (; i >= 0; i--) {
        const [d, m, y] = rows[i].date.split('-');
        if (new Date(y, m - 1, d).getTime() >= cutoff) break;
        if ((rows.length - 1 - i) % 5 === 0) out.push([iso(rows[i]), parseFloat(rows[i].nav)]);
    }
    for (; i >= 0; i--) out.push([iso(rows[i]), parseFloat(rows[i].nav)]);
    return out;
}

// NAV history oldest first as [UTC ms, NAV], for walking forward through time.
function navAscending(history) {
    return (history?.data ?? []).map((r) => {
        const [d, m, y] = r.date.split('-');
        return [Date.UTC(+y, m - 1, +d), parseFloat(r.nav)];
    }).reverse();
}

// What one fund's money was worth on each chart date, what the same payments would have been worth in the
// Nifty 50, and how much had gone in by then. Payments are bought at the same NAVs the fund list uses
// (getNAVByDate), so the last point matches the fund's current value. Arrays begin at `from`, the first date
// on or after the fund's first payment, and are whole rupees.
function moneySeries(fund, flows, fundHistory, niftyHistory, dates) {
    if (!flows.length) return null;
    const buys = flows
        .map((f) => {
            const nav = getNAVByDate(fundHistory, f.date);
            const nNav = getNAVByDate(niftyHistory, f.date);
            return nav && nNav ? { t: new Date(f.date).getTime(), amount: f.amount, units: f.amount / nav, nUnits: f.amount / nNav } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.t - b.t);
    if (!buys.length) return null;
    const fundNav = navAscending(fundHistory);
    const niftyNav = navAscending(niftyHistory);
    const from = dates.findIndex((t) => t >= buys[0].t);
    if (from < 0) return null;
    const value = [];
    const nifty = [];
    const invested = [];
    let b = 0, units = 0, nUnits = 0, put = 0, fi = -1, ni = -1;
    for (let i = from; i < dates.length; i++) {
        const t = dates[i];
        while (b < buys.length && buys[b].t <= t + 86400000) { units += buys[b].units; nUnits += buys[b].nUnits; put += buys[b].amount; b++; }
        while (fi + 1 < fundNav.length && fundNav[fi + 1][0] <= t) fi++;
        while (ni + 1 < niftyNav.length && niftyNav[ni + 1][0] <= t) ni++;
        value.push(Math.round(units * (fi >= 0 ? fundNav[fi][1] : 0)));
        nifty.push(Math.round(nUnits * (ni >= 0 ? niftyNav[ni][1] : 0)));
        invested.push(put);
    }
    return { id: fund.id, from, value, nifty, invested };
}

async function computeNavHistory(config) {
    const [nifty, levels, ...histories] = await Promise.all([
        fetchCompleteNAVHistory(NIFTY_SCHEME),
        fetchNiftyLevels(),
        ...config.funds.map((f) => (f.schemeId ? fetchCompleteNAVHistory(f.schemeId) : null)),
    ]);
    const niftyPoints = weeklyNavPoints(nifty);
    const dates = niftyPoints.map(([iso]) => Date.parse(iso));
    const valued = await Promise.all(config.funds.map((f) => calculateFundValue(f)));
    const money = config.funds
        .map((f, i) => (histories[i] && nifty ? moneySeries(f, valued[i].flows, histories[i], nifty, dates) : null))
        .filter(Boolean);
    return {
        nifty: niftyPoints,
        niftyLevel: weeklyNavPoints(levels),
        money,
        funds: config.funds
            .map((f, i) => ({ id: f.id, points: weeklyNavPoints(histories[i]) }))
            .filter((f) => f.points.length > 1),
    };
}

module.exports = { computeNavHistory };
