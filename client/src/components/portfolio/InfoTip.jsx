import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

// A small info icon that explains something on hover or keyboard focus. The tip is drawn on <body> with fixed
// positioning, so a scrolling menu or a clipped card can't cut it off; it sits under the icon, or above it
// near the bottom of the window, and stays inside the window's edges.
const InfoTip = ({ children, label = 'What this means', className = '', wide = false }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const iconRef = useRef(null);
  const tipRef = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !iconRef.current || !tipRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    const gap = 8;
    const below = r.bottom + gap + t.height <= window.innerHeight - gap;
    const top = below ? r.bottom + gap : r.top - gap - t.height;
    const left = Math.min(Math.max(gap, r.left + r.width / 2 - t.width / 2), window.innerWidth - gap - t.width);
    setPos({ top, left });
  }, [open]);

  const show = () => { setPos(null); setOpen(true); };
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={iconRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        // inside a menu row or a clickable card, the icon only explains: it never picks or opens anything
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') hide(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); } }}
        className={`inline-grid place-items-center w-5 h-5 shrink-0 rounded-full text-muted hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong cursor-help transition-colors ${className}`}
      >
        <Info className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      {open && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className={`z-[100] w-max ${wide ? 'max-w-[340px]' : 'max-w-[260px]'} rounded-lg bg-surface px-3 py-2.5 text-[12px] leading-[18px] text-body shadow-[0_0_0_1px_var(--c-ring),0_8px_16px_-4px_rgb(0_0_0/0.12),0_24px_32px_-8px_rgb(0_0_0/0.14)] pointer-events-none`}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
};

export default InfoTip;
