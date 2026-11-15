// AI recommendations: a rebalanced monthly SIP plan from Claude on AWS Bedrock, with the same total SIP
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Whether a SIP is running today
const sipActive = (sip, now) =>
    new Date(sip.startDate) <= now && (!sip.stopDate || new Date(sip.stopDate) >= now);

// After the model answers, make the plan add up: put any rounding gap on the biggest running SIP and rebuild
// the category allocation from the plan itself
function fixAllocationTotal(response, targetTotal, categoryLookup = {}) {
    const revisedPlan = response.recommendations.revisedPlan;

    // 1. Build category totals using lookup since revisedPlan has no category field
    const categoryMap = {};
    for (const fund of revisedPlan) {
        if (fund.revised > 0) {
            const category = categoryLookup[fund.name] ?? 'Other';
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
            topFund.change = (topFund.revised - topFund.current >= 0 ? '+' : '')
                + (topFund.revised - topFund.current);

            // Also fix categoryMap for this fund
            const topCategory = categoryLookup[topFund.name] ?? 'Other';
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
                color: orig?.color ?? 'emerald',
                advice: orig?.advice ?? '',
            };
        }),
        summary: response.recommendedAllocation?.summary ?? '',
    };

    return response;
}

async function generateRecommendations(config, { portfolioData, currentValues }) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)
        throw new Error('AWS credentials not configured on server');

    const { llmConfig } = config;
    const currentDate = new Date();

    // Total of the SIPs running today
    const totalCurrentSIP = portfolioData.funds.reduce((sum, f) => sum + (f.sips ?? [])
        .filter((sip) => sip.amount > 0 && sip.startDate && sipActive(sip, currentDate))
        .reduce((s, sip) => s + sip.amount, 0), 0);

    const portfolioAnalysis = {
        funds: portfolioData.funds
            .map((fund) => {
                const m = currentValues[fund.id] ?? {};

                // The SIP running today for this fund, and when its first SIP started
                let currentSipAmount = 0;
                let sipStartDate = null;
                for (const sip of fund.sips ?? []) {
                    if (sip.amount > 0 && sip.startDate) {
                        if (!sipStartDate || new Date(sip.startDate) < sipStartDate) sipStartDate = sip.startDate;
                        if (sipActive(sip, currentDate)) currentSipAmount += sip.amount;
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
        3. newInvestments is purely a suggestion list - these funds do NOT appear in revisedPlan and are NOT counted in any totals.
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

    const response = {
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

    // name → category, since the plan the model returns has no categories
    const categoryLookup = Object.fromEntries(portfolioAnalysis.funds.map(f => [f.name, f.category]));
    return fixAllocationTotal(response, totalCurrentSIP, categoryLookup);
}

module.exports = { generateRecommendations };
