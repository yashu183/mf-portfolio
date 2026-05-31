import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

const PAGE_SIZE = 6;

// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const sip = payload.find((p) => p.dataKey === 'sipAmount')?.value ?? 0;
  const ls = payload.find((p) => p.dataKey === 'lumpsumAmount')?.value ?? 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="font-semibold text-white mb-2">{label}</p>
      {sip > 0 && (
        <p className="text-emerald-400">
          SIP: ₹{sip.toLocaleString('en-IN')}
        </p>
      )}
      {ls > 0 && (
        <p className="text-primary">
          Lumpsum: ₹{ls.toLocaleString('en-IN')}
        </p>
      )}
      <p className="text-white mt-1 border-t border-gray-700 pt-1">
        Total: ₹{(sip + ls).toLocaleString('en-IN')}
      </p>
    </div>
  );
};

// ─── Custom Tooltip for Line Chart ────────────────────────────────────────────
const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const commitment = payload[0]?.value ?? 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      <p className="text-emerald-400">
        Monthly SIP: ₹{commitment.toLocaleString('en-IN')}
      </p>
    </div>
  );
};

// ─── Y-axis tick formatter ─────────────────────────────────────────────────────
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
      fill="oklch(76.5% 0.177 163.223)"
      stroke="#1f2937"
      strokeWidth={2}
    />
  );
};

const InvestmentTimelineView = ({ timelineData, isLoading, error, onRefresh }) => {
  const [barPage, setBarPage] = useState(null); // null = last page (most recent)

  // ── Derived data ───────────────────────────────────────────────────────────
  const months = timelineData?.months ?? [];
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

  const totalPages = Math.ceil(months.length / PAGE_SIZE);
  // Default to last page so the most recent months are shown first
  const currentPage = barPage !== null ? barPage : Math.max(0, totalPages - 1);

  const visibleMonths = months.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  const canGoBack = currentPage > 0;
  const canGoForward = currentPage < totalPages - 1;

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
      <div className="flex items-center justify-center py-24 text-gray-400">
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
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!months.length) {
    return (
      <div className="text-center py-24 text-gray-500">
        No investment data available.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-primary">Investment Timeline</h2>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invested', value: `₹${(totalInvested / 100000).toFixed(2)}L`, color: 'text-primary' },
          { label: 'Via SIP', value: `₹${(totalSIP / 100000).toFixed(2)}L`, color: 'text-emerald-400' },
          { label: 'Via Lumpsum', value: `₹${(totalLumpsum / 100000).toFixed(2)}L`, color: 'text-blue-400' },
          { label: 'Monthly SIP Now', value: `₹${(currentMonthlyCommitment / 1000).toFixed(1).toLocaleString('en-IN')}K`, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4"
          >
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Stacked Bar Chart ──────────────────────────────────────────────── */}
      <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-primary">Monthly Investments</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {currentPage * PAGE_SIZE + 1}–
              {Math.min((currentPage + 1) * PAGE_SIZE, months.length)} of {months.length} months
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBarPage(currentPage - 1)}
              disabled={!canGoBack}
              className="p-1.5 rounded-lg border border-gray-700 hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Previous months"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <span className="text-xs text-slate-500">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setBarPage(currentPage + 1)}
              disabled={!canGoForward}
              className="p-1.5 rounded-lg border border-gray-700 hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Next months"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={visibleMonths}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            barSize={36}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatY}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend
              wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#9ca3af' }}
              formatter={(value) => (value === 'sipAmount' ? 'SIP' : 'Lumpsum')}
            />
            <Bar
              dataKey="sipAmount"
              stackId="a"
              fill="oklch(76.5% 0.177 163.223)"
              radius={[0, 0, 4, 4]}
              name="sipAmount"
            />
            <Bar
              dataKey="lumpsumAmount"
              stackId="a"
              fill="#644ff0"
              radius={[4, 4, 0, 0]}
              name="lumpsumAmount"
            />
          </BarChart>
        </ResponsiveContainer>

        <div className="flex gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "oklch(76.5% 0.177 163.223)" }} /> SIP payments
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Lumpsum investments
          </span>
        </div>
      </div>

      {/* ── SIP Commitment Line Chart ──────────────────────────────────────── */}
      <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-primary">Monthly SIP Commitment Over Time</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            How much you committed to invest each month — dots mark revisions when new SIPs were added
          </p>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={commitmentRevisionData}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={formatY}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<LineTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="monthlyCommitment"
              stroke="#10b981"
              strokeWidth={2}
              dot={<RevisionDot />}
              activeDot={{ r: 5, fill: '#10b981', stroke: '#1f2937', strokeWidth: 2 }}
              name="Monthly SIP Commitment"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Revision annotations */}
        {commitmentData.filter((p) => p.isRevision).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <p className="text-xs text-slate-500 mb-2">Revisions (SIP changes)</p>
            <div className="flex flex-wrap gap-3">
              {commitmentData
                .filter((p) => p.isRevision)
                .map((p) => (
                  <div
                    key={p.month}
                    className="flex items-center gap-2 text-xs bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                    <span className="text-slate-300">{p.label}</span>
                    <span className="text-emerald-400 font-semibold">
                      ₹{p.monthlyCommitment.toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestmentTimelineView;
