import { useEffect, useRef, useState } from 'react';

/* Queue badges that stay current without reloading the list under the user's mouse.
   Every `intervalMs` (only while the browser tab is visible) it asks the counts endpoint
   how many records arrived since the newest one this screen has seen; the screen then
   offers "3 new orders · Show" instead of reshuffling rows on its own.
   Bumping `stamp` (a manual refresh) re-reads everything and clears the "new" number. */
export function useLiveCounts({ url, authHeaders, stamp, onCounts, intervalMs = 45000 }) {
  const [counts, setCounts] = useState(null);
  const [fresh, setFresh]   = useState(0);
  const seen = useRef(null);
  const onCountsRef = useRef(onCounts);
  useEffect(() => { onCountsRef.current = onCounts; }, [onCounts]);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : null))
      .then(c => {
        if (!c || cancelled) return;
        seen.current = c.latest_id;
        setCounts(c);
        setFresh(0);
        onCountsRef.current?.(c);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url, authHeaders, stamp]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden || seen.current == null) return;
      fetch(`${url}?since=${seen.current}`, { headers: authHeaders })
        .then(r => (r.ok ? r.json() : null))
        .then(c => {
          if (!c) return;
          setCounts(c);
          setFresh(c.new || 0);
          onCountsRef.current?.(c);
        })
        .catch(() => {});
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [url, authHeaders, intervalMs]);

  return { counts, fresh };
}
