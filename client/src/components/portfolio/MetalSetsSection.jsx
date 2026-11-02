import { useRef, useEffect } from 'react';
import { Calendar, Scale, Layers } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatCompact } from '../../utils/formatters';

// Width (px) allotted to each set in the scrollable chart
const SET_SLOT_PX = 96;

const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// "2026-10-28" -> "Oct'26"
const fmtMonth = (d) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-IN', { month: 'short' })}'${String(dt.getFullYear()).slice(-2)}`;
};

function ChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const s = payload[0].payload;
    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
            <p className="font-semibold text-white">{s.name}</p>
            <p className="text-gray-500 mb-1">
                {s.from.slice(0, 7) === s.to.slice(0, 7) ? fmtMonth(s.from) : `${fmtMonth(s.from)} – ${fmtMonth(s.to)}`}
            </p>
            <p className="text-gray-400">Avg price: <span className="text-white">{formatCurrency(s.avgPrice)}/g</span></p>
            <p className="text-gray-400">Quantity: <span className="text-white">{s.quantity} g</span></p>
            <p className="text-gray-400">Invested: <span className="text-white">{formatCompact(s.invested)}</span></p>
        </div>
    );
}

export default function MetalSetsSection({ sets, pricePerGram, metalLabel }) {
    const scrollRef = useRef(null);

    // Start scrolled to the most recent set
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = el.scrollWidth;
    }, [sets?.length]);

    if (!sets?.length) return null;

    // Split each bar: portion up to the live price (green) + portion above it (red)
    const chartData = sets.map((s) => ({
        ...s,
        belowLive: Math.min(s.avgPrice, pricePerGram),
        aboveLive: Math.max(s.avgPrice - pricePerGram, 0),
    }));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-lg font-bold text-white">{metalLabel} Sets</h3>
                <span className="text-xs text-gray-500">({sets.length})</span>
            </div>

            {/* Chart: avg buy price per set vs live price */}
            <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-6">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                    Avg buy price per set vs live price (₹/g)
                </p>
                <div ref={scrollRef} className="overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(sets.length * SET_SLOT_PX, 280), height: 256 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={60}
                                domain={[0, (max) => Math.ceil(Math.max(max, pricePerGram) * 1.1)]}
                                tickFormatter={(v) => v.toLocaleString('en-IN')}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                            <ReferenceLine
                                y={pricePerGram}
                                stroke="#4ade80"
                                strokeDasharray="5 4"
                                label={{ value: `Live ${formatCurrency(pricePerGram)}`, fill: '#4ade80', fontSize: 11, position: 'insideTopRight' }}
                            />
                            <Bar dataKey="belowLive" stackId="p" fill="#34d399" maxBarSize={64} />
                            <Bar dataKey="aboveLive" stackId="p" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={64} />
                            </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Red = the part of the average price that is above the live price.
                </p>
            </div>

            {/* Set cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sets.map((s) => {
                    const isProfit = s.gain >= 0;
                    return (
                        <div key={s.name} className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-base font-bold text-primary truncate">{s.name}</p>
                                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                        <Calendar size={11} />
                                        {s.from === s.to ? fmtDate(s.from) : `${fmtDate(s.from)} → ${fmtDate(s.to)}`}
                                    </p>
                                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                        <Scale size={11} /> {s.quantity} g · {s.entryCount} {s.entryCount === 1 ? 'entry' : 'entries'}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs text-gray-500">Avg Price</p>
                                    <p className="text-lg font-bold text-blue-400">{formatCurrency(s.avgPrice)}/g</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs pt-3 mt-3 border-t border-gray-800/60">
                                <div>
                                    <p className="text-gray-500 mb-0.5">Invested</p>
                                    <p className="text-white font-medium">{formatCompact(s.invested)}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-500 mb-0.5">Current</p>
                                    <p className="text-white font-medium">{formatCompact(s.currentValue)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-500 mb-0.5">Gain / Loss</p>
                                    <p className={`font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatCompact(s.gain)} ({s.gainPercent.toFixed(2)}%)
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
