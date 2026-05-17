import React from 'react';
import { PieChart, TrendingUp, AlertCircle } from 'lucide-react';

const CategoryBreakdown = ({ categoryBreakdown, totals, performanceGroups }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4 text-primary">
        Quick Insights
      </h2>

      {/* Top Performer */}
      {performanceGroups.excellent.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-emerald-400">Top Performer</h3>
          </div>
          {(() => {
            const topFund = [...performanceGroups.excellent].sort((a, b) => b.xirr - a.xirr)[0];
            return (
              <>
                <p className="text-sm text-white mb-1">{topFund.shortName}</p>
                <p className="text-2xl font-bold text-emerald-400">{topFund.returns.toFixed(2)}% Returns</p>
                <p className="text-xs text-emerald-300 mt-2">{topFund.xirr.toFixed(1)}% XIRR · {topFund.investmentAge} months</p>
              </>
            );
          })()}
        </div>
      )}

      {/* Needs Attention */}
      {performanceGroups.poor.length > 0 && (
        <div className="bg-gradient-to-br from-red-900/30 to-red-800/10 backdrop-blur-xl border border-red-700/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h3 className="font-bold text-red-400">Needs Attention</h3>
          </div>
          {performanceGroups.poor.map(fund => (
            <div key={fund.id} className="mb-3 last:mb-0">
              <p className="text-sm text-white mb-1">{fund.shortName}</p>
              <p className="text-2xl font-bold text-red-400">{fund.returns.toFixed(2)}% Returns</p>
              <p className="text-xs text-red-300 mt-2">
                {fund.currentMonthlySIP > 0 ? `Consider stopping SIP of ₹${fund.currentMonthlySIP.toLocaleString('en-IN')}/mo` : 'Consider exiting'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Category Distribution */}
      <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-primary" />
          Category Split
        </h3>
        <div className="space-y-3">
          {Object.entries(categoryBreakdown).map(([category, data]) => {
            const percentage = (data.current / totals.totalCurrentValue) * 100;
            return (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{category}</span>
                  <span className="font-semibold text-primary">{percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-900/70 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-primary"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {data.count} {data.count === 1 ? 'fund' : 'funds'} · ₹{(data.current / 1000).toFixed(0)}K
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoryBreakdown;
