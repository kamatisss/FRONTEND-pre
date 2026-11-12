/**
 * The lawn look the viewer chose for the 3D views (data/grassField.js LAWN_LOOKS): just mown, natural (default)
 * or long grass. Remembered in this browser only — a viewing preference, not part of the design.
 */
import { useCallback, useState } from 'react';
import { DEFAULT_LAWN_LOOK, LAWN_LOOKS } from './grassField';

const KEY = 'gs_lawn_look';

function read() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && LAWN_LOOKS[v] ? v : DEFAULT_LAWN_LOOK;
  } catch {
    return DEFAULT_LAWN_LOOK;
  }
}

export function useLawnLook() {
  const [look, setLook] = useState(read);
  const set = useCallback((v) => {
    if (!LAWN_LOOKS[v]) return;
    setLook(v);
    try { window.localStorage.setItem(KEY, v); } catch { /* private window: just not remembered */ }
  }, []);
  return [look, set];
}
