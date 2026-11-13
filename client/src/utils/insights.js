// Plain-words facts about a split, shared by the allocation cards and the PDF report.
// Every insight is { label, value, note? }: a short label, the figure, and a mono line under it.
// None of them carries a rupee amount, so they stay readable when amounts are hidden.

const pct = (v) => `${v.toFixed(2)}%`;
const xirrPct = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;
const signedPct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;

// Assets that move with the market, and the ones that pay a set rate
const MARKET_LINKED = new Set(['mutualFunds', 'gold', 'silver']);

/**
 * Insights for the whole portfolio, by asset class.
 * assets: [{ id, label, invested, current }] (the ones with holdings)
 */
export function assetInsights(assets) {
  const held = assets.filter((a) => a.current > 0);
  const total = held.reduce((s, a) => s + a.current, 0);
  if (!held.length || total <= 0) return [];
  const share = (v) => (v / total) * 100;
  const out = [];

  const top = [...held].sort((a, b) => b.current - a.current)[0];
  out.push({ label: 'Largest holding', value: top.label, note: `${pct(share(top.current))} of the portfolio` });

  const market = held.filter((a) => MARKET_LINKED.has(a.id)).reduce((s, a) => s + a.current, 0);
  out.push({ label: 'Market-linked', value: pct(share(market)), note: `${pct(100 - share(market))} in FDs & EPF` });

  const withReturn = held.filter((a) => a.invested > 0).map((a) => ({ ...a, ret: ((a.current - a.invested) / a.invested) * 100 }));
  if (withReturn.length) {
    const best = [...withReturn].sort((a, b) => b.ret - a.ret)[0];
    out.push({ label: 'Best return', value: best.label, note: `${signedPct(best.ret)} on what went in` });
  }

  const gains = held.map((a) => ({ ...a, gain: a.current - a.invested })).filter((a) => a.gain > 0);
  const totalGain = gains.reduce((s, a) => s + a.gain, 0);
  if (gains.length && totalGain > 0) {
    const driver = [...gains].sort((a, b) => b.gain - a.gain)[0];
    out.push({ label: 'Most of the gain', value: driver.label, note: `${pct((driver.gain / totalGain) * 100)} of all gains` });
  }
  return out;
}

/**
 * Insights for mutual funds: what the category split alone doesn't say. Where the returns and the
 * gains come from, where new SIP money is going, how concentrated the money is, and how much needs review.
 * funds: the fund rows ({ shortName, category, currentValue, totalInvested, xirr, currentMonthlySIP, status })
 */
export function fundInsights(funds) {
  const held = funds.filter((f) => (f.currentValue || 0) > 0);
  const total = held.reduce((s, f) => s + f.currentValue, 0);
  if (!held.length || total <= 0) return [];
  const share = (v) => (v / total) * 100;
  const out = [];

  // XIRR per category weighted by value: a big fund counts for more than a small one
  const cats = Object.values(held.reduce((acc, f) => {
    const c = (acc[f.category] ??= { name: f.category, value: 0, weighted: 0, gain: 0, sip: 0 });
    c.value += f.currentValue;
    c.weighted += (f.xirr ?? 0) * f.currentValue;
    c.gain += f.currentValue - (f.totalInvested || 0);
    c.sip += f.currentMonthlySIP || 0;
    return acc;
  }, {})).map((c) => ({ ...c, xirr: c.weighted / c.value }));

  if (cats.length > 1) {
    const byXirr = [...cats].sort((a, b) => b.xirr - a.xirr);
    out.push({ label: 'Best avg XIRR', value: byXirr[0].name, note: `${xirrPct(byXirr[0].xirr)} a year` });
    const worst = byXirr[byXirr.length - 1];
    out.push({ label: 'Weakest avg XIRR', value: worst.name, note: `${xirrPct(worst.xirr)} a year` });
  }

  const gains = cats.filter((c) => c.gain > 0);
  const totalGain = gains.reduce((s, c) => s + c.gain, 0);
  if (totalGain > 0) {
    const top = [...gains].sort((a, b) => b.gain - a.gain)[0];
    out.push({ label: 'Most of the gain', value: top.name, note: `${pct((top.gain / totalGain) * 100)} of all gains` });
  }

  // where this month's SIP goes against where the money sits: the way the portfolio is tilting
  const totalSip = cats.reduce((s, c) => s + c.sip, 0);
  if (totalSip > 0) {
    const tilt = cats.map((c) => ({ ...c, sipPct: (c.sip / totalSip) * 100, valPct: share(c.value) }))
      .sort((a, b) => (b.sipPct - b.valPct) - (a.sipPct - a.valPct))[0];
    if (tilt.sipPct - tilt.valPct > 2) {
      out.push({ label: 'SIPs flowing to', value: tilt.name, note: `${pct(tilt.sipPct)} vs ${pct(tilt.valPct)} held` });
    }
  }

  const biggest = [...held].sort((a, b) => b.currentValue - a.currentValue)[0];
  out.push({ label: 'Largest fund', value: biggest.shortName || biggest.name, note: `${pct(share(biggest.currentValue))} of fund value` });

  const review = held.filter((f) => f.status === 'monitor' || f.status === 'poor');
  out.push(review.length
    ? { label: 'To review', value: `${review.length} of ${held.length} funds`, note: `${pct(share(review.reduce((s, f) => s + f.currentValue, 0)))} of value` }
    : { label: 'To review', value: 'None', note: 'every fund on track' });
  return out;
}

/** Fund rows grouped by category: [{ category, invested, current, count }] sorted by current value. */
export const groupByCategory = (funds) => Object.values(funds.reduce((acc, f) => {
  const c = (acc[f.category] ??= { category: f.category, invested: 0, current: 0, count: 0 });
  c.invested += f.totalInvested || 0;
  c.current += f.currentValue || 0;
  c.count += 1;
  return acc;
}, {})).sort((a, b) => b.current - a.current);
