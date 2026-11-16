import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, LineChart, Landmark, Coins, Gem, PiggyBank, X, RotateCw, CalendarClock, Calendar } from 'lucide-react';
import FundIcon from './FundIcon';
import { Bone } from './Ghost';
import { useTheme, chartPalette } from '../../hooks/useTheme';
import { getCalendar } from '../../services/portfolioService';

// Each asset keeps its colour slot and icon from the sidebar, so a chip reads the same everywhere
const KINDS = {
  mf: { label: 'Mutual funds', short: 'Funds', slot: 0, icon: LineChart },
  fd: { label: 'Fixed deposits', short: 'FDs', slot: 1, icon: Landmark },
  epf: { label: 'EPF', short: 'EPF', slot: 2, icon: PiggyBank },
  gold: { label: 'Gold', short: 'Gold', slot: 3, icon: Coins },
  silver: { label: 'Silver', short: 'Silver', slot: 4, icon: Gem },
};
const KIND_ORDER = ['mf', 'fd', 'gold', 'silver', 'epf'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHIPS_PER_DAY = 3;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inr = (v) => `₹${Math.round(Math.abs(v ?? 0)).toLocaleString('en-IN')}`;
const compact = (v) => (v >= 1e7 ? `₹${+(v / 1e7).toFixed(2)}Cr` : v >= 1e5 ? `₹${+(v / 1e5).toFixed(2)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(1)}K` : `₹${Math.round(v)}`);
const pct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
const monthTitle = (d) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const longDate = (s) => parse(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (s) => parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const wageMonth = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };

// What a chip and a detail card call each event
const TYPE_LABEL = {
  sip: 'SIP', lumpsum: 'Lump sum', 'fd-open': 'FD opened', 'fd-renewal': 'FD renewed', 'fd-maturity': 'FD matures',
  purchase: 'Bought', contribution: 'Contribution',
};
const typeLabel = (e) => (e.type === 'fd-maturity' && !e.upcoming ? 'FD matured' : e.upcoming && e.type === 'sip' ? 'SIP due' : TYPE_LABEL[e.type]);

// One small row in a day cell: the asset's mark, a short name, the amount; upcoming ones dashed, and FD
// renewals and maturities (money moving, not going in) marked with their own icon
const Chip = ({ e, color }) => {
  const Kind = KINDS[e.kind].icon;
  const moving = e.type === 'fd-renewal' || e.type === 'fd-maturity';
  return (
    <span
      className={`flex items-center gap-1 @[88px]:gap-1.5 w-full min-w-0 overflow-hidden h-5 px-1 @[88px]:px-1.5 rounded-[5px] text-[11px] leading-none ${e.upcoming ? 'text-muted' : 'text-ink'}`}
      style={e.upcoming
        ? { boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 55%, transparent)`, backgroundImage: 'none' }
        : { background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      {/* the mark drops out in the narrowest cells, where the chip's colour says the asset and the amount needs the room */}
      <span className="hidden @[64px]:contents">
        {e.kind === 'mf' ? <FundIcon fund={{ name: e.fullName, shortName: e.name, color: e.color }} size={12} /> : moving ? <RotateCw className="w-3 h-3 shrink-0" style={{ color }} aria-hidden="true" /> : <Kind className="w-3 h-3 shrink-0" style={{ color }} aria-hidden="true" />}
      </span>
      <span className="hidden @[88px]:block truncate flex-1 min-w-0">{e.name}</span>
      <span className="num truncate ml-auto @[88px]:ml-0">{compact(e.amount)}</span>
    </span>
  );
};

// A label and a figure, as the app's detail rows
const Row = ({ label, children, tone }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <dt className="text-[13px] text-muted">{label}</dt>
    <dd className={`num text-[13px] text-right ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-ink'}`}>{children}</dd>
  </div>
);

// Everything known about one event, for the day panel
const Detail = ({ e, color }) => {
  const Kind = KINDS[e.kind].icon;
  const gainTone = e.gain == null ? undefined : e.gain >= 0 ? 'gain' : 'loss';
  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        {e.kind === 'mf'
          ? <FundIcon fund={{ name: e.fullName, shortName: e.name, color: e.color }} size={32} />
          : <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}><Kind className="w-4 h-4" style={{ color }} aria-hidden="true" /></span>}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-ink truncate">{e.name}</p>
          <p className="font-mono text-[11px] text-muted truncate">
            {typeLabel(e)}
            {e.kind === 'mf' && e.category ? ` · ${e.category.toLowerCase()}` : ''}
            {e.kind === 'fd' ? ` · ${e.holder}${e.label ? ` · ${e.label}` : ''}` : ''}
            {(e.kind === 'gold' || e.kind === 'silver') && e.set ? ` · ${e.set}` : ''}
          </p>
        </div>
        <span className={`num text-[15px] font-semibold ${e.upcoming ? 'text-muted' : 'text-ink'}`}>{inr(e.amount)}</span>
      </div>
      <dl className="mt-3 pt-2 border-t border-line">
        {e.kind === 'mf' && (e.upcoming ? (
          <Row label="Status">Scheduled, not yet paid</Row>
        ) : (
          <>
            <Row label="NAV that day">₹{e.nav?.toFixed(2)}</Row>
            <Row label="Units bought">{e.units?.toFixed(3)}</Row>
            <Row label="Worth today">{inr(e.valueNow)} <span className="text-muted">at ₹{e.latestNAV?.toFixed(2)}</span></Row>
            <Row label="Gain" tone={gainTone}>{e.gain >= 0 ? '+' : '−'}{inr(e.gain)} ({pct((e.gain / e.amount) * 100)})</Row>
          </>
        ))}
        {e.type === 'fd-open' && (
          <>
            <Row label="Principal">{inr(e.amount)}</Row>
            <Row label="Rate">{e.rate}% · {e.termDays} days</Row>
            <Row label="First maturity">{shortDate(e.maturityDate)}</Row>
            <Row label="Worth today">{inr(e.valueNow)}</Row>
          </>
        )}
        {(e.type === 'fd-renewal' || e.type === 'fd-maturity') && (
          <>
            <Row label={`Cycle ${e.cycle} of ${e.cycles}`}>{inr(e.startAmount)} at {e.rate}%</Row>
            <Row label="Interest" tone="gain">+{inr(e.interest)}</Row>
            <Row label={e.upcoming ? 'Will pay out' : 'Paid out'}>{inr(e.amount)}</Row>
            {e.type === 'fd-renewal' && <Row label="Rolled into">cycle {e.cycle + 1} at {e.nextRate}%, to {shortDate(e.nextMaturityDate)}</Row>}
          </>
        )}
        {e.type === 'purchase' && (
          <>
            <Row label="Bought">{e.grams} g at ₹{e.pricePerGram.toLocaleString('en-IN')}/g</Row>
            {e.valueNow != null ? (
              <>
                <Row label="Worth today">{inr(e.valueNow)} <span className="text-muted">at ₹{Math.round(e.todayPerGram).toLocaleString('en-IN')}/g</span></Row>
                <Row label="Gain" tone={gainTone}>{e.gain >= 0 ? '+' : '−'}{inr(e.gain)} ({pct((e.gain / e.amount) * 100)})</Row>
              </>
            ) : <Row label="Worth today">price unavailable</Row>}
          </>
        )}
        {e.kind === 'epf' && (
          <>
            <Row label="For wages of">{wageMonth(e.wageMonth)}</Row>
            <Row label="Your share">{inr(e.employee)}</Row>
            <Row label="Employer's share">{inr(e.employer)}</Row>
          </>
        )}
      </dl>
    </li>
  );
};

// Jump to a month, in the app's own style (the browser's month input can't be styled): a field showing the month
// opens a year with arrows and its twelve months; the year itself opens a scrolling list of years. Months and years
// outside the history are greyed out; This month jumps back. Escape or a click outside closes it.
const MonthPicker = ({ month, span, thisMonth, onPick, bare = false }) => {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(month.getFullYear());
  const [years, setYears] = useState(false); // the list of years instead of the months
  const ref = useRef(null);
  const yearsRef = useRef(null);
  // the list opens scrolled to the year in view
  useEffect(() => {
    if (years) yearsRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' });
  }, [years]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const firstYear = span ? Math.floor(span.first / 12) : year;
  const lastYear = span ? Math.floor(span.last / 12) : year;
  const pick = (k) => { onPick(new Date(Math.floor(k / 12), k % 12, 1)); setOpen(false); };
  const arrow = 'grid place-items-center w-7 h-7 rounded-md text-body hover:text-ink hover:bg-surface-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';
  return (
    <div ref={ref} className={bare ? 'relative flex-1 min-w-0 self-stretch' : 'relative'}>
      <button
        type="button"
        onClick={() => { setYear(month.getFullYear()); setYears(false); setOpen((o) => !o); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Go to month, now ${monthTitle(month)}`}
        className={bare
          ? `w-full h-full inline-flex items-center justify-center gap-2 text-[14px] font-medium text-ink cursor-pointer transition-colors ${open ? 'bg-surface-strong' : 'hover:bg-surface-strong/60'}`
          : `inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-md bg-surface text-[13px] text-ink cursor-pointer transition-shadow ${open ? 'shadow-[0_0_0_1px_var(--c-ink)]' : 'shadow-[0_0_0_1px_var(--c-line-strong)] hover:shadow-[0_0_0_1px_var(--c-ink)]'}`}
      >
        {monthTitle(month)}
        <Calendar className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label="Pick a month" className="absolute left-0 top-full mt-2 z-30 w-[264px] rounded-xl bg-surface p-3 shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setYear((y) => y - 1)} disabled={year <= firstYear} aria-label="Previous year" className={arrow}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
            <button
              type="button"
              onClick={() => setYears((v) => !v)}
              aria-expanded={years}
              aria-label={years ? 'Back to the months' : `Pick a year, now ${year}`}
              className={`flex-1 mx-1 h-7 rounded-md num text-[14px] font-semibold text-ink cursor-pointer transition-colors ${years ? 'bg-surface-strong' : 'hover:bg-surface-strong'}`}
            >
              {year}
            </button>
            <button type="button" onClick={() => setYear((y) => y + 1)} disabled={year >= lastYear} aria-label="Next year" className={arrow}><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
          </div>
          {years ? (
            // every year of the history, scrolling; picking one shows its months
            <div ref={yearsRef} className="grid grid-cols-3 gap-1 max-h-[148px] overflow-y-auto [scrollbar-width:thin] pr-0.5">
              {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i).map((y) => {
                const on = y === year;
                const now = y === Math.floor(thisMonth / 12);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => { setYear(y); setYears(false); }}
                    aria-pressed={on}
                    className={`h-10 rounded-md num text-[13px] transition-colors cursor-pointer
                      ${on ? 'bg-ink text-canvas font-semibold' : now ? 'text-ink font-medium shadow-[inset_0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong' : 'text-body hover:text-ink hover:bg-surface-strong'}`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          ) : (
          <div className="grid grid-cols-4 gap-1">
            {MONTHS_SHORT.map((m, i) => {
              const k = year * 12 + i;
              const off = span && (k < span.first || k > span.last);
              const on = k === monthKey(month);
              const now = k === thisMonth;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={off}
                  onClick={() => pick(k)}
                  aria-pressed={on}
                  className={`relative h-10 rounded-md text-[13px] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:text-muted/40
                    ${on ? 'bg-ink text-canvas font-semibold' : now ? 'text-ink font-medium shadow-[inset_0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong' : 'text-body hover:text-ink hover:bg-surface-strong'}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          )}
          <div className="mt-2 pt-2 border-t border-line flex items-center justify-end text-[12px]">
            <button type="button" onClick={() => pick(thisMonth)} className="h-7 px-2 rounded-md font-medium text-ink hover:bg-surface-strong cursor-pointer">This month</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Phones: a day's entries as one icon per kind (up to three), in the asset's colour, as the laptop chips mark them:
// ↻ when an FD only rolled over or matured that day, faded when everything of that kind is still to come
const KindIcons = ({ list, colorOf, size = 12 }) => {
  const kinds = KIND_ORDER.filter((k) => list.some((e) => e.kind === k)).slice(0, 3);
  return (
    <span className="flex items-center justify-center gap-1" style={{ height: size }}>
      {kinds.map((k) => {
        const mine = list.filter((e) => e.kind === k);
        const Icon = k === 'fd' && mine.every((e) => e.type === 'fd-renewal' || e.type === 'fd-maturity') ? RotateCw : KINDS[k].icon;
        return <Icon key={k} className="shrink-0" style={{ width: size, height: size, color: colorOf(k), opacity: mine.every((e) => e.upcoming) ? 0.45 : 1 }} strokeWidth={2.25} aria-hidden="true" />;
      })}
    </span>
  );
};

// what a day's entries put in (renewals, maturities and SIPs still to come aren't new money)
const daySum = (list) => (list ?? []).filter((e) => e.newMoney).reduce((s, e) => s + e.amount, 0);

// Investment calendar: every SIP, lump sum, FD, metal purchase and EPF contribution on the day it happened,
// plus FD renewals and maturities and the next SIPs due. A day opens to show each one in full.
const CalendarView = () => {
  const { theme } = useTheme();
  const pal = chartPalette(theme);
  const colorOf = (kind) => pal.series[KINDS[kind].slot];
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [picked, setPicked] = useState(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1023.98px)').matches);
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 639.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639.98px)');
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // phones: the month grid, or Outlook's week strip with the picked day's entries under it
  const [phoneView, setPhoneView] = useState('month');

  useEffect(() => {
    let live = true;
    getCalendar().then((d) => live && setData(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023.98px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // While the sheet is open on a phone the page behind it doesn't scroll: the body is pinned where it was (the
  // only lock iOS Safari respects) and put back, at the same scroll position, when it closes. Escape closes it too.
  const sheetOpen = !!picked && narrow && phoneView !== 'week';
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const key = (e) => { if (e.key === 'Escape') setPicked(null); };
    window.addEventListener('keydown', key);
    const y = window.scrollY;
    const b = document.body.style;
    const before = { position: b.position, top: b.top, left: b.left, right: b.right, overflow: b.overflow };
    Object.assign(b, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', overflow: 'hidden' });
    return () => {
      window.removeEventListener('keydown', key);
      Object.assign(b, before);
      window.scrollTo(0, y);
    };
  }, [sheetOpen]);

  // Phones: drag the sheet down to close it. The drag starts anywhere on the sheet, except inside the day's list
  // while that list is scrolled down (there a downward swipe scrolls it back up first). Let go past a third of the
  // sheet's height, or with a quick flick, and it slides away; otherwise it springs back.
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  useEffect(() => {
    const el = sheetRef.current;
    if (!sheetOpen || !el) return undefined;
    const phone = window.matchMedia('(max-width: 639.98px)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let armed = false; let drag = false; let y0 = 0; let dy = 0; let lastY = 0; let lastT = 0; let v = 0; let timer;
    const place = (d, animate) => {
      const t = animate ? 'transform 220ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease' : 'none';
      el.style.transition = t;
      el.style.transform = d ? `translateY(${d}px)` : '';
      if (scrimRef.current) {
        scrimRef.current.style.transition = t;
        scrimRef.current.style.opacity = d ? String(Math.max(0, 1 - d / el.offsetHeight)) : '';
      }
    };
    const down = (e) => {
      armed = false; drag = false;
      if (!phone.matches || e.touches.length !== 1) return;
      const list = el.querySelector('[data-sheet-scroll]');
      if (list && list.contains(e.target) && list.scrollTop > 0) return;
      armed = true; y0 = lastY = e.touches[0].clientY; lastT = e.timeStamp; dy = 0; v = 0;
    };
    const move = (e) => {
      if (!armed) return;
      const y = e.touches[0].clientY;
      if (!drag) {
        if (y < y0) { armed = false; return; } // an upward swipe scrolls the list as usual
        if (y === y0) return;
        drag = true;
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, y - y0);
      v = (y - lastY) / Math.max(1, e.timeStamp - lastT); lastY = y; lastT = e.timeStamp;
      place(dy, false);
    };
    const up = () => {
      if (!drag) { armed = false; return; }
      armed = drag = false;
      if (dy > el.offsetHeight / 3 || (v > 0.5 && dy > 24)) {
        if (still.matches) { setPicked(null); return; }
        place(el.offsetHeight, true);
        timer = setTimeout(() => setPicked(null), 200);
      } else place(0, true);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [sheetOpen]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of data?.events ?? []) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [data]);
  const span = useMemo(() => {
    const ev = data?.events ?? [];
    if (!ev.length) return null;
    return { first: monthKey(parse(ev[0].date)), last: monthKey(parse(ev[ev.length - 1].date)) };
  }, [data]);

  if (error) return <div className="card p-8 text-center text-[14px] text-body">The calendar did not load: {error}</div>;
  if (!data) {
    return (
      <div className="card p-5" aria-busy="true" aria-label="Investment calendar, loading">
        <Bone className="h-6 w-48 mb-5" />
        <div className="grid grid-cols-7 gap-px">{Array.from({ length: 35 }, (_, i) => <Bone key={i} className="h-20 rounded-none" />)}</div>
      </div>
    );
  }

  const today = data.today;
  const mk = monthKey(month);
  const canPrev = span && (narrow && phoneView === 'week' ? true : mk > span.first);
  const canNext = span && (narrow && phoneView === 'week' ? true : mk < span.last);
  const week = narrow && phoneView === 'week';
  // the week view's day: the picked one, else today in today's month, else the 1st of the month in view
  const focus = picked ?? (monthKey(parse(today)) === mk ? today : iso(new Date(month.getFullYear(), month.getMonth(), 1)));
  const focusDate = parse(focus);
  const weekStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate() - ((focusDate.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const toDay = (d) => { setPicked(iso(d)); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const go = (n) => {
    if (week) { toDay(new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate() + 7 * n)); return; }
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
    setPicked(null);
  };
  const goToday = () => { const t = parse(today); setMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setPicked(today); };

  // the month's weeks, Monday first, with the days of the months either side to fill them
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + daysIn) / 7) * 7 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - lead + 1));

  // the month in figures: new money by asset, and what is due or rolling over
  const monthEvents = [...byDay.entries()].filter(([d]) => monthKey(parse(d)) === mk).flatMap(([, list]) => list);
  const putIn = monthEvents.filter((e) => e.newMoney).reduce((s, e) => s + e.amount, 0);
  const due = monthEvents.filter((e) => e.upcoming);
  const weekEvents = weekDays.flatMap((d) => byDay.get(iso(d)) ?? []);
  const weekPutIn = weekEvents.filter((e) => e.newMoney).reduce((s, e) => s + e.amount, 0);
  const shownEvents = week ? weekEvents : monthEvents;
  const chipKinds = KIND_ORDER.map((k) => ({ k, sum: shownEvents.filter((e) => e.kind === k && e.newMoney).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.sum > 0);
  const chipDue = shownEvents.filter((e) => e.upcoming);
  const dayEvents = picked ? byDay.get(picked) ?? [] : [];
  const dayPutIn = dayEvents.filter((e) => e.newMoney).reduce((s, e) => s + e.amount, 0);

  const panel = picked && (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex items-start justify-between gap-3 pb-3 border-b border-line">
        <div>
          <p className="eyebrow">{picked === today ? 'Today' : picked > today ? 'Coming up' : 'On this day'}</p>
          <h3 className="mt-1 text-[16px] font-semibold text-ink">{longDate(picked)}</h3>
          {dayPutIn > 0 && <p className="mt-0.5 text-[13px] text-body">Put in <span className="num text-ink">{inr(dayPutIn)}</span></p>}
        </div>
        <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="grid place-items-center w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-surface-strong cursor-pointer"><X className="w-4 h-4" aria-hidden="true" /></button>
      </div>
      <div data-sheet-scroll className="mt-3 flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] -mx-1 px-1 pt-px pb-1">
        {dayEvents.length ? (
          <ul className="space-y-3">{dayEvents.map((e, i) => <Detail key={i} e={e} color={colorOf(e.kind)} />)}</ul>
        ) : (
          <p className="text-[14px] text-body">Nothing went in or came due this day.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      {/* Under the phone menu bar, whatever pins keeps a 32px band of page colour above it, so nothing shows
          between the two. Month view: the header block pins while the days scroll. Week view: the whole card
          stays put (its wrapper paints the page colour behind it, 8px wider and 1px taller than the card, so
          entries' rings don't show past its rounded corners or through its own translucent ring) and the day's entries scroll under it. */}
      <div className={week ? 'sticky z-[9] min-w-0 -mt-8 pt-8 -mx-2 px-2 -mb-px pb-px bg-canvas' : 'min-w-0'} style={week ? { top: 'var(--head-h, 0px)' } : undefined}>
      <section className="card min-w-0" aria-label="Investment calendar">
        {/* the month, its totals, the legend and the weekday row stay pinned while the days scroll under them
            (.pin-cols: the same pinned header as the fund tables, with the card's rounded top and ring) */}
        <div className={week ? '' : 'pin-cols max-lg:[--ph-h:32px]'}>
        {!week && <span className="lg:hidden absolute -top-[33px] -inset-x-2 h-8 bg-canvas pointer-events-none" aria-hidden="true" />}
        {/* the month, its arrows and Today; then what went in this month, by asset */}
        <div className="p-4 md:p-5 border-b border-line">
          {narrow ? (
            <>
              {/* one grouped control (‹ | month | ›) and Today, all 36px high; then the total and the view switch */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-stretch h-9 rounded-md bg-surface shadow-[0_0_0_1px_var(--c-line-strong)]">
                  <button type="button" onClick={() => go(-1)} disabled={!canPrev} aria-label={week ? 'Previous week' : 'Previous month'} className="grid place-items-center w-10 shrink-0 rounded-l-md border-r border-line text-body hover:text-ink hover:bg-surface-strong/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
                  <MonthPicker bare month={month} span={span} thisMonth={monthKey(parse(today))} onPick={(d) => { setMonth(d); setPicked(null); }} />
                  <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label={week ? 'Next week' : 'Next month'} className="grid place-items-center w-10 shrink-0 rounded-r-md border-l border-line text-body hover:text-ink hover:bg-surface-strong/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
                </div>
                <button type="button" onClick={goToday} className="h-9 px-3.5 rounded-md text-[14px] font-medium text-ink bg-surface shadow-[0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong cursor-pointer">Today</button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px] text-muted">{week ? 'This week' : 'Put in'} <span className="num text-[15px] font-semibold text-ink">{inr(week ? weekPutIn : putIn)}</span></p>
                <div className="inline-flex h-9 p-1 rounded-md bg-surface shadow-[0_0_0_1px_var(--c-line-strong)]" role="group" aria-label="View">
                  {[['month', 'Month'], ['week', 'Week']].map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={phoneView === id} onClick={() => { setPhoneView(id); if (id === 'week' && !picked) setPicked(focus); }} className={`px-3.5 rounded-[4px] text-[13px] font-medium cursor-pointer ${phoneView === id ? 'bg-surface-strong text-ink' : 'text-muted'}`}>{label}</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => go(-1)} disabled={!canPrev} aria-label="Previous month" className="grid place-items-center w-8 h-8 rounded-md text-body hover:text-ink hover:bg-surface-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
              <h2 className="min-w-[150px] text-center text-[17px] font-semibold text-ink" aria-live="polite">{monthTitle(month)}</h2>
              <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label="Next month" className="grid place-items-center w-8 h-8 rounded-md text-body hover:text-ink hover:bg-surface-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
            </div>
            <button type="button" onClick={goToday} className="h-8 px-3 rounded-md text-[13px] font-medium text-ink shadow-[0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong cursor-pointer">Today</button>
            <MonthPicker month={month} span={span} thisMonth={monthKey(parse(today))} onPick={(d) => { setMonth(d); setPicked(null); }} />
            <p className="ml-auto text-[13px] text-muted">Put in <span className="num text-[15px] font-semibold text-ink">{inr(putIn)}</span></p>
          </div>
          )}
          {(chipKinds.length > 0 || chipDue.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chipKinds.map(({ k, sum }) => {
                const Kind = KINDS[k].icon;
                return (
                  <span key={k} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] text-ink" style={{ background: `color-mix(in oklab, ${colorOf(k)} 14%, transparent)` }}>
                    <Kind className="w-3.5 h-3.5" style={{ color: colorOf(k) }} aria-hidden="true" />{KINDS[k].short} <span className="num">{inr(sum)}</span>
                  </span>
                );
              })}
              {chipDue.length > 0 && (
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] text-body shadow-[inset_0_0_0_1px_var(--c-line-strong)]">
                  <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />{chipDue.length} coming up · <span className="num">{inr(chipDue.reduce((s, e) => s + e.amount, 0))}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* what the marks mean, above the grid so it's in view with it */}
        <div className="px-4 md:px-5 py-2.5 border-b border-line flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
          {KIND_ORDER.map((k) => { const Icon = KINDS[k].icon; return <span key={k} className="inline-flex items-center gap-1.5"><Icon className="w-3 h-3" style={{ color: colorOf(k) }} strokeWidth={2.25} aria-hidden="true" />{KINDS[k].label}</span>; })}
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${pal.tick}` }} aria-hidden="true" />Coming up</span>
          <span className="inline-flex items-center gap-1.5"><RotateCw className="w-3 h-3" style={{ color: colorOf('fd') }} aria-hidden="true" />FD renewed or matured</span>
        </div>

        {/* phones, week view: Outlook's strip of seven days, the picked one filled, today ringed, a dot per entry */}
        {week && (
          <div className="grid grid-cols-7 px-1 py-2" role="grid" aria-label="Week">
            {weekDays.map((d) => {
              const key = iso(d);
              const list = byDay.get(key) ?? [];
              const on = key === focus;
              return (
                <button key={key} type="button" role="gridcell" aria-selected={on} aria-label={`${longDate(key)}${list.length ? `, ${list.length} ${list.length === 1 ? 'entry' : 'entries'}` : ''}`} onClick={() => toDay(d)} className="flex flex-col items-center gap-1.5 py-1 cursor-pointer">
                  <span className="font-mono text-[11px] uppercase text-muted">{WEEKDAYS[(d.getDay() + 6) % 7][0]}</span>
                  <span className={`grid place-items-center w-9 h-9 rounded-full num text-[15px] ${on ? 'bg-ink text-canvas font-semibold' : key === today ? 'text-ink shadow-[inset_0_0_0_1.5px_var(--c-ink)]' : d.getMonth() === month.getMonth() ? 'text-ink' : 'text-muted'}`}>{d.getDate()}</span>
                  <KindIcons list={list} colorOf={colorOf} size={13} />
                </button>
              );
            })}
          </div>
        )}

        {/* the grid */}
        {!week && <div className="grid grid-cols-7 border-b border-line bg-surface-strong/40">
          {WEEKDAYS.map((d) => <span key={d} className="py-2 text-center font-mono text-[11px] uppercase tracking-[0.04em] text-muted">{phone ? d[0] : d}</span>)}
        </div>}
        </div>
        {!week && <div className="grid grid-cols-7 overflow-hidden rounded-b-[12px]" role="grid" aria-label={monthTitle(month)}>
          {cells.map((d) => {
            const key = iso(d);
            const inMonth = d.getMonth() === month.getMonth();
            const list = byDay.get(key) ?? [];
            const sum = list.filter((e) => e.newMoney).reduce((s, e) => s + e.amount, 0);
            const isToday = key === today;
            const isPicked = key === picked;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={isPicked}
                aria-label={`${longDate(key)}${list.length ? `, ${list.length} ${list.length === 1 ? 'entry' : 'entries'}${sum ? `, ${inr(sum)} put in` : ''}` : ''}`}
                onClick={() => setPicked(isPicked ? null : key)}
                className={`@container relative min-w-0 text-left flex flex-col gap-1 p-1.5 md:p-2 min-h-[64px] md:min-h-[112px] overflow-hidden border-r border-b border-line [&:nth-child(7n)]:border-r-0 transition-colors cursor-pointer
                  ${inMonth ? '' : 'bg-surface-strong/25'} ${isPicked ? 'bg-surface-strong/70 shadow-[inset_0_0_0_1.5px_var(--c-ink)]' : 'hover:bg-surface-strong/40'}`}
              >
                <span className="flex items-center justify-between gap-1 min-w-0">
                  <span className={`shrink-0 grid place-items-center w-6 h-6 rounded-full text-[12px] num ${isToday ? 'bg-ink text-canvas font-semibold' : inMonth ? 'text-ink' : 'text-muted/60'}`}>{d.getDate()}</span>
                  {!phone && sum > 0 && <span className="hidden @[80px]:block min-w-0 truncate num text-[11px] text-muted">{compact(sum)}</span>}
                </span>
                {phone ? (
                  // phones: an icon per kind of entry; the day opens for the rest
                  list.length > 0 && <span className={`px-0.5 ${inMonth ? '' : 'opacity-50'}`}><KindIcons list={list} colorOf={colorOf} /></span>
                ) : (
                  <span className={`flex flex-col gap-0.5 w-full min-w-0 ${inMonth ? '' : 'opacity-50'}`}>
                    {list.slice(0, CHIPS_PER_DAY).map((e, i) => <Chip key={i} e={e} color={colorOf(e.kind)} />)}
                    {list.length > CHIPS_PER_DAY && <span className="px-1.5 text-[11px] text-muted whitespace-nowrap truncate">+{list.length - CHIPS_PER_DAY}<span className="hidden @[80px]:inline"> more</span></span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>}

      </section>
      </div>

      {/* desktop: the day's entries beside the grid; with no day picked, how to use it */}
      {!narrow && (
        <aside className="lg:sticky lg:top-[calc(var(--sb-h,0px)+1px)] lg:max-h-[calc(100vh-var(--head-h,0px)-96px)] lg:flex lg:flex-col lg:overflow-hidden lg:p-px lg:-m-px">
          {panel || (
            <div className="card p-5">
              <p className="eyebrow">This month</p>
              <p className="mt-2 text-[14px] text-body">Pick a day to see what went in: each SIP and lump sum with the NAV it bought at and what it's worth today, FDs opened, renewed or maturing, gold and silver bought, and EPF contributions.</p>
              {monthEvents.length > 0 && (
                <dl className="mt-3 pt-2 border-t border-line">
                  <Row label="Entries">{monthEvents.length}</Row>
                  <Row label="Put in">{inr(putIn)}</Row>
                  {due.length > 0 && <Row label="Coming up">{inr(due.reduce((s, e) => s + e.amount, 0))}</Row>}
                </dl>
              )}
            </div>
          )}
        </aside>
      )}

      {/* phones, week view: the picked day's entries in full, under the strip, as Outlook's day under its week */}
      {week && (
        <section aria-label={longDate(focus)}>
          <div className="flex items-baseline justify-between gap-3 px-1 mb-3">
            <h3 className="text-[16px] font-semibold text-ink">{longDate(focus)}</h3>
            {(daySum(byDay.get(focus)) > 0) && <span className="num text-[13px] text-body">{inr(daySum(byDay.get(focus)))}</span>}
          </div>
          {(byDay.get(focus) ?? []).length ? (
            <ul className="space-y-3">{byDay.get(focus).map((e, i) => <Detail key={i} e={e} color={colorOf(e.kind)} />)}</ul>
          ) : (
            <p className="card p-5 text-[14px] text-body">Nothing went in or came due this day.</p>
          )}
        </section>
      )}

      {/* phones and tablets, month view: the day opens as a sheet from the bottom */}
      {narrow && !week && picked && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row" role="dialog" aria-modal="true" aria-label={longDate(picked)}>
          <button ref={scrimRef} type="button" className="absolute inset-0 bg-black/40 cursor-default" aria-label="Close" onClick={() => setPicked(null)} />
          <div ref={sheetRef} className="relative flex flex-col max-h-[80vh] overflow-hidden rounded-t-2xl bg-canvas px-4 pt-4 pb-6 shadow-[0_-1px_0_var(--c-line-strong)]
            sm:max-h-none sm:h-full sm:w-[min(420px,85vw)] sm:rounded-none sm:px-5 sm:pt-6 sm:shadow-[-1px_0_0_var(--c-line-strong),var(--c-shadow-float)]">
            <span className="sm:hidden shrink-0 block mx-auto mb-3 w-10 h-1 rounded-full bg-line-strong" aria-hidden="true" />
            {panel}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default CalendarView;
