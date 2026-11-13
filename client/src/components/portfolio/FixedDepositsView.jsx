import { PageGhost, SummaryGhost, NoteGhost, HeadingGhost, ListGhost } from './Ghost';
import SummaryPanel from './SummaryPanel';
import { ChevronRight } from 'lucide-react';
import FilterBar from './FilterBar';
import ScrollPane from './ScrollPane';
import React, { useMemo, useState } from 'react';
import { fdDate, fdMonthYY, parseLocalDate } from '../../utils/fdCalculations';
import { formatCurrency, formatCurrentValue, formatCompact, heldFor } from '../../utils/formatters';
import ToArrow from './ToArrow';
import { usePinCols } from './ScrollPane';
import { SortHead, useSort } from './Sort';
import { useTheme, chartPalette } from '../../hooks/useTheme';

// Deposit, Principal, Rate, Maturity, Value, chevron
const FD_COLS = '@2xl:grid-cols-[minmax(0,1fr)_96px_76px_168px_112px_16px] gap-x-4';
// holder chips take these palette slots (green, violet, magenta, yellow, teal, orange), so they read apart from the bank circles
const HOLDER_SLOTS = [2, 7, 4, 3, 9, 1];

// the deposit's term in the holder's own words from its label ("2L - 2 yr 6 mo" -> "2 yr 6 mo"), else the current cycle's days
const termOf = (d) => (d.label || '').replace(/^\s*[\d.,]+\s*(k|l|lakh|cr)?\s*[-–·]\s*/i, '').replace(/^(\d+)\s*d$/i, '$1 days').trim()
  || (activeCycle(d) ? `${activeCycle(d).termDays} days` : null);
// Cycle, Principal, Progress, Status, Value
const CYCLE_COLS = '@2xl:grid-cols-[minmax(0,1fr)_96px_minmax(80px,150px)_96px_104px]';
const activeCycle = (d) => d.cycleData[Math.min(d.progress?.activeCycleIdx ?? d.activeCycleIdx ?? 0, d.cycleData.length - 1)];
const rateOf = (d) => activeCycle(d)?.rate ?? 0;
const pctText = (r) => `${Number(r ?? 0).toFixed(2)}%`;
// a short name stays whole (SBI), longer ones take their first letters (Suryoday SF -> SS)
const initials = (bank) => { const words = (bank || '?').trim().split(/\s+/); return (words.length === 1 && words[0].length <= 3 ? words[0] : words.slice(0, 2).map((w) => w[0]).join('')).toUpperCase(); };
// how far through one cycle today is, 0 to 100
const cyclePct = (fromStr, toStr) => {
  const from = parseLocalDate(fromStr).getTime();
  const to = parseLocalDate(toStr).getTime();
  return to > from ? Math.min(Math.max(((Date.now() - from) / (to - from)) * 100, 0), 100) : 100;
};
const Bar = ({ pct, tone = 'bg-link', marks = [] }) => (
  <span className="relative flex-1 h-1 rounded-full bg-surface-strong overflow-hidden">
    <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    {marks.map((b, i) => <span key={i} className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${b}%` }} />)}
  </span>
);
// a deposit holder as a tinted chip, one colour per person
const HolderChip = ({ name, color }) => (
  <span
    className="shrink-0 inline-flex items-center h-5 px-2 rounded-full text-[11px] font-mono whitespace-nowrap"
    style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 35%, transparent)` }}
  >{name.toLowerCase()}</span>
);
const lastMaturity = (d) => parseLocalDate(d.cycleData[d.cycleData.length - 1]?.maturityDate ?? d.startDate).getTime();
const SORT_BY = {
  deposit: (d) => `${d.bank || ''} ${d.name || ''}`,
  principal: (d) => d.principal,
  rate: rateOf,
  matures: lastMaturity,
  value: (d) => d.currentValue,
};

