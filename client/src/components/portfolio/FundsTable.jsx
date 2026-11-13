import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, LayoutGrid, List } from 'lucide-react';
import { usePinCols } from './ScrollPane';
import { SortHead, useSort } from './Sort';
import { fundAge, monthsAsYears } from '../../utils/formatters';

// Status as Vercel shows deployment state: a small dot and a word, the colour on the dot only.
const STATUS = {
  excellent: { label: 'Excellent', dot: 'bg-gain' },
  good: { label: 'Good', dot: 'bg-link' },
  monitor: { label: 'Monitor', dot: 'bg-warn' },
  poor: { label: 'Underperforming', dot: 'bg-loss' },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] ?? { label: status, dot: 'bg-muted' };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-body whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />{s.label}
    </span>
  );
};

// List / grid switch, as Vercel's project toolbar has it.
export const ViewToggle = ({ view, onChange }) => (
  <div className="inline-flex h-10 p-1 rounded-md bg-surface shadow-[0_0_0_1px_var(--c-line-strong)]" role="group" aria-label="Layout">
    {[['list', List, 'List view'], ['grid', LayoutGrid, 'Grid view']].map(([id, Icon, label]) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-pressed={view === id}
        aria-label={label}
        className={`grid place-items-center w-8 rounded-[4px] transition-colors cursor-pointer ${view === id ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink'}`}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
      </button>
    ))}
  </div>
);

