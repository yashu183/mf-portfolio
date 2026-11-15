// EPF: the corpus of each account the way EPFO's passbook works it out

// EPFO declared rates per financial year (Apr–Mar)
const EPF_RATES = {
    '2021-22': 8.10,
    '2022-23': 8.15,
    '2023-24': 8.25,
    '2024-25': 8.25,
    '2025-26': 8.25, // officially declared
    '2026-27': 8.25, // assumed
};

function epfFYKey(year, month) {
    // month is 0-indexed (0=Jan, 3=Apr)
    const fyStart = month >= 3 ? year : year - 1;
    return fyStart + '-' + String((fyStart + 1) % 100).padStart(2, '0');
}

// The config's accounts as a list (it may be a single object, the older format)
const epfAccounts = (config) => (config.epf ? (Array.isArray(config.epf) ? config.epf : [config.epf]) : []);

/**
 * Calculates EPF corpus using the exact EPFO method, verified against passbook.
 *
 * Two key rules (derived from passbook data):
 *  1. OPENING BALANCE: each month contributes its opening balance (before that
 *     month's deposit) to the interest sum - not the closing balance.
 *     → First contribution naturally earns 0 (opening = 0), no nil-month hack.
 *  2. CREDIT-MONTH GROUPING: wages for month M are credited in month M+1, so
 *     March wages (credited April) fall in the NEXT financial year.
 *     → FY is complete when the last wage month is February (credited March).
 *
 * Interest is posted to accounts only after EPFO processes it (~Sep each year),
 * so FY 2025-26 interest (due Sep 2026) is excluded on May 2026.
 */
