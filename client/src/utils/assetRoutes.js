import { PieChart, BarChart3, Target, TrendingUp, CalendarDays } from 'lucide-react';

// Single source of truth for the top-level asset tabs and their URLs.
export const ASSET_TABS = [
  { id: 'overview', label: 'Overview', path: '/' },
  { id: 'mutualFunds', label: 'Mutual Funds', path: '/mutual-funds' },
  { id: 'gold', label: 'Gold', path: '/gold' },
  { id: 'silver', label: 'Silver', path: '/silver' },
  { id: 'fds', label: 'FDs', path: '/fds' },
  { id: 'epf', label: 'EPF', path: '/epf' },
];

export const ASSET_PATHS = ASSET_TABS.reduce((acc, tab) => {
  acc[tab.id] = tab.path;
  return acc;
}, {});

// Sub-views within the Mutual Funds asset, nested under /mutual-funds/:view.
export const MUTUAL_FUND_VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: PieChart },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'allocation', label: 'Allocation', icon: BarChart3 },
  { id: 'recommendations', label: 'Recommendations', icon: Target },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
];

export const mutualFundViewPath = (viewId) =>
  viewId === 'dashboard' ? ASSET_PATHS.mutualFunds : `${ASSET_PATHS.mutualFunds}/${viewId}`;
