import React from 'react';
import { usePrivacy } from '../../hooks/usePrivacy';

// tracking-normal: the parent's tight tracking is inherited in pixels and would eat the gap after the dot
const small = 'text-[0.5em] leading-none mt-[0.22em] font-medium tracking-normal text-muted';

// Mercury's headline figure: the whole rupees carry the weight; the ₹ sign and the paise sit smaller and lighter.
// With amounts hidden, the figure becomes Geist's own asterisks, semibold and spaced: the look the rest of the app copies. Anything that isn't a plain amount renders as it is.
// `masked` lets a static mock (the landing page) opt out of the app's switch.
const BigAmount = ({ value, className = '', masked }) => {
  const { hidden } = usePrivacy();
  const m = /^([−-]?)(₹)([\d,]+)(?:\.(\d+))?$/.exec(String(value ?? ''));
  if (!m) return <span className={className}>{value}</span>;
  const [, sign, symbol, whole, paise] = m;
  if (masked ?? hidden) {
    return (
      <span className={`inline-flex items-start whitespace-nowrap ${className}`} aria-label="Amount hidden">
        <span className={`${small} mr-[0.12em]`}>{symbol}</span>
        <span className="tracking-[0.06em]">******</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-start whitespace-nowrap ${className}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {sign && <span>{sign}</span>}
      <span className={`${small} mr-[0.08em]`}>{symbol}</span>
      <span>{whole}</span>
      {paise && <span className={small}>.{paise}</span>}
    </span>
  );
};

export default BigAmount;
