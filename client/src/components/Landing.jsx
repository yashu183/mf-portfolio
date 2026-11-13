import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BigAmount from './portfolio/BigAmount';
import { hasActiveSession } from '../services/authService';
import { ArrowRight, Menu, X, LineChart, Landmark, Coins, Gem, PiggyBank, LayoutGrid, Check, Sparkles, EyeOff, Sun } from 'lucide-react';
import { VestaMark, ThemeToggle, WRAP } from './Navbar';
import { useTheme, chartPalette } from '../hooks/useTheme';

// The public landing page. It is built from the app's own tokens (index.css), mark and theme toggle,
// so it always matches the app and follows the same light/dark theme (Vercel DESIGN.md).

const UNLOCK = '/unlock';
const NAV = [
  { href: '#assets', label: 'Assets' },
  { href: '#advice', label: 'Advice' },
  { href: '#access', label: 'Access' },
];

const ASSETS = [
  { label: 'Funds', short: 'Mutual funds', pct: 46, icon: LineChart },
  { label: 'FDs', short: 'Fixed deposits', pct: 24, icon: Landmark },
  { label: 'EPF', short: 'EPF', pct: 13, icon: PiggyBank },
  { label: 'Gold', short: 'Gold', pct: 12, icon: Coins },
  { label: 'Silver', short: 'Silver', pct: 5, icon: Gem },
];

const Section = ({ id, children, className = '' }) => (
  <section id={id} className={`py-20 md:py-24 scroll-mt-16 ${className}`}>
    <div className={WRAP}>{children}</div>
  </section>
);

const Heading = ({ id, children, sub }) => (
  <div className="max-w-2xl mb-10 md:mb-12">
    <h2 id={id} className="text-[28px] md:text-[32px] leading-[1.25] text-ink">{children}</h2>
    {sub && <p className="mt-3 text-[18px] leading-[28px] text-body">{sub}</p>}
  </div>
);

// ── The product, drawn in the app's own components ─────────────────────────────

// Mirrors the app's Overview: the sidebar, the summary column, asset cards.
const OverviewMock = ({ palette }) => (
  <div className="card overflow-hidden text-left" role="img" aria-label="Vesta's overview: total balance with gain and return beside cards for mutual funds, fixed deposits, EPF and gold">
    <div aria-hidden="true">
      <div className="flex">
      {/* the app's sidebar */}
      <div className="hidden md:flex w-[168px] shrink-0 flex-col border-r border-line bg-surface text-[12px]">
        <div className="flex items-center gap-1.5 h-11 px-3 border-b border-line">
          <VestaMark size={15} /><span className="font-semibold text-ink">Vesta</span>
          <span className="ml-1 h-4 px-1.5 inline-flex items-center rounded-full bg-surface-strong font-mono text-[9px] text-muted">Private</span>
        </div>
        <div className="flex-1 p-2 space-y-0.5">
          {[['Overview', LayoutGrid, null], ['Mutual Funds', LineChart, 0], ['Gold', Coins, 3], ['Silver', Gem, 4], ['FDs', Landmark, 1], ['EPF', PiggyBank, 2]].map(([t, Icon, slot], i) => (
            <span key={t} className={`flex items-center gap-2 h-7 px-2 rounded-[5px] ${i === 0 ? 'bg-surface-strong text-ink font-medium' : 'text-body'}`}>
              <Icon className="w-3.5 h-3.5 text-ink" style={slot != null ? { color: palette.series[slot] } : undefined} strokeWidth={1.75} />{t}
            </span>
          ))}
        </div>
        <div className="p-2 border-t border-line space-y-0.5 text-body">
          <span className="flex items-center gap-2 h-7 px-2"><Sun className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} />Light theme</span>
          <span className="flex items-center gap-2 h-7 px-2"><EyeOff className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} />Hide amounts</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 h-11 px-4 border-b border-line bg-surface text-[14px] font-semibold text-ink">Welcome back</div>
      <div className="grid md:grid-cols-[220px_1fr] gap-4 p-4 bg-canvas">
        <div className="card overflow-hidden">
          <div className="p-4">
            <p className="eyebrow">Total balance</p>
            <p className="mt-3 text-[32px] leading-[36px] font-semibold tracking-[-0.045em] text-ink"><BigAmount value="₹18,42,610.52" masked={false} /></p>
            <p className="mt-1.5 num text-[12px] text-gain">↑ ₹3,52,610 (23.66%) all time</p>
          </div>
          {[['Invested', '₹14.90L', ''], ['Gain', '₹3.53L', 'text-gain'], ['Return', '23.66%', 'text-gain']].map(([l, v, c]) => (
            <div key={l} className="flex justify-between px-4 h-9 items-center border-t border-line text-[12px]"><span className="text-muted">{l}</span><span className={`num ${c || 'text-ink'}`}>{v}</span></div>
          ))}
        </div>
        <div className="hidden md:grid grid-cols-2 gap-3">
          {ASSETS.slice(0, 4).map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={a.label} className="card p-3.5 flex flex-col gap-2.5">
                <span className="flex items-center gap-2">
                  <span className="asset-plate !w-7 !h-7"><Icon className="w-3.5 h-3.5" style={{ color: palette.series[i] }} /></span>
                  <span><span className="block text-[12px] font-medium text-ink">{a.short}</span><span className="block font-mono text-[10px] text-muted">{a.pct}% of portfolio</span></span>
                </span>
                <span className="text-[18px] font-semibold tracking-[-0.03em] text-ink num">₹{(18.4 * a.pct / 100).toFixed(2)}L</span>
                <span className="h-1 rounded-full bg-surface-strong overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${a.pct * 2}%`, background: palette.series[i] }} /></span>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      </div>
    </div>
  </div>
);