function computeEPFValue(epfConfig) {
    const { startDate, monthlyContribution, employeeContribution, employerContribution } = epfConfig;

    // Base contribution applies from startDate; contributionHistory entries
    // ({ from: 'YYYY-MM', employeeContribution, employerContribution }) override it
    // from that wage month onward.
    const baseEmp  = employeeContribution ?? monthlyContribution / 2;
    const baseEmpl = employerContribution ?? monthlyContribution / 2;
    const history = [...(epfConfig.contributionHistory ?? [])].sort((a, b) => a.from.localeCompare(b.from));
    const contribFor = (year, month) => {
        const key = year + '-' + String(month + 1).padStart(2, '0');
        let emp = baseEmp, empl = baseEmpl;
        for (const h of history) {
            if (h.from <= key) {
                emp = h.employeeContribution ?? emp;
                empl = h.employerContribution ?? empl;
            }
        }
        return { emp, empl };
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const calcEndDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const calcUpToStr = calcEndDate.getFullYear() + '-' + String(calcEndDate.getMonth() + 1).padStart(2, '0');

    const start = new Date(startDate + 'T00:00:00');

    // Build all wage months from startDate → calcEndDate
    const months = [];
    { let y = start.getFullYear(), m = start.getMonth();
      while (new Date(y, m, 1) <= calcEndDate) {
          months.push({ year: y, month: m });
          m++; if (m > 11) { m = 0; y++; }
      }
    }

    // Current (latest applicable) contribution, reported back to the UI
    const latest = months.length
        ? contribFor(months[months.length - 1].year, months[months.length - 1].month)
        : { emp: baseEmp, empl: baseEmpl };
    const empContrib = latest.emp;
    const emplContrib = latest.empl;
    const currentMonthly = empContrib + emplContrib;

    // Revision timeline for the UI: starting amounts + each change
    const startKey = startDate.slice(0, 7);
    const contributionRevisions = [
        { from: startKey, employeeContribution: baseEmp, employerContribution: baseEmpl },
        ...history.map((h, i, arr) => {
            const prev = arr.slice(0, i).reduce(
                (acc, x) => ({
                    emp: x.employeeContribution ?? acc.emp,
                    empl: x.employerContribution ?? acc.empl,
                }),
                { emp: baseEmp, empl: baseEmpl }
            );
            return {
                from: h.from,
                employeeContribution: h.employeeContribution ?? prev.emp,
                employerContribution: h.employerContribution ?? prev.empl,
            };
        }),
    ].map((r) => ({ ...r, total: r.employeeContribution + r.employerContribution }));

    if (months.length === 0) {
        return {
            startDate, monthlyContribution: currentMonthly, contributionRevisions,
            employeeContribution: empContrib, employerContribution: emplContrib,
            monthsContributed: 0, totalInvested: 0, currentValue: 0,
            gain: 0, gainPercent: 0, annualRate: 8.25, calcUpTo: calcUpToStr,
        };
    }

    const totalInvested = months.reduce((sum, e) => {
        const c = contribFor(e.year, e.month);
        return sum + c.emp + c.empl;
    }, 0);

    // Group wage months by the FY of their CREDIT month (wage month + 1).
    // March wages are credited in April → they belong to the next FY.
    const fyGroups = new Map();
    for (const e of months) {
        const creditMonth = (e.month + 1) % 12;
        const creditYear  = e.month === 11 ? e.year + 1 : e.year;
        const key = epfFYKey(creditYear, creditMonth);
        if (!fyGroups.has(key)) fyGroups.set(key, []);
        fyGroups.get(key).push(e);
    }

    let balEmp  = 0;
    let balEmpl = 0;
    let currentFYRate = 8.25;

    for (const [fyKey, fyMonths] of fyGroups) {
        const rate = EPF_RATES[fyKey] ?? 8.25;
        currentFYRate = rate;
        const monthlyRate = rate / 100 / 12;

        let sumEmp = 0, sumEmpl = 0;
        let runEmp = balEmp, runEmpl = balEmpl;

        for (const m of fyMonths) {
            sumEmp  += runEmp;               // opening balance (before deposit)
            sumEmpl += runEmpl;
            const c = contribFor(m.year, m.month);
            runEmp  += c.emp;                // then add this month's contribution
            runEmpl += c.empl;
        }

        // EPFO rounds employee share and employer share interest to the nearest
        // rupee separately, then sums - matching passbook exactly.
        const fyComplete    = fyMonths[fyMonths.length - 1].month === 1; // last wage = Feb
        const fyEndYear     = parseInt(fyKey.split('-')[0]) + 1;
        const creditingDate = new Date(fyEndYear, 8, 1); // Sep 1 of FY end year
        const credit = fyComplete && now >= creditingDate;
        balEmp  = runEmp  + (credit ? Math.round(sumEmp  * monthlyRate) : 0);
        balEmpl = runEmpl + (credit ? Math.round(sumEmpl * monthlyRate) : 0);
    }
    const balance = balEmp + balEmpl;

    const gain = parseFloat((balance - totalInvested).toFixed(2));
    const gainPercent = totalInvested > 0
        ? parseFloat(((gain / totalInvested) * 100).toFixed(2)) : 0;

    return {
        startDate, monthlyContribution: currentMonthly, contributionRevisions,
        employeeContribution: empContrib, employerContribution: emplContrib,
        monthsContributed: months.length,
        totalInvested: parseFloat(totalInvested.toFixed(2)),
        currentValue: balance,
        gain, gainPercent, annualRate: currentFYRate, calcUpTo: calcUpToStr,
    };
}

/** Every account, worked out, with totals across them */
function computeEPF(config) {
    const accounts = epfAccounts(config).map((acc, i) => ({
        id: acc.id ?? i + 1,
        label: acc.label ?? 'EPF Account',
        ...computeEPFValue(acc),
    }));
    const totalInvested = parseFloat(accounts.reduce((s, a) => s + a.totalInvested, 0).toFixed(2));
    const currentValue  = parseFloat(accounts.reduce((s, a) => s + a.currentValue, 0).toFixed(2));
    const gain          = parseFloat((currentValue - totalInvested).toFixed(2));
    const gainPercent   = totalInvested > 0 ? parseFloat(((gain / totalInvested) * 100).toFixed(2)) : 0;
    return { accounts, totalInvested, currentValue, gain, gainPercent };
}

module.exports = { computeEPF, epfAccounts };
