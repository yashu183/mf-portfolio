import React, { useState } from 'react';
import { ChevronRight, LayoutGrid, List } from 'lucide-react';

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
const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—');
const pct = (v) => `${(v ?? 0) >= 0 ? '+' : '−'}${Math.abs(v ?? 0).toFixed(2)}%`;

const Details = ({ fund }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-5 py-5 bg-surface-strong/50 border-t border-line text-[14px]">
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
          <p className="mt-3 pt-3 border-t border-line flex justify-between"><span className="text-body">Via SIP · {fund.sipMonths} months</span><span className="num">{inr(fund.totalSIPInvested)}</span></p>
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
    {fund.navInfo?.nav && (
      <div>
        <p className="eyebrow mb-3">NAV</p>
        <p className="text-[24px] font-semibold tracking-[-0.03em] num">₹{fund.navInfo.nav.toFixed(2)}</p>
        <p className="mt-1 font-mono text-[12px] text-muted">as of {fund.navInfo.date}</p>
      </div>
    )}
  </div>
);

const COLS = 'md:grid-cols-[minmax(0,1fr)_120px_84px_72px_118px_16px] md:gap-x-3';

// Vercel's deployment list: one bordered container, a row per item, hairlines between, the row opens in place.
const FundList = ({ funds }) => {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="card overflow-hidden">
      <div className={`hidden md:grid ${COLS} gap-4 px-5 h-10 items-center border-b border-line bg-surface-strong/40`} aria-hidden="true">
        <span className="eyebrow">Fund</span>
        <span className="eyebrow text-right">Current</span>
        <span className="eyebrow text-right">Returns</span>
        <span className="eyebrow text-right">XIRR</span>
        <span className="eyebrow">Status</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
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
                    <span className="block font-mono text-[12px] text-muted truncate">{fund.category.toLowerCase()} · {fund.investmentAge}mo</span>
                  </span>
                </span>
                <span className="md:hidden text-right">
                  <span className="block num text-[14px] text-ink">{inr(fund.currentValue)}</span>
                  <span className={`block num text-[12px] ${up ? 'text-gain' : 'text-loss'}`}>{pct(fund.returns)}</span>
                </span>
                <span className="hidden md:block text-right">
                  <span className="block num text-[14px] text-ink">{inr(fund.currentValue)}</span>
                  <span className="block font-mono text-[11px] text-muted">on {inr(fund.totalInvested)}</span>
                </span>
                <span className={`hidden md:block text-right num text-[14px] ${up ? 'text-gain' : 'text-loss'}`}>{pct(fund.returns)}</span>
                <span className="hidden md:block text-right num text-[14px] text-ink">{(fund.xirr ?? 0).toFixed(2)}%</span>
                <span className="hidden md:block"><StatusBadge status={fund.status} /></span>
                <ChevronRight className={`hidden md:block w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
              </button>
              {open && <Details fund={fund} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Vercel's project cards: the name and its mono line, the one figure that matters, state at the foot.
const FundGrid = ({ funds }) => (
  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {funds.map((fund) => {
      const up = (fund.returns ?? 0) >= 0;
      return (
        <article key={fund.id} className="card p-5 flex flex-col gap-4 transition-shadow hover:shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]">
          <header className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-[11px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--c-line-strong)]" style={{ background: `color-mix(in oklab, ${fund.color} 35%, var(--c-surface))` }} aria-hidden="true">
              {(fund.shortName || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium text-ink truncate">{fund.shortName}</h3>
              <p className="font-mono text-[12px] text-muted truncate">{fund.category.toLowerCase()} · {fund.investmentAge}mo</p>
            </div>
          </header>
          <div>
            <p className="text-[24px] font-semibold tracking-[-0.03em] text-ink num">{inr(fund.currentValue)}</p>
            <p className="mt-0.5 text-[13px] text-body"><span className={`num ${up ? 'text-gain' : 'text-loss'}`}>{pct(fund.returns)}</span> on <span className="num">{inr(fund.totalInvested)}</span></p>
          </div>
          <footer className="mt-auto pt-4 border-t border-line flex items-center justify-between">
            <StatusBadge status={fund.status} />
            <span className="font-mono text-[12px] text-muted">XIRR <span className="text-ink">{(fund.xirr ?? 0).toFixed(2)}%</span></span>
          </footer>
        </article>
      );
    })}
  </div>
);

const FundsTable = ({ funds, view = 'list' }) => (view === 'grid' ? <FundGrid funds={funds} /> : <FundList funds={funds} />);

export default FundsTable;
