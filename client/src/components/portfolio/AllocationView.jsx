import React from 'react';
import { Target, RefreshCw, AlertCircle, Settings } from 'lucide-react';

const AllocationView = ({
  portfolioData,
  recommendations,
  recommendedAllocation,
  isLoadingRecommendations,
  recommendationError,
  serviceAvailable,
  onRefreshRecommendations
}) => {
  // Calculate dynamic allocation from portfolio data
  const allocation = {};
  let totalSIP = 0;

  portfolioData.forEach(fund => {
    const category = fund.category;
    const sipAmount = fund.currentMonthlySIP || 0;
    totalSIP += sipAmount;
    allocation[category] = (allocation[category] || 0) + sipAmount;
  });

  const allocationArray = Object.entries(allocation).map(([category, amount]) => ({
    category,
    amount,
    percentage: ((amount / totalSIP) * 100).toFixed(1)
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-primary">
        Asset Allocation
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Allocation */}
        <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span>Current Allocation</span>
            <span className="text-sm text-gray-500">(by SIP amount)</span>
          </h3>

          <div className="space-y-4">
            {allocationArray.map(({ category, amount, percentage }) => (
              <div key={category}>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300">{category}</span>
                  <span className="font-bold text-primary">₹{amount.toLocaleString('en-IN')} ({percentage}%)</span>
                </div>
                <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-primary"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {parseFloat(percentage) > 50 && (
                  <p className="text-xs text-amber-400 mt-1">Overweight - Consider reducing</p>
                )}
                {parseFloat(percentage) === 0 && (
                  <p className="text-xs text-red-400 mt-1">Missing - Add exposure</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI-Powered Recommended Allocation */}
        <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span>AI-Powered Recommended Allocation</span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={onRefreshRecommendations}
                disabled={isLoadingRecommendations || !serviceAvailable}
                className="flex items-center gap-1 px-3 py-1 rounded-lg hover:opacity-80 transition-colors text-sm disabled:opacity-50 cursor-pointer bg-primary/[0.12] border border-primary/30 text-primary"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingRecommendations ? 'animate-spin' : ''}`} />
                {serviceAvailable ? 'Refresh AI Analysis' : 'Service Unavailable'}
              </button>
            </div>
          </div>

          {/* Service Status */}
          {!serviceAvailable && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Recommendation service is currently offline. Basic portfolio view available.</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoadingRecommendations && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-primary">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Generating AI recommendations...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {recommendationError && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{recommendationError}</span>
              </div>
            </div>
          )}

          {recommendedAllocation && (
            <div className="space-y-4">
              {recommendedAllocation.allocations.map((allocation, idx) => {
                // Assign colors by index so every bar is visually distinct,
                // regardless of what the AI returns in the "color" field.
                const palette = [
                  { bar: 'bg-emerald-500', text: 'text-emerald-400' },
                  { bar: 'bg-violet-500', text: 'text-violet-400' },
                  { bar: 'bg-amber-500', text: 'text-amber-400' },
                  { bar: 'bg-cyan-500', text: 'text-cyan-400' },
                  { bar: 'bg-rose-500', text: 'text-rose-400' },
                  { bar: 'bg-blue-500', text: 'text-blue-400' },
                  { bar: 'bg-orange-400', text: 'text-orange-400' },
                  { bar: 'bg-pink-500', text: 'text-pink-400' },
                ];
                const { bar: bgClass, text: textClass } = palette[idx % palette.length];

                return (
                  <div key={idx}>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">{allocation.category}</span>
                      <span className={`font-bold ${textClass}`}>
                        ₹{allocation.amount.toLocaleString('en-IN')}{' '}
                        <span className="text-gray-400 font-normal">({allocation.percentage}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${bgClass} ${allocation.percentage === 0 ? 'opacity-40' : ''}`}
                        style={{ width: allocation.percentage === 0 ? '3px' : `${allocation.percentage}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1.5 ${textClass} opacity-80`}>
                      {allocation.advice}
                    </p>
                  </div>
                );
              })}

              {/* Summary footer */}
              <div className="mt-6 p-4 rounded-xl bg-gray-800/60 border border-gray-700/40">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Monthly SIP</p>
                <p className="text-2xl font-bold text-white">
                  ₹{recommendedAllocation.totalTarget.toLocaleString('en-IN')}
                </p>
                {recommendedAllocation.summary && (
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                    {recommendedAllocation.summary}
                  </p>
                )}
              </div>
            </div>
          )}


          {/* Service Unavailable Message */}
          {!serviceAvailable && !isLoadingRecommendations && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>AI recommendation service is currently unavailable</p>
                <p className="text-sm mt-1">Please try again later or contact administrator</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllocationView;
