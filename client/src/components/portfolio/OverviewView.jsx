import React, { useMemo, useState } from 'react';
import { PANE } from './ScrollPane';
import SummaryPanel from './SummaryPanel';
import { formatCurrentValue } from '../../utils/formatters';
import ChartTooltip from './ChartTooltip';
import AllocationChart, { StyleSwitch, ALLOCATION_STYLES } from './AllocationChart';
import { LineChart as FundsIcon, Landmark, PiggyBank, Coins, Gem, ArrowRight } from 'lucide-react';
import { useTheme, chartPalette } from '../../hooks/useTheme';

const ASSET_ICON = { mutualFunds: FundsIcon, fds: Landmark, epf: PiggyBank, gold: Coins, silver: Gem };
import {
  Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

// Colours follow the asset, never its rank: the dataviz reference order, light-mode steps, validated with direct labels and the accounts table as the relief
// (adjacent CVD and normal-vision separation pass in this order, so the list order is part of the palette).
const ASSET_CFG = [
  { id: 'mutualFunds', label: 'Mutual Funds',   short: 'MF',     slot: 0 },
  { id: 'fds',         label: 'Fixed Deposits', short: 'FDs',    slot: 1 },
  { id: 'epf',         label: 'EPF',            short: 'EPF',    slot: 2 },
  { id: 'gold',        label: 'Gold',           short: 'Gold',   slot: 3 },
  { id: 'silver',      label: 'Silver',         short: 'Silver', slot: 4 },
];

// The allocation chart's style is a per-device preference, like the theme; storage can be blocked
const STYLE_KEY = 'vesta-allocation-style';
const readStyle = () => { try { const v = localStorage.getItem(STYLE_KEY); return ALLOCATION_STYLES.some(x => x.id === v) ? v : 'pie'; } catch { return 'pie'; } };

const fmt = (v) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2)}Cr`
  : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)}L`
  : `₹${v.toLocaleString('en-IN')}`;

