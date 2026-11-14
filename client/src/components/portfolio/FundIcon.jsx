import React, { useState } from 'react';
import { amcLogo } from '../../utils/amc';

// The fund house's logo on a white tile (the logos are drawn for light backgrounds, so the tile stays
// white in dark mode too), or the fund's initials on its colour when there is no logo.
const FundIcon = ({ fund, size = 32 }) => {
  const logo = amcLogo(fund);
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (logo && !failed) {
    return (
      <span className="grid place-items-center shrink-0 rounded-full bg-white overflow-hidden shadow-[0_0_0_1px_var(--c-line-strong)]" style={box} aria-hidden="true">
        <img src={logo.src} alt="" loading="lazy" draggable="false" onError={() => setFailed(true)} className={logo.fill ? 'object-cover' : 'object-contain'} style={logo.fill ? { width: size, height: size } : { width: size * 0.66, height: size * 0.66 }} />
      </span>
    );
  }
  return (
    <span className="rounded-full grid place-items-center shrink-0 font-semibold text-ink shadow-[inset_0_0_0_1px_var(--c-line-strong)]" style={{ ...box, fontSize: size * 0.34, background: `color-mix(in oklab, ${fund.color} 35%, var(--c-surface))` }} aria-hidden="true">
      {(fund.shortName || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
    </span>
  );
};

export default FundIcon;
