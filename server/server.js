const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
require('dotenv').config();

const app = express();

// ─── AWS Bedrock Client ────────────────────────────────────────────────────────
const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting (configurable via env)
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(60 * 60 * 1000), 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    message: { status: 'error', message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/recommendations', limiter);

// ─── Standardised response helpers ────────────────────────────────────────────
const ok = (res, data, extra = {}) => res.json({ status: 'success', data, ...extra });
const fail = (res, statusCode, message) =>
    res.status(statusCode).json({ status: 'error', message });

// ─── Math Helpers ──────────────────────────────────────────────────────────────
function getMonthsDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
    const includeCurrentMonth = end.getDate() >= 5;
    return Math.max(0, months + (includeCurrentMonth ? 1 : 0));
}

function getYearsDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (end - start) / (1000 * 60 * 60 * 24 * 365.25);
}

const FD_MS_PER_DAY = 1000 * 60 * 60 * 24;
const FD_DAYS_IN_YEAR = 364;
const FD_DAYS_PER_QUARTER = FD_DAYS_IN_YEAR / 4;

function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getFdElapsedDays(fromDate, toDate = new Date()) {
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);
    return Math.max((end.getTime() - parseLocalDate(fromDate).getTime()) / FD_MS_PER_DAY, 0);
}

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

// XIRR with optional key-based caching (results are stable per fund+nav date)
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

// ─── NAV Cache ────────────────────────────────────────────────────────────────
const MF_API_BASE_URL = 'https://api.mfapi.in/mf';
let _navCache = {};
let _navCacheTs = {};
const NAV_CACHE_DURATION = parseInt(
    process.env.NAV_CACHE_DURATION_MS || String(60 * 60 * 1000),
    10,
);

async function fetchCompleteNAVHistory(schemeCode) {
    const now = Date.now();
    if (
        _navCache[schemeCode] &&
        _navCacheTs[schemeCode] &&
        now - _navCacheTs[schemeCode] < NAV_CACHE_DURATION
    ) {
        return _navCache[schemeCode];
    }
    try {
        const response = await fetch(`${MF_API_BASE_URL}/${schemeCode}`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const navData = await response.json();
        _navCache[schemeCode] = navData;
        _navCacheTs[schemeCode] = now;
        return navData;
    } catch (err) {
        console.error(`NAV fetch failed for ${schemeCode}:`, err.message);
        return null;
    }
}

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

async function calculateFundValue(fund) {
    const empty = { totalUnits: 0, totalInvested: 0, currentValue: 0, latestNAV: 0, latestDate: null };
    if (!fund.schemeId) return empty;

    const navHistory = await fetchCompleteNAVHistory(fund.schemeId);
    if (!navHistory?.data?.length) return empty;

    const latestNAV = parseFloat(navHistory.data[0].nav);
    const latestDate = navHistory.data[0].date;
    let totalUnits = 0;
    let totalInvested = 0;

    for (const lumpsum of fund.lumpsums ?? []) {
        const nav = getNAVByDate(navHistory, lumpsum.date);
        if (nav) {
            totalUnits += lumpsum.amount / nav;
            totalInvested += lumpsum.amount;
        }
    }

    const now = new Date();
    // Process all SIPs from the sips array
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
                }
            }
        }
    }

    return { totalUnits, totalInvested, currentValue: totalUnits * latestNAV, latestNAV, latestDate };
}

// ─── Shared XIRR builder ───────────────────────────────────────────────────────
function buildCashFlows(fund, sipMonths, calculationDate) {
    const cashFlows = [];
    for (const ls of fund.lumpsums ?? []) {
        cashFlows.push({ date: new Date(ls.date), amount: -ls.amount });
    }
    // Process all SIPs from the sips array
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

// ─── Portfolio Config loader ───────────────────────────────────────────────────
async function loadConfig() {
    const configPath = path.join(__dirname, 'portfolioConfig.json');
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw);
}