const FixedDepositsView = ({ deposits, isLoading = false, error = null }) => {
  // ── All hooks must come before any early returns ──────────────────────────────
  const bankOptions = useMemo(() => [...new Set(deposits.map((d) => d.bank || 'Unassigned'))].sort(), [deposits]);
  const holderOptions = useMemo(() => [...new Set(deposits.map((d) => d.name || 'Unassigned'))].sort(), [deposits]);
  const [filters, setFilters] = useState({ search: '', banks: [], holders: [] });
  const { banks, holders } = filters;
  const [openId, setOpenId] = useState(null);
  const { theme } = useTheme();
  // each bank keeps one colour from the chart palette, in the order banks first appear
  const bankColor = useMemo(() => {
    const series = chartPalette(theme).series;
    const banks = [...new Set(deposits.map((d) => d.bank || 'Unassigned'))];
    return (bank) => series[banks.indexOf(bank || 'Unassigned') % series.length];
  }, [deposits, theme]);
  const holderColor = useMemo(() => {
    const series = chartPalette(theme).series;
    const names = [...new Set(deposits.map((d) => d.name || 'Unassigned'))];
    return (name) => series[HOLDER_SLOTS[names.indexOf(name || 'Unassigned') % HOLDER_SLOTS.length]];
  }, [deposits, theme]);

  // a deposit stays when it matches the search, any ticked bank and any ticked holder
  const filteredDeposits = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return deposits.filter((d) =>
      (!q || [d.bank, d.name, d.label].some((v) => (v || '').toLowerCase().includes(q)))
      && (banks.length === 0 || banks.includes(d.bank || 'Unassigned'))
      && (holders.length === 0 || holders.includes(d.name || 'Unassigned')));
  }, [deposits, filters, banks, holders]);
  const clearFilters = () => setFilters({ search: '', banks: [], holders: [] });

  const sorted = useSort(filteredDeposits, SORT_BY);
  const head = { sort: sorted.sort, onSort: sorted.toggle };
  const colsRef = usePinCols();

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
  if (isLoading) return (
      <PageGhost label="Loading fixed deposits" aside={<><SummaryGhost /><NoteGhost lines={3} /></>}>
        <section><HeadingGhost /><ListGhost rows={4} figures={2} /></section>
      </PageGhost>
    );

  if (error) {
    return (
      <div className="bg-loss/10 border border-loss/30 rounded-xl p-8 text-loss">
        {error}
      </div>
    );
  }

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
            { label: 'Deposits', value: `${filteredDeposits.length}` },
          ]}
        />
      </aside>

      <section aria-labelledby="deposits-h" className="min-w-0">
        <h2 id="deposits-h" className="sr-only">Deposits</h2>
        {/* the same toolbar as the funds list: search, the filters beside it, the count and clearing under it */}
        <ScrollPane
          toolbar={
            <FilterBar
              filters={filters}
              onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
              onClearFilters={clearFilters}
              searchLabel="deposits"
              selects={[
                { key: 'banks', options: [{ value: '', label: 'All banks' }, ...bankOptions.map((b) => ({ value: b, label: b }))] },
                { key: 'holders', options: [{ value: '', label: 'All holders' }, ...holderOptions.map((h) => ({ value: h, label: h }))] },
              ]}
              summary={`${filteredDeposits.length}${filteredDeposits.length !== deposits.length ? ` of ${deposits.length}` : ''} ${deposits.length === 1 ? 'deposit' : 'deposits'}`}
            />
          }
        >
        {filteredDeposits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong p-12 text-center">
            <p className="text-[14px] text-body mb-4">No deposits match these filters.</p>
            <button type="button" onClick={clearFilters} className="pill pill-primary">Clear filters</button>
          </div>
        ) : (
        // Vercel's deployment list: a row per deposit under sortable column heads, opening in place to its cycles
        <div className="card">
          <div ref={colsRef} role="row" className={`pin-cols hidden @2xl:grid ${FD_COLS} px-5 h-10 items-center`}>
            <SortHead label="Deposit" k="deposit" {...head} />
            <SortHead label="Principal" k="principal" align="center" {...head} />
            <SortHead label="Rate" k="rate" align="center" {...head} />
            <SortHead label="Maturity" k="matures" align="center" {...head} />
            <SortHead label="Value" k="value" align="center" {...head} />
            <span />
          </div>
        <ul className="divide-y divide-line overflow-clip rounded-[12px] @2xl:rounded-t-none">
          {sorted.rows.map((d) => {
            const pct = d.progress?.pct ?? 0;
            const cycleBoundaries = d.progress?.cycleBoundaries ?? [];
            const activeCycleIdx = d.progress?.activeCycleIdx ?? d.activeCycleIdx ?? 0;
            const matured = activeCycleIdx >= d.cycleData.length;
            const lastCycle = d.cycleData[d.cycleData.length - 1];
            const rate = rateOf(d);
            const left = matured ? null : heldFor(new Date(), parseLocalDate(lastCycle.maturityDate));
            const open = openId === d.id;
            const color = bankColor(d.bank);
            // overall: from the first day to the last cycle's maturity, a notch where each cycle renews
            const bar = (
              <span className="flex items-center gap-2">
                <Bar pct={pct} tone={matured ? 'bg-gain' : 'bg-link'} marks={cycleBoundaries} />
                <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink tabular-nums">{Math.round(pct)}%</span>
              </span>
            );
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : d.id)}
                  aria-expanded={open}
                  className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] ${FD_COLS} gap-y-2 items-center px-4 md:px-5 py-3.5 transition-colors cursor-pointer ${open ? 'bg-surface-strong/50' : 'hover:bg-surface-strong/40'}`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-[10px] tracking-[0.02em] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--c-line-strong)]" style={{ background: `color-mix(in oklab, ${color} 40%, var(--c-surface))` }} aria-hidden="true">{initials(d.bank)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[14px] font-medium text-ink">{d.bank || 'Unassigned'}</span>
                        {d.name && <HolderChip name={d.name} color={holderColor(d.name)} />}
                      </span>
                      {/* wraps instead of cutting off: every part here is something the other columns don't say */}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[12px] text-muted">
                        <span className="whitespace-nowrap">{fdMonthYY(d.startDate)}<ToArrow />{fdMonthYY(lastCycle.maturityDate)}</span>
                        <span className="whitespace-nowrap">{!matured && `· cycle ${activeCycleIdx + 1}`}<span className="@2xl:hidden"> · {pctText(rate)} · {termOf(d)}</span></span>
                      </span>
                    </span>
                  </span>
                  <span className="hidden @2xl:block text-center num text-[14px] text-body">{formatCurrency(d.principal)}</span>
                  <span className="hidden @2xl:block text-center">
                    <span className="block num text-[14px] text-ink">{pctText(rate)}</span>
                    <span className="block font-mono text-[11px] text-muted whitespace-nowrap">{termOf(d)}</span>
                  </span>
                  {/* the % on top, the bar across the column, and what's left (or "matured") under it, all ending at the bar's end */}
                  <span className="hidden @2xl:flex flex-col gap-1 min-w-0">
                    <span className="text-right font-mono text-[11px] text-ink tabular-nums">{Math.round(pct)}%</span>
                    <span className="flex"><Bar pct={pct} tone={matured ? 'bg-gain' : 'bg-link'} marks={cycleBoundaries} /></span>
                    <span className={`text-right font-mono text-[11px] whitespace-nowrap ${matured ? 'text-gain' : 'text-muted'}`}>{matured ? 'matured' : `${left} left`}</span>
                  </span>
                  <span className="text-right @2xl:text-center">
                    <span className="block num text-[14px] text-ink">{formatCurrency(d.currentValue)}</span>
                    <span className="block num text-[12px] text-gain">+{formatCurrency(d.currentValue - d.principal)}</span>
                  </span>
                  <ChevronRight className={`hidden @2xl:block w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
                  <span className="col-span-2 @2xl:hidden">{bar}</span>
                </button>
                {open && (
                  // the cycles as a card inside the row: each on four fixed columns, so the bar, the state and
                  // the amounts line up from one cycle to the next and never crowd each other
                  <div className="px-4 md:px-5 py-4 bg-surface-strong/40 border-t border-line">
                    <div className="card overflow-hidden">
                    <div className={`hidden @2xl:grid ${CYCLE_COLS} gap-x-5 items-center px-4 h-9 border-b border-line`} aria-hidden="true">
                      <span className="eyebrow">Cycle</span>
                      <span className="eyebrow">Principal</span>
                      <span className="eyebrow">Progress</span>
                      <span className="eyebrow">Status</span>
                      <span className="eyebrow">Value</span>
                    </div>
                    <ol className="divide-y divide-line" aria-label={`${d.bank} cycles`}>
                      {d.cycleData.map((cycle, i) => {
                        const isActive = i === activeCycleIdx;
                        const isPast = i < activeCycleIdx;
                        const from = i === 0 ? d.startDate : d.cycleData[i - 1].maturityDate;
                        const state = isPast ? { label: 'Done', dot: 'bg-gain' } : isActive ? { label: 'In progress', dot: 'bg-link' } : { label: 'Upcoming', dot: 'bg-muted' };
                        const cp = isPast ? 100 : isActive ? cyclePct(from, cycle.maturityDate) : 0;
                        const status = (
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-body whitespace-nowrap">
                            <span className={`w-2 h-2 rounded-full ${state.dot}`} aria-hidden="true" />{state.label}
                          </span>
                        );
                        const bar = (
                          <span className="flex items-center gap-3" aria-label={`${Math.round(cp)}% through cycle ${i + 1}`}>
                            <Bar pct={cp} tone={isPast ? 'bg-gain' : 'bg-link'} />
                            <span className="w-9 text-right font-mono text-[12px] text-muted">{Math.round(cp)}%</span>
                          </span>
                        );
                        return (
                          <li key={i} className={`grid grid-cols-[minmax(0,1fr)_auto] ${CYCLE_COLS} gap-x-5 gap-y-3 items-center px-4 py-3.5`}>
                            <div className="min-w-0">
                              <p className="text-[14px] font-medium text-ink">Cycle {i + 1} <span className="font-normal text-muted">· <span className="num">{pctText(cycle.rate)}</span>{cycle.termDays !== activeCycle(d)?.termDays && <> · <span className="num">{cycle.termDays}</span> days</>}</span></p>
                              <p className="mt-0.5 font-mono text-[12px] text-muted">{fdDate(from)}<ToArrow />{fdDate(cycle.maturityDate)}</p>
                              <p className="@2xl:hidden mt-0.5 font-mono text-[12px] text-muted">on {formatCurrency(cycle.startAmount)}</p>
                            </div>
                            <span className="hidden @2xl:block num text-[14px] text-body">{formatCurrency(cycle.startAmount)}</span>
                            <span className="hidden @2xl:block">{bar}</span>
                            <span className="hidden @2xl:block">{status}</span>
                            <span className="text-right @2xl:text-left">
                              <span className="block num text-[14px] text-ink">{formatCurrency(cycle.maturityAmount)}</span>
                              <span className="block num text-[12px] text-gain">+{formatCurrency(cycle.interest)}</span>
                            </span>
                            <span className="col-span-2 @2xl:hidden flex items-center gap-4"><span className="flex-1">{bar}</span><span className="w-[92px]">{status}</span></span>
                          </li>
                        );
                      })}
                    </ol>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </div>
        )}
        </ScrollPane>
      </section>
    </div>
  );
};

export default FixedDepositsView;
