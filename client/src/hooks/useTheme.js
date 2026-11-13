import { useCallback, useEffect, useState } from 'react';

const KEY = 'vesta-theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const readSaved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const current = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

// Follows the OS until the person picks a theme; their pick is remembered on this device.
// index.html sets data-theme before the first paint, so this only keeps it in sync.
export function useTheme() {
  const [theme, setThemeState] = useState(current);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeState(current()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = media();
    const onSystem = (event) => {
      if (!readSaved()) document.documentElement.setAttribute('data-theme', event.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onSystem);
    return () => { observer.disconnect(); mq.removeEventListener('change', onSystem); };
  }, []);

  const toggle = useCallback(() => {
    const next = current() === 'dark' ? 'light' : 'dark';
    // choosing the theme the OS already uses returns to following the OS
    try {
      if ((next === 'dark') === media().matches) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  return { theme, toggle };
}

// Chart colours per theme. Categorical: the dataviz reference order (blue, orange, aqua, yellow,
// magenta, then green, red, violet, brown, teal so up to ten categories each keep a colour), with the light or dark steps validated against that theme's surface.
export const chartPalette = (theme) => theme === 'dark'
  ? { series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#e66767', '#a371f7', '#bf8700', '#22a8c4'], grid: '#1f1f1f', tick: '#8f8f8f', muted: '#3d3d3d', primary: '#ededed', up: '#63c174', down: '#ff6166', surface: '#0a0a0a' }
  : { series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#e34948', '#8250df', '#9a6700', '#0e7490'], grid: '#ebebeb', tick: '#6f6f6f', muted: '#d4d4d4', primary: '#171717', up: '#1a7f37', down: '#c50000', surface: '#ffffff' };
