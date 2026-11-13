import React from 'react';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';

// Round tick values from 0 up to just past max: steps of 1, 2, 2.5 or 5 × a power of ten.
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v < max + step / 2 && ticks.length <= count + 1; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// The y-axis of a horizontally scrolling chart, drawn as its own narrow chart beside the scroll area
// so it stays put while the bars scroll. Give the scrolling chart the same ticks, height and top/bottom
// margin, and hide its own YAxis, so its gridlines line up with these labels.
// The hidden XAxis keeps the same bottom band as the scrolling chart's month labels.
const PinnedYAxis = ({ ticks, width, height, margin, tickFormatter, tick }) => (
  <div className="shrink-0 overflow-hidden" style={{ width, height }} aria-hidden="true">
    {/* 1px of plot area past the axis: Recharts draws nothing when the plot is 0px wide */}
    <BarChart width={width + 1} height={height} data={[{ x: '', v: ticks[ticks.length - 1] }]} margin={{ top: margin.top, bottom: margin.bottom, left: 0, right: 0 }} accessibilityLayer={false} style={{ overflow: 'hidden' }}>
      <XAxis dataKey="x" tick={false} axisLine={false} tickLine={false} />
      {/* an invisible series: Recharts only draws an axis's ticks when something is plotted on it */}
      <Bar dataKey="v" fill="transparent" isAnimationActive={false} />
      <YAxis
        domain={[0, ticks[ticks.length - 1]]}
        ticks={ticks}
        interval={0}
        tickFormatter={tickFormatter}
        tick={tick}
        axisLine={false}
        tickLine={false}
        width={width}
      />
    </BarChart>
  </div>
);

export default PinnedYAxis;
