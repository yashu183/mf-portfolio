import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import PdfMenu from './portfolio/PdfMenu';
import { WRAP } from './Navbar';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { ASSET_PATHS, MUTUAL_FUND_VIEWS, mutualFundViewPath } from '../utils/assetRoutes';
import FundsTable, { ViewToggle } from './portfolio/FundsTable';
import SummaryPanel from './portfolio/SummaryPanel';
import { formatCurrentValue } from '../utils/formatters';
import CategoryBreakdown from './portfolio/CategoryBreakdown';
import AllocationView from './portfolio/AllocationView';
import PerformanceView from './portfolio/PerformanceView';
import RecommendationsView from './portfolio/RecommendationsView';
import InvestmentTimelineView from './portfolio/InvestmentTimelineView';
import FilterBar from './portfolio/FilterBar';
import FixedDepositsView from './portfolio/FixedDepositsView';
import GoldSilverView from './portfolio/GoldSilverView';
import EPFView from './portfolio/EPFView';
import OverviewView from './portfolio/OverviewView';
import ScrollPane from './portfolio/ScrollPane';
import { PageGhost, SummaryGhost, NoteGhost, HeadingGhost, ListGhost, ChartGhost } from './portfolio/Ghost';

const ASSET_HEADER_CONTENT = {
  overview: {
    title: 'Welcome, Yashwanth',
    subtitle: 'Your complete portfolio at a glance - all assets, one view',
  },
  mutualFunds: {
    title: 'Mutual Funds',
    subtitle: 'Track fund performance, allocations, and SIP planning in one place',
  },
  fds: {
    title: 'Fixed Deposits',
    subtitle: 'Track principal, maturity timelines, and accrued returns for every FD cycle',
  },
  gold: {
    title: 'Gold',
    subtitle: 'Monitor your gold investments and long-term value trends',
  },
  silver: {
    title: 'Silver',
    subtitle: 'Monitor your silver investments and long-term value trends',
  },
  epf: {
    title: 'EPF',
    subtitle: 'Track provident fund growth and retirement corpus progress',
  },
};


// Printed at the top of every PDF report
const OWNER_NAME = 'Yashwanth C';

