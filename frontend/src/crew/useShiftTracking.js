import { useEffect, useRef, useState } from 'react';

/*
 * Shares the crew member's position with the office while ON SHIFT (clocked in, or out on a delivery),
 * every ~45 s, only while the crew app is open and on screen (a web app can't track in the background,
 * and we don't want it to). The server double-checks the shift and answers 409 when it's over, which
 * stops sharing. Backend: apps/library/crew_location.py. Privacy Notice explains it to the crew.
 *
 *   const { sharing, lastSent, problem } = useShiftTracking(onShift, { api, headers })
 */
const EVERY_MS = 45000;

export default function useShiftTracking(onShift, { api, headers }) {
  const [sharing, setSharing] = useState(false);
  const [lastSent, setLastSent] = useState(null);
  const [problem, setProblem] = useState('');
  const latest = useRef(null);
  const auth = headers?.Authorization;

  useEffect(() => {
    if (!onShift || !navigator.geolocation) return undefined;
    let stopped = false;
    const send = async () => {
      const p = latest.current;
      if (stopped || !p || document.visibilityState !== 'visible' || navigator.onLine === false) return;
      try {
        const r = await fetch(`${api}/crew-location/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ lat: p.latitude, lng: p.longitude, accuracy: p.accuracy }),
        });
        if (r.status === 409) { stopped = true; setSharing(false); return; }   // not on shift any more
        if (r.ok) { setSharing(true); setLastSent(new Date()); setProblem(''); }
      } catch { /* no signal: the next tick tries again with a fresh position */ }
    };
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const first = !latest.current;
        latest.current = pos.coords;
        if (first) send();
      },
      (err) => setProblem(err.code === err.PERMISSION_DENIED
        ? 'Location is off for this app: the office cannot see where you are.'
        : ''),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    const timer = setInterval(send, EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') send(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      latest.current = null;
      setSharing(false);
    };
  }, [onShift, api, auth]);

  return { sharing: onShift && sharing, lastSent, problem: onShift ? problem : '' };
}
