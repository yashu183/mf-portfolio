import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, Scale, BarChart3, IndianRupee } from 'lucide-react';
import { formatCurrency, formatCurrentValue, formatCompact } from '../../utils/formatters';

export default function GoldSilverView({ metal, data, isLoading, error }) {
    const enrichedHoldings = useMemo(() => {
        if (!data?.holdings) return [];
        return data.holdings.map(h => ({ ...h, currentPricePerGram: data.pricePerGram }));
    }, [data]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
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
            <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-8 text-red-300">
                {error}
            </div>
        );
    }

    if (!data) return null;

    const { totals, pricePerGram, fetchedAt } = data;
    const isTotalProfit = totals.totalGain >= 0;
    const metalLabel = metal === 'gold' ? 'Gold' : 'Silver';
    return (
        <div className="space-y-6">
            {/* Live price banner */}
            <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-green-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 align-middle" /> Live {metalLabel} Price:{' '}
                    <span className="text-green-400">{formatCurrency(pricePerGram)}/g</span>
                </span>
                {fetchedAt && (
                    <span className="text-xs text-gray-500">
                        Fetched {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Total Quantity */}
                <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wide">Total Quantity</p>
                        <Scale className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-white">{totals.totalQuantity} g</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {totals.totalQuantity >= 1000
                            ? `${(totals.totalQuantity / 1000).toFixed(3)} kg`
                            : `${totals.totalQuantity} grams`}
                    </p>
                </div>

                {/* Total Invested */}
                <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wide">Total Invested</p>
                        <IndianRupee className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-white">{formatCompact(totals.totalInvested)}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatCurrency(totals.totalInvested)}</p>
                </div>

                {/* Current Value */}
                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-2xl p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className="text-xs md:text-sm uppercase tracking-wide text-emerald-400">Current Value</p>
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-emerald-400">{formatCompact(totals.totalCurrentValue)}</p>
                    <p className="text-xs mt-1 text-emerald-500">{formatCurrentValue(totals.totalCurrentValue)}</p>
                </div>

                {/* Total Gain / Loss */}
                <div className={`backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-2xl border ${
                    isTotalProfit
                        ? 'bg-gray-900/90 border-primary/40'
                        : 'bg-gradient-to-br from-red-900/30 to-red-800/10 border-red-700/30'
                }`}>
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className={`text-xs md:text-sm uppercase tracking-wide ${isTotalProfit ? 'text-primary' : 'text-red-400'}`}>
                            Total Gain / Loss
                        </p>
                        <BarChart3 className={`w-4 h-4 md:w-5 md:h-5 ${isTotalProfit ? 'text-primary' : 'text-red-400'}`} />
                    </div>
                    <p className={`text-2xl md:text-3xl font-bold ${isTotalProfit ? 'text-primary' : 'text-red-400'}`}>
                        {formatCompact(totals.totalGain)}
                    </p>
                    <p className={`text-xs mt-1 ${isTotalProfit ? 'text-primary' : 'text-red-400'}`}>
                        {totals.totalGainPercent.toFixed(2)}%
                    </p>
                </div>
            </div>

            {/* Holding cards */}
            {enrichedHoldings.length === 0 ? (
                <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-10 text-center text-gray-500">
                    <p className="font-medium text-white mb-1">No {metalLabel} holdings found</p>
                    <p className="text-sm">Add entries under <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-primary">"{metal}"</code> in portfolioConfig.json</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {enrichedHoldings.map((h) => {
                        const isProfit = h.gain >= 0;
                        return (
                            <div key={h.id} className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden">
                                {/* Card header */}
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 md:p-6 border-b border-gray-800/60">
                                    <div className="min-w-0">
                                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-1">{metalLabel}</p>
                                        <p className="text-lg md:text-xl font-bold text-primary">{h.label}</p>
                                        <div className="flex flex-wrap gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Calendar size={11} />
                                                {new Date(h.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Scale size={11} />
                                                {h.quantity} g
                                            </span>
                                            <span className="text-xs text-gray-600">{h.holdingDays}d held</span>
                                        </div>
                                    </div>
                                    <div className="sm:text-right shrink-0">
                                        <p className="text-xs text-gray-500 mb-1">Current Value</p>
                                        <p className="text-lg md:text-2xl font-bold text-primary">{formatCurrentValue(h.currentValue)}</p>
                                        <div className={`flex items-center gap-1 justify-end mt-1 text-xs font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                            {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {h.gainPercent.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Price + value detail */}
                                <div className="p-4 md:p-6 space-y-4">
                                    {/* Price row */}
                                    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                                        <div className="flex-1 min-w-[120px] shrink-0 bg-black/40 rounded-xl p-3 text-center">
                                            <p className="text-xs text-gray-500 mb-1">Buy Price/g</p>
                                            <p className="text-sm font-bold text-white">{formatCurrency(h.purchasePrice)}</p>
                                        </div>
                                        <div className="flex items-center shrink-0 text-gray-700 text-base px-0.5">›</div>
                                        <div className="flex-1 min-w-[120px] shrink-0 bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 text-center">
                                            <p className="text-xs text-emerald-400 mb-1">Current/g</p>
                                            <p className="text-sm font-bold text-emerald-400">{formatCurrency(h.currentPricePerGram)}</p>
                                        </div>
                                        <div className="flex items-center shrink-0 text-gray-700 text-base px-0.5">›</div>
                                        <div className={`flex-1 min-w-[120px] shrink-0 rounded-xl p-3 text-center border ${
                                            isProfit
                                                ? 'bg-primary/10 border-primary/30'
                                                : 'bg-red-900/20 border-red-700/30'
                                        }`}>
                                            <p className={`text-xs mb-1 ${isProfit ? 'text-primary' : 'text-red-400'}`}>Gain/Loss</p>
                                            <p className={`text-sm font-bold ${isProfit ? 'text-primary' : 'text-red-400'}`}>
                                                {formatCompact(h.gain)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Invested vs value row */}
                                    <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-gray-800/60">
                                        <div>
                                            <p className="text-gray-500 mb-0.5">Invested</p>
                                            <p className="text-white font-medium">{formatCompact(h.totalInvested)}</p>
                                            <p className="text-gray-600">{formatCurrentValue(h.totalInvested)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-gray-500 mb-0.5">Gain / Loss</p>
                                            <p className={`font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {formatCompact(h.gain)}
                                            </p>
                                            <p className={isProfit ? 'text-emerald-600' : 'text-red-600'}>
                                                {formatCurrentValue(h.gain)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}


function SummaryTile({ label, headline, subtitle, positive, neutral }) {
    const headlineColor =
        neutral ? 'text-[var(--primary)]' :
        positive ? 'text-emerald-600' :
        'text-red-500';

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-xl font-bold ${headlineColor}`}>{headline}</p>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
    );
}

function HoldingCard({ holding, metal }) {
    const isProfit = holding.gain >= 0;
    const metalColor = metal === 'gold' ? 'from-yellow-50 to-amber-50 border-yellow-200' : 'from-gray-50 to-slate-100 border-slate-200';
    const accentColor = metal === 'gold' ? 'text-amber-600' : 'text-slate-500';

    return (
        <div className={`bg-gradient-to-br ${metalColor} rounded-xl border p-4 shadow-sm`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                <div>
                    <h3 className={`font-semibold text-gray-800 text-base`}>{holding.label}</h3>
                    <div className="flex flex-wrap gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar size={11} />
                            {new Date(holding.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Scale size={11} />
                            {holding.quantity} g
                        </span>
                        <span className={`text-xs font-medium ${accentColor}`}>
                            {holding.holdingDays}d held
                        </span>
                    </div>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold self-start
                    ${isProfit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isProfit ? '+' : ''}{holding.gainPercent.toFixed(2)}%
                </div>
            </div>

            {/* Price row */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Buy Price/g</p>
                    <p className="text-sm font-semibold text-gray-700">{formatCurrency(holding.purchasePrice)}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Current/g</p>
                    <p className="text-sm font-semibold text-gray-700">{formatCurrency(holding.currentPricePerGram ?? 0)}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Qty</p>
                    <p className="text-sm font-semibold text-gray-700">{holding.quantity} g</p>
                </div>
            </div>

            {/* Value row */}
            <div className="flex items-center justify-between pt-3 border-t border-white/60">
                <div>
                    <p className="text-[10px] text-gray-400">Invested</p>
                    <p className="text-sm font-bold text-gray-700">{formatCompact(holding.totalInvested)}</p>
                    <p className="text-[10px] text-gray-400">{formatCurrentValue(holding.totalInvested)}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-gray-400">Current Value</p>
                    <p className="text-sm font-bold text-gray-800">{formatCompact(holding.currentValue)}</p>
                    <p className="text-[10px] text-gray-400">{formatCurrentValue(holding.currentValue)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-400">Gain / Loss</p>
                    <p className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}{formatCompact(holding.gain)}
                    </p>
                    <p className={`text-[10px] ${isProfit ? 'text-emerald-500' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}{formatCurrentValue(holding.gain)}
                    </p>
                </div>
            </div>
        </div>
    );
}

