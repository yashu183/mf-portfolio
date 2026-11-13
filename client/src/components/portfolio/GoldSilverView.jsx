import { PageGhost, SummaryGhost, NoteGhost, HeadingGhost, ChartGhost, CardsGhost, ListGhost } from './Ghost';
import SummaryPanel from './SummaryPanel';
import { PANE, usePinCols } from './ScrollPane';
import { useMemo } from 'react';
import MetalSetsSection from './MetalSetsSection';
import { SortHead, useSort } from './Sort';

const SORT_BY = {
    holding: (h) => h.label,
    quantity: (h) => h.quantity,
    price: (h) => h.purchasePrice,
    invested: (h) => h.totalInvested,
    current: (h) => h.currentValue,
    gain: (h) => h.gain,
};
import { formatCurrency, formatCurrentValue, formatCompact, heldFor } from '../../utils/formatters';

// Holding, Quantity, Bought at, Invested, Current, Gain
const HOLDING_COLS = 'grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)]';

export default function GoldSilverView({ metal, data, isLoading, error }) {
    const colsRef = usePinCols();
    const enrichedHoldings = useMemo(() => {
        if (!data?.holdings) return [];
        return data.holdings.map(h => ({ ...h, currentPricePerGram: data.pricePerGram }));
    }, [data]);
    const sorted = useSort(enrichedHoldings, SORT_BY);
    const head = { sort: sorted.sort, onSort: sorted.toggle };

    if (isLoading) return (
            <PageGhost label={`Loading ${metal}`} aside={<><SummaryGhost /><NoteGhost /></>}>
                <section><HeadingGhost /><ChartGhost height={220} /></section>
                <CardsGhost count={3} />
                <section><HeadingGhost /><ListGhost rows={5} figures={5} /></section>
            </PageGhost>
        );

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
                    { label: 'Avg buy price', value: totals.totalQuantity > 0 ? `${formatCurrency(totals.totalInvested / totals.totalQuantity)}/g` : '-' },
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
            <div className="pin-head flex items-baseline justify-between pb-3 mb-0">
                <h2 className="text-[20px] leading-[28px] text-ink">{metalLabel} holdings</h2>
                <span className="font-mono text-[12px] text-muted">{enrichedHoldings.length} holdings</span>
            </div>
            {enrichedHoldings.length === 0 ? (
                <div className="card p-10 text-center text-slate">
                    <p className="font-medium text-ink mb-1">No {metalLabel} holdings found</p>
                    <p className="text-sm">Add entries under <code className="text-xs bg-ink/5 px-1.5 py-0.5 rounded text-primary">"{metal}"</code> in portfolioConfig.json</p>
                </div>
            ) : (
                <div className="card">
                    {/* the same grid list as the other tables (a sticky header can't stop early inside a <table>);
                        sideways scroll only when it doesn't fit, since a scroll box would stop the header pinning */}
                    <div role="table" aria-label={`${metalLabel} holdings`} className="overflow-x-auto rounded-[12px] @[760px]:overflow-x-visible">
                        <div className="min-w-[760px]">
                            <div ref={colsRef} role="row" className={`pin-cols grid ${HOLDING_COLS} items-center h-[52px]`}>
                                <SortHead label="Holding" k="holding" className="pl-4 md:pl-6 pr-3" {...head} />
                                <SortHead label="Quantity" k="quantity" align="right" className="px-3" {...head} />
                                <SortHead label="Bought at" k="price" align="right" className="px-3" {...head} />
                                <SortHead label="Invested" k="invested" align="right" className="px-3" {...head} />
                                <SortHead label="Current" k="current" align="right" className="px-3" {...head} />
                                <SortHead label="Gain/Loss" k="gain" align="right" className="pl-3 pr-4 md:pr-6" {...head} />
                            </div>
                            <ul role="rowgroup" className="divide-y divide-line overflow-clip rounded-b-[12px]">
                                {sorted.rows.map((h) => {
                                    const up = h.gain >= 0;
                                    return (
                                        <li key={h.id} role="row" className={`grid ${HOLDING_COLS} items-center py-4 hover:bg-ink/[0.02] transition-colors`}>
                                            <div role="cell" className="pl-4 md:pl-6 pr-3 min-w-0">
                                                <p className="text-[15px] text-ink" style={{ fontWeight: 600 }}>{h.label}</p>
                                                <p className="text-[13px] text-slate">
                                                    {new Date(h.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {h.holdingDays != null ? ` · ${heldFor(h.purchaseDate)} held` : ''}
                                                </p>
                                            </div>
                                            <div role="cell" className="px-3 text-right text-[15px] text-ink-2 tabular-nums">{h.quantity} g</div>
                                            <div role="cell" className="px-3 text-right text-[15px] text-ink-2 tabular-nums">{formatCurrency(h.purchasePrice)}<span className="text-slate">/g</span></div>
                                            <div role="cell" className="px-3 text-right text-[15px] text-ink-2 tabular-nums">{formatCurrency(h.totalInvested)}</div>
                                            <div role="cell" className="px-3 text-right text-[15px] text-ink tabular-nums">{formatCurrentValue(h.currentValue)}</div>
                                            <div role="cell" className={`pl-3 pr-4 md:pr-6 text-right tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
                                                <p className="text-[15px]">{up ? '+' : '−'}{formatCurrency(Math.abs(h.gain))}</p>
                                                <p className="text-[13px]">{up ? '' : '−'}{Math.abs(h.gainPercent ?? 0).toFixed(2)}%</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            </section>
          </div>
        </div>
    );
}
