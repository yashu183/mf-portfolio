import React from 'react';

const toneClass = (tone) => (tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink');

// One tooltip for every chart, in Vercel's style: a small floating card, the period as a mono label,
// a row per series (swatch, label, right-aligned figure), and optional totals (one row or a list) split off by a hairline.
const ChartTooltip = ({ title, subtitle, rows = [], footer }) => (
  <div className="min-w-[200px] rounded-lg bg-surface p-3 text-[13px] shadow-[0_0_0_1px_var(--c-ring),0_1px_1px_rgb(0_0_0/0.02),0_8px_16px_-4px_rgb(0_0_0/0.08),0_24px_32px_-8px_rgb(0_0_0/0.10)]">
    {title && <p className="font-mono text-[11px] uppercase tracking-[0.02em] text-muted">{title}</p>}
    {subtitle && <p className="mt-0.5 text-[12px] text-body">{subtitle}</p>}
    {rows.length > 0 && (
      <ul className={`${title || subtitle ? 'mt-2' : ''} space-y-1.5`}>
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color && <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: row.color }} aria-hidden="true" />}
            <span className="flex-1 text-body">{row.label}</span>
            <span className={`num ${toneClass(row.tone)}`}>{row.value}</span>
          </li>
        ))}
      </ul>
    )}
    {footer && (
      <div className="mt-2 pt-2 border-t border-line space-y-1.5">
        {[].concat(footer).map((f) => (
          <div key={f.label} className="flex items-center gap-2">
            <span className="flex-1 text-body">{f.label}</span>
            <span className={`num font-medium whitespace-nowrap ${toneClass(f.tone)}`}>{f.value}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ChartTooltip;
