// Mutual Fund API Integration
// Using MFApi.in for complete historical NAV data - it's free and reliable

const MF_API_BASE_URL = 'https://api.mfapi.in/mf';

// Mapping of fund names to their scheme codes (these are actual AMFI codes)
export const FUND_SCHEME_CODES = {
  "Aditya Birla Sun Life ELSS Tax Saver Fund": "107745", // Aditya Birla Sun Life Tax Relief 96 - Growth
  "HDFC ELSS Tax Saver": "101979", // HDFC Taxsaver - Growth
  "ICICI Pru ELSS Tax Saver Fund": "100354", // ICICI Prudential Long Term Equity Fund (Tax Saving) - Growth
  "Nippon India ELSS Tax Saver Fund": "103196", // Nippon India Tax Saver (ELSS) Fund - Growth
  "Nippon India Small Cap Fund": "113177", // Nippon India Small Cap Fund - Growth
  "ICICI Pru Large & Mid Cap Fund": "100349", // ICICI Prudential Large & Mid Cap Fund - Growth
  "Nippon India Growth Mid Cap Fund": "100377", // Nippon India Growth Fund - Growth
  "HDFC Mid Cap Fund": "105758" // HDFC Mid-Cap Opportunities Fund - Growth
};

// Cache to store complete historical NAV data to avoid repeated API calls
let historicalNavCache = {};
let lastCacheUpdate = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache for historical data

// Function to clear cache (for manual refresh)
export const clearCache = () => {
  historicalNavCache = {};
  lastCacheUpdate = null;
  console.log('🔄 Cache cleared for manual refresh');
};

// Fetch complete historical NAV data for a scheme
export const fetchCompleteNAVHistory = async (schemeCode) => {
  const cacheKey = schemeCode;
  const now = Date.now();
  
  // Return cached data if still valid
  if (historicalNavCache[cacheKey] && 
      lastCacheUpdate && 
      (now - lastCacheUpdate) < CACHE_DURATION) {
    console.log(`Using cached historical NAV data for scheme ${schemeCode}`);
    return historicalNavCache[cacheKey];
  }

  try {
    const response = await fetch(`${MF_API_BASE_URL}/${schemeCode}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Process and cache the data
    const processedData = {
      meta: data.meta,
      data: data.data.map(item => ({
        date: item.date,
        nav: parseFloat(item.nav)
      })),
      dataByDate: {}
    };
    
    // Create a date-indexed lookup for faster access
    data.data.forEach(item => {
      processedData.dataByDate[item.date] = parseFloat(item.nav);
    });
    
    historicalNavCache[cacheKey] = processedData;
    lastCacheUpdate = now;
    
    return processedData;
  } catch (error) {
    console.error(`Error fetching complete NAV history for scheme ${schemeCode}:`, error);
    return null;
  }
};

// Get NAV for a specific date from cached historical data
export const getNAVByDate = (navHistory, targetDate) => {
  if (!navHistory || !navHistory.dataByDate) return null;
  
  // Format target date to DD-MM-YYYY format that API uses
  const formattedDate = targetDate.toLocaleDateString('en-GB');
  let nav = navHistory.dataByDate[formattedDate];
  
  if (nav) return nav;
  
  // If exact date not found, find the closest previous date
  const targetTime = targetDate.getTime();
  let closestNav = null;
  let closestDiff = Infinity;
  
  Object.entries(navHistory.dataByDate).forEach(([dateStr, navValue]) => {
    const [day, month, year] = dateStr.split('-');
    const dateTime = new Date(year, month - 1, day).getTime();
    
    if (dateTime <= targetTime) {
      const diff = targetTime - dateTime;
      if (diff < closestDiff) {
        closestDiff = diff;
        closestNav = navValue;
      }
    }
  });
  
  return closestNav;
};

// Calculate current value with precise historical NAV data
export const calculateCurrentValueWithPreciseNAV = async (fund) => {
  const schemeCode = getSchemeCode(fund.name);
  if (!schemeCode) {
    console.log(`No scheme code found for ${fund.name}, returning 0`);
    return 0;
  }
  
  try {
    console.log(`\n=== Calculating for ${fund.shortName} ===`);
    
    // Fetch complete historical NAV data
    const navHistory = await fetchCompleteNAVHistory(schemeCode);
    if (!navHistory || !navHistory.data || navHistory.data.length === 0) {
      console.log(`No NAV history found for ${fund.name}`);
      return 0;
    }
    
    // Get latest NAV (current NAV)
    const latestNAV = navHistory.data[0].nav;
    const latestDate = navHistory.data[0].date;
    console.log(`Latest NAV: ₹${latestNAV} (${latestDate})`);
    
    let totalUnits = 0;
    let totalInvested = 0;
    
    // Calculate units for lumpsum investments
    if (fund.lumpsums) {
      console.log('Processing multiple lumpsums:');
      for (const [index, lumpsum] of fund.lumpsums.entries()) {
        const navOnDate = getNAVByDate(navHistory, lumpsum.date);
        if (navOnDate) {
          const units = lumpsum.amount / navOnDate;
          totalUnits += units;
          totalInvested += lumpsum.amount;
          console.log(`  Lumpsum ${index + 1}: ₹${lumpsum.amount} @ NAV ₹${navOnDate} = ${units.toFixed(4)} units`);
        }
      }
    } else if (fund.lumpsumAmount && fund.lumpsumDate) {
      console.log('Processing single lumpsum:');
      const navOnDate = getNAVByDate(navHistory, fund.lumpsumDate);
      if (navOnDate) {
        const units = fund.lumpsumAmount / navOnDate;
        totalUnits += units;
        totalInvested += fund.lumpsumAmount;
        console.log(`  Lumpsum: ₹${fund.lumpsumAmount} @ NAV ₹${navOnDate} = ${units.toFixed(4)} units`);
      }
    }
    
    // Calculate units for SIP investments (month by month)
    if (fund.sipAmount && fund.sipStartDate) {
      console.log('Processing SIP investments:');
      const currentDate = new Date(); // Actual current date
      const startDate = new Date(fund.sipStartDate);
      
      let sipDate = new Date(startDate);
      let sipMonth = 1;
      
      while (sipDate <= currentDate) {
        const navOnSipDate = getNAVByDate(navHistory, sipDate);
        if (navOnSipDate) {
          const units = fund.sipAmount / navOnSipDate;
          totalUnits += units;
          totalInvested += fund.sipAmount;
          console.log(`  SIP Month ${sipMonth}: ₹${fund.sipAmount} @ NAV ₹${navOnSipDate.toFixed(4)} = ${units.toFixed(4)} units`);
        }
        
        // Move to next month
        sipDate.setMonth(sipDate.getMonth() + 1);
        sipMonth++;
      }
    }
    
    console.log(`Total Units: ${totalUnits} * ${latestNAV} = ₹${(totalUnits * latestNAV)}`);

    // Calculate current value
    const currentValue = totalUnits * latestNAV;
    
    console.log(`\nSUMMARY for ${fund.shortName}:`);
    console.log(`Total Units: ${totalUnits.toFixed(4)}`);
    console.log(`Total Invested: ₹${totalInvested.toLocaleString()}`);
    console.log(`Current NAV: ₹${latestNAV}`);
    console.log(`Calculated Current Value: ₹${currentValue.toFixed(2)}`);
    
    return currentValue > 0 ? currentValue : 0; // Return 0 if no valid calculation
    
  } catch (error) {
    console.error(`Error calculating precise current value for ${fund.name}:`, error);
    return 0; // Return 0 instead of hardcoded fallback
  }
};

// Fetch current NAV data for all funds (for display purposes)
export const fetchAllCurrentNAVs = async () => {
  try {
    const navPromises = Object.entries(FUND_SCHEME_CODES).map(async ([fundName, schemeCode]) => {
      // Get latest NAV from complete history
      const navHistory = await fetchCompleteNAVHistory(schemeCode);
      if (navHistory && navHistory.data && navHistory.data.length > 0) {
        return {
          fundName,
          navData: {
            nav: navHistory.data[0].nav,
            date: navHistory.data[0].date,
            scheme_name: navHistory.meta.scheme_name
          }
        };
      }
      return { fundName, navData: null };
    });

    const results = await Promise.all(navPromises);
    
    // Build result object
    const navData = {};
    results.forEach(({ fundName, navData: nav }) => {
      if (nav) {
        navData[fundName] = nav;
      }
    });
    
    return navData;
  } catch (error) {
    console.error('Error fetching current NAVs:', error);
    return {};
  }
};

// Calculate current values for all funds using precise historical data
export const calculateAllCurrentValues = async (portfolioData) => {
  const calculatedValues = {};
  
  for (const fund of portfolioData) {
    console.log(`\n🔄 Processing ${fund.shortName}...`);
    const currentValue = await calculateCurrentValueWithPreciseNAV(fund);
    calculatedValues[fund.id] = currentValue;
  }
  
  return calculatedValues;
};

// Utility to get scheme code by fund name
export const getSchemeCode = (fundName) => {
  return FUND_SCHEME_CODES[fundName] || null;
};

// Utility to check if markets are open (rough approximation)
export const areMarketsOpen = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  // Markets are closed on weekends
  if (day === 0 || day === 6) return false;
  
  // Markets are open from 9 AM to 3:30 PM IST (rough approximation)
  return hour >= 9 && hour < 15;
};

// Get fund status based on scheme code
export const getFundStatus = async (schemeCode) => {
  try {
    const response = await fetch(`${MF_API_BASE_URL}/${schemeCode}/latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return {
      scheme_name: data.meta.scheme_name,
      fund_house: data.meta.fund_house,
      scheme_type: data.meta.scheme_type,
      scheme_category: data.meta.scheme_category
    };
  } catch (error) {
    console.error(`Error fetching fund status for ${schemeCode}:`, error);
    return null;
  }
};