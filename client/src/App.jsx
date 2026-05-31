import React, { useState } from 'react';
import Navbar from './components/Navbar';
import PortfolioTracker from './components/PortfolioTracker';

const App = () => {
  const [activeAsset, setActiveAsset] = useState('overview');

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar activeAsset={activeAsset} onAssetChange={setActiveAsset} />
      <PortfolioTracker activeAsset={activeAsset} onAssetChange={setActiveAsset} />
    </div>
  );
};

export default App;
