import { useCallback, useEffect, useSyncExternalStore } from 'react';

// Hide amounts, as banking apps do: one switch, remembered on this device. Rupee figures turn into
// asterisks everywhere in the app (cards, lists, tooltips, chart axes); percentages and quantities stay.
const KEY = 'vesta-hide-amounts';
// The left column's hidden balance sets the look: Geist's own asterisks, semibold and spaced.
// In running text they go in a .amount-mask span (index.css) that scales them up and drops them
// level with the figures; a bare * would float small at the top of the line.
const DOTS = '****';
const MASK_CLASS = 'amount-mask';
const listeners = new Set();
let hidden = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const setHidden = (value) => {
  hidden = value;
  try { value ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {}
  listeners.forEach((fn) => fn());
};

export function usePrivacy() {
  const value = useSyncExternalStore(subscribe, () => hidden);
  const toggle = useCallback(() => setHidden(!hidden), []);
  return { hidden: value, toggle };
}

// ₹48,540 · −₹1.72L · ₹12,639/g → ₹****
const RUPEES = /₹\s?[−-]?[\d,]+(?:\.\d+)?(?:\s?(?:Cr|L|K)\b)?/g;
const BARE = /^\s*[\d,]+(?:\.\d+)?\s*(?:Cr|L|K)?\s*$/;

const maskSpan = () => {
  const span = document.createElement('span');
  span.className = MASK_CLASS;
  span.textContent = DOTS;
  return span;
};

// What a text node becomes: the text it keeps, and the nodes that follow it (mask spans and the
// text between them). SVG text (chart axes) can't hold a span, so it just swaps in the asterisks.
function plan(node) {
  const text = node.nodeValue;
  const svg = node.parentElement instanceof SVGElement;
  if (text.includes('₹') && RUPEES.test(text)) {
    RUPEES.lastIndex = 0;
    if (svg) return { keep: text.replace(RUPEES, `₹${DOTS}`), after: [] };
    const pieces = text.split(RUPEES); // the text around each amount
    const after = [];
    pieces.slice(1).forEach((piece, i) => {
      after.push(maskSpan());
      const rest = i < pieces.length - 2 ? `${piece}₹` : piece;
      if (rest) after.push(document.createTextNode(rest));
    });
    // the ₹ before each mask stays as text; pieces between amounts got theirs above
    return { keep: `${pieces[0]}₹`, after };
  }
  if (!BARE.test(text)) return null;
  // JSX like ₹{amount} renders the sign and the figure as two text nodes
  const prev = node.previousSibling;
  const afterRupee = prev?.nodeType === 3 && prev.nodeValue.trimEnd().endsWith('₹');
  if (svg) return afterRupee || node.parentElement.closest('.recharts-yAxis, .recharts-yAxis-tick-labels') ? { keep: DOTS, after: [] } : null;
  return afterRupee ? { keep: '', after: [maskSpan()] } : null;
}

// Masks the rendered text itself, so every figure is covered without each view knowing about it.
// React still owns the text nodes: when it writes a new value the observer masks that too, and
// turning the switch off removes the inserted spans and puts back whatever was last written.
export function PrivacyMask({ root = 'root' }) {
  const { hidden: on } = usePrivacy();

  useEffect(() => {
    if (!on) return undefined;
    const container = document.getElementById(root);
    if (!container) return undefined;
    const masked = new Map(); // text node → { original, written, after }
    const ours = new WeakSet();

    const unmask = (node, restore) => {
      const rec = masked.get(node);
      if (!rec) return;
      rec.after.forEach((n) => n.remove());
      if (restore && node.nodeValue === rec.written) node.nodeValue = rec.original;
      masked.delete(node);
    };
    const mask = (node) => {
      if (ours.has(node) || !node.parentNode || node.parentElement?.classList.contains(MASK_CLASS)) return;
      const rec = masked.get(node);
      if (rec && node.nodeValue === rec.written) return;
      if (rec) unmask(node, false); // React wrote a new value
      const p = plan(node);
      if (!p) return;
      const original = node.nodeValue;
      p.after.forEach((n) => ours.add(n));
      masked.set(node, { original, written: p.keep, after: p.after });
      node.nodeValue = p.keep;
      if (p.after.length) node.after(...p.after);
    };
    const walk = (el) => {
      if (ours.has(el)) return;
      if (el.nodeType === 3) return mask(el);
      if (el.nodeType !== 1) return;
      const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      for (let n = it.nextNode(); n; n = it.nextNode()) nodes.push(n);
      nodes.forEach(mask);
    };

    walk(container);
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') mask(r.target);
        else {
          r.removedNodes.forEach((n) => { if (masked.has(n)) unmask(n, false); });
          r.addedNodes.forEach(walk);
        }
      }
    });
    observer.observe(container, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      [...masked.keys()].forEach((node) => unmask(node, true));
    };
  }, [on, root]);

  return null;
}
