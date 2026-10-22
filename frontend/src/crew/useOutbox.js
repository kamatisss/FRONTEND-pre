import { useEffect, useState } from 'react';
import { getOutbox, subscribe } from './outbox';

/** The crew outbox (waiting and failed actions), re-rendering whenever it changes. */
export function useOutbox() {
  const [items, setItems] = useState(getOutbox);
  useEffect(() => subscribe(setItems), []);
  return items;
}
