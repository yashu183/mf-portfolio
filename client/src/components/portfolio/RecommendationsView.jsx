import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Sparkles, ChevronRight } from 'lucide-react';
import SummaryPanel from './SummaryPanel';
import ToArrow from './ToArrow';
import ScrollPane from './ScrollPane';

const inr = (v) => `₹${(v ?? 0).toLocaleString('en-IN')}`;
const shortName = (name) => (name || 'Unknown fund')
  .replace('Fund', '').replace('Aditya Birla Sun Life', 'Aditya Birla').replace('ICICI Prudential', 'ICICI').replace('Nippon India', 'Nippon')
  .split('-')[0].trim();

// The plan's verdict for one fund, as Vercel shows a state: a dot and a word.
const verdictOf = (plan) => {
  const stop = plan.stop || plan.change === 'STOP';
  const add = plan.add || plan.change === 'ADD';
  const diff = (plan.revised || 0) - (plan.current || 0);
  if (stop) return { label: 'Stop', dot: 'bg-loss', tone: 'text-loss', revised: 0 };
  if (add) return { label: 'Add', dot: 'bg-gain', tone: 'text-gain', revised: plan.revised || 0 };
  if (plan.change === 'Monitor') return { label: 'Monitor', dot: 'bg-link', tone: 'text-ink', revised: plan.revised || 0 };
  if (diff > 0) return { label: `+${inr(diff)}`, dot: 'bg-gain', tone: 'text-gain', revised: plan.revised || 0 };
  if (diff < 0) return { label: `−${inr(-diff)}`, dot: 'bg-warn', tone: 'text-warn', revised: plan.revised || 0 };
  return { label: 'Keep', dot: 'bg-muted', tone: 'text-ink', revised: plan.revised || 0 };
};

