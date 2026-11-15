// Month-by-month SIP + lump sum amounts, and the total monthly SIP committed in each month

// Whether a SIP runs in a month (year, 0-based month), by its start and stop months
function sipRunsIn(sip, year, monthIdx) {
    const start = new Date(sip.startDate);
    const afterStart = year > start.getFullYear() || (year === start.getFullYear() && monthIdx >= start.getMonth());
    if (!sip.stopDate) return afterStart;
    const stop = new Date(sip.stopDate);
    return afterStart && (year < stop.getFullYear() || (year === stop.getFullYear() && monthIdx <= stop.getMonth()));
}

function computeTimeline(config) {
    const funds = config.funds;
    const now = new Date();

    // Find the earliest investment date across all funds
    let earliestDate = null;
    for (const fund of funds) {
        for (const ls of fund.lumpsums ?? []) {
            const d = new Date(ls.date);
            if (!earliestDate || d < earliestDate) earliestDate = d;
        }
        for (const sip of fund.sips ?? []) {
            if (sip.startDate) {
                const d = new Date(sip.startDate);
                if (!earliestDate || d < earliestDate) earliestDate = d;
            }
        }
    }

    if (!earliestDate) return { months: [], sipCommitmentHistory: [] };

    // Every month from the earliest investment to this one
    const months = [];
    const cursor = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    while (cursor <= endMonth) {
        const year = cursor.getFullYear();
        const monthIdx = cursor.getMonth();
        const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
        const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

        let sipAmount = 0;
        let lumpsumAmount = 0;

        for (const fund of funds) {
            // SIPs paid this month (on the 5th, once it has come)
            for (const sip of fund.sips ?? []) {
                if (sip.amount > 0 && sip.startDate && sipRunsIn(sip, year, monthIdx) && new Date(year, monthIdx, 5) <= now) {
                    sipAmount += sip.amount;
                }
            }
            // Lumpsums: any lumpsum made in this calendar month
            for (const ls of fund.lumpsums ?? []) {
                const lsDate = new Date(ls.date);
                if (lsDate.getFullYear() === year && lsDate.getMonth() === monthIdx) {
                    lumpsumAmount += ls.amount;
                }
            }
        }

        months.push({
            month: monthKey,
            label: monthLabel,
            sipAmount,
            lumpsumAmount,
            totalAmount: sipAmount + lumpsumAmount,
        });

        cursor.setMonth(cursor.getMonth() + 1);
    }

    // SIP commitment history – total monthly committed SIP for every month
    // (steps up whenever a new SIP fund starts – these are the "revisions")
    const sipCommitmentHistory = months.map(({ month, label }) => {
        const [y, mo] = month.split('-').map(Number);
        let totalCommitment = 0;
        for (const fund of funds) {
            for (const sip of fund.sips ?? []) {
                if (sip.amount > 0 && sip.startDate && sipRunsIn(sip, y, mo - 1)) totalCommitment += sip.amount;
            }
        }
        return { month, label, monthlyCommitment: totalCommitment };
    });

    return { months, sipCommitmentHistory };
}

module.exports = { computeTimeline };