// ----- Fix the Allocations after LLM's response
// After getting the API response, post-process to fix the total
function fixAllocationTotal(response, targetTotal, categoryLookup = {}) {
  const revisedPlan = response.recommendations.revisedPlan;

  // 1. Build category totals using lookup since revisedPlan has no category field
  const categoryMap = {};
  for (const fund of revisedPlan) {
    if (fund.revised > 0) {
      const category = categoryLookup[fund.name] ?? "Other";
      if (!categoryMap[category]) categoryMap[category] = 0;
      categoryMap[category] += fund.revised;
    }
  }

  // 2. Fix revisedPlan total if off
  const revisedTotal = revisedPlan.reduce((sum, f) => sum + f.revised, 0);
  const diff = targetTotal - revisedTotal;

  if (diff !== 0) {
    const activeFunds = revisedPlan
      .filter(f => !f.stop && f.revised > 0)
      .sort((a, b) => b.revised - a.revised);

    if (activeFunds.length > 0) {
      const topFund = activeFunds[0];
      topFund.revised += diff;
      topFund.change = (topFund.revised - topFund.current >= 0 ? "+" : "")
                       + (topFund.revised - topFund.current);

      // Also fix categoryMap for this fund
      const topCategory = categoryLookup[topFund.name] ?? "Other";
      categoryMap[topCategory] = (categoryMap[topCategory] || 0) + diff;
    }
  }

  // 3. Rebuild recommendedAllocation from corrected categoryMap
  const originalAllocations = response.recommendedAllocation?.allocations ?? [];

  response.recommendedAllocation = {
    totalTarget: targetTotal,
    allocations: Object.entries(categoryMap).map(([category, amount]) => {
      const orig = originalAllocations.find(a => a.category === category);
      return {
        category,
        amount,
        percentage: parseFloat(((amount / targetTotal) * 100).toFixed(2)),
        color: orig?.color ?? "emerald",
        advice: orig?.advice ?? ""
      };
    }),
    summary: response.recommendedAllocation?.summary ?? ""
  };

  return response;
}

// ─── Shared computation helpers ───────────────────────────────────────────────