const PortfolioTracker = ({ activeAsset }) => {
  const navigate = useNavigate();
  const { view: viewParam } = useParams();
  const activeView = MUTUAL_FUND_VIEWS.some(v => v.id === viewParam) ? viewParam : 'dashboard';
  const goToView = (viewId) => navigate(mutualFundViewPath(viewId));
  const goToAsset = (assetId) => navigate(ASSET_PATHS[assetId] ?? '/');
  const [fundView, setFundViewState] = useState(() => { try { return localStorage.getItem('vesta-fund-view') || 'list'; } catch { return 'list'; } });
  const setFundView = (v) => { setFundViewState(v); try { localStorage.setItem('vesta-fund-view', v); } catch {} };
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    investmentType: '',
  });
  const [recommendationFilters, setRecommendationFilters] = useState({
    search: '',
    category: '',
  });

  const {
    portfolioData,
    totals,
    isLoadingPortfolio,
    portfolioError,
    lastUpdate,
    fetchPortfolio,
    handleManualRefresh,
    recommendations,
    recommendedAllocation,
    isLoadingRecommendations,
    recommendationError,
    serviceAvailable,
    handleRecommendationRefresh,
    checkHealth,
    timelineData,
    isLoadingTimeline,
    timelineError,
    fetchTimeline,
    fixedDeposits,
    isLoadingFDs,
    fdError,
    lastFdUpdate,
    goldData,
    isLoadingGold,
    goldError,
    lastGoldUpdate,
    silverData,
    isLoadingSilver,
    silverError,
    lastSilverUpdate,
    epfData,
    isLoadingEPF,
    epfError,
    lastEPFUpdate,
    overviewData,
    isLoadingOverview,
    overviewError,
    lastOverviewUpdate,
  } = usePortfolioData(activeAsset);

  // ── Filter functions ───────────────────────────────────────────────────────
  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ search: '', category: '', status: '', investmentType: '' });
  };

  const handleRecommendationFilterChange = (filterKey, value) => {
    setRecommendationFilters(prev => ({ ...prev, [filterKey]: value }));
  };

  const handleClearRecommendationFilters = () => {
    setRecommendationFilters({ search: '', category: '' });
  };

  const fundCategories = useMemo(() => {
    return [...new Set(portfolioData.map(f => f.category))].sort();
  }, [portfolioData]);

  // Apply filters to portfolio data
  const filteredPortfolioData = useMemo(() => {
    return portfolioData.filter(fund => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          fund.name.toLowerCase().includes(searchLower) ||
          fund.shortName.toLowerCase().includes(searchLower) ||
          fund.category.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category && fund.category !== filters.category) {
        return false;
      }

      // Status filter
      if (filters.status && fund.status !== filters.status) {
        return false;
      }

      // Investment type filter
      if (filters.investmentType) {
        const hasSIP = fund.currentMonthlySIP > 0;
        const hasLumpsum = fund.totalLumpsum > 0;

        if (filters.investmentType === 'sip' && !hasSIP) return false;
        if (filters.investmentType === 'lumpsum' && !hasLumpsum) return false;
        if (filters.investmentType === 'both' && (!hasSIP || !hasLumpsum)) return false;
      }

      return true;
    });
  }, [portfolioData, filters]);

  // Apply filters for recommendations (always SIP only + search + category)
  const filteredRecommendationData = useMemo(() => {
    return portfolioData.filter(fund => {
      // Always filter to SIP only
      const hasSIP = fund.currentMonthlySIP > 0;
      if (!hasSIP) return false;

      // Search filter
      if (recommendationFilters.search) {
        const searchLower = recommendationFilters.search.toLowerCase();
        const matchesSearch =
          fund.name.toLowerCase().includes(searchLower) ||
          fund.shortName.toLowerCase().includes(searchLower) ||
          fund.category.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (recommendationFilters.category && fund.category !== recommendationFilters.category) {
        return false;
      }

      return true;
    });
  }, [portfolioData, recommendationFilters]);

  // ── Derived data (memoised) ────────────────────────────────────────────────
  // Unfiltered data for Quick Insights (always shows all funds)
  const unfilteredCategoryBreakdown = useMemo(() => {
    return portfolioData.reduce((acc, fund) => {
      if (!acc[fund.category]) acc[fund.category] = { invested: 0, current: 0, count: 0 };
      acc[fund.category].invested += fund.totalInvested;
      acc[fund.category].current += fund.currentValue;
      acc[fund.category].count += 1;
      return acc;
    }, {});
  }, [portfolioData]);

  const unfilteredPerformanceGroups = useMemo(() => ({
    excellent: portfolioData.filter(f => f.status === 'excellent'),
    good: portfolioData.filter(f => f.status === 'good'),
    monitor: portfolioData.filter(f => f.status === 'monitor'),
    poor: portfolioData.filter(f => f.status === 'poor'),
  }), [portfolioData]);

  // Filtered performance groups for Performance view
  const filteredPerformanceGroups = useMemo(() => ({
    excellent: filteredPortfolioData.filter(f => f.status === 'excellent'),
    good: filteredPortfolioData.filter(f => f.status === 'good'),
    monitor: filteredPortfolioData.filter(f => f.status === 'monitor'),
    poor: filteredPortfolioData.filter(f => f.status === 'poor'),
  }), [filteredPortfolioData]);

  const activeAssetHeader = ASSET_HEADER_CONTENT[activeAsset] ?? {
    title: 'Assets',
    subtitle: 'Track your portfolio performance and investment progress',
  };

  // ── Main render ────────────────────────────────────────────────────────────
  // What stays pinned at the top while the page scrolls (the page head on desktop, the menu bar below
  // 1024px), published as --head-h so the filter bar and the left column can sit just under it.
  const headRef = useRef(null);
  useEffect(() => {
    const el = headRef.current;
    if (!el) return undefined;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const tablet = window.matchMedia('(min-width: 768px)');
    // tablets pin the page head under the 56px menu bar, so both count, plus the 31px solid band under
    // it: toolbars and section headings pin right where the band ends, leaving no strip for rows to show
    // through. Phones pin only the menu bar.
    const height = () => (desktop.matches ? el.offsetHeight : tablet.matches ? 56 + el.offsetHeight + 31 : 56);
    const publish = () => document.documentElement.style.setProperty('--head-h', `${height()}px`);
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    desktop.addEventListener('change', publish);
    tablet.addEventListener('change', publish);
    publish();
    return () => { ro.disconnect(); desktop.removeEventListener('change', publish); tablet.removeEventListener('change', publish); };
  }, []);

  const isFdView = activeAsset === 'fds';
  const isGoldView = activeAsset === 'gold';
  const isSilverView = activeAsset === 'silver';
  const isEpfView = activeAsset === 'epf';
  const statusLoading =
    activeAsset === 'overview' ? (isLoadingPortfolio || isLoadingFDs || isLoadingGold || isLoadingSilver || isLoadingEPF) :
    isGoldView ? isLoadingGold :
    isSilverView ? isLoadingSilver :
    isFdView ? isLoadingFDs :
    isEpfView ? isLoadingEPF :
    isLoadingPortfolio;
  const statusError =
    isGoldView ? !!goldError :
    isSilverView ? !!silverError :
    isFdView ? !!fdError :
    isEpfView ? !!epfError :
    !!portfolioError;
  const statusUpdated =
    isGoldView ? lastGoldUpdate :
    isSilverView ? lastSilverUpdate :
    isFdView ? lastFdUpdate :
    isEpfView ? lastEPFUpdate :
    activeAsset === 'overview' ? lastOverviewUpdate :
    lastUpdate;
  const canRefresh = activeAsset !== 'overview';

  const refreshLabel =
    isGoldView ? 'gold' : isSilverView ? 'silver' : isFdView ? 'fixed deposits' : isEpfView ? 'EPF' : 'mutual funds';

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Page head: Vercel's project header band, title left, actions right, Mutual Funds' sections as tabs */}
      {/* Below it on tablets, a solid band over the 32px gap above the content that the page scrolls under,
          so content stops short of the head as a laptop's scrolling columns do. It is 31px, not 32, so the
          1px ring of a card resting at the top of the gap stays visible */}
      <div ref={headRef} className="bg-surface border-b border-line md:sticky md:top-14 lg:top-0 md:z-30 md:max-lg:after:absolute md:max-lg:after:inset-x-0 md:max-lg:after:top-[calc(100%+1px)] md:max-lg:after:h-[31px] md:max-lg:after:bg-canvas">
        <div className={`${WRAP} pt-8 md:pt-6 ${activeAsset === 'mutualFunds' ? 'pb-0' : 'pb-8 md:pb-6'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-[28px] md:text-[32px] leading-[1.25] text-ink">{activeAssetHeader.title}</h1>
              <p className="mt-1 text-[14px] leading-[20px] text-body">{activeAssetHeader.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-surface shadow-[0_0_0_1px_var(--c-line-strong)] text-[13px] font-medium text-ink" role="status">
                {statusLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" aria-hidden="true" />
                ) : statusError ? (
                  <WifiOff className="w-3.5 h-3.5 text-loss" aria-hidden="true" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gain" aria-hidden="true" />
                )}
                {statusLoading ? 'Updating' : statusError ? 'Offline' : 'Live'}
                {statusUpdated && !statusLoading && (
                  <span className="font-mono text-[12px] text-muted font-normal">{statusUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </span>
              {canRefresh && (
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={statusLoading}
                  className="pill pill-sm pill-secondary"
                  aria-label={`Refresh ${refreshLabel}`}
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh
                </button>
              )}
              <PdfMenu
                scope={activeAsset}
                owner={OWNER_NAME}
                label={activeAsset === 'overview' ? 'the full portfolio' : refreshLabel}
                disabled={statusLoading}
              />
            </div>
          </div>
          {/* Mutual Funds' sections, as Vercel's project tabs; they sit in the pinned head, so they stay in view */}
          {activeAsset === 'mutualFunds' && (
            <nav aria-label="Mutual fund sections" className="mt-5 -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {MUTUAL_FUND_VIEWS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => goToView(tab.id)}
                  aria-current={activeView === tab.id ? 'page' : undefined}
                  className={`relative shrink-0 inline-flex items-center gap-2 h-11 px-3 text-[14px] transition-colors cursor-pointer border-b-2 ${activeView === tab.id ? 'text-ink border-ink' : 'text-body hover:text-ink border-transparent'}`}
                >
                  <tab.icon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`${WRAP} pt-8`}>
        {activeAsset === 'mutualFunds' && (
          <>
            {isLoadingPortfolio ? (
              <PageGhost label="Loading mutual funds" aside={<><SummaryGhost /><NoteGhost /><NoteGhost lines={3} /></>}>
                {activeView === 'timeline' ? (
                  <><section><HeadingGhost /><ChartGhost height={300} /></section><section><HeadingGhost /><ChartGhost height={280} /></section></>
                ) : (
                  <section><HeadingGhost /><ListGhost rows={8} figures={3} /></section>
                )}
              </PageGhost>
            ) : portfolioError ? (
              <div className="min-h-[320px] card flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                  <div className="text-loss mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-medium mb-2">The portfolio did not load</h2>
                  <p className="text-ink-2 mb-6">{portfolioError}</p>
                  <button
                    onClick={fetchPortfolio}
                    className="pill pill-primary"
                  >Try again</button>
                </div>
              </div>
            ) : (
              <>
                {activeView === 'dashboard' && (
                  <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
                    {/* Left column: the summary and insights, as Vercel's overview keeps usage beside the list */}
                    <aside className="space-y-4 lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
                      <SummaryPanel
                        label="Mutual funds balance"
                        value={formatCurrentValue(totals.totalCurrentValue)}
                        change={`₹${Math.round(Math.abs(totals.totalCurrentValue - totals.totalInvested)).toLocaleString('en-IN')} (${totals.totalReturns.toFixed(2)}%)`}
                        changeTone={totals.totalCurrentValue >= totals.totalInvested ? 'gain' : 'loss'}
                        rows={[
                          { label: 'Invested', value: `₹${(totals.totalInvested / 100000).toFixed(2)}L` },
                          { label: 'Gain', value: `₹${(Math.abs(totals.totalCurrentValue - totals.totalInvested) / 100000).toFixed(2)}L`, tone: totals.totalCurrentValue >= totals.totalInvested ? 'gain' : 'loss' },
                          { label: 'Monthly SIP', value: `₹${totals.monthlySIP.toLocaleString('en-IN')}` },
                          { label: 'Active SIPs', value: `${portfolioData.filter(f => f.currentMonthlySIP > 0).length} funds` },
                        ]}
                      />
                      <div className="hidden lg:block space-y-4">
                        <CategoryBreakdown
                          categoryBreakdown={unfilteredCategoryBreakdown}
                          funds={portfolioData}
                          totals={totals}
                          performanceGroups={unfilteredPerformanceGroups}
                        />
                      </div>
                    </aside>

                    <section aria-labelledby="funds-h" className="min-w-0">
                      <h2 id="funds-h" className="sr-only">Your funds</h2>
                      <ScrollPane
                        toolbar={
                          <>
                            <FilterBar
                              filters={filters}
                              onFilterChange={handleFilterChange}
                              onClearFilters={handleClearFilters}
                              fundCategories={fundCategories}
                              right={<ViewToggle view={fundView} onChange={setFundView} />}
                            />
                            <p className="-mt-3 mb-3 font-mono text-[12px] text-muted">
                              {filteredPortfolioData.length}{filteredPortfolioData.length !== portfolioData.length && ` of ${portfolioData.length}`} funds
                            </p>
                          </>
                        }
                      >
                      {filteredPortfolioData.length > 0 ? (
                        <FundsTable funds={filteredPortfolioData} view={fundView} />
                      ) : (
                        <div className="rounded-xl border border-dashed border-line-strong p-12 text-center">
                          <p className="text-[14px] text-body mb-4">No funds match these filters.</p>
                          <button type="button" onClick={handleClearFilters} className="pill pill-primary">Clear filters</button>
                        </div>
                      )}
                      </ScrollPane>
                    </section>

                    {/* Phone and tablet: the insights follow the list instead of pushing it down */}
                    <div className="lg:hidden space-y-4">
                      <CategoryBreakdown
                        categoryBreakdown={unfilteredCategoryBreakdown}
                          funds={portfolioData}
                        totals={totals}
                        performanceGroups={unfilteredPerformanceGroups}
                      />
                    </div>
                  </div>
                )}

                {activeView === 'performance' && (
                  <ScrollPane
                    toolbar={
                      <FilterBar
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                        fundCategories={fundCategories}
                      />
                    }
                  >
                    <PerformanceView performanceGroups={filteredPerformanceGroups} />
                  </ScrollPane>
                )}

                {activeView === 'allocation' && (
                  <AllocationView
                    portfolioData={portfolioData}
                    recommendations={recommendations}
                    recommendedAllocation={recommendedAllocation}
                    isLoadingRecommendations={isLoadingRecommendations}
                    recommendationError={recommendationError}
                    serviceAvailable={serviceAvailable}
                    onRefreshRecommendations={handleRecommendationRefresh}
                  />
                )}

                {activeView === 'recommendations' && (
                  <>
                    <RecommendationsView
                      toolbar={
                        <FilterBar
                          filters={recommendationFilters}
                          onFilterChange={handleRecommendationFilterChange}
                          onClearFilters={handleClearRecommendationFilters}
                          fundCategories={fundCategories}
                          hiddenFilters={['status', 'investmentType']}
                          staticFilters={[{ label: 'Type: SIP Only' }]}
                        />
                      }
                      recommendations={recommendations}
                      filteredFunds={filteredRecommendationData}
                      allFunds={portfolioData}
                      isLoadingRecommendations={isLoadingRecommendations}
                      recommendationError={recommendationError}
                      serviceAvailable={serviceAvailable}
                      onRefreshRecommendations={handleRecommendationRefresh}
                      onCheckHealth={checkHealth}
                    />
                  </>
                )}

                {activeView === 'timeline' && (
                  <InvestmentTimelineView
                    timelineData={timelineData}
                    isLoading={isLoadingTimeline}
                    error={timelineError}
                    onRefresh={fetchTimeline}
                  />
                )}
              </>
            )}
          </>
        )}

        {activeAsset === 'overview' && (
          <OverviewView
            overviewData={overviewData}
            isLoading={isLoadingOverview}
            error={overviewError}
            onNavigate={goToAsset}
          />
        )}
        {activeAsset === 'fds' && (
          <FixedDepositsView deposits={fixedDeposits} isLoading={isLoadingFDs} error={fdError} />
        )}
        {activeAsset === 'gold' && (
          <GoldSilverView metal="gold" data={goldData} isLoading={isLoadingGold} error={goldError} />
        )}
        {activeAsset === 'silver' && (
          <GoldSilverView metal="silver" data={silverData} isLoading={isLoadingSilver} error={silverError} />
        )}
        {activeAsset === 'epf' && (
          <EPFView data={epfData} isLoading={isLoadingEPF} error={epfError} />
        )}
      </div>

      {/* Footer */}
      {/* From 1024px every view fills the window exactly and scrolls inside its own column, so the
          footer steps aside there; otherwise scrolling the page would slide the content under the head */}
      <footer className={`${WRAP} mt-20 lg:hidden`}>
        <div className="py-8 border-t border-line flex flex-col items-center text-center gap-2 text-[12px] leading-[1.4] tracking-[0.02em] text-slate">
        <span>
          {activeAsset === 'mutualFunds'
            ? `₹${(totals.totalCurrentValue / 100000).toFixed(2)}L at ${totals.totalReturns.toFixed(2)}% returns · XIRR and SIP months worked out from each start date`
            : activeAsset === 'fds'
              ? 'Projections roll each deposit over for both 444-day cycles'
              : activeAsset === 'gold' || activeAsset === 'silver'
                ? `${activeAsset === 'gold' ? 'Gold (24K)' : 'Silver (999)'} prices from bullions.co.in, per gram in INR`
                : activeAsset === 'epf'
                  ? 'Interest compounded monthly at EPFO declared rates'
                  : 'Each asset fills in as you add holdings'}
        </span>
        <span>© 2026 Vesta · Yashwanth C</span>
        </div>
      </footer>
    </div>
  );
};

export default PortfolioTracker;