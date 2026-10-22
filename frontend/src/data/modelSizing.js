// ─── How big a 3D model is drawn ──────────────────────────────────────────────
// InventoryItem.real_world_size is in metres, at the plant's ESTABLISHED size (about 1–2 years after
// planting). What it measures depends on the category, the way nurseries and suppliers list them:
//   plant, furniture → height            (a "1.2 m strelitzia", a "1.05 m rocking chair")
//   hardscape        → the longest side  (a "0.7 m accent boulder")
// The backend reads the same number as plant height (layout_engine.py spacing and tall/mid/low
// layers, pricing.py labour rate), so the 3D view, the AI layout and the quote always agree.

export const SIZE_MEASURE = { plant: 'height', furniture: 'height', hardscape: 'longest' };

export const sizeLabel = (category) =>
  (SIZE_MEASURE[category] === 'longest' ? 'Size, longest side (m)' : 'Height (m)');

export const sizeHint = (category) => (SIZE_MEASURE[category] === 'longest'
  ? 'Accent boulders are usually 0.5–0.9 m.'
  : category === 'plant'
    ? 'Established size, about 1–2 years after planting.'
    : 'Overall height, e.g. a bench with a backrest is about 0.8 m.');

/** Uniform scale that makes a model of raw bounding-box `size` (THREE.Vector3) its real size. */
export function realScale(size, realWorldSize, category) {
  const measured = SIZE_MEASURE[category] === 'longest' ? Math.max(size.x, size.y, size.z) : size.y;
  return measured > 0 ? realWorldSize / measured : 1;
}

// Studio items used to be placed at 80% of their size; designs saved then still carry 0.8.
// Everything is shown at real size now, so that old default reads as 1.
const LEGACY_PLACED_SCALE = 0.8;
export const placedScale = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.abs(n - LEGACY_PLACED_SCALE) < 1e-6 ? 1 : n;
};
