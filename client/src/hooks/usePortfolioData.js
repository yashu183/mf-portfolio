import { useState, useEffect, useCallback } from 'react';
import {
    getCompletePortfolio,
    clearPortfolioCache,
    getInvestmentTimeline,
    clearTimelineCache,
} from '../services/portfolioService';
import {
    getCachedRecommendations,
    clearRecommendationsCache,
    checkServiceHealth,
} from '../services/recommendationService';

const AUTO_REFRESH_MS = 30 * 60 * 1000; // 30 minutes

/**
 * usePortfolioData
 * Encapsulates all data-fetching, caching and refresh logic for the portfolio.
 */
export function usePortfolioData() {
    // ── Portfolio state ──────────────────────────────────────────────────────────
    const [portfolioData, setPortfolioData] = useState([]);
    const [totals, setTotals] = useState({
        totalInvested: 0,
        totalCurrentValue: 0,
        totalReturns: 0,
        monthlySIP: 0,
    });
    const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);
    const [portfolioError, setPortfolioError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    // ── Recommendation state ─────────────────────────────────────────────────────
    const [recommendations, setRecommendations] = useState(null);
    const [recommendedAllocation, setRecommendedAllocation] = useState(null);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    const [recommendationError, setRecommendationError] = useState(null);

    // ── Service availability ─────────────────────────────────────────────────────
    const [serviceAvailable, setServiceAvailable] = useState(true);

    // ── Timeline state ────────────────────────────────────────────────────────────
    const [timelineData, setTimelineData] = useState(null);
    const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
    const [timelineError, setTimelineError] = useState(null);

    // ── Fetch portfolio ───────────────────────────────────────────────────────────
    const fetchPortfolio = useCallback(async () => {
        setIsLoadingPortfolio(true);
        setPortfolioError(null);
        try {
            const data = await getCompletePortfolio();
            setPortfolioData(data.funds);
            setTotals(data.totals);
            setLastUpdate(new Date());
        } catch (err) {
            setPortfolioError('Failed to load portfolio. Please check if the backend service is running.');
            console.error('Portfolio fetch error:', err);
        } finally {
            setIsLoadingPortfolio(false);
        }
    }, []);

    // ── Fetch recommendations ─────────────────────────────────────────────────────
    const fetchRecommendations = useCallback(
        async (forceRefresh = false) => {
            if (!serviceAvailable) {
                setRecommendationError('Recommendation service is currently unavailable');
                return;
            }
            if (!portfolioData.length) return;

            setIsLoadingRecommendations(true);
            setRecommendationError(null);
            try {
                const enrichedCurrentValues = Object.fromEntries(
                    portfolioData.map((fund) => [
                        fund.id,
                        {
                            currentValue: fund.currentValue,
                            totalInvested: fund.totalInvested,
                            absoluteReturns: fund.currentValue - fund.totalInvested,
                            returnsPercentage: fund.returns,
                            xirr: fund.xirr,
                        },
                    ]),
                );

                const data = await getCachedRecommendations(
                    { funds: portfolioData },
                    enrichedCurrentValues,
                    forceRefresh,
                );
                setRecommendations(data.recommendations);
                setRecommendedAllocation(data.recommendedAllocation);
            } catch (err) {
                setRecommendationError(err.message);
                console.error('Recommendation error:', err);
            } finally {
                setIsLoadingRecommendations(false);
            }
        },
        [portfolioData, serviceAvailable],
    );

    // ── Fetch timeline ─────────────────────────────────────────────────────────────
    const fetchTimeline = useCallback(async () => {
        setIsLoadingTimeline(true);
        setTimelineError(null);
        try {
            const data = await getInvestmentTimeline();
            setTimelineData(data);
        } catch (err) {
            setTimelineError('Failed to load investment timeline.');
            console.error('Timeline fetch error:', err);
        } finally {
            setIsLoadingTimeline(false);
        }
    }, []);

    // ── Hard refresh (clears frontend caches, then re-fetches fresh data) ─────────
    const handleManualRefresh = useCallback(async () => {
        clearPortfolioCache();
        clearRecommendationsCache();
        clearTimelineCache();
        await fetchPortfolio();
        await fetchTimeline();
    }, [fetchPortfolio, fetchTimeline]);

    // ── Refresh recommendations only ──────────────────────────────────────────────
    const handleRecommendationRefresh = useCallback(() => {
        clearRecommendationsCache();
        fetchRecommendations(true);
    }, [fetchRecommendations]);

    // ── Check health ──────────────────────────────────────────────────────────────
    const checkHealth = useCallback(async () => {
        const healthy = await checkServiceHealth();
        setServiceAvailable(healthy);
        return healthy;
    }, []);

    // ── Mount effects ─────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchPortfolio();
        fetchTimeline();
        checkHealth();
        const interval = setInterval(fetchPortfolio, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchPortfolio, fetchTimeline, checkHealth]);

    // Auto-fetch recommendations once portfolio is loaded
    useEffect(() => {
        if (portfolioData.length > 0 && !recommendations) {
            fetchRecommendations();
        }
    }, [portfolioData, recommendations, fetchRecommendations]);

    return {
        // Portfolio
        portfolioData,
        totals,
        isLoadingPortfolio,
        portfolioError,
        lastUpdate,
        fetchPortfolio,
        handleManualRefresh,

        // Recommendations
        recommendations,
        recommendedAllocation,
        isLoadingRecommendations,
        recommendationError,
        serviceAvailable,
        fetchRecommendations,
        handleRecommendationRefresh,
        checkHealth,

        // Timeline
        timelineData,
        isLoadingTimeline,
        timelineError,
        fetchTimeline,
    };
}
