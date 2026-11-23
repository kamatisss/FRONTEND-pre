// ─── How big a 3D model is drawn ──────────────────────────────────────────────
// InventoryItem.real_world_size is in metres, at the plant's ESTABLISHED size (about 1–2 years after
// planting). What it measures depends on the category, the way nurseries and suppliers list them:
//   plant, furniture → height            (a "1.2 m strelitzia", a "1.05 m rocking chair")
//   hardscape        → the longest side  (a "0.7 m accent boulder")
// The backend reads the same number as plant height (layout_engine.py spacing and tall/mid/low
// layers, pricing.py labour rate), so the 3D view, the AI layout and the quote always agree.

export const SIZE_MEASURE = { plant: 'height', furniture: 'height', hardscape: 'longest' };

export const sizeLabel = (category) =>
  (SIZE_MEASURE[category] === 'longest' ? 'Size, longest side (m)'
    : category === 'plant' ? 'Height after ~2 years (m)' : 'Height (m)');

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

// ─── Growth over the years (the "Show plants" year slider) ────────────────────────
// The catalog gives three sizes per plant: at planting (planting_height / _spread), after about 2 years
// (real_world_size / established_spread) and fully grown (mature_height / _spread), plus years_to_mature.
// The 3D views show the garden N years after planting: each plant follows its OWN curve through those
// three sizes, so in 5 years the hibiscus (3 years) is full size while the plumeria (12 years) is still
// young. A "stage" anywhere in the views is a number of years; GROWN means each plant at full size.
// The old keys ('planting' / 'established' / 'mature') still work. Only plants grow.
export const GROWN = 100;   // "Fully grown": past every plant's own years_to_mature
export const DEFAULT_GROWTH_STAGE = 2;
const DEFAULT_YEARS = 5;    // a plant without years_to_mature: about a shrub's pace

// The three catalog sizes (the "Typical" row on the height card)
export const GROWTH_STAGES = [
  { key: 'planting', years: 0, label: 'At planting', short: 'Planting' },
  { key: 'established', years: 2, label: 'In 2 years', short: '2 years' },
  { key: 'mature', years: GROWN, label: 'Fully grown', short: 'Grown' },
];
// The slider's stops
export const GROWTH_STOPS = [
  { years: 0, label: 'At planting', short: 'Now' },
  { years: 1, label: 'In 1 year', short: '1 yr' },
  { years: 2, label: 'In 2 years', short: '2 yrs' },
  { years: 5, label: 'In 5 years', short: '5 yrs' },
  { years: 10, label: 'In 10 years', short: '10 yrs' },
  { years: GROWN, label: 'Fully grown', short: 'Grown' },
];

/** Years after planting for a stage: a number, or an old key ('planting' 0, 'established' 2, 'mature' GROWN). */
export function stageYears(stage) {
  if (stage == null || stage === '') return DEFAULT_GROWTH_STAGE;
  const key = GROWTH_STAGES.find((g) => g.key === stage);
  if (key) return key.years;
  const n = Number(stage);
  return Number.isFinite(n) ? Math.min(GROWN, Math.max(0, n)) : DEFAULT_GROWTH_STAGE;
}

// ─── Trees they keep ──────────────────────────────────────────────────────────
// A tree already in the yard (Mark your yard: "keep") is drawn at the size they marked: that is now. It is
// established, so it grows slowly, but it does grow: about 15% wider and taller over 10 years (a 6 m crown
// gains about 1 m), and no more after that (its own full size isn't known). Same at "Fully grown".
export const KEPT_TREE_GROWTH = 0.15;
/** Scale for a kept tree at a stage (1 = the size marked, at planting). */
export function keptTreeGrowth(stage) {
  return 1 + KEPT_TREE_GROWTH * Math.min(1, stageYears(stage) / 10);
}

/** The slider label for a stage ("In 5 years", "Fully grown"). */
export const growthLabel = (stage) => {
  const y = stageYears(stage);
  return GROWTH_STOPS.find((s) => s.years === y)?.label || `In ${y} years`;
};

/** Years after planting until this plant is drawn fully grown. At least 3: the office's own "after about
 *  2 years" size stays true at year 2 even for a plant that is "fully grown within about 2 years". */
export function matureYears(product) {
  const y = Number(product?.years_to_mature) || DEFAULT_YEARS;
  return Math.max(3, y);
}

/** True when the plant is at its full size in this view. */
export const isFullyGrown = (product, stage) => stageYears(stage) >= matureYears(product);

// One size along the plant's curve: planting → 2 years straight (young plants put on size fast once
// rooted), then 2 years → fully grown slowing down as it nears full size (ease-out), then it stays.
// Missing sizes: planting or fully grown missing → the 2-year size stands in (as before); returns 0 when
// the 2-year size itself is unknown.
function along(p, e, m, years, product) {
  if (!(e > 0)) return 0;
  const start = p > 0 ? p : e, end = m > 0 ? m : e;
  if (years <= 0) return start;
  if (years <= 2) return start + (e - start) * (years / 2);
  const full = matureYears(product);
  if (years >= full) return end;
  const t = (years - 2) / (full - 2);
  return e + (end - e) * (1 - (1 - t) * (1 - t));
}

/** Metres to draw this product at for a growth stage (non-plants: their size, unchanged). */
export function stageSize(product, stage, category = product?.category) {
  const established = Number(product?.real_world_size) || 0;
  if (category !== 'plant' || !established) return established || undefined;
  return along(Number(product?.planting_height) || 0, established, Number(product?.mature_height) || 0,
    stageYears(stage), product);
}

