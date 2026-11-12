import React from 'react';
import { ArrowRight } from 'lucide-react';

// "from → to" in date ranges and before/after figures, drawn with lucide's arrow rather than a text glyph.
const ToArrow = ({ className = '' }) => (
  <ArrowRight className={`inline-block w-3 h-3 mx-1 align-[-1px] text-muted ${className}`} strokeWidth={2} aria-label="to" role="img" />
);

export default ToArrow;
