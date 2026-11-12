import React from 'react';
import { StatusBadge } from './FundsTable';

// Insights for the left column, as stacked Vercel cards: a mono label, then the facts.
const CategoryBreakdown = ({ categoryBreakdown, totals, performanceGroups }) => {
  const topFund = [...performanceGroups.excellent].sort((a, b) => b.xirr - a.xirr)[0];
  const categories = Object.entries(categoryBreakdown)
    .map(([category, data]) => ({ category, ...data, pct: totals.totalCurrentValue > 0 ? (data.current / totals.totalCurrentValue) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <>
      <section className="card p-5" aria-labelledby="top-h">
        <p id="top-h" className="eyebrow">Top performer</p>
        {topFund ? (
          <>
            <p className="mt-3 text-[14px] font-medium text-ink">{topFund.shortName}</p>
            <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-gain num">{topFund.xirr.toFixed(1)}% <span className="text-[13px] font-normal text-muted">XIRR</span></p>
            <p className="mt-1 font-mono text-[12px] text-muted">{topFund.investmentAge}mo · {topFund.returns.toFixed(2)}% returns</p>
          </>
        ) : (
          <p className="mt-3 text-[14px] text-body">No fund is rated excellent yet.</p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="attention-h">
        <p id="attention-h" className="eyebrow">Needs attention</p>
        {performanceGroups.poor.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {performanceGroups.poor.map((fund) => (
              <li key={fund.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink truncate">{fund.shortName}</span>
                  <StatusBadge status="poor" />
                </div>
                <p className="font-mono text-[12px] text-muted">
                  {fund.returns.toFixed(2)}% · {fund.currentMonthlySIP > 0 ? `pause the ₹${fund.currentMonthlySIP.toLocaleString('en-IN')}/mo SIP` : 'consider exiting'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-body"><span className="w-2 h-2 rounded-full bg-gain" aria-hidden="true" /> Nothing flagged right now</p>
        )}
      </section>

      <section className="card overflow-hidden" aria-labelledby="split-h">
        <p id="split-h" className="eyebrow px-5 pt-5 pb-3">Category split</p>
        <ul className="divide-y divide-line border-t border-line">
          {categories.map((c) => (
            <li key={c.category} className="px-5 py-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink">{c.category}</span>
                <span className="num text-body">{c.pct.toFixed(1)}%</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-surface-strong overflow-hidden">
                <div className="h-full rounded-full bg-ink" style={{ width: `${c.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};

export default CategoryBreakdown;
