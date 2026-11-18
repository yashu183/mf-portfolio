import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A panel over the page: a sheet from the bottom on phones, a panel from the right from 640px. Shown while
// it's rendered; `onClose` asks the owner to stop rendering it (the scrim, Escape, or a drag down).
//   - While it's open the page behind it doesn't scroll: the body is pinned where it was (the only lock iOS
//     Safari respects) and put back, at the same scroll position, when it closes.
//   - Phones: drag the sheet down to close it. The drag starts anywhere on the sheet, except inside its
//     [data-sheet-scroll] list while that list is scrolled down (there a downward swipe scrolls it back up
//     first). Let go past a third of the sheet's height, or with a quick flick, and it slides away;
//     otherwise it springs back.
//   - Focus moves into it when it opens and goes back where it was when it closes.
const Sheet = ({ label, onClose, children, className = '' }) => {
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    sheetRef.current?.focus({ preventScroll: true });
    const key = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', key);
    const y = window.scrollY;
    const b = document.body.style;
    const before = { position: b.position, top: b.top, left: b.left, right: b.right, overflow: b.overflow };
    Object.assign(b, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', overflow: 'hidden' });
    return () => {
      window.removeEventListener('keydown', key);
      Object.assign(b, before);
      window.scrollTo(0, y);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return undefined;
    const phone = window.matchMedia('(max-width: 639.98px)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let armed = false; let drag = false; let y0 = 0; let dy = 0; let lastY = 0; let lastT = 0; let v = 0; let timer;
    const place = (d, animate) => {
      const t = animate ? 'transform 220ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease' : 'none';
      el.style.transition = t;
      el.style.transform = d ? `translateY(${d}px)` : '';
      if (scrimRef.current) {
        scrimRef.current.style.transition = t;
        scrimRef.current.style.opacity = d ? String(Math.max(0, 1 - d / el.offsetHeight)) : '';
      }
    };
    const down = (e) => {
      armed = false; drag = false;
      if (!phone.matches || e.touches.length !== 1) return;
      const list = el.querySelector('[data-sheet-scroll]');
      if (list && list.contains(e.target) && list.scrollTop > 0) return;
      armed = true; y0 = lastY = e.touches[0].clientY; lastT = e.timeStamp; dy = 0; v = 0;
    };
    const move = (e) => {
      if (!armed) return;
      const y = e.touches[0].clientY;
      if (!drag) {
        if (y < y0) { armed = false; return; } // an upward swipe scrolls the list as usual
        if (y === y0) return;
        drag = true;
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, y - y0);
      v = (y - lastY) / Math.max(1, e.timeStamp - lastT); lastY = y; lastT = e.timeStamp;
      place(dy, false);
    };
    const up = () => {
      if (!drag) { armed = false; return; }
      armed = drag = false;
      if (dy > el.offsetHeight / 3 || (v > 0.5 && dy > 24)) {
        if (still.matches) { closeRef.current(); return; }
        place(el.offsetHeight, true);
        timer = setTimeout(() => closeRef.current(), 200);
      } else place(0, true);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row" role="dialog" aria-modal="true" aria-label={label}>
      <button ref={scrimRef} type="button" tabIndex={-1} className="absolute inset-0 bg-black/40 cursor-default" aria-label="Close" onClick={() => closeRef.current()} />
      <div ref={sheetRef} tabIndex={-1} className={`relative outline-none flex flex-col max-h-[80vh] overflow-hidden rounded-t-2xl bg-canvas px-4 pt-4 pb-6 shadow-[0_-1px_0_var(--c-line-strong)]
        sm:max-h-none sm:h-full sm:w-[min(420px,85vw)] sm:rounded-none sm:px-5 sm:pt-6 sm:shadow-[-1px_0_0_var(--c-line-strong),var(--c-shadow-float)] ${className}`}>
        <span className="sm:hidden shrink-0 block mx-auto mb-3 w-10 h-1 rounded-full bg-line-strong" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Sheet;
