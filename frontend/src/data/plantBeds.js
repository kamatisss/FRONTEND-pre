/**
 * Planting beds round the plants of a hand-made design (the 3D Studio): in a garden the lawn stops where the
 * plants start — each plant (or group) sits in its own bed, sized for its grown spread, and plants close together
 * share one bed with a smooth, rounded edge. AI-made designs have their own beds (layout_engine.GardenPlan); this
 * is for designs without one. The beds are mulched, or carpeted with groundcover (backend groundcover.py).
 *
 * Lot metres: x 0..W left → right, z 0..L back → front. Pure canvas maths.
 */
const PPM = 16;          // mask pixels per metre
const MARGIN = 0.25;     // m of bed beyond a plant's grown spread
const MIN_R = 0.35;      // m: the smallest bed round a plant

function blur(src, w, h, rad) {
  let a = src;
  const tmp = new Float32Array(src.length);
  const k = 1 / (2 * rad + 1);
  for (let it = 0; it < 2; it++) {
    for (let j = 0; j < h; j++) {
      let acc = 0;
      const row = j * w, at = (i) => a[row + Math.min(w - 1, Math.max(0, i))];
      for (let i = -rad; i <= rad; i++) acc += at(i);
      for (let i = 0; i < w; i++) { tmp[row + i] = acc * k; acc += at(i + rad + 1) - at(i - rad); }
    }
    const out = new Float32Array(src.length);
    for (let i = 0; i < w; i++) {
      let acc = 0;
      const at = (j) => tmp[Math.min(h - 1, Math.max(0, j)) * w + i];
      for (let j = -rad; j <= rad; j++) acc += at(j);
      for (let j = 0; j < h; j++) { out[j * w + i] = acc * k; acc += at(j + rad + 1) - at(j - rad); }
    }
    a = out;
  }
  return a;
}

function inPoly(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

/**
 * plants: [{ x, z, spread }] in lot metres (spread = grown width, m). outline: the yard's shape or null.
 * → { canvas (W·PPM × L·PPM: white, alpha = bed), mask (white = bed, black = lawn: an alphaMap), area (m²),
 *     at(x, z) → true in a bed } or null when there are no plants.
 */
export function plantBeds(plants, w, l, { outline = null } = {}) {
  const list = (plants || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
  if (!list.length || !(w > 0 && l > 0)) return null;
  const mw = Math.max(4, Math.round(w * PPM)), mh = Math.max(4, Math.round(l * PPM));
  const raw = new Float32Array(mw * mh);
  list.forEach((p) => {
    const r = Math.max(MIN_R, (Number(p.spread) || 0) / 2 + MARGIN);
    const i0 = Math.max(0, Math.floor((p.x - r) * PPM)), i1 = Math.min(mw - 1, Math.ceil((p.x + r) * PPM));
    const j0 = Math.max(0, Math.floor((p.z - r) * PPM)), j1 = Math.min(mh - 1, Math.ceil((p.z + r) * PPM));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) / PPM - p.x, dz = (j + 0.5) / PPM - p.z;
        if (dx * dx + dz * dz <= r * r) raw[j * mw + i] = 1;
      }
    }
  });
  // Plants within ~60 cm of each other's beds share one: blur, then a threshold below half closes the gaps and rounds
  const soft = blur(raw, mw, mh, Math.round(0.3 * PPM));
  const shape = Array.isArray(outline) && outline.length >= 3 ? outline : null;
  const canvas = Object.assign(document.createElement('canvas'), { width: mw, height: mh });
  const mask = Object.assign(document.createElement('canvas'), { width: mw, height: mh });
  const ctx = canvas.getContext('2d'), mctx = mask.getContext('2d');
  const img = ctx.createImageData(mw, mh), mimg = mctx.createImageData(mw, mh);
  const inside = new Uint8Array(mw * mh);
  let cells = 0;
  for (let j = 0; j < mh; j++) {
    for (let i = 0; i < mw; i++) {
      const k = j * mw + i, v = soft[k];
      const a = Math.min(1, Math.max(0, (v - 0.32) / 0.12));
      const ok = a > 0.5 && (!shape || inPoly(shape, (i + 0.5) / PPM, (j + 0.5) / PPM));
      const alpha = shape && !ok ? 0 : a;
      img.data.set([255, 255, 255, Math.round(alpha * 255)], k * 4);
      const m = Math.round(alpha * 255);
      mimg.data.set([m, m, m, 255], k * 4);
      if (ok) { inside[k] = 1; cells++; }
    }
  }
  ctx.putImageData(img, 0, 0);
  mctx.putImageData(mimg, 0, 0);
  return {
    canvas, mask, area: cells / (PPM * PPM),
    at: (x, z) => {
      const i = Math.floor(x * PPM), j = Math.floor(z * PPM);
      return i >= 0 && j >= 0 && i < mw && j < mh && inside[j * mw + i] === 1;
    },
  };
}

/** Bed spread for a catalog product: its fully grown width (falls back to its planting distance), m. */
export function bedSpread(product, layoutSpacing) {
  const s = Number(product?.mature_spread || product?.established_spread) || 0;
  return s > 0 ? s : (layoutSpacing ? layoutSpacing(product) : 1);
}

/**
 * Sun / shade split of the groundcover over these beds (backend groundcover.assign): the shade-loving product under
 * the crowns of tall plants. products: the catalog. → [{ plant_id, name, area_sqm, sunlight }] (whole m²).
 */
export function groundcoverFor(area, products, crowns = 0) {
  const pool = (products || []).filter((p) => p.is_groundcover && Number(p.stock_quantity) > 0 && Number(p.unit_price) > 0 && p.is_active !== false)
    .sort((a, b) => Number(a.unit_price) - Number(b.unit_price) || a.id - b.id);
  if (!pool.length || area < 1) return [];
  const sun = pool.find((p) => p.sunlight === 'full_sun') || pool.find((p) => p.sunlight === 'partial_shade') || pool[0];
  const shade = pool.find((p) => p.sunlight === 'full_shade') || pool.find((p) => p.sunlight === 'partial_shade') || sun;
  const shadeM2 = shade.id !== sun.id ? Math.round(Math.min(crowns * 0.8, area * 0.6)) : 0;
  const sunM2 = Math.floor(area) - shadeM2;
  return [[sun, sunM2], [shade, shadeM2]]
    .filter(([p, m2]) => p && m2 >= 1)
    .map(([p, m2]) => ({ plant_id: String(p.id), name: p.name, area_sqm: Math.min(m2, Number(p.stock_quantity) || m2), sunlight: p.sunlight }));
}
