/**
 * Repeatable random numbers (mulberry32, seeded from a string hash).
 *
 * The procedural 3D models (stones, flowers, bamboo…) want a little variety, but calling
 * Math.random() while rendering makes the shape change every time the model re-mounts and
 * breaks React's "render must be pure" rule. Seed from something stable instead, e.g. useId():
 *
 *   const seed = useId();
 *   const stones = useMemo(() => { const rand = seededRandom(seed); ... rand() ... }, [seed]);
 */
export function seededRandom(seedText = '') {
  // FNV-1a hash of the text → 32-bit starting state
  let state = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    state = Math.imul(state ^ seedText.charCodeAt(i), 16777619);
  }
  // mulberry32: returns floats in [0, 1), like Math.random()
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
