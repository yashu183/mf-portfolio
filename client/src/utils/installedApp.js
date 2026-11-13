// The installed app (PWA) shows the welcome page on its first logged-out launch, then opens on
// the access code screen. In a browser tab nothing changes: logged out still means the welcome page.
const WELCOMED_KEY = 'vesta-app-welcomed';

export const isInstalledApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const markAppWelcomed = () => {
  if (!isInstalledApp()) return;
  try { localStorage.setItem(WELCOMED_KEY, '1'); } catch { /* storage blocked: the welcome page shows again, which is harmless */ }
};

export const skipWelcome = () => {
  if (!isInstalledApp()) return false;
  try { return localStorage.getItem(WELCOMED_KEY) === '1'; } catch { return false; }
};
