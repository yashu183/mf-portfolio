import SummaryPanel from './SummaryPanel';
import { PANE } from './ScrollPane';
import { formatCurrency, formatCurrentValue, formatCompact } from '../../utils/formatters';
import ToArrow from './ToArrow';

// "2026-09" -> "Sep'26"
function fmtYM(yyyyMM) {
    const [y, m] = yyyyMM.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return `${d.toLocaleDateString('en-IN', { month: 'short' })}'${String(y).slice(-2)}`;
}

// "2021-09-01" -> "Sep'21"
function fmtDate(iso) {
    return fmtYM(iso.slice(0, 7));
}

// the month before a "YYYY-MM": where one contribution rate ends and the next begins
function prevYM(yyyyMM) {
    const [y, m] = yyyyMM.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// One EPF account as a Vercel card: identity row, a details grid, the principal/interest split,
// then contribution history as list rows with a state and the months each rate ran.
function AccountCard({ acc }) {
    const totalInterest = parseFloat((acc.currentValue - acc.totalInvested).toFixed(2));
    const principalPct = acc.currentValue > 0 ? (acc.totalInvested / acc.currentValue) * 100 : 100;
    const details = [
        ['Monthly', formatCurrency(acc.monthlyContribution)],
        ['Employee + employer', `₹${acc.employeeContribution.toLocaleString('en-IN')} + ₹${acc.employerContribution.toLocaleString('en-IN')}`],
        ['Rate', `${acc.annualRate}% p.a.`],
        ['Months', `${acc.monthsContributed}`],
        ['Contributed', formatCurrency(acc.totalInvested)],
        ['Interest', `+${formatCurrency(totalInterest)}`, 'text-gain'],
    ];
    const revisions = acc.contributionRevisions || [];

    return (
        <article className="card overflow-hidden">
            <header className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-gain shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        <h3 className="text-[14px] font-medium text-ink truncate">{acc.label}</h3>
                        <p className="font-mono text-[12px] text-muted">{fmtDate(acc.startDate)}<ToArrow />{fmtYM(acc.calcUpTo)} · {acc.monthsContributed} months</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="num text-[18px] font-semibold tracking-[-0.02em] text-ink">{formatCurrency(acc.currentValue)}</p>
                    <p className="num text-[12px] text-gain">+{formatCurrency(totalInterest)}</p>
                </div>
            </header>

            <dl className="grid grid-cols-2 md:grid-cols-3 border-t border-line">
                {details.map(([label, value, tone], i) => (
                    <div key={label} className={`px-5 py-3 border-line ${i % 2 === 1 ? 'border-l' : ''} md:border-l-0 ${i % 3 !== 0 ? 'md:border-l' : ''} ${i >= 2 ? 'border-t' : ''} ${i < 3 ? 'md:border-t-0' : 'md:border-t'}`}>
                        <dt className="eyebrow">{label}</dt>
                        <dd className={`mt-1 num text-[14px] ${tone || 'text-ink'}`}>{value}</dd>
                    </div>
                ))}
            </dl>

            <div className="px-5 py-4 border-t border-line">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-strong" aria-hidden="true">
                    <span className="bg-ink" style={{ width: `${principalPct}%` }} />
                    <span className="bg-gain border-l-2 border-surface" style={{ width: `${100 - principalPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[12px] text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ink" aria-hidden="true" />contributed {principalPct.toFixed(1)}%</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gain" aria-hidden="true" />interest {(100 - principalPct).toFixed(1)}%</span>
                </div>
            </div>

            {revisions.length > 0 && (
                <div className="border-t border-line">
                    <p className="eyebrow px-5 pt-4 pb-2">Contribution history</p>
                    <ul className="divide-y divide-line border-t border-line">
                        {revisions.slice().reverse().map((r, i, list) => {
                            const idx = revisions.length - 1 - i;
                            const next = revisions[idx + 1];
                            const isUpcoming = r.from > acc.calcUpTo;
                            const isCurrent = !isUpcoming && (!next || next.from > acc.calcUpTo);
                            const until = next ? (next.from > acc.calcUpTo ? acc.calcUpTo : prevYM(next.from)) : acc.calcUpTo;
                            const prevTotal = revisions[idx - 1]?.total;
                            const diff = prevTotal != null ? r.total - prevTotal : 0;
                            const state = isUpcoming ? { label: 'Upcoming', dot: 'bg-warn' } : isCurrent ? { label: 'Current', dot: 'bg-link' } : { label: 'Earlier', dot: 'bg-muted' };
                            return (
                                <li key={r.from} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_100px_auto] gap-x-4 items-center px-5 py-3">
                                    <div className="min-w-0">
                                        <p className="font-mono text-[13px] text-ink">{isUpcoming ? `from ${fmtYM(r.from)}` : <>{fmtYM(r.from)}<ToArrow />{isCurrent ? 'now' : fmtYM(until)}</>}</p>
                                        <p className="font-mono text-[12px] text-muted">₹{r.employeeContribution.toLocaleString('en-IN')} + ₹{r.employerContribution.toLocaleString('en-IN')}</p>
                                    </div>
                                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-body"><span className={`w-2 h-2 rounded-full ${state.dot}`} aria-hidden="true" />{state.label}</span>
                                    <div className="text-right">
                                        <p className="num text-[14px] text-ink">{formatCurrency(r.total)}<span className="text-[12px] font-normal text-muted">/mo</span></p>
                                        {diff !== 0 && <p className={`flex justify-end gap-2 num text-[12px] whitespace-nowrap ${diff > 0 ? 'text-gain' : 'text-loss'}`}><span>{diff > 0 ? '+' : '−'}₹{Math.abs(diff).toLocaleString('en-IN')}</span><span className="opacity-80">({diff > 0 ? "↑" : "↓"} {Math.abs((diff / prevTotal) * 100).toFixed(1)}%)</span></p>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </article>
    );
}

export default function EPFView({ data, isLoading, error }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-ink-2">
                <svg className="animate-spin h-6 w-6 mr-3 text-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading EPF data…
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-loss/10 border border-loss/30 rounded-xl p-8 text-loss">
                {error}
            </div>
        );
    }

    if (!data) return null;

    const { accounts = [], totalInvested, currentValue, gain, gainPercent } = data;
    const isProfit = gain >= 0;
    const totalInterest = parseFloat((currentValue - totalInvested).toFixed(2));

    // For the rate tile: show common rate if all accounts share the same, else "–"
    const rates = [...new Set(accounts.map(a => a.annualRate))];
    const rateLabel = rates.length === 1 ? `${rates[0]}%` : '–';

    return (
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <aside className="lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
            <SummaryPanel
                label="EPF balance"
                value={formatCurrency(currentValue)}
                change={`${formatCurrency(Math.abs(totalInterest))} (${gainPercent.toFixed(2)}%) interest`}
                changeTone={isProfit ? 'gain' : 'loss'}
                rows={[
                    { label: 'Contributed', value: formatCompact(totalInvested) },
                    { label: 'Interest', value: formatCompact(totalInterest), tone: isProfit ? 'gain' : 'loss' },
                    { label: 'Rate', value: rateLabel !== '–' ? `${rateLabel} p.a.` : 'Mixed' },
                    { label: 'Accounts', value: `${accounts.length}` },
                ]}
            />
          </aside>
          <div className={`min-w-0 ${PANE}`}>
            {/* Accounts */}
            <section aria-labelledby="epf-accounts-h">
                <div className="pin-head flex items-baseline justify-between pb-3">
                    <h2 id="epf-accounts-h" className="text-[20px] leading-[28px] text-ink">Accounts</h2>
                    <span className="font-mono text-[12px] text-muted">{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</span>
                </div>
                <div className="space-y-4">
                    {accounts.map(acc => <AccountCard key={acc.id} acc={acc} />)}
                </div>
            </section>
          </div>
        </div>
    );
}
