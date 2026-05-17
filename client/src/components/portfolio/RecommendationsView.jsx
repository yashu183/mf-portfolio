import React, { useState } from 'react';
import { CheckCircle, Target, RefreshCw, AlertCircle, Settings, Info } from 'lucide-react';

const RecommendationsView = ({
  recommendations,
  filteredFunds = null,
  allFunds = null,
  isLoadingRecommendations,
  recommendationError,
  serviceAvailable,
  onRefreshRecommendations,
  onCheckHealth
}) => {
  const [hoveredReason, setHoveredReason] = useState(null);

  // Filter recommendations based on filtered funds
  const getFilteredRecommendations = () => {
    if (!recommendations || !filteredFunds || !allFunds || filteredFunds.length === allFunds.length) {
      return recommendations;
    }

    // Create a set of filtered fund names for quick lookup
    const filteredFundNames = new Set(
      filteredFunds.flatMap(f => [f.name, f.shortName])
    );

    return {
      ...recommendations,
      revisedPlan: recommendations.revisedPlan?.filter(plan => {
        // Check if plan name matches any filtered fund name or short name
        return filteredFundNames.has(plan.name);
      }),
    };
  };

  const filteredRecommendations = getFilteredRecommendations();
  const hasFiltersApplied = filteredFunds && allFunds && filteredFunds.length < allFunds.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">
          AI-Powered Investment Recommendations
        </h2>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 text-xs ${serviceAvailable ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${serviceAvailable ? 'bg-green-400' : 'bg-red-400'}`}></div>
            {serviceAvailable ? 'Service Online' : 'Service Offline'}
          </div>
          <button
            onClick={onRefreshRecommendations}
            disabled={isLoadingRecommendations || !serviceAvailable}
            className="flex items-center gap-1 px-3 py-2 rounded-lg hover:opacity-80 transition-colors text-sm disabled:opacity-50 cursor-pointer bg-primary/[0.12] border border-primary/30 text-primary"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingRecommendations ? 'animate-spin' : ''}`} />
            {isLoadingRecommendations ? 'Generating...' : 'Refresh Analysis'}
          </button>
        </div>
      </div>

      {/* Service Status */}
      {!serviceAvailable && (
        <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Recommendation Service Offline</span>
          </div>
          <p className="text-xs text-orange-300 mt-1">
            The AI recommendation service is currently unavailable. Your portfolio data is still accessible in other tabs.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoadingRecommendations && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-primary">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="text-lg">Analyzing your portfolio with AI...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {recommendationError && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{recommendationError}</span>
          </div>
        </div>
      )}

      {/* Service Unavailable Full State */}
      {!serviceAvailable && !isLoadingRecommendations && (
        <div className="text-center py-12">
          <div className="text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">Service Temporarily Unavailable</h3>
            <p className="mb-4">AI recommendation service is currently offline</p>
            <button
              onClick={onCheckHealth}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              Check Service Status
            </button>
          </div>
        </div>
      )}

      {/* Show dynamic recommendations when available */}
      {filteredRecommendations && !isLoadingRecommendations && (
        <div className="space-y-6">
          {/* New Investments */}
          {filteredRecommendations.newInvestments && filteredRecommendations.newInvestments.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold text-emerald-400">AI Recommended New Investments</h3>
                </div>
              </div>
              <div className="space-y-4">
                {filteredRecommendations.newInvestments.map((investment, idx) => (
                  <div key={idx} className="bg-slate-800/30 border border-emerald-700/20 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-white mb-1">{investment.name}</h4>
                        <p className="text-sm text-slate-400">{investment.category}</p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold">
                        AI Recommended
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-slate-400">Suggested SIP</p>
                        <p className="text-lg font-bold text-emerald-400">₹{investment.suggestedSip?.toLocaleString('en-IN') || 'N/A'}/month</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Expected Returns</p>
                        <p className="text-lg font-bold text-primary">{investment.expectedReturns || 'N/A'}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>Why:</strong> {investment.reason}
                    </p>
                    {investment.alternatives && (
                      <p className="text-xs text-slate-500">Alternatives: {investment.alternatives}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revised Plan for Existing Funds */}
          {filteredRecommendations.revisedPlan && filteredRecommendations.revisedPlan.length > 0 && (
            <>
              {/* Filter notice - only shown above Revised Plan */}
              {hasFiltersApplied && (
                <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Showing recommendations for {filteredFunds.length} of {allFunds.length} funds based on active filters
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="border-b border-primary/30 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Target className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold text-primary">
                    Revised Monthly SIP Plan : ₹{
                      filteredRecommendations.revisedPlan
                        .reduce((total, plan) => {
                          return total + (plan.stop || plan.change === 'STOP' ? 0 : plan.revised || 0);
                        }, 0).toLocaleString('en-IN')
                    }
                  </h3>
                </div>
              </div>

              {/* Table */}
              <div className="px-6 py-2">
                {/* Table Header */}
                <div className="grid grid-cols-3 gap-4 p-3 border-b border-slate-600/30">
                  <div className="text-sm text-white">Fund</div>
                  <div className="text-sm text-slate-400">Current</div>
                  <div className="text-sm font-semibold flex items-center">Revised</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-1 text-sm">
                  {filteredRecommendations.revisedPlan.map((plan, idx) => {
                    const isIncrease = plan.change && (plan.change.includes('+') || typeof plan.change === 'string' && plan.change.match(/^\+/));
                    const isDecrease = plan.change && (plan.change.includes('-') || typeof plan.change === 'string' && plan.change.match(/^-/));
                    const shouldStop = plan.stop || plan.change === 'STOP';
                    const shouldAdd = plan.add || plan.change === 'ADD';

                    // Calculate change amount for display
                    // let changeAmount = 0;
                    // if (shouldStop) {
                    //   changeAmount = plan.current;
                    // } else if (shouldAdd) {
                    //   changeAmount = plan.revised;
                    // } else if (typeof plan.change === 'string' && (isIncrease || isDecrease)) {
                    //   const match = plan.change.match(/[+-]?(\d+)/);
                    //   changeAmount = match ? parseInt(match[1]) : Math.abs(plan.revised - plan.current);
                    // } else {
                      
                    // }
                    const changeAmount = Math.abs(plan.revised - plan.current);

                    return (
                      <div key={idx} className={`grid grid-cols-3 gap-4 p-3 mb-3 rounded-lg ${shouldStop ? 'bg-red-900/20 border border-red-700/30' :
                          shouldAdd ? 'bg-emerald-900/20 border border-emerald-700/30' :
                            'hover:bg-slate-800/30'
                        }`}>
                        {/* Fund Name with Info Icon */}
                        <div className="text-white flex items-center gap-2 relative">
                          <span>
                            {plan.name?.replace('Fund', '').replace('Aditya Birla Sun Life', 'Aditya Birla').replace('ICICI Prudential', 'ICICI').replace('Nippon India', 'Nippon').split("-")[0] || 'Unknown Fund'}
                          </span>
                          {plan.reason && (
                            <div className="relative inline-block">
                              <Info
                                className="w-4 h-4 text-slate-400 hover:text-primary cursor-help transition-colors"
                                onMouseEnter={() => setHoveredReason(idx)}
                                onMouseLeave={() => setHoveredReason(null)}
                              />
                              {hoveredReason === idx && (
                                <div className="absolute left-0 top-6 z-50 w-72 p-3 bg-slate-900 border border-primary/30 rounded-lg shadow-xl text-xs text-slate-200 leading-relaxed">
                                  <div className="text-primary font-semibold mb-1">Reason:</div>
                                  {plan.reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Current */}
                        <div className="">
                          <span className={`${plan.current > 0 ? 'text-slate-300' : 'text-gray-500'}`}>
                            {plan.current > 0 ? `₹${plan.current.toLocaleString('en-IN')}` : '—'}
                          </span>
                        </div>

                        {/* Revised with change indicator */}
                        <div className=" flex items-center gap-2">
                          <span className={`mr-2 ${shouldStop ? 'text-red-400' :
                              shouldAdd ? 'text-emerald-400' :
                                isIncrease ? 'text-emerald-400' :
                                  isDecrease ? 'text-orange-400' :
                                    'text-slate-300'
                            }`}>
                            {shouldStop ? '₹0' : `₹${plan.revised?.toLocaleString('en-IN') || 0}`}
                          </span>

                          {shouldStop && changeAmount > 0 && (
                            <span className="text-xs text-red-400 rounded">
                              STOP
                            </span>
                          )}

                          {shouldAdd && changeAmount > 0 && (
                            <span className="text-xs text-emerald-400 rounded">
                              ADD
                            </span>
                          )}

                          {isIncrease && changeAmount > 0 && (
                            <span className="text-xs text-emerald-400">
                              (+₹{changeAmount.toLocaleString('en-IN')})
                            </span>
                          )}

                          {isDecrease && changeAmount > 0 && (
                            <span className="text-xs text-orange-400">
                              (-₹{changeAmount.toLocaleString('en-IN')})
                            </span>
                          )}

                          {plan.change === 'Monitor' && (
                            <span className="text-xs text-blue-400 rounded">
                              Monitor
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Row */}
                <div className="mt-4 pt-4 border-t border-slate-600/50">
                  <div className="grid grid-cols-3 gap-4 px-3 mb-2 rounded-lg">
                    <div className="font-bold text-primary">TOTAL</div>
                    <div className="">
                      <span className="text-slate-300 font-bold">
                        ₹{recommendations.revisedPlan.reduce((total, plan) => total + (plan.current || 0), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="">
                      <span className="font-bold text-primary">
                        ₹{recommendations.revisedPlan
                          .reduce((total, plan) => {
                            return total + (plan.stop || plan.change === 'STOP' ? 0 : plan.revised || 0);
                          }, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Result Summary */}
                {recommendations.resultMessage && (
                  <div className="my-4 p-4 rounded-lg bg-primary/[0.06] border border-primary/20">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <Target className="w-4 h-4 text-primary" />
                      </div>
                      <div className="text-sm text-slate-200 leading-relaxed">
                        {recommendations.resultMessage}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {/* Disclaimer */}
          <div className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">Important Disclaimer</span>
            </div>
            <p className="text-sm text-amber-300">
              These AI-generated recommendations are for informational purposes only and do not constitute financial advice.
              Please consult with a qualified financial advisor before making investment decisions. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      )}

      {/* No recommendations available */}
      {!recommendations && !isLoadingRecommendations && serviceAvailable && (
        <div className="text-center py-12">
          <div className="text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">No Recommendations Available</h3>
            <p className="mb-4">Dynamic recommendations will appear here once generated</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsView;
