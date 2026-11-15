// Fixed deposits: cycles (renewals), today's accrued value and progress to the final maturity
const { parseLocalDate } = require('../lib/dates');

const FD_MS_PER_DAY = 1000 * 60 * 60 * 24;
const FD_DAYS_IN_YEAR = 364;
const FD_DAYS_PER_QUARTER = FD_DAYS_IN_YEAR / 4;

function getFdElapsedDays(fromDate, toDate = new Date()) {
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);
    return Math.max((end.getTime() - parseLocalDate(fromDate).getTime()) / FD_MS_PER_DAY, 0);
}

// Quarterly compounding for whole quarters, simple interest for the days since
function calcFdCurrentValue(principal, annualRatePercent, elapsedDays) {
    const annualRate = annualRatePercent / 100;
    const completedQuarters = Math.floor(elapsedDays / FD_DAYS_PER_QUARTER);
    const remainingDays = elapsedDays - completedQuarters * FD_DAYS_PER_QUARTER;
    const roundedDayFraction = Math.round((remainingDays / FD_DAYS_IN_YEAR) * 10000000) / 10000000;
    const amountAfterCompletedQuarters = principal * Math.pow(1 + annualRate / 4, completedQuarters);
    return amountAfterCompletedQuarters * (1 + annualRate * roundedDayFraction);
}

function calculateFixedDeposits(rawDeposits = []) {
    return rawDeposits.map((deposit) => {
        const normalizedName = deposit.name ?? `FD ${deposit.label ?? deposit.id}`;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let runningAmount = deposit.principal;
        const cycleData = (deposit.cycles ?? []).map((cycle, index) => {
            const startAmount = runningAmount;
            const maturityAmount = startAmount + cycle.interestBank;
            runningAmount = maturityAmount;
            return {
                ...cycle,
                index,
                startAmount,
                interest: cycle.interestBank,
                maturityAmount,
                maturityDateObj: parseLocalDate(cycle.maturityDate),
            };
        });

        if (cycleData.length === 0) {
            return {
                ...deposit,
                name: normalizedName,
                cycleData: [],
                finalMaturityAmount: deposit.principal,
                totalInterest: 0,
                currentValue: deposit.principal,
                activeCycleIdx: 0,
                progress: { pct: 100, cycleBoundaries: [], activeCycleIdx: 0 },
            };
        }

        const finalMaturityAmount = runningAmount;
        const totalInterest = finalMaturityAmount - deposit.principal;

        let currentValue = finalMaturityAmount;
        let activeCycleIdx = cycleData.length;
        for (let i = 0; i < cycleData.length; i++) {
            if (now < cycleData[i].maturityDateObj) {
                activeCycleIdx = i;
                const fromDate = i === 0 ? deposit.startDate : cycleData[i - 1].maturityDate;
                const elapsedDays = getFdElapsedDays(fromDate, now);
                currentValue = parseFloat(
                    calcFdCurrentValue(cycleData[i].startAmount, cycleData[i].rate, elapsedDays).toFixed(2),
                );
                break;
            }
        }

        const start = parseLocalDate(deposit.startDate);
        const lastMaturity = cycleData[cycleData.length - 1].maturityDateObj;
        const totalMs = lastMaturity - start;
        const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
        const pct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 100;
        const cycleBoundaries = cycleData.slice(0, -1).map(
            (cycle) => ((cycle.maturityDateObj - start) / totalMs) * 100,
        );

        return {
            ...deposit,
            name: normalizedName,
            cycleData,
            finalMaturityAmount,
            totalInterest,
            currentValue,
            activeCycleIdx,
            progress: { pct, cycleBoundaries, activeCycleIdx },
        };
    });
}

module.exports = { calculateFixedDeposits };
