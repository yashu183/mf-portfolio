import React, { useMemo, useState } from 'react';
import AllocationChart, { StyleSwitch, useAllocationStyle } from './AllocationChart';
import { useTheme, chartPalette } from '../../hooks/useTheme';
import { formatCompact, formatCurrency } from '../../utils/formatters';

// The Categories card's chart (all six styles and their switch) for one asset's value: what went in and what
// it earned, the two adding up to the current value. At a loss the gain can't be a slice, so the chart shows
// what's left of the money put in beside what was lost, and the key says so.
const ValueSplitCard = ({ title = 'Value', invested = 0, current = 0, investedLabel = 'Invested', gainLabel = 'Gain' }) => {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const [chartStyle, setChartStyle] = useAllocationStyle();
  const [hot, setHot] = useState(null);
  const gain = current - invested;

  const slices = useMemo(() => (gain >= 0
    ? [
      { name: investedLabel, value: invested, color: palette.invested },
      { name: gainLabel, value: gain, color: palette.up },
    ]
    : [
      { name: `${investedLabel}, still there`, value: current, color: palette.invested },
      { name: 'Loss', value: -gain, color: palette.down },
    ]).filter((d) => d.value > 0), [invested, current, gain, investedLabel, gainLabel, theme]);

  const total = slices.reduce((s, d) => s + d.value, 0);
  const share = (v) => (total > 0 ? ((v / total) * 100).toFixed(2) : '0');
  if (total <= 0) return null;

  return (
    <section className="card overflow-hidden" aria-label={title}>
      {/* the title on its own line, the style switch centred under it, over the chart */}
      <div className="px-5 pt-5">
        <p className="eyebrow whitespace-nowrap">{title}</p>
        <div className="mt-3 flex justify-center"><StyleSwitch value={chartStyle} onChange={setChartStyle} /></div>
      </div>
      <div className="px-5 pt-5 pb-5">
        <AllocationChart
          style={chartStyle}
          data={slices}
          hot={hot}
          onHot={setHot}
          share={share}
          label={`${title}: ${slices.map((d) => `${d.name} ${share(d.value)}%`).join(', ')}`}
          tip={(d) => `${d.name}: ${formatCompact(d.value)} (${share(d.value)}%)`}
          surface={palette.surface}
          grid={palette.grid}
        />
      </div>
      <ul className="divide-y divide-line border-t border-line" onMouseLeave={() => setHot(null)}>
        {slices.map((d) => (
          <li key={d.name} onMouseEnter={() => setHot(d.name)} className={`flex items-center gap-2 px-5 h-10 text-[13px] transition-colors ${hot === d.name ? 'bg-surface-strong/50' : ''}`}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} aria-hidden="true" />
            <span className="flex-1 min-w-0 text-ink">{d.name}</span>
            <span className="num text-body">{formatCompact(d.value)}</span>
            <span className="w-14 text-right num text-body">{share(d.value)}%</span>
          </li>
        ))}
        {/* the total of the slices: what it's worth today */}
        <li className="flex items-center gap-2 px-5 h-10 text-[13px] bg-surface-strong/40">
          <span className="flex-1 font-medium text-ink">{gain >= 0 ? 'Current value' : `${investedLabel} in total`}</span>
          <span className="num font-medium text-ink">{formatCurrency(gain >= 0 ? current : invested)}</span>
        </li>
      </ul>
    </section>
  );
};

export default ValueSplitCard;
