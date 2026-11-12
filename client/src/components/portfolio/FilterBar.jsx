import React, { useEffect, useRef } from 'react';
import Select from './Select';
import { Search, X } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'poor', label: 'Poor' },
];

const investmentTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'sip', label: 'SIP only' },
  { value: 'lumpsum', label: 'Lump sum only' },
  { value: 'both', label: 'Both' },
];

// Vercel's list toolbar: one row, the search field first (with its "/" shortcut), compact filters
// beside it, a clear action when anything is set, and room on the right for a view switch.
const FilterBar = ({ filters, onFilterChange, onClearFilters, fundCategories, hiddenFilters = [], staticFilters = [], right = null }) => {
  const searchRef = useRef(null);
  const hasActiveFilters = Boolean(filters.category || filters.status || filters.investmentType || filters.search);

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
    // below 1024px it pins under the menu bar while the page scrolls; from 1024px it sits at the
    // top of a ScrollPane, which keeps it in place and scrolls the list inside the column instead
    <div className="sticky lg:static z-20 bg-canvas py-3 -mt-3 mb-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ top: 'var(--head-h, 0px)' }}>
      {!hiddenFilters.includes('search') && (
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search funds</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search funds…"
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full h-10 bg-surface rounded-md pl-9 pr-10 text-[14px] text-ink placeholder:text-muted shadow-[0_0_0_1px_var(--c-line-strong)] focus:outline-none focus:shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)] transition-shadow"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 min-w-5 px-1.5 grid place-items-center rounded border border-line bg-surface-strong font-mono text-[11px] text-muted">/</kbd>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!hiddenFilters.includes('category') && (
          <Select className="w-[170px]" value={filters.category || ''} onChange={(v) => onFilterChange('category', v)} options={[{ value: '', label: 'All categories' }, ...fundCategories.map((c) => ({ value: c, label: c }))]} />
        )}
        {!hiddenFilters.includes('status') && (
          <Select className="w-[150px]" value={filters.status || ''} onChange={(v) => onFilterChange('status', v)} options={statusOptions} />
        )}
        {!hiddenFilters.includes('investmentType') && (
          <Select className="w-[150px]" value={filters.investmentType || ''} onChange={(v) => onFilterChange('investmentType', v)} options={investmentTypeOptions} />
        )}
        {staticFilters.map((filter) => (
          <span key={filter.label} className="inline-flex items-center h-10 px-3 rounded-md bg-surface-strong text-[13px] text-body">{filter.label}</span>
        ))}
        {hasActiveFilters && (
          <button type="button" onClick={onClearFilters} className="pill pill-secondary h-10">
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Clear
          </button>
        )}
        {right}
      </div>
    </div>
  );
};

export default FilterBar;
