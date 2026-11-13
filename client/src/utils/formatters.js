const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const currentValueFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (amount) => currencyFormatter.format(amount);
export const formatCurrentValue = (amount) => currentValueFormatter.format(amount);

/** Compact headline format: ₹17.01L, ₹2.35Cr, ₹42K */
export const formatCompact = (amount) => {
  if (amount < 0) return `−${formatCompact(-amount)}`;
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000)      return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${Math.round(amount)}`;
};

/** "2 yrs 3 mo 10 days" from a date to today, dropping the parts that are zero. */
export const heldFor = (from, to = new Date()) => {
  if (!from) return '-';
  const start = new Date(from);
  const now = new Date(to);
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return 'not started';
  const parts = [
    years && `${years} ${years === 1 ? 'yr' : 'yrs'}`,
    months && `${months} mo`,
    days && `${days} ${days === 1 ? 'day' : 'days'}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'today';
};

/** The day a fund's first money went in: its earliest SIP start or lump sum. */
export const fundSince = (fund) => {
  const dates = [
    ...(fund?.sips ?? []).map((s) => s.startDate),
    ...(fund?.lumpsums ?? []).map((l) => l.date),
  ].filter(Boolean).map((d) => new Date(d).getTime()).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates)) : null;
};

/** How long a fund has been held, as "4 yrs 5 mo 12 days". */
export const fundAge = (fund) => {
  const since = fundSince(fund);
  return since ? heldFor(since) : `${fund?.investmentAge ?? 0} mo`;
};

/** A count of months as "3 yrs 10 mo". */
export const monthsAsYears = (n) => {
  const y = Math.floor((n ?? 0) / 12);
  const m = (n ?? 0) % 12;
  return [y && `${y} ${y === 1 ? 'yr' : 'yrs'}`, (m || !y) && `${m} mo`].filter(Boolean).join(' ');
};
