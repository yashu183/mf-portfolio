import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// options: [{ value, label }]
const Select = ({ value, onChange, options, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-10 flex items-center justify-between gap-2 bg-surface rounded-md px-3 text-[14px] text-ink transition-shadow cursor-pointer focus:outline-none ${open ? 'shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)]' : 'shadow-[0_0_0_1px_var(--c-line-strong)] hover:shadow-[0_0_0_1px_var(--c-muted-soft)]'}`}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 min-w-full w-max max-w-[280px] max-h-72 overflow-auto rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--c-ring),0_1px_1px_rgb(0_0_0/0.02),0_8px_16px_-4px_rgb(0_0_0/0.06),0_24px_32px_-8px_rgb(0_0_0/0.08)]"
        >
          {options.map((o) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex items-center justify-between gap-3 h-9 px-2.5 text-[14px] rounded-md cursor-pointer transition-colors text-ink hover:bg-surface-strong ${isSel ? 'font-medium' : ''}`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check className="w-4 h-4 flex-shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Select;
