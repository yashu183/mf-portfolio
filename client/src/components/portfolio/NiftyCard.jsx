import React from 'react';
import InfoTip from './InfoTip';

const inr = (v) => `₹${Math.round(v ?? 0).toLocaleString('en-IN')}`;
const sign = (v, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

// How the fund portfolio did against putting the same money, on the same days, into the Nifty 50.
export const NiftyExplain = () => (
  <span className="block">
    <span className="block font-medium text-ink mb-0.5">How this is worked out</span>
    Every payment you made into a fund (each SIP instalment and lump sum) is replayed into the Nifty 50 on the same day, at that day's price. XIRR is then worked out for both. The Nifty 50 is tracked with the UTI Nifty 50 Index Fund (Direct), so its figures are after that fund's small cost.
  </span>
);

const NiftyCard = ({ nifty, className = '' }) => {
  if (!nifty || nifty.xirr == null || nifty.portfolioXirr == null) return null;
  const gap = nifty.portfolioXirr - nifty.xirr;
  const valueGap = nifty.portfolioValue - nifty.value;
  const ahead = gap >= 0;
  const rows = [
    { label: 'Your funds, XIRR', value: `${nifty.portfolioXirr.toFixed(2)}%` },
    { label: 'Nifty 50, XIRR', value: `${nifty.xirr.toFixed(2)}%` },
    { label: 'Same money in Nifty 50', value: inr(nifty.value) },
    { label: 'Your funds are worth', value: inr(nifty.portfolioValue) },
  ];
  return (
    <section className={`card overflow-hidden ${className}`} aria-label="Funds against the Nifty 50">
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">Against the Nifty 50</p>
          <InfoTip label="How the Nifty 50 comparison is worked out" wide><NiftyExplain /></InfoTip>
        </div>
        <p className={`mt-3 text-[34px] leading-[40px] font-semibold tracking-[-0.04em] num ${ahead ? 'text-gain' : 'text-loss'}`}>
          {sign(gap)} pts
        </p>
        <p className="mt-1.5 text-[13px] text-body">
          a year {ahead ? 'ahead of' : 'behind'} the Nifty 50, <span className={`num ${ahead ? 'text-gain' : 'text-loss'}`}>{valueGap >= 0 ? '+' : '−'}{inr(Math.abs(valueGap))}</span> {ahead ? 'more' : 'less'} than the same money in the index.
        </p>
      </div>
      <dl className="border-t border-line divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 px-5 h-10">
            <dt className="text-[13px] text-muted">{r.label}</dt>
            <dd className={`num text-[13px] ${r.tone === 'gain' ? 'text-gain' : r.tone === 'loss' ? 'text-loss' : 'text-ink'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="px-5 py-3 border-t border-line font-mono text-[11px] text-muted">Nifty 50 as of {nifty.asOf}</p>
    </section>
  );
};

export default NiftyCard;