const Spinner = () => (
  <svg className="animate-spin h-3 w-3 text-slate flex-shrink-0" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

export default function OverviewView({
  overviewData, isLoading, error, onNavigate,
}) {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const colorOf = (cfg) => palette.series[cfg.slot];
  const assets = useMemo(() => {
    if (!overviewData?.assets) return ASSET_CFG.map(cfg => ({ ...cfg, color: colorOf(cfg), invested: 0, current: 0, hasData: false }));

    return ASSET_CFG.map(cfg => {
      const assetData = overviewData.assets.find(a => a.id === cfg.id);
      return {
        ...cfg,
        color: colorOf(cfg),
        invested: assetData?.invested ?? 0,
        current: assetData?.current ?? 0,
        returns: assetData?.returns ?? 0,
        returnPercent: assetData?.returnPercent ?? 0,
        hasData: assetData ? (assetData.invested > 0 || assetData.current > 0) : false,
      };
    });
  }, [overviewData, theme]);

  const loadedAssets = useMemo(() => assets.filter(a => a.hasData), [assets]);

  const grand = useMemo(() => {
    if (!overviewData?.totals) return { invested: 0, current: 0, gain: 0, gainPct: 0 };
    return {
      invested: overviewData.totals.totalInvested,
      current: overviewData.totals.totalCurrentValue,
      gain: overviewData.totals.totalGain,
      gainPct: overviewData.totals.totalGainPercent,
    };
  }, [overviewData]);

  const [pieMode, setPieMode] = useState('currentValue');
  // the asset under the pointer (by name), shared by the chart and the list rows
  const [hot, setHot] = useState(null);
  const [chartStyle, setChartStyleState] = useState(readStyle);
  const setChartStyle = (v) => { setChartStyleState(v); try { localStorage.setItem(STYLE_KEY, v); } catch {} };

  const PIE_MODES = [
    { id: 'currentValue', label: 'Current Value' },
    { id: 'invested',     label: 'Invested' },
    { id: 'returns',      label: 'Returns' },
  ];

  const pieData = useMemo(() => {
    return loadedAssets
      .filter(a => {
        if (pieMode === 'currentValue') return a.current > 0;
        if (pieMode === 'invested')     return a.invested > 0;
        if (pieMode === 'returns')      return (a.current - a.invested) > 0;
        return false;
      })
      .map(a => ({
        name: a.label,
        value: pieMode === 'currentValue' ? a.current
             : pieMode === 'invested'     ? a.invested
             : (a.current - a.invested),
        color: a.color,
      }));
  }, [loadedAssets, pieMode]);

  const pieTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData]);
  const share = (v) => (pieTotal > 0 ? ((v / pieTotal) * 100).toFixed(1) : '0');
  const modeLabel = pieMode === 'currentValue' ? 'Current value' : pieMode === 'invested' ? 'Invested' : 'Gain';

  const barData = useMemo(() =>
    loadedAssets.filter(a => a.invested > 0 || a.current > 0).map(a => ({
      name: a.short,
      Invested: a.invested,
      Current: a.current,
      color: a.color,
    })),
  [loadedAssets]);

  const BarTooltipContent = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const inv = payload.find(p => p.dataKey === 'Invested')?.value ?? 0;
    const cur = payload.find(p => p.dataKey === 'Current')?.value ?? 0;
    const gain = cur - inv;
    const gainPct = inv > 0 ? Math.abs((gain / inv) * 100).toFixed(1) : '0';
    return (
      <ChartTooltip
        title={label}
        rows={[
          { color: palette.muted, label: 'Invested', value: fmt(inv) },
          { color: palette.primary, label: 'Current', value: fmt(cur) },
        ]}
        footer={{ label: gain >= 0 ? 'Gain' : 'Loss', value: `${gain >= 0 ? '↑' : '↓'} ${fmt(Math.abs(gain))} (${gainPct}%)`, tone: gain >= 0 ? 'gain' : 'loss' }}
      />
    );
  };

  const loadedCount = loadedAssets.length;

  const allocation = (
    <section className="card overflow-hidden" aria-labelledby="alloc-h">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <p id="alloc-h" className="eyebrow">Allocation</p>
        <StyleSwitch value={chartStyle} onChange={setChartStyle} />
      </div>
      <div className="px-5 pt-3">
        <div className="flex p-0.5 rounded-md bg-surface-strong" role="group" aria-label="Allocation by">
          {PIE_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPieMode(m.id)}
              aria-pressed={pieMode === m.id}
              className={`flex-1 h-7 rounded-[5px] text-[12px] transition-colors cursor-pointer ${pieMode === m.id ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--c-ring),0_1px_2px_rgb(0_0_0/0.06)]' : 'text-body hover:text-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {pieData.length > 0 ? (
        <>
          <div className="px-5 pt-5 pb-5">
            <AllocationChart
              style={chartStyle}
              data={pieData}
              hot={hot}
              onHot={setHot}
              share={share}
              label={`${modeLabel} by asset: ${pieData.map(d => `${d.name} ${share(d.value)}%`).join(', ')}`}
              tip={(d) => `${d.name}: ${fmt(d.value)} (${share(d.value)}%)`}
              surface={palette.surface}
              grid={palette.grid}
            />
          </div>
          <ul className="border-t border-line divide-y divide-line" onMouseLeave={() => setHot(null)}>
            {pieData.map((entry, i) => (
              <li key={entry.name} onMouseEnter={() => setHot(entry.name)} className={`flex items-center gap-2 px-5 h-10 text-[13px] transition-colors ${hot === entry.name ? 'bg-surface-strong/50' : ''}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-ink">{entry.name}</span>
                <span className="num text-body">{fmt(entry.value)}</span>
                <span className="w-12 text-right num text-muted">{share(entry.value)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="h-[120px] grid place-items-center font-mono text-[12px] text-muted">loading assets…</div>
      )}
    </section>
  );

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      {/* Left column: totals and allocation, as Vercel keeps usage beside the projects */}
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
        <SummaryPanel
          label="Total balance"
          value={formatCurrentValue(grand.current)}
          change={`${fmt(Math.abs(grand.gain))} (${Math.abs(grand.gainPct).toFixed(2)}%) all time`}
          changeTone={grand.gain >= 0 ? 'gain' : 'loss'}
          rows={[
            { label: 'Invested', value: fmt(grand.invested) },
            { label: 'Unrealised gain', value: `${grand.gain >= 0 ? '' : '−'}${fmt(Math.abs(grand.gain))}`, tone: grand.gain >= 0 ? 'gain' : 'loss' },
            { label: 'Overall return', value: `${grand.gainPct >= 0 ? '' : '−'}${Math.abs(grand.gainPct).toFixed(2)}%`, tone: grand.gainPct >= 0 ? 'gain' : 'loss' },
            { label: 'Assets with holdings', value: `${loadedCount} of ${assets.length}` },
          ]}
        />
        {allocation}
      </aside>

      <div className={`min-w-0 space-y-10 ${PANE}`}>
        {/* Assets: Vercel's project cards, each opening its page */}
        <section aria-labelledby="accounts-h">
          <div className="pin-head flex items-baseline justify-between pb-3">
            <h2 id="accounts-h" className="text-[20px] leading-[28px] text-ink">Assets</h2>
            <span className="font-mono text-[12px] text-muted">{loadedCount} of {assets.length} with holdings</span>
          </div>
          <div className="grid @lg:grid-cols-2 @3xl:grid-cols-3 gap-4">
            {assets.map(a => {
              const Icon = ASSET_ICON[a.id];
              const share = grand.current > 0 && a.hasData ? (a.current / grand.current) * 100 : 0;
              const up = a.returnPercent >= 0;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onNavigate(a.id)}
                  className="card group p-5 text-left flex flex-col gap-4 cursor-pointer transition-shadow hover:shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]"
                >
                  <span className="flex items-center gap-3">
                    <span className="asset-plate" aria-hidden="true"><Icon className="w-4 h-4" style={{ color: a.color }} strokeWidth={2} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink">{a.label}</span>
                      <span className="block font-mono text-[12px] text-muted">{a.hasData ? `${share.toFixed(1)}% of portfolio` : (isLoading ? 'loading…' : 'no holdings')}</span>
                    </span>
                    {isLoading && <Spinner />}
                  </span>
                  <span>
                    <span className="block text-[24px] font-semibold tracking-[-0.03em] text-ink num">{a.hasData ? fmt(a.current) : '-'}</span>
                    {a.hasData && (
                      <span className="block mt-0.5 text-[13px] text-body"><span className={`num ${up ? 'text-gain' : 'text-loss'}`}>{up ? '+' : '−'}{Math.abs(a.returnPercent).toFixed(1)}%</span> on <span className="num">{fmt(a.invested)}</span></span>
                    )}
                  </span>
                  <span className="mt-auto pt-4 border-t border-line flex items-center justify-between">
                    <span className="h-1 flex-1 mr-4 rounded-full bg-surface-strong overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: a.color }} /></span>
                    <span className="inline-flex items-center gap-1 font-mono text-[12px] text-muted group-hover:text-ink transition-colors">Open <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" /></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {barData.length > 0 && (
          <section aria-labelledby="growth-h">
            <div className="pin-head flex items-baseline justify-between pb-3">
              <h2 id="growth-h" className="text-[20px] leading-[28px] text-ink">Invested and current value</h2>
              <span className="font-mono text-[12px] text-muted">per asset class</span>
            </div>
            <div className="card p-5 md:p-6">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barGap={4} barCategoryGap="38%">
                  <CartesianGrid stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: palette.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                    tick={{ fill: palette.tick, fontSize: 12, fontFamily: "Geist Mono, monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip content={<BarTooltipContent />} cursor={{ fill: 'color-mix(in oklab, var(--c-ink) 5%, transparent)' }} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[13px] text-body">{v}</span>} />
                  <Bar dataKey="Invested" fill={palette.muted} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Current" fill={palette.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
