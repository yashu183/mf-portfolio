import React from 'react';
import FundsTable from './FundsTable';

// Funds grouped by how they are doing, each group as a Mercury table under a 20px heading.
const GROUPS = [
  { id: 'excellent', title: 'Excellent', note: 'Beating their category comfortably' },
  { id: 'good', title: 'Good', note: 'Doing what they should' },
  { id: 'monitor', title: 'Monitor', note: 'Worth a look at the next review' },
  { id: 'poor', title: 'Underperforming', note: 'Candidates to pause or exit' },
];

const PerformanceView = ({ performanceGroups }) => (
  <div className="space-y-10">
    <h2 className="sr-only">Performance</h2>
    {GROUPS.map(({ id, title, note }) => {
      const funds = performanceGroups[id] ?? [];
      if (funds.length === 0) return null;
      return (
        <section key={id} aria-labelledby={`perf-${id}`}>
          <div className="flex items-baseline gap-3 mb-1">
            <h3 id={`perf-${id}`} className="text-[16px] leading-[1.5] font-semibold text-ink">{title}</h3>
            <span className="text-[14px] text-ink-2 tabular-nums">{funds.length}</span>
          </div>
          <p className="mb-4 text-[15px] text-ink-2">{note}</p>
          <FundsTable funds={[...funds].sort((a, b) => (b.xirr ?? 0) - (a.xirr ?? 0))} />
        </section>
      );
    })}
  </div>
);

export default PerformanceView;
