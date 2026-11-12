import { useTheme, chartPalette } from '../../hooks/useTheme';
import { PANE } from './ScrollPane';
import SummaryPanel from './SummaryPanel';
import ChartTooltip from './ChartTooltip';
import React, { useMemo, useRef, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// Width (px) allotted to each month in the scrollable bar chart
const MONTH_SLOT_PX = 92;
// ─── Tooltips (shared ChartTooltip) ───────────────────────────────────────────
const BarTooltip = ({ active, payload, label, colors }) => {
  if (!active || !payload?.length) return null;
  const sip = payload.find((p) => p.dataKey === 'sipAmount')?.value ?? 0;
  const ls = payload.find((p) => p.dataKey === 'lumpsumAmount')?.value ?? 0;
  const rows = [];
  if (sip > 0) rows.push({ color: colors?.series[0], label: 'SIP', value: `₹${sip.toLocaleString('en-IN')}` });
  if (ls > 0) rows.push({ color: colors?.series[1], label: 'Lump sum', value: `₹${ls.toLocaleString('en-IN')}` });
  return <ChartTooltip title={label} rows={rows} footer={rows.length > 1 ? { label: 'Total', value: `₹${(sip + ls).toLocaleString('en-IN')}` } : null} />;
};

const LineTooltip = ({ active, payload, label, colors }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload ?? {};
  const value = payload[0]?.value ?? 0;
  return (
    <ChartTooltip
      title={label}
      subtitle={point.isRevision ? 'SIP revised this month' : null}
      rows={[{ color: colors?.series[0], label: 'Monthly SIP', value: `₹${value.toLocaleString('en-IN')}` }]}
    />
  );
};

const formatY = (v) =>
  v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;

// ─── Revision dots on line chart ──────────────────────────────────────────────
const RevisionDot = (props) => {
  const { cx, cy, payload } = props;
  // Find if this point is a revision (value differs from previous)
  if (!payload.isRevision) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={props.color}
      stroke={props.ring}
      strokeWidth={2}
    />
  );
};

// Custom bar shape with conditional rounding
const RoundedBar = (props) => {
  const { fill, x, y, width, height, payload } = props;
  if (!height || height < 0) return null;

  const hasLumpsum = payload.lumpsumAmount > 0;
  const hasSIP = payload.sipAmount > 0;
  const isBothPresent = hasLumpsum && hasSIP;

  // Determine which bar this is based on fill color
  const isSIP = Boolean(props.isSIP);

  let radius = 4;
  let topLeftRadius = 0, topRightRadius = 0, bottomLeftRadius = 0, bottomRightRadius = 0;

  if (isSIP) {
    // SIP bar (bottom/green)
    if (isBothPresent) {
      // When stacked with lumpsum: no rounding
      topLeftRadius = topRightRadius = bottomLeftRadius = bottomRightRadius = 0;
    } else {
      // When alone: fully rounded
      topLeftRadius = topRightRadius = bottomLeftRadius = bottomRightRadius = radius;
    }
  } else {
    // Lumpsum bar (top/purple)
    if (isBothPresent) {
      // When stacked with SIP: only top corners rounded
      topLeftRadius = topRightRadius = radius;
      bottomLeftRadius = bottomRightRadius = 0;
    } else {
      // When alone: fully rounded
      topLeftRadius = topRightRadius = bottomLeftRadius = bottomRightRadius = radius;
    }
  }

  return (
    <path
      d={`
        M ${x + topLeftRadius} ${y}
        L ${x + width - topRightRadius} ${y}
        Q ${x + width} ${y}, ${x + width} ${y + topRightRadius}
        L ${x + width} ${y + height - bottomRightRadius}
        Q ${x + width} ${y + height}, ${x + width - bottomRightRadius} ${y + height}
        L ${x + bottomLeftRadius} ${y + height}
        Q ${x} ${y + height}, ${x} ${y + height - bottomLeftRadius}
        L ${x} ${y + topLeftRadius}
        Q ${x} ${y}, ${x + topLeftRadius} ${y}
        Z
      `}
      fill={fill}
    />
  );
};

