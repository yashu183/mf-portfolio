import SummaryPanel from './SummaryPanel';
import { PANE } from './ScrollPane';
import { ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { fdMonYY, fdMonthYY } from '../../utils/fdCalculations';
import { formatCurrency, formatCurrentValue, formatCompact } from '../../utils/formatters';
import ToArrow from './ToArrow';

const FixedDepositsView = ({ deposits, isLoading = false, error = null }) => {
  // ── All hooks must come before any early returns ──────────────────────────────
  const fdNames = useMemo(
    () => [...new Set(deposits.map((d) => d.name || 'Unassigned'))],
    [deposits],
  );
  const fdTabs = useMemo(() => ['All', ...fdNames], [fdNames]);

  const [selectedFdName, setSelectedFdName] = useState('');
  const [openId, setOpenId] = useState(null);

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
      <div className="flex items-center justify-center py-24 text-ink-2">
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
      <div className="bg-loss/10 border border-loss/30 rounded-xl p-8 text-loss">
        {error}
      </div>
    );
  }

  const getTabCount = (tabName) => {
    if (tabName === 'All') return deposits.length;
    return deposits.filter((d) => (d.name || 'Unassigned') === tabName).length;
  };

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
        <SummaryPanel
          label="Fixed deposits balance"
          value={formatCurrentValue(totals.currentValue)}
          change={`${formatCurrency(totals.totalInterest)} interest earned`}
          rows={[
            { label: 'Principal', value: formatCompact(totals.principal) },
            { label: 'Interest earned', value: formatCompact(totals.totalInterest), tone: 'gain' },
            { label: 'At maturity', value: formatCompact(totals.finalMaturityAmount) },
            { label: 'Deposits', value: `${deposits.length}` },
          ]}
        />
        {fdTabs.length > 0 && (
          <nav className="card p-2" aria-label="Deposit holder">
            <p className="eyebrow px-3 pt-2 pb-2">Holders</p>
            {fdTabs.map((tabName) => (
              <button
                key={tabName}
                type="button"
                onClick={() => setSelectedFdName(tabName)}
                aria-pressed={selectedFdName === tabName}
                className={`w-full flex items-center justify-between h-9 px-3 rounded-md text-[14px] transition-colors cursor-pointer ${selectedFdName === tabName ? 'bg-surface-strong text-ink font-medium' : 'text-body hover:text-ink hover:bg-surface-strong/60'}`}
              >
                {tabName}
                <span className="font-mono text-[12px] text-muted">{getTabCount(tabName)}</span>
              </button>
            ))}
          </nav>
        )}
      </aside>

      <section aria-labelledby="deposits-h" className={`min-w-0 ${PANE}`}>
        <div className="pin-head flex items-baseline justify-between pb-3">
          <h2 id="deposits-h" className="text-[20px] leading-[28px] text-ink">Deposits</h2>
          <span className="font-mono text-[12px] text-muted">{filteredDeposits.length} {filteredDeposits.length === 1 ? 'deposit' : 'deposits'}{selectedFdName !== 'All' ? ` · ${selectedFdName.toLowerCase()}` : ''}</span>
        </div>
        {/* Vercel's deployment list: a row per deposit, opening in place to its cycles */}
        <ul className="card overflow-hidden divide-y divide-line">
          {filteredDeposits.map((d) => {
            const pct = d.progress?.pct ?? 0;
            const cycleBoundaries = d.progress?.cycleBoundaries ?? [];
            const activeCycleIdx = d.progress?.activeCycleIdx ?? d.activeCycleIdx ?? 0;
            const matured = activeCycleIdx >= d.cycleData.length;
            const lastCycle = d.cycleData[d.cycleData.length - 1];
            const open = openId === d.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : d.id)}
                  aria-expanded={open}
                  className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] @lg:grid-cols-[minmax(0,1fr)_150px_140px_16px] gap-x-4 items-center px-4 md:px-5 py-3.5 transition-colors cursor-pointer ${open ? 'bg-surface-strong/40' : 'hover:bg-surface-strong/40'}`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${matured ? 'bg-gain' : 'bg-link'}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-ink truncate">{d.bank || 'Unassigned'} · {d.label}</span>
                      <span className="block font-mono text-[12px] text-muted truncate">
                        {d.name ? `${d.name.toLowerCase()} · ` : ''}{fdMonthYY(d.startDate)}<ToArrow />{fdMonthYY(lastCycle.maturityDate)} · {matured ? `matured on ${fdMonYY(lastCycle.maturityDate)}` : `cycle ${activeCycleIdx + 1} of ${d.cycleData.length}`}
                      </span>
                    </span>
                  </span>
                  <span className="hidden @lg:flex items-center gap-2">
                    <span className="flex-1 h-1 rounded-full bg-surface-strong overflow-hidden"><span className={`block h-full rounded-full ${matured ? 'bg-gain' : 'bg-ink'}`} style={{ width: `${pct}%` }} /></span>
                    <span className="w-9 text-right font-mono text-[12px] text-muted">{Math.round(pct)}%</span>
                  </span>
                  <span className="text-right">
                    <span className="block num text-[14px] text-ink">{formatCurrentValue(d.currentValue)}</span>
                    <span className="block num text-[12px] text-gain">+{formatCurrency(d.currentValue - d.principal)}</span>
                  </span>
                  <ChevronRight className={`hidden @lg:block w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
                </button>
                {open && (
            <div className="px-4 md:px-5 py-4 space-y-4 bg-surface-strong/40 border-t border-line">
              {/* Cycles: Vercel rows, state as a dot and a word, the period from month to month */}
              <ol className="card overflow-hidden divide-y divide-line">
                {d.cycleData.map((cycle, i) => {
                  const isActive = i === activeCycleIdx;
                  const isPast = i < activeCycleIdx;
                  const isFinal = i === d.cycleData.length - 1;
                  const from = i === 0 ? d.startDate : d.cycleData[i - 1].maturityDate;
                  const state = isPast ? { label: 'Done', dot: 'bg-gain' } : isActive ? { label: 'In progress', dot: 'bg-link' } : { label: 'Upcoming', dot: 'bg-muted' };
                  return (
                    <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_auto] gap-x-4 gap-y-1 items-center px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-ink">
                          Cycle {i + 1} <span className="font-normal text-muted">· <span className="num">{cycle.rate}%</span> for <span className="num">{cycle.termDays}</span> days</span>
                        </p>
                        <p className="font-mono text-[12px] text-muted">
                          {fdMonthYY(from)}<ToArrow />{fdMonthYY(cycle.maturityDate)} · {isPast ? 'matured on' : 'matures on'} {fdMonYY(cycle.maturityDate)}
                        </p>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-body whitespace-nowrap">
                        <span className={`w-2 h-2 rounded-full ${state.dot}`} aria-hidden="true" />{state.label}
                      </span>
                      <div className="text-right">
                        <p className="num text-[14px] text-gain">+{formatCurrency(cycle.interest)}</p>
                        {isFinal ? <p className="font-mono text-[11px] text-muted">{formatCurrency(cycle.maturityAmount)} at end</p>
                          : <p className="sm:hidden inline-flex items-center gap-1.5 text-[12px] text-body"><span className={`w-2 h-2 rounded-full ${state.dot}`} />{state.label}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Progress to final maturity */}
              <div className="pt-1">
                <div className="flex justify-between font-mono text-[12px] text-muted mb-2">
                  <span>started {fdMonYY(d.startDate)}</span>
                  <span className="text-ink">{Math.round(pct)}%</span>
                  <span>{matured ? 'matured on' : 'matures on'} {fdMonYY(lastCycle.maturityDate)}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-surface-strong" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Time to final maturity">
                  <div className={`h-full rounded-full ${matured ? 'bg-gain' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  {cycleBoundaries.map((boundaryPct, i) => (
                    <span key={i} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-canvas" style={{ left: `${boundaryPct}%` }} aria-hidden="true" />
                  ))}
                </div>
              </div>
            </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default FixedDepositsView;
