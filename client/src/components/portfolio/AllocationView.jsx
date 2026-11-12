import React from 'react';
import { PANE, usePinCols } from './ScrollPane';
import { RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import SummaryPanel from './SummaryPanel';
import ToArrow from './ToArrow';

// Vercel's note: a bordered strip with an icon, for service state and errors.
const Note = ({ tone = 'warn', children }) => (
  <div className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-[13px] shadow-[inset_0_0_0_1px_currentColor] ${tone === 'error' ? 'text-loss bg-loss/[0.06]' : 'text-warn bg-warn/[0.06]'}`}>
    <AlertCircle className="w-4 h-4 mt-px shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const AllocationView = ({
  portfolioData,
  recommendedAllocation,
  isLoadingRecommendations,
  recommendationError,
  serviceAvailable,
  onRefreshRecommendations,
}) => {
  const colsRef = usePinCols();
  // Current split of the monthly SIP by category
  const current = {};
  let totalSIP = 0;
  portfolioData.forEach((fund) => {
    const sip = fund.currentMonthlySIP || 0;
    totalSIP += sip;
    current[fund.category] = (current[fund.category] || 0) + sip;
  });

  // One row per category, current beside Claude's target when there is one
  const targets = new Map((recommendedAllocation?.allocations || []).map((a) => [a.category, a]));
  const categories = [...new Set([...Object.keys(current), ...targets.keys()])];
  const rows = categories
    .map((category) => {
      const amount = current[category] || 0;
      const pct = totalSIP > 0 ? (amount / totalSIP) * 100 : 0;
      const target = targets.get(category);
      return { category, amount, pct, target, targetPct: target ? Number(target.percentage) : null };
    })
    .sort((a, b) => b.pct - a.pct);
  const hasTargets = rows.some((r) => r.targetPct != null);

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
        <SummaryPanel
          label="Monthly SIP"
          value={`₹${totalSIP.toLocaleString('en-IN')}`}
          rows={[
            { label: 'Categories', value: `${Object.values(current).filter(Boolean).length}` },
            { label: 'Claude target', value: recommendedAllocation ? `₹${recommendedAllocation.totalTarget.toLocaleString('en-IN')}` : '-' },
          ]}
        />
        <section className="card p-5 space-y-3" aria-labelledby="ai-h">
          <p id="ai-h" className="eyebrow flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Claude analysis</p>
          {isLoadingRecommendations ? (
            <p className="flex items-center gap-2 text-[14px] text-body"><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Analysing your allocation…</p>
          ) : recommendedAllocation?.summary ? (
            <p className="text-[14px] leading-[22px] text-body">{recommendedAllocation.summary}</p>
          ) : (
            <p className="text-[14px] text-body">No analysis yet.</p>
          )}
          {!serviceAvailable && <Note>The recommendation service is offline; your current split still shows.</Note>}
          {recommendationError && <Note tone="error">{recommendationError}</Note>}
          <button
            type="button"
            onClick={onRefreshRecommendations}
            disabled={isLoadingRecommendations || !serviceAvailable}
            className="pill pill-secondary w-full"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecommendations ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh analysis
          </button>
        </section>
      </aside>

      <section aria-labelledby="alloc-h" className={`min-w-0 ${PANE}`}>
        <div className="pin-head flex items-baseline justify-between pb-3">
          <h2 id="alloc-h" className="text-[20px] leading-[28px] text-ink">Allocation by SIP</h2>
          <span className="flex items-center gap-4 font-mono text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-ink" aria-hidden="true" />current</span>
            {hasTargets && <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-link" aria-hidden="true" />target</span>}
          </span>
        </div>
        <div className="card">
          <div ref={colsRef} className="pin-cols hidden @xl:grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_96px_80px] gap-4 px-5 h-10 items-center" aria-hidden="true">
            <span className="eyebrow">Category</span>
            <span className="eyebrow">Current vs target</span>
            <span className="eyebrow text-right">SIP</span>
            <span className="eyebrow text-right">Change</span>
          </div>
          <ul className="divide-y divide-line overflow-clip rounded-[12px] @xl:rounded-t-none">
            {rows.map((r) => {
              const delta = r.targetPct != null ? r.targetPct - r.pct : null;
              return (
                <li key={r.category} className="px-4 md:px-5 py-3.5 grid grid-cols-[minmax(0,1fr)_auto] @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_96px_80px] gap-x-4 gap-y-2 items-center">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink truncate">{r.category}</p>
                    <p className="font-mono text-[12px] text-muted">
                      {r.pct.toFixed(1)}%{r.targetPct != null && <><ToArrow />{r.targetPct.toFixed(1)}%</>}
                      {r.pct > 50 ? ' · overweight' : r.amount === 0 ? ' · missing' : ''}
                    </p>
                  </div>
                  <div className="col-span-2 @xl:col-span-1 order-last @xl:order-none space-y-1.5" aria-hidden="true">
                    <div className="h-1.5 rounded-full bg-surface-strong overflow-hidden"><div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(r.pct, 100)}%` }} /></div>
                    {r.targetPct != null && <div className="h-1.5 rounded-full bg-surface-strong overflow-hidden"><div className="h-full rounded-full bg-link" style={{ width: `${Math.min(r.targetPct, 100)}%` }} /></div>}
                    {r.target?.advice && <p className="text-[12px] text-body pt-0.5">{r.target.advice}</p>}
                  </div>
                  <span className="text-right num text-[14px] text-ink">₹{r.amount.toLocaleString('en-IN')}</span>
                  <span className={`hidden @xl:block text-right num text-[13px] ${delta == null || Math.abs(delta) < 0.5 ? 'text-muted' : delta > 0 ? 'text-gain' : 'text-loss'}`}>
                    {delta == null ? '-' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(1)}pt`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default AllocationView;
