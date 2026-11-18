import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, ChevronDown, LineChart, Coins, Gem, Landmark, AlertCircle } from 'lucide-react';
import Sheet from './portfolio/Sheet';
import DatePicker from './portfolio/DatePicker';
import { useTheme, chartPalette } from '../hooks/useTheme';
import { getEntryOptions, addEntry } from '../services/portfolioService';
import { IS_DEMO } from '../utils/demo';

// The Add sheet: puts a lumpsum, a SIP (or its stop), a gold or silver purchase, a new FD or an FD's
// renewal into portfolioConfig.json from the app, so nothing has to be edited by hand on the Pi.
// Opened from the navigation (the sidebar's Add entry, the phone bar's +).

// What can be added, grouped by asset; each group keeps its asset's colour slot and icon from the sidebar
const GROUPS = [
  { label: 'Mutual funds', short: 'Funds', icon: LineChart, slot: 0, kinds: [['lumpsum', 'Lumpsum'], ['sip', 'New SIP'], ['sip-stop', 'Stop SIP']] },
  { label: 'Gold & silver', short: 'Metals', icon: Coins, slot: 3, kinds: [['gold', 'Gold'], ['silver', 'Silver']] },
  { label: 'Fixed deposits', short: 'FDs', icon: Landmark, slot: 1, kinds: [['fd', 'New FD'], ['fd-renewal', 'Renew FD']] },
];
const KIND_KEY = 'vesta:add-kind';

// ─── Small helpers ────────────────────────────────────────────────────────────
const inr = (v) => `₹${(Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-IN')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nice = (s) => (s ? parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const monthYear = (s) => parse(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const num = (v) => (v === '' || v == null ? NaN : Number(v));
const positive = (v) => Number.isFinite(num(v)) && num(v) > 0;

// "Gold Bar-11" → "Gold Bar-12": the next name in the highest-numbered series, else blank
function nextName(names, fallback = '') {
  let best = null;
  for (const n of names) {
    const m = /^(.*?)(\d+)$/.exec(n ?? '');
    if (m && (!best || Number(m[2]) > best.n || (Number(m[2]) === best.n && n.length > best.prefix.length))) best = { prefix: m[1], n: Number(m[2]) };
  }
  return best ? `${best.prefix}${best.n + 1}` : fallback;
}
// The FD's interest the way the app accrues it: quarterly compounding over whole quarters (364-day
// year), simple interest for the days after. The bank's own figure differs by a little, so it's a hint.
function fdInterest(principal, rate, days) {
  const r = rate / 100;
  const q = Math.floor(days / 91);
  const rest = days - q * 91;
  return Math.round(principal * Math.pow(1 + r / 4, q) * (1 + r * (rest / 364)) - principal);
}
// "2L - 444 d", the way FDs are labelled by hand
function fdLabel(principal, days) {
  const p = num(principal);
  if (!positive(p) || !positive(days)) return '';
  const short = p >= 1e5 ? `${+(p / 1e5).toFixed(2)}L` : p >= 1e3 ? `${+(p / 1e3).toFixed(1)}K` : String(p);
  return `${short} - ${days} d`;
}

// ─── Fields ───────────────────────────────────────────────────────────────────
// 16px on phones so iOS doesn't zoom into the field; the app's 14px from 640px
const CONTROL = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none w-full h-10 bg-surface rounded-md px-3 text-[16px] sm:text-[14px] text-ink placeholder:text-muted shadow-[0_0_0_1px_var(--c-line-strong)] focus:outline-none focus:shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)] transition-shadow';

const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block mb-1.5 text-[13px] font-medium text-ink">{label}</span>
    {children}
    {hint && <span className="block mt-1.5 text-[12px] leading-[17px] text-muted">{hint}</span>}
  </label>
);

const Input = ({ prefix, suffix, ...props }) => (
  <span className="relative block">
    {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted pointer-events-none">{prefix}</span>}
    <input {...props} className={`${CONTROL} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-14' : ''}`} />
    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted pointer-events-none">{suffix}</span>}
  </span>
);
const Money = (props) => <Input prefix="₹" type="number" inputMode="decimal" min="0" step="any" placeholder="0" {...props} />;
const DateInput = ({ onChange, ...props }) => <DatePicker {...props} onChange={(v) => onChange({ target: { value: v } })} />;

