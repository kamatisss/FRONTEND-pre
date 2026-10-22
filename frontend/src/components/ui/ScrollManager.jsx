import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/*
 * Window scrolling between pages (BrowserRouter has no scroll restoration of its own):
 *  - a new page starts at the top (query-only changes like filters or ?tab= keep their place);
 *  - a link to "/#id" lands on that section;
 *  - Back/Forward returns to where the visitor was on that page.
 * Public pages fill in after they appear (fetched sections, images, lazy 3D), so the target is
 * re-applied while the page settles, and given up as soon as the visitor scrolls themselves.
 * Dashboards scroll inside their own <main>, so this never moves them.
 * It also routes a tapped phone alert (message from public/sw.js) while the app is open.
 */

const positions = new Map(); // history entry key → window.scrollY
const SETTLE_MS = 2500;

function settle(getY) {
  let stopped = false;
  const stop = () => { stopped = true; };
  const events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
  events.forEach(e => window.addEventListener(e, stop, { passive: true, once: true }));
  const started = performance.now();
  let timer;
  const tick = () => {
    if (stopped) return;
    const y = getY();
    if (y != null && Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' });
    if (performance.now() - started < SETTLE_MS) timer = setTimeout(tick, 100);
  };
  tick();
  return () => { stop(); clearTimeout(timer); events.forEach(e => window.removeEventListener(e, stop)); };
}

const navHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-nav-h')) || 0;

export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // Remember this entry's position as the visitor scrolls (not on leaving: by then the next
  // page has rendered and the browser may already have clamped scrollY to its height)
  useEffect(() => {
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => positions.set(location.key, window.scrollY));
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', save); };
  }, [location.key]);

  useLayoutEffect(() => {
    if (navType === 'POP' && positions.has(location.key)) {
      const y = positions.get(location.key);
      return settle(() => y);
    }
    if (location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      return settle(() => {
        const el = document.getElementById(id);
        return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - navHeight()) : null;
      });
    }
    return undefined;
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps -- once per history entry

  // A tapped phone alert while the app is already open: sw.js asks us to route there (no reload)
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data?.type !== 'open-url') return;
      const url = new URL(e.data.url, window.location.origin);
      if (url.origin === window.location.origin) navigate(url.pathname + url.search + url.hash);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  // A different page starts at the top
  useLayoutEffect(() => {
    if (navType !== 'POP' && location.hash.length <= 1) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- page changes only

  return null;
}