const InvestmentTimelineView = ({ timelineData, isLoading, error, onRefresh }) => {
  const { theme } = useTheme();
  const pal = chartPalette(theme);
  const scrollRef = useRef(null);

  // ── Derived data ───────────────────────────────────────────────────────────
  // Trim empty months at both ends (e.g. the current month before its SIP is paid)
  const months = useMemo(() => {
    const all = timelineData?.months ?? [];
    const hasData = (m) => (m.sipAmount || 0) + (m.lumpsumAmount || 0) > 0;
    const first = all.findIndex(hasData);
    if (first === -1) return [];
    let last = all.length - 1;
    while (last > first && !hasData(all[last])) last--;
    return all.slice(first, last + 1);
  }, [timelineData]);
  const rawCommitment = timelineData?.sipCommitmentHistory ?? [];

  // Mark revision points on the commitment line
  const commitmentData = useMemo(() => {
    return rawCommitment.map((point, i) => ({
      ...point,
      isRevision:
        i === 0
          ? point.monthlyCommitment > 0
          : point.monthlyCommitment !== rawCommitment[i - 1].monthlyCommitment,
    }));
  }, [rawCommitment]);

  // For this chart, show only months where SIP commitment changed.
  const commitmentRevisionData = useMemo(
    () => commitmentData.filter((p) => p.isRevision),
    [commitmentData],
  );

  // Start scrolled to the most recent months
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [months.length, isLoading]);

  // Summary stats
  const totalSIP = months.reduce((s, m) => s + m.sipAmount, 0);
  const totalLumpsum = months.reduce((s, m) => s + m.lumpsumAmount, 0);
  const totalInvested = totalSIP + totalLumpsum;
  const currentMonthlyCommitment =
    commitmentData.length > 0
      ? commitmentData[commitmentData.length - 1].monthlyCommitment
      : 0;

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-2">
        <svg className="animate-spin h-6 w-6 mr-3 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-10 h-10 text-loss" />
        <p className="text-loss">{error}</p>
        <button
          onClick={onRefresh}
          className="pill pill-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!months.length) {
    return (
      <div className="text-center py-24 text-slate">
        No investment data available.
      </div>
    );
  }

  const revisions = commitmentData.filter((p) => p.isRevision);

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      <aside className="lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
        <SummaryPanel
          label="Total invested"
          value={`₹${Math.round(totalInvested).toLocaleString('en-IN')}`}
          rows={[
            { label: 'Via SIP', value: `₹${(totalSIP / 100000).toFixed(2)}L` },
            { label: 'Via lump sum', value: `₹${(totalLumpsum / 100000).toFixed(2)}L` },
            { label: 'Monthly SIP now', value: `₹${Math.round(currentMonthlyCommitment).toLocaleString('en-IN')}` },
            { label: 'Months tracked', value: `${months.length}` },
          ]}
        />
      </aside>

      <div className={`min-w-0 space-y-10 ${PANE}`}>
      {/* ── Stacked Bar Chart ──────────────────────────────────────────────── */}
      <section aria-labelledby="monthly-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 id="monthly-h" className="text-[20px] leading-[28px] text-ink">Monthly investments</h2>
        <span className="flex items-center gap-4 font-mono text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: pal.series[0] }} aria-hidden="true" />sip</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: pal.series[1] }} aria-hidden="true" />lump sum</span>
          <span>{months.length} months · scroll for history</span>
        </span>
      </div>
      <div className="card p-4 sm:p-5">

        <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div style={{ minWidth: Math.max(months.length * MONTH_SLOT_PX, 320), height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={months}
            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
            maxBarSize={48}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: pal.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatY}
              tick={{ fill: pal.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<BarTooltip colors={pal} />} cursor={{ fill: 'color-mix(in oklab, var(--c-ink) 5%, transparent)' }} />
            <Bar
              dataKey="sipAmount"
              stackId="a"
              fill={pal.series[0]}
              shape={<RoundedBar isSIP />}
              name="sipAmount"
            />
            <Bar
              dataKey="lumpsumAmount"
              stackId="a"
              fill={pal.series[1]}
              shape={<RoundedBar />}
              name="lumpsumAmount"
            />
          </BarChart>
        </ResponsiveContainer>
        </div>
        </div>

      </div>
      </section>

      {/* ── SIP Commitment Line Chart ──────────────────────────────────────── */}
      <section aria-labelledby="commit-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 id="commit-h" className="text-[20px] leading-[28px] text-ink">SIP commitment</h2>
        <span className="font-mono text-[12px] text-muted">monthly · dots mark revisions</span>
      </div>
      <div className="card p-4 sm:p-5">

        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={commitmentRevisionData}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: pal.tick, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              padding={{ left: 28, right: 28 }}
            />
            <YAxis
              tickFormatter={formatY}
              tick={{ fill: pal.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<LineTooltip colors={pal} />} cursor={{ stroke: pal.muted, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line
              type="monotone"
              dataKey="monthlyCommitment"
              stroke={pal.series[0]}
              strokeWidth={2}
              dot={<RevisionDot color={pal.series[0]} ring={pal.surface} />}
              activeDot={{ r: 5, fill: pal.series[0], stroke: pal.surface, strokeWidth: 2 }}
              name="Monthly SIP Commitment"
            />
          </LineChart>
        </ResponsiveContainer>

      </div>
      </section>

      {revisions.length > 0 && (
        <section aria-labelledby="rev-h">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="rev-h" className="text-[20px] leading-[28px] text-ink">SIP revisions</h2>
            <span className="font-mono text-[12px] text-muted">{revisions.length} changes</span>
          </div>
          <ul className="card overflow-hidden divide-y divide-line">
            {revisions.slice().reverse().map((p, i, list) => {
              const prev = list[i + 1]?.monthlyCommitment ?? 0;
              const diff = p.monthlyCommitment - prev;
              const pctChange = prev > 0 ? (diff / prev) * 100 : null;
              return (
                <li key={p.month} className="flex items-center gap-3 px-4 md:px-5 h-12">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${diff >= 0 ? 'bg-gain' : 'bg-loss'}`} aria-hidden="true" />
                  <span className="flex-1 font-mono text-[13px] text-body">{p.label}</span>
                  {pctChange == null ? (
                    <span className="text-[13px] text-muted whitespace-nowrap">First SIP</span>
                  ) : (
                    <span className={`flex items-center gap-2 num text-[13px] whitespace-nowrap ${diff >= 0 ? 'text-gain' : 'text-loss'}`}>
                      <span>{diff >= 0 ? '+' : '−'}₹{Math.abs(diff).toLocaleString('en-IN')}</span>
                      <span className="opacity-80">({diff >= 0 ? "↑" : "↓"} {Math.abs(pctChange).toFixed(1)}%)</span>
                    </span>
                  )}
                  <span className="w-28 text-right num text-[14px] text-ink">₹{p.monthlyCommitment.toLocaleString('en-IN')}<span className="text-muted text-[12px] font-normal">/mo</span></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
};

export default InvestmentTimelineView;