/** Compute all MF fund values + totals from a loaded config */
async function computeMFData(config) {
    const currentDate = new Date();
    console.log(`📊 Processing ${config.funds.length} funds in parallel...`);

    const calculatedFunds = await Promise.all(
        config.funds.map(async (fund) => {
            const { totalUnits, totalInvested, currentValue, latestNAV, latestDate } =
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

            const cashFlows = buildCashFlows(fund, sipMonths, currentDate);
            cashFlows.push({ date: currentDate, amount: currentValue });

            const cacheKey = latestDate ? `${fund.id}_${latestDate}_xirr` : null;
            const xirr = cashFlows.length > 1 ? calculateXIRR(cashFlows, 0.1, cacheKey) : 0;
            const returns = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

            return {
                ...fund,
                totalUnits,
                totalInvested,
                currentValue,
                latestNAV,
                latestDate,
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
    totals.totalReturns =
        totals.totalInvested > 0
            ? ((totals.totalCurrentValue - totals.totalInvested) / totals.totalInvested) * 100
            : 0;

    return { funds: calculatedFunds, totals };
}

// ─── API Endpoints ─────────────────────────────────────────────────────────────

/** GET /api/health */
app.get('/api/health', (_req, res) =>
    ok(res, { service: 'mf-portfolio-api', timestamp: new Date().toISOString() }),
);

/** GET /api/portfolio/funds – Mutual funds only */
app.get('/api/portfolio/funds', async (_req, res) => {
    try {
        const config = await loadConfig();
        const { funds, totals } = await computeMFData(config);
        ok(res, { funds, totals });
    } catch (err) {
        console.error('Funds portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to calculate mutual funds');
    }
});

/** GET /api/portfolio/fds – Fixed deposits only */
app.get('/api/portfolio/fds', async (_req, res) => {
    try {
        const config = await loadConfig();
        const fixedDeposits = calculateFixedDeposits(config.fixedDeposits ?? []);
        ok(res, { fixedDeposits });
    } catch (err) {
        console.error('FDs portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to calculate fixed deposits');
    }
});

/**
 * GET /api/portfolio/complete
 * Kept for backward compatibility – returns funds + totals + fixedDeposits in one shot.
 */
app.get('/api/portfolio/complete', async (_req, res) => {
    try {
        const config = await loadConfig();
        const [{ funds, totals }, fixedDeposits] = await Promise.all([
            computeMFData(config),
            Promise.resolve(calculateFixedDeposits(config.fixedDeposits ?? [])),
        ]);
        ok(res, { funds, totals, fixedDeposits });
    } catch (err) {
        console.error('Complete portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to calculate portfolio');
    }
});

/** POST /api/recommendations – rate-limited AI recommendation endpoint */
app.post('/api/recommendations', async (req, res) => {
    try {
        const { portfolioData, currentValues } = req.body;
        if (!portfolioData || !currentValues)
            return fail(res, 400, 'Missing required portfolio data');

        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)
            throw new Error('AWS credentials not configured on server');

        const config = await loadConfig();
        const { llmConfig } = config;

        // Calculate total current SIP from active sips
        const currentDate = new Date();
        const totalCurrentSIP = portfolioData.funds.reduce((sum, f) => {
            let fundActiveSIP = 0;
            for (const sip of f.sips ?? []) {
                if (sip.amount > 0 && sip.startDate) {
                    const sipStart = new Date(sip.startDate);
                    // Check if this SIP is currently active
                    if (sipStart <= currentDate && (!sip.stopDate || new Date(sip.stopDate) >= currentDate)) {
                        fundActiveSIP += sip.amount;
                    }
                }
            }
            return sum + fundActiveSIP;
        }, 0);

        const portfolioAnalysis = {
            funds: portfolioData.funds
                .map((fund) => {
                    const m = currentValues[fund.id] ?? {};

                    // Calculate current active SIP amount for this fund
                    let currentSipAmount = 0;
                    let sipStartDate = null;
                    for (const sip of fund.sips ?? []) {
                        if (sip.amount > 0 && sip.startDate) {
                            const sipStart = new Date(sip.startDate);
                            // Track the earliest SIP start date
                            if (!sipStartDate || sipStart < sipStartDate) {
                                sipStartDate = sip.startDate;
                            }
                            // Check if this SIP is currently active
                            if (sipStart <= currentDate && (!sip.stopDate || new Date(sip.stopDate) >= currentDate)) {
                                currentSipAmount += sip.amount;
                            }
                        }
                    }

                    return {
                        id: fund.id,
                        name: fund.name,
                        shortName: fund.shortName,
                        category: fund.category,
                        sipAmount: currentSipAmount,
                        sipStartDate: sipStartDate,
                        totalLumpsum: (fund.lumpsums ?? []).reduce((s, l) => s + l.amount, 0),
                        lumpsumCount: fund.lumpsums?.length ?? 0,
                        currentValue: m.currentValue ?? 0,
                        totalInvested: m.totalInvested ?? 0,
                        absoluteReturns: m.absoluteReturns ?? 0,
                        returnsPercentage: m.returnsPercentage ?? 0,
                        xirr: m.xirr ?? 0,
                        investmentAgeMonths: sipStartDate
                            ? Math.max(0, (Date.now() - new Date(sipStartDate)) / (1000 * 60 * 60 * 24 * 30))
                            : fund.lumpsums?.length
                                ? Math.max(0, (Date.now() - new Date(fund.lumpsums[0].date)) / (1000 * 60 * 60 * 24 * 30))
                                : 0,
                        performanceStatus:
                            (m.xirr ?? 0) >= 15 ? 'excellent' :
                                (m.xirr ?? 0) >= 12 ? 'good' :
                                    (m.xirr ?? 0) >= 7 ? 'average' :
                                        (m.xirr ?? 0) < 0 ? 'poor' : 'monitor',
                    };
                })
                .filter(fund => fund.sipAmount > 0), // Only include funds with active SIPs
            totalCurrentSIP,
            totalInvested: Object.values(currentValues).reduce((s, v) => s + (v.totalInvested ?? 0), 0),
            totalCurrentValue: Object.values(currentValues).reduce((s, v) => s + (v.currentValue ?? 0), 0),
        };

        const systemPrompt = `You are an expert investment advisor specializing in Indian mutual funds.
        Analyze the provided portfolio data and generate actionable recommendations.

        CRITICAL CONSTRAINTS:
        1. MAINTAIN THE SAME TOTAL MONTHLY SIP AMOUNT (₹${totalCurrentSIP}). Do NOT increase or decrease the total.
        2. revisedPlan must contain ONLY the funds from the provided portfolio. No new funds.
        3. newInvestments is purely a suggestion list — these funds do NOT appear in revisedPlan and are NOT counted in any totals.
        4. SUM(revisedPlan[*].revised) MUST equal exactly ${totalCurrentSIP}. Verify before responding.
        5. recommendedAllocation MUST be derived only from revisedPlan:
        - Group revisedPlan funds (where revised > 0) by category
        - Sum revised amounts per category
        - percentage = (amount / ${totalCurrentSIP}) * 100, rounded to 2 decimal places
        - SUM of all allocation amounts MUST equal exactly ${totalCurrentSIP}

        SELF-CHECK before outputting:
        ✓ Every fund in revisedPlan exists in the provided portfolio
        ✓ No new fund appears in revisedPlan
        ✓ SUM(revisedPlan[*].revised) === ${totalCurrentSIP}
        ✓ SUM(recommendedAllocation.allocations[*].amount) === ${totalCurrentSIP}

        Return ONLY a valid JSON object with this exact structure:
        {
        "newInvestments": [{ "name": "...", "category": "...", "suggestedSip": 5000, "expectedReturns": "X-Y% CAGR", "reason": "...", "alternatives": "..." }],
        "revisedPlan": [{ "name": "...", "current": 4000, "revised": 5000, "change": "+1000", "stop": false, "add": false, "reason": "..." }],
        "resultMessage": "...",
        "recommendedAllocation": {
            "totalTarget": ${totalCurrentSIP},
            "allocations": [{ "category": "...", "amount": 0, "percentage": 0, "color": "emerald", "advice": "..." }],
            "summary": "..."
        }
        }

        REMINDER:
        - revisedPlan = existing portfolio funds only, no exceptions
        - newInvestments = suggestions only, ignored in all calculations
        - recommendedAllocation = derived solely from revisedPlan`;

        const userPrompt = `Portfolio: ${JSON.stringify(portfolioAnalysis)}. Keep total SIP at ₹${totalCurrentSIP}.`;

        const payload = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: llmConfig?.max_tokens ?? 4000,
            temperature: llmConfig?.temperature ?? 0.3,
            messages: [
                {
                    role: 'user',
                    content: `${systemPrompt}\n\nHuman: ${userPrompt}\n\nAssistant: I'll analyze your portfolio and provide recommendations in the requested JSON format.`,
                },
            ],
        };

        const command = new InvokeModelCommand({
            modelId: llmConfig.model,
            body: JSON.stringify(payload),
            contentType: 'application/json',
            accept: 'application/json',
        });

        const bedrockResponse = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
        const responseText = responseBody.content[0].text;

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in Bedrock response');
        const recs = JSON.parse(jsonMatch[0]);

        var response = {
            recommendations: {
                newInvestments: recs.newInvestments ?? [],
                revisedPlan: recs.revisedPlan ?? [],
                resultMessage: recs.resultMessage ?? 'Portfolio analysis completed',
            },
            recommendedAllocation: recs.recommendedAllocation ?? {
                totalTarget: totalCurrentSIP,
                allocations: [],
                summary: 'Current allocation',
            },
        };

        console.log('Raw LLM response:', JSON.stringify(response, null, 2));

        // Build name → category lookup from your portfolio data
        const categoryLookup = Object.fromEntries(
        portfolioAnalysis.funds.map(f => [f.name, f.category])
        );

        // Fix allocations before sending response
        const fixedAllocations = fixAllocationTotal(response, totalCurrentSIP, categoryLookup);

        ok(res, fixedAllocations);
    } catch (err) {
        console.error('Recommendation error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to generate recommendations');
    }
});

/**
 * GET /api/portfolio/investment-timeline
 * Returns month-by-month SIP + lumpsum investment data and SIP commitment history.
 */
app.get('/api/portfolio/investment-timeline', async (_req, res) => {
    try {
        const config = await loadConfig();
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

        if (!earliestDate) return ok(res, { months: [], sipCommitmentHistory: [] });

        // Generate all months from earliest to current month
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
                // SIP: check all sips in the array
                for (const sip of fund.sips ?? []) {
                    if (sip.amount > 0 && sip.startDate) {
                        const sipStart = new Date(sip.startDate);
                        const sipStartYear = sipStart.getFullYear();
                        const sipStartMonth = sipStart.getMonth();
                        const isAfterOrEqualStart =
                            year > sipStartYear || (year === sipStartYear && monthIdx >= sipStartMonth);

                        // Check if SIP is still active (not stopped)
                        let isBeforeOrEqualStop = true;
                        if (sip.stopDate) {
                            const sipStop = new Date(sip.stopDate);
                            const sipStopYear = sipStop.getFullYear();
                            const sipStopMonth = sipStop.getMonth();
                            isBeforeOrEqualStop =
                                year < sipStopYear || (year === sipStopYear && monthIdx <= sipStopMonth);
                        }

                        if (isAfterOrEqualStart && isBeforeOrEqualStop) {
                            const sipPaymentDate = new Date(year, monthIdx, 5);
                            if (sipPaymentDate <= now) {
                                sipAmount += sip.amount;
                            }
                        }
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
                    if (sip.amount > 0 && sip.startDate) {
                        const sipStart = new Date(sip.startDate);
                        const startY = sipStart.getFullYear();
                        const startM = sipStart.getMonth() + 1; // 1-based

                        // Check if SIP is active for this month (within start and stop dates)
                        const isAfterOrEqualStart = y > startY || (y === startY && mo >= startM);

                        let isBeforeOrEqualStop = true;
                        if (sip.stopDate) {
                            const sipStop = new Date(sip.stopDate);
                            const stopY = sipStop.getFullYear();
                            const stopM = sipStop.getMonth() + 1; // 1-based
                            isBeforeOrEqualStop = y < stopY || (y === stopY && mo <= stopM);
                        }

                        if (isAfterOrEqualStart && isBeforeOrEqualStop) {
                            totalCommitment += sip.amount;
                        }
                    }
                }
            }
            return { month, label, monthlyCommitment: totalCommitment };
        });

        ok(res, { months, sipCommitmentHistory });
    } catch (err) {
        console.error('Investment timeline error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to calculate timeline');
    }
});

