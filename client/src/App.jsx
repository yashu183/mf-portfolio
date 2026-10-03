import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import PortfolioTracker from './components/PortfolioTracker';
import AccessGate from './components/AccessGate';

const App = () => {
  return (
    <BrowserRouter>
      <AccessGate>
        <div className="min-h-screen bg-black text-white">
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
      </AccessGate>
    </BrowserRouter>
  );
};

export default App;
