import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { usePrivacy } from '../../hooks/usePrivacy';

// The page head's PDF button: a small menu with the full report and a masked one (amounts and grams
// hidden, percentages kept), for sharing. With amounts hidden on screen, the masked report comes first.
// The builder loads on the first download, so the app itself stays light.
const PdfMenu = ({ scope, owner, label, disabled, compact = false, buttonClass = '' }) => {
  const { hidden: amountsHidden } = usePrivacy();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | busy | failed
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [shift, setShift] = useState(0);

  // The menu hangs from the button's right edge; on a narrow screen that can push it past the
  // left edge, so nudge it back inside a 16px gutter.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) { setShift(0); return; }
    const r = menuRef.current.getBoundingClientRect();
    const natLeft = r.left - shift;
    const vw = document.documentElement.clientWidth;
    let next = 0;
    if (natLeft < 16) next = 16 - natLeft;
    else if (natLeft + r.width > vw - 16) next = vw - 16 - (natLeft + r.width);
    if (next !== shift) setShift(next);
  }, [open, shift]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const download = async (masked) => {
    setOpen(false);
    setState('busy');
    try {
      const { downloadReport } = await import('../../utils/pdfReport');
      await downloadReport(scope, { hidden: masked, owner });
      setState('idle');
    } catch (err) {
      console.error('PDF export failed:', err);
      setState('failed');
    }
  };

  const options = [
    { masked: false, icon: Eye, title: 'Full report', note: 'Every amount shown' },
    { masked: true, icon: EyeOff, title: 'Masked report', note: 'Amounts hidden, percentages shown' },
  ];
  if (amountsHidden) options.reverse();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || state === 'busy'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Download ${label} as a PDF`}
        title={state === 'failed' ? 'The PDF could not be built. Try again.' : undefined}
        className={compact ? buttonClass : 'pill pill-sm pill-secondary'}
      >
        {state === 'busy'
          ? <RefreshCw className={`${compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} animate-spin`} aria-hidden="true" />
          : <Download className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} aria-hidden="true" />}
        {!compact && (state === 'busy' ? 'Preparing' : state === 'failed' ? 'Try again' : 'PDF')}
        {!compact && <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
      </button>
      {open && (
        <div ref={menuRef} role="menu" style={{ transform: shift ? `translateX(${shift}px)` : undefined }} className="absolute right-0 top-full mt-2 z-40 w-[min(280px,calc(100vw-32px))] p-1 rounded-lg bg-surface shadow-[0_0_0_1px_var(--c-line-strong),var(--c-shadow-float)]">
          {options.map(({ masked, icon: Icon, title, note }) => (
            <button
              key={title}
              type="button"
              role="menuitem"
              onClick={() => download(masked)}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left cursor-pointer hover:bg-surface-strong transition-colors"
            >
              <Icon className="w-4 h-4 mt-0.5 text-muted shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{title}</span>
                <span className="block font-mono text-[11px] text-muted">{note}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PdfMenu;
