import { useEffect, useState } from 'react';
import { getOutbox, subscribe } from './outbox';
import { getPhoto } from './photoStore';

/** The crew outbox (waiting and failed actions), re-rendering whenever it changes. */
export function useOutbox() {
  const [items, setItems] = useState(getOutbox);
  useEffect(() => subscribe(setItems), []);
  return items;
}

/** A preview address for a photo kept on the phone (null until loaded, or if it's gone). */
export function useKeptPhoto(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    getPhoto(id).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return url;
}
