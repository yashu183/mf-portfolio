import { useTheme, chartPalette } from '../../hooks/useTheme';
import ChartTooltip from './ChartTooltip';
import PinnedYAxis, { niceTicks } from './PinnedYAxis';
import { useRef, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Rectangle,
} from 'recharts';
import { formatCurrency, formatCompact } from '../../utils/formatters';

// Width (px) allotted to each set in the scrollable chart
const SET_SLOT_PX = 96;

const BAR_RADIUS = [6, 6, 0, 0];
// room on the right of the plot for the live price tag, so it never sits on a bar
const LIVE_TAG_PX = 104;

// The live price as a small tag just past the end of the dashed line, outside the bars
const LiveTag = ({ viewBox, text, colors }) => {
    if (!viewBox) return null;
    const w = text.length * 6.6 + 16;
    const x = viewBox.x + viewBox.width + 8;
    return (
        <g>
            <rect x={x} y={viewBox.y - 11} width={w} height={22} rx={6} fill={colors.surface} stroke={colors.grid} />
            <text x={x + w / 2} y={viewBox.y} dy="0.35em" textAnchor="middle" fill={colors.primary} fontSize={11} fontWeight={500}>{text}</text>
        </g>
    );
};

// Rounds the top corners only when this segment is the topmost non-empty one in its stack
const stackSegment = (isTop) => (props) => (
    <Rectangle {...props} radius={isTop(props.payload) ? BAR_RADIUS : 0} />
);
const investedShape = stackSegment((d) => d.profit === 0 && d.loss === 0);
const topShape = stackSegment(() => true);

const yy = (dt) => `'${String(dt.getFullYear()).slice(-2)}`;
const mon = (dt) => dt.toLocaleDateString('en-IN', { month: 'short' });
// "13 Jul '24", "9–11 Jun '26", "28 Dec '25 – 3 Jan '26": always one short line
const fmtRange = (from, to) => {
    const a = new Date(from), b = new Date(to);
    if (from === to) return `${a.getDate()} ${mon(a)} ${yy(a)}`;
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${mon(a)} ${yy(a)}`;
    if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)} ${yy(b)}`;
    return `${a.getDate()} ${mon(a)} ${yy(a)} – ${b.getDate()} ${mon(b)} ${yy(b)}`;
};
// signed compact money: "+₹2.38L", "−₹22,923"
const signed = (v) => `${v >= 0 ? '+' : '−'}${formatCompact(Math.abs(v))}`;

