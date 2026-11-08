// The customer's lot in the 3D Studio: one size for the 3D ground, placement limits, the price
// estimate (site prep & soil are per m²) and the AI Designer hand-off.
//
// Studio coordinates: metres, lot centred on the origin, x = width (left → right),
// z = length with +z the FRONT edge (house / viewer side) — the same orientation as the
// AI Designer (lot z = length is the front), see data/sampleGarden.js lotPlantsToStudioItems.

export const LOT_MIN = 2;
export const LOT_MAX = 50;          // 3D performance on phones; larger properties need a site visit
export const LOT_STEP = 0.5;
export const LOT_MARGIN = 4;        // plain ground drawn around the lot, metres per side
export const DEFAULT_LOT = { width: 10, length: 15 };

const round = (v) => Math.round(v / LOT_STEP) * LOT_STEP;

/** A typed value → a valid side length (falls back when empty or not a number). */
export function clampLot(value, fallback = DEFAULT_LOT.width) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(LOT_MAX, Math.max(LOT_MIN, round(n)));
}

/** The lot to draw and enforce, from (possibly half-typed) design dimensions. */
export function lotOf(dimensions) {
  return {
    width: clampLot(dimensions?.width, DEFAULT_LOT.width),
    length: clampLot(dimensions?.length, DEFAULT_LOT.length),
  };
}

/**
 * New dimensions. A garden plan (beds + lawn from the AI Designer, dimensions.gardenPlan) was made for
 * one exact lot size, so it is dropped when the size changes; the plants stay where they are.
 */
export function resizeDimensions(dimensions, changes) {
  const next = { ...(dimensions || {}), ...changes };
  const resized = Number(next.width) !== Number(dimensions?.width) || Number(next.length) !== Number(dimensions?.length);
  if (resized && next.gardenPlan) delete next.gardenPlan;
  return next;
}

/** Is a ground point inside the lot? */
export function insideLot(x, z, lot, pad = 0) {
  return Math.abs(x) <= lot.width / 2 - pad + 1e-6 && Math.abs(z) <= lot.length / 2 - pad + 1e-6;
}

/** Clamp a ground point into the lot. */
export function clampToLot(x, z, lot) {
  const hw = lot.width / 2, hl = lot.length / 2;
  return { x: Math.min(hw, Math.max(-hw, x)), z: Math.min(hl, Math.max(-hl, z)) };
}

/**
 * Designs saved before the Studio had a lot were made on a 24 × 24 m ground but carry the
 * default 10 × 15 m size. Grow the lot to fit their items (whole metres, 0.5 m spare) instead of
 * leaving items outside it. Lots that already fit are returned unchanged.
 */
export function fitLotToItems(dimensions, items) {
  const lot = lotOf(dimensions);
  let hw = lot.width / 2, hl = lot.length / 2;
  for (const it of items || []) {
    const x = Number(it?.position?.x), z = Number(it?.position?.z);
    if (Number.isFinite(x)) hw = Math.max(hw, Math.abs(x) + 0.5);
    if (Number.isFinite(z)) hl = Math.max(hl, Math.abs(z) + 0.5);
  }
  // Only grow (to whole metres) when an item actually sticks out
  const width = hw * 2 > lot.width + 1e-9 ? Math.min(LOT_MAX, Math.ceil(hw * 2)) : lot.width;
  const length = hl * 2 > lot.length + 1e-9 ? Math.min(LOT_MAX, Math.ceil(hl * 2)) : lot.length;
  if (width === lot.width && length === lot.length
      && Number(dimensions?.width) === lot.width && Number(dimensions?.length) === lot.length) {
    return dimensions;
  }
  return resizeDimensions(dimensions, { width, length });
}

/** Items whose base is outside the lot (e.g. after the lot was made smaller). */
export function itemsOutsideLot(items, lot) {
  return (items || []).filter(it => {
    const x = Number(it?.position?.x), z = Number(it?.position?.z);
    return Number.isFinite(x) && Number.isFinite(z) && !insideLot(x, z, lot);
  });
}

/** A point brought just inside the lot edge (inset metres in from the edging). */
export function moveInsideLot(x, z, lot, inset = 0.3) {
  const hw = Math.max(0, lot.width / 2 - inset), hl = Math.max(0, lot.length / 2 - inset);
  return { x: Math.min(hw, Math.max(-hw, x)), z: Math.min(hl, Math.max(-hl, z)) };
}

// Common garden areas at Filipino homes (the part to be landscaped, not the title's lot area)
export const LOT_PRESETS = [
  { label: 'Small front yard', width: 3, length: 8 },
  { label: 'Front yard', width: 5, length: 10 },
  { label: 'Backyard', width: 8, length: 10 },
  { label: 'Garden lot', width: 10, length: 15 },
  { label: 'Large garden', width: 15, length: 20 },
];

