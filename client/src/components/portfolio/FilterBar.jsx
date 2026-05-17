import React from 'react';
import { Search, Filter, X } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onClearFilters, fundCategories, hiddenFilters = [], staticFilters = [] }) => {
  const hasActiveFilters = filters.category || filters.status || filters.investmentType || filters.search;

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'monitor', label: 'Monitor' },
    { value: 'poor', label: 'Poor' },
  ];

  const investmentTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'sip', label: 'SIP Only' },
    { value: 'lumpsum', label: 'Lumpsum Only' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-white">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        {!hiddenFilters.includes('search') && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search funds..."
              value={filters.search || ''}
              onChange={(e) => onFilterChange('search', e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        )}

        {/* Category Filter */}
        {!hiddenFilters.includes('category') && (
          <select
            value={filters.category || ''}
            onChange={(e) => onFilterChange('category', e.target.value)}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="">All Categories</option>
            {fundCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        {!hiddenFilters.includes('status') && (
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {/* Investment Type Filter */}
        {!hiddenFilters.includes('investmentType') && (
          <select
            value={filters.investmentType || ''}
            onChange={(e) => onFilterChange('investmentType', e.target.value)}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            {investmentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Static Filters Display */}
      {staticFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/50">
          <span className="text-xs text-gray-400 my-auto">Always active:</span>
          {staticFilters.map((filter, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
              {filter.label}
            </span>
          ))}
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/50">
          <span className="text-xs text-gray-400 my-auto">Active filters:</span>
          {!hiddenFilters.includes('search') && filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              Search: "{filters.search}"
              <button
                onClick={() => onFilterChange('search', '')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {!hiddenFilters.includes('category') && filters.category && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {filters.category}
              <button
                onClick={() => onFilterChange('category', '')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {!hiddenFilters.includes('status') && filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {statusOptions.find(s => s.value === filters.status)?.label}
              <button
                onClick={() => onFilterChange('status', '')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {!hiddenFilters.includes('investmentType') && filters.investmentType && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {investmentTypeOptions.find(t => t.value === filters.investmentType)?.label}
              <button
                onClick={() => onFilterChange('investmentType', '')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
