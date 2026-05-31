import React, { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

const ASSET_CFG = [
  { id: 'mutualFunds', label: 'Mutual Funds',  short: 'MF',     color: '#644ff0' },
  { id: 'fds',         label: 'Fixed Deposits', short: 'FDs',    color: '#f59e0b' },
  { id: 'gold',        label: 'Gold',           short: 'Gold',   color: '#fbbf24' },
  { id: 'silver',      label: 'Silver',         short: 'Silver', color: '#94a3b8' },
  { id: 'epf',         label: 'EPF',            short: 'EPF',    color: '#10b981' },
];

const fmt = (v) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(2)}Cr`
  : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)}L`
  : `₹${v.toLocaleString('en-IN')}`;

const Spinner = () => (
  <svg className="animate-spin h-3 w-3 text-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

export default function OverviewView({
  totals, isLoadingMF,
  fixedDeposits, isLoadingFDs,
  goldData, isLoadingGold,
  silverData, isLoadingSilver,
  epfData, isLoadingEPF,
  onNavigate,
}) {
  const fdTotals = useMemo(() =>
    fixedDeposits.reduce(
      (acc, d) => ({ invested: acc.invested + (d.principal ?? 0), current: acc.current + (d.currentValue ?? 0) }),
      { invested: 0, current: 0 },
    ),
  [fixedDeposits]);

  const assets = useMemo(() => [
    {
      ...ASSET_CFG[0],
      invested: totals.totalInvested,
      current: totals.totalCurrentValue,
      isLoading: isLoadingMF,
      hasData: totals.totalCurrentValue > 0,
    },
    {
      ...ASSET_CFG[1],
      invested: fdTotals.invested,
      current: fdTotals.current,
      isLoading: isLoadingFDs,
      hasData: fixedDeposits.length > 0,
    },
    {
      ...ASSET_CFG[2],
      invested: goldData?.totals?.totalInvested ?? 0,
      current: goldData?.totals?.totalCurrentValue ?? 0,
      isLoading: isLoadingGold,
      hasData: !!goldData,
    },
    {
      ...ASSET_CFG[3],
      invested: silverData?.totals?.totalInvested ?? 0,
      current: silverData?.totals?.totalCurrentValue ?? 0,
      isLoading: isLoadingSilver,
      hasData: !!silverData,
    },
    {
      ...ASSET_CFG[4],
      invested: epfData?.totalInvested ?? 0,
      current: epfData?.currentValue ?? 0,
      isLoading: isLoadingEPF,
      hasData: !!epfData,
    },
  ], [totals, fdTotals, fixedDeposits, goldData, silverData, epfData,
      isLoadingMF, isLoadingFDs, isLoadingGold, isLoadingSilver, isLoadingEPF]);

  const loadedAssets = useMemo(() => assets.filter(a => a.hasData), [assets]);

  const grand = useMemo(() => {
    const invested = loadedAssets.reduce((s, a) => s + a.invested, 0);
    const current  = loadedAssets.reduce((s, a) => s + a.current, 0);
    const gain     = current - invested;
    const gainPct  = invested > 0 ? (gain / invested) * 100 : 0;
    return { invested, current, gain, gainPct };
  }, [loadedAssets]);

  const [pieMode, setPieMode] = useState('currentValue');

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

  const barData = useMemo(() =>
    loadedAssets.filter(a => a.invested > 0 || a.current > 0).map(a => ({
      name: a.short,
      Invested: a.invested,
      Current: a.current,
      color: a.color,
    })),
  [loadedAssets]);

  const PieTooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, value, color } = payload[0].payload;
    const pct = pieTotal > 0 ? ((value / pieTotal) * 100).toFixed(1) : '0';
    const modeLabel = pieMode === 'currentValue' ? 'Current' : pieMode === 'invested' ? 'Invested' : 'Gain';
    return (
      <div className="bg-gray-900 border border-gray-700/80 rounded-xl px-4 py-3 text-sm shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="font-semibold text-white">{name}</p>
        </div>
        <p className="text-emerald-400 font-bold">{modeLabel}: {fmt(value)}</p>
        <p className="text-gray-400 text-xs mt-0.5">{pct}% of total</p>
      </div>
    );
  };

  const BarTooltipContent = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const inv = payload.find(p => p.dataKey === 'Invested')?.value ?? 0;
    const cur = payload.find(p => p.dataKey === 'Current')?.value ?? 0;
    const gain = cur - inv;
    const gainPct = inv > 0 ? ((gain / inv) * 100).toFixed(1) : '0';
    return (
      <div className="bg-gray-900 border border-gray-700/80 rounded-xl px-4 py-3 text-sm shadow-2xl">
        <p className="font-semibold text-white mb-2">{label}</p>
        <p className="text-gray-400">Invested: {fmt(inv)}</p>
        <p className="text-emerald-400">Current: {fmt(cur)}</p>
        <p className={gain >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
          {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct}%)
        </p>
      </div>
    );
  };

  const loadedCount = loadedAssets.length;

  return (
    <div className="space-y-6">
      {/* ── Grand Totals ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-gray-900/90 to-black/60 border border-gray-700/50 rounded-2xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Total Invested</p>
          <p className="text-2xl font-bold text-white">{fmt(grand.invested)}</p>
          <p className="text-xs text-gray-600 mt-1">{loadedCount} of {assets.length} assets loaded</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/30 to-black/40 border border-emerald-700/30 rounded-2xl p-5">
          <p className="text-xs text-emerald-400 uppercase tracking-wide mb-2">Current Value</p>
          <p className="text-2xl font-bold text-emerald-400">{fmt(grand.current)}</p>
          <p className="text-xs text-emerald-800 mt-1">across all assets</p>
        </div>
        <div className={`bg-gradient-to-br border rounded-2xl p-5 ${grand.gain >= 0 ? 'from-emerald-900/20 to-black/40 border-emerald-700/20' : 'from-red-900/20 to-black/40 border-red-700/20'}`}>
          <p className={`text-xs uppercase tracking-wide mb-2 ${grand.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Total Gain</p>
          <p className={`text-2xl font-bold ${grand.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {grand.gain >= 0 ? '+' : '-'}{fmt(Math.abs(grand.gain))}
          </p>
          <p className={`text-xs mt-1 ${grand.gain >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            {grand.gain >= 0 ? 'unrealised profit' : 'unrealised loss'}
          </p>
        </div>
        <div className="bg-gray-900/90 border border-primary/40 rounded-2xl p-5">
          <p className="text-xs text-primary uppercase tracking-wide mb-2">Overall Return</p>
          <p className={`text-2xl font-bold ${grand.gainPct >= 0 ? 'text-primary' : 'text-red-400'}`}>
            {grand.gainPct >= 0 ? '+' : ''}{grand.gainPct.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-600 mt-1">blended across assets</p>
        </div>
      </div>

      {/* ── Donut Pie + Asset Table ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pie – flat solid + mode switcher */}
        <div className="lg:col-span-2 bg-gray-900/70 border border-gray-700/50 rounded-2xl p-6">
          {/* Header + mode dropdown */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Portfolio Allocation</h3>
              <p className="text-xs text-gray-500 mt-0.5">by {PIE_MODES.find(m => m.id === pieMode)?.label.toLowerCase()}</p>
            </div>
            <select
              value={pieMode}
              onChange={e => setPieMode(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-primary"
            >
              {PIE_MODES.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-300">{entry.name}</span>
                    <span className="text-xs text-gray-500">{pieTotal > 0 ? ((entry.value / pieTotal) * 100).toFixed(1) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[290px] flex flex-col items-center justify-center text-gray-500 gap-3">
              <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm">Loading assets…</p>
            </div>
          )}
        </div>

        {/* Asset Breakdown Table */}
        <div className="lg:col-span-3 bg-gray-900/70 border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Asset Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">click any row to view details</p>
          <div>
            {/* Header */}
            <div className="grid grid-cols-12 text-xs text-gray-500 uppercase tracking-wide pb-3 border-b border-gray-800/80">
              <span className="col-span-4">Asset</span>
              <span className="col-span-3 text-right">Invested</span>
              <span className="col-span-3 text-right">Current</span>
              <span className="col-span-2 text-right">Return</span>
            </div>
            {/* Rows */}
            {assets.map(a => {
              const gain = a.current - a.invested;
              const gainPct = a.invested > 0 ? (gain / a.invested) * 100 : 0;
              return (
                <button
                  key={a.id}
                  onClick={() => onNavigate(a.id)}
                  className="grid grid-cols-12 w-full text-left items-center py-3.5 px-2 -mx-2 rounded-xl hover:bg-gray-800/50 active:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <span className="col-span-4 flex items-center gap-2 text-sm font-medium text-white">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="truncate">{a.label}</span>
                    {a.isLoading && <Spinner />}
                  </span>
                  <span className="col-span-3 text-right text-sm text-gray-300">
                    {a.hasData ? fmt(a.invested) : <span className="text-gray-600">{a.isLoading ? '…' : '—'}</span>}
                  </span>
                  <span className="col-span-3 text-right text-sm font-medium text-emerald-400">
                    {a.hasData ? fmt(a.current) : <span className="text-gray-600">{a.isLoading ? '…' : '—'}</span>}
                  </span>
                  <span className={`col-span-2 text-right text-sm font-bold ${a.hasData ? (gainPct >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-600'}`}>
                    {a.hasData
                      ? `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`
                      : (a.isLoading ? '…' : '—')
                    }
                  </span>
                </button>
              );
            })}
            {/* Total row */}
            {loadedCount > 0 && (
              <div className="grid grid-cols-12 items-center pt-3 mt-1 border-t border-gray-700/80">
                <span className="col-span-4 text-xs text-gray-400 uppercase tracking-wide font-semibold pl-2">Total</span>
                <span className="col-span-3 text-right text-sm font-bold text-white">{fmt(grand.invested)}</span>
                <span className="col-span-3 text-right text-sm font-bold text-emerald-400">{fmt(grand.current)}</span>
                <span className={`col-span-2 text-right text-sm font-bold ${grand.gainPct >= 0 ? 'text-primary' : 'text-red-400'}`}>
                  {grand.gainPct >= 0 ? '+' : ''}{grand.gainPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Invested vs Current Bar Chart ─────────────────────────────────────── */}
      {barData.length > 0 && (
        <div className="bg-gray-900/70 border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Invested vs Current Value</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-6">per asset class</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={barData} barGap={4} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1e5 ? `${(v / 1e5).toFixed(0)}L`
                  : v >= 1000 ? `${(v / 1000).toFixed(0)}K`
                  : v
                }
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip content={<BarTooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Legend
                iconType="rect"
                iconSize={10}
                formatter={(v) => <span className="text-xs text-gray-400">{v}</span>}
              />
              <Bar dataKey="Invested" fill="#4b5563" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Current" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
