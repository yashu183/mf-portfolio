import React, { useEffect, useState } from 'react';

// Ghost loading: every page shows the shape of what is coming (the summary card on the left, then the
// lists, cards and charts it will hold) as grey blocks with a slow sheen, instead of a spinner.
// The blocks reuse the real cards' sizes, so nothing jumps when the data lands.

export const Bone = ({ className = '', style }) => <span className={`ghost ${className}`} style={style} aria-hidden="true" />;

// The left column's balance card: eyebrow, the big figure, the change line, then four rows
export const SummaryGhost = ({ rows = 4 }) => (
  <div className="card overflow-hidden">
    <div className="p-5">
      <Bone className="h-3 w-28" />
      <Bone className="mt-4 h-10 w-48" />
      <Bone className="mt-3 h-3 w-36" />
    </div>
    <div className="border-t border-line divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between px-5 h-10">
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-16" />
        </div>
      ))}
    </div>
  </div>
);

// A plain card with an eyebrow and a few lines, for the smaller left-column cards
export const NoteGhost = ({ lines = 2 }) => (
  <div className="card p-5 space-y-3">
    <Bone className="h-3 w-24" />
    {Array.from({ length: lines }, (_, i) => <Bone key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />)}
  </div>
);

// A section heading: the 20px title and the mono note at its right
export const HeadingGhost = () => (
  <div className="flex items-baseline justify-between pb-3">
    <Bone className="h-5 w-40" />
    <Bone className="h-3 w-20" />
  </div>
);

// A list card: column heads, then rows of a name with its meta line and figures on the right
export const ListGhost = ({ rows = 6, figures = 3 }) => (
  <div className="card overflow-hidden">
    <div className="hidden @xl:flex items-center gap-6 px-5 h-10 border-b border-line">
      <Bone className="h-2.5 w-12" />
      <span className="flex-1" />
      {Array.from({ length: figures }, (_, i) => <Bone key={i} className="h-2.5 w-14" />)}
    </div>
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 md:px-5 h-[68px]">
          <Bone className="w-2 h-2 rounded-full shrink-0" />
          <span className="flex-1 min-w-0 space-y-2">
            <Bone className={`h-3.5 ${i % 3 === 0 ? 'w-44' : i % 3 === 1 ? 'w-36' : 'w-52'} max-w-full`} />
            <Bone className="h-2.5 w-24" />
          </span>
          {Array.from({ length: figures }, (_, j) => (
            <Bone key={j} className={`h-3.5 w-16 ${j > 0 ? 'hidden @xl:block' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Cards in the page's grid: an icon plate and a name, the figure, a footer line
export const CardsGhost = ({ count = 3 }) => (
  <div className="grid @lg:grid-cols-2 @3xl:grid-cols-3 gap-4">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="card p-5 flex flex-col gap-4">
        <span className="flex items-center gap-3">
          <Bone className="w-8 h-8 rounded-full shrink-0" />
          <span className="flex-1 space-y-2"><Bone className="h-3.5 w-28" /><Bone className="h-2.5 w-20" /></span>
        </span>
        <Bone className="h-7 w-32" />
        <span className="pt-4 border-t border-line"><Bone className="h-2.5 w-full" /></span>
      </div>
    ))}
  </div>
);

// A chart card: bars rising from a baseline
const BARS = [45, 70, 55, 85, 40, 65, 90, 50, 75, 60, 80, 35];
export const ChartGhost = ({ height = 260 }) => (
  <div className="card p-5 md:p-6">
    <div className="flex items-end gap-3" style={{ height }}>
      {BARS.map((h, i) => <Bone key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />)}
    </div>
  </div>
);

// The page frame: the left column and the main column, as every asset page lays them out
export const PageGhost = ({ label, aside, children }) => (
  <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <aside className="space-y-4">{aside ?? <SummaryGhost />}</aside>
    <div className="@container min-w-0 space-y-10">{children}</div>
    <SlowNotice />
  </div>
);

// When a load runs long (a price source rate-limiting us, a cold server), say so instead of leaving
// the ghost blocks to look stuck. A small pill floats at the bottom of the content area (beside the 240px sidebar on desktop), so the ghost layout never moves.
const SLOW_STEPS = [
  [4000, 'Hmm… hold on. It’s taking longer than usual.'],
  [12000, 'Still on it. Prices are slow to come in right now, so we’re retrying.'],
  [25000, 'This one’s being stubborn. Hang tight, or refresh in a minute.'],
];

export const SlowNotice = () => {
  const [step, setStep] = useState(-1);
  useEffect(() => {
    const timers = SLOW_STEPS.map(([ms], i) => setTimeout(() => setStep(i), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  if (step < 0) return null;
  return (
    <p className="slow-notice fixed z-40 bottom-6 left-1/2 lg:left-[calc(50%+120px)] -translate-x-1/2 w-max max-w-[calc(100vw-32px)] card px-4 py-2.5 flex items-center gap-2.5 text-[13px] text-body shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]">
      <span className="slow-dot w-1.5 h-1.5 rounded-full bg-warn shrink-0" aria-hidden="true" />
      <span key={step} className="slow-text">{SLOW_STEPS[step][1]}</span>
    </p>
  );
};

// The allocation card: eyebrow and switch, the round chart, then its key
export const PieGhost = ({ rows = 5 }) => (
  <div className="card overflow-hidden">
    <div className="flex items-center justify-between px-5 pt-5"><Bone className="h-3 w-20" /><Bone className="h-8 w-40 rounded-md" /></div>
    <div className="px-5 py-5"><Bone className="mx-auto w-full max-w-[200px] aspect-square rounded-full" /></div>
    <div className="border-t border-line divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2 px-5 h-10">
          <Bone className="w-2 h-2 rounded-full" /><Bone className="h-3 w-24" /><span className="flex-1" /><Bone className="h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

// Lines of text still being written, e.g. Claude's analysis
export const TextGhost = ({ lines = 3 }) => (
  <span className="block space-y-2" role="status">
    <span className="sr-only">Analysing</span>
    {Array.from({ length: lines }, (_, i) => <Bone key={i} className={`h-3 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`} />)}
  </span>
);
