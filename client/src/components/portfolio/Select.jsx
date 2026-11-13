import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// options: [{ value, label }]. With `multiple`, value is an array, the first option (value '') is the
// "all" row that clears it, and the menu stays open while ticking.
const Select = ({ value, onChange, options, className = '', multiple = false }) => {
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

  const picked = multiple ? (value || []) : [value];
  const isSelected = (v) => (multiple ? (v === '' ? picked.length === 0 : picked.includes(v)) : v === value);
  const first = options.find((o) => o.value !== '' && picked.includes(o.value));
  const label = multiple
    ? (picked.length === 0 ? options[0]?.label : `${first?.label ?? picked[0]}${picked.length > 1 ? ` +${picked.length - 1}` : ''}`)
    : (options.find((o) => o.value === value) || options[0])?.label;
  const choose = (v) => {
    if (!multiple) { onChange(v); setOpen(false); return; }
    if (v === '') { onChange([]); return; }
    const next = picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v];
    // ticking every option is the same as all of them
    onChange(next.length === options.filter((o) => o.value !== '').length ? [] : next);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-10 flex items-center justify-between gap-2 bg-surface rounded-md px-3 text-[14px] text-ink transition-shadow cursor-pointer focus:outline-none ${open ? 'shadow-[0_0_0_1px_var(--c-ink),0_0_0_4px_var(--c-line)]' : 'shadow-[0_0_0_1px_var(--c-line-strong)] hover:shadow-[0_0_0_1px_var(--c-muted-soft)]'}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable={multiple || undefined}
          className="absolute z-50 mt-1.5 min-w-full w-max max-w-[280px] max-h-72 overflow-auto rounded-lg bg-surface p-1 shadow-[0_0_0_1px_var(--c-ring),0_1px_1px_rgb(0_0_0/0.02),0_8px_16px_-4px_rgb(0_0_0/0.06),0_24px_32px_-8px_rgb(0_0_0/0.08)]"
        >
          {options.map((o) => {
            const isSel = isSelected(o.value);
            if (multiple && o.value !== '') {
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  tabIndex={0}
                  onClick={() => choose(o.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o.value); } }}
                  className="flex items-center gap-2.5 h-9 px-2.5 text-[14px] rounded-md cursor-pointer transition-colors text-ink hover:bg-surface-strong focus:outline-none focus-visible:bg-surface-strong"
                >
                  <span className={`grid place-items-center w-4 h-4 rounded-[4px] shrink-0 transition-colors ${isSel ? 'bg-ink text-canvas' : 'shadow-[inset_0_0_0_1px_var(--c-line-strong)]'}`} aria-hidden="true">
                    {isSel && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </li>
              );
            }
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                tabIndex={0}
                onClick={() => choose(o.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o.value); } }}
                className={`flex items-center justify-between gap-3 h-9 px-2.5 text-[14px] rounded-md cursor-pointer transition-colors text-ink hover:bg-surface-strong focus:outline-none focus-visible:bg-surface-strong ${isSel ? 'font-medium' : ''} ${multiple ? 'mb-1 relative after:absolute after:-bottom-[3px] after:inset-x-1 after:h-px after:bg-line' : ''}`}
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