const NavMock = ({ palette }) => {
  const bars = [52, 60, 56, 64, 58, 66, 62, 70, 64, 74, 68, 78, 72, 86];
  return (
    <div className="card p-5" aria-hidden="true">
      <div className="flex items-center justify-between text-[13px] text-body"><span>Mutual funds, XIRR</span><span className="px-3 h-7 inline-flex items-center rounded-full bg-surface-strong text-ink">Since April</span></div>
      <p className="mt-3 num text-[32px] text-ink">12.8% <span className="text-[14px] text-gain">↑ 1.6 pts</span></p>
      <div className="mt-4 flex items-end gap-1.5 h-24">
        {bars.map((h, i) => <span key={i} className="flex-1 rounded-t-[4px]" style={{ height: `${h}%`, background: i === bars.length - 1 ? palette.primary : palette.muted }} />)}
      </div>
    </div>
  );
};

// Mirrors the app's FD list: deployment-style rows with a progress bar.
const FdMock = () => (
  <div className="card divide-y divide-line" aria-hidden="true">
    {[
      { n: 'SBI · 2L - 444 d', m: 'cycle 2 of 2 · matures jun 27', v: '₹2,26,845', g: '+₹26,845', p: 75 },
      { n: 'SBI · 3L - 444 d', m: 'cycle 2 of 2 · matures jul 27', v: '₹3,38,890', g: '+₹38,890', p: 72 },
      { n: 'Suryoday SF · 2L', m: 'cycle 1 of 1 · matures nov 28', v: '₹2,07,592', g: '+₹7,592', p: 18 },
    ].map(r => (
      <div key={r.n} className="flex items-center gap-3 px-4 py-3">
        <span className="w-2 h-2 rounded-full bg-link shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink truncate">{r.n}</p>
          <p className="font-mono text-[11px] text-muted truncate">{r.m}</p>
        </div>
        <span className="hidden sm:block w-16 h-1 rounded-full bg-surface-strong overflow-hidden"><span className="block h-full rounded-full bg-ink" style={{ width: `${r.p}%` }} /></span>
        <div className="text-right">
          <p className="num text-[13px] text-ink">{r.v}</p>
          <p className="num text-[11px] text-gain">{r.g}</p>
        </div>
      </div>
    ))}
  </div>
);

const MetalsMock = () => (
  <div className="card divide-y divide-line" aria-hidden="true">
    {[
      { k: 'Au', n: 'Gold bonds 2024', s: '10 g · avg ₹6,200/g', v: '+90.3%' },
      { k: 'Au', n: 'Coins', s: '8 g · avg ₹5,480/g', v: '+62.9%' },
      { k: 'Ag', n: 'Silver coins', s: '500 g · avg ₹72/g', v: '−14.8%', down: true },
    ].map(r => (
      <div key={r.n} className="flex items-center gap-3 p-4">
        <span className="asset-plate">{r.k}</span>
        <div className="flex-1"><p className="text-[15px] font-semibold text-ink">{r.n}</p><p className="text-[13px] text-body num">{r.s}</p></div>
        <span className={`num text-[15px] ${r.down ? 'text-loss' : 'text-gain'}`}>{r.v}</span>
      </div>
    ))}
  </div>
);

