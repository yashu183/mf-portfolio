import React from 'react';

// Plain-words facts about an allocation, in the summary panel's row style: the label on the left, the
// figure on the right with a mono line under it. At the foot of its chart's card, or `standalone` as a card.
const Insights = ({ items, standalone = false }) => {
  if (!items?.length) return null;
  return (
    <div className={standalone ? 'card overflow-hidden' : 'border-t border-line'}>
      <p className="eyebrow px-5 pt-4 pb-2">Insights</p>
      <dl className="divide-y divide-line border-t border-line">
        {items.map((it) => (
          <div key={it.label} className="flex items-start justify-between gap-4 px-5 py-2.5">
            <dt className="shrink-0 whitespace-nowrap text-[13px] text-muted pt-px">{it.label}</dt>
            <dd className="min-w-0 text-right">
              <span className="block text-[13px] text-ink truncate">{it.value}</span>
              {it.note && <span className="block font-mono text-[11px] text-muted">{it.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default Insights;
