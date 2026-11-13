import React from 'react';
import FundsTable, { STATUS } from './FundsTable';
import InfoTip from './InfoTip';

// Funds grouped by how they are doing, each group as a Mercury table under a 20px heading.
const GROUPS = [
  // the notes say what the rule means in plain words; the info icon beside each heading gives the exact rule
  { id: 'excellent', title: 'Excellent', note: 'Compounding at 15% a year or more' },
  { id: 'good', title: 'Good', note: 'Compounding at 12 to 15% a year' },
  { id: 'monitor', title: 'Monitor', note: 'Under 12% a year, or too new to judge' },
  { id: 'poor', title: 'Underperforming', note: 'Worth less than what went in: pause or exit' },
];

const PerformanceView = ({ performanceGroups, view = 'list' }) => (
  <div className="space-y-10">
    <h2 className="sr-only">Performance</h2>
    {GROUPS.map(({ id, title, note }) => {
      // ranked by XIRR as their own order, so a column sort can always come back to it
      const funds = [...(performanceGroups[id] ?? [])].sort((a, b) => (b.xirr ?? 0) - (a.xirr ?? 0));
      if (funds.length === 0) return null;
      return (
        <section key={id} aria-labelledby={`perf-${id}`}>
          <div className="pin-head pb-4">
            <div className="flex items-center gap-3 mb-1">
              <h3 id={`perf-${id}`} className="text-[16px] leading-[1.5] font-semibold text-ink">{title}</h3>
              <span className="text-[14px] text-ink-2 tabular-nums">{funds.length}</span>
              <InfoTip label={`How a fund counts as ${title}`} className="ml-auto">
                <span className="block font-medium text-ink mb-0.5">{title}</span>{STATUS[id].rule}
              </InfoTip>
            </div>
            <p className="text-[15px] text-ink-2">{note}</p>
          </div>
          <FundsTable funds={funds} view={view} />
        </section>
      );
    })}
  </div>
);

export default PerformanceView;
