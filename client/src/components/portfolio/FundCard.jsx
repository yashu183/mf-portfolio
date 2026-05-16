import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';

const FundCard = ({ fund, selectedFund, onSelectFund }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusBadge = (status) => {
    const styles = {
      excellent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      good: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      monitor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      poor: "bg-red-500/10 text-red-600 border-red-500/20"
    };
    const labels = {
      excellent: "Excellent",
      good: "Good",
      monitor: "Monitor",
      poor: "Underperforming"
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  return (
    <div
      data-fund-id={fund.id}
      onClick={() => onSelectFund(fund)}
      className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-5 transition-all duration-300 group hover:border-primary relative"
      style={{
        boxShadow: selectedFund?.id === fund.id ? `0 0 30px ${fund.color}40` : 'none'
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: fund.color }}
            />
            <h3
              className="font-bold text-white transition-colors hover:text-primary"
              style={{ color: fund.color }}
            >
              {fund.shortName}
            </h3>
          </div>
          <p className="text-xs text-gray-500">{fund.category} · {fund.investmentAge} months old</p>
        </div>
        {getStatusBadge(fund.status)}
      </div>

      <div className="flex justify-between items-start mb-3 w-[95%]">
        <div>
          <p className="text-xs text-gray-500 mb-1">Invested</p>
          <p className="text-sm font-semibold">₹{(fund.totalInvested / 1000).toFixed(0)}K</p>
        </div>
        <div className="flex-1 flex justify-evenly">
          <div>
            <p className="text-xs text-slate-500 mb-1">Current</p>
          <p className="text-sm font-semibold text-primary">₹{(fund.currentValue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Returns</p>
            <p className={`text-sm font-semibold flex items-center gap-1 justify-center ${(fund.returns ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
              {(fund.returns ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {(fund.returns ?? 0).toFixed(2)}%
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">XIRR</p>
          <p className="text-sm font-semibold">{(fund.xirr ?? 0).toFixed(2)}%</p>
        </div>
      </div>

      {/* Investment Details - Collapsible */}
      {showDetails && (
        <div className="mt-4 border-t border-slate-700/50 w-[95%]">
          <div className="mt-4 text-xs text-slate-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SIP and Lumpsum Column */}
              <div className="space-y-2">
                {fund.sipAmount > 0 && (
                  <div className="flex justify-between">
                    <span><strong>SIP:</strong></span>
                    <span>₹{fund.sipAmount.toLocaleString('en-IN')}/mo × {fund.sipMonths}m = ₹{fund.totalSIPInvested.toLocaleString('en-IN')} (started {formatDate(fund.sipStartDate)})</span>
                  </div>
                )}

                {fund.totalLumpsum > 0 && (
                  <div className="flex justify-between">
                    <span><strong>Lumpsum:</strong></span>
                    <span>₹{(fund.totalLumpsum ?? 0).toLocaleString('en-IN')} ({fund.lumpsums
                      ? fund.lumpsums.map(ls => formatDate(ls.date)).join(', ')
                      : formatDate(fund.lumpsumDate)})</span>
                  </div>
                )}
              </div>

              {/* Current NAV Column */}
              <div className="space-y-2">
                {fund.navInfo && fund.navInfo.nav && (
                  <div className="flex justify-between md:justify-end text-primary">
                    <span><strong>Current NAV:</strong></span>
                    <span>₹{fund.navInfo.nav.toFixed(2)} (as of {fund.navInfo.date})</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Button - Bottom Right */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-700/30 border border-slate-700 rounded-full cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transform transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default FundCard;
