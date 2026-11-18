import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// A date field in the app's own style (the browser's date popup can't be styled), built like the Calendar's month
// picker: a field showing the date opens, right below it in the form (so a short sheet scrolls to it, never clips it), a month of days, Monday first, with arrows; the month's title opens a
// scrolling list of years. Days outside min/max are greyed out; Today jumps back. Escape or a click outside closes it.
// value, min and max are 'YYYY-MM-DD'; onChange gets the same.

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => iso(new Date());
const show = (s) => parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const title = (y, m) => new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const DatePicker = ({ value, onChange, min, max, placeholder = 'Pick a date' }) => {
  const [open, setOpen] = useState(false);
  const start = value || (max && max < todayIso() ? max : todayIso());
  const [view, setView] = useState(() => ({ y: parse(start).getFullYear(), m: parse(start).getMonth() }));
  const [years, setYears] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);
  const yearsRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // inside the Add sheet's scrolling form, bring the whole popup into view
    popRef.current?.scrollIntoView({ block: 'nearest' });
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key, true); };
  }, [open]);
  useEffect(() => {
    if (years) yearsRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' });
  }, [years]);

  const toggle = () => {
    const d = parse(start);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setYears(false);
    setOpen((o) => !o);
  };
  const off = (s) => (min && s < min) || (max && s > max);
  const pick = (s) => { if (off(s)) return; onChange(s); setOpen(false); };
  const step = (n) => setView(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  // the month's weeks, Monday first, padded with the neighbouring months' days
  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const weeks = Math.ceil((lead + new Date(view.y, view.m + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(view.y, view.m, 1 - lead + i));

  const today = todayIso();
  const minY = min ? parse(min).getFullYear() : parse(today).getFullYear() - 30;
  const maxY = max ? parse(max).getFullYear() : parse(today).getFullYear() + 10;
  const prevOff = min && iso(new Date(view.y, view.m, 0)) < min;
  const nextOff = max && iso(new Date(view.y, view.m + 1, 1)) > max;
  const arrow = 'grid place-items-center w-7 h-7 rounded-md text-body hover:text-ink hover:bg-surface-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full h-10 flex items-center justify-between gap-2 bg-surface rounded-md px-3 text-[16px] sm:text-[14px] cursor-pointer transition-shadow focus:outline-none ${value ? 'text-ink' : 'text-muted'} ${open ? 'shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)]' : 'shadow-[0_0_0_1px_var(--c-line-strong)] hover:shadow-[0_0_0_1px_var(--c-muted-soft)] focus-visible:shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)]'}`}
      >
        <span className="num truncate">{value ? show(value) : placeholder}</span>
        <Calendar className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
      </button>
      {open && (
        // preventDefault keeps a click inside from reaching the Field's <label> and toggling the field again
        <div
          ref={popRef}
          role="dialog"
          aria-label="Pick a date"
          onClick={(e) => e.preventDefault()}
          className="mt-2 w-full max-w-[320px] rounded-xl bg-surface p-3 shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => step(-1)} disabled={years || prevOff} aria-label="Previous month" className={arrow}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
            <button
              type="button"
              onClick={() => setYears((v) => !v)}
              aria-expanded={years}
              aria-label={years ? 'Back to the days' : `Pick a year, now ${title(view.y, view.m)}`}
              className={`flex-1 mx-1 h-7 rounded-md text-[14px] font-semibold text-ink cursor-pointer transition-colors ${years ? 'bg-surface-strong' : 'hover:bg-surface-strong'}`}
            >
              {years ? view.y : title(view.y, view.m)}
            </button>
            <button type="button" onClick={() => step(1)} disabled={years || nextOff} aria-label="Next month" className={arrow}><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
          </div>

          {years ? (
            <div ref={yearsRef} className="grid grid-cols-3 gap-1 max-h-[232px] overflow-y-auto [scrollbar-width:thin] pr-0.5">
              {Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i).map((y) => {
                const on = y === view.y;
                const now = y === parse(today).getFullYear();
                return (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      // keep the month, pulled inside min/max
                      let m = view.m;
                      if (min && iso(new Date(y, m + 1, 0)) < min) m = parse(min).getMonth();
                      if (max && iso(new Date(y, m, 1)) > max) m = parse(max).getMonth();
                      setView({ y, m });
                      setYears(false);
                    }}
                    className={`h-10 rounded-md num text-[13px] transition-colors cursor-pointer
                      ${on ? 'bg-ink text-canvas font-semibold' : now ? 'text-ink font-medium shadow-[inset_0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong' : 'text-body hover:text-ink hover:bg-surface-strong'}`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-1" aria-hidden="true">
                {WEEKDAYS.map((w, i) => <span key={i} className="h-7 grid place-items-center text-[11px] font-medium text-muted">{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((d) => {
                  const s = iso(d);
                  const inMonth = d.getMonth() === view.m;
                  const on = s === value;
                  const now = s === today;
                  const disabled = off(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(s)}
                      aria-pressed={on}
                      aria-label={d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      className={`h-9 rounded-md num text-[13px] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:text-muted/40 disabled:hover:bg-transparent
                        ${on ? 'bg-ink text-canvas font-semibold' : now ? 'text-ink font-medium shadow-[inset_0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong' : inMonth ? 'text-body hover:text-ink hover:bg-surface-strong' : 'text-muted/60 hover:text-ink hover:bg-surface-strong'}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-2 pt-2 border-t border-line flex items-center justify-end text-[12px]">
            <button type="button" disabled={off(today)} onClick={() => pick(today)} className="h-7 px-2 rounded-md font-medium text-ink hover:bg-surface-strong cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">Today</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
