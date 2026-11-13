import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

// Click a column head to sort by it: numbers start high to low, words A to Z; a second click flips
// it, a third goes back to the list's own order. `accessors` maps a column key to a row's value; keep it
// stable (module scope or memoised) so the list isn't re-sorted on every render.
export const useSort = (rows, accessors, initial = null) => {
  const [sort, setSort] = useState(initial);

  const sorted = useMemo(() => {
    const get = sort && accessors[sort.key];
    if (!get) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null || Number.isNaN(x)) return y == null || Number.isNaN(y) ? 0 : 1; // blanks always last
      if (y == null || Number.isNaN(y)) return -1;
      return (typeof x === 'string' ? x.localeCompare(y, 'en', { sensitivity: 'base' }) : x - y) * dir;
    });
  }, [rows, accessors, sort]);

  const toggle = (key) => setSort((s) => {
    const sample = rows.map(accessors[key]).find((v) => v != null);
    const first = typeof sample === 'string' ? 'asc' : 'desc';
    if (s?.key !== key) return { key, dir: first };
    if (s.dir === first) return { key, dir: first === 'asc' ? 'desc' : 'asc' };
    return initial;
  });

  return { rows: sorted, sort, toggle };
};

// A column head that sorts: the eyebrow caption with a small arrow. Right-aligned heads put the
// arrow on the left so their caption stays flush with the figures under it.
export const SortHead = ({ label, k, sort, onSort, align = 'left', className = '' }) => {
  const active = sort?.key === k;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  const right = align === 'right';
  return (
    <span role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`flex min-w-0 ${right ? 'justify-end' : align === 'center' ? 'justify-center' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`group relative eyebrow inline-flex items-center gap-1 -mx-1 px-1 h-6 rounded cursor-pointer transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong ${right ? 'flex-row-reverse' : ''} ${active ? 'text-ink' : ''}`}
      >
        <span className="truncate">{label}</span>
        {/* a centred head hangs its arrow outside the caption, so the caption itself sits on the column's centre */}
        <Icon className={`w-3 h-3 shrink-0 transition-opacity ${align === 'center' ? 'absolute left-full' : ''} ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-70 group-focus-visible:opacity-70'}`} aria-hidden="true" />
      </button>
    </span>
  );
};
