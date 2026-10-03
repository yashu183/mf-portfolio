import React, { useState } from 'react';
import Navbar from './components/Navbar';
import PortfolioTracker from './components/PortfolioTracker';
import AccessGate from './components/AccessGate';

const App = () => {
  const [activeAsset, setActiveAsset] = useState('overview');

  return (
    <AccessGate>
    <div className="min-h-screen bg-black text-white">
      <Navbar activeAsset={activeAsset} onAssetChange={setActiveAsset} />
      <PortfolioTracker activeAsset={activeAsset} onAssetChange={setActiveAsset} />
    </div>
    </AccessGate>
  );
};

export default App;
