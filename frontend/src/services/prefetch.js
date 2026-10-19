// Warm up the free 3D Studio's code before the visitor clicks, so it opens without
// a loading wait. Same module the router lazy-loads, so the browser reuses the download.
// Skipped when the visitor asked to save data.

let studio = null;

const savesData = () => {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
};

export function prefetchStudio() {
  if (studio || savesData()) return;
  studio = import('../components/TryStudio').catch(() => { studio = null; });
}

// When the browser is idle (after the page has loaded)
export function prefetchStudioWhenIdle() {
  const run = () => (window.requestIdleCallback ? window.requestIdleCallback(prefetchStudio, { timeout: 4000 }) : setTimeout(prefetchStudio, 2000));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
