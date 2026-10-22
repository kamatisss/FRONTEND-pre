import { useEffect, useState } from 'react';
import { getState, subscribe } from './pwa';

/** { updateReady, installEvent, installed } — re-renders when any of them changes. */
export function usePwa() {
  const [pwa, setPwa] = useState(getState);
  useEffect(() => subscribe(setPwa), []);
  return pwa;
}

/** true / false, following the browser's online and offline events. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
