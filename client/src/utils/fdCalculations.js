export const parseLocalDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const fdDate = (str, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  parseLocalDate(str).toLocaleDateString('en-IN', opts);

// "2025-01-18" -> "Jan'25"
export const fdMonthYY = (str) => {
  const d = parseLocalDate(str);
  return `${d.toLocaleDateString('en-IN', { month: 'short' })}'${d.toLocaleDateString('en-IN', { year: '2-digit' })}`;
};

export const fdMonYY = (str) => {
  const d = parseLocalDate(str);
  const dd = d.toLocaleDateString('en-IN', { day: '2-digit' });
  const mon = d.toLocaleDateString('en-IN', { month: 'short' });
  const yy = d.toLocaleDateString('en-IN', { year: '2-digit' });
  return `${dd} ${mon}'${yy}`;
};
