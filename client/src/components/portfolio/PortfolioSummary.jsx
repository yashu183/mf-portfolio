import React from 'react';
import { IndianRupee, TrendingUp, BarChart3, Calendar } from 'lucide-react';

const PortfolioSummary = ({ totals, activeFundsCount }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Total Invested */}
      <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-400 uppercase tracking-wide">Total Invested</p>
          <IndianRupee className="w-5 h-5 text-gray-500" />
        </div>
        <p className="text-3xl font-bold text-white">₹{(totals.totalInvested / 100000).toFixed(2)}L</p>
        <p className="text-xs text-gray-500 mt-1">₹{totals.totalInvested.toLocaleString('en-IN')}</p>
      </div>

      {/* Current Value */}
      <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-emerald-400 uppercase tracking-wide">Current Value</p>
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>
        <p className="text-3xl font-bold text-emerald-500">₹{(totals.totalCurrentValue / 100000).toFixed(2)}L</p>
        <p className="text-xs text-emerald-400 mt-1">₹{totals.totalCurrentValue.toLocaleString('en-IN')}</p>
      </div>

      {/* Total Returns */}
      <div className="bg-gray-900/90 backdrop-blur-xl border border-primary/40 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm uppercase tracking-wide text-primary">Total Returns</p>
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <p className="text-3xl font-bold text-primary">{totals.totalReturns.toFixed(2)}%</p>
        <p className="text-xs mt-1 text-primary">₹{(totals.totalCurrentValue - totals.totalInvested).toLocaleString('en-IN')} gain</p>
      </div>

      {/* Monthly SIP */}
      <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 backdrop-blur-xl border border-purple-700/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-purple-400 uppercase tracking-wide">Monthly SIP</p>
          <Calendar className="w-5 h-5 text-purple-500" />
        </div>
        <p className="text-3xl font-bold text-white">₹{totals.monthlySIP.toLocaleString('en-IN')}</p>
        <p className="text-xs text-purple-400 mt-1">Across {activeFundsCount} funds</p>
      </div>
    </div>
  );
};

export default PortfolioSummary;