// The phone's own picker (the wheel on iOS) beats a custom menu inside a sheet
const Picker = ({ value, onChange, options, placeholder }) => (
  <span className="relative block">
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${CONTROL} appearance-none pr-9 cursor-pointer ${value === '' ? 'text-muted' : ''}`}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
  </span>
);

// A line of worked-out figures under a form ("Total ₹1,48,000", "Matures on 25 Jun 2027")
const Note = ({ children }) => <p className="rounded-md bg-surface-strong px-3 py-2.5 text-[13px] leading-[19px] text-body">{children}</p>;
const Fig = ({ children }) => <span className="num text-ink">{children}</span>;

// ─── The forms ────────────────────────────────────────────────────────────────
// Each kind: its starting values, whether it can be saved, the body to send, and a sentence for the button row.
function blank(kind, opts) {
  const today = opts.today;
  switch (kind) {
    case 'lumpsum': return { fundId: '', amount: '', date: today };
    case 'sip': return { fundId: '', amount: '', startDate: today };
    case 'sip-stop': return { fundId: '', sipIndex: '', stopDate: today };
    case 'gold':
    case 'silver': {
      const m = opts[kind];
      const newSet = nextName(m.sets, 'set-1');
      return { label: nextName(m.labels, ''), set: '__new', newSet, purchaseDate: today, quantity: '', purchasePrice: '' };
    }
    case 'fd': return { name: opts.fdNames[0] ?? '', bank: opts.fdBanks[0] ?? '', principal: '', startDate: today, termDays: '', rate: '', interestBank: '', label: '', labelEdited: false };
    case 'fd-renewal': return { fdId: '', termDays: '', rate: '', interestBank: '' };
    default: return {};
  }
}

const AddEntrySheet = ({ onClose }) => {
  const { theme } = useTheme();
  const pal = chartPalette(theme);
  const [opts, setOpts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [kind, setKind] = useState(() => {
    try { return localStorage.getItem(KIND_KEY) || 'lumpsum'; } catch { return 'lumpsum'; }
  });
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    let live = true;
    getEntryOptions().then((o) => { if (live) setOpts(o); }).catch((e) => live && setLoadError(e.message));
    return () => { live = false; };
  }, []);
  // a fresh form when the options arrive, and in the same render as a new kind (so a form never meets
  // the last kind's fields)
  useEffect(() => {
    if (opts) setF(blank(kind, opts));
  }, [opts]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id) => {
    setKind(id); setError(null);
    if (opts) setF(blank(id, opts));
    try { localStorage.setItem(KIND_KEY, id); } catch { /* private window */ }
  };

  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const fund = opts?.funds.find((x) => String(x.id) === String(f?.fundId));
  const fd = opts?.fds.find((x) => String(x.id) === String(f?.fdId));
  const fundsWithSips = opts?.funds.filter((x) => x.sips.length) ?? [];

  // What each kind sends, and a sentence saying what it will do
  const plan = useMemo(() => {
    if (!opts || !f) return null;
    switch (kind) {
      case 'lumpsum': return {
        ready: fund && positive(f.amount) && f.date,
        body: { fundId: Number(f.fundId), amount: num(f.amount), date: f.date },
        says: fund && positive(f.amount) && <>Adds <Fig>{inr(f.amount)}</Fig> to {fund.name} on {nice(f.date)}.</>,
      };
      case 'sip': return {
        ready: fund && positive(f.amount) && f.startDate,
        body: { fundId: Number(f.fundId), amount: num(f.amount), startDate: f.startDate },
        says: fund && positive(f.amount) && <>Starts <Fig>{inr(f.amount)}</Fig> a month in {fund.name} from {monthYear(f.startDate)}.</>,
      };
      case 'sip-stop': {
        const sip = fund?.sips.find((s) => String(s.index) === String(f.sipIndex));
        return {
          ready: sip && f.stopDate && f.stopDate >= sip.startDate,
          body: { fundId: Number(f.fundId), sipIndex: Number(f.sipIndex), stopDate: f.stopDate },
          says: sip && (f.stopDate < sip.startDate
            ? <span className="text-loss">The stop date is before this SIP started ({nice(sip.startDate)}).</span>
            : <>Stops the <Fig>{inr(sip.amount)}</Fig> SIP in {fund.name} on {nice(f.stopDate)}.</>),
        };
      }
      case 'gold':
      case 'silver': {
        const setName = f.set === '__new' ? f.newSet.trim() : f.set;
        const total = num(f.quantity) * num(f.purchasePrice);
        return {
          ready: f.label.trim() && setName && f.purchaseDate && positive(f.quantity) && positive(f.purchasePrice),
          body: { metal: kind, label: f.label.trim(), set: setName, purchaseDate: f.purchaseDate, quantity: num(f.quantity), purchasePrice: num(f.purchasePrice) },
          says: positive(total) && <><Fig>{num(f.quantity)} g</Fig> for <Fig>{inr(total)}</Fig>, in {setName || 'a new set'}.</>,
        };
      }
      case 'fd': {
        const days = num(f.termDays);
        const label = f.labelEdited ? f.label : fdLabel(f.principal, days);
        return {
          ready: f.name.trim() && f.bank.trim() && label.trim() && positive(f.principal) && f.startDate && positive(days) && Number.isInteger(days) && positive(f.rate) && positive(f.interestBank),
          body: { name: f.name, bank: f.bank, label, principal: num(f.principal), startDate: f.startDate, termDays: days, rate: num(f.rate), interestBank: num(f.interestBank) },
          label,
          maturity: positive(days) && f.startDate ? addDays(f.startDate, days) : null,
          estimate: positive(f.principal) && positive(f.rate) && positive(days) ? fdInterest(num(f.principal), num(f.rate), days) : null,
          base: num(f.principal),
        };
      }
      case 'fd-renewal': {
        const days = num(f.termDays);
        return {
          ready: fd && positive(days) && Number.isInteger(days) && positive(f.rate) && positive(f.interestBank),
          body: { fdId: Number(f.fdId), termDays: days, rate: num(f.rate), interestBank: num(f.interestBank) },
          maturity: fd && positive(days) ? addDays(fd.maturityDate, days) : null,
          estimate: fd && positive(f.rate) && positive(days) ? fdInterest(fd.maturityAmount, num(f.rate), days) : null,
          base: fd?.maturityAmount,
        };
      }
      default: return null;
    }
  }, [kind, f, opts, fund, fd]);

  const submit = async (e) => {
    e.preventDefault();
    if (!plan?.ready || saving || IS_DEMO) return;
    setSaving(true); setError(null);
    try {
      const added = await addEntry(kind === 'gold' || kind === 'silver' ? 'metal' : kind, plan.body);
      setSaved(added);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const again = () => { setSaved(null); setOpts(null); getEntryOptions().then(setOpts).catch((e) => setLoadError(e.message)); };

  // ── The forms' fields ──
  const fundOptions = (list) => list.map((x) => ({ value: String(x.id), label: x.name }));
  const fdInterestField = (
    <Field
      label="Interest, as the bank shows it"
      hint={plan?.estimate ? (
        <>Vesta works it out as <button type="button" onClick={() => set({ interestBank: String(plan.estimate) })} className="num text-link hover:underline cursor-pointer">{inr(plan.estimate)}</button>; the bank's figure is usually a little different.</>
      ) : 'The interest on the FD receipt, for the whole term.'}
    >
      <Money value={f?.interestBank ?? ''} onChange={(e) => set({ interestBank: e.target.value })} />
    </Field>
  );
  const termAndRate = (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Term"><Input type="number" inputMode="numeric" min="1" step="1" suffix="days" value={f?.termDays ?? ''} onChange={(e) => set({ termDays: e.target.value })} /></Field>
      <Field label="Rate"><Input type="number" inputMode="decimal" min="0" step="any" suffix="% a yr" value={f?.rate ?? ''} onChange={(e) => set({ rate: e.target.value })} /></Field>
    </div>
  );

  const form = f && opts && (() => {
    switch (kind) {
      case 'lumpsum': return (
        <>
          <Field label="Fund"><Picker value={f.fundId} onChange={(v) => set({ fundId: v })} options={fundOptions(opts.funds)} placeholder="Pick a fund" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><Money value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
            <Field label="Date"><DateInput value={f.date} max={opts.today} onChange={(e) => set({ date: e.target.value })} /></Field>
          </div>
        </>
      );
      case 'sip': return (
        <>
          <Field label="Fund" hint={fund?.sips.length ? `Already running: ${fund.sips.map((s) => inr(s.amount)).join(' + ')} a month. This one runs alongside.` : null}>
            <Picker value={f.fundId} onChange={(v) => set({ fundId: v })} options={fundOptions(opts.funds)} placeholder="Pick a fund" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Every month"><Money value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
            <Field label="First instalment"><DateInput value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          </div>
          <Note>Instalments are counted on the 5th of each month, from the first instalment's month.</Note>
        </>
      );
      case 'sip-stop': {
        const sips = fund?.sips ?? [];
        return fundsWithSips.length ? (
          <>
            <Field label="Fund">
              <Picker value={f.fundId} onChange={(v) => { const x = opts.funds.find((y) => String(y.id) === v); set({ fundId: v, sipIndex: x?.sips.length === 1 ? String(x.sips[0].index) : '' }); }} options={fundOptions(fundsWithSips)} placeholder="Pick a fund with a running SIP" />
            </Field>
            {sips.length > 1 && (
              <Field label="SIP">
                <Picker value={f.sipIndex} onChange={(v) => set({ sipIndex: v })} placeholder="Pick the SIP" options={sips.map((s) => ({ value: String(s.index), label: `${inr(s.amount)} a month, since ${monthYear(s.startDate)}` }))} />
              </Field>
            )}
            {sips.length === 1 && <Note>{inr(sips[0].amount)} a month, running since {monthYear(sips[0].startDate)}.</Note>}
            <Field label="Stop date" hint="That month's instalment still counts if the date is on or after the 5th.">
              <DateInput value={f.stopDate} onChange={(e) => set({ stopDate: e.target.value })} />
            </Field>
          </>
        ) : <Note>No SIP is running right now.</Note>;
      }
      case 'gold':
      case 'silver': {
        const m = opts[kind];
        const setOptions = [{ value: '__new', label: `New set${f.newSet ? ` (${f.newSet})` : ''}` }, ...[...m.sets].reverse().map((s) => ({ value: s, label: s }))];
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Label"><Input value={f.label} placeholder={kind === 'gold' ? 'Gold Bar-1' : 'Silver Bar-1'} onChange={(e) => set({ label: e.target.value })} /></Field>
              <Field label="Set"><Picker value={f.set} onChange={(v) => set({ set: v })} options={setOptions} /></Field>
            </div>
            {f.set === '__new' && <Field label="New set's name"><Input value={f.newSet} onChange={(e) => set({ newSet: e.target.value })} /></Field>}
            <Field label="Bought on"><DateInput value={f.purchaseDate} max={opts.today} onChange={(e) => set({ purchaseDate: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weight"><Input type="number" inputMode="decimal" min="0" step="any" suffix="g" placeholder="0" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></Field>
              <Field label="Price per gram"><Money value={f.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} /></Field>
            </div>
          </>
        );
      }
      case 'fd': return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="In whose name">
              <Input value={f.name} list="fd-names" onChange={(e) => set({ name: e.target.value })} />
              <datalist id="fd-names">{opts.fdNames.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Bank">
              <Input value={f.bank} list="fd-banks" onChange={(e) => set({ bank: e.target.value })} />
              <datalist id="fd-banks">{opts.fdBanks.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Principal"><Money value={f.principal} onChange={(e) => set({ principal: e.target.value })} /></Field>
            <Field label="Opened on"><DateInput value={f.startDate} max={opts.today} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          </div>
          {termAndRate}
          {fdInterestField}
          <Field label="Label" hint={f.labelEdited ? null : 'Made from the principal and the term; type to change it.'}>
            <Input value={plan?.label ?? ''} placeholder="2L - 444 d" onChange={(e) => set({ label: e.target.value, labelEdited: true })} />
          </Field>
          {plan?.maturity && <Note>Matures on <Fig>{nice(plan.maturity)}</Fig>{positive(f.interestBank) && <> at <Fig>{inr(num(f.principal) + num(f.interestBank))}</Fig></>}.</Note>}
        </>
      );
      case 'fd-renewal': return opts.fds.length ? (
        <>
          <Field label="FD">
            <Picker
              value={f.fdId}
              onChange={(v) => { const x = opts.fds.find((y) => String(y.id) === v); set({ fdId: v, termDays: x?.lastTermDays ? String(x.lastTermDays) : '', rate: x?.lastRate ? String(x.lastRate) : '', interestBank: '' }); }}
              placeholder="Pick the FD"
              options={[...opts.fds].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate)).map((x) => ({ value: String(x.id), label: `${x.bank} · ${x.label}${x.name ? ` · ${x.name}` : ''}` }))}
            />
          </Field>
          {fd && <Note>Matures on <Fig>{nice(fd.maturityDate)}</Fig> at <Fig>{inr(fd.maturityAmount)}</Fig>. The renewal starts then, with all of it.</Note>}
          {termAndRate}
          {fdInterestField}
          {plan?.maturity && <Note>The renewal matures on <Fig>{nice(plan.maturity)}</Fig>{positive(f.interestBank) && <> at <Fig>{inr(fd.maturityAmount + num(f.interestBank))}</Fig></>}.</Note>}
        </>
      ) : <Note>There are no FDs to renew yet.</Note>;
      default: return null;
    }
  })();

  const header = (
    <div className="shrink-0 flex items-start justify-between gap-3 pb-3 border-b border-line">
      <div>
        <p className="eyebrow">Portfolio</p>
        <h3 className="mt-1 text-[16px] font-semibold text-ink">Add an entry</h3>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid place-items-center w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-surface-strong cursor-pointer"><X className="w-4 h-4" aria-hidden="true" /></button>
    </div>
  );

  // ── Saved ──
  if (saved) {
    return (
      <Sheet label="Entry saved" onClose={onClose}>
        {header}
        <div className="flex-1 min-h-0 overflow-y-auto pt-6 pb-2" data-sheet-scroll>
          <span className="grid place-items-center w-10 h-10 rounded-full bg-up/10 text-up shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--c-up)_30%,transparent)]"><Check className="w-5 h-5" aria-hidden="true" /></span>
          <h4 className="mt-4 text-[16px] font-semibold text-ink">Saved to your portfolio</h4>
          <p className="mt-1 text-[14px] leading-[21px] text-body">{savedSentence(saved)}</p>
          <p className="mt-3 text-[13px] text-muted">Every page now counts it. A copy of the file as it was is kept on the Pi.</p>
        </div>
        <div className="shrink-0 pt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={again} className="pill pill-secondary">Add another</button>
          <button type="button" onClick={onClose} className="pill pill-primary">Done</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet label="Add an entry" onClose={onClose}>
      {header}
      <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
        <div data-sheet-scroll className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] -mx-1 px-1 pt-4 pb-2">
          {loadError ? (
            <p className="flex items-start gap-2 text-[14px] text-loss"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />{loadError}</p>
          ) : !opts || !f ? (
            <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-md bg-surface-strong animate-pulse" />)}</div>
          ) : (
            <>
              <div role="radiogroup" aria-label="What to add" className="space-y-3">
                {GROUPS.map((g) => {
                  const Icon = g.label === 'Gold & silver' && kind === 'silver' ? Gem : g.icon;
                  return (
                    <div key={g.label} className="flex items-center gap-3">
                      <span className="w-[64px] sm:w-[104px] shrink-0 flex items-center gap-1.5 text-[12px] text-muted">
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: pal.series[g.slot] }} strokeWidth={1.75} aria-hidden="true" />
                        <span className="sm:hidden">{g.short}</span><span className="hidden sm:inline">{g.label}</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.kinds.map(([id, label]) => {
                          const on = kind === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => pick(id)}
                              className={`h-8 px-3 rounded-full text-[13px] transition-colors cursor-pointer ${on ? 'bg-primary text-on-primary font-medium' : 'bg-surface text-body hover:text-ink shadow-[inset_0_0_0_1px_var(--c-line-strong)]'}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-5 border-t border-line space-y-4">{form}</div>
            </>
          )}
        </div>
        <div className="shrink-0 pt-3 border-t border-line">
          {error && <p role="alert" className="mb-2.5 flex items-start gap-2 text-[13px] leading-[19px] text-loss"><AlertCircle className="w-4 h-4 mt-px shrink-0" aria-hidden="true" />{error}</p>}
          {!error && plan?.says && <p className="mb-2.5 text-[13px] leading-[19px] text-body">{plan.says}</p>}
          {IS_DEMO && <p className="mb-2.5 text-[13px] leading-[19px] text-muted">The demo is read-only. In your own portfolio, Save writes this to the Pi.</p>}
          <button type="submit" disabled={!plan?.ready || saving || IS_DEMO} className="pill pill-primary w-full">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  );
};

// What the server says it added, in a sentence
function savedSentence(a) {
  switch (a.kind) {
    case 'lumpsum': return `${inr(a.amount)} into ${a.fund} on ${nice(a.date)}.`;
    case 'sip': return `A ${inr(a.amount)} monthly SIP in ${a.fund}, from ${monthYear(a.startDate)}.`;
    case 'sip-stop': return `The ${inr(a.amount)} SIP in ${a.fund} stops on ${nice(a.stopDate)}.`;
    case 'gold':
    case 'silver': return `${a.label}: ${a.quantity} g of ${a.kind} at ${inr(a.purchasePrice)} a gram (${inr(a.quantity * a.purchasePrice)}), in ${a.set}.`;
    case 'fd': return `${a.bank} FD "${a.label}": ${inr(a.principal)} from ${nice(a.startDate)}, maturing on ${nice(a.cycles[0].maturityDate)}.`;
    case 'fd-renewal': return `${a.bank} FD "${a.label}" renews on ${nice(a.renewedOn)} with ${inr(a.amount)} for ${a.termDays} days at ${a.rate}%, maturing on ${nice(a.maturityDate)}.`;
    default: return 'The entry is in.';
  }
}

export default AddEntrySheet;
