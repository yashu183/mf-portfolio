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

    if (fund.sipAmount > 0 && fund.sipStartDate) {
        const sipStart = new Date(fund.sipStartDate);
        const now = new Date();
        // Calculate effective end date: use sipStopDate if it exists and is before today
        const endDate = fund.sipStopDate && new Date(fund.sipStopDate) < now ? new Date(fund.sipStopDate) : now;
        const sipMonths = getMonthsDifference(sipStart, endDate);
        for (let m = 0; m < sipMonths; m++) {
            const sipDate = new Date(sipStart);
            sipDate.setMonth(sipStart.getMonth() + m);
            sipDate.setDate(5);
            const nav = getNAVByDate(navHistory, sipDate);
            if (nav) {
                totalUnits += fund.sipAmount / nav;
                totalInvested += fund.sipAmount;
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
    if (fund.sipAmount > 0 && fund.sipStartDate) {
        const sipStart = new Date(fund.sipStartDate);
        // If sipStopDate exists and is before calculationDate, cap sipMonths at that date
        let effectiveEndDate = calculationDate;
        if (fund.sipStopDate && new Date(fund.sipStopDate) < calculationDate) {
            effectiveEndDate = new Date(fund.sipStopDate);
        }
        const effectiveSipMonths = getMonthsDifference(sipStart, effectiveEndDate);
        for (let i = 0; i < effectiveSipMonths; i++) {
            const d = new Date(sipStart);
            d.setMonth(sipStart.getMonth() + i);
            d.setDate(5);
            cashFlows.push({ date: d, amount: -fund.sipAmount });
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

// ─── API Endpoints ─────────────────────────────────────────────────────────────

/** GET /health */
app.get('/health', (_req, res) =>
    ok(res, { service: 'mf-portfolio-api', timestamp: new Date().toISOString() }),
);

/**
 * GET /api/portfolio/complete
 * Fetches all fund NAVs in PARALLEL, calculates everything and returns ready-to-render data.
 */
app.get('/api/portfolio/complete', async (_req, res) => {
    try {
        const config = await loadConfig();
        const currentDate = new Date();
        console.log(`📊 Processing ${config.funds.length} funds in parallel...`);

        // ⚡ Parallel NAV fetching – all funds fetched concurrently
        const calculatedFunds = await Promise.all(
            config.funds.map(async (fund) => {
                const { totalUnits, totalInvested, currentValue, latestNAV, latestDate } =
                    await calculateFundValue(fund);

                // Calculate effective SIP end date considering sipStopDate
                const sipStartDate = fund.sipStartDate ? new Date(fund.sipStartDate) : null;
                let effectiveSipEndDate = currentDate;
                if (fund.sipStopDate && new Date(fund.sipStopDate) < currentDate) {
                    effectiveSipEndDate = new Date(fund.sipStopDate);
                }
                const sipMonths = sipStartDate ? getMonthsDifference(sipStartDate, effectiveSipEndDate) : 0;
                const totalLumpsum = (fund.lumpsums ?? []).reduce((s, l) => s + l.amount, 0);
                const totalSIPInvested = (fund.sipAmount ?? 0) * sipMonths;
                const startDate =
                    fund.sipStartDate ??
                    (fund.lumpsums?.length
                        ? new Date(Math.min(...fund.lumpsums.map((l) => new Date(l.date))))
                        : currentDate);
                const investmentAge = getMonthsDifference(startDate, currentDate);

                const cashFlows = buildCashFlows(fund, sipMonths, currentDate);
                cashFlows.push({ date: currentDate, amount: currentValue });

                // Stable cache key: fund + nav date (NAV date acts as a proxy for "data version")
                const cacheKey = latestDate ? `${fund.id}_${latestDate}_xirr` : null;
                const xirr = cashFlows.length > 1 ? calculateXIRR(cashFlows, 0.1, cacheKey) : 0;
                const returns =
                    totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

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
                };
            }),
        );

        const totals = calculatedFunds.reduce(
            (acc, f) => {
                acc.totalInvested += f.totalInvested;
                acc.totalCurrentValue += f.currentValue;
                acc.monthlySIP += f.sipAmount ?? 0;
                return acc;
            },
            { totalInvested: 0, totalCurrentValue: 0, monthlySIP: 0 },
        );
        totals.totalReturns =
            totals.totalInvested > 0
                ? ((totals.totalCurrentValue - totals.totalInvested) / totals.totalInvested) * 100
                : 0;

        ok(res, { funds: calculatedFunds, totals });
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

        const totalCurrentSIP = portfolioData.funds.reduce((s, f) => s + (f.sipAmount ?? 0), 0);

        const portfolioAnalysis = {
            funds: portfolioData.funds.map((fund) => {
                const m = currentValues[fund.id] ?? {};
                return {
                    id: fund.id,
                    name: fund.name,
                    shortName: fund.shortName,
                    category: fund.category,
                    sipAmount: fund.sipAmount ?? 0,
                    sipStartDate: fund.sipStartDate,
                    totalLumpsum: (fund.lumpsums ?? []).reduce((s, l) => s + l.amount, 0),
                    lumpsumCount: fund.lumpsums?.length ?? 0,
                    currentValue: m.currentValue ?? 0,
                    totalInvested: m.totalInvested ?? 0,
                    absoluteReturns: m.absoluteReturns ?? 0,
                    returnsPercentage: m.returnsPercentage ?? 0,
                    xirr: m.xirr ?? 0,
                    investmentAgeMonths: fund.sipStartDate
                        ? Math.max(0, (Date.now() - new Date(fund.sipStartDate)) / (1000 * 60 * 60 * 24 * 30))
                        : fund.lumpsums?.length
                            ? Math.max(0, (Date.now() - new Date(fund.lumpsums[0].date)) / (1000 * 60 * 60 * 24 * 30))
                            : 0,
                    performanceStatus:
                        (m.xirr ?? 0) >= 15 ? 'excellent' :
                            (m.xirr ?? 0) >= 12 ? 'good' :
                                (m.xirr ?? 0) >= 7 ? 'average' :
                                    (m.xirr ?? 0) < 0 ? 'poor' : 'monitor',
                };
            }),
            totalCurrentSIP,
            totalInvested: Object.values(currentValues).reduce((s, v) => s + (v.totalInvested ?? 0), 0),
            totalCurrentValue: Object.values(currentValues).reduce((s, v) => s + (v.currentValue ?? 0), 0),
        };

        const systemPrompt = `You are an expert investment advisor specializing in Indian mutual funds.
Analyze the provided portfolio data and generate actionable recommendations.

CRITICAL CONSTRAINTS:
1. MAINTAIN THE SAME TOTAL MONTHLY SIP AMOUNT (₹${totalCurrentSIP}). Do NOT increase or decrease the total.
2. Include ALL funds in the revisedPlan array.
3. If stopping a fund, reallocate that amount elsewhere.

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
}`;

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

        ok(res, {
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
        });
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
            if (fund.sipStartDate) {
                const d = new Date(fund.sipStartDate);
                if (!earliestDate || d < earliestDate) earliestDate = d;
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
                // SIP: active this month if start <= cursor, stop >= cursor, and payment date (5th) <= today
                if (fund.sipAmount > 0 && fund.sipStartDate) {
                    const sipStart = new Date(fund.sipStartDate);
                    const sipStartYear = sipStart.getFullYear();
                    const sipStartMonth = sipStart.getMonth();
                    const isAfterOrEqualStart =
                        year > sipStartYear || (year === sipStartYear && monthIdx >= sipStartMonth);
                    
                    // Check if SIP is still active (not stopped)
                    let isBeforeOrEqualStop = true;
                    if (fund.sipStopDate) {
                        const sipStop = new Date(fund.sipStopDate);
                        const sipStopYear = sipStop.getFullYear();
                        const sipStopMonth = sipStop.getMonth();
                        isBeforeOrEqualStop =
                            year < sipStopYear || (year === sipStopYear && monthIdx <= sipStopMonth);
                    }
                    
                    if (isAfterOrEqualStart && isBeforeOrEqualStop) {
                        const sipPaymentDate = new Date(year, monthIdx, 5);
                        if (sipPaymentDate <= now) {
                            sipAmount += fund.sipAmount;
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
                if (fund.sipAmount > 0 && fund.sipStartDate) {
                    const sipStart = new Date(fund.sipStartDate);
                    const startY = sipStart.getFullYear();
                    const startM = sipStart.getMonth() + 1; // 1-based
                    
                    // Check if SIP is active for this month (within start and stop dates)
                    const isAfterOrEqualStart = y > startY || (y === startY && mo >= startM);
                    
                    let isBeforeOrEqualStop = true;
                    if (fund.sipStopDate) {
                        const sipStop = new Date(fund.sipStopDate);
                        const stopY = sipStop.getFullYear();
                        const stopM = sipStop.getMonth() + 1; // 1-based
                        isBeforeOrEqualStop = y < stopY || (y === stopY && mo <= stopM);
                    }
                    
                    if (isAfterOrEqualStart && isBeforeOrEqualStop) {
                        totalCommitment += fund.sipAmount;
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

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
    console.log(`🚀 MF Portfolio API running on port ${PORT}`);
    console.log(`   Endpoints: /health  /api/portfolio/complete  /api/recommendations`);
});

module.exports = app;