// ─── Specimen size: bigger stock at planting ──────────────────────────────────
// A customer may have a plant planted as a SPECIMEN (catalog specimen_price / specimen_height; installed jobs,
// backend pricing.py). It is the same plant, only older: so it follows the same curve with a HEAD START, the
// years a standard plant takes to reach the specimen's planted height. A specimen hibiscus planted at 1.2 m
// is where a standard one is after about 2 years, and is fully grown that much sooner. Every view (sizes,
// the card, crowding, flowers and fruit) just uses sizedStage() for that plant.
export const SPECIMEN = 'specimen';

/** True when this catalog plant can be ordered in the specimen size. */
export const hasSpecimen = (product) => !!product && (product.category || 'plant') === 'plant' && !product.is_groundcover
  && Number(product.specimen_price) > 0 && Number(product.specimen_height) > 0;

/** Years a standard plant takes to reach the specimen's planted height (0 = no specimen size). */
export function specimenHeadStart(product) {
  if (!hasSpecimen(product)) return 0;
  const target = Number(product.specimen_height);
  const full = matureYears(product);
  if (target >= (Number(stageSize(product, full, 'plant')) || 0)) return full;
  let lo = 0, hi = full;
  for (let i = 0; i < 32; i++) {   // the curve only rises, so halve the interval
    const mid = (lo + hi) / 2;
    if ((Number(stageSize(product, mid, 'plant')) || 0) < target) lo = mid; else hi = mid;
  }
  return hi;
}

/** matureWhen() for a specimen: it is fully grown its head start sooner. */
export function specimenMatureWhen(product) {
  if (!hasSpecimen(product)) return matureWhen(product);
  return matureWhen({ years_to_mature: Math.max(1, Math.round(matureYears(product) - specimenHeadStart(product))) });
}

/** The stage to draw THIS plant at: its years, plus the specimen's head start when it is one. */
export function sizedStage(stage, product, size) {
  if (size !== SPECIMEN || !hasSpecimen(product)) return stage;
  const y = stageYears(stage);
  return y >= GROWN ? GROWN : Math.min(GROWN - 1, y + specimenHeadStart(product));
}

// ─── Width at a growth stage ──────────────────────────────────────────────────
// planting_spread / established_spread / mature_spread (metres wide). Plants don't widen at the rate they
// grow taller, so the 3D views scale width and height separately. Missing data → width follows height.

/** Metres wide at a growth stage, or 0 when unknown (the 3D views then let the width follow the height). */
export function stageSpread(product, stage, category = product?.category) {
  if ((category || 'plant') !== 'plant') return 0;
  const p = Number(product?.planting_spread) || 0, e = Number(product?.established_spread) || 0;
  const m = Number(product?.mature_spread) || 0;
  const years = stageYears(stage);
  // On a segment with a missing end: unknown, except exactly at a size the catalog gives
  if (years <= 0 && !p) return 0;
  if (years > 2 && !m) return 0;
  if (years > 0 && years < 2 && !p) return 0;
  return along(p, e, m, years, product);
}

// ─── Natural variation ────────────────────────────────────────────────────────
// Nursery stock is never identical: ten crotons from one batch differ by about ±10% in height and width.
// Drawing every copy at exactly the catalog size looks computer-made, so each placed plant gets its own
// small, FIXED variation from its id (the same plant is the same size every time it's drawn, at every
// stage). Visual only: the height card, the AI layout and the quote keep the catalog sizes.
export const VARIATION = 0.08;   // ±8%

function hash01(text) {
  let h = 2166136261;   // FNV-1a
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** { h, w }: this plant's own height and width multipliers (1 ± VARIATION). Non-plants or no id: { 1, 1 }. */
export function plantVariation(id, category = 'plant') {
  if ((category || 'plant') !== 'plant' || id == null || id === '') return { h: 1, w: 1 };
  const h = 1 + (hash01(`${id}|h`) * 2 - 1) * VARIATION;
  // Width varies on its own a little, but mostly with the height (a taller plant is usually a bigger plant)
  const w = 1 + ((hash01(`${id}|w`) * 2 - 1) * 0.5 * VARIATION) + (h - 1) * 0.5;
  return { h, w };
}

// ─── Growing between stages ───────────────────────────────────────────────────
// Switching "At planting · In 2 years · Fully grown" animates the plants to their new size instead of
// jumping, so the customer sees the garden grow. Off for people who asked their device for less motion.
export const GROW_MS = 750;
export const growEase = (t) => (t >= 1 ? 1 : 1 - Math.pow(1 - Math.max(0, t), 3));   // ease-out cubic
export const growMotionOk = () => !(typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// ─── Years to fully grown ─────────────────────────────────────────────────────
// "Fully grown" is not one moment: a banana gets there in about 2 years, a plumeria in 10–15. The catalog's
// years_to_mature (years after planting, optional) says when, so the height card can say it.
/** "about 12 years after planting" / "within about 2 years" / '' (unknown). */
export function matureWhen(product) {
  const y = Math.round(Number(product?.years_to_mature) || 0);
  if (!(y > 0)) return '';
  return y <= 2 ? 'within about 2 years' : `about ${y} years after planting`;
}

// How far a model may be stretched or squeezed sideways to show its real width: beyond this it stops
// looking like the plant (a 3D model has its own shape), so it gets as close as it can.
export const WIDTH_FIT = [0.6, 1.4];

/**
 * Sideways multiplier that draws a model `target` metres wide when, at its height scale, it is
 * naturally `natural` metres wide (its widest side). 1 when either is unknown.
 */
export function widthFit(target, natural) {
  if (!(target > 0) || !(natural > 0)) return 1;
  return Math.min(WIDTH_FIT[1], Math.max(WIDTH_FIT[0], target / natural));
}