// Mirrors the PDF report: a light page (the report always prints on white), its cover, figures,
// two donuts and a few rows. The switch flips it to the masked copy, as the app's PDF menu does.
const PdfMock = () => {
  const [masked, setMasked] = useState(false);
  const paper = chartPalette('light');
  const m = (v) => (masked ? '₹****' : v);
  const donut = (shares) => {
    let at = 0;
    return (
      <svg viewBox="0 0 42 42" className="w-full h-auto -rotate-90">
        {shares.map((p, i) => {
          const el = <circle key={i} cx="21" cy="21" r="15.9155" fill="none" stroke={paper.series[i]} strokeWidth="7" strokeDasharray={`${Math.max(p - 0.8, 0.4)} ${100 - Math.max(p - 0.8, 0.4)}`} strokeDashoffset={-at} />;
          at += p;
          return el;
        })}
      </svg>
    );
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[12px] text-muted">vesta-overview{masked ? '-masked' : ''}.pdf</span>
        <div className="flex p-0.5 rounded-md bg-surface-strong" role="group" aria-label="Report version">
          {[['Full', false], ['Masked', true]].map(([label, v]) => (
            <button key={label} type="button" onClick={() => setMasked(v)} aria-pressed={masked === v}
              className={`h-7 px-3 rounded-[5px] text-[12px] transition-colors cursor-pointer ${masked === v ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--c-ring),0_1px_2px_rgb(0_0_0/0.06)]' : 'text-body hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* the page itself, in the report's own light colours whatever the site theme */}
      <div aria-hidden="true" className="rounded-md p-4 md:p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_8px_24px_-12px_rgb(0_0_0/0.25)]" style={{ background: '#ffffff', color: '#171717' }}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#ebebeb' }}>
          <span className="text-[11px] font-semibold">Vesta</span>
          {masked && <span className="h-4 px-2 inline-flex items-center rounded-full text-[8px] font-semibold tracking-[0.04em]" style={{ background: '#f5f5f5', color: '#4d4d4d' }}>MASKED · AMOUNTS HIDDEN</span>}
        </div>
        <p className="mt-3 font-mono text-[8px] tracking-[0.04em]" style={{ color: '#6f6f6f' }}>PREPARED FOR YOU</p>
        <p className="text-[16px] font-semibold leading-tight">Portfolio report</p>
        <p className="text-[9px]" style={{ color: '#4d4d4d' }}>As of 13 November 2026 at 09:00 am IST</p>
        <div className="mt-3 grid grid-cols-4 rounded-[4px] border divide-x" style={{ borderColor: '#ebebeb' }}>
          {[['Balance', m('₹18.43L'), '#171717'], ['Invested', m('₹14.90L'), '#171717'], ['Gain/Loss', masked ? '₹****' : '+₹3.53L', '#1a7f37'], ['Return', '+23.66%', '#1a7f37']].map(([l, v, c]) => (
            <div key={l} className="px-2 py-1.5 min-w-0" style={{ borderColor: '#ebebeb' }}>
              <p className="text-[7px] tracking-[0.04em] uppercase" style={{ color: '#6f6f6f' }}>{l}</p>
              <p className="num text-[10px] font-semibold truncate" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[['Current value', [46, 24, 13, 12, 5]], ['Invested', [44, 27, 14, 11, 4]]].map(([title, shares]) => (
            <div key={title} className="rounded-[4px] border p-2" style={{ borderColor: '#ebebeb' }}>
              <p className="text-[7px] tracking-[0.04em] uppercase" style={{ color: '#6f6f6f' }}>{title}</p>
              <div className="mt-1 grid grid-cols-[52px_1fr] gap-2 items-center">
                {donut(shares)}
                <ul className="space-y-0.5">
                  {ASSETS.map((a, i) => (
                    <li key={a.label} className="flex items-center gap-1 text-[7.5px]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: paper.series[i] }} />
                      <span className="flex-1 truncate">{a.label}</span>
                      <span className="num font-semibold">{shares[i].toFixed(2)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[8px]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-1.5 py-1 uppercase tracking-[0.04em]" style={{ background: '#f5f5f5', color: '#6f6f6f' }}>
            <span>Asset</span><span className="text-right">Current</span><span className="text-right w-12">Gain/Loss</span>
          </div>
          {[['Mutual Funds', '₹8,46,000', '+18.91%', true], ['Fixed Deposits', '₹4,42,000', '+9.61%', true], ['Silver', '₹92,130', '−16.21%', false]].map(([n, v, g, up]) => (
            <div key={n} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-1.5 py-1 border-b" style={{ borderColor: '#ebebeb' }}>
              <span className="font-semibold">{n}</span>
              <span className="num text-right">{m(v)}</span>
              <span className="num text-right w-12" style={{ color: up ? '#1a7f37' : '#c50000' }}>{g}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TotalMock = ({ palette }) => (
  <div className="card p-5" aria-hidden="true">
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="space-y-2">
        {ASSETS.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={a.label} className="flex items-center gap-2 h-9 px-3 rounded-full bg-surface-strong text-[13px] text-ink">
              <Icon className="w-3.5 h-3.5" style={{ color: palette.series[i] }} /> {a.label}
            </div>
          );
        })}
      </div>
      <ArrowRight className="w-5 h-5 text-muted" />
      <div className="card p-4 text-center">
        <LayoutGrid className="w-6 h-6 mx-auto text-primary" />
        <p className="mt-2 text-[15px] font-semibold text-ink">Overview</p>
        <p className="num text-[13px] text-body">XIRR · timeline</p>
      </div>
    </div>
  </div>
);

const ChatMock = () => (
  <div className="card overflow-hidden" role="img" aria-label="Vesta's advice: asked where the next SIP should go, it points to a mid cap index fund to close a gap">
    <div className="flex items-center gap-2 h-12 px-5 border-b border-line" aria-hidden="true">
      <span className="asset-plate !w-7 !h-7"><Sparkles className="w-3.5 h-3.5 text-primary" /></span>
      <span className="text-[14px] font-semibold text-ink">Vesta advice</span>
      <span className="ml-auto text-[12px] text-muted">Claude on AWS Bedrock</span>
    </div>
    <div className="p-5 space-y-4" aria-hidden="true">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary text-on-primary px-4 py-2.5 text-[15px]">Where should my next ₹5,000 SIP go?</div>
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface-strong px-4 py-3 text-[15px] text-ink leading-relaxed">
        Mid cap is <span className="num">9%</span> of your funds against a <span className="num">15%</span> target. <b className="font-semibold">A mid cap index fund</b> closes that gap in about <span className="num">14</span> months.
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-body">
          <span className="h-6 px-2.5 inline-flex items-center rounded-full bg-canvas">Your allocation</span>
          <span className="h-6 px-2.5 inline-flex items-center rounded-full bg-canvas">mfapi.in NAV</span>
        </div>
      </div>
    </div>
    <div className="mx-5 mb-5 h-11 px-4 flex items-center rounded-full bg-surface-strong text-[14px] text-muted" aria-hidden="true">Ask about your portfolio</div>
  </div>
);

const LockMock = () => (
  <div className="card p-6 md:p-8 max-w-[400px] w-full mx-auto" role="img" aria-label="Vesta's code entry: six boxes, three filled, and the Enter portfolio button">
    <div aria-hidden="true">
      <span className="inline-flex items-center h-6 px-3 rounded-full bg-surface-strong text-[12px] font-semibold uppercase tracking-[0.04em] text-ink">Private</span>
      <p className="mt-4 text-[24px] text-ink">Enter access code</p>
      <p className="mt-1 text-[14px] text-body">Six digits, from your server settings.</p>
      <div className="mt-6 grid grid-cols-6 gap-2">
        {[1, 1, 1, 0, 0, 0].map((f, i) => (
          <span key={i} className={`h-12 rounded-xl grid place-items-center text-[20px] text-ink bg-canvas border ${i === 2 ? 'border-2 border-primary' : 'border-line'}`}>{f ? '•' : ''}</span>
        ))}
      </div>
      <span className="pill pill-primary w-full mt-6">Enter portfolio</span>
    </div>
  </div>
);

// ── The page ───────────────────────────────────────────────────────────────────

const Landing = () => {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => { document.title = 'Vesta: a private tracker for mutual funds, FDs, metals and EPF'; }, []);

  // Signed in already? The landing page is for visitors: go straight to Overview.
  // Visitors see the page at once; the check only redirects, it never holds the page back.
  useEffect(() => {
    let cancelled = false;
    hasActiveSession().then((active) => { if (active && !cancelled) navigate('/', { replace: true }); });
    return () => { cancelled = true; };
  }, [navigate]);

  const features = [
    { id: 'funds', title: "Values every fund at today's NAV", body: 'Replays each SIP and lump sum against the daily NAV from mfapi.in for its XIRR.', mock: <NavMock palette={palette} /> },
    { id: 'deposits', title: "Counts down to each FD's maturity", body: 'Each renewal keeps its own rate, term and the interest it paid.', mock: <FdMock /> },
    { id: 'metals', title: 'Averages gold and silver cost by set', body: 'Every purchase joins a set: average price per gram by set, year or total.', mock: <MetalsMock /> },
    { id: 'total', title: 'Adds five classes into one total', body: 'Funds, deposits, metals and EPF meet on one overview, with a timeline.', mock: <TotalMock palette={palette} /> },
    { id: 'reports', wide: true, title: 'Downloads a PDF report', body: 'The whole portfolio or one asset, with charts and insights. A masked copy hides every amount and keeps the percentages, so it is safe to share.', mock: <PdfMock /> },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 pill pill-secondary">Skip to content</a>

      {/* Navigation: the app's top bar, with page anchors and the one action */}
      <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur border-b border-line">
        <div className={`${WRAP} h-16 flex items-center gap-6`}>
          <a href="#top" className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] text-ink shrink-0"><VestaMark /> Vesta</a>
          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {NAV.map(n => <a key={n.href} href={n.href} className="inline-flex items-center h-9 px-3.5 rounded-full text-[14px] font-medium text-body hover:text-ink hover:bg-surface-strong transition-colors">{n.label}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to={UNLOCK} className="pill pill-sm pill-primary hidden sm:inline-flex">Open your portfolio</Link>
            <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="landing-menu" aria-label={open ? 'Close menu' : 'Open menu'} className="md:hidden inline-grid place-items-center w-10 h-10 rounded-full bg-surface-strong text-ink cursor-pointer">
              {open ? <X className="w-[18px] h-[18px]" aria-hidden="true" /> : <Menu className="w-[18px] h-[18px]" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="landing-menu" aria-label="Main" className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-canvas px-4 py-4 flex flex-col gap-1">
            {NAV.map(n => <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex items-center h-14 px-4 rounded-2xl text-[17px] font-medium text-ink hover:bg-surface-strong">{n.label}</a>)}
            <Link to={UNLOCK} className="pill pill-round pill-primary mt-4">Open your portfolio</Link>
          </nav>
        )}
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden pt-16 md:pt-24 pb-20 md:pb-28">
          {/* Vercel's mesh gradient: the one decoration, at hero scale only */}
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-120px] -translate-x-1/2 w-[1100px] h-[620px] opacity-[0.22] [[data-theme=dark]_&]:opacity-[0.30] blur-[90px]"
            style={{ background: 'radial-gradient(closest-side at 22% 55%, #007cf0, transparent), radial-gradient(closest-side at 40% 35%, #00dfd8, transparent), radial-gradient(closest-side at 60% 40%, #7928ca, transparent), radial-gradient(closest-side at 72% 60%, #ff0080, transparent), radial-gradient(closest-side at 85% 45%, #f9cb28, transparent)' }} />
          <div className={`${WRAP} relative text-center`}>
            <h1 className="mt-6 mx-auto max-w-[15ch] text-[40px] sm:text-[52px] md:text-[64px] leading-[1.05] tracking-[-0.05em] text-ink">Vesta, a private portfolio tracker.</h1>
            <p className="mx-auto mt-6 max-w-[56ch] text-[17px] md:text-[18px] leading-[28px] text-body">
              Mutual funds at today's NAV, fixed deposits, gold, silver and EPF - 5 asset classes on one dashboard, with XIRR and a year-by-year timeline.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link to={UNLOCK} className="pill pill-round pill-primary">Open your portfolio <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
              <a href="#advice" className="pill pill-round pill-secondary">See SIP advice</a>
            </div>
            <div className="mt-14 md:mt-16 mx-auto max-w-[960px] rounded-2xl p-2 bg-surface/60 backdrop-blur shadow-[0_0_0_1px_var(--c-ring),var(--c-shadow-float)]">
              <OverviewMock palette={palette} />
            </div>
          </div>
        </section>

        {/* Assets */}
        <Section id="assets" className="bg-surface border-y border-line">
          <Heading id="assets-h" sub="Each keeps its own page and maths.">5 asset classes on one dashboard.</Heading>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map(f => (
              <article key={f.id} id={f.id} className={`card p-6 md:p-8 flex flex-col gap-6 scroll-mt-20 ${f.wide ? 'md:col-span-2 lg:grid lg:grid-cols-[1fr_1.25fr] lg:items-center lg:gap-10' : ''}`}>
                <div>
                  <h3 className="text-[18px] leading-[1.33] text-ink">{f.title}</h3>
                  <p className="mt-2 text-[16px] leading-[1.5] text-body">{f.body}</p>
                </div>
                <div className={`rounded-lg bg-canvas p-3 md:p-4 shadow-[inset_0_0_0_1px_var(--c-line)] ${f.wide ? 'lg:mt-0' : 'mt-auto'}`}>{f.mock}</div>
              </article>
            ))}
          </div>
        </Section>

        {/* Advice */}
        <Section id="advice">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <Heading id="advice-h" sub="Vesta sends your current allocation to Claude on AWS Bedrock and gets back funds that fill the gaps.">Portfolio advice from Claude.</Heading>
              <ul className="space-y-3 -mt-4">
                {['Lists only funds that take SIPs', 'Filters by name and category', 'Sets a target split beside your own'].map(t => (
                  <li key={t} className="flex items-center gap-3 text-[16px] text-ink">
                    <span className="asset-plate !w-7 !h-7"><Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" /></span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-surface-strong p-2"><ChatMock /></div>
          </div>
        </Section>

        {/* Access */}
        <Section id="access" className="bg-surface border-y border-line">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <Heading id="access-h" sub="Checked on the server; nothing loads until it is.">Your portfolio opens with a 6-digit code.</Heading>
              <dl className="grid sm:grid-cols-3 lg:grid-cols-1 gap-6 -mt-2">
                {[
                  ['6 digits', 'in the code, kept on the server and never in the browser'],
                  ['60 minutes', 'to a session before Vesta locks itself again'],
                  ['10 tries', 'per address every 15 minutes, then it waits'],
                ].map(([v, t]) => (
                  <div key={v}>
                    <dt className="text-[28px] font-semibold tracking-[-0.04em] text-ink tabular-nums">{v}</dt>
                    <dd className="mt-1 text-[15px] text-body">{t}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <LockMock />
          </div>
        </Section>

        {/* Close: Coinbase's CTA band */}
        <section className="py-20 md:py-28">
          <div className={WRAP}>
            <div className="rounded-xl bg-[#171717] text-white [[data-theme=dark]_&]:bg-surface [[data-theme=dark]_&]:shadow-[0_0_0_1px_var(--c-ring)] px-6 py-14 md:px-16 md:py-20 text-center">
              <h2 className="text-[32px] md:text-[48px] leading-[1.05] tracking-[-0.05em]">Open your portfolio.</h2>
              <p className="mt-4 text-[18px] text-[#a1a1a1]">Have your six-digit code ready.</p>
              <Link to={UNLOCK} className="pill pill-round bg-white text-[#171717] hover:bg-[#ededed] mt-8">Open your portfolio <ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${WRAP} py-12 grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]`}>
          <div>
            <a href="#top" className="flex items-center gap-2 text-[18px] font-semibold text-ink"><VestaMark size={20} /> Vesta</a>
            <p className="mt-3 text-[14px] text-body max-w-[32ch]">A private tracker for funds, deposits, metals and EPF.</p>
          </div>
          {[
            ['Assets', [['Mutual funds', '#funds'], ['Fixed deposits', '#deposits'], ['Gold and silver', '#metals']]],
            ['Advice', [['SIP ideas', '#advice']]],
            ['Access', [['Access code', '#access']]],
          ].map(([h, links]) => (
            <div key={h}>
              <h3 className="eyebrow">{h}</h3>
              <ul className="mt-3 space-y-2">{links.map(([l, href]) => <li key={l}><a href={href} className="text-[14px] text-body hover:text-ink">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className={`${WRAP} pb-10 text-[13px] text-muted`}>© 2026 Vesta</div>
      </footer>
    </div>
  );
};

export default Landing;
