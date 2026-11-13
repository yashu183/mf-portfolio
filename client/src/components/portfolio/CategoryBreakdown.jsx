import React, { useMemo, useState } from 'react';
import { fundAge } from '../../utils/formatters';
import { StatusBadge } from './FundsTable';
import AllocationChart, { StyleSwitch, useAllocationStyle } from './AllocationChart';
import Insights from './Insights';
import { fundInsights } from '../../utils/insights';
import { useTheme, chartPalette } from '../../hooks/useTheme';
import { formatCompact } from '../../utils/formatters';

// Insights for the left column, as stacked Vercel cards: a mono label, then the facts.
const CategoryBreakdown = ({ categoryBreakdown, totals, performanceGroups, funds = [] }) => {
  const topFund = performanceGroups.excellent.filter((f) => Number.isFinite(f.xirr)).sort((a, b) => b.xirr - a.xirr)[0];
  const categories = Object.entries(categoryBreakdown)
    .map(([category, data]) => ({ category, ...data, pct: totals.totalCurrentValue > 0 ? (data.current / totals.totalCurrentValue) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const [chartStyle, setChartStyle] = useAllocationStyle();
  const [hot, setHot] = useState(null);
  // Colour by rank here (categories have no fixed order); every category keeps its own slice
  const slices = useMemo(() => categories
    .filter((c) => c.current > 0)
    .map((c, i) => ({ name: c.category, value: c.current, color: palette.series[i % palette.series.length], count: c.count })),
  [categories, theme]);
  const sliceTotal = slices.reduce((s, d) => s + d.value, 0);
  const share = (v) => (sliceTotal > 0 ? ((v / sliceTotal) * 100).toFixed(2) : '0');
  const insights = useMemo(() => fundInsights(funds), [funds]);

  return (
    <>
      <section className="card p-5" aria-labelledby="top-h">
        <p id="top-h" className="eyebrow">Top performer</p>
        {topFund ? (
          <>
            <p className="mt-3 text-[14px] font-medium text-ink">{topFund.shortName}</p>
            <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-gain num">{topFund.xirr.toFixed(1)}% <span className="text-[13px] font-normal text-muted">XIRR</span></p>
            <p className="mt-1 font-mono text-[12px] text-muted">{fundAge(topFund)} · {topFund.returns.toFixed(2)}% returns</p>
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
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <p id="split-h" className="eyebrow">Categories</p>
          <StyleSwitch value={chartStyle} onChange={setChartStyle} />
        </div>
        {slices.length > 0 && (
          <div className="px-5 pt-5 pb-5">
            <AllocationChart
              style={chartStyle}
              data={slices}
              hot={hot}
              onHot={setHot}
              share={share}
              label={`Current value by category: ${slices.map((d) => `${d.name} ${share(d.value)}%`).join(', ')}`}
              tip={(d) => `${d.name}: ${formatCompact(d.value)} (${share(d.value)}%)`}
              surface={palette.surface}
              grid={palette.grid}
            />
          </div>
        )}
        <ul className="divide-y divide-line border-t border-line" onMouseLeave={() => setHot(null)}>
          {slices.map((d) => (
            <li key={d.name} onMouseEnter={() => setHot(d.name)} className={`flex items-center gap-2 px-5 h-10 text-[13px] transition-colors ${hot === d.name ? 'bg-surface-strong/50' : ''}`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-ink">{d.name}</span>
              <span className="font-mono text-[12px] text-muted">{d.count} {d.count === 1 ? 'fund' : 'funds'}</span>
              <span className="w-14 text-right num text-body">{share(d.value)}%</span>
            </li>
          ))}
        </ul>
        <Insights items={insights} />
      </section>
    </>
  );
};

export default CategoryBreakdown;
