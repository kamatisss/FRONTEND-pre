// The customer's lot in the 3D Studio: one size for the 3D ground, placement limits, the price
// estimate (site prep & soil are per m²) and the AI Designer hand-off.
//
// Studio coordinates: metres, lot centred on the origin, x = width (left → right),
// z = length with +z the FRONT edge (house / viewer side) — the same orientation as the
// AI Designer (lot z = length is the front), see data/sampleGarden.js lotPlantsToStudioItems.
//
// A yard that isn't a rectangle carries its shape in dimensions.outline: [{x, z, house}] corners in LOT metres
// (x 0..width, z 0..length, z = length the house side; `house` = the side from this corner to the next is a
// house wall) — the same format as the AI Designer's Mark your yard (data/yardSurvey.js, backend lot_shape.py).
// A Studio point (x, z) is the lot point (x + width / 2, z + length / 2).
import { inwardNormal, insidePolygon, nearestSide, polygonArea, shapeProblem } from './yardSurvey';

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

/** The yard's shape from saved dimensions (its own, or one that came with an AI design), fitted to the lot;
 * null when there is none or it can't be used. */
function outlineOf(dimensions, width, length) {
  // An explicit outline (null = "it's a rectangle") wins over one that came with an AI design
  const raw = dimensions && 'outline' in dimensions ? dimensions.outline
    : dimensions?.siteSurvey?.outline || dimensions?.gardenPlan?.outline;
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const pts = raw.map(p => ({ x: Math.min(width, Math.max(0, Number(p?.x))), z: Math.min(length, Math.max(0, Number(p?.z))), house: !!p?.house }));
  return pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)) && !shapeProblem(pts) ? pts : null;
}

/** The lot to draw and enforce, from (possibly half-typed) design dimensions: { width, length, outline }. */
export function lotOf(dimensions) {
  const width = clampLot(dimensions?.width, DEFAULT_LOT.width);
  const length = clampLot(dimensions?.length, DEFAULT_LOT.length);
  return { width, length, outline: outlineOf(dimensions, width, length) };
}

/** The area to be landscaped in m² (the shape's, when it has one): price estimate. */
export const lotArea = (lot) => (lot.outline ? polygonArea(lot.outline) : lot.width * lot.length);

const toLot = (x, z, lot) => ({ x: x + lot.width / 2, z: z + lot.length / 2 });
const toStudio = (p, lot) => ({ x: p.x - lot.width / 2, z: p.z - lot.length / 2 });

/**
 * New dimensions. A garden plan (beds + lawn from the AI Designer, dimensions.gardenPlan) was made for
 * one exact lot size, so it is dropped when the size changes; the plants stay where they are.
 */
export function resizeDimensions(dimensions, changes) {
  const next = { ...(dimensions || {}), ...changes };
  const resized = Number(next.width) !== Number(dimensions?.width) || Number(next.length) !== Number(dimensions?.length);
  if (resized && next.gardenPlan) delete next.gardenPlan;
  // A new shape: the AI's beds were planned for the old one
  if ('outline' in changes && JSON.stringify(changes.outline) !== JSON.stringify(lotOf(dimensions).outline)) {
    delete next.gardenPlan;
    if (next.siteSurvey) next.siteSurvey = { ...next.siteSurvey, outline: changes.outline };
  }
  // The yard keeps its shape, stretched to the new size
  const before = lotOf(dimensions);
  if (resized && before.outline && !('outline' in changes)) {
    const after = lotOf({ width: next.width, length: next.length });
    next.outline = before.outline.map(p => ({ ...p, x: Math.round((p.x * after.width / before.width) * 100) / 100,
      z: Math.round((p.z * after.length / before.length) * 100) / 100 }));
    if (next.siteSurvey) next.siteSurvey = { ...next.siteSurvey, outline: next.outline };
  }
  return next;
}

/** Is a ground point inside the lot (and its shape)? */
export function insideLot(x, z, lot, pad = 0) {
  if (!(Math.abs(x) <= lot.width / 2 - pad + 1e-6 && Math.abs(z) <= lot.length / 2 - pad + 1e-6)) return false;
  if (!lot.outline) return true;
  const p = toLot(x, z, lot);
  return insidePolygon(lot.outline, p.x, p.z) && (pad <= 0 || nearestSide(lot.outline, p).d >= pad - 1e-6);
}

/** Clamp a ground point into the lot (onto the nearest edge of its shape when outside it). */
export function clampToLot(x, z, lot) {
  const hw = lot.width / 2, hl = lot.length / 2;
  const c = { x: Math.min(hw, Math.max(-hw, x)), z: Math.min(hl, Math.max(-hl, z)) };
  return lot.outline && !insideLot(c.x, c.z, lot) ? moveInsideLot(c.x, c.z, lot, 0.02) : c;
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
  if (lot.outline) {
    const near = nearestSide(lot.outline, toLot(x, z, lot));
    const n = inwardNormal(lot.outline, near.side.a, near.side.b);
    return toStudio({ x: near.x + n.x * inset, z: near.z + n.z * inset }, lot);
  }
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

