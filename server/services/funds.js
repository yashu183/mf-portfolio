// Mutual funds: each fund's units, value and XIRR from its SIPs and lump sums, and the same money in the Nifty 50
const { fetchCompleteNAVHistory, getNAVByDate, navProblem } = require('../lib/sources/mfapi');
const { calculateXIRR, xirrOfFlows } = require('../lib/xirr');
const { getMonthsDifference, isoDay } = require('../lib/dates');

// Every payment into a fund priced at its NAV that day. `flows` keeps each priced payment
// ({date, iso, amount, type: 'lumpsum' | 'sip'}) so the same money can be replayed into the Nifty 50.
async function calculateFundValue(fund) {
    const empty = { flows: [], totalUnits: 0, totalInvested: 0, currentValue: 0, latestNAV: 0, latestDate: null, navStatus: fund.schemeId ? 'missing' : 'live' };
    if (!fund.schemeId) return empty;

    const navHistory = await fetchCompleteNAVHistory(fund.schemeId);
    if (!navHistory?.data?.length) return empty;

    const latestNAV = parseFloat(navHistory.data[0].nav);
    const latestDate = navHistory.data[0].date;
    let totalUnits = 0;
    let totalInvested = 0;
    const flows = [];

    for (const lumpsum of fund.lumpsums ?? []) {
        const nav = getNAVByDate(navHistory, lumpsum.date);
        if (nav) {
            totalUnits += lumpsum.amount / nav;
            totalInvested += lumpsum.amount;
            flows.push({ date: new Date(lumpsum.date), iso: lumpsum.date, amount: lumpsum.amount, type: 'lumpsum' });
        }
    }

    const now = new Date();
    for (const sip of fund.sips ?? []) {
        if (sip.amount > 0 && sip.startDate) {
            const sipStart = new Date(sip.startDate);
            const endDate = sip.stopDate && new Date(sip.stopDate) < now ? new Date(sip.stopDate) : now;
            const sipMonths = getMonthsDifference(sipStart, endDate);
            for (let m = 0; m < sipMonths; m++) {
                const sipDate = new Date(sipStart);
                sipDate.setMonth(sipStart.getMonth() + m);
                sipDate.setDate(5);
                const nav = getNAVByDate(navHistory, sipDate);
                if (nav) {
                    totalUnits += sip.amount / nav;
                    totalInvested += sip.amount;
                    flows.push({ date: sipDate, iso: isoDay(sipDate), amount: sip.amount, type: 'sip' });
                }
            }
        }
    }

    // 'stale' when MFapi could not be reached and the last saved NAVs were used instead
    const navStatus = navProblem(fund.schemeId) === 'stale' ? 'stale' : 'live';
    return { totalUnits, totalInvested, currentValue: totalUnits * latestNAV, latestNAV, latestDate, navStatus, flows };
}

// ─── Nifty 50 benchmark ───────────────────────────────────────────────────────
// MFapi has no index series, so the Nifty 50 is stood in for by a Direct-plan index fund that tracks it
// (UTI Nifty 50 Index Fund). Each payment into a fund is replayed into it on the same day.
const NIFTY_SCHEME = '120716';

function niftyUnitsFor(niftyHistory, flows) {
    let units = 0;
    let invested = 0;
    const priced = [];
    for (const f of flows) {
        const nav = getNAVByDate(niftyHistory, f.date);
        if (nav) {
            units += f.amount / nav;
            invested += f.amount;
            priced.push(f);
        }
    }
    return { units, invested, priced };
}

// Every payment as a negative cash flow, for XIRR
function buildCashFlows(fund, calculationDate) {
    const cashFlows = [];
    for (const ls of fund.lumpsums ?? []) {
        cashFlows.push({ date: new Date(ls.date), amount: -ls.amount });
    }
    for (const sip of fund.sips ?? []) {
        if (sip.amount > 0 && sip.startDate) {
            const sipStart = new Date(sip.startDate);
            let effectiveEndDate = calculationDate;
            if (sip.stopDate && new Date(sip.stopDate) < calculationDate) {
                effectiveEndDate = new Date(sip.stopDate);
            }
            const effectiveSipMonths = getMonthsDifference(sipStart, effectiveEndDate);
            for (let i = 0; i < effectiveSipMonths; i++) {
                const d = new Date(sipStart);
                d.setMonth(sipStart.getMonth() + i);
                d.setDate(5);
                cashFlows.push({ date: d, amount: -sip.amount });
            }
        }
    }
    return cashFlows;
}

function deriveStatus(xirr, sipMonths) {
    if (sipMonths > 0 && sipMonths <= 6) return 'monitor';
    if (xirr >= 15) return 'excellent';
    if (xirr >= 12) return 'good';
    if (xirr < 0) return 'poor';
    return 'monitor';
}

