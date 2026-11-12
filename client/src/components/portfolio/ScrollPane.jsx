import React, { useLayoutEffect, useRef } from 'react';

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
    <div ref={rootRef} className={`min-w-0 lg:flex lg:flex-col lg:h-[calc(100vh-var(--head-h,0px)-64px)] ${className}`}>
      {toolbar && (
        // a solid band: flow-root keeps the last bottom margin inside it, and it reaches 8px past the
        // column on each side so the cards' 1px rings are covered too as they scroll under it. Phones
        // pin it straight under the menu bar, so it keeps 12px of breathing room on top there; tablets pin
        // it at the band's last pixel, so 1px on top keeps the controls' top rings in its own band.
        <div ref={barRef} className="flow-root sticky lg:static z-20 bg-canvas -mt-3 pt-3 md:-mt-px md:pt-px lg:-mt-3 lg:pt-3 -mx-2 px-2" style={{ top: 'var(--head-h, 0px)' }}>{toolbar}</div>
      )}
      {/* the inset gutter keeps the cards' hairline rings and shadows from being clipped by the scroll edge */}
      <div className="@container pane-scroll lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mx-2 lg:px-2 lg:pt-px lg:pb-2">{children}</div>
    </div>
  );
};

export default ScrollPane;
