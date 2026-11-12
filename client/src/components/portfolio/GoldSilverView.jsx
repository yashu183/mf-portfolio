import SummaryPanel from './SummaryPanel';
import { PANE } from './ScrollPane';
import { useMemo } from 'react';
import MetalSetsSection from './MetalSetsSection';
import { formatCurrency, formatCurrentValue, formatCompact } from '../../utils/formatters';

// "2 yrs 3 mo 10 days" from the purchase date to today, dropping the parts that are zero.
const heldFor = (from) => {
    const start = new Date(from);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();
    if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years -= 1; months += 12; }
    const parts = [
        years && `${years} ${years === 1 ? 'yr' : 'yrs'}`,
        months && `${months} mo`,
        days && `${days} ${days === 1 ? 'day' : 'days'}`,
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : 'under a day';
};


export default function GoldSilverView({ metal, data, isLoading, error }) {
    const enrichedHoldings = useMemo(() => {
        if (!data?.holdings) return [];
        return data.holdings.map(h => ({ ...h, currentPricePerGram: data.pricePerGram }));
    }, [data]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-ink-2">
                <svg className="animate-spin h-6 w-6 mr-3 text-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Fetching live {metal} prices…
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

    const { totals, pricePerGram, fetchedAt } = data;
    const isTotalProfit = totals.totalGain >= 0;
    const metalLabel = metal === 'gold' ? 'Gold' : 'Silver';
    return (
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <aside className="space-y-4 lg:sticky lg:top-[calc(var(--head-h,0px)+32px)] lg:max-h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto [scrollbar-width:none] lg:p-px lg:-m-px">
            <SummaryPanel
                label={`${metalLabel} balance`}
                value={formatCurrentValue(totals.totalCurrentValue)}
                change={`${formatCurrency(Math.abs(totals.totalGain))} (${Math.abs(totals.totalGainPercent).toFixed(2)}%) all time`}
                changeTone={isTotalProfit ? 'gain' : 'loss'}
                rows={[
                    { label: 'Quantity', value: `${totals.totalQuantity} g` },
                    { label: 'Invested', value: formatCompact(totals.totalInvested) },
                    { label: 'Avg buy price', value: totals.totalQuantity > 0 ? `${formatCurrency(totals.totalInvested / totals.totalQuantity)}/g` : '—' },
                    { label: 'Gain', value: formatCompact(totals.totalGain), tone: isTotalProfit ? 'gain' : 'loss' },
                ]}
            />
            <section className="card p-5" aria-label="Live price">
                <p className="eyebrow flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gain" aria-hidden="true" /> Live price</p>
                <p className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-ink num">{formatCurrency(pricePerGram)}<span className="text-[13px] font-normal text-muted">/g</span></p>
                <p className="mt-1 font-mono text-[12px] text-muted">
                    {fetchedAt ? `fetched ${new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · bullions.co.in` : 'bullions.co.in'}
                </p>
            </section>
          </aside>

          <div className={`min-w-0 space-y-10 ${PANE}`}>
            <MetalSetsSection sets={data.sets} pricePerGram={pricePerGram} metalLabel={metalLabel} />

            {/* Holdings, as a transactions table */}
            <section className="space-y-3">
            <div className="flex items-baseline justify-between">
                <h2 className="text-[20px] leading-[28px] text-ink">{metalLabel} holdings</h2>
                <span className="font-mono text-[12px] text-muted">{enrichedHoldings.length} holdings</span>
            </div>
            {enrichedHoldings.length === 0 ? (
                <div className="card p-10 text-center text-slate">
                    <p className="font-medium text-ink mb-1">No {metalLabel} holdings found</p>
                    <p className="text-sm">Add entries under <code className="text-xs bg-ink/5 px-1.5 py-0.5 rounded text-primary">"{metal}"</code> in portfolioConfig.json</p>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left">
                            <thead>
                                <tr className="border-b border-line">
                                    <th scope="col" className="eyebrow py-4 pl-4 md:pl-6 pr-3 font-medium">Holding</th>
                                    <th scope="col" className="eyebrow py-4 px-3 text-right font-medium">Quantity</th>
                                    <th scope="col" className="eyebrow py-4 px-3 text-right font-medium">Bought at</th>
                                    <th scope="col" className="eyebrow py-4 px-3 text-right font-medium">Invested</th>
                                    <th scope="col" className="eyebrow py-4 px-3 text-right font-medium">Current</th>
                                    <th scope="col" className="eyebrow py-4 pl-3 pr-4 md:pr-6 text-right font-medium">Gain</th>
                                </tr>
                            </thead>
                            <tbody>
                                {enrichedHoldings.map((h) => {
                                    const up = h.gain >= 0;
                                    return (
                                        <tr key={h.id} className="border-b border-line last:border-0 hover:bg-ink/[0.02] transition-colors">
                                            <td className="py-4 pl-4 md:pl-6 pr-3">
                                                <p className="text-[15px] text-ink" style={{ fontWeight: 600 }}>{h.label}</p>
                                                <p className="text-[13px] text-slate">
                                                    {new Date(h.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {h.holdingDays != null ? ` · ${heldFor(h.purchaseDate)} held` : ''}
                                                </p>
                                            </td>
                                            <td className="py-4 px-3 text-right text-[15px] text-ink-2 tabular-nums">{h.quantity} g</td>
                                            <td className="py-4 px-3 text-right text-[15px] text-ink-2 tabular-nums">{formatCurrency(h.purchasePrice)}<span className="text-slate">/g</span></td>
                                            <td className="py-4 px-3 text-right text-[15px] text-ink-2 tabular-nums">{formatCurrency(h.totalInvested)}</td>
                                            <td className="py-4 px-3 text-right text-[15px] text-ink tabular-nums">{formatCurrentValue(h.currentValue)}</td>
                                            <td className={`py-4 pl-3 pr-4 md:pr-6 text-right tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
                                                <p className="text-[15px]">{up ? '+' : '−'}{formatCurrency(Math.abs(h.gain))}</p>
                                                <p className="text-[13px]">{up ? '' : '−'}{Math.abs(h.gainPercent ?? 0).toFixed(2)}%</p>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </section>
          </div>
        </div>
    );
}