// "2026-10-28" -> "Oct'26"
const fmtMonth = (d) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-IN', { month: 'short' })}'${String(dt.getFullYear()).slice(-2)}`;
};

function SetTooltip({ active, payload, colors }) {
    if (!active || !payload?.length) return null;
    const s = payload[0].payload;
    const live = s.avgPrice + s.profit - s.loss;
    const diff = live - s.avgPrice;
    return (
        <ChartTooltip
            title={s.name}
            subtitle={`${s.from.slice(0, 7) === s.to.slice(0, 7) ? fmtMonth(s.from) : `${fmtMonth(s.from)} – ${fmtMonth(s.to)}`} · ${s.quantity} g`}
            rows={[
                { color: colors?.muted, label: 'Your average', value: `${formatCurrency(s.avgPrice)}/g` },
                { color: colors?.primary, label: 'Live price', value: `${formatCurrency(live)}/g` },
            ]}
            footer={[
                { label: diff >= 0 ? 'Profit per gram' : 'Loss per gram', value: `${diff >= 0 ? '+' : '−'}${formatCurrency(Math.abs(diff))}`, tone: diff >= 0 ? 'gain' : 'loss' },
                { label: s.gain >= 0 ? 'Overall profit' : 'Overall loss', value: `${s.gain >= 0 ? '+' : '−'}${formatCurrency(Math.abs(s.gain))} (${s.gain >= 0 ? '↑' : '↓'} ${Math.abs(s.gainPercent).toFixed(2)}%)`, tone: s.gain >= 0 ? 'gain' : 'loss' },
            ]}
        />
    );
}

export default function MetalSetsSection({ sets, pricePerGram, metalLabel }) {
    const { theme } = useTheme();
    const pal = chartPalette(theme);
    const scrollRef = useRef(null);

    // Start scrolled to the most recent set
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = el.scrollWidth;
    }, [sets?.length]);

    if (!sets?.length) return null;

    // Split each bar: invested (primary) up to the lower of avg/live price,
    // then profit (green) up to the live price, or loss (red) above it
    const chartData = sets.map((s) => ({
        ...s,
        investedPart: Math.min(s.avgPrice, pricePerGram),
        profit: Math.max(pricePerGram - s.avgPrice, 0),
        loss: Math.max(s.avgPrice - pricePerGram, 0),
    }));

    // shared by the pinned y-axis and the scrolling bars, so labels and gridlines line up
    const ticks = niceTicks(Math.max(...sets.map((s) => s.avgPrice), pricePerGram) * 1.05);
    const margin = { top: 16, right: LIVE_TAG_PX, left: 0, bottom: 0 };
    const tickFmt = (v) => v.toLocaleString('en-IN');

    return (
        <div className="space-y-4">
            <div className="pin-head flex items-baseline justify-between pb-3 mb-1">
                <h2 className="text-[20px] leading-[28px] text-ink">{metalLabel} sets</h2>
                <span className="font-mono text-[12px] text-muted">{sets.length} sets</span>
            </div>

            {/* Chart: avg buy price per set vs live price */}
            <div className="card p-4 md:p-6">
                <p className="text-xs text-ink-2 mb-3">
                    Avg buy price per set vs live price (₹/g)
                </p>
                <div className="flex">
                <PinnedYAxis ticks={ticks} width={60} height={256} margin={margin} tickFormatter={tickFmt} tick={{ fill: pal.tick, fontSize: 12 }} />
                <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(sets.length * SET_SLOT_PX, 280), height: 256 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={margin}>
                            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis hide domain={[0, ticks[ticks.length - 1]]} ticks={ticks} />
                            <Tooltip content={<SetTooltip colors={pal} />} cursor={{ fill: 'color-mix(in oklab, var(--c-ink) 5%, transparent)' }} />
                            <ReferenceLine
                                y={pricePerGram}
                                stroke={pal.primary}
                                strokeDasharray="5 4"
                                label={<LiveTag text={`Live ${formatCurrency(pricePerGram)}`} colors={pal} />}
                            />
                            <Bar dataKey="investedPart" stackId="p" fill={pal.muted} maxBarSize={64} shape={investedShape} />
                            <Bar dataKey="profit" stackId="p" fill={pal.up} maxBarSize={64} shape={topShape} />
                            <Bar dataKey="loss" stackId="p" fill={pal.down} maxBarSize={64} shape={topShape} />
                            </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>
                </div>
                <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-body" aria-label="Chart key">
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-[3px]" style={{ background: pal.muted }} aria-hidden="true" />Your average buy price</li>
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-[3px]" style={{ background: pal.up }} aria-hidden="true" />Live price above it (profit)</li>
                    <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-[3px]" style={{ background: pal.down }} aria-hidden="true" />Live price below it (loss)</li>
                    <li className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: pal.primary }} aria-hidden="true" />Live price</li>
                </ul>
            </div>

            {/* Set cards: Vercel project cards, the dates on one short line */}
            <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-4">
                {sets.map((s) => {
                    const isProfit = s.gain >= 0;
                    const vsLive = pricePerGram - s.avgPrice;
                    return (
                        <article key={s.name} className="card flex flex-col overflow-hidden">
                            <header className="p-5 pb-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-[14px] font-medium text-ink truncate">{s.name}</h3>
                                    <span className="inline-flex items-center gap-1.5 text-[12px] text-body whitespace-nowrap">
                                        <span className={`w-2 h-2 rounded-full ${isProfit ? 'bg-gain' : 'bg-loss'}`} aria-hidden="true" />
                                        {isProfit ? 'In profit' : 'In loss'}
                                    </span>
                                </div>
                                <p className="mt-0.5 font-mono text-[12px] leading-[18px] text-muted">
                                    <span className="block whitespace-nowrap">{fmtRange(s.from, s.to)}</span>
                                    <span className="block whitespace-nowrap">{s.quantity} g · {s.entryCount} {s.entryCount === 1 ? 'buy' : 'buys'}</span>
                                </p>
                                <p className="mt-4 text-[24px] leading-none font-semibold tracking-[-0.03em] text-ink num">
                                    {formatCurrency(s.avgPrice)}<span className="text-[13px] font-normal tracking-normal text-muted">/g avg</span>
                                </p>
                                <p className={`mt-1.5 font-mono text-[12px] ${vsLive >= 0 ? 'text-gain' : 'text-loss'}`}>
                                    {formatCurrency(Math.abs(vsLive))} {vsLive >= 0 ? 'below' : 'above'} live price
                                </p>
                            </header>
                            <dl className="mt-auto border-t border-line">
                                <div className="grid grid-cols-2 divide-x divide-line">
                                    <div className="px-5 py-3 min-w-0">
                                        <dt className="eyebrow">Invested</dt>
                                        <dd className="mt-1 num text-[14px] text-ink truncate">{formatCompact(s.invested)}</dd>
                                    </div>
                                    <div className="px-5 py-3 min-w-0">
                                        <dt className="eyebrow">Current</dt>
                                        <dd className="mt-1 num text-[14px] text-ink truncate">{formatCompact(s.currentValue)}</dd>
                                    </div>
                                </div>
                                <div className={`flex items-center justify-between gap-3 px-5 h-11 border-t border-line ${isProfit ? 'bg-gain/[0.06]' : 'bg-loss/[0.06]'}`}>
                                    <dt className="eyebrow">Gain</dt>
                                    <dd className={`num text-[14px] whitespace-nowrap ${isProfit ? 'text-gain' : 'text-loss'}`}>
                                        {signed(s.gain)} <span className="opacity-80">({isProfit ? '+' : '−'}{Math.abs(s.gainPercent).toFixed(2)}%)</span>
                                    </dd>
                                </div>
                            </dl>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
