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

// ─── API Endpoints ─────────────────────────────────────────────────────────────

/** GET /health */
app.get('/health', (_req, res) =>
    ok(res, { service: 'mf-portfolio-api', timestamp: new Date().toISOString() }),
);

/** GET /api/health */
app.get('/api/health', (_req, res) =>
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

                // Calculate SIP months and total invested from sips array
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

                        // If this SIP is currently active (started and not stopped), add to current monthly SIP
                        if (sipStart <= currentDate && (!sip.stopDate || new Date(sip.stopDate) >= currentDate)) {
                            currentMonthlySIP += sip.amount;
                        }
                    }
                }
                const totalLumpsum = (fund.lumpsums ?? []).reduce((s, l) => s + l.amount, 0);

                // Find the earliest investment date
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
                    currentMonthlySIP, // Add the current monthly SIP amount for this fund
                };
            }),
        );

        const totals = calculatedFunds.reduce(
            (acc, f) => {
                acc.totalInvested += f.totalInvested;
                acc.totalCurrentValue += f.currentValue;
                acc.monthlySIP += f.currentMonthlySIP ?? 0; // Sum up current active SIPs
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

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
    console.log(`🚀 MF Portfolio API running on port ${PORT}`);
    console.log(`   Endpoints: /health  /api/portfolio/complete  /api/recommendations`);
});

module.exports = app;
