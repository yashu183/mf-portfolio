import React, { useState, useMemo } from 'react';
import { PieChart, BarChart3, Target, TrendingUp, RefreshCw, Wifi, WifiOff, CalendarDays } from 'lucide-react';
import { usePortfolioData } from '../hooks/usePortfolioData';
import PortfolioSummary from './portfolio/PortfolioSummary';
import FundCard from './portfolio/FundCard';
import CategoryBreakdown from './portfolio/CategoryBreakdown';
import AllocationView from './portfolio/AllocationView';
import PerformanceView from './portfolio/PerformanceView';
import RecommendationsView from './portfolio/RecommendationsView';
import InvestmentTimelineView from './portfolio/InvestmentTimelineView';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: PieChart },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'allocation', label: 'Allocation', icon: BarChart3 },
  { id: 'recommendations', label: 'Recommendations', icon: Target },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
];

const PortfolioTracker = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedFund, setSelectedFund] = useState(null);

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
  } = usePortfolioData();

  // ── Derived data (memoised) ────────────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    return portfolioData.reduce((acc, fund) => {
      if (!acc[fund.category]) acc[fund.category] = { invested: 0, current: 0, count: 0 };
      acc[fund.category].invested += fund.totalInvested;
      acc[fund.category].current += fund.currentValue;
      acc[fund.category].count += 1;
      return acc;
    }, {});
  }, [portfolioData]);

  const performanceGroups = useMemo(() => ({
    excellent: portfolioData.filter(f => f.status === 'excellent'),
    good: portfolioData.filter(f => f.status === 'good'),
    monitor: portfolioData.filter(f => f.status === 'monitor'),
    poor: portfolioData.filter(f => f.status === 'poor'),
  }), [portfolioData]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoadingPortfolio) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl text-gray-400">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (portfolioError) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Failed to Load Portfolio</h2>
          <p className="text-gray-400 mb-6">{portfolioError}</p>
          <button
            onClick={fetchPortfolio}
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 text-primary">
              Portfolio Tracker
            </h1>
            <p className="text-gray-400 text-sm">Real-time insights with dynamic calculations</p>
          </div>

          {/* Status + date */}
          <div className="hidden md:block text-left">
            <div className="flex items-center gap-2 mb-1">
              {isLoadingPortfolio ? (
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              ) : portfolioError ? (
                <WifiOff className="w-4 h-4 text-red-400" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-400" />
              )}
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isLoadingPortfolio ? 'Updating...' : portfolioError ? 'Offline Mode' : 'Live Data'}
              </p>
              {!isLoadingPortfolio && (
                <button
                  onClick={handleManualRefresh}
                  className="p-1 hover:bg-gray-500/10 rounded transition-colors ml-2 cursor-pointer text-primary"
                  title="Hard refresh (clears all caches)"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-lg font-semibold text-primary">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {lastUpdate && (
              <p className="text-xs text-gray-600 mt-1">
                Updated: {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto">
        <PortfolioSummary
          totals={totals}
          activeFundsCount={portfolioData.filter(f => f.currentMonthlySIP > 0).length}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2 bg-gray-900/70 backdrop-blur-xl p-1 rounded-xl border border-gray-700/50">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer ${activeView === tab.id
                  ? 'text-white shadow-lg bg-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {activeView === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-white">Your Funds</span>
                <span className="text-sm text-gray-500">({portfolioData.length})</span>
              </h2>
              {portfolioData.map(fund => (
                <FundCard
                  key={fund.id}
                  fund={fund}
                  selectedFund={selectedFund}
                  onSelectFund={setSelectedFund}
                />
              ))}
            </div>
            <CategoryBreakdown
              categoryBreakdown={categoryBreakdown}
              totals={totals}
              performanceGroups={performanceGroups}
            />
          </div>
        )}

        {activeView === 'performance' && (
          <PerformanceView performanceGroups={performanceGroups} />
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
          <RecommendationsView
            recommendations={recommendations}
            isLoadingRecommendations={isLoadingRecommendations}
            recommendationError={recommendationError}
            serviceAvailable={serviceAvailable}
            onRefreshRecommendations={handleRecommendationRefresh}
            onCheckHealth={checkHealth}
          />
        )}

        {activeView === 'timeline' && (
          <InvestmentTimelineView
            timelineData={timelineData}
            isLoading={isLoadingTimeline}
            error={timelineError}
            onRefresh={fetchTimeline}
          />
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-700/50">
        <div className="text-center text-slate-500 text-sm space-y-2">
          <p>Portfolio Tracker</p>
          <p>
            Total: ₹{(totals.totalCurrentValue / 100000).toFixed(2)}L · {totals.totalReturns.toFixed(2)}% Returns
          </p>
          <p className="text-xs text-slate-600">
            All SIP months, XIRR, and returns auto-calculated from investment start dates
          </p>
          <div className="mt-6 pt-4 border-t border-slate-800/50">
            <p className="text-xs text-slate-600">© 2026 Developed by Yashwanth C</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioTracker;