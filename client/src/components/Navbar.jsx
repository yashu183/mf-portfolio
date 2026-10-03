import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ASSET_TABS } from '../utils/assetRoutes';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const location = useLocation();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleViewportChange = (event) => {
      setIsMobileView(event.matches);
      if (!event.matches) {
        setMobileMenuOpen(false);
      }
    };

    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  const activeTab = ASSET_TABS.find((tab) =>
    tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path)
  );

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 px-4 md:px-8 py-2">
      {/* Desktop: horizontal tab row */}
      {!isMobileView && <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        <Link to="/" className="text-primary text-xl md:text-2xl font-bold tracking-wide whitespace-nowrap transition-colors">
          Vesta
        </Link>
        <div className="flex items-center gap-2 overflow-x-auto">
          {ASSET_TABS.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) => `px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>}

      {/* Mobile: collapsed selector with hamburger */}
      {isMobileView && <div className="p-2">
        <Link to="/" className="block px-1 pb-2 text-sm font-semibold tracking-wide text-primary w-fit">Vesta</Link>
        <div className="flex items-center justify-between rounded-lg bg-black/30 border border-gray-800 px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">Assets</p>
            <p className="text-sm font-semibold text-white">
              {activeTab?.label}
            </p>
          </div>
          <button
            aria-label="Toggle asset navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-md bg-gray-800/70 border border-gray-700 text-gray-200"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="mt-2 rounded-lg border border-gray-800 bg-black/40 overflow-hidden">
            {ASSET_TABS.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.path === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `block w-full text-left px-4 py-3 text-sm font-medium border-b last:border-b-0 border-gray-800 transition-colors ${
                  isActive
                    ? 'text-white bg-primary/80'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/70'
                }`}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>}
    </nav>
  );
};

export default Navbar;
