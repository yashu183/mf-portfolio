import React, { useEffect, useRef } from 'react';
import Select from './Select';
import { STATUS } from './FundsTable';
import { Search, X } from 'lucide-react';

// each status carries its rule, shown by an info icon in the menu
const statusOptions = [
  { value: '', label: 'All statuses' },
  ...['excellent', 'good', 'monitor', 'poor'].map((value) => ({ value, label: STATUS[value].label, hint: STATUS[value].rule })),
];

const investmentTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'sip', label: 'SIP' },
  { value: 'lumpsum', label: 'Lump sum' },
];

// Vercel's list toolbar: one row, the search field first (with its "/" shortcut), compact filters
// beside it, a clear action when anything is set, and room on the right for a view switch.
// `selects` swaps the fund dropdowns for others ([{ key, options, className }]); `searchLabel` names what the search finds.
const FilterBar = ({ filters, onFilterChange, onClearFilters, fundCategories = [], hiddenFilters = [], staticFilters = [], right = null, summary = null, selects = null, searchLabel = 'funds' }) => {
  const searchRef = useRef(null);
  const hasActiveFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));

  useEffect(() => {
    if (hiddenFilters.includes('search')) return undefined;
    const onKey = (event) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if (event.key === '/' && !typing) { event.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hiddenFilters]);

  return (
    // it sits in a ScrollPane's toolbar, which keeps it in place while the list scrolls. It lays out
    // by its own width, not the window's: beside the 300px column at 1024px the bar is narrow, so
    // the search takes its own row and the filters wrap under it
    <div className={`@container ${summary || hasActiveFilters ? 'mb-3' : 'mb-6'}`}>
    <div className="flex flex-col @2xl:flex-row @2xl:items-center gap-2">
      {!hiddenFilters.includes('search') && (
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search {searchLabel}</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            placeholder={`Search ${searchLabel}…`}
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full h-10 bg-surface rounded-md pl-9 pr-10 text-[14px] text-ink placeholder:text-muted shadow-[0_0_0_1px_var(--c-line-strong)] focus:outline-none focus:shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)] transition-shadow"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 min-w-5 px-1.5 grid place-items-center rounded border border-line bg-surface-strong font-mono text-[11px] text-muted">/</kbd>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {selects?.map(({ key, options, className = 'w-[160px]' }) => (
          <Select key={key} multiple className={className} value={filters[key] || []} onChange={(v) => onFilterChange(key, v)} options={options} />
        ))}
        {!selects && !hiddenFilters.includes('category') && (
          <Select multiple className="w-[170px]" value={filters.category || []} onChange={(v) => onFilterChange('category', v)} options={[{ value: '', label: 'All categories' }, ...fundCategories.map((c) => ({ value: c, label: c }))]} />
        )}
        {!selects && !hiddenFilters.includes('status') && (
          <Select multiple className="w-[150px]" value={filters.status || []} onChange={(v) => onFilterChange('status', v)} options={statusOptions} />
        )}
        {!selects && !hiddenFilters.includes('investmentType') && (
          <Select multiple className="w-[150px]" value={filters.investmentType || []} onChange={(v) => onFilterChange('investmentType', v)} options={investmentTypeOptions} />
        )}
        {staticFilters.map((filter) => (
          <span key={filter.label} className="inline-flex items-center h-10 px-3 rounded-md bg-surface-strong text-[13px] text-body">{filter.label}</span>
        ))}
        {right}
      </div>
    </div>
    {/* the result count, and clearing as a quiet link beside it rather than another control in the row */}
    {(summary || hasActiveFilters) && (
      <p className="mt-3 flex items-center gap-2 h-5 font-mono text-[12px] text-muted">
        {summary}
        {hasActiveFilters && (
          <>
            {summary && <span aria-hidden="true">·</span>}
            <button type="button" onClick={onClearFilters} className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-[3px] hover:decoration-ink transition-colors cursor-pointer">
              <X className="w-3 h-3" aria-hidden="true" />clear filters
            </button>
          </>
        )}
      </p>
    )}
    </div>
  );
};

export default FilterBar;
