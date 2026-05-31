export const CYCLE_PALETTE = [
  { bg: 'bg-primary/10',    border: 'border-primary/25',    label: 'text-primary/60',    bar: 'bg-primary',    text: 'text-primary'    },
  { bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   label: 'text-blue-400/60',   bar: 'bg-blue-500',   text: 'text-blue-400'   },
  { bg: 'bg-teal-500/10',   border: 'border-teal-500/25',   label: 'text-teal-400/60',   bar: 'bg-teal-500',   text: 'text-teal-400'   },
  { bg: 'bg-violet-500/10', border: 'border-violet-500/25', label: 'text-violet-400/60', bar: 'bg-violet-500', text: 'text-violet-400' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/25', label: 'text-orange-400/60', bar: 'bg-orange-500', text: 'text-orange-400' },
];

export const parseLocalDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const fdDate = (str, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  parseLocalDate(str).toLocaleDateString('en-IN', opts);

export const fdMonYY = (str) => {
  const d = parseLocalDate(str);
  const dd = d.toLocaleDateString('en-IN', { day: '2-digit' });
  const mon = d.toLocaleDateString('en-IN', { month: 'short' });
  const yy = d.toLocaleDateString('en-IN', { year: '2-digit' });
  return `${dd} ${mon}'${yy}`;
};
