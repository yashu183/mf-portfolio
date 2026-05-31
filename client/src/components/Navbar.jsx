import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const ASSET_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'mutualFunds', label: 'Mutual Funds' },
  { id: 'gold', label: 'Gold' },
  { id: 'silver', label: 'Silver' },
  { id: 'fds', label: 'FDs' },
  { id: 'epf', label: 'EPF' },
];

const Navbar = ({ activeAsset, onAssetChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  });

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

  const handleSelect = (id) => {
    onAssetChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 px-4 md:px-8 py-2">
      {/* Desktop: horizontal tab row */}
      {!isMobileView && <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        <h4 className="text-primary text-xl md:text-2xl font-bold tracking-wide whitespace-nowrap">
          Vesta
        </h4>
        <div className="flex items-center gap-2 overflow-x-auto">
          {ASSET_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeAsset === tab.id
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>}

      {/* Mobile: collapsed selector with hamburger */}
      {isMobileView && <div className="p-2">
        <p className="px-1 pb-2 text-sm font-semibold tracking-wide text-primary">Vesta</p>
        <div className="flex items-center justify-between rounded-lg bg-black/30 border border-gray-800 px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">Assets</p>
            <p className="text-sm font-semibold text-white">
              {ASSET_TABS.find((tab) => tab.id === activeAsset)?.label}
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
              <button
                key={tab.id}
                onClick={() => handleSelect(tab.id)}
                className={`w-full text-left px-4 py-3 text-sm font-medium border-b last:border-b-0 border-gray-800 transition-colors ${
                  activeAsset === tab.id
                    ? 'text-white bg-primary/80'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>}
    </nav>
  );
};

export default Navbar;
