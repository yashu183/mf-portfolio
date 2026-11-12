import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Sun, Moon, Eye, EyeOff, Lock, Menu, ArrowLeftToLine, LayoutGrid, LineChart, Coins, Gem, Landmark, PiggyBank } from 'lucide-react';
import { ASSET_TABS, MUTUAL_FUND_VIEWS } from '../utils/assetRoutes';
import { useTheme, chartPalette } from '../hooks/useTheme';
import { usePrivacy } from '../hooks/usePrivacy';
import { logout } from '../services/authService';

// Vesta's mark: four dots, the last one squared, in the ink colour (it flips with the theme).
export const VestaMark = ({ size = 22, color = 'var(--c-ink)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="4.5" /><circle cx="17.5" cy="6.5" r="4.5" /><circle cx="6.5" cy="17.5" r="4.5" /><rect x="13" y="13" width="9" height="9" rx="1.5" />
  </svg>
);

// The content column, as Vercel's dashboard holds it.
export const WRAP = 'w-full max-w-[1200px] mx-auto px-4 sm:px-6';

// Vercel's icon-button-circular: canvas fill, a hairline ring.
// Mercury's eye, kept with the navigation because it covers the whole app: every rupee figure turns to
// asterisks, percentages stay. Same round button as the theme switch beside it.
export const HideAmountsToggle = ({ className = '' }) => {
  const { hidden, toggle } = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
      className={`inline-grid place-items-center w-9 h-9 rounded-full bg-surface text-body hover:text-ink shadow-[0_0_0_1px_var(--c-line-strong)] transition-colors cursor-pointer ${className}`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
};

export const ThemeToggle = ({ className = '' }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={`inline-grid place-items-center w-9 h-9 rounded-full bg-surface text-body hover:text-ink shadow-[0_0_0_1px_var(--c-line-strong)] transition-colors cursor-pointer ${className}`}
    >
      {dark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
};

// Each asset's icon, the same set the landing page draws, in the asset's chart colour
// (the slot it holds on Overview's cards and charts); Overview itself stays ink.
const ASSET_ICONS = { overview: LayoutGrid, mutualFunds: LineChart, gold: Coins, silver: Gem, fds: Landmark, epf: PiggyBank };
const ASSET_SLOT = { mutualFunds: 0, fds: 1, epf: 2, gold: 3, silver: 4 };

// The sidebar's foot, stacked rows: the two switches (named for what clicking will do), then Lock.
const SidebarSwitches = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { hidden, toggle: toggleHidden } = usePrivacy();
  const dark = theme === 'dark';
  const row = 'w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[14px] text-body hover:text-ink hover:bg-surface-strong/60 transition-colors cursor-pointer';
  const [locking, setLocking] = useState(false);
  // End the session on the server, then let AccessGate do the rest (clear cached data, go to the landing page)
  const lock = async () => {
    setLocking(true);
    await logout();
    window.dispatchEvent(new Event('portfolio:locked'));
  };
  const ThemeIcon = dark ? Sun : Moon;
  const EyeIcon = hidden ? Eye : EyeOff;
  return (
    <div className="shrink-0 px-3 py-3 border-t border-line space-y-0.5">
      <button type="button" onClick={toggleTheme} className={row}>
        <ThemeIcon className="w-4 h-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
        {dark ? 'Light theme' : 'Dark theme'}
      </button>
      <button type="button" onClick={toggleHidden} aria-pressed={hidden} className={row}>
        <EyeIcon className="w-4 h-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
        {hidden ? 'Show amounts' : 'Hide amounts'}
      </button>
      <button type="button" onClick={lock} disabled={locking} className={`${row} disabled:opacity-60 disabled:cursor-default`}>
        <Lock className="w-4 h-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
        {locking ? 'Locking…' : 'Lock'}
      </button>
    </div>
  );
};

const itemClass = (active) =>
  `flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[14px] transition-colors ${active ? 'bg-surface-strong text-ink font-medium' : 'text-body hover:text-ink hover:bg-surface-strong/60'}`;

// The sidebar's contents, shared by the fixed sidebar (desktop) and the drawer (phones, tablets):
// the mark, every asset, the switches at the foot. (Mutual Funds' sections are tabs in its page head.)
const SidebarContent = ({ onNavigate, closeButton }) => {
  const { theme } = useTheme();
  const palette = chartPalette(theme);
  return (
    <div className="h-full flex flex-col">
      <div className="h-14 shrink-0 flex items-center gap-2 px-4 border-b border-line">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.02em] text-ink">
          <VestaMark /> Vesta
        </Link>
        <span className="inline-flex items-center h-5 px-2 rounded-full bg-surface-strong font-mono text-[11px] text-muted">Private</span>
        {closeButton}
      </div>
      <nav aria-label="Portfolio" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="eyebrow px-2.5 mb-2">Portfolio</p>
        <ul className="space-y-0.5">
          {ASSET_TABS.map((tab) => {
            const Icon = ASSET_ICONS[tab.id];
            const isFunds = tab.id === 'mutualFunds';
            return (
              <li key={tab.id}>
                <NavLink to={tab.path} end={!isFunds} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
                  {({ isActive }) => (
                    <>
                      <Icon className="w-4 h-4 shrink-0 text-ink" style={tab.id in ASSET_SLOT ? { color: palette.series[ASSET_SLOT[tab.id]] } : undefined} strokeWidth={1.75} aria-hidden="true" />
                      {tab.label}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <SidebarSwitches />
    </div>
  );
};

// The page you're on, for the slim bar on small screens ("Mutual Funds · Timeline").
const usePageLabel = () => {
  const { pathname } = useLocation();
  const tab = [...ASSET_TABS].reverse().find((t) => (t.path === '/' ? pathname === '/' : pathname.startsWith(t.path)));
  if (tab?.id !== 'mutualFunds') return tab?.label ?? 'Overview';
  const view = MUTUAL_FUND_VIEWS.find((v) => v.id === (pathname.split('/')[2] || 'dashboard'));
  return view ? `${tab.label} · ${view.label}` : tab.label;
};

// Vercel's dashboard sidebar: fixed on the left from 1024px; below that a slim bar stays at the top
// and the same sidebar slides in as a drawer from the hamburger.
const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const label = usePageLabel();
  const drawerRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const drawer = drawerRef.current;
    const focusables = () => [...drawer.querySelectorAll('a[href], button:not([disabled])')];
    drawer.focus(); // the panel itself, so no link shows a focus ring until you tab
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;
      // keep focus inside the drawer while it's open
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const opener = openerRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-[240px] bg-surface border-r border-line">
        <SidebarContent />
      </aside>

      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center gap-2 px-3 sm:px-4 bg-surface/90 backdrop-blur-md border-b border-line">
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="nav-drawer"
          className="grid place-items-center w-9 h-9 rounded-md text-ink hover:bg-surface-strong transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <Link to="/" aria-label="Vesta, overview"><VestaMark size={20} /></Link>
        <span className="min-w-0 truncate text-[14px] font-medium text-ink">{label}</span>
        <div className="ml-auto flex items-center gap-2"><HideAmountsToggle /><ThemeToggle /></div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50 animate-[fade-in_150ms_ease-out]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="nav-drawer" ref={drawerRef} tabIndex={-1} className="outline-none absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface shadow-[0_0_0_1px_var(--c-line),0_24px_48px_rgb(0_0_0/0.25)] animate-[drawer-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]">
            <SidebarContent
              onNavigate={() => setOpen(false)}
              closeButton={
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="ml-auto grid place-items-center w-9 h-9 rounded-full bg-surface-strong text-body hover:text-ink transition-colors cursor-pointer">
                  <ArrowLeftToLine className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              }
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
