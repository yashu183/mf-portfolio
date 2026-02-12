import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, PieChart, BarChart3, AlertCircle, CheckCircle, Clock, IndianRupee, Calendar, Target, RefreshCw, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { fetchAllCurrentNAVs, calculateAllCurrentValues, areMarketsOpen, clearCache } from '../services/mutualFundAPI';

const PortfolioTracker = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedFund, setSelectedFund] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date()); // Current date
  
  // API related state
  const [navData, setNavData] = useState({});
  const [isLoadingNAV, setIsLoadingNAV] = useState(false);
  const [lastNAVUpdate, setLastNAVUpdate] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [calculatedValues, setCalculatedValues] = useState({});

  // Fetch NAV data from API
  const fetchNAVData = async () => {
    setIsLoadingNAV(true);
    setApiError(null);
    try {
      console.log('🚀 Starting NAV data fetch and calculations...');
      
      // Fetch current NAV data for display
      const currentNavData = await fetchAllCurrentNAVs();
      setNavData(currentNavData);
      setLastNAVUpdate(new Date());
      
      console.log('📊 Current NAV data fetched, now calculating precise values...');
      
      // Calculate current values for all funds using precise historical NAV
      const preciseCalculatedValues = await calculateAllCurrentValues(portfolioDataWithDates);
      setCalculatedValues(preciseCalculatedValues);
      
      console.log('✅ All calculations completed!');
      console.log('Calculated Values:', preciseCalculatedValues);
      
    } catch (error) {
      setApiError('Failed to fetch NAV data and calculate values. Using fallback values.');
      console.error('NAV fetch and calculation error:', error);
    } finally {
      setIsLoadingNAV(false);
    }
  };

  // Manual refresh function that clears cache
  const handleManualRefresh = async () => {
    clearCache(); // Clear all cached data first
    await fetchNAVData(); // Then fetch fresh data
  };

  // Fetch NAV data on component mount and every 30 minutes
  useEffect(() => {
    fetchNAVData();
    
    // Auto-refresh every 30 minutes (historical NAV data doesn't change frequently)
    const interval = setInterval(() => {
      if (areMarketsOpen()) {
        fetchNAVData();
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper function to calculate months between two dates
  const getMonthsDifference = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(0, months + 1);
  };

  // Helper function to calculate years difference
  const getYearsDifference = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (end - start) / (1000 * 60 * 60 * 24 * 365.25);
  };

  // XIRR Calculation (simplified Newton-Raphson method)
  const calculateXIRR = (cashFlows, guess = 0.1) => {
    const maxIterations = 100;
    const tolerance = 0.0001;
    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      cashFlows.forEach(cf => {
        const years = (cf.date - cashFlows[0].date) / (1000 * 60 * 60 * 24 * 365.25);
        npv += cf.amount / Math.pow(1 + rate, years);
        dnpv -= cf.amount * years / Math.pow(1 + rate, years + 1);
      });

      const newRate = rate - npv / dnpv;
      
      if (Math.abs(newRate - rate) < tolerance) {
        return newRate * 100; // Convert to percentage
      }
      
      rate = newRate;
    }

    return rate * 100;
  };

  // Calculate CAGR for lumpsum investments
  const calculateCAGR = (initialValue, finalValue, years) => {
    if (years <= 0 || initialValue <= 0) return 0;
    return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
  };

  // Portfolio data with start dates
  const portfolioDataWithDates = [
    {
      id: 1,
      name: "Aditya Birla Sun Life ELSS Tax Saver Fund",
      shortName: "Aditya Birla ELSS",
      category: "ELSS",
      // Lumpsum
      lumpsumAmount: 15000,
      lumpsumDate: new Date('2022-07-26'),
      // SIP
      sipAmount: 3000,
      sipStartDate: new Date('2022-09-05'),
      color: "#c2f7ae"
    },
    {
      id: 2,
      name: "HDFC ELSS Tax Saver",
      shortName: "HDFC ELSS",
      category: "ELSS",
      // Multiple lumpsums
      lumpsums: [
        { amount: 25000, date: new Date('2022-09-02') },
        { amount: 14000, date: new Date('2022-12-06') }
      ],
      sipAmount: 0,
      sipStartDate: null,
      color: "#4ECDC4"
    },
    {
      id: 3,
      name: "ICICI Pru ELSS Tax Saver Fund",
      shortName: "ICICI Pru ELSS",
      category: "ELSS",
      lumpsums: [
        { amount: 15000, date: new Date('2022-09-11') },
        { amount: 14000, date: new Date('2022-12-06') }
      ],
      sipAmount: 0,
      sipStartDate: null,
      color: "#95E1D3"
    },
    {
      id: 4,
      name: "Nippon India ELSS Tax Saver Fund",
      shortName: "Nippon ELSS",
      category: "ELSS",
      lumpsumAmount: 20000,
      lumpsumDate: new Date('2022-08-24'),
      sipAmount: 4000,
      sipStartDate: new Date('2022-09-05'),
      color: "#8381f3"
    },
    {
      id: 5,
      name: "Nippon India Small Cap Fund",
      shortName: "Nippon Small Cap",
      category: "Small Cap",
      lumpsumAmount: 6000,
      lumpsumDate: new Date('2024-08-06'),
      sipAmount: 6000,
      sipStartDate: new Date('2024-09-04'),
      color: "#AA96DA"
    },
    {
      id: 6,
      name: "ICICI Pru Large & Mid Cap Fund",
      shortName: "ICICI L&M Cap",
      category: "Large & Mid Cap",
      lumpsumAmount: 5000,
      lumpsumDate: new Date('2025-08-11'),
      sipAmount: 5000,
      sipStartDate: new Date('2025-09-05'),
      color: "#FCBAD3"
    },
    {
      id: 7,
      name: "Nippon India Growth Mid Cap Fund",
      shortName: "Nippon Growth Mid Cap",
      category: "Mid Cap",
      lumpsums: [
        { amount: 2000, date: new Date('2023-02-13') },
        { amount: 2000, date: new Date('2023-02-14') }
      ],
      sipAmount: 2000,
      sipStartDate: new Date('2023-04-05'),
      color: "#FFFFD2"
    },
    {
      id: 8,
      name: "HDFC Mid Cap Fund",
      shortName: "HDFC Mid Cap",
      category: "Mid Cap",
      lumpsumAmount: 5000,
      lumpsumDate: new Date('2025-08-11'),
      sipAmount: 0,
      sipStartDate: null,
      color: "#A8D8EA"
    }
  ];

  // Calculate dynamic values for each fund
  const portfolioData = useMemo(() => {
    return portfolioDataWithDates.map(fund => {
      // Calculate SIP months
      const sipMonths = fund.sipStartDate ? getMonthsDifference(fund.sipStartDate, currentDate) : 0;
      
      // Calculate total lumpsum
      let totalLumpsum = 0;
      let lumpsumDates = [];
      
      if (fund.lumpsums) {
        totalLumpsum = fund.lumpsums.reduce((sum, ls) => sum + ls.amount, 0);
        lumpsumDates = fund.lumpsums.map(ls => ls.date);
      } else if (fund.lumpsumAmount) {
        totalLumpsum = fund.lumpsumAmount;
        lumpsumDates = [fund.lumpsumDate];
      }

      // Calculate total SIP invested
      const totalSIPInvested = fund.sipAmount * sipMonths;
      
      // Calculate total invested
      const totalInvested = totalLumpsum + totalSIPInvested;

      // Calculate current value using calculated NAV-based values only  
      const calculatedCurrentValue = calculatedValues[fund.id];
      const currentValue = calculatedCurrentValue || 0; // No fallback to hardcoded
      const navInfo = navData[fund.name];

      // Calculate absolute returns
      const absoluteReturns = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

      // Calculate XIRR
      let xirr = 0;
      let cagr = 0;

      try {
        // Build cash flows for XIRR calculation
        const cashFlows = [];

        // Add lumpsum investments (negative cash flows)
        if (fund.lumpsums) {
          fund.lumpsums.forEach(ls => {
            cashFlows.push({ date: ls.date, amount: -ls.amount });
          });
        } else if (fund.lumpsumAmount && fund.lumpsumDate) {
          cashFlows.push({ date: fund.lumpsumDate, amount: -fund.lumpsumAmount });
        }

        // Add SIP investments (negative cash flows) - monthly
        if (fund.sipStartDate && fund.sipAmount > 0) {
          for (let i = 0; i < sipMonths; i++) {
            const sipDate = new Date(fund.sipStartDate);
            sipDate.setMonth(sipDate.getMonth() + i);
            cashFlows.push({ date: sipDate, amount: -fund.sipAmount });
          }
        }

        // Add current value (positive cash flow)
        cashFlows.push({ date: currentDate, amount: currentValue });

        // Calculate XIRR if we have multiple cash flows
        if (cashFlows.length > 2) {
          xirr = calculateXIRR(cashFlows);
        } else if (cashFlows.length === 2 && fund.lumpsumAmount) {
          // For lumpsum only, calculate CAGR
          const years = getYearsDifference(lumpsumDates[0], currentDate);
          cagr = calculateCAGR(totalLumpsum, currentValue, years);
          xirr = cagr;
        }

        // Handle edge cases
        if (!isFinite(xirr) || isNaN(xirr)) {
          xirr = absoluteReturns / (sipMonths / 12 || 1); // Rough approximation
        }
      } catch (error) {
        console.error(`Error calculating XIRR for ${fund.name}:`, error);
        xirr = 0;
      }

      // Determine status based on XIRR
      let status = 'monitor';
      if (xirr >= 15) status = 'excellent';
      else if (xirr >= 12) status = 'good';
      else if (xirr < 0) status = 'poor';

      // Override for very new funds
      // NOTE: To handle lumpsum only funds, excluding 0 SIP month cases from being marked as 'monitor'
      if (sipMonths > 0 && sipMonths <= 6) {
        status = 'monitor';
      }

      return {
        ...fund,
        sipMonths,
        totalLumpsum,
        totalSIPInvested,
        totalInvested,
        currentValue: currentValue, // Use calculated value
        returns: absoluteReturns,
        xirr: xirr,
        cagr: cagr,
        status,
        investmentAge: fund.sipStartDate 
          ? getMonthsDifference(fund.sipStartDate, currentDate) 
          : getMonthsDifference(lumpsumDates[0], currentDate),
        navInfo: navInfo // Include NAV info for display
      };
    });
  }, [currentDate, navData, calculatedValues]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalInvested = portfolioData.reduce((sum, fund) => sum + fund.totalInvested, 0);
    const totalCurrentValue = portfolioData.reduce((sum, fund) => sum + fund.currentValue, 0);
    const totalReturns = ((totalCurrentValue - totalInvested) / totalInvested) * 100;
    const monthlySIP = portfolioData.reduce((sum, fund) => sum + fund.sipAmount, 0);
    
    return { totalInvested, totalCurrentValue, totalReturns, monthlySIP };
  }, [portfolioData]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    portfolioData.forEach(fund => {
      if (!breakdown[fund.category]) {
        breakdown[fund.category] = { invested: 0, current: 0, count: 0 };
      }
      breakdown[fund.category].invested += fund.totalInvested;
      breakdown[fund.category].current += fund.currentValue;
      breakdown[fund.category].count += 1;
    });
    return breakdown;
  }, [portfolioData]);

  // Performance categories
  const performanceGroups = useMemo(() => {
    return {
      excellent: portfolioData.filter(f => f.status === 'excellent'),
      good: portfolioData.filter(f => f.status === 'good'),
      monitor: portfolioData.filter(f => f.status === 'monitor'),
      poor: portfolioData.filter(f => f.status === 'poor')
    };
  }, [portfolioData]);

  // const getStatusIcon = (status) => {
  //   switch(status) {
  //     case 'excellent': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
  //     case 'good': return <TrendingUp className="w-5 h-5 text-blue-500" />;
  //     case 'monitor': return <Clock className="w-5 h-5 text-amber-500" />;
  //     case 'poor': return <AlertCircle className="w-5 h-5 text-red-500" />;
  //     default: return <Minus className="w-5 h-5 text-gray-400" />;
  //   }
  // };

  const getStatusBadge = (status) => {
    const styles = {
      excellent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      good: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      monitor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      poor: "bg-red-500/10 text-red-600 border-red-500/20"
    };
    const labels = {
      excellent: "Excellent",
      good: "Good",
      monitor: "Monitor",
      poor: "Underperforming"
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{color: '#644ff0'}}>
              Portfolio Tracker
            </h1>
            <p className="text-gray-400 text-sm">Real-time insights with dynamic calculations</p>
          </div>
          <div className="hidden md:block">
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                {isLoadingNAV ? (
                  <RefreshCw className="w-4 h-4 animate-spin" style={{color: '#644ff0'}} />
                ) : apiError ? (
                  <WifiOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                )}
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {isLoadingNAV ? 'Updating...' : apiError ? 'Offline Mode' : 'Live Data'}
                </p>
                {!isLoadingNAV && (
                  <button
                    onClick={handleManualRefresh}
                    className="p-1 hover:bg-gray-500/10 rounded transition-colors ml-2 cursor-pointer"
                    style={{color: '#644ff0'}}
                    title="Refresh NAV data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-lg font-semibold" style={{color: '#644ff0'}}>
                {currentDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              {lastNAVUpdate && (
                <p className="text-xs text-gray-600 mt-1">
                  NAV updated: {lastNAVUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {apiError && (
                <p className="text-xs text-red-400 mt-1">
                  Using cached/fallback data
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-gray-900/90 to-black/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400 uppercase tracking-wide">Total Invested</p>
            <IndianRupee className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-3xl font-bold text-white">₹{(totals.totalInvested / 100000).toFixed(2)}L</p>
          <p className="text-xs text-gray-500 mt-1">₹{totals.totalInvested.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-emerald-400 uppercase tracking-wide">Current Value</p>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-white">₹{(totals.totalCurrentValue / 100000).toFixed(2)}L</p>
          <p className="text-xs text-emerald-400 mt-1">₹{totals.totalCurrentValue.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl"
             style={{borderColor: '#644ff066'}}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm uppercase tracking-wide" style={{color: '#644ff0'}}>Total Returns</p>
            <BarChart3 className="w-5 h-5" style={{color: '#644ff0'}} />
          </div>
          <p className="text-3xl font-bold text-white">{totals.totalReturns.toFixed(2)}%</p>
          <p className="text-xs mt-1" style={{color: '#644ff0'}}>₹{(totals.totalCurrentValue - totals.totalInvested).toLocaleString('en-IN')} gain</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 backdrop-blur-xl border border-purple-700/30 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-purple-400 uppercase tracking-wide">Monthly SIP</p>
            <Calendar className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-white">₹{totals.monthlySIP.toLocaleString('en-IN')}</p>
          <p className="text-xs text-purple-400 mt-1">Across {portfolioData.filter(f => f.sipAmount > 0).length} funds</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2 bg-gray-900/70 backdrop-blur-xl p-1 rounded-xl border border-gray-700/50">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: PieChart },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'allocation', label: 'Allocation', icon: BarChart3 },
            { id: 'recommendations', label: 'Recommendations', icon: Target }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                activeView === tab.id
                  ? 'text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              style={activeView === tab.id ? {backgroundColor: '#644ff0'} : {}}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <>
        {activeView === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* All Funds List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-white">Your Funds</span>
                <span className="text-sm text-gray-500">({portfolioData.length})</span>
              </h2>
              
              {portfolioData.map((fund) => (
                <div
                  key={fund.id}
                  data-fund-id={fund.id}
                  onClick={() => setSelectedFund(fund)}
                  className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-5 transition-all duration-300 group"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#644ff0'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                  style={{
                    boxShadow: selectedFund?.id === fund.id ? `0 0 30px ${fund.color}40` : 'none'
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: fund.color }}
                        />
                        <h3 
                          className="font-bold text-white transition-colors"
                          onMouseEnter={(e) => e.target.style.color = '#644ff0'}
                          onMouseLeave={(e) => e.target.style.color = 'white'}
                          style={{ color: fund.color }}
                        >
                          {fund.shortName}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500">{fund.category} · {fund.investmentAge} months old</p>
                    </div>
                    {getStatusBadge(fund.status)}
                  </div>

                  <div className="flex justify-between items-start mb-3 w-[95%]">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Invested</p>
                      <p className="text-sm font-semibold">₹{(fund.totalInvested / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="flex-1 flex justify-evenly">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Current</p>
                        <p className="text-sm font-semibold" style={{color: '#644ff0'}}>₹{fund.currentValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Returns</p>
                        <p className={`text-sm font-semibold flex items-center gap-1 justify-center ${
                          fund.returns >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {fund.returns >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fund.returns.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">XIRR</p>
                      <p className="text-sm font-semibold">{fund.xirr.toFixed(2)}%</p>
                    </div>
                  </div>

                  {/* Investment Details - Collapsible */}
                  <div data-details style={{display: 'none'}} className="mt-4 border-t border-slate-700/50 w-[95%]">
                    <div className="mt-4 text-xs text-slate-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* SIP and Lumpsum Column */}
                        <div className="space-y-2">
                          {fund.sipAmount > 0 && (
                            <div className="flex justify-between">
                              <span><strong>SIP:</strong></span>
                              <span>₹{fund.sipAmount.toLocaleString('en-IN')}/mo × {fund.sipMonths}m = ₹{fund.totalSIPInvested.toLocaleString('en-IN')} (started {formatDate(fund.sipStartDate)})</span>
                            </div>
                          )}
                          
                          {fund.totalLumpsum > 0 && (
                            <div className="flex justify-between">
                              <span><strong>Lumpsum:</strong></span>
                              <span>₹{fund.totalLumpsum.toLocaleString('en-IN')} ({fund.lumpsums 
                                ? fund.lumpsums.map(ls => formatDate(ls.date)).join(', ')
                                : formatDate(fund.lumpsumDate)})</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Current NAV Column */}
                        <div className="space-y-2">
                          {fund.navInfo && fund.navInfo.nav && (
                            <div className="flex justify-between md:justify-end" style={{color: '#644ff0'}}>
                              <span><strong>Current NAV:</strong></span>
                              <span>₹{fund.navInfo.nav.toFixed(2)} (as of {fund.navInfo.date})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown Button - Bottom Right */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const fundElement = e.target.closest('[data-fund-id]');
                        const detailsDiv = fundElement.querySelector('[data-details]');
                        const chevron = e.target.closest('button').querySelector('.chevron-icon');
                        const isVisible = detailsDiv.style.display !== 'none';
                        
                        detailsDiv.style.display = isVisible ? 'none' : 'block';
                        chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                      }}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-700/30 border border-slate-700 rounded-full cursor-pointer"
                    >
                      <ChevronDown className="chevron-icon w-4 h-4 transform transition-transform duration-200" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  {/* <div className="mt-3 h-2 bg-gray-900/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((fund.currentValue / fund.totalInvested) * 100, 100)}%`,
                        backgroundColor: fund.color,
                        boxShadow: `0 0 10px ${fund.color}`
                      }}
                    />
                  </div> */}
                </div>
              ))}
            </div>

            {/* Quick Insights Sidebar */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4" style={{color: '#644ff0'}}>
                Quick Insights
              </h2>

              {/* Top Performer */}
              {performanceGroups.excellent.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-emerald-400">Top Performer</h3>
                  </div>
                  {(() => {
                    const topFund = [...performanceGroups.excellent].sort((a, b) => b.xirr - a.xirr)[0];
                    return (
                      <>
                        <p className="text-sm text-white mb-1">{topFund.shortName}</p>
                        <p className="text-2xl font-bold text-emerald-400">{topFund.returns.toFixed(2)}% Returns</p>
                        <p className="text-xs text-emerald-300 mt-2">{topFund.xirr.toFixed(1)}% XIRR · {topFund.investmentAge} months</p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Needs Attention */}
              {performanceGroups.poor.length > 0 && (
                <div className="bg-gradient-to-br from-red-900/30 to-red-800/10 backdrop-blur-xl border border-red-700/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h3 className="font-bold text-red-400">Needs Attention</h3>
                  </div>
                  {performanceGroups.poor.map(fund => (
                    <div key={fund.id} className="mb-3 last:mb-0">
                      <p className="text-sm text-white mb-1">{fund.shortName}</p>
                      <p className="text-2xl font-bold text-red-400">{fund.returns.toFixed(2)}% Returns</p>
                      <p className="text-xs text-red-300 mt-2">
                        {fund.sipAmount > 0 ? `Consider stopping SIP of ₹${fund.sipAmount.toLocaleString('en-IN')}/mo` : 'Consider exiting'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Category Distribution */}
              <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5" style={{color: '#644ff0'}} />
                  Category Split
                </h3>
                <div className="space-y-3">
                  {Object.entries(categoryBreakdown).map(([category, data]) => {
                    const percentage = (data.current / totals.totalCurrentValue) * 100;
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">{category}</span>
                          <span className="font-semibold" style={{color: '#644ff0'}}>{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-900/70 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{backgroundColor: '#644ff0', width: `${percentage}%`}}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {data.count} {data.count === 1 ? 'fund' : 'funds'} · ₹{(data.current / 1000).toFixed(0)}K
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calculation Info */}
              {/* <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 backdrop-blur-xl border border-cyan-700/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-cyan-400 text-sm">Precise NAV Calculations</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Portfolio values are calculated using complete historical NAV data. For SIPs, 
                  units are calculated for each month from start date. For lumpsums, exact NAV 
                  on investment date is used. Current values reflect precise calculations based 
                  on actual units × latest NAV.
                </p>
                <div className="mt-2 text-xs text-cyan-300">
                  Open browser console to see detailed calculation breakdowns.
                </div>
              </div> */}
            </div>
          </div>
        )}

        {activeView === 'performance' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: '#644ff0'}}>
              Performance Analysis
            </h2>

            {/* Performance Groups */}
            {Object.entries(performanceGroups).map(([status, funds]) => {
              if (funds.length === 0) return null;
              
              const statusConfig = {
                excellent: { title: 'Excellent Performers', color: 'emerald', icon: CheckCircle },
                good: { title: 'Good Performers', color: 'blue', icon: TrendingUp },
                monitor: { title: 'Monitor Closely', color: 'amber', icon: Clock },
                poor: { title: 'Underperformers', color: 'red', icon: AlertCircle }
              };

              const config = statusConfig[status];

              return (
                <div key={status} className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <config.icon className={`w-6 h-6 text-${config.color}-400`} />
                    <h3 className={`text-xl font-bold text-${config.color}-400`}>{config.title}</h3>
                    <span className="text-sm text-slate-500">({funds.length})</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {funds.map(fund => (
                      <div
                        key={fund.id}
                        className="bg-gray-900/70 border border-gray-700/50 rounded-lg p-4 transition-all"
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#644ff0'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-white mb-1" style={{ color: fund.color }}>{fund.shortName}</h4>
                            <p className="text-xs text-slate-500">{fund.category} · {fund.investmentAge}mo</p>
                          </div>
                          <div 
                            className="w-3 h-3 rounded-full mt-1" 
                            style={{ backgroundColor: fund.color }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div>
                            <p className="text-xs text-slate-500">XIRR</p>
                            <p className={`text-lg font-bold ${
                              fund.xirr >= 15 ? 'text-emerald-400' :
                              fund.xirr >= 12 ? 'text-blue-400' :
                              fund.xirr >= 0 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {fund.xirr.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Returns</p>
                            <p className={`text-lg font-bold ${fund.returns >= 12 ? 'text-emerald-400' : fund.returns > 7 ? 'text-amber-400' : 'text-red-400'}`}>
                              {fund.returns.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Gain</p>
                            <p className="text-lg font-bold"
                               style={{color: fund.returns >= 0 ? '#644ff0' : '#ef4444'}}>
                              ₹{((fund.currentValue - fund.totalInvested) / 1000).toFixed(0)}K
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-slate-700/50 grid grid-cols-2 gap-4 text-xs text-slate-500 space-y-1">
                          <div className="mt-2">₹{(fund.totalInvested / 1000).toFixed(0)}K invested → ₹{(fund.currentValue / 1000).toFixed(0)}K current</div>
                          {fund.sipAmount > 0 && (
                            <div className="mt-2"><strong>SIP:</strong> ₹{fund.sipAmount}/mo × {fund.sipMonths} months</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeView === 'allocation' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: '#644ff0'}}>
              Asset Allocation
            </h2>

            {(() => {
              // Calculate dynamic allocation from portfolio data
              const allocation = {};
              let totalSIP = 0;
              
              portfolioData.forEach(fund => {
                const category = fund.category;
                const sipAmount = fund.sipAmount || 0;
                totalSIP += sipAmount;
                allocation[category] = (allocation[category] || 0) + sipAmount;
              });

              const allocationArray = Object.entries(allocation).map(([category, amount]) => ({
                category,
                amount,
                percentage: ((amount / totalSIP) * 100).toFixed(1)
              })).sort((a, b) => b.amount - a.amount);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <span>Current Allocation</span>
                      <span className="text-sm text-gray-500">(by SIP amount)</span>
                    </h3>

                    <div className="space-y-4">
                      {allocationArray.map(({category, amount, percentage}) => (
                        <div key={category}>
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-300">{category}</span>
                            <span className="font-bold" style={{color: '#644ff0'}}>₹{amount.toLocaleString('en-IN')} ({percentage}%)</span>
                          </div>
                          <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{
                                backgroundColor: '#644ff0', 
                                width: `${percentage}%`
                              }} 
                            />
                          </div>
                          {parseFloat(percentage) > 50 && (
                            <p className="text-xs text-amber-400 mt-1">Overweight - Consider reducing</p>
                          )}
                          {parseFloat(percentage) === 0 && (
                            <p className="text-xs text-red-400 mt-1">Missing - Add exposure</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

              <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  <span>Recommended Allocation</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">ELSS (Tax Saving)</span>
                      <span className="text-emerald-400 font-bold">₹7,000 (35%)</span>
                    </div>
                    <div className="h-3 bg-gray-900/70 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: '35%' }} />
                    </div>
                    <p className="text-xs text-emerald-400 mt-1">Maintain current level</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">Large Cap / Index</span>
                      <span className="text-cyan-400 font-bold">₹5,000 (25%)</span>
                    </div>
                    <div className="h-3 bg-gray-900/70 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full" style={{ width: '25%' }} />
                    </div>
                    <p className="text-xs text-cyan-400 mt-1">Add Nifty 50 Index</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">Mid Cap</span>
                      <span className="text-blue-400 font-bold">₹5,000 (25%)</span>
                    </div>
                    <div className="h-3 bg-gray-900/70 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: '25%' }} />
                    </div>
                    <p className="text-xs text-blue-400 mt-1">Reduce from ₹12,000</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">Flexi Cap</span>
                      <span className="text-purple-400 font-bold">₹3,000 (15%)</span>
                    </div>
                    <div className="h-3 bg-gray-900/70 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" style={{ width: '15%' }} />
                    </div>
                    <p className="text-xs text-purple-400 mt-1">Add Parag Parikh Flexi Cap</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <p className="text-sm text-cyan-300">
                    <strong>Total Monthly SIP:</strong> ₹20,000 (balanced allocation)
                  </p>
                </div>
              </div>
            </div>
              );
            })()}
          </div>
        )}

        {activeView === 'recommendations' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: '#644ff0'}}>
              Action Plan & Recommendations
            </h2>

            <>
              {/* Immediate Actions */}
              {performanceGroups.poor.length > 0 && (
                <div className="bg-gradient-to-br from-red-900/30 to-red-800/10 backdrop-blur-xl border border-red-700/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <h3 className="text-xl font-bold text-red-400">Immediate Actions Required</h3>
                </div>

                <div className="space-y-4">
                  {performanceGroups.poor.map(fund => (
                    <div key={fund.id} className="bg-slate-800/30 border border-red-700/20 rounded-lg p-4">
                      <h4 className="font-bold mb-2 text-white">STOP: {fund.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-slate-400">Current SIP</p>
                          <p className="text-lg font-bold text-red-400">₹{fund.sipAmount.toLocaleString('en-IN')}/month</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Performance</p>
                          <p className="text-lg font-bold text-red-400">{fund.returns.toFixed(2)}% returns</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Duration</p>
                          <p className="text-lg font-bold text-white">{fund.sipMonths} months</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">
                        <strong>Reason:</strong> Negative returns after {fund.sipMonths} months. {fund.category} investments are volatile and this fund has consistently underperformed.
                      </p>
                      <p className="text-sm text-emerald-400">
                        <strong>Action:</strong> Stop SIP immediately and redeploy ₹{fund.sipAmount.toLocaleString('en-IN')} to better performing categories.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Funds to Add */}
            <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 backdrop-blur-xl border border-emerald-700/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-bold text-emerald-400">New Investments to Add</h3>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-800/30 border border-emerald-700/20 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-white mb-1">Nifty 50 Index Fund</h4>
                      <p className="text-sm text-slate-400">Large Cap Index · Low Cost</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold">
                      Recommended
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-slate-400">Suggested SIP</p>
                      <p className="text-lg font-bold text-emerald-400">₹5,000/month</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Expected Returns</p>
                      <p className="text-lg font-bold text-cyan-400">11-12% CAGR</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">
                    <strong>Why:</strong> You have zero large-cap exposure. Index funds provide stable, low-cost exposure to top 50 companies.
                  </p>
                  <p className="text-xs text-slate-500">
                    Options: Nippon Nifty 50, ICICI Nifty 50, UTI Nifty 50 (Expense ratio ~0.2%)
                  </p>
                </div>

                <div className="bg-slate-800/30 border border-emerald-700/20 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-white mb-1">Parag Parikh Flexi Cap Fund</h4>
                      <p className="text-sm text-slate-400">Flexi Cap · Multi-Cap Flexibility</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-semibold">
                      Recommended
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-slate-400">Suggested SIP</p>
                      <p className="text-lg font-bold text-emerald-400">₹3,000/month</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Expected Returns</p>
                      <p className="text-lg font-bold text-cyan-400">12-15% CAGR</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">
                    <strong>Why:</strong> Provides flexibility to invest across all market caps. Includes international exposure for diversification.
                  </p>
                  <p className="text-xs text-slate-500">
                    Alternatives: Quant Flexi Cap, JM Flexi Cap, Canara Robeco Flexi Cap
                  </p>
                </div>
              </div>
            </div>

            {/* Final Summary */}
            <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 backdrop-blur-xl border border-cyan-700/30 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-cyan-400" />
                Revised Monthly SIP Plan (₹20,000)
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 p-3 bg-slate-800/30 rounded-lg">
                  <div className="text-sm font-semibold text-slate-400">Fund</div>
                  <div className="text-sm font-semibold text-slate-400">Current</div>
                  <div className="text-sm font-semibold text-slate-400">Revised</div>
                </div>

                {[
                  { name: 'Nippon ELSS', current: 4000, revised: 4000, change: null },
                  { name: 'Aditya Birla ELSS', current: 3000, revised: 3000, change: null },
                  { name: 'Nippon Growth Mid Cap', current: 2000, revised: 3000, change: '+₹1,000' },
                  { name: 'ICICI Large & Mid Cap', current: 5000, revised: 5000, change: 'Monitor' },
                  { name: 'HDFC Mid Cap', current: 5000, revised: 3000, change: '-₹2,000' },
                  { name: 'Nippon Small Cap', current: 6000, revised: 0, change: 'STOP', stop: true },
                  { name: 'Nifty 50 Index', current: 0, revised: 5000, change: 'ADD', add: true },
                  { name: 'Parag Parikh Flexi Cap', current: 0, revised: 3000, change: 'ADD', add: true }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-3 gap-4 p-3 rounded-lg ${
                      item.stop ? 'bg-red-900/20 border border-red-700/30' :
                      item.add ? 'bg-emerald-900/20 border border-emerald-700/30' :
                      'bg-slate-800/20'
                    }`}
                  >
                    <div className="text-sm text-white">{item.name}</div>
                    <div className="text-sm text-slate-400">₹{item.current.toLocaleString('en-IN')}</div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <span className={item.stop ? 'text-red-400' : item.add ? 'text-emerald-400' : 'text-white'}>
                        ₹{item.revised.toLocaleString('en-IN')}
                      </span>
                      {item.change && (
                        <span className={`text-xs ${
                          item.stop ? 'text-red-400' :
                          item.add ? 'text-emerald-400' :
                          item.change.includes('-') ? 'text-amber-400' : 'text-blue-400'
                        }`}>
                          {item.change}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-4 p-3 bg-cyan-900/20 border border-cyan-700/30 rounded-lg mt-4">
                  <div className="text-sm font-bold text-white">TOTAL</div>
                  <div className="text-sm font-bold text-white">₹20,000</div>
                  <div className="text-sm font-bold text-cyan-400">₹20,000</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <p className="text-sm text-cyan-300">
                  <strong>Result:</strong> Balanced portfolio with proper large-cap exposure, reduced mid-cap overweight, and eliminated underperforming small-cap fund.
                </p>
              </div>
            </div>
            </>
          </div>
        )}
        </>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-700/50">
        <div className="text-center text-slate-500 text-sm space-y-2">
          <p className="flex items-center justify-center gap-2">
            Portfolio Tracker
          </p>
          <p>Total Portfolio: ₹{(totals.totalCurrentValue / 100000).toFixed(2)}L · {totals.totalReturns.toFixed(2)}% Returns</p>
          <p className="text-xs text-slate-600">
            All SIP months, XIRR, and returns auto-calculated from investment start dates to current date
          </p>
          
          {/* Credits */}
          <div className="mt-6 pt-4 border-t border-slate-800/50">
            <p className="text-xs text-slate-600">
              © 2026 Developed by Yashwanth C
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioTracker;