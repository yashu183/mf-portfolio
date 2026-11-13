import React from 'react';

const funds = (n) => `${n} fund${n === 1 ? '' : 's'}`;

// Shown when the fund price source (MFapi) could not be reached for some funds: either we priced
// them from the last saved NAV, or there was nothing saved and they count as ₹0 for now.
const NavNotice = ({ staleFunds = 0, missingFunds = 0, className = '' }) => {
  if (!staleFunds && !missingFunds) return null;
  return (
    <div role="status" className={`card px-4 py-3 flex items-start gap-2.5 text-[13px] text-body ${className}`}>
      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-warn shrink-0" aria-hidden="true" />
      <p>
        {staleFunds > 0 && <>Couldn’t refresh prices for {funds(staleFunds)}, so {staleFunds === 1 ? 'it shows' : 'they show'} the last saved NAV. </>}
        {missingFunds > 0 && <>Couldn’t get prices for {funds(missingFunds)}, so {missingFunds === 1 ? 'it counts' : 'they count'} as ₹0 for now. </>}
        <span className="text-muted">Refresh in a minute to try again.</span>
      </p>
    </div>
  );
};

export default NavNotice;
