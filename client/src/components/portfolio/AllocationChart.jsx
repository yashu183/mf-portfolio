import React from 'react';
import { PieChart, Grid, LayoutDashboard, BarChartHorizontal, RectangleHorizontal, Flower2 } from 'lucide-react';

// Six ways to draw one whole split by asset. They share one contract: `data` is [{ name, value, color }]
// in the assets' fixed order (colour follows the asset, never its rank), `hot` is the name under the
// pointer and `onHot` sets it, so any chart lights up the matching row of the list under it and back.
export const ALLOCATION_STYLES = [
  { id: 'pie', label: 'Pie', icon: PieChart },
  { id: 'waffle', label: 'Waffle', icon: Grid },
  { id: 'treemap', label: 'Treemap', icon: LayoutDashboard },
  { id: 'bars', label: 'Ranked bars', icon: BarChartHorizontal },
  { id: 'segmented', label: 'Segmented bar', icon: RectangleHorizontal },
  { id: 'rose', label: 'Rose', icon: Flower2 },
];

const C = 100; // centre of the 200-unit drawing box the round charts use
const R = 96; // their outer radius, leaving room for the 2px gaps at the rim

const dim = (hot, name) => ({ opacity: hot == null || hot === name ? 1 : 0.3, transition: 'opacity .15s' });

// Text printed on a coloured block: near-black on light hues, white on dark ones
const inkOn = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.3 ? '#0a0a0a' : '#ffffff';
};

const wedge = (r, a0, a1) => {
  const pt = (a) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  return `M ${C} ${C} L ${pt(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`;
};
const disc = (r) => `M ${C} ${C - r} A ${r} ${r} 0 1 1 ${C - 0.01} ${C - r} Z`;

const Round = ({ label, onLeave, children }) => (
  <svg viewBox="0 0 200 200" className="block mx-auto w-full max-w-[200px] h-auto" role="img" aria-label={label} onMouseLeave={onLeave}>
    {children}
  </svg>
);

// 1. Pie: angle by share, slices parted by a 2px gap in the card colour
const Pie = ({ data, total, hot, onHot, label, surface, tip }) => {
  let a = -Math.PI / 2;
  return (
    <Round label={label} onLeave={() => onHot(null)}>
      {data.map((d) => {
        const a0 = a; a += (d.value / total) * 2 * Math.PI;
        return (
          <path key={d.name} d={data.length === 1 ? disc(R) : wedge(R, a0, a)} fill={d.color} stroke={surface} strokeWidth="2" strokeLinejoin="round" style={dim(hot, d.name)} onMouseEnter={() => onHot(d.name)}>
            <title>{tip(d)}</title>
          </path>
        );
      })}
    </Round>
  );
};

// 6. Rose: every asset the same angle, reaching out by its share. The radius goes by the square root,
// so a slice's area is proportional (twice the money looks twice as big, not four times); faint rings
// at half and full scale give the lengths something to be read against.
const Rose = ({ data, hot, onHot, label, surface, grid, tip }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = (2 * Math.PI) / data.length;
  return (
    <Round label={label} onLeave={() => onHot(null)}>
      {[0.5, 1].map((f) => <circle key={f} cx={C} cy={C} r={R * Math.sqrt(f)} fill="none" stroke={grid} strokeWidth="1" />)}
      {data.map((d, i) => {
        const r = Math.max(R * Math.sqrt(d.value / max), 6);
        const a0 = -Math.PI / 2 + i * step;
        return (
          <path key={d.name} d={data.length === 1 ? disc(r) : wedge(r, a0, a0 + step)} fill={d.color} stroke={surface} strokeWidth="2" strokeLinejoin="round" style={dim(hot, d.name)} onMouseEnter={() => onHot(d.name)}>
            <title>{tip(d)}</title>
          </path>
        );
      })}
    </Round>
  );
};

// 2. Waffle: 100 squares, one per percent. Rounding hands the leftover squares to the largest
// remainders, so the grid always adds up to exactly 100.
const Waffle = ({ data, total, hot, onHot, label, tip }) => {
  const exact = data.map((d) => (d.value / total) * 100);
  const cells = exact.map(Math.floor);
  const left = 100 - cells.reduce((s, n) => s + n, 0);
  exact.map((v, i) => [v - Math.floor(v), i]).sort((x, y) => y[0] - x[0]).slice(0, left).forEach(([, i]) => { cells[i] += 1; });
  const squares = data.flatMap((d, i) => Array.from({ length: cells[i] }, () => d));
  return (
    <div role="img" aria-label={label} className="grid grid-cols-10 gap-[3px] max-w-[200px] mx-auto" onMouseLeave={() => onHot(null)}>
      {squares.map((d, i) => (
        <span key={i} title={tip(d)} className="aspect-square rounded-[2px]" style={{ backgroundColor: d.color, ...dim(hot, d.name) }} onMouseEnter={() => onHot(d.name)} />
      ))}
    </div>
  );
};

// 3. Treemap: one box tiled by share, biggest first. Each split cuts the longer side so the tiles
// stay close to square; with five assets at most, halving the list by value is enough.
const tile = (items, x, y, w, h, out) => {
  if (items.length === 1) { out.push({ d: items[0], x, y, w, h }); return out; }
  const sum = items.reduce((s, d) => s + d.value, 0);
  let k = 1; let acc = items[0].value;
  while (k < items.length - 1 && acc + items[k].value <= sum / 2) { acc += items[k].value; k += 1; }
  const f = acc / sum;
  if (w >= h) { tile(items.slice(0, k), x, y, w * f, h, out); tile(items.slice(k), x + w * f, y, w * (1 - f), h, out); }
  else { tile(items.slice(0, k), x, y, w, h * f, out); tile(items.slice(k), x, y + h * f, w, h * (1 - f), out); }
  return out;
};
const Treemap = ({ data, hot, onHot, label, share, tip }) => {
  const rects = tile([...data].sort((a, b) => b.value - a.value), 0, 0, 100, 75, []);
  return (
    <div role="img" aria-label={label} className="relative w-full aspect-[4/3]" onMouseLeave={() => onHot(null)}>
      {rects.map(({ d, x, y, w, h }) => (
        <div key={d.name} title={tip(d)} className="absolute p-px" style={{ left: `${x}%`, top: `${(y / 75) * 100}%`, width: `${w}%`, height: `${(h / 75) * 100}%` }} onMouseEnter={() => onHot(d.name)}>
          <div className="w-full h-full rounded-[4px] p-2 overflow-hidden" style={{ backgroundColor: d.color, color: inkOn(d.color), ...dim(hot, d.name) }}>
            {w >= 22 && h >= 14 && (
              <>
                <p className="text-[12px] font-medium leading-tight truncate">{d.name}</p>
                <p className="num text-[12px] leading-tight opacity-80">{share(d.value)}%</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// 4. Ranked bars: one per asset, largest first, all on one baseline, scaled to the largest
const Bars = ({ data, hot, onHot, label, share }) => {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = sorted[0]?.value || 1;
  return (
    <div role="img" aria-label={label} className="space-y-2.5" onMouseLeave={() => onHot(null)}>
      {sorted.map((d) => (
        <div key={d.name} className="py-0.5" style={dim(hot, d.name)} onMouseEnter={() => onHot(d.name)}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-body truncate">{d.name}</span>
            <span className="num text-ink">{share(d.value)}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-strong overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// 5. Segmented bar, tall: one 28px bar cut into blocks, each share printed inside where it fits
const Segmented = ({ data, total, hot, onHot, label, share, tip }) => (
  <div role="img" aria-label={label} className="flex h-7 gap-0.5" onMouseLeave={() => onHot(null)}>
    {data.map((d) => (
      <div
        key={d.name}
        title={tip(d)}
        className="min-w-[3px] rounded-[4px] flex items-center px-1.5 overflow-hidden"
        style={{ flex: `${d.value} 1 0`, backgroundColor: d.color, color: inkOn(d.color), ...dim(hot, d.name) }}
        onMouseEnter={() => onHot(d.name)}
      >
        {d.value / total >= 0.12 && <span className="num text-[11px] font-medium">{Math.round((d.value / total) * 100)}%</span>}
      </div>
    ))}
  </div>
);

const CHARTS = { pie: Pie, waffle: Waffle, treemap: Treemap, bars: Bars, segmented: Segmented, rose: Rose };

const AllocationChart = ({ style, data, ...rest }) => {
  const Chart = CHARTS[style] ?? Pie;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return <Chart data={data} total={total} {...rest} />;
};

// The style switch: icon buttons, the same toolbar look as the funds list/grid switch
export const StyleSwitch = ({ value, onChange }) => (
  <div className="inline-flex h-8 p-0.5 rounded-md bg-surface shadow-[0_0_0_1px_var(--c-line-strong)]" role="group" aria-label="Chart style">
    {ALLOCATION_STYLES.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-pressed={value === id}
        aria-label={label}
        title={label}
        className={`grid place-items-center w-7 rounded-[4px] transition-colors cursor-pointer ${value === id ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink'}`}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    ))}
  </div>
);

export default AllocationChart;
