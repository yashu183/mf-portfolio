import React from 'react';
import { CheckCircle, TrendingUp, Clock, AlertCircle } from 'lucide-react';

const PerformanceView = ({ performanceGroups }) => {
  const statusConfig = {
    excellent: { title: 'Excellent Performers', color: 'emerald', icon: CheckCircle },
    good: { title: 'Good Performers', color: 'blue', icon: TrendingUp },
    monitor: { title: 'Monitor Closely', color: 'amber', icon: Clock },
    poor: { title: 'Underperformers', color: 'red', icon: AlertCircle }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-primary">
        Performance Analysis
      </h2>

      {/* Performance Groups */}
      {Object.entries(performanceGroups).map(([status, funds]) => {
        if (funds.length === 0) return null;

        const config = statusConfig[status];

        return (
          <div key={status} className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <config.icon className={`w-6 h-6 text-${config.color}-400`} />
              <h3 className={`text-xl font-bold text-${config.color}-400`}>{config.title}</h3>
              <span className="text-sm text-slate-500">({funds.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {funds.map(fund => (
                <div
                  key={fund.id}
                  className="bg-gray-900/70 border border-gray-700/50 rounded-lg p-4 transition-all hover:border-primary"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-white mb-1" style={{ color: fund.color }}>{fund.shortName}</h4>
                      <p className="text-xs text-slate-500">{fund.category} · {fund.investmentAge}mo</p>
                    </div>
                    <div
                      className="w-3 h-3 rounded-full mt-1"
                      style={{ backgroundColor: fund.color }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-slate-500">XIRR</p>
                      <p className={`text-lg font-bold ${fund.xirr >= 15 ? 'text-emerald-400' :
                          fund.xirr >= 12 ? 'text-blue-400' :
                            fund.xirr >= 0 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                        {fund.xirr.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Returns</p>
                      <p className={`text-lg font-bold ${fund.returns >= 15 ? 'text-emerald-400' : fund.returns >= 12 ? 'text-blue-400' : fund.returns >= 7 ? 'text-amber-400' : 'text-red-400'}`}>
                        {fund.returns.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Gain</p>
                      <p className={`text-lg font-bold ${fund.returns >= 0 ? 'text-primary' : 'text-red-400'}`}>
                        ₹{(fund.currentValue - fund.totalInvested).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-700/50 grid grid-cols-2 gap-4 text-xs text-slate-500 space-y-1">
                    <div className="mt-2">₹{(fund.totalInvested / 1000).toFixed(0)}K invested → ₹{(fund.currentValue / 1000).toFixed(0)}K current</div>
                    {fund.currentMonthlySIP > 0 && (
                      <div className="mt-2"><strong>SIP:</strong> ₹{fund.currentMonthlySIP}/mo × {fund.sipMonths} months</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PerformanceView;
