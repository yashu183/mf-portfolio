// The PDF report: one A4 document drawn from the same data the screens use.
// Overview downloads every section; each asset page downloads only its own.
// jsPDF, autotable and the Geist files load on the first click, so the app itself stays light.
import { IS_DEMO } from './demo';
import geistRegularUrl from '../assets/fonts/Geist-Regular.ttf?url';
import geistSemiBoldUrl from '../assets/fonts/Geist-SemiBold.ttf?url';
import {
  getOverview, getMutualFunds, getGoldPortfolio, getSilverPortfolio, getFixedDeposits, getEPFPortfolio,
} from '../services/portfolioService';
import { assetInsights, fundInsights, groupByCategory } from './insights';

// The light theme's tokens: the report is printed on white whichever theme is on screen
const INK = '#171717';
const BODY = '#4d4d4d';
const MUTED = '#6f6f6f';
const LINE = '#ebebeb';
const SURFACE_STRONG = '#f5f5f5';
const GAIN = '#1a7f37';
const LOSS = '#c50000';
const INVESTED = '#5367ff'; // the value card's invested part, as the app's light theme
const SERIES = ['#5367ff', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#e34948', '#8250df', '#9a6700', '#0e7490'];

const PAGE_W = 595.28; // A4 in points
const PAGE_H = 841.89;
const M = 40; // page margin
const W = PAGE_W - M * 2;
const TOP = 76; // where content starts under the running head
const BOTTOM = PAGE_H - 48; // where it must stop above the running foot

const ASSETS = [
  { id: 'mutualFunds', label: 'Mutual Funds', slot: 0 },
  { id: 'fds', label: 'Fixed Deposits', slot: 1 },
  { id: 'epf', label: 'EPF', slot: 2 },
  { id: 'gold', label: 'Gold', slot: 3 },
  { id: 'silver', label: 'Silver', slot: 4 },
];

const TITLES = {
  overview: 'Portfolio report',
  mutualFunds: 'Mutual funds report',
  gold: 'Gold report',
  silver: 'Silver report',
  fds: 'Fixed deposits report',
  epf: 'EPF report',
};

const STATUS = { excellent: 'Excellent', good: 'Good', monitor: 'Monitor', poor: 'Underperforming' };

// ── Formatting ────────────────────────────────────────────────────────────────
const dateLong = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const monthYear = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const pct = (v, digits = 2) => `${(v ?? 0) >= 0 ? '+' : '−'}${Math.abs(v ?? 0).toFixed(digits)}%`;

const moneyFmt = (hidden) => {
  const full = (v, digits = 0) => {
    if (hidden) return '₹****';
    const n = v ?? 0;
    const s = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${n < 0 ? '−' : ''}₹${s}`;
  };
  const signed = (v) => (hidden ? '₹****' : `${v >= 0 ? '+' : '−'}${full(Math.abs(v))}`);
  // quantities say as much as amounts, so they hide with them; percentages, counts and dates stay
  const grams = (g) => (hidden ? '**** g' : `${g ?? 0} g`);
  const compact = (v) => (hidden ? '' : v >= 1e7 ? `₹${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}K` : `₹${Math.round(v)}`);
  return { full, signed, grams, compact };
};

const tone = (v) => ((v ?? 0) >= 0 ? GAIN : LOSS);

// ── Fonts ─────────────────────────────────────────────────────────────────────
const toBase64 = async (url) => {
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

let fontCache = null;
const loadFonts = async () => {
  fontCache ??= Promise.all([toBase64(geistRegularUrl), toBase64(geistSemiBoldUrl)]);
  return fontCache;
};

// ── The drawing kit ───────────────────────────────────────────────────────────
function makeKit(doc, autoTable, hidden) {
  const money = moneyFmt(hidden);
  let y = TOP;

  const font = (size, weight = 'normal', color = INK) => {
    doc.setFont('Geist', weight);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };

  const newPage = () => { doc.addPage(); y = TOP; };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };
  const gap = (h) => { y += h; };

  // A section's 16pt heading with a muted note at its right edge, as the screens' pinned headings
  const heading = (text, note) => {
    ensure(190); // the heading, its figures and the first rows of its table stay together
    font(15, 'bold');
    doc.text(text, M, y + 12);
    if (note) { font(9, 'normal', MUTED); doc.text(note, M + W, y + 12, { align: 'right' }); }
    y += 24;
  };

  // A row of figures in hairline boxes, like the summary panel's rows laid side by side
  const stats = (items) => {
    ensure(58);
    const n = items.length;
    const boxW = W / n;
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.75);
    doc.roundedRect(M, y, W, 50, 6, 6, 'S');
    items.forEach((s, i) => {
      const x = M + i * boxW;
      if (i > 0) doc.line(x, y, x, y + 50);
      font(7.5, 'normal', MUTED);
      doc.text(s.label.toUpperCase(), x + 12, y + 17, { charSpace: 0.3 });
      font(s.value.length > 14 ? 10.5 : 13, 'bold', s.color || INK);
      doc.text(s.value, x + 12, y + 36);
    });
    y += 64;
  };

  // A table, by the app's alignment rule: the name column and other words that identify a row
  // (`text` columns, e.g. category, holder) sit left; figures, dates and states sit right.
  // Cells may be strings or { content, color, bold }.
  const table = (head, rows, { widths, foot, text = [] } = {}) => {
    const left = (i) => i === 0 || text.includes(i);
    const columnStyles = {};
    head.forEach((_, i) => { columnStyles[i] = { halign: left(i) ? 'left' : 'right', ...(widths?.[i] ? { cellWidth: widths[i] } : {}) }; });
    const cell = (c) => (c && typeof c === 'object' ? { content: c.content, styles: { textColor: c.color || INK, fontStyle: c.bold ? 'bold' : 'normal' } } : c);
    ensure(60);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: PAGE_H - BOTTOM },
      head: [head.map((h, i) => ({ content: h.toUpperCase(), styles: { halign: left(i) ? 'left' : 'right' } }))],
      // every cell states its own colour, so none inherits the last coloured cell's
      body: rows.map((r) => r.map((c) => (c && typeof c === 'object' ? cell(c) : { content: c ?? '', styles: { textColor: INK, fontStyle: 'normal' } }))),
      foot: foot ? [foot.map((c, i) => ({ ...(typeof c === 'object' ? { content: c.content } : { content: c }), styles: { halign: left(i) ? 'left' : 'right', textColor: c?.color || INK } }))] : undefined,
      theme: 'plain',
      showHead: 'everyPage',
      showFoot: 'lastPage',
      styles: { font: 'Geist', fontSize: 8.5, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, lineColor: LINE, valign: 'middle', overflow: 'linebreak' },
      headStyles: { font: 'Geist', fontStyle: 'normal', fontSize: 7, textColor: MUTED, fillColor: SURFACE_STRONG, cellPadding: { top: 7, bottom: 7, left: 6, right: 6 } },
      footStyles: { font: 'Geist', fontStyle: 'bold', fillColor: SURFACE_STRONG },
      columnStyles,
      didDrawCell: (data) => {
        // hairlines between rows, as the lists on screen
        if (data.section === 'body') {
          doc.setDrawColor(LINE); doc.setLineWidth(0.5);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 22;
  };

  // A donut, its shares printed on the ring, the total in the hole
  const donut = (data, cx, cy, r, centre) => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let a = -Math.PI / 2;
    data.forEach((d) => {
      const a0 = a; const a1 = a + (d.value / total) * 2 * Math.PI; a = a1;
      const steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 90)));
      const pts = [[cx, cy]];
      for (let i = 0; i <= steps; i += 1) { const t = a0 + ((a1 - a0) * i) / steps; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
      const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
      doc.setFillColor(d.color);
      doc.lines(segs, cx, cy, [1, 1], 'F', true);
    });
    // white partings between slices, then the hole
    if (data.length > 1) {
      a = -Math.PI / 2;
      doc.setDrawColor('#ffffff'); doc.setLineWidth(1.5);
      data.forEach((d) => { doc.line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a)); a += (d.value / total) * 2 * Math.PI; });
    }
    doc.setFillColor('#ffffff');
    doc.circle(cx, cy, r * 0.5, 'F');
    a = -Math.PI / 2;
    data.forEach((d) => {
      const span = (d.value / total) * 2 * Math.PI;
      const share = (d.value / total) * 100;
      if (share >= 9) {
        const mid = a + span / 2; const rr = r * 0.75;
        font(6, 'bold', inkOn(d.color));
        doc.text(`${share.toFixed(2)}%`, cx + rr * Math.cos(mid), cy + rr * Math.sin(mid) + 2.6, { align: 'center' });
      }
      a += span;
    });
    if (centre) {
      font(6.5, 'normal', MUTED); doc.text(centre.label.toUpperCase(), cx, cy - 3, { align: 'center', charSpace: 0.3 });
      font(10, 'bold'); doc.text(centre.value, cx, cy + 10, { align: 'center' });
    }
  };

  // Charts two to a row, each in its own card: donuts (with their key) and a ranked list of returns
  const charts = (panels) => {
    const gapX = 10;
    const colW = (W - gapX) / 2;
    const r = 52;
    const heightOf = (p) => (p.kind === 'donut'
      ? 34 + r * 2 + 20 + p.data.length * 14 + (p.total ? 18 : 0) + (p.footnote ? 14 : 0) + 6
      : 34 + p.rows.length * 18 + 10);
    for (let i = 0; i < panels.length; i += 2) {
      const pair = panels.slice(i, i + 2);
      const h = Math.max(...pair.map(heightOf));
      ensure(h + 12);
      pair.forEach((p, j) => {
        const x0 = M + j * (colW + gapX);
        doc.setDrawColor(LINE); doc.setLineWidth(0.75);
        doc.roundedRect(x0, y, colW, h, 6, 6, 'S');
        font(7.5, 'normal', MUTED);
        doc.text(p.label.toUpperCase(), x0 + 14, y + 20, { charSpace: 0.3 });
        if (p.kind === 'donut') {
          const total = p.data.reduce((t, d) => t + d.value, 0) || 1;
          if (p.data.length) donut(p.data, x0 + colW / 2, y + 34 + r, r, p.centre);
          else { font(8, 'normal', MUTED); doc.text('nothing to show', x0 + colW / 2, y + 34 + r, { align: 'center' }); }
          let ky = y + 34 + r * 2 + 22;
          p.data.forEach((d) => {
            doc.setFillColor(d.color); doc.circle(x0 + 17, ky - 2.6, 2.6, 'F');
            font(8, 'normal', INK);
            doc.text(doc.splitTextToSize(d.name, p.amounts ? colW - 150 : colW - 90)[0], x0 + 25, ky);
            font(8, 'bold', INK);
            doc.text(`${((d.value / total) * 100).toFixed(2)}%`, x0 + colW - 14, ky, { align: 'right' });
            // value panels also give each part's exact amount, beside its share
            if (p.amounts) { font(8, 'normal', BODY); doc.text(money.full(d.value), x0 + colW - 62, ky, { align: 'right' }); }
            ky += 14;
          });
          if (p.total) {
            doc.setDrawColor(LINE); doc.setLineWidth(0.5);
            doc.line(x0 + 14, ky - 7, x0 + colW - 14, ky - 7);
            font(8, 'bold', INK);
            doc.text(p.total.label, x0 + 14, ky + 4);
            doc.text(money.full(p.total.value), x0 + colW - 14, ky + 4, { align: 'right' });
          }
          if (p.footnote) { font(7, 'normal', MUTED); doc.text(doc.splitTextToSize(p.footnote, colW - 28)[0], x0 + 14, y + h - 10); }
        } else {
          let ky = y + 44;
          p.rows.forEach((row) => {
            doc.setFillColor(row.color); doc.circle(x0 + 17, ky - 2.6, 2.6, 'F');
            font(8, 'normal', INK);
            doc.text(doc.splitTextToSize(row.name, colW - 90)[0], x0 + 25, ky);
            font(8, 'bold', tone(row.value));
            doc.text(pct(row.value), x0 + colW - 14, ky, { align: 'right' });
            doc.setDrawColor(LINE); doc.setLineWidth(0.5);
            doc.line(x0 + 14, ky + 6, x0 + colW - 14, ky + 6);
            ky += 18;
          });
        }
      });
      y += h + 10;
    }
    y += 4;
  };

  // Insights, two to a row, as small grey cards
  const insights = (list) => {
    if (!list.length) return;
    const colW = (W - 10) / 2;
    const rowsN = Math.ceil(list.length / 2);
    ensure(rowsN * 46 + 6);
    list.forEach((ins, i) => {
      const col = i % 2; const row = Math.floor(i / 2);
      const x = M + col * (colW + 10); const yy = y + row * 46;
      doc.setFillColor(SURFACE_STRONG);
      doc.roundedRect(x, yy, colW, 38, 5, 5, 'F');
      font(7, 'normal', MUTED); doc.text(ins.label.toUpperCase(), x + 10, yy + 13, { charSpace: 0.3 });
      font(10, 'bold', INK); doc.text(doc.splitTextToSize(ins.value, colW / 2)[0], x + 10, yy + 28);
      if (ins.note) { font(8, 'normal', BODY); doc.text(ins.note, x + colW - 10, yy + 28, { align: 'right' }); }
    });
    y += rowsN * 46 + 12;
  };

  const note = (text) => { ensure(20); font(9, 'normal', MUTED); doc.text(text, M, y + 8); y += 22; };

  return { font, heading, stats, table, charts, insights, note, gap, ensure, newPage, money, get y() { return y; } };
}

// Text on a coloured slice: near-black on light hues, white on dark ones
function inkOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.3 ? '#0a0a0a' : '#ffffff';
}

// The four chart panels: current value, invested and returns as donuts, then the return on each as a
// ranked list. A donut slice can't be negative, so the returns donut counts gains only and names the
// rest under it; the list shows every return, losses included.
const chartPanels = (rows, money, colorOf) => {
  const make = (pick) => rows.map((r) => ({ name: r.name, value: pick(r), color: colorOf(r) })).filter((d) => d.value > 0);
  const losers = rows.filter((r) => r.current - r.invested < 0).map((r) => r.name);
  const cur = make((r) => r.current); const inv = make((r) => r.invested); const ret = make((r) => r.current - r.invested);
  const sum = (d) => d.reduce((t, x) => t + x.value, 0);
  // the hole is small: ₹62.5L, not ₹62,47,641
  const short = (v) => money.compact(v) || '₹****';
  return [
    // each key gives every slice's exact amount beside its share, and the total under them
    { kind: 'donut', label: 'Current value', data: cur, amounts: true, centre: { label: 'Total', value: short(sum(cur)) }, total: { label: 'Total', value: sum(cur) } },
    { kind: 'donut', label: 'Invested', data: inv, amounts: true, centre: { label: 'Total', value: short(sum(inv)) }, total: { label: 'Total', value: sum(inv) } },
    { kind: 'donut', label: 'Returns', data: ret, amounts: true, centre: { label: 'Gains', value: short(sum(ret)) }, total: { label: losers.length ? 'Total gains' : 'Total', value: sum(ret) }, footnote: losers.length ? `At a loss, left out: ${losers.join(', ')}` : null },
    {
      kind: 'list',
      label: 'Return on what went in',
      rows: rows.filter((r) => r.invested > 0)
        .map((r) => ({ name: r.name, color: colorOf(r), value: ((r.current - r.invested) / r.invested) * 100 }))
        .sort((a, b) => b.value - a.value),
    },
  ];
};

// The app's value card as a donut: what went in and what it earned, the current value in the hole.
// At a loss the slices are what's left of the money put in and what was lost.
const valueSplit = (label, invested, current, money, { investedLabel = 'Invested', gainLabel = 'Gain' } = {}) => {
  const gain = current - invested;
  const data = (gain >= 0
    ? [{ name: investedLabel, value: invested, color: INVESTED }, { name: gainLabel, value: gain, color: GAIN }]
    : [{ name: `${investedLabel}, still there`, value: current, color: INVESTED }, { name: 'Loss', value: -gain, color: LOSS }]
  ).filter((d) => d.value > 0);
  return {
    kind: 'donut', label, data, amounts: true,
    centre: { label: 'Current', value: money.compact(current) || '₹****' },
    total: gain >= 0 ? { label: 'Current value', value: current } : { label: `${investedLabel} in total`, value: invested },
  };
};

// ── Sections ──────────────────────────────────────────────────────────────────
function mutualFundsSection(k, data) {
  const { full, signed } = k.money;
  const { funds = [], totals = {} } = data;
  const gain = (totals.totalCurrentValue || 0) - (totals.totalInvested || 0);
  k.heading('Mutual funds', `${funds.length} funds`);
  k.stats([
    { label: 'Balance', value: full(totals.totalCurrentValue) },
    { label: 'Invested', value: full(totals.totalInvested) },
    { label: 'Gain/Loss', value: `${signed(gain)}`, color: tone(gain) },
    { label: 'Monthly SIP', value: full(totals.monthlySIP) },
  ]);
  const cats = groupByCategory(funds);
  if (cats.length) {
    // every category keeps its own colour (by rank of current value), the same in all four panels
    const colour = Object.fromEntries(cats.map((c, i) => [c.category, SERIES[i % SERIES.length]]));
    k.charts(chartPanels(cats.map((c) => ({ name: c.category, invested: c.invested, current: c.current })), k.money, (row) => colour[row.name]));
    k.insights(fundInsights(funds));
  }
  const sorted = [...funds].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));
  k.table(
    ['Fund', 'Category', 'SIP / mo', 'Invested', 'Current', 'Returns', 'XIRR', 'Status'],
    sorted.map((f) => [
      { content: f.shortName || f.name, bold: true },
      f.category,
      f.currentMonthlySIP > 0 ? full(f.currentMonthlySIP) : '-',
      full(f.totalInvested),
      full(f.currentValue),
      { content: pct(f.returns), color: tone(f.returns) },
      `${(f.xirr ?? 0).toFixed(2)}%`,
      STATUS[f.status] ?? f.status ?? '-',
    ]),
    {
      widths: { 0: 110 },
      text: [1],
      foot: ['Total', '', full(totals.monthlySIP), full(totals.totalInvested), full(totals.totalCurrentValue), { content: pct(totals.totalReturns), color: tone(totals.totalReturns) }, '', ''],
    },
  );
}

function metalSection(k, label, data) {
  const { full, signed } = k.money;
  const { holdings = [], totals = {}, pricePerGram, sets = [] } = data;
  k.heading(label, `live ${full(pricePerGram)}/g`);
  k.stats([
    { label: 'Balance', value: full(totals.totalCurrentValue) },
    { label: 'Quantity', value: k.money.grams(totals.totalQuantity) },
    { label: 'Avg buy price', value: totals.totalQuantity > 0 ? `${full(totals.totalInvested / totals.totalQuantity)}/g` : '-' },
    { label: 'Gain/Loss', value: `${signed(totals.totalGain || 0)} (${pct(totals.totalGainPercent)})`, color: tone(totals.totalGain) },
  ]);
  if ((totals.totalCurrentValue || 0) > 0) k.charts([valueSplit('Invested and gain', totals.totalInvested || 0, totals.totalCurrentValue || 0, k.money)]);
  if (sets.length) {
    k.table(
      ['Set', 'Period', 'Quantity', 'Avg price', 'Invested', 'Current', 'Gain/Loss'],
      sets.map((s) => [
        { content: s.name, bold: true },
        s.from.slice(0, 7) === s.to.slice(0, 7) ? monthYear(s.from) : `${monthYear(s.from)} – ${monthYear(s.to)}`,
        k.money.grams(s.quantity),
        `${full(s.avgPrice)}/g`,
        full(s.invested),
        full(s.currentValue),
        { content: `${signed(s.gain)} (${pct(s.gainPercent)})`, color: tone(s.gain) },
      ]),
    );
  }
  if (holdings.length) {
    k.table(
      ['Holding', 'Bought on', 'Quantity', 'Bought at', 'Invested', 'Current', 'Gain/Loss'],
      holdings.map((h) => [
        { content: h.label, bold: true },
        dateLong(h.purchaseDate),
        k.money.grams(h.quantity),
        `${full(h.purchasePrice)}/g`,
        full(h.totalInvested),
        full(h.currentValue, 2),
        { content: `${signed(h.gain)} (${pct(h.gainPercent)})`, color: tone(h.gain) },
      ]),
      { foot: ['Total', '', k.money.grams(totals.totalQuantity), '', full(totals.totalInvested), full(totals.totalCurrentValue, 2), { content: signed(totals.totalGain || 0), color: tone(totals.totalGain) }] },
    );
  }
}

function fdSection(k, deposits) {
  const { full } = k.money;
  const sum = (key) => deposits.reduce((s, d) => s + (d[key] || 0), 0);
  k.heading('Fixed deposits', `${deposits.length} ${deposits.length === 1 ? 'deposit' : 'deposits'}`);
  k.stats([
    { label: 'Balance', value: full(sum('currentValue')) },
    { label: 'Principal', value: full(sum('principal')) },
    { label: 'Interest earned', value: full(sum('currentValue') - sum('principal')), color: GAIN },
    { label: 'At maturity', value: full(sum('finalMaturityAmount')) },
  ]);
  if (sum('currentValue') > 0) k.charts([valueSplit('Principal and interest', sum('principal'), sum('currentValue'), k.money, { investedLabel: 'Principal', gainLabel: 'Interest' })]);
  k.table(
    ['Deposit', 'Holder', 'Started', 'Matures', 'Rate', 'Principal', 'Current', 'At maturity'],
    deposits.map((d) => {
      const cycles = d.cycleData || [];
      const idx = Math.min(d.progress?.activeCycleIdx ?? d.activeCycleIdx ?? 0, cycles.length - 1);
      const last = cycles[cycles.length - 1];
      return [
        { content: `${d.bank || 'Unassigned'} · ${d.label}`, bold: true },
        d.name || '-',
        monthYear(d.startDate),
        last ? monthYear(last.maturityDate) : '-',
        cycles[idx] ? `${cycles[idx].rate}%` : '-',
        full(d.principal),
        full(d.currentValue),
        full(d.finalMaturityAmount),
      ];
    }),
    { widths: { 0: 120 }, text: [1], foot: ['Total', '', '', '', '', full(sum('principal')), full(sum('currentValue')), full(sum('finalMaturityAmount'))] },
  );
}

function epfSection(k, data) {
  const { full } = k.money;
  const { accounts = [], totalInvested = 0, currentValue = 0, gainPercent = 0 } = data;
  k.heading('EPF', `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}`);
  k.stats([
    { label: 'Balance', value: full(currentValue) },
    { label: 'Contributed', value: full(totalInvested) },
    { label: 'Interest', value: full(currentValue - totalInvested), color: GAIN },
    { label: 'Growth', value: pct(gainPercent), color: tone(gainPercent) },
  ]);
  if (currentValue > 0) k.charts([valueSplit('Contributed and interest', totalInvested, currentValue, k.money, { investedLabel: 'Contributed', gainLabel: 'Interest' })]);
  k.table(
    ['Account', 'Since', 'Months', 'Monthly', 'Rate', 'Contributed', 'Interest', 'Balance'],
    accounts.map((a) => [
      { content: a.label, bold: true },
      monthYear(a.startDate),
      `${a.monthsContributed}`,
      full(a.monthlyContribution),
      `${a.annualRate}%`,
      full(a.totalInvested),
      { content: full(a.currentValue - a.totalInvested), color: GAIN },
      full(a.currentValue),
    ]),
    { foot: ['Total', '', '', '', '', full(totalInvested), full(currentValue - totalInvested), full(currentValue)] },
  );
}

function overviewSection(k, overview) {
  const { full, signed } = k.money;
  const t = overview.totals || {};
  const assets = ASSETS.map((cfg) => {
    const a = overview.assets?.find((x) => x.id === cfg.id) || {};
    return { ...cfg, invested: a.invested || 0, current: a.current || 0, color: SERIES[cfg.slot] };
  }).filter((a) => a.invested > 0 || a.current > 0);
  k.stats([
    { label: 'Total balance', value: full(t.totalCurrentValue, 2) },
    { label: 'Invested', value: full(t.totalInvested) },
    { label: 'Gain/Loss', value: signed(t.totalGain || 0), color: tone(t.totalGain) },
    { label: 'Overall return', value: pct(t.totalGainPercent), color: tone(t.totalGainPercent) },
  ]);
  k.charts(chartPanels(assets.map((a) => ({ name: a.label, invested: a.invested, current: a.current, color: a.color })), k.money, (row) => row.color));
  k.insights(assetInsights(assets));
  k.table(
    ['Asset', 'Invested', 'Current', 'Gain/Loss', 'Return', 'Share'],
    assets.map((a) => {
      const g = a.current - a.invested;
      const r = a.invested > 0 ? (g / a.invested) * 100 : 0;
      return [
        { content: a.label, bold: true },
        full(a.invested),
        full(a.current),
        { content: signed(g), color: tone(g) },
        { content: pct(r), color: tone(r) },
        t.totalCurrentValue > 0 ? `${((a.current / t.totalCurrentValue) * 100).toFixed(2)}%` : '-',
      ];
    }),
    { foot: ['Total', full(t.totalInvested), full(t.totalCurrentValue), { content: signed(t.totalGain || 0), color: tone(t.totalGain) }, { content: pct(t.totalGainPercent), color: tone(t.totalGainPercent) }, '100.00%'] },
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────
/**
 * Builds and downloads the report for one page.
 * scope: 'overview' | 'mutualFunds' | 'gold' | 'silver' | 'fds' | 'epf'
 * hidden: a masked report: rupee amounts and grams turn into ****; percentages, counts and dates stay.
 * owner: the name printed at the top of the report.
 */
export async function downloadReport(scope, { hidden = false, owner = '' } = {}) {
  const [{ jsPDF }, { autoTable }, [regular, semibold]] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), loadFonts(),
  ]);

  // Only what this page needs; the overview needs all of it. A failed asset is noted, not fatal.
  const want = scope === 'overview' ? ['overview', 'mutualFunds', 'gold', 'silver', 'fds', 'epf'] : [scope];
  const loaders = {
    overview: getOverview, mutualFunds: getMutualFunds, gold: getGoldPortfolio, silver: getSilverPortfolio,
    fds: getFixedDeposits, epf: getEPFPortfolio,
  };
  const settled = await Promise.allSettled(want.map((id) => loaders[id]()));
  const data = Object.fromEntries(want.map((id, i) => [id, settled[i].status === 'fulfilled' ? settled[i].value : null]));
  if (want.every((id) => !data[id])) throw new Error('Nothing could be loaded for the report');

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('Geist-Regular.ttf', regular);
  doc.addFont('Geist-Regular.ttf', 'Geist', 'normal');
  doc.addFileToVFS('Geist-SemiBold.ttf', semibold);
  doc.addFont('Geist-SemiBold.ttf', 'Geist', 'bold');
  doc.setProperties({ title: `Vesta · ${TITLES[scope]}`, creator: 'Vesta' });

  const k = makeKit(doc, autoTable, hidden);
  const now = new Date();
  const missing = (label) => k.note(`${label} could not be loaded for this report.`);

  // The cover block on page one: whose report, the title, then the moment it describes (in IST)
  const ist = (opts) => now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
  if (owner) { k.font(8, 'normal', MUTED); doc.text(`PREPARED FOR ${owner.toUpperCase()}`, M, TOP - 2, { charSpace: 0.4 }); }
  k.font(22, 'bold');
  doc.text(TITLES[scope], M, TOP + 20);
  k.font(10, 'normal', BODY);
  doc.text(`As of ${ist({ day: '2-digit', month: 'long', year: 'numeric' })} at ${ist({ hour: '2-digit', minute: '2-digit', hour12: true })} IST`, M, TOP + 38);
  if (hidden) {
    // a quiet badge so a masked copy is never mistaken for a broken one
    k.font(7.5, 'bold', BODY);
    const label = 'MASKED · AMOUNTS HIDDEN';
    const tw = doc.getTextWidth(label) + 3;
    doc.setFillColor(SURFACE_STRONG); doc.roundedRect(M + W - tw - 16, TOP + 8, tw + 16, 18, 9, 9, 'F');
    doc.text(label, M + W - 8, TOP + 20, { align: 'right', charSpace: 0.3 });
  }
  k.gap(58);

  const sections = {
    overview: () => (data.overview ? overviewSection(k, data.overview) : missing('The overview')),
    mutualFunds: () => (data.mutualFunds ? mutualFundsSection(k, data.mutualFunds) : missing('Mutual funds')),
    gold: () => (data.gold?.holdings?.length ? metalSection(k, 'Gold', data.gold) : scope === 'gold' ? missing('Gold') : null),
    silver: () => (data.silver?.holdings?.length ? metalSection(k, 'Silver', data.silver) : scope === 'silver' ? missing('Silver') : null),
    fds: () => (data.fds?.fixedDeposits?.length ? fdSection(k, data.fds.fixedDeposits) : scope === 'fds' ? missing('Fixed deposits') : null),
    epf: () => (data.epf?.accounts?.length ? epfSection(k, data.epf) : scope === 'epf' ? missing('EPF') : null),
  };
  want.forEach((id, i) => {
    // on the overview the asset sections start on a fresh page after the summary, then follow on
    if (scope === 'overview' && id === 'mutualFunds') k.newPage();
    else if (i > 0) k.gap(8);
    sections[id]();
  });

  // Running head and foot on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    k.font(10, 'bold');
    doc.text('Vesta', M, 36);
    // page one's cover already names the report, the person and the time; later pages carry them here
    if (p > 1) {
      k.font(8.5, 'normal', MUTED);
      doc.text(owner ? `${TITLES[scope]} · ${owner}` : TITLES[scope], M + 34, 36);
      doc.text(`${ist({ day: '2-digit', month: 'short', year: 'numeric' })} IST`, M + W, 36, { align: 'right' });
    }
    doc.setDrawColor(LINE); doc.setLineWidth(0.75);
    doc.line(M, 46, M + W, 46);
    doc.line(M, PAGE_H - 34, M + W, PAGE_H - 34);
    k.font(7.5, 'normal', MUTED);
    doc.text(hidden ? 'Masked · amounts and quantities hidden, percentages shown' : 'Private · for your records only', M, PAGE_H - 22);
    doc.text(`${p} / ${pages}`, M + W, PAGE_H - 22, { align: 'right' });
  }

  const stamp = ist({ year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
  // a report from the public demo says so in its name: vesta-demo-overview-…pdf
  doc.save(`vesta-${IS_DEMO ? 'demo-' : ''}${scope === 'mutualFunds' ? 'mutual-funds' : scope}-${stamp}${hidden ? '-masked' : ''}.pdf`);
}
