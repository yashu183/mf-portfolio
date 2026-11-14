import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Lock, ZoomIn, ZoomOut } from 'lucide-react';
import ChartTooltip from './ChartTooltip';
import { niceTicks } from './PinnedYAxis';
import FundIcon from './FundIcon';
import { useTheme, chartPalette } from '../../hooks/useTheme';
import { getNavHistory } from '../../services/portfolioService';

// 'Since' starts the chart on the first payment into the oldest fund on it; the others are fixed periods back from today
const RANGES = [['Since', null], ['1Y', 365], ['3Y', 365 * 3], ['5Y', 365 * 5], ['Max', Infinity]];
const RANGE_LABEL = { Since: 'Since I started', '1Y': '1Y', '3Y': '3Y', '5Y': '5Y', Max: 'Max' };
const DAY = 86400000;
const pct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
const inr = (v) => `₹${Math.round(Math.abs(v)).toLocaleString('en-IN')}`;
const trim = (n) => String(+n.toFixed(2));
const compact = (v) => (v >= 1e7 ? `₹${trim(v / 1e7)}Cr` : v >= 1e5 ? `₹${trim(v / 1e5)}L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}K` : `₹${v}`);
// An axis that fits the data: evenly spaced round ticks from just under the lowest point to just over the highest,
// always through 0.
const fitAxis = (lo, hi, count = 4) => {
  lo = Math.min(lo, 0);
  hi = Math.max(hi, 0);
  const raw = (hi - lo || 1) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= raw);
  const top = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  // below 0, the same step as above it, down to the first tick at or under the lowest point: the lines stay
  // evenly spaced and the chart's floor is a labelled line with no empty sliver above the dates
  if (lo < 0) {
    for (let v = -step; ; v -= step) {
      ticks.unshift(Math.round(v * 1e6) / 1e6);
      if (v <= lo) break;
    }
  }
  return { domain: [ticks[0], top], ticks };
};
const signed = (v) => (v === 0 ? '₹0' : `${v > 0 ? '+' : '−'}${compact(Math.abs(Math.round(v)))}`);
const VIEWS = [['money', 'Your money'], ['price', 'Fund price']];
const level = (v) => Math.round(v).toLocaleString('en-IN');
const fullDate = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const tickFor = (spanDays) => (t) => new Date(t).toLocaleDateString('en-IN', spanDays < 400 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' });

// The day of a fund's first payment: its earliest SIP start or lump sum.
const startOf = (fund) => {
  const dates = [...(fund.sips ?? []).map((x) => x.startDate), ...(fund.lumpsums ?? []).map((x) => x.date)]
    .filter(Boolean).map((d) => new Date(d).getTime());
  return dates.length ? Math.min(...dates) : null;
};

// The last point at or before each time, or null before the series begins.
const sampleAt = (points, times) => {
  let j = -1;
  return times.map((t) => {
    while (j + 1 < points.length && points[j + 1][0] <= t) j++;
    return j >= 0 ? points[j][1] : null;
  });
};

// The whole chart in miniature while zoomed in, with the span on screen as a box that can be handled:
// drag the box to slide along the dates, drag its edges to widen or narrow it, drag across the rest to pick a
// new span, click outside it to centre on that date; with the box focused, ← and → move it.
const MINI_W = 180;
const MINI_H = 44;
const MINI_PAD = 4;
const MiniMap = ({ rows, zoom, onZoom, pal, showValue }) => {
  const ref = useRef(null);
  const act = useRef(null);
  const frame = useRef(0);
  const inner = MINI_W - 2 * MINI_PAD;
  const t0 = rows[0].t;
  const t1 = rows[rows.length - 1].t;
  const span = t1 - t0 || 1;
  const minSpan = span * 0.02;
  const toX = (t) => MINI_PAD + ((t - t0) / span) * inner;
  const toT = (x) => t0 + Math.min(Math.max((x - MINI_PAD) / inner, 0), 1) * span;
  const lo = Math.max(zoom[0], t0);
  const hi = Math.min(zoom[1], t1);
  const xOf = (e) => e.clientX - ref.current.getBoundingClientRect().left;
  // one redraw per frame while dragging, however fast the pointer moves
  const send = (z) => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => onZoom(z)); };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const start = (e, mode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    ref.current.setPointerCapture(e.pointerId);
    const x = xOf(e);
    act.current = { mode, x0: x, z0: [lo, hi], anchor: toT(x), moved: false };
  };
  const move = (e) => {
    const a = act.current;
    if (!a) return;
    const x = xOf(e);
    if (Math.abs(x - a.x0) > 2) a.moved = true;
    const dt = ((x - a.x0) / inner) * span;
    let [l, h] = a.z0;
    if (a.mode === 'move') {
      const w = h - l;
      l = Math.min(Math.max(l + dt, t0), t1 - w);
      h = l + w;
    } else if (a.mode === 'left') {
      l = Math.min(Math.max(l + dt, t0), h - minSpan);
    } else if (a.mode === 'right') {
      h = Math.max(Math.min(h + dt, t1), l + minSpan);
    } else {
      if (!a.moved) return;
      const t = toT(x);
      l = Math.min(a.anchor, t);
      h = Math.max(a.anchor, t);
      if (h - l < minSpan) return;
    }
    send([l, h]);
  };
  const end = () => {
    const a = act.current;
    act.current = null;
    if (a?.mode === 'new' && !a.moved) {
      // a click outside the box: the same width, centred on where it was clicked
      const w = a.z0[1] - a.z0[0];
      const l = Math.min(Math.max(a.anchor - w / 2, t0), t1 - w);
      send([l, l + w]);
    }
  };
  const key = (e) => {
    const w = hi - lo;
    const step = e.shiftKey ? w : w / 10;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const l = Math.min(Math.max(lo + (e.key === 'ArrowLeft' ? -step : step), t0), t1 - w);
      onZoom([l, l + w]);
    }
  };

  const left = toX(lo);
  const width = Math.max(toX(hi) - left, 6);
  return (
    <div
      ref={ref}
      className="relative shrink-0 rounded-md overflow-hidden shadow-[0_0_0_1px_var(--c-line-strong)] bg-surface select-none touch-none cursor-crosshair"
      style={{ width: MINI_W, height: MINI_H }}
      onPointerDown={(e) => start(e, 'new')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      title="Drag the box to move along the dates, or its edges to resize it"
    >
      <ComposedChart width={MINI_W} height={MINI_H} data={rows} margin={{ top: MINI_PAD, right: MINI_PAD, bottom: MINI_PAD, left: MINI_PAD }} style={{ pointerEvents: 'none' }}>
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
        <YAxis hide domain={['dataMin', 'dataMax']} />
        {showValue && <Area dataKey="value" type="monotone" stroke={pal.invested} strokeWidth={1} fill={pal.invested} fillOpacity={0.25} dot={false} isAnimationActive={false} />}
        <Line dataKey="nifty" type="monotone" stroke={pal.primary} strokeWidth={1} dot={false} isAnimationActive={false} />
      </ComposedChart>
      {/* the parts outside the span, dimmed, so the box reads as a window */}
      <div className="absolute inset-y-0 left-0 bg-canvas/55 pointer-events-none" style={{ width: left }} />
      <div className="absolute inset-y-0 right-0 bg-canvas/55 pointer-events-none" style={{ left: left + width }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Zoomed dates"
        aria-valuemin={t0}
        aria-valuemax={t1}
        aria-valuenow={lo}
        aria-valuetext={`${fullDate(lo)} to ${fullDate(hi)}`}
        onKeyDown={key}
        onPointerDown={(e) => start(e, 'move')}
        className="absolute inset-y-0 cursor-grab active:cursor-grabbing rounded-[3px] shadow-[inset_0_0_0_1.5px_var(--c-ink)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--c-ink)]"
        style={{ left, width }}
      >
        <span onPointerDown={(e) => start(e, 'left')} className="absolute inset-y-0 -left-1 w-2.5 cursor-ew-resize" aria-hidden="true" />
        <span onPointerDown={(e) => start(e, 'right')} className="absolute inset-y-0 -right-1 w-2.5 cursor-ew-resize" aria-hidden="true" />
      </div>
    </div>
  );
};

// One Nifty 50 line from the chart's first day, and a line per selected fund from the day it starts.
// A fund that starts later begins ON the Nifty 50 line that day, so from there on the gap between the two
// is how the fund did against the same money in the Nifty 50: above it is ahead, below it is behind.
const VsNiftyChart = ({ funds }) => {
  const { theme } = useTheme();
  const pal = chartPalette(theme);
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  // 'money': your own payments against the same payments into the Nifty 50, in ₹. 'price': each fund's NAV
  // against the index, for judging the fund itself. The fund selection is shared, so switching keeps it.
  const [view, setView] = useState('money');
  const [range, setRange] = useState('Since');
  const [off, setOff] = useState(() => new Set());
  const [hover, setHover] = useState(null);
  // drag across a chart to zoom into those dates; double-click or Reset zoom to see it all again.
  // A new period or view starts from the whole chart.
  const [zoom, setZoom] = useState(null);
  const [drag, setDrag] = useState(null);
  const pickRange = (l) => { setRange(l); setZoom(null); };
  const pickView = (v) => { setView(v); setZoom(null); };
  // on a phone the hover box is about as wide as the chart, so it sits pinned to the chart's left edge
  // instead of following the finger off the side of the screen
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // z-index 1: over the chart, but under the pinned heading (.pin-head, z 10) and the pinned filter bar, so the
  // box slides behind them when the chart scrolls up under them
  const tipPlace = narrow ? { position: { x: 4, y: 0 }, wrapperStyle: { zIndex: 1, width: 'calc(100% - 8px)' } } : { wrapperStyle: { zIndex: 1 } };

  useEffect(() => {
    let live = true;
    getNavHistory().then((h) => live && setHistory(h)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  const model = useMemo(() => {
    if (!history?.nifty?.length) return null;
    const stamp = (p) => [new Date(p[0]).getTime(), p[1]];
    const nifty = history.nifty.map(stamp);
    const first = nifty[0][0];
    const last = nifty[nifty.length - 1][0];
    const byId = new Map(funds.map((f) => [f.id, f]));

    const items = [];
    for (const f of history.funds ?? []) {
      const fund = byId.get(f.id);
      if (!fund || f.points.length < 2) continue;
      const points = f.points.map(stamp);
      // no NAV before the fund's first point, so a payment before then counts from that point
      const start = Math.max(startOf(fund) ?? points[0][0], points[0][0]);
      items.push({ key: `f${f.id}`, fund, points, start, color: pal.series[items.length % pal.series.length] });
    }
    if (!items.length) return null;

    // where the chart starts: the oldest selected fund's first payment, or the period's first day
    const days = RANGES.find(([l]) => l === range)[1];
    const onChart = items.filter((it) => !off.has(it.key));
    const from = Math.max(first, range === 'Since'
      ? Math.min(...(onChart.length ? onChart : items).map((it) => it.start))
      : Number.isFinite(days) ? last - days * DAY : first);

    const times = nifty.map((p) => p[0]).filter((t) => t >= from);
    if (times.length < 2) return null;
    const niftyVals = sampleAt(nifty, times);
    const niftyBase = niftyVals[0];
    const levelVals = history.niftyLevel?.length ? sampleAt(history.niftyLevel.map(stamp), times) : null;
    const rows = times.map((t, i) => ({ t, nifty: (niftyVals[i] / niftyBase - 1) * 100, level: levelVals?.[i] ?? null }));

    const series = items.map((it) => {
      const vals = sampleAt(it.points, times);
      const s0 = Math.max(from, it.start);
      const i0 = times.findIndex((t, i) => t >= s0 && vals[i] != null);
      if (i0 < 0) return { ...it, i0: -1, own: null, gap: null, startedOn: s0 };
      const anchor = 1 + rows[i0].nifty / 100;
      for (let i = i0; i < times.length; i++) {
        if (vals[i] == null) continue;
        const own = vals[i] / vals[i0] - 1;
        const niftySame = niftyVals[i] / niftyVals[i0] - 1;
        rows[i][it.key] = (anchor * (1 + own) - 1) * 100; // drawn from the Nifty 50 line's level that day
        rows[i][`o${it.key}`] = own * 100; // the fund's own return since its start
        rows[i][`g${it.key}`] = (own - niftySame) * 100; // ahead (+) or behind (−) the Nifty 50 over the same days
        rows[i][`n${it.key}`] = niftySame * 100; // the Nifty 50 over those same days
        rows[i][`v${it.key}`] = vals[i]; // the fund's NAV that day
      }
      const li = times.length - 1;
      return { ...it, i0, own: rows[li][`o${it.key}`] ?? null, gap: rows[li][`g${it.key}`] ?? null, startedOn: times[i0] };
    }).map((s) => {
      // a fund left off the chart still shows its figures from its own start, not from where the chart begins
      if (range !== 'Since' || !off.has(s.key) || s.start >= from) return s;
      const [f0, f1] = sampleAt(s.points, [s.start, last]);
      const [n0, n1] = sampleAt(nifty, [s.start, last]);
      if (f0 == null || n0 == null) return s;
      const own = (f1 / f0 - 1) * 100;
      return { ...s, own, gap: own - (n1 / n0 - 1) * 100, startedOn: s.start };
    });

    return { rows, series, from: times[0], to: last, niftyEnd: rows[rows.length - 1].nifty, levelFrom: rows[0].level, levelTo: rows[rows.length - 1].level, spanDays: (last - times[0]) / DAY };
  }, [history, range, funds, off, pal.series]);

  // Your money: the selected funds added up on each date, from the first payment into any of them.
  // The server replays every payment at the fund list's own NAVs, so today's figures match the list.
  const money = useMemo(() => {
    if (!history?.money?.length) return null;
    const dates = history.nifty.map((p) => new Date(p[0]).getTime());
    const known = new Set(funds.map((f) => f.id));
    const ticked = history.money.filter((m) => known.has(m.id) && !off.has(`f${m.id}`));
    // nothing ticked: the Nifty 50 stays, carrying every payment you made into any fund
    const niftyOnly = ticked.length === 0;
    const sel = niftyOnly ? history.money.filter((m) => known.has(m.id)) : ticked;
    if (!sel.length) return { empty: true };
    const start = Math.min(...sel.map((m) => m.from));
    const colorOf = new Map((model?.series ?? []).map((x) => [x.key, x.color]));
    const nameOf = new Map(funds.map((f) => [f.id, f.shortName]));
    // one band per ticked fund, the oldest at the bottom so newer money stacks on top of it
    const bands = niftyOnly ? [] : [...sel].sort((a, b) => a.from - b.from || a.id - b.id)
      .map((m) => ({ key: `f${m.id}`, name: nameOf.get(m.id), color: colorOf.get(`f${m.id}`) ?? pal.invested }));
    const rows = [];
    for (let i = start; i < dates.length; i++) {
      const row = { t: dates[i], value: 0, nifty: 0, invested: 0 };
      for (const m of sel) {
        const k = i - m.from;
        if (k < 0) continue;
        row.value += m.value[k];
        if (!niftyOnly) row[`f${m.id}`] = m.value[k];
        row.nifty += m.nifty[k];
        row.invested += m.invested[k];
      }
      row.gap = row.value - row.nifty;
      rows.push(row);
    }
    const gaps = niftyOnly ? [0] : rows.map((r) => r.gap);
    const gapMax = Math.max(0, ...gaps);
    const gapMin = Math.min(0, ...gaps);
    const ticks = niceTicks(Math.max(...rows.map((r) => Math.max(niftyOnly ? 0 : r.value, r.nifty, r.invested))));
    const gapAxis = fitAxis(gapMin, gapMax, 3);
    return { rows, bands, ticks, gapAxis, gapMin, gapMax, niftyOnly, from: dates[start], end: rows[rows.length - 1], spanDays: (dates[dates.length - 1] - dates[start]) / DAY };
  }, [history, funds, off, model, pal.invested]);

  if (failed) return null;
  if (!model) {
    return <section className="card p-5" aria-busy="true" aria-label="Against the Nifty 50, loading"><div className="h-[420px] rounded-lg bg-surface-strong/60 animate-pulse" /></section>;
  }

  const shown = model.series.filter((s) => !off.has(s.key) && s.i0 >= 0);
  // only the zoomed dates (kept whole if the zoom would leave fewer than two points)
  const clip = (rows) => {
    if (!zoom) return rows;
    const part = rows.filter((r) => r.t >= zoom[0] && r.t <= zoom[1]);
    return part.length >= 2 ? part : rows;
  };
  const daysOf = (rows) => (rows.length ? (rows[rows.length - 1].t - rows[0].t) / DAY : 0);
  const priceRows = clip(model.rows);
  // pressing, dragging and letting go across a chart; the dates under the pointer come from the chart itself
  const dragProps = {
    onMouseDown: (e) => { if (e?.activeLabel != null) setDrag({ a: e.activeLabel, b: e.activeLabel }); },
    onMouseMove: (e) => { if (drag && e?.activeLabel != null) setDrag((d) => (d ? { ...d, b: e.activeLabel } : d)); },
    onMouseUp: () => {
      if (drag && drag.a !== drag.b) setZoom([Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)]);
      setDrag(null);
    },
    onMouseLeave: () => setDrag(null),
    // Recharts sets its own cursor on the chart, so it is set here (mouse only)
    // an arrow while hovering; the zoom-in (+) cursor once the button is down and a span is being picked
    style: narrow ? undefined : { cursor: drag ? 'zoom-in' : 'default' },
  };
  const dragBox = drag && drag.a !== drag.b
    ? <ReferenceArea x1={drag.a} x2={drag.b} fill={pal.tick} fillOpacity={0.18} stroke={pal.tick} strokeOpacity={0.4} ifOverflow="hidden" />
    : null;
  const ahead = shown.filter((s) => (s.gap ?? 0) > 0.05).length;
  const behind = shown.filter((s) => (s.gap ?? 0) < -0.05).length;
  const toggle = (key) => setOff((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const dim = (key) => (hover && hover !== key ? 0.18 : 1);
  const niftyUp = model.niftyEnd >= 0;
  // the % scale covers only what is drawn: the Nifty 50 and the ticked funds
  const priceTicks = (() => {
    let lo = 0, hi = 0;
    const keys = ['nifty', ...shown.map((x) => x.key)];
    for (const r of priceRows) for (const k of keys) { const v = r[k]; if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    return fitAxis(lo, hi, 5);
  })();

  const tip = ({ active, payload }) => {
    if (drag || !active || !payload?.length) return null; // hidden while a span is being dragged out
    const row = payload[0].payload;
    // the price beside each %: index points for the Nifty 50, the NAV for a fund
    const withPrice = (price, p, gap) => (
      <>
        <span className="text-body">{price}</span><span className="text-muted"> · </span>{pct(p)}
        {/* the gap to the Nifty 50 after the %, in brackets, with a little room before it */}
        <span className={`inline-block w-[60px] ml-2 text-left ${gap == null ? '' : gap >= 0 ? 'text-gain' : 'text-loss'}`}>{gap != null && `(${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)})`}</span>
      </>
    );
    // ranked by the gap to the Nifty 50: funds ahead above the Nifty 50's row, funds behind below it
    const ranked = shown
      .filter((s) => row[`o${s.key}`] != null)
      .sort((a, b) => row[`g${b.key}`] - row[`g${a.key}`])
      .map((s) => ({
        gap: row[`g${s.key}`],
        label: s.fund.shortName,
        color: s.color,
        value: withPrice(`₹${row[`v${s.key}`].toFixed(2)}`, row[`o${s.key}`], row[`g${s.key}`]),
        tone: row[`o${s.key}`] >= 0 ? 'gain' : 'loss',
      }));
    const niftyRow = {
      label: 'Nifty 50',
      color: pal.primary,
      // withPrice leaves the (gap) box empty here, so the Nifty 50's % lines up with the funds'
      value: row.level ? withPrice(`${level(row.level)} pts`, row.nifty) : pct(row.nifty),
      tone: row.nifty >= 0 ? 'gain' : 'loss',
      highlight: true,
    };
    const rows = [...ranked.filter((r) => r.gap >= 0), niftyRow, ...ranked.filter((r) => r.gap < 0)];
    return <ChartTooltip title={fullDate(row.t)} subtitle="Price · growth since it started (points ahead + or behind − the Nifty 50 over the same days)" rows={rows} />;
  };

  const growth = (v, put) => (put > 0 ? (v / put - 1) * 100 : 0);
  const moneyTip = ({ active, payload }) => {
    if (drag || !active || !payload?.length) return null;
    const r = payload[0].payload;
    const gap = r.value - r.nifty;
    const both = (v) => <><span className="text-body">{inr(v)}</span><span className="text-muted"> · </span>{pct(growth(v, r.invested))}</>;
    if (money.niftyOnly) {
      return (
        <ChartTooltip
          title={fullDate(r.t)}
          rows={[
            { label: 'Your money in Nifty 50', color: pal.primary, value: both(r.nifty), tone: r.nifty >= r.invested ? 'gain' : 'loss' },
            { label: 'Put in so far', color: pal.tick, value: inr(r.invested) },
          ]}
        />
      );
    }
    // every fund held that day, largest first, each in its band's colour
    const held = money.bands.filter((bd) => r[bd.key] != null).sort((x, y) => r[y.key] - r[x.key]);
    const parts = held.map((bd) => ({ label: bd.name, color: bd.color, value: inr(r[bd.key]) }));
    return (
      <ChartTooltip
        title={fullDate(r.t)}
        rows={[
          ...parts,
        ]}
        footer={[
          { label: 'Your funds', value: both(r.value), tone: r.value >= r.invested ? 'gain' : 'loss' },
          { label: 'Same money in Nifty 50', value: both(r.nifty), tone: r.nifty >= r.invested ? 'gain' : 'loss' },
          { label: 'Put in so far', value: inr(r.invested) },
          { label: gap >= 0 ? 'Ahead of the Nifty 50 by' : 'Behind the Nifty 50 by', value: inr(gap), tone: gap >= 0 ? 'gain' : 'loss' },
        ]}
      />
    );
  };
  const isMoney = view === 'money' && money;
  const moneyRows = money && !money.empty ? clip(money.rows) : [];
  const moneyTicks = niceTicks(Math.max(1, ...moneyRows.map((r) => Math.max(money?.niftyOnly ? 0 : r.value, r.nifty, r.invested))));
  const gapsShown = moneyRows.map((r) => r.gap);
  const gapLo = Math.min(0, ...gapsShown);
  const gapHi = Math.max(0, ...gapsShown);
  const gapAxis = fitAxis(gapLo, gapHi, 3);
  const chartRows = isMoney ? moneyRows : priceRows;
  // Zoomed in: the whole chart in miniature, with the span on screen marked, so it's clear which part this is
  const fullRows = isMoney ? (money.rows ?? []) : model.rows;
  const miniMap = zoom && fullRows.length > 1 && (
    <MiniMap rows={fullRows} zoom={zoom} onZoom={setZoom} pal={pal} showValue={isMoney && !money.niftyOnly} />
  );
  const zoomBar = (isMoney ? !money.empty : true) && (
    <div className={`px-5 mb-1 flex items-center justify-end gap-3 text-[12px] text-muted ${zoom ? 'min-h-[44px]' : 'h-6'}`}>
      {zoom ? (
        <>
          <span className="num">{fullDate(chartRows[0].t)} – {fullDate(chartRows[chartRows.length - 1].t)}</span>
          {miniMap}
          <button type="button" onClick={() => setZoom(null)} className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-ink shadow-[0_0_0_1px_var(--c-line-strong)] hover:bg-surface-strong cursor-pointer"><ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />Reset zoom</button>
        </>
      ) : (
        <span className="hidden md:inline-flex items-center gap-1.5"><ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />Drag across the chart to zoom in</span>
      )}
    </div>
  );

  return (
    // a section heading like the fund groups below it, with the view switch at its side; the chart in the card under it
    <section aria-labelledby="vs-nifty-h">
      {/* pins at the top while the chart scrolls under it, and leaves with the chart's section */}
      <div className="pin-head flex flex-wrap items-end justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h3 id="vs-nifty-h" className="text-[16px] leading-[1.5] font-semibold text-ink">Against the Nifty 50</h3>
          <p className="text-[15px] text-ink-2">{view === 'money' ? 'Your payments, and the same payments into the Nifty 50' : "Each fund's price, and the Nifty 50's, from the same day"}</p>
        </div>
        <div className="inline-flex h-9 p-1 rounded-md bg-surface shadow-[0_0_0_1px_var(--c-line-strong)]" role="group" aria-label="What to compare">
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => pickView(id)} className={`px-3 whitespace-nowrap rounded-[4px] text-[13px] font-medium transition-colors cursor-pointer ${view === id ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="card overflow-hidden">
      <div className="p-5 pb-2">
        {isMoney ? (
          money.empty ? (
            <p className="text-[14px] text-body">Tick a fund below to see your money in it against the Nifty 50.</p>
          ) : (() => {
            const e = money.end;
            const gap = e.value - e.nifty;
            if (money.niftyOnly) {
              const g = growth(e.nifty, e.invested);
              return (
                <>
                  <p className="text-[34px] leading-[40px] font-semibold tracking-[-0.04em] num text-ink">{inr(e.nifty)}</p>
                  <p className="mt-1 text-[13px] text-muted">your money if every payment since {fullDate(money.from)} had gone into the Nifty 50. Tick funds to compare.</p>
                  <dl className="mt-4 mb-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: pal.primary }} aria-hidden="true" /><dt className="text-muted">Nifty 50</dt><dd className="num text-ink">{inr(e.nifty)} <span className={g >= 0 ? 'text-gain' : 'text-loss'}>{pct(g)}</span></dd></div>
                    <div className="flex items-center gap-2"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: pal.tick }} aria-hidden="true" /><dt className="text-muted">Put in</dt><dd className="num text-ink">{inr(e.invested)}</dd></div>
                  </dl>
                </>
              );
            }
            return (
              <>
                <p className={`text-[34px] leading-[40px] font-semibold tracking-[-0.04em] num ${gap >= 0 ? 'text-gain' : 'text-loss'}`}>{gap >= 0 ? '+' : '−'}{inr(gap)}</p>
                <p className="mt-1 text-[13px] text-muted">{gap >= 0 ? 'ahead of' : 'behind'} the same money in the Nifty 50, since {fullDate(money.from)}</p>
                <dl className="mt-4 mb-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: `conic-gradient(${(money.bands.length ? money.bands.slice(0, 4) : [{ color: pal.invested }]).map((bd) => bd.color).join(', ')})` }} aria-hidden="true" /><dt className="text-muted">Your funds</dt><dd className="num text-ink">{inr(e.value)} <span className={growth(e.value, e.invested) >= 0 ? 'text-gain' : 'text-loss'}>{pct(growth(e.value, e.invested))}</span></dd></div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: pal.primary }} aria-hidden="true" /><dt className="text-muted">Nifty 50</dt><dd className="num text-ink">{inr(e.nifty)} <span className={growth(e.nifty, e.invested) >= 0 ? 'text-gain' : 'text-loss'}>{pct(growth(e.nifty, e.invested))}</span></dd></div>
                  <div className="flex items-center gap-2"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: pal.tick }} aria-hidden="true" /><dt className="text-muted">Put in</dt><dd className="num text-ink">{inr(e.invested)}</dd></div>
                </dl>
              </>
            );
          })()
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`text-[34px] leading-[40px] font-semibold tracking-[-0.04em] num ${niftyUp ? 'text-gain' : 'text-loss'}`}>{pct(model.niftyEnd)}</p>
                <p className="mt-1 text-[13px] text-muted">
                  Nifty 50 since {fullDate(model.from)}
                  {model.levelFrom && model.levelTo && <> · <span className="num text-body">{level(model.levelFrom)} → {level(model.levelTo)}</span> points</>}
                </p>
              </div>
              <div className="inline-flex h-10 p-1 rounded-md max-w-full overflow-x-auto bg-surface shadow-[0_0_0_1px_var(--c-line-strong)]" role="group" aria-label="Period">
                {RANGES.map(([l]) => (
                  <button key={l} type="button" aria-pressed={range === l} onClick={() => pickRange(l)} className={`px-3 whitespace-nowrap rounded-[4px] text-[13px] font-medium transition-colors cursor-pointer ${range === l ? 'bg-surface-strong text-ink' : 'text-muted hover:text-ink'}`}>{RANGE_LABEL[l]}</button>
                ))}
              </div>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-body">
              <span className="inline-flex items-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-gain" aria-hidden="true" /><span className="num text-ink">{ahead}</span> {ahead === 1 ? 'fund' : 'funds'} ahead</span>
              <span className="inline-flex items-center gap-1.5"><ArrowDownRight className="w-4 h-4 text-loss" aria-hidden="true" /><span className="num text-ink">{behind}</span> behind</span>
              <span className="text-muted">of the Nifty 50, each from the day it started</span>
            </p>
          </>
        )}
      </div>

      {zoomBar}
      {isMoney && !money.empty && (
        <div className="h-[320px] px-1 select-none" onDoubleClick={() => setZoom(null)} role="img" aria-label={`Your money in ${shown.length} funds against the same money in the Nifty 50, from ${fullDate(money.from)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={moneyRows} syncId="vs-nifty-money" margin={{ top: 8, right: 28, bottom: 0, left: 0 }} {...dragProps}>
              <CartesianGrid vertical={false} stroke={pal.grid} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickCount={6} tickFormatter={tickFor(daysOf(moneyRows))} tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis domain={[0, moneyTicks[moneyTicks.length - 1]]} ticks={moneyTicks} tickFormatter={compact} tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={moneyTip} {...tipPlace} cursor={{ stroke: pal.tick, strokeDasharray: '3 3' }} isAnimationActive={false} />
              {money.bands.map((bd) => (
                <Area
                  key={bd.key}
                  dataKey={bd.key}
                  stackId="money"
                  type="monotone"
                  stroke={bd.color}
                  strokeWidth={1}
                  strokeOpacity={hover && hover !== bd.key ? 0.2 : 0.9}
                  fill={bd.color}
                  fillOpacity={hover ? (hover === bd.key ? 0.85 : 0.12) : 0.55}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
              <Line dataKey="invested" type="stepAfter" stroke={pal.tick} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
              <Line dataKey="nifty" type="monotone" stroke={pal.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              {dragBox}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ahead or behind over time: the gap between the top of your funds and the Nifty 50 line, drawn on its
          own scale so a ₹2,000 gap on a ₹1 lakh portfolio is plain to see. Green above zero, red below. */}
      {isMoney && !money.empty && !money.niftyOnly && (() => {
        // the fill's gradient spans the area's own height (from its highest gap to its lowest, or 0), so the
        // green-to-red split sits at 0 within that, not within the axis
        const zero = gapHi / (gapHi - gapLo || 1);
        return (
          <div className="px-1 pt-3">
            <p className="px-4 md:px-5 mb-1 flex items-center justify-between gap-3 text-[12px] text-muted">
              <span>Ahead (+) or behind (−) the Nifty 50</span>
              <span className="text-muted">Today: <span className={`num ${money.end.gap >= 0 ? 'text-gain' : 'text-loss'}`}>{money.end.gap >= 0 ? 'ahead by' : 'behind by'} {inr(money.end.gap)}</span></span>
            </p>
            <div className="h-[140px] select-none" onDoubleClick={() => setZoom(null)} role="img" aria-label={`How far ahead or behind the Nifty 50 your funds were on each day, ${signed(money.end.gap)} today`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={moneyRows} syncId="vs-nifty-money" margin={{ top: 8, right: 28, bottom: 10, left: 0 }} {...dragProps}>
                  <defs>
                    <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={zero} stopColor={pal.up} stopOpacity={0.45} />
                      <stop offset={zero} stopColor={pal.down} stopOpacity={0.45} />
                    </linearGradient>
                    <linearGradient id="gapStroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={zero} stopColor={pal.up} />
                      <stop offset={zero} stopColor={pal.down} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={pal.grid} />
                  <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                  <YAxis domain={gapAxis.domain} ticks={gapAxis.ticks} interval={0} tickFormatter={signed} tick={{ fill: pal.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                  <ReferenceLine y={0} stroke={pal.tick} strokeOpacity={0.6} />
                  <Tooltip content={() => null} cursor={{ stroke: pal.tick, strokeDasharray: '3 3' }} isAnimationActive={false} />
                  <Area dataKey="gap" type="monotone" baseValue={0} stroke="url(#gapStroke)" strokeWidth={1.5} fill="url(#gapFill)" dot={false} activeDot={false} isAnimationActive={false} />
                  {dragBox}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {!isMoney && <div className="h-[320px] px-1 select-none" onDoubleClick={() => setZoom(null)} role="img" aria-label={`The Nifty 50 and ${shown.length} funds from ${fullDate(model.from)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={priceRows} margin={{ top: 8, right: 28, bottom: 0, left: 0 }} {...dragProps}>
            <defs>
              <linearGradient id="niftyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={pal.primary} stopOpacity={0.14} />
                <stop offset="100%" stopColor={pal.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={pal.grid} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickCount={6} tickFormatter={tickFor(daysOf(priceRows))} tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={32} />
            <YAxis domain={priceTicks.domain} ticks={priceTicks.ticks} interval={0} tickFormatter={(v) => `${v}%`} tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} width={52} />
            <ReferenceLine y={0} stroke={pal.tick} strokeOpacity={0.5} />
            <Tooltip content={tip} {...tipPlace} cursor={{ stroke: pal.tick, strokeDasharray: '3 3' }} isAnimationActive={false} />
            <Area dataKey="nifty" type="monotone" stroke={pal.primary} strokeWidth={2.5} strokeOpacity={hover ? 0.6 : 1} fill="url(#niftyFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            {shown.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={hover === s.key ? 2.5 : 1.5}
                strokeOpacity={dim(s.key)}
                // a dot where the fund joins the chart, on the Nifty 50 line, when it starts after the chart does
                dot={({ cx, cy, index, payload }) => (s.i0 > 0 && payload?.t === model.rows[s.i0].t
                  ? <circle key={`${s.key}-start`} cx={cx} cy={cy} r={3.5} fill={pal.surface} stroke={s.color} strokeWidth={2} strokeOpacity={dim(s.key)} />
                  : <g key={`${s.key}-${index}`} />)}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
            {dragBox}
          </ComposedChart>
        </ResponsiveContainer>
      </div>}

      <div className="border-t border-line p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="eyebrow">Funds on the chart · {shown.length} of {model.series.length}</p>
          <span className="flex items-center gap-3 text-[13px]">
            <button type="button" onClick={() => setOff(new Set())} className="text-body hover:text-ink cursor-pointer">Select all</button>
            <button type="button" onClick={() => setOff(new Set(model.series.map((s) => s.key)))} className="text-body hover:text-ink cursor-pointer">Clear</button>
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <li>
            <div className="flex items-center gap-2.5 min-h-11 py-1 px-3 rounded-lg shadow-[0_0_0_1px_var(--c-ink)]" title="The Nifty 50 always stays on the chart">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pal.primary }} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-ink">{isMoney ? 'Same money in Nifty 50' : 'Nifty 50'}</span>
              <Lock className="w-3 h-3 text-muted shrink-0" aria-label="Always shown" />
              {isMoney ? (
                money && !money.empty ? (
                  <span className="text-right leading-tight">
                    <span className="block num text-[13px] text-ink">{inr(money.end.nifty)}</span>
                    <span className={`block font-mono text-[11px] ${money.end.nifty >= money.end.invested ? 'text-gain' : 'text-loss'}`}>{pct(growth(money.end.nifty, money.end.invested))} on {inr(money.end.invested)}</span>
                  </span>
                ) : <span className="font-mono text-[11px] text-muted">same payments</span>
              ) : (
                <span className="text-right leading-tight">
                  <span className={`block num text-[13px] ${niftyUp ? 'text-gain' : 'text-loss'}`}>{pct(model.niftyEnd)}</span>
                  {model.levelTo && <span className="block font-mono text-[11px] text-muted">{level(model.levelTo)} pts</span>}
                </span>
              )}
            </div>
          </li>
          {model.series.map((s) => {
            const on = !off.has(s.key);
            // the money view adds the ticked funds into one line, so its dots mark the selection, not a line colour
            const dot = s.color;
            const f = s.fund;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.key)}
                  onMouseEnter={() => on && setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => on && setHover(s.key)}
                  onBlur={() => setHover(null)}
                  title={`From ${fullDate(s.startedOn)}`}
                  className={`w-full flex items-center gap-2.5 min-h-11 py-1 px-3 rounded-lg text-left transition-[box-shadow,opacity] cursor-pointer ${on ? 'shadow-[0_0_0_1px_var(--c-line-strong)] hover:shadow-[0_0_0_1px_var(--c-ink)]' : 'shadow-[0_0_0_1px_var(--c-line)] opacity-50 hover:opacity-80'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: on ? dot : 'transparent', boxShadow: `inset 0 0 0 1.5px ${dot}` }} aria-hidden="true" />
                  <FundIcon fund={s.fund} size={20} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[13px] text-ink">{s.fund.shortName}</span>
                    <span className="block font-mono text-[11px] text-muted">from {fullDate(s.startedOn)}</span>
                  </span>
                  {isMoney ? (
                    <span className="text-right leading-tight">
                      <span className="block num text-[13px] text-ink">{inr(f.currentValue ?? 0)}</span>
                      {f.vsNiftyValue != null && <span className={`block font-mono text-[11px] ${f.vsNiftyValue >= 0 ? 'text-gain' : 'text-loss'}`}>{f.vsNiftyValue >= 0 ? 'ahead by' : 'behind by'} {inr(f.vsNiftyValue)}</span>}
                    </span>
                  ) : (
                  <span className="text-right leading-tight">
                    <span className={`block num text-[13px] ${s.own == null ? 'text-muted' : s.own >= 0 ? 'text-gain' : 'text-loss'}`}>{s.own == null ? '-' : pct(s.own)}</span>
                    {s.gap != null && <span className={`block font-mono text-[11px] ${s.gap >= 0 ? 'text-gain' : 'text-loss'}`}>{s.gap >= 0 ? 'ahead by' : 'behind by'} {Math.abs(s.gap).toFixed(1)}</span>}
                  </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {isMoney ? (
        <p className="mt-3 text-[12px] text-muted">
          Your money: every SIP instalment and lump sum into the ticked funds, on its own date and amount, valued at each day&apos;s NAV. Same money in Nifty 50: those exact payments put into the Nifty 50 on the same days instead (through the UTI Nifty 50 Index Fund). Each ticked fund is its own colour band, stacked so the top edge is your total; hover a fund below to pick out its band. Tick one fund to see just that fund, or all of them for your whole portfolio; the chart starts at the first payment into the funds ticked. The % is the gain on what you put in.
        </p>
        ) : (
        <p className="mt-3 text-[12px] text-muted">
          Every % here is how much the price grew, each from its own start: the Nifty 50 from {fullDate(model.from)}, each fund from its first payment. None is a % of the Nifty 50. A fund's &quot;ahead by&quot; is its % minus the Nifty 50&apos;s % over the same days, in percentage points. A fund that started later joins the chart on the Nifty 50 line, at the dot; above the line from there means ahead, below means behind. These are price moves, as if one lump sum went in on the first day; your own return, with each SIP at its own price, is the Returns and XIRR in the fund list. The Nifty 50&apos;s % comes from the UTI Nifty 50 Index Fund, which counts dividends, so it runs a little ahead of the change in index points.
        </p>
        )}
      </div>
      </div>
    </section>
  );
};

export default VsNiftyChart;
