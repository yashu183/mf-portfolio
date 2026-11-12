import React from 'react';
import BigAmount from './BigAmount';

const toneClass = (tone) => (tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink');

// The left-column balance card, Mercury-style: the balance as the one big thing on the page,
// a quiet line for the change beneath it, then the supporting rows kept small.
const SummaryPanel = ({ label, value, change, changeTone = 'gain', note, rows = [], children }) => (
  <section className="card overflow-hidden" aria-label={label}>
    <div className="p-5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 ${String(value).length > 13 ? 'text-[34px] leading-[40px]' : 'text-[44px] leading-[48px]'} font-semibold tracking-[-0.045em] text-ink`}>
        <BigAmount value={value} />
      </p>
      {change && (
        <p className={`mt-1.5 num text-[13px] ${changeTone === 'loss' ? 'text-loss' : 'text-gain'}`}>
          {changeTone === 'loss' ? '↓' : '↑'} {change}
        </p>
      )}
      {note && <p className="mt-0.5 text-[13px] text-muted">{note}</p>}
    </div>
    {rows.length > 0 && (
      <dl className="border-t border-line divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-5 h-10">
            <dt className="text-[13px] text-muted">{row.label}</dt>
            <dd className={`num text-[13px] ${toneClass(row.tone)}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    )}
    {children}
  </section>
);

export default SummaryPanel;
