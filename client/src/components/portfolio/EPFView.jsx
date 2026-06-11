import { TrendingUp, BarChart3, Wallet, Percent } from 'lucide-react';
import { formatCurrency, formatCurrentValue, formatCompact } from '../../utils/formatters';

function fmtYM(yyyyMM) {
    const [y, m] = yyyyMM.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function fmtDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function AccountCard({ acc }) {
    const totalInterest = parseFloat((acc.currentValue - acc.totalInvested).toFixed(2));
    return (
        <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{acc.label}</span>
                <span className="text-xs text-gray-500">{fmtDate(acc.startDate)} → {fmtYM(acc.calcUpTo)}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-700/50">
                    <span className="text-gray-400">Months</span>
                    <span className="font-semibold text-white">{acc.monthsContributed}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-700/50">
                    <span className="text-gray-400">Monthly</span>
                    <span className="font-semibold text-white">{formatCurrency(acc.monthlyContribution)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-700/50">
                    <span className="text-gray-400">Invested</span>
                    <span className="font-semibold text-white">{formatCurrency(acc.totalInvested)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-700/50">
                    <span className="text-gray-400">Interest</span>
                    <span className="font-semibold text-emerald-400">+{formatCurrency(totalInterest)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-700/50">
                    <span className="text-gray-400">Emp + Employer</span>
                    <span className="font-semibold text-white">
                        ₹{acc.employeeContribution.toLocaleString('en-IN')} + ₹{acc.employerContribution.toLocaleString('en-IN')}
                    </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-700/50">
                    <span className="text-gray-400">Rate</span>
                    <span className="font-semibold text-white">{acc.annualRate}% p.a.</span>
                </div>
                <div className="col-span-2 flex justify-between py-1">
                    <span className="text-gray-400 font-medium">Corpus</span>
                    <span className="font-bold text-emerald-400">{formatCurrency(acc.currentValue)}</span>
                </div>
            </div>
        </div>
    );
}

export default function EPFView({ data, isLoading, error }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
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
            <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-8 text-red-300">
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
        <div className="space-y-6">
            {/* Info banner */}
            <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 align-middle" />
                    EPFO · {accounts.length} account{accounts.length !== 1 ? 's' : ''} · {rateLabel !== '–' ? <><span className="text-green-400">Rate {rateLabel}</span> p.a.</> : 'Multiple rates'}
                </span>
                <span className="text-xs text-gray-500">
                    {accounts.length === 1
                        ? `${fmtDate(accounts[0].startDate)} → ${fmtYM(accounts[0].calcUpTo)} (${accounts[0].monthsContributed} months)`
                        : `${accounts.reduce((s, a) => s + a.monthsContributed, 0)} total months`
                    }
                </span>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wide">Total Invested</p>
                        <Wallet className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-white">{formatCompact(totalInvested)}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatCurrentValue(totalInvested)}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-2xl p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className="text-xs md:text-sm uppercase tracking-wide text-emerald-400">Current Value</p>
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-emerald-400">{formatCompact(currentValue)}</p>
                    <p className="text-xs mt-1 text-emerald-500">{formatCurrentValue(currentValue)}</p>
                </div>

                <div className={`backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-2xl border ${
                    isProfit ? 'bg-gray-900/90 border-primary/40' : 'bg-gradient-to-br from-red-900/30 to-red-800/10 border-red-700/30'
                }`}>
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className={`text-xs md:text-sm uppercase tracking-wide ${isProfit ? 'text-primary' : 'text-red-400'}`}>
                            Total Gain
                        </p>
                        <BarChart3 className={`w-4 h-4 md:w-5 md:h-5 ${isProfit ? 'text-primary' : 'text-red-400'}`} />
                    </div>
                    <p className={`text-2xl md:text-3xl font-bold ${isProfit ? 'text-primary' : 'text-red-400'}`}>
                        {formatCompact(gain)}
                    </p>
                    <p className={`text-xs mt-1 ${isProfit ? 'text-primary' : 'text-red-400'}`}>
                        {gainPercent.toFixed(2)}%
                    </p>
                </div>

                <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 md:p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                        <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wide">Interest Rate</p>
                        <Percent className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-white">{rateLabel}</p>
                    <p className="text-xs text-gray-500 mt-1">Per annum · EPFO</p>
                </div>
            </div>

            {/* Per-account breakdown */}
            <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 md:p-8">
                <h3 className="text-lg font-bold text-white mb-5">Account Breakdown</h3>
                <div className={`grid gap-4 ${accounts.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                    {accounts.map(acc => <AccountCard key={acc.id} acc={acc} />)}
                </div>

                {/* Aggregate progress bar (only when 1 account; multi-account shows per card) */}
                {accounts.length === 1 && (
                    <div className="mt-6">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                            <span>Principal ({((totalInvested / currentValue) * 100).toFixed(1)}%)</span>
                            <span>Interest ({((totalInterest / currentValue) * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-l-full transition-all duration-700"
                                style={{ width: `${(totalInvested / currentValue) * 100}%` }}
                            />
                            <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-r-full transition-all duration-700"
                                style={{ width: `${(totalInterest / currentValue) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>{formatCurrency(totalInvested)}</span>
                            <span>+{formatCurrency(totalInterest)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
