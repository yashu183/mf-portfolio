import React from 'react';

// From 1024px the main column is exactly as tall as the window under the page head: its toolbar
// (search, filters, the count) stays put and only the content below it scrolls, inside the column.
// Below 1024px it's an ordinary block and the page scrolls (the filter bar pins itself instead).
// The same behaviour for a main column with no toolbar: put PANE on the column itself.
export const PANE = 'pane-scroll lg:h-[calc(100vh-var(--head-h,0px)-64px)] lg:overflow-y-auto lg:-mx-2 lg:px-2 lg:pt-px lg:pb-2';

const ScrollPane = ({ toolbar, children, className = '' }) => (
  <div className={`min-w-0 lg:flex lg:flex-col lg:h-[calc(100vh-var(--head-h,0px)-64px)] ${className}`}>
    {toolbar}
    {/* the inset gutter keeps the cards' hairline rings and shadows from being clipped by the scroll edge */}
    <div className="pane-scroll lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mx-2 lg:px-2 lg:pt-px lg:pb-2">{children}</div>
  </div>
);

export default ScrollPane;
