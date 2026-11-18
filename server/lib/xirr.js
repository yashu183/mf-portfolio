// XIRR by Newton's method, with optional key-based caching (the caller keys it by the cash flows themselves)
const _xirrCache = {};
function calculateXIRR(cashFlows, guess = 0.1, cacheKey = null) {
    if (cacheKey && _xirrCache[cacheKey] !== undefined) {
        return _xirrCache[cacheKey];
    }

    const maxIterations = 100;
    const tolerance = 0.0001;
    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let dnpv = 0;
        const t0 = cashFlows[0].date;
        for (const cf of cashFlows) {
            const years = (cf.date - t0) / (1000 * 60 * 60 * 24 * 365.25);
            npv += cf.amount / Math.pow(1 + rate, years);
            dnpv -= (cf.amount * years) / Math.pow(1 + rate, years + 1);
        }
        const newRate = rate - npv / dnpv;
        if (Math.abs(newRate - rate) < tolerance) {
            const result = newRate * 100;
            if (cacheKey) _xirrCache[cacheKey] = result;
            return result;
        }
        rate = newRate;
    }

    const result = rate * 100;
    if (cacheKey) _xirrCache[cacheKey] = result;
    return result;
}

// XIRR of payments ({date, amount} going in) against what they are worth at `endDate`; null when it can't be had
function xirrOfFlows(flows, endValue, endDate) {
    if (!flows.length || !(endValue > 0)) return null;
    const cf = flows.map((f) => ({ date: f.date, amount: -f.amount }));
    cf.push({ date: endDate, amount: endValue });
    const x = calculateXIRR(cf, 0.1);
    return Number.isFinite(x) ? x : null;
}

module.exports = { calculateXIRR, xirrOfFlows };