const inr = (v, digits = 0) => `₹${(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '-');
const pct = (v) => `${(v ?? 0) >= 0 ? '+' : '−'}${Math.abs(v ?? 0).toFixed(2)}%`;

// `panel` drops the top hairline and tint, for the grid's details panel, which is its own card
const Details = ({ fund, panel = false }) => (
  <div className={`grid grid-cols-1 @2xl:grid-cols-3 gap-6 px-4 md:px-5 py-5 text-[14px] ${panel ? '' : 'bg-surface-strong/50 border-t border-line'}`}>
    {fund.sips?.length > 0 && (
      <div>
        <p className="eyebrow mb-3">SIP{fund.sips.length > 1 ? 's' : ''}</p>
        <ul className="space-y-2">
          {fund.sips.map((sip, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="text-body">{formatDate(sip.startDate)}{sip.stopDate ? ` – ${formatDate(sip.stopDate)}` : ''}</span>
              <span className="num">{inr(sip.amount)}/mo</span>
            </li>
          ))}
        </ul>
        {fund.totalSIPInvested > 0 && (
          <p className="mt-3 pt-3 border-t border-line flex justify-between"><span className="text-body">Via SIP · {monthsAsYears(fund.sipMonths)}</span><span className="num">{inr(fund.totalSIPInvested)}</span></p>
        )}
      </div>
    )}
    {fund.lumpsums?.length > 0 && (
      <div>
        <p className="eyebrow mb-3">Lump sum{fund.lumpsums.length > 1 ? 's' : ''}</p>
        <ul className="space-y-2">
          {fund.lumpsums.map((l, i) => (
            <li key={i} className="flex justify-between gap-4"><span className="text-body">{formatDate(l.date)}</span><span className="num">{inr(l.amount)}</span></li>
          ))}
        </ul>
        <p className="mt-3 pt-3 border-t border-line flex justify-between"><span className="text-body">Total</span><span className="num">{inr(fund.totalLumpsum)}</span></p>
      </div>
    )}
    {fund.latestNAV > 0 && (
      <div>
        <p className="eyebrow mb-3">NAV</p>
        <p className="text-[24px] font-semibold tracking-[-0.03em] num">₹{fund.latestNAV.toFixed(2)}</p>
        <p className={`mt-1 font-mono text-[12px] ${fund.navStatus === 'stale' ? 'text-warn' : 'text-muted'}`}>as of {fund.latestDate}{fund.navStatus === 'stale' && ' · last saved'}</p>
      </div>
    )}
  </div>
);

const COLS = '@2xl:grid-cols-[minmax(0,1fr)_120px_84px_72px_118px_16px] @2xl:gap-x-3';

// Vercel's deployment list: one bordered container, a row per item, hairlines between, the row opens in place.
const STATUS_RANK = { excellent: 4, good: 3, monitor: 2, poor: 1 };
const SORT_BY = {
  fund: (f) => f.shortName || f.name,
  current: (f) => f.currentValue,
  returns: (f) => f.returns,
  xirr: (f) => f.xirr,
  status: (f) => STATUS_RANK[f.status] ?? 0,
};

const FundList = ({ funds, sort, onSort }) => {
  const [openId, setOpenId] = useState(null);
  const colsRef = usePinCols();
  const head = { sort, onSort };
  return (
    <div className="card">
      <div ref={colsRef} role="row" className={`pin-cols hidden @2xl:grid ${COLS} gap-4 px-5 h-10 items-center`}>
        <SortHead label="Fund" k="fund" {...head} />
        <SortHead label="Current" k="current" align="right" {...head} />
        <SortHead label="Returns" k="returns" align="right" {...head} />
        <SortHead label="XIRR" k="xirr" align="right" {...head} />
        <SortHead label="Status" k="status" align="right" {...head} />
        <span />
      </div>
      <ul className="divide-y divide-line overflow-clip rounded-[12px] @2xl:rounded-t-none">
        {funds.map((fund) => {
          const open = openId === fund.id;
          const up = (fund.returns ?? 0) >= 0;
          return (
            <li key={fund.id} data-fund-id={fund.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : fund.id)}
                aria-expanded={open}
                className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] ${COLS} gap-x-4 gap-y-1 items-center px-4 md:px-5 py-3.5 transition-colors cursor-pointer ${open ? 'bg-surface-strong/50' : 'hover:bg-surface-strong/40'}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: fund.color }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink truncate">{fund.shortName}</span>
                    <span className="block font-mono text-[12px] text-muted truncate">{fund.category.toLowerCase()} · {fundAge(fund)}{fund.navStatus === 'stale' && <span className="text-warn"> · NAV from {fund.latestDate}</span>}{fund.navStatus === 'missing' && <span className="text-warn"> · no price yet</span>}</span>
                  </span>
                </span>
                <span className="@2xl:hidden text-right">
                  <span className="block num text-[14px] text-ink">{inr(fund.currentValue)}</span>
                  <span className={`block num text-[12px] ${up ? 'text-gain' : 'text-loss'}`}>{pct(fund.returns)}</span>
                </span>
                <span className="hidden @2xl:block text-right">
                  <span className="block num text-[14px] text-ink">{inr(fund.currentValue)}</span>
                  <span className="block font-mono text-[11px] text-muted">on {inr(fund.totalInvested)}</span>
                </span>
                <span className={`hidden @2xl:block text-right num text-[14px] ${up ? 'text-gain' : 'text-loss'}`}>{pct(fund.returns)}</span>
                <span className="hidden @2xl:block text-right num text-[14px] text-ink">{(fund.xirr ?? 0).toFixed(2)}%</span>
                <span className="hidden @2xl:block text-right"><StatusBadge status={fund.status} /></span>
                <ChevronRight className={`hidden @2xl:block w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
              </button>
              {open && <Details fund={fund} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const Monogram = ({ fund }) => (
  <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-[11px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--c-line-strong)]" style={{ background: `color-mix(in oklab, ${fund.color} 35%, var(--c-surface))` }} aria-hidden="true">
    {(fund.shortName || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
  </span>
);
const FundMeta = ({ fund }) => (
  <span className="block font-mono text-[12px] text-muted">{fund.category.toLowerCase()} · {fundAge(fund)}{fund.navStatus === 'stale' && <span className="text-warn"> · NAV from {fund.latestDate}</span>}{fund.navStatus === 'missing' && <span className="text-warn"> · no price yet</span>}</span>
);

// How many columns a CSS grid is laying out right now (it changes with the container's width).
const useGridColumns = () => {
  const ref = useRef(null);
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setCols(getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length || 1);
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);
  return [ref, cols];
};

// Vercel's project cards: the name and its mono line, the one figure that matters, state at the foot.
// A card opens without moving: it stays in its place, marked, and its SIP, lump sum and NAV details
// open in a full-width panel right under its row, with a notch pointing up at it.
const FundGrid = ({ funds }) => {
  const [openId, setOpenId] = useState(null);
  const [gridRef, cols] = useGridColumns();
  const openIdx = funds.findIndex((f) => f.id === openId);
  const rowEnd = openIdx < 0 ? -1 : Math.min(Math.floor(openIdx / cols) * cols + cols, funds.length) - 1;
  const notch = openIdx < 0 ? 0 : (((openIdx % cols) + 0.5) / cols) * 100;
  return (
    <div ref={gridRef} className="grid @lg:grid-cols-2 @3xl:grid-cols-3 gap-4">
      {funds.map((fund, i) => {
        const up = (fund.returns ?? 0) >= 0;
        const open = openId === fund.id;
        return (
          <React.Fragment key={fund.id}>
            <article data-fund-id={fund.id} className={`card overflow-hidden flex flex-col transition-shadow ${open ? 'shadow-[0_0_0_1px_var(--c-ink),var(--c-shadow-float)]' : 'hover:shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]'}`}>
              <button type="button" onClick={() => setOpenId(open ? null : fund.id)} aria-expanded={open} aria-controls={open ? `fund-details-${fund.id}` : undefined} className="flex-1 w-full text-left p-5 flex flex-col gap-4 cursor-pointer">
                <span className="flex items-start gap-3 w-full">
                  <Monogram fund={fund} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{fund.shortName}</span>
                    <FundMeta fund={fund} />
                  </span>
                  <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 text-muted transition-transform ${open ? 'rotate-90 text-ink' : ''}`} aria-hidden="true" />
                </span>
                <span className="block">
                  <span className="block text-[24px] font-semibold tracking-[-0.03em] text-ink num">{inr(fund.currentValue)}</span>
                  <span className="block mt-0.5 text-[13px] text-body"><span className={`num ${up ? 'text-gain' : 'text-loss'}`}>{pct(fund.returns)}</span> on <span className="num">{inr(fund.totalInvested)}</span></span>
                </span>
                <span className="mt-auto w-full pt-4 border-t border-line flex items-center justify-between">
                  <StatusBadge status={fund.status} />
                  <span className="font-mono text-[12px] text-muted">XIRR <span className="text-ink">{(fund.xirr ?? 0).toFixed(2)}%</span></span>
                </span>
              </button>
            </article>
            {i === rowEnd && (
              <section id={`fund-details-${funds[openIdx].id}`} aria-label={`${funds[openIdx].shortName} details`} className="relative col-span-full card">
                <span className="absolute -top-[6px] w-3 h-3 rotate-45 bg-surface shadow-[-1px_-1px_0_0_var(--c-ring)]" style={{ left: `calc(${notch}% - 6px)` }} aria-hidden="true" />
                <Details fund={funds[openIdx]} panel />
              </section>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// The sort lives here so the order holds when switching between list and grid.
const FundsTable = ({ funds, view = 'list', initialSort = null }) => {
  const { rows, sort, toggle } = useSort(funds, SORT_BY, initialSort);
  return view === 'grid' ? <FundGrid funds={rows} /> : <FundList funds={rows} sort={sort} onSort={toggle} />;
};

export default FundsTable;
