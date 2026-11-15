// Overview: invested, current value and returns for every asset class, and grand totals
const { fetchMetalSpotPricesINR } = require('../lib/sources/bullions');
const { computeMFData } = require('./funds');
const { calculateFixedDeposits } = require('./fds');
const { computeMetalHoldings } = require('./metals');
const { computeEPF } = require('./epf');

const round2 = (n) => parseFloat(n.toFixed(2));

function asset(id, label, invested, current, extra = {}) {
    return {
        id,
        label,
        invested,
        current,
        returns: round2(current - invested),
        returnPercent: invested > 0 ? round2((current - invested) / invested * 100) : 0,
        ...extra,
    };
}

async function computeOverview(config) {
    const [{ totals: mf }, metalPrices] = await Promise.all([computeMFData(config), fetchMetalSpotPricesINR()]);

    const fds = calculateFixedDeposits(config.fixedDeposits ?? []);
    const { totals: gold } = computeMetalHoldings(config.gold ?? [], metalPrices.gold.pricePerGram);
    const { totals: silver } = computeMetalHoldings(config.silver ?? [], metalPrices.silver.pricePerGram);
    const epf = computeEPF(config);

    const assets = [
        asset('mutualFunds', 'Mutual Funds', mf.totalInvested, mf.totalCurrentValue, {
            staleFunds: mf.staleFunds,
            missingFunds: mf.missingFunds,
        }),
        asset('fds', 'Fixed Deposits',
            round2(fds.reduce((sum, fd) => sum + fd.principal, 0)),
            round2(fds.reduce((sum, fd) => sum + fd.currentValue, 0))),
        asset('gold', 'Gold', gold.totalInvested, gold.totalCurrentValue),
        asset('silver', 'Silver', silver.totalInvested, silver.totalCurrentValue),
        asset('epf', 'EPF', epf.totalInvested, epf.currentValue),
    ];

    const totals = {
        totalInvested: round2(assets.reduce((sum, a) => sum + a.invested, 0)),
        totalCurrentValue: round2(assets.reduce((sum, a) => sum + a.current, 0)),
        totalGain: round2(assets.reduce((sum, a) => sum + a.returns, 0)),
        totalGainPercent: 0,
    };
    totals.totalGainPercent = totals.totalInvested > 0 ? round2(totals.totalGain / totals.totalInvested * 100) : 0;

    return { totals, assets, timestamp: new Date().toISOString() };
}

module.exports = { computeOverview };