/** All MF fund values + totals from a loaded config */
async function computeMFData(config) {
    const currentDate = new Date();
    console.log(`📊 Processing ${config.funds.length} funds in parallel...`);

    const niftyHistory = await fetchCompleteNAVHistory(NIFTY_SCHEME);
    const niftyLatest = niftyHistory?.data?.length ? parseFloat(niftyHistory.data[0].nav) : 0;
    const allFlows = [];
    let allValue = 0;
    let niftyAllValue = 0;
    let niftyAllInvested = 0;

    const calculatedFunds = await Promise.all(
        config.funds.map(async (fund) => {
            const { totalUnits, totalInvested, currentValue, latestNAV, latestDate, navStatus, flows } =
                await calculateFundValue(fund);

            let totalSIPInvested = 0;
            let sipMonths = 0;
            let currentMonthlySIP = 0;
            for (const sip of fund.sips ?? []) {
                if (sip.amount > 0 && sip.startDate) {
                    const sipStart = new Date(sip.startDate);
                    let effectiveSipEndDate = currentDate;
                    if (sip.stopDate && new Date(sip.stopDate) < currentDate) {
                        effectiveSipEndDate = new Date(sip.stopDate);
                    }
                    const months = getMonthsDifference(sipStart, effectiveSipEndDate);
                    totalSIPInvested += sip.amount * months;
                    sipMonths += months;
                    if (sipStart <= currentDate && (!sip.stopDate || new Date(sip.stopDate) >= currentDate)) {
                        currentMonthlySIP += sip.amount;
                    }
                }
            }
            const totalLumpsum = (fund.lumpsums ?? []).reduce((s, l) => s + l.amount, 0);

            let startDate = currentDate;
            if (fund.sips?.length > 0) {
                const earliestSipStart = new Date(Math.min(...fund.sips.map(s => new Date(s.startDate))));
                if (earliestSipStart < startDate) startDate = earliestSipStart;
            }
            if (fund.lumpsums?.length > 0) {
                const earliestLumpsum = new Date(Math.min(...fund.lumpsums.map(l => new Date(l.date))));
                if (earliestLumpsum < startDate) startDate = earliestLumpsum;
            }
            const investmentAge = getMonthsDifference(startDate, currentDate);

            const cashFlows = buildCashFlows(fund, currentDate);
            cashFlows.push({ date: currentDate, amount: currentValue });

            // keyed by the cash flows themselves, so an entry added from the app changes the key at once
            const cacheKey = latestDate
                ? `${config.__demo ? 'demo_' : ''}${fund.id}_${cashFlows.map((f) => `${f.date.getTime()}:${f.amount}`).join(',')}`
                : null;
            // no NAV means no value to measure against, and a diverged solve is not a return either
            const rawXirr = navStatus !== 'missing' && cashFlows.length > 1 ? calculateXIRR(cashFlows, 0.1, cacheKey) : 0;
            const xirr = Number.isFinite(rawXirr) ? rawXirr : 0;
            const returns = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

            // the same payments, made into the Nifty 50 instead
            let nifty = null;
            if (niftyLatest > 0 && navStatus !== 'missing' && flows.length) {
                const n = niftyUnitsFor(niftyHistory, flows);
                if (n.invested > 0) {
                    const niftyValue = n.units * niftyLatest;
                    const niftyXirr = xirrOfFlows(n.priced, niftyValue, currentDate);
                    allFlows.push(...n.priced);
                    allValue += currentValue;
                    niftyAllValue += niftyValue;
                    niftyAllInvested += n.invested;
                    // under 6 months, an annualised gap says nothing; the rupee gap still does
                    const tooNew = investmentAge < 6;
                    nifty = {
                        niftyValue,
                        niftyXirr: niftyXirr ?? null,
                        vsNiftyXirr: !tooNew && niftyXirr != null ? xirr - niftyXirr : null,
                        vsNiftyValue: currentValue - niftyValue,
                    };
                }
            }

            return {
                ...fund,
                ...(nifty ?? { niftyValue: null, niftyXirr: null, vsNiftyXirr: null, vsNiftyValue: null }),
                totalUnits,
                totalInvested,
                currentValue,
                latestNAV,
                latestDate,
                navStatus,
                sipMonths,
                totalSIPInvested,
                totalLumpsum,
                investmentAge,
                xirr,
                returns,
                status: deriveStatus(xirr, sipMonths),
                currentMonthlySIP,
            };
        }),
    );

    const totals = calculatedFunds.reduce(
        (acc, f) => {
            acc.totalInvested += f.totalInvested;
            acc.totalCurrentValue += f.currentValue;
            acc.monthlySIP += f.currentMonthlySIP ?? 0;
            return acc;
        },
        { totalInvested: 0, totalCurrentValue: 0, monthlySIP: 0 },
    );
    // funds priced from a saved NAV, or with no NAV at all (counted as ₹0), so the UI can say so
    totals.staleFunds = calculatedFunds.filter((f) => f.navStatus === 'stale').length;
    totals.missingFunds = calculatedFunds.filter((f) => f.navStatus === 'missing').length;
    totals.totalReturns =
        totals.totalInvested > 0
            ? ((totals.totalCurrentValue - totals.totalInvested) / totals.totalInvested) * 100
            : 0;

    // the whole fund portfolio against the same money in the Nifty 50, on the funds that could be priced
    const portfolioXirr = xirrOfFlows(allFlows, allValue, currentDate);
    const niftyXirrAll = xirrOfFlows(allFlows, niftyAllValue, currentDate);
    totals.nifty = niftyAllInvested > 0 ? {
        value: niftyAllValue,
        invested: niftyAllInvested,
        xirr: niftyXirrAll,
        portfolioXirr,
        portfolioValue: allValue,
        beating: calculatedFunds.filter((f) => f.vsNiftyValue != null && f.vsNiftyValue > 0).length,
        compared: calculatedFunds.filter((f) => f.vsNiftyValue != null).length,
        asOf: niftyHistory.data[0].date,
    } : null;

    return { funds: calculatedFunds, totals };
}

module.exports = { calculateFundValue, computeMFData, NIFTY_SCHEME };