// ─── Metals Price Helpers ──────────────────────────────────────────────────────
const METALS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let _metalsCache = { data: null, timestamp: null };

async function fetchMetalSpotPricesINR() {
    const now = Date.now();
    if (_metalsCache.data && _metalsCache.timestamp && now - _metalsCache.timestamp < METALS_CACHE_TTL) {
        return _metalsCache.data;
    }

    const res = await fetch('https://bullions.co.in/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)',
            'Accept': 'text/html',
        },
    });
    if (!res.ok) throw new Error(`bullions.co.in HTTP ${res.status}`);
    const html = await res.text();

    // Primary: table row — label cell contains <small> tag, so use lazy [\ s\S]*? to pass through it
    // HTML: <td …>Gold 24 Karat <small>(Rs …)</small></td> <td …>15,681</td>
    const goldTableMatch = html.match(/Gold\s+24\s+Karat[\s\S]*?<\/td>\s*<td[^>]*>([\d,]+)/i);
    // HTML: <td …>Silver 999 Fine <small>(Rs …)</small></td> <td …>268</td>
    const silverTableMatch = html.match(/Silver\s+999\s+Fine[\s\S]*?<\/td>\s*<td[^>]*>([\d,]+)/i);

    // Fallback: ticker "GOLD 156,810.00 … / 10gm" and "SILVER 267,790.00 … / 1kg"
    const goldTickerMatch = html.match(/GOLD\s+([\d,]+(?:\.\d+)?)\s/);
    const silverTickerMatch = html.match(/SILVER\s+([\d,]+(?:\.\d+)?)\s/);

    let goldPerGram, silverPerGram;

    if (goldTableMatch) {
        goldPerGram = parseFloat(goldTableMatch[1].replace(/,/g, ''));
    } else if (goldTickerMatch) {
        goldPerGram = parseFloat(goldTickerMatch[1].replace(/,/g, '')) / 10; // per 10g → per g
    } else {
        throw new Error('Could not parse gold price from bullions.co.in');
    }

    if (silverTableMatch) {
        silverPerGram = parseFloat(silverTableMatch[1].replace(/,/g, ''));
    } else if (silverTickerMatch) {
        silverPerGram = parseFloat(silverTickerMatch[1].replace(/,/g, '')) / 1000; // per kg → per g
    } else {
        throw new Error('Could not parse silver price from bullions.co.in');
    }

    if (!goldPerGram || goldPerGram <= 0) throw new Error('Invalid gold price from bullions.co.in');
    if (!silverPerGram || silverPerGram <= 0) throw new Error('Invalid silver price from bullions.co.in');

    const result = {
        gold: { pricePerGram: goldPerGram },
        silver: { pricePerGram: silverPerGram },
        fetchedAt: new Date().toISOString(),
        source: 'bullions.co.in',
    };
    _metalsCache = { data: result, timestamp: now };
    return result;
}

