import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, BarChart3, CalendarDays, IndianRupee } from 'lucide-react';
import { CYCLE_PALETTE, fdMonYY } from '../../utils/fdCalculations';
import { formatCurrency, formatCurrentValue, formatCompact } from '../../utils/formatters';

export const AssetPlaceholder = ({ asset }) => (
  <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 md:p-10">
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">{asset}</p>
      <h2 className="text-3xl font-bold text-white mb-3">Section ready for new entries</h2>
      <p className="text-gray-400 leading-7">
        This asset bucket is now available in the navbar. Add holdings here whenever you want to
        start tracking them alongside mutual funds and fixed deposits.
      </p>
    </div>
  </div>
);

const FixedDepositsView = ({ deposits, isLoading = false, error = null }) => {
  // ── All hooks must come before any early returns ──────────────────────────────
  const fdNames = useMemo(
    () => [...new Set(deposits.map((d) => d.name || 'Unassigned'))],
    [deposits],
  );
  const fdTabs = useMemo(() => ['All', ...fdNames], [fdNames]);

  const [selectedFdName, setSelectedFdName] = useState('');

  useEffect(() => {
    if (fdTabs.length === 0) {
      setSelectedFdName('');
      return;
    }
    if (!fdTabs.includes(selectedFdName)) {
      setSelectedFdName('All');
    }
  }, [fdTabs, selectedFdName]);

  const filteredDeposits = useMemo(() => {
    if (!selectedFdName || selectedFdName === 'All') return deposits;
    return deposits.filter((d) => (d.name || 'Unassigned') === selectedFdName);
  }, [deposits, selectedFdName]);

  const totals = useMemo(() => filteredDeposits.reduce(
    (acc, d) => ({
      principal: acc.principal + d.principal,
      currentValue: acc.currentValue + d.currentValue,
      totalInterest: acc.totalInterest + d.totalInterest,
      finalMaturityAmount: acc.finalMaturityAmount + d.finalMaturityAmount,
    }),
    { principal: 0, currentValue: 0, totalInterest: 0, finalMaturityAmount: 0 },
  ), [filteredDeposits]);

  // ── Early returns after all hooks ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-3 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading fixed deposits…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-8 text-red-300">
        {error}
      </div>
    );
  }

  const getTabCount = (tabName) => {
    if (tabName === 'All') return deposits.length;
    return deposits.filter((d) => (d.name || 'Unassigned') === tabName).length;
  };

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wide">Total Invested</p>
            <IndianRupee className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white">{formatCompact(totals.principal)}</p>
          <p className="text-xs text-gray-500 mt-1">{formatCurrency(totals.principal)}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-2xl p-4 md:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <p className="text-xs md:text-sm text-emerald-400 uppercase tracking-wide">Current Value</p>
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-emerald-500">{formatCompact(totals.currentValue)}</p>
          <p className="text-xs text-emerald-400 mt-1">{formatCurrentValue(totals.currentValue)}</p>
        </div>

        <div className="bg-gray-900/90 backdrop-blur-xl border border-primary/40 rounded-2xl p-4 md:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <p className="text-xs md:text-sm uppercase tracking-wide text-primary">Interest Earned</p>
            <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-primary">{formatCompact(totals.totalInterest)}</p>
          <p className="text-xs mt-1 text-primary">{formatCurrency(totals.totalInterest)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 backdrop-blur-xl border border-purple-700/30 rounded-2xl p-4 md:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <p className="text-xs md:text-sm text-purple-400 uppercase tracking-wide">At Maturity</p>
            <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-white">{formatCompact(totals.finalMaturityAmount)}</p>
          <p className="text-xs text-purple-400 mt-1">{formatCurrency(totals.finalMaturityAmount)}</p>
        </div>
      </div>

      {fdTabs.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-2 bg-gray-900/70 backdrop-blur-xl p-1 rounded-xl border border-gray-700/50 overflow-x-auto">
            {fdTabs.map((tabName) => (
              <button
                key={tabName}
                onClick={() => setSelectedFdName(tabName)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  selectedFdName === tabName
                    ? 'text-white shadow-lg bg-primary'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tabName}
                <span className="ml-2 text-xs opacity-80">({getTabCount(tabName)})</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 px-1">
            Showing {filteredDeposits.length} fixed deposit{filteredDeposits.length === 1 ? '' : 's'}
            {selectedFdName !== 'All' ? ` for ${selectedFdName}` : ''}
          </p>
        </div>
      )}

      {/* One card per FD */}
      {filteredDeposits.map((d) => {
        const pct = d.progress?.pct ?? 0;
        const cycleBoundaries = d.progress?.cycleBoundaries ?? [];
        const activeCycleIdx = d.progress?.activeCycleIdx ?? d.activeCycleIdx ?? 0;
        const matured = activeCycleIdx >= d.cycleData.length;
        const activePalette = matured ? null : CYCLE_PALETTE[activeCycleIdx % CYCLE_PALETTE.length];
        const phaseLabel = matured ? 'Matured' : `Cycle ${activeCycleIdx + 1} in progress`;
        const phaseColor = matured ? 'text-green-400' : activePalette.text;
        const phaseBarColor = matured ? 'bg-green-500' : activePalette.bar;
        const lastCycle = d.cycleData[d.cycleData.length - 1];

        return (
          <div key={d.id} className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 md:p-6 border-b border-gray-800/60">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-1 truncate">
                  {selectedFdName === 'All' && d.name ? `${d.name} · ` : ''}{d.bank || 'Unassigned'} · {d.label}
                </p>
                <p className="text-lg md:text-xl font-bold text-primary">{formatCurrency(d.principal)}</p>
                <p className="text-sm text-gray-500 mt-1">Started {fdMonYY(d.startDate)} · {d.cycleData.length} cycles</p>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="text-xs text-gray-500 mb-1">Current Value</p>
                <p className="text-lg md:text-2xl font-bold text-green-400">{formatCurrentValue(d.currentValue)}</p>
                <p className={`text-xs font-medium mt-1 ${phaseColor}`}>{phaseLabel}</p>
              </div>
            </div>

            {/* Lifecycle flow — horizontally scrollable */}
            <div className="p-5 md:p-6 space-y-5">
              <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                {/* Principal box */}
                <div className="flex-1 min-w-[145px] md:min-w-[165px] shrink-0 bg-black/40 rounded-xl p-3 text-center flex flex-col items-center justify-center">
                  <p className="text-xs text-gray-500 mb-1">Principal</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(d.principal)}</p>
                  <p className="text-xs text-gray-600 mt-1">{fdMonYY(d.startDate)}</p>
                </div>

                {/* Dynamic cycle boxes */}
                {d.cycleData.map((cycle, i) => {
                  const p = CYCLE_PALETTE[i % CYCLE_PALETTE.length];
                  const isActive = i === activeCycleIdx;
                  const isPast = i < activeCycleIdx;
                  const isFinal = i === d.cycleData.length - 1;
                  return (
                    <React.Fragment key={i}>
                      <div className="flex items-center shrink-0 text-gray-700 text-base px-0.5">›</div>
                      <div
                        className={`flex-1 min-w-[145px] md:min-w-[165px] shrink-0 ${p.bg} border ${p.border} ${isActive ? 'ring-1 ring-white/15' : ''} rounded-xl p-3 text-center`}
                      >
                        <p className={`text-xs ${p.label} uppercase tracking-wider mb-1`}>
                          Cycle {i + 1}{isActive ? ' ▶' : isPast ? ' ✓' : ''}
                        </p>
                        <p className="text-sm font-semibold text-green-400">+{formatCurrency(cycle.interest)}</p>
                        <p className="text-xs text-gray-500 mt-1">{cycle.rate}% · {cycle.termDays}d</p>
                        <p className="text-xs text-gray-600 mt-1">{fdMonYY(cycle.maturityDate)}</p>
                        {isFinal && (
                          <p className="text-xs font-bold mt-1 text-primary">{formatCurrency(cycle.maturityAmount)}</p>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Timeline progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                  <span>{fdMonYY(d.startDate)}</span>
                  <span className={`font-medium ${phaseColor}`}>{phaseLabel}</span>
                  <span>{fdMonYY(lastCycle.maturityDate)}</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full overflow-visible">
                  {cycleBoundaries.map((boundaryPct, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-gray-600 z-10"
                      style={{ left: `${boundaryPct}%` }}
                    />
                  ))}
                  <div
                    className={`h-full rounded-full ${phaseBarColor}`}
                    style={{ width: `${pct}%` }}
                  />
                  {pct > 0 && pct < 100 && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-gray-900 ${phaseBarColor}`}
                      style={{ left: `calc(${pct}% - 6px)` }}
                    />
                  )}
                </div>
                <div className="relative flex justify-between text-xs text-gray-700 mt-1">
                  <span>Start</span>
                  {cycleBoundaries.map((bPct, i) => (
                    <span key={i} className="absolute -translate-x-1/2" style={{ left: `${bPct}%` }}>
                      R{i + 1}
                    </span>
                  ))}
                  <span>Maturity</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FixedDepositsView;
