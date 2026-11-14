import React, { useCallback, useLayoutEffect, useRef } from 'react';

// A ref for a table's column-header row (.pin-cols), whose rows are its next sibling (a list).
// - publishes its section heading's height as --ph-h, so the row pins just under that heading;
// - makes the header, and the heading with it, stop pinning when only the last row is left: a sticky box
//   stops where its margin box meets its container's end, so each gets a bottom margin as tall as what
//   should stay visible under it, and the box after it the same margin taken back (the two collapse, so
//   nothing moves). They then sit as a closed card: heading, header row, last row, one hairline between.
export const usePinCols = () => {
  const stop = useRef(null);
  return useCallback((el) => {
    stop.current?.();
    stop.current = null;
    const rows = el?.nextElementSibling;
    if (!rows) return;
    const head = el.closest('section')?.querySelector(':scope > .pin-head');
    const afterHead = head?.nextElementSibling;
    const reset = () => {
      el.style.marginBottom = ''; rows.style.marginTop = '';
      if (head) head.style.marginBottom = '';
      if (afterHead) afterHead.style.marginTop = '';
    };
    reset();
    // margins the layout already gives these (space-y and the like), kept under ours
    const base = (node, side) => (node ? parseFloat(getComputedStyle(node)[side]) || 0 : 0);
    const headMb = base(head, 'marginBottom');
    const afterMt = base(afterHead, 'marginTop');
    let last = null;
    const publish = () => {
      const now = rows.lastElementChild;
      if (now !== last) { if (last) ro.unobserve(last); if (now) ro.observe(now); last = now; }
      const colsH = el.getBoundingClientRect().height;
      if (head) el.style.setProperty('--ph-h', `${head.getBoundingClientRect().height}px`);
      if (!now || colsH === 0) { reset(); return; } // no rows, or the header is hidden at this width
      // the last row without its top hairline: the header's own bottom line lands on that hairline
      const lastH = now.getBoundingClientRect().height - (parseFloat(getComputedStyle(now).borderTopWidth) || 0);
      el.style.marginBottom = `${lastH}px`;
      rows.style.marginTop = `${-lastH}px`;
      if (head && afterHead) {
        head.style.marginBottom = `${headMb + colsH + lastH}px`;
        afterHead.style.marginTop = `${afterMt - colsH - lastH}px`;
      }
    };
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    if (head) ro.observe(head);
    const mo = new MutationObserver(publish); // rows added, removed or filtered
    mo.observe(rows, { childList: true });
    publish();
    stop.current = () => { ro.disconnect(); mo.disconnect(); reset(); };
  }, []);
};

// From 1024px the main column is exactly as tall as the window under the page head: its toolbar
// (search, filters, the count) stays put and only the content below it scrolls, inside the column.
// Below 1024px the page scrolls instead, and the whole toolbar pins under the head, so it looks the same.
// Its height is published as --tb-h so section headings (.pin-head) pin just under it.
// The same behaviour for a main column with no toolbar: put PANE on the column itself.
export const PANE = '@container pane-scroll lg:h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto lg:-mx-2 lg:px-2 lg:pt-px lg:pb-2';

const ScrollPane = ({ toolbar, children, className = '' }) => {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    if (!root || !bar) return undefined;
    const publish = () => root.style.setProperty('--tb-h', `${bar.offsetHeight}px`);
    const ro = new ResizeObserver(publish);
    ro.observe(bar);
    publish();
    return () => ro.disconnect();
  }, [toolbar != null]);

  return (
    <div ref={rootRef} className={`min-w-0 lg:flex lg:flex-col lg:h-[calc(100vh-var(--head-h,0px)-64px)] ${className}`} style={toolbar ? { '--pin-pad': '0px' } : undefined}>
      {toolbar && (
        // a solid band: flow-root keeps the last bottom margin inside it, and it reaches 8px past the
        // column on each side so the cards' 1px rings are covered too as they scroll under it. Phones
        // pin it straight under the menu bar, so it keeps 12px of breathing room on top there; tablets pin
        // it at the band's last pixel, so 1px on top keeps the controls' top rings in its own band.
        <div ref={barRef} className="flow-root sticky lg:static z-20 bg-canvas -mt-3 pt-3 md:-mt-px md:pt-px lg:-mt-3 lg:pt-3 -mx-2 px-2" style={{ top: 'var(--head-h, 0px)' }}>{toolbar}</div>
      )}
      {/* the inset gutter keeps the cards' hairline rings and shadows from being clipped by the scroll edge.
          1px of top padding at every width: a card's ring is drawn 1px above its edge, and the toolbar band
          (painted over the content) would otherwise cover the top ring of a card resting right under it */}
      <div className="@container pane-scroll pt-px lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mx-2 lg:px-2 lg:pb-2">{children}</div>
    </div>
  );
};

// A toolbar that scrolls in with the content above it, then pins at the top while the sections under it
// scroll past (the Performance page: the chart scrolls away, the filters stay over the tables).
// Its height is published as --sb-h on the wrapper, so section headings (.pin-head) and column-header rows
// (.pin-cols) inside pin just under it rather than under it.
export const StickyBar = ({ bar, children }) => {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const el = barRef.current;
    if (!root || !el) return undefined;
    const publish = () => root.style.setProperty('--sb-h', `${el.offsetHeight}px`);
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    publish();
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={rootRef} style={{ '--pin-pad': '0px' }}>
      {/* the same solid band as ScrollPane's toolbar; pinned under the page head below 1024px, and at the top
          of the scrolling column from 1024px (over its 1px top padding) */}
      <div ref={barRef} className="flow-root sticky z-20 bg-canvas -mx-2 px-2 pt-3 top-[var(--head-h,0px)] lg:top-[-1px]">{bar}</div>
      {children}
    </div>
  );
};

export default ScrollPane;
