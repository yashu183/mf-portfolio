// Investment calendar: every dated money movement across the portfolio. What went in (SIP instalments and lump
// sums, FDs opened, gold and silver bought, EPF contributions), what rolled over (FD renewals), and what is
// due (FD maturities, the next SIP instalments). `newMoney` marks what counts towards "put in".
const { fetchCompleteNAVHistory, getNAVByDate } = require('../lib/sources/mfapi');
const { fetchMetalSpotPricesINR } = require('../lib/sources/bullions');
const { isoDay, parseLocalDate } = require('../lib/dates');
const { calculateFundValue, computeMFData } = require('./funds');
const { calculateFixedDeposits } = require('./fds');
const { epfAccounts } = require('./epf');

async function computeCalendar(config) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events = [];

    // Mutual funds: each instalment at the NAV the fund list uses, and what those units are worth today
    const { funds } = await computeMFData(config);
    const byId = new Map(funds.map((f) => [f.id, f]));
    await Promise.all(config.funds.map(async (fund) => {
        if (!fund.schemeId) return;
        const history = await fetchCompleteNAVHistory(fund.schemeId);
        const calc = byId.get(fund.id);
        const latestNAV = calc?.latestNAV ?? 0;
        const base = { kind: 'mf', fundId: fund.id, name: fund.shortName ?? fund.name, fullName: fund.name, category: fund.category, color: fund.color };
        const { flows } = await calculateFundValue(fund);
        for (const f of flows) {
            const nav = getNAVByDate(history, f.date);
            const units = nav ? f.amount / nav : 0;
            const valueNow = units * latestNAV;
            events.push({
                ...base,
                date: f.iso,
                type: f.type,
                amount: f.amount,
                newMoney: true,
                nav, units, latestNAV,
                valueNow: Math.round(valueNow),
                gain: Math.round(valueNow - f.amount),
            });
        }
        // the next instalments of each running SIP, through the end of next month
        const horizon = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        for (const sip of fund.sips ?? []) {
            if (!(sip.amount > 0) || !sip.startDate) continue;
            const stop = sip.stopDate ? new Date(sip.stopDate) : null;
            for (let d = new Date(today.getFullYear(), today.getMonth(), 5); d <= horizon; d = new Date(d.getFullYear(), d.getMonth() + 1, 5)) {
                if (d <= today || d < new Date(sip.startDate) || (stop && d > stop)) continue;
                events.push({ ...base, date: isoDay(d), type: 'sip', amount: sip.amount, upcoming: true, newMoney: false });
            }
        }
    }));

    // Fixed deposits: opened (new money), each renewal (the matured amount rolled into the next cycle) and the
    // final maturity, past or still to come
    for (const fd of calculateFixedDeposits(config.fixedDeposits ?? [])) {
        const base = { kind: 'fd', fdId: fd.id, name: fd.bank, holder: fd.name, label: fd.label };
        const first = fd.cycleData[0];
        events.push({
            ...base, date: fd.startDate, type: 'fd-open', amount: fd.principal, newMoney: true,
            rate: first?.rate, termDays: first?.termDays, maturityDate: first?.maturityDate, valueNow: fd.currentValue,
        });
        fd.cycleData.forEach((c, i) => {
            const last = i === fd.cycleData.length - 1;
            const next = fd.cycleData[i + 1];
            events.push({
                ...base, date: c.maturityDate, type: last ? 'fd-maturity' : 'fd-renewal', amount: c.maturityAmount, newMoney: false,
                upcoming: parseLocalDate(c.maturityDate) > today, cycle: i + 1, cycles: fd.cycleData.length,
                startAmount: c.startAmount, interest: c.interest, rate: c.rate, termDays: c.termDays,
                nextRate: next?.rate, nextMaturityDate: next?.maturityDate,
            });
        });
    }

    // Gold and silver: each purchase at today's price (when the price can be read)
    let prices = null;
    try { prices = await fetchMetalSpotPricesINR(); } catch { /* the purchases still show, without today's value */ }
    for (const metal of ['gold', 'silver']) {
        const perGram = prices?.[metal]?.pricePerGram ?? null;
        for (const h of config[metal] ?? []) {
            const invested = h.quantity * h.purchasePrice;
            const valueNow = perGram ? h.quantity * perGram : null;
            events.push({
                kind: metal, date: h.purchaseDate, type: 'purchase', name: h.label, set: h.set, amount: Math.round(invested), newMoney: true,
                grams: h.quantity, pricePerGram: h.purchasePrice, todayPerGram: perGram,
                valueNow: valueNow == null ? null : Math.round(valueNow), gain: valueNow == null ? null : Math.round(valueNow - invested),
            });
        }
    }

    // EPF: each wage month's contribution, shown on the 1st of the month it is credited in (wage month + 1),
    // up to the same month the EPF page counts to
    epfAccounts(config).forEach((acc, idx) => {
        const baseEmp = acc.employeeContribution ?? acc.monthlyContribution / 2;
        const baseEmpl = acc.employerContribution ?? acc.monthlyContribution / 2;
        const history = [...(acc.contributionHistory ?? [])].sort((a, b) => a.from.localeCompare(b.from));
        const end = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const start = new Date(`${acc.startDate}T00:00:00`);
        for (let y = start.getFullYear(), m = start.getMonth(); new Date(y, m, 1) <= end; m === 11 ? (m = 0, y++) : m++) {
            const key = `${y}-${String(m + 1).padStart(2, '0')}`;
            let emp = baseEmp, empl = baseEmpl;
            for (const h of history) if (h.from <= key) { emp = h.employeeContribution ?? emp; empl = h.employerContribution ?? empl; }
            events.push({
                kind: 'epf', date: isoDay(new Date(y, m + 1, 1)), type: 'contribution', name: acc.label ?? 'EPF', accountId: acc.id ?? idx + 1,
                amount: emp + empl, newMoney: true, employee: emp, employer: empl, wageMonth: key,
            });
        }
    });

    events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    return { events, today: isoDay(today), metalPricesAt: prices?.fetchedAt ?? null };
}

module.exports = { computeCalendar };