function computeMetalHoldings(entries, pricePerGram) {
    const holdings = entries.map((entry) => {
        const totalInvested = parseFloat((entry.quantity * entry.purchasePrice).toFixed(2));
        const currentValue = parseFloat((entry.quantity * pricePerGram).toFixed(2));
        const gain = parseFloat((currentValue - totalInvested).toFixed(2));
        const gainPercent = totalInvested > 0 ? parseFloat(((gain / totalInvested) * 100).toFixed(2)) : 0;
        const holdingDays = Math.floor(
            (Date.now() - new Date(entry.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return { ...entry, totalInvested, currentValue, gain, gainPercent, holdingDays };
    });

    const totals = holdings.reduce(
        (acc, h) => ({
            totalQuantity: acc.totalQuantity + h.quantity,
            totalInvested: acc.totalInvested + h.totalInvested,
            totalCurrentValue: acc.totalCurrentValue + h.currentValue,
            totalGain: acc.totalGain + h.gain,
        }),
        { totalQuantity: 0, totalInvested: 0, totalCurrentValue: 0, totalGain: 0 }
    );
    totals.totalQuantity = parseFloat(totals.totalQuantity.toFixed(4));
    totals.totalInvested = parseFloat(totals.totalInvested.toFixed(2));
    totals.totalCurrentValue = parseFloat(totals.totalCurrentValue.toFixed(2));
    totals.totalGain = parseFloat(totals.totalGain.toFixed(2));
    totals.totalGainPercent =
        totals.totalInvested > 0
            ? parseFloat(((totals.totalGain / totals.totalInvested) * 100).toFixed(2))
            : 0;

    return { holdings, totals };
}

/** GET /api/portfolio/gold */
app.get('/api/portfolio/gold', async (_req, res) => {
    try {
        const [config, prices] = await Promise.all([loadConfig(), fetchMetalSpotPricesINR()]);
        const { holdings, totals } = computeMetalHoldings(config.gold ?? [], prices.gold.pricePerGram);
        ok(res, { holdings, totals, pricePerGram: prices.gold.pricePerGram, fetchedAt: prices.fetchedAt });
    } catch (err) {
        console.error('Gold portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to fetch gold data');
    }
});

/** GET /api/portfolio/silver */
app.get('/api/portfolio/silver', async (_req, res) => {
    try {
        const [config, prices] = await Promise.all([loadConfig(), fetchMetalSpotPricesINR()]);
        const { holdings, totals } = computeMetalHoldings(config.silver ?? [], prices.silver.pricePerGram);
        ok(res, { holdings, totals, pricePerGram: prices.silver.pricePerGram, fetchedAt: prices.fetchedAt });
    } catch (err) {
        console.error('Silver portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to fetch silver data');
    }
});

// ─── EPF Helpers ───────────────────────────────────────────────────────────────

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

/**
 * Calculates EPF corpus using the exact EPFO method, verified against passbook.
 *
 * Two key rules (derived from passbook data):
 *  1. OPENING BALANCE: each month contributes its opening balance (before that
 *     month's deposit) to the interest sum — not the closing balance.
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

    const empContrib  = employeeContribution  ?? monthlyContribution / 2;
    const emplContrib = employerContribution  ?? monthlyContribution / 2;

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

    if (months.length === 0) {
        return {
            startDate, monthlyContribution,
            employeeContribution: empContrib, employerContribution: emplContrib,
            monthsContributed: 0, totalInvested: 0, currentValue: 0,
            gain: 0, gainPercent: 0, annualRate: 8.25, calcUpTo: calcUpToStr,
        };
    }

    const totalInvested = months.length * monthlyContribution;

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

    let balance    = 0;
    let currentFYRate = 8.25;

    for (const [fyKey, fyMonths] of fyGroups) {
        const rate = EPF_RATES[fyKey] ?? 8.25;
        currentFYRate = rate;
        const monthlyRate = rate / 100 / 12;

        let sumRunningBalances = 0;
        let running = balance;

        for (const _m of fyMonths) {
            sumRunningBalances += running;   // opening balance (before deposit)
            running += monthlyContribution;  // then add this month's contribution
        }

        // EPFO rounds employee share and employer share interest to the nearest
        // rupee separately, then sums — matching passbook exactly.
        const fyComplete    = fyMonths[fyMonths.length - 1].month === 1; // last wage = Feb
        const fyEndYear     = parseInt(fyKey.split('-')[0]) + 1;
        const creditingDate = new Date(fyEndYear, 8, 1); // Sep 1 of FY end year
        const interestEmp  = Math.round(sumRunningBalances * (empContrib  / monthlyContribution) * monthlyRate);
        const interestEmpl = Math.round(sumRunningBalances * (emplContrib / monthlyContribution) * monthlyRate);
        const interest = (fyComplete && now >= creditingDate)
            ? interestEmp + interestEmpl
            : 0;
        balance = running + interest;
    }

    const gain = parseFloat((balance - totalInvested).toFixed(2));
    const gainPercent = totalInvested > 0
        ? parseFloat(((gain / totalInvested) * 100).toFixed(2)) : 0;

    return {
        startDate, monthlyContribution,
        employeeContribution: empContrib, employerContribution: emplContrib,
        monthsContributed: months.length,
        totalInvested: parseFloat(totalInvested.toFixed(2)),
        currentValue: balance,
        gain, gainPercent, annualRate: currentFYRate, calcUpTo: calcUpToStr,
    };
}

/** GET /api/portfolio/epf */
app.get('/api/portfolio/epf', async (_req, res) => {
    try {
        const config = await loadConfig();
        if (!config.epf) return fail(res, 404, 'EPF config not found');

        // Support both legacy single-object and new array format
        const accountConfigs = Array.isArray(config.epf) ? config.epf : [config.epf];
        const accounts = accountConfigs.map((acc, i) => ({
            id: acc.id ?? i + 1,
            label: acc.label ?? 'EPF Account',
            ...computeEPFValue(acc),
        }));

        // Aggregate totals across all accounts
        const totalInvested = parseFloat(accounts.reduce((s, a) => s + a.totalInvested, 0).toFixed(2));
        const currentValue  = parseFloat(accounts.reduce((s, a) => s + a.currentValue, 0).toFixed(2));
        const gain          = parseFloat((currentValue - totalInvested).toFixed(2));
        const gainPercent   = totalInvested > 0 ? parseFloat(((gain / totalInvested) * 100).toFixed(2)) : 0;

        ok(res, { accounts, totalInvested, currentValue, gain, gainPercent });
    } catch (err) {
        console.error('EPF portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to calculate EPF');
    }
});

/** GET /api/portfolio/overview – Aggregated overview data for all assets */
app.get('/api/portfolio/overview', async (_req, res) => {
    try {
        const config = await loadConfig();

        // Parallel fetch of all asset totals
        const [
            { totals: mfTotals },
            metalPrices,
        ] = await Promise.all([
            computeMFData(config),
            fetchMetalSpotPricesINR(),
        ]);

        // FDs - calculate totals only
        const fds = calculateFixedDeposits(config.fixedDeposits ?? []);
        const fdTotals = {
            totalInvested: parseFloat(fds.reduce((sum, fd) => sum + fd.principal, 0).toFixed(2)),
            totalCurrentValue: parseFloat(fds.reduce((sum, fd) => sum + fd.currentValue, 0).toFixed(2)),
        };

        // Gold totals
        const { totals: goldTotals } = computeMetalHoldings(config.gold ?? [], metalPrices.gold.pricePerGram);

        // Silver totals
        const { totals: silverTotals } = computeMetalHoldings(config.silver ?? [], metalPrices.silver.pricePerGram);

        // EPF totals
        let epfTotals = { totalInvested: 0, totalCurrentValue: 0 };
        if (config.epf) {
            const accountConfigs = Array.isArray(config.epf) ? config.epf : [config.epf];
            const accounts = accountConfigs.map(acc => computeEPFValue(acc));
            epfTotals.totalInvested = parseFloat(accounts.reduce((s, a) => s + a.totalInvested, 0).toFixed(2));
            epfTotals.totalCurrentValue = parseFloat(accounts.reduce((s, a) => s + a.currentValue, 0).toFixed(2));
        }

        // Build asset breakdown
        const assets = [
            {
                id: 'mutualFunds',
                label: 'Mutual Funds',
                invested: mfTotals.totalInvested,
                current: mfTotals.totalCurrentValue,
                returns: parseFloat((mfTotals.totalCurrentValue - mfTotals.totalInvested).toFixed(2)),
                returnPercent: mfTotals.totalInvested > 0
                    ? parseFloat(((mfTotals.totalCurrentValue - mfTotals.totalInvested) / mfTotals.totalInvested * 100).toFixed(2))
                    : 0,
            },
            {
                id: 'fds',
                label: 'Fixed Deposits',
                invested: fdTotals.totalInvested,
                current: fdTotals.totalCurrentValue,
                returns: parseFloat((fdTotals.totalCurrentValue - fdTotals.totalInvested).toFixed(2)),
                returnPercent: fdTotals.totalInvested > 0
                    ? parseFloat(((fdTotals.totalCurrentValue - fdTotals.totalInvested) / fdTotals.totalInvested * 100).toFixed(2))
                    : 0,
            },
            {
                id: 'gold',
                label: 'Gold',
                invested: goldTotals.totalInvested,
                current: goldTotals.totalCurrentValue,
                returns: parseFloat((goldTotals.totalCurrentValue - goldTotals.totalInvested).toFixed(2)),
                returnPercent: goldTotals.totalInvested > 0
                    ? parseFloat(((goldTotals.totalCurrentValue - goldTotals.totalInvested) / goldTotals.totalInvested * 100).toFixed(2))
                    : 0,
            },
            {
                id: 'silver',
                label: 'Silver',
                invested: silverTotals.totalInvested,
                current: silverTotals.totalCurrentValue,
                returns: parseFloat((silverTotals.totalCurrentValue - silverTotals.totalInvested).toFixed(2)),
                returnPercent: silverTotals.totalInvested > 0
                    ? parseFloat(((silverTotals.totalCurrentValue - silverTotals.totalInvested) / silverTotals.totalInvested * 100).toFixed(2))
                    : 0,
            },
            {
                id: 'epf',
                label: 'EPF',
                invested: epfTotals.totalInvested,
                current: epfTotals.totalCurrentValue,
                returns: parseFloat((epfTotals.totalCurrentValue - epfTotals.totalInvested).toFixed(2)),
                returnPercent: epfTotals.totalInvested > 0
                    ? parseFloat(((epfTotals.totalCurrentValue - epfTotals.totalInvested) / epfTotals.totalInvested * 100).toFixed(2))
                    : 0,
            },
        ];

        // Grand totals
        const grandTotals = {
            totalInvested: parseFloat(assets.reduce((sum, a) => sum + a.invested, 0).toFixed(2)),
            totalCurrentValue: parseFloat(assets.reduce((sum, a) => sum + a.current, 0).toFixed(2)),
            totalGain: parseFloat(assets.reduce((sum, a) => sum + a.returns, 0).toFixed(2)),
            totalGainPercent: 0,
        };
        grandTotals.totalGainPercent = grandTotals.totalInvested > 0
            ? parseFloat((grandTotals.totalGain / grandTotals.totalInvested * 100).toFixed(2))
            : 0;

        ok(res, {
            totals: grandTotals,
            assets,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Overview portfolio error:', err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : 'Failed to calculate overview');
    }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
    console.log(`🚀 MF Portfolio API running on port ${PORT}`);
    console.log(`   Endpoints: /api/health  /api/portfolio/overview  /api/portfolio/complete  /api/recommendations`);
});

module.exports = app;