const Note = ({ tone = 'warn', children }) => (
  <div className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-[13px] shadow-[inset_0_0_0_1px_currentColor] ${tone === 'error' ? 'text-loss bg-loss/[0.06]' : tone === 'info' ? 'text-link bg-link/[0.06]' : 'text-warn bg-warn/[0.06]'}`}>
    <AlertCircle className="w-4 h-4 mt-px shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const RecommendationsView = ({
  recommendations,
  filteredFunds = null,
  allFunds = null,
  isLoadingRecommendations,
  recommendationError,
  serviceAvailable,
  onRefreshRecommendations,
  onCheckHealth,
  toolbar = null,
}) => {
  const [openIdx, setOpenIdx] = useState(null);

  // Narrow the revised plan to the funds the toolbar filters leave
  const filtersApplied = filteredFunds && allFunds && filteredFunds.length < allFunds.length;
  const names = new Set((filteredFunds || []).flatMap((f) => [f.name, f.shortName]));
  const plan = (recommendations?.revisedPlan || []).filter((p) => !filtersApplied || names.has(p.name));
  const newInvestments = recommendations?.newInvestments || [];

  const currentTotal = (recommendations?.revisedPlan || []).reduce((t, p) => t + (p.current || 0), 0);
  const revisedTotal = (recommendations?.revisedPlan || []).reduce((t, p) => t + verdictOf(p).revised, 0);
  const delta = revisedTotal - currentTotal;

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
        <SummaryPanel
          label="Revised monthly SIP"
          value={recommendations ? inr(revisedTotal) : '-'}
          change={recommendations && delta !== 0 ? `${inr(Math.abs(delta))} vs today` : null}
          changeTone={delta >= 0 ? 'gain' : 'loss'}
          rows={[
            { label: 'Current SIP', value: recommendations ? inr(currentTotal) : '-' },
            { label: 'Funds in plan', value: `${plan.length}` },
            { label: 'New funds', value: `${newInvestments.length}` },
          ]}
        />

        <section className="card p-5 space-y-3" aria-labelledby="claude-h">
          <div className="flex items-center justify-between">
            <p id="claude-h" className="eyebrow flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Claude</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-body">
              <span className={`w-2 h-2 rounded-full ${serviceAvailable ? 'bg-gain' : 'bg-loss'}`} aria-hidden="true" />
              {serviceAvailable ? 'Online' : 'Offline'}
            </span>
          </div>
          {isLoadingRecommendations ? (
            <p className="flex items-center gap-2 text-[14px] text-body"><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Analysing your portfolio…</p>
          ) : recommendations?.resultMessage ? (
            <p className="text-[14px] leading-[22px] text-body">{recommendations.resultMessage}</p>
          ) : null}
          {recommendationError && <Note tone="error">{recommendationError}</Note>}
          {serviceAvailable ? (
            <button type="button" onClick={onRefreshRecommendations} disabled={isLoadingRecommendations} className="pill pill-secondary w-full">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecommendations ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isLoadingRecommendations ? 'Analysing' : 'Refresh analysis'}
            </button>
          ) : (
            <button type="button" onClick={onCheckHealth} className="pill pill-secondary w-full">Check service</button>
          )}
        </section>

        <p className="px-1 text-[12px] leading-[18px] text-muted">
          AI-generated suggestions for information only, not financial advice. Past performance does not guarantee future results.
        </p>
      </aside>

      <ScrollPane toolbar={toolbar}>
      <div className="space-y-10">
        {!serviceAvailable && !isLoadingRecommendations && (
          <Note>The recommendation service is offline. Your portfolio data is still available in the other tabs.</Note>
        )}

        {/* Revised plan: Vercel's list, the reason opens in place */}
        {plan.length > 0 && !isLoadingRecommendations && (
          <section aria-labelledby="plan-h">
            <div className="pin-head flex items-baseline justify-between pb-3">
              <h2 id="plan-h" className="text-[20px] leading-[28px] text-ink">Revised SIP plan</h2>
              <span className="font-mono text-[12px] text-muted">{inr(currentTotal)}<ToArrow />{inr(revisedTotal)}</span>
            </div>
            {filtersApplied && <div className="mb-3"><Note tone="info">Showing {plan.length} of {recommendations.revisedPlan.length} funds for the active filters.</Note></div>}
            <div className="card overflow-hidden">
              <div className="hidden @xl:grid grid-cols-[minmax(0,1fr)_100px_100px_120px_16px] gap-3 px-5 h-10 items-center border-b border-line bg-surface-strong/40" aria-hidden="true">
                <span className="eyebrow">Fund</span>
                <span className="eyebrow text-right">Current</span>
                <span className="eyebrow text-right">Revised</span>
                <span className="eyebrow">Change</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {plan.map((p, idx) => {
                  const v = verdictOf(p);
                  const open = openIdx === idx;
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => p.reason && setOpenIdx(open ? null : idx)}
                        aria-expanded={p.reason ? open : undefined}
                        className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] @xl:grid-cols-[minmax(0,1fr)_100px_100px_120px_16px] gap-x-3 gap-y-1 items-center px-4 md:px-5 py-3.5 transition-colors ${p.reason ? 'cursor-pointer hover:bg-surface-strong/40' : ''} ${open ? 'bg-surface-strong/40' : ''}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-ink truncate">{shortName(p.name)}</span>
                          {p.reason && <span className="block font-mono text-[12px] text-muted truncate">{open ? 'reason below' : p.reason.toLowerCase()}</span>}
                        </span>
                        <span className="@xl:hidden text-right">
                          <span className="block num text-[14px] text-ink">{inr(p.current)}<ToArrow />{inr(v.revised)}</span>
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-body"><span className={`w-2 h-2 rounded-full ${v.dot}`} />{v.label}</span>
                        </span>
                        <span className="hidden @xl:block text-right num text-[14px] text-body">{p.current > 0 ? inr(p.current) : '-'}</span>
                        <span className={`hidden @xl:block text-right num text-[14px] ${v.tone}`}>{inr(v.revised)}</span>
                        <span className="hidden @xl:inline-flex items-center gap-1.5 text-[13px] text-body"><span className={`w-2 h-2 rounded-full ${v.dot}`} aria-hidden="true" /><span className="num">{v.label}</span></span>
                        {p.reason ? <ChevronRight className={`hidden @xl:block w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" /> : <span className="hidden @xl:block" />}
                      </button>
                      {open && <p className="px-4 md:px-5 py-4 bg-surface-strong/40 border-t border-line text-[14px] leading-[22px] text-body">{p.reason}</p>}
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-3 px-4 md:px-5 h-12 border-t border-line bg-surface-strong/40">
                <span className="text-[14px] font-medium text-ink">Total</span>
                <span className="num text-[14px] text-ink">{inr(currentTotal)}<ToArrow className="w-3.5 h-3.5" />{inr(revisedTotal)}</span>
              </div>
            </div>
          </section>
        )}

        {/* New funds: Vercel cards */}
        {newInvestments.length > 0 && !isLoadingRecommendations && (
          <section aria-labelledby="new-h">
            <div className="pin-head flex items-baseline justify-between pb-3">
              <h2 id="new-h" className="text-[20px] leading-[28px] text-ink">Funds to add</h2>
              <span className="font-mono text-[12px] text-muted">{newInvestments.length} suggested</span>
            </div>
            <div className="grid @lg:grid-cols-2 gap-4">
              {newInvestments.map((inv, idx) => (
                <article key={idx} className="card flex flex-col overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-medium text-ink">{inv.name}</h3>
                        <p className="font-mono text-[12px] text-muted">{(inv.category || '').toLowerCase()}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-body whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-gain" aria-hidden="true" />New</span>
                    </div>
                    <p className="mt-4 text-[24px] leading-none font-semibold tracking-[-0.03em] text-ink num">{inv.suggestedSip ? inr(inv.suggestedSip) : '-'}<span className="text-[13px] font-normal tracking-normal text-muted">/mo</span></p>
                    {inv.reason && <p className="mt-3 text-[14px] leading-[22px] text-body">{inv.reason}</p>}
                  </div>
                  <dl className="mt-auto border-t border-line divide-y divide-line text-[13px]">
                    <div className="flex justify-between gap-3 px-5 h-10 items-center"><dt className="text-body">Expected returns</dt><dd className="num text-ink">{inv.expectedReturns || '-'}</dd></div>
                    {inv.alternatives && <div className="flex justify-between gap-3 px-5 py-2.5"><dt className="text-body shrink-0">Alternatives</dt><dd className="text-ink text-right">{inv.alternatives}</dd></div>}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        {!recommendations && !isLoadingRecommendations && serviceAvailable && (
          <div className="rounded-xl border border-dashed border-line-strong p-12 text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-3 text-muted" aria-hidden="true" />
            <p className="text-[14px] font-medium text-ink">{recommendationError ? 'Claude could not run the analysis' : 'No recommendations yet'}</p>
            <p className="mt-1 mb-5 text-[14px] text-body">{recommendationError ? 'The details are on the left. Try again in a moment.' : 'Ask Claude to review your SIPs and suggest changes.'}</p>
            <button type="button" onClick={onRefreshRecommendations} className="pill pill-primary">{recommendationError ? 'Try again' : 'Run analysis'}</button>
          </div>
        )}

        {isLoadingRecommendations && (
          <div className="card divide-y divide-line overflow-hidden" aria-label="Loading recommendations">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 h-[60px]">
                <span className="h-3 w-40 rounded bg-surface-strong animate-pulse" />
                <span className="ml-auto h-3 w-20 rounded bg-surface-strong animate-pulse" />
              </div>
            ))}
          </div>
        )}
      </div>
      </ScrollPane>
    </div>
  );
};

export default RecommendationsView;
