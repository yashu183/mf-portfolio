import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PortfolioTracker from './components/PortfolioTracker';
import AccessGate from './components/AccessGate';
import Landing from './components/Landing';
import { PrivacyMask } from './hooks/usePrivacy';
import { IS_DEMO, DEMO_BASE } from './utils/demo';

// The app's own routes, the same for the owner and the demo
const AppRoutes = () => (
  <div className="min-h-screen bg-canvas text-ink lg:pl-[240px]">
    <PrivacyMask />
    <Navbar />
    <Routes>
      <Route path="/" element={<PortfolioTracker activeAsset="overview" />} />
      <Route path="/mutual-funds" element={<PortfolioTracker activeAsset="mutualFunds" />} />
      <Route path="/mutual-funds/:view" element={<PortfolioTracker activeAsset="mutualFunds" />} />
      <Route path="/gold" element={<PortfolioTracker activeAsset="gold" />} />
      <Route path="/silver" element={<PortfolioTracker activeAsset="silver" />} />
      <Route path="/fds" element={<PortfolioTracker activeAsset="fds" />} />
      <Route path="/epf" element={<PortfolioTracker activeAsset="epf" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </div>
);

const App = () => {
  // The demo is the whole app under /demo with no access code: every link inside it stays under /demo
  if (IS_DEMO) {
    return (
      <BrowserRouter basename={DEMO_BASE}>
        <AppRoutes />
      </BrowserRouter>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: the landing page, outside the access gate */}
        <Route path="/welcome" element={<Landing />} />
        <Route path="*" element={<AccessGate><AppRoutes /></AccessGate>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
