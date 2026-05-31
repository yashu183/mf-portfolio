import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getMutualFunds,
    clearMFCache,
    getFixedDeposits,
    clearFDCache,
    getGoldPortfolio,
    clearGoldCache,
    getSilverPortfolio,
    clearSilverCache,
    getEPFPortfolio,
    clearEPFCache,
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
 * Fetches MF data on mount; FD data is fetched lazily the first time
 * activeAsset === 'fds'.
 */
export function usePortfolioData(activeAsset = 'mutualFunds') {
    // ── Portfolio (MF) state ─────────────────────────────────────────────────────
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

    // ── Fixed Deposit state ───────────────────────────────────────────────────────
    const [fixedDeposits, setFixedDeposits] = useState([]);
    const [isLoadingFDs, setIsLoadingFDs] = useState(false);
    const [fdError, setFdError] = useState(null);
    const [lastFdUpdate, setLastFdUpdate] = useState(null);
    const fdFetchedRef = useRef(false);

    // ── Gold state ────────────────────────────────────────────────────────────────
    const [goldData, setGoldData] = useState(null);
    const [isLoadingGold, setIsLoadingGold] = useState(false);
    const [goldError, setGoldError] = useState(null);
    const [lastGoldUpdate, setLastGoldUpdate] = useState(null);
    const goldFetchedRef = useRef(false);

    // ── Silver state ──────────────────────────────────────────────────────────────
    const [silverData, setSilverData] = useState(null);
    const [isLoadingSilver, setIsLoadingSilver] = useState(false);
    const [silverError, setSilverError] = useState(null);
    const [lastSilverUpdate, setLastSilverUpdate] = useState(null);
    const silverFetchedRef = useRef(false);

    // ── EPF state ─────────────────────────────────────────────────────────────────
    const [epfData, setEPFData] = useState(null);
    const [isLoadingEPF, setIsLoadingEPF] = useState(false);
    const [epfError, setEPFError] = useState(null);
    const [lastEPFUpdate, setLastEPFUpdate] = useState(null);
    const epfFetchedRef = useRef(false);

    // ── Fetch MF portfolio ────────────────────────────────────────────────────────
    const fetchPortfolio = useCallback(async () => {
        setIsLoadingPortfolio(true);
        setPortfolioError(null);
        try {
            const data = await getMutualFunds();
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

    // ── Fetch FDs (on-demand) ─────────────────────────────────────────────────────
    const fetchFDs = useCallback(async () => {
        setIsLoadingFDs(true);
        setFdError(null);
        try {
            const data = await getFixedDeposits();
            setFixedDeposits(data.fixedDeposits ?? []);
            fdFetchedRef.current = true;
            setLastFdUpdate(new Date());
        } catch (err) {
            setFdError('Failed to load fixed deposits. Please check if the backend service is running.');
            console.error('FD fetch error:', err);
        } finally {
            setIsLoadingFDs(false);
        }
    }, []);

    // ── Fetch Gold (on-demand) ─────────────────────────────────────────────────────
    const fetchGold = useCallback(async () => {
        setIsLoadingGold(true);
        setGoldError(null);
        try {
            const data = await getGoldPortfolio();
            setGoldData(data);
            goldFetchedRef.current = true;
            setLastGoldUpdate(new Date());
        } catch (err) {
            setGoldError('Failed to load gold portfolio. Please check if the backend service is running.');
            console.error('Gold fetch error:', err);
        } finally {
            setIsLoadingGold(false);
        }
    }, []);

    // ── Fetch Silver (on-demand) ──────────────────────────────────────────────────
    const fetchSilver = useCallback(async () => {
        setIsLoadingSilver(true);
        setSilverError(null);
        try {
            const data = await getSilverPortfolio();
            setSilverData(data);
            silverFetchedRef.current = true;
            setLastSilverUpdate(new Date());
        } catch (err) {
            setSilverError('Failed to load silver portfolio. Please check if the backend service is running.');
            console.error('Silver fetch error:', err);
        } finally {
            setIsLoadingSilver(false);
        }
    }, []);

    // ── Fetch EPF ─────────────────────────────────────────────────────────────────
    const fetchEPF = useCallback(async () => {
        setIsLoadingEPF(true);
        setEPFError(null);
        try {
            const data = await getEPFPortfolio();
            setEPFData(data);
            epfFetchedRef.current = true;
            setLastEPFUpdate(new Date());
        } catch (err) {
            setEPFError('Failed to load EPF data. Please check if the backend service is running.');
            console.error('EPF fetch error:', err);
        } finally {
            setIsLoadingEPF(false);
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

    // ── Hard refresh – only fetches the API relevant to the current asset ─────────
    const handleManualRefresh = useCallback(async () => {
        if (activeAsset === 'fds') {
            clearFDCache();
            fdFetchedRef.current = false;
            await fetchFDs();
        } else if (activeAsset === 'gold') {
            clearGoldCache();
            goldFetchedRef.current = false;
            await fetchGold();
        } else if (activeAsset === 'silver') {
            clearSilverCache();
            silverFetchedRef.current = false;
            await fetchSilver();
        } else if (activeAsset === 'epf') {
            clearEPFCache();
            epfFetchedRef.current = false;
            await fetchEPF();
        } else if (activeAsset === 'overview') {
            clearMFCache(); clearFDCache(); clearGoldCache(); clearSilverCache(); clearEPFCache();
            fdFetchedRef.current = false;
            goldFetchedRef.current = false;
            silverFetchedRef.current = false;
            epfFetchedRef.current = false;
            await Promise.all([fetchPortfolio(), fetchFDs(), fetchGold(), fetchSilver(), fetchEPF()]);
        } else if (activeAsset === 'mutualFunds') {
            clearMFCache();
            clearRecommendationsCache();
            clearTimelineCache();
            await fetchPortfolio();
            await fetchTimeline();
        }
    }, [fetchPortfolio, fetchTimeline, fetchFDs, fetchGold, fetchSilver, fetchEPF, activeAsset]);

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

    // ── Mount: fetch MF data + timeline ──────────────────────────────────────────
    useEffect(() => {
        fetchPortfolio();
        fetchTimeline();
        checkHealth();
        const interval = setInterval(fetchPortfolio, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchPortfolio, fetchTimeline, checkHealth]);

    // ── Lazy FD fetch: trigger once when user first switches to FDs ───────────────
    useEffect(() => {
        if (activeAsset === 'fds' && !fdFetchedRef.current) fetchFDs();
    }, [activeAsset, fetchFDs]);

    // ── Lazy Gold fetch ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeAsset === 'gold' && !goldFetchedRef.current) fetchGold();
    }, [activeAsset, fetchGold]);

    // ── Lazy Silver fetch ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeAsset === 'silver' && !silverFetchedRef.current) fetchSilver();
    }, [activeAsset, fetchSilver]);
    // ── Lazy EPF fetch ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeAsset === 'epf' && !epfFetchedRef.current) fetchEPF();
    }, [activeAsset, fetchEPF]);    // ── Overview: fetch all assets at once ────────────────────────────────────
    useEffect(() => {
        if (activeAsset === 'overview') {
            if (!fdFetchedRef.current) fetchFDs();
            if (!goldFetchedRef.current) fetchGold();
            if (!silverFetchedRef.current) fetchSilver();
            if (!epfFetchedRef.current) fetchEPF();
        }
    }, [activeAsset, fetchFDs, fetchGold, fetchSilver, fetchEPF]);    // Auto-fetch recommendations once portfolio is loaded
    useEffect(() => {
        if (portfolioData.length > 0 && !recommendations) {
            fetchRecommendations();
        }
    }, [portfolioData, recommendations, fetchRecommendations]);

    return {
        // Portfolio (MF)
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

        // Fixed deposits
        fixedDeposits,
        isLoadingFDs,
        fdError,
        lastFdUpdate,
        fetchFDs,

        // Gold
        goldData,
        isLoadingGold,
        goldError,
        lastGoldUpdate,
        fetchGold,

        // Silver
        silverData,
        isLoadingSilver,
        silverError,
        lastSilverUpdate,
        fetchSilver,

        // EPF
        epfData,
        isLoadingEPF,
        epfError,
        lastEPFUpdate,
        fetchEPF,
    };
}

