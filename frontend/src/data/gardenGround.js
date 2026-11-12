/**
 * The ground under a garden in ThreeGardenCanvas (AI designs, shared links, staff and crew views, the
 * landing hero): what makes the 3D view read as a real yard rather than a diagram.
 *
 *  - The lot is ONE painted surface at true scale: lawn (blades, mowing stripes, light patches) with a
 *    concrete mowing strip around it, mulched beds, gravel paths, and paving outside a shaped yard.
 *    Painted in 2D (canvas patterns from small procedural tiles, nothing downloaded) so the joins are
 *    clean at any lot size, it exports as one picture in the .glb, and it costs one draw call.
 *  - Real 3D on top only where height matters: the concrete kerb round the lot (as in the Studio), the
 *    house walls of a shaped yard as a low plinth, stepping stones on the paths.
 *  - A plain surround that fades into the haze, and a sky dome, instead of a hard edge on white.
 *  - Dimension lines along the front and right side (labels are HTML, drawn by the canvas), and an
 *    optional 1 m grid (5 m lines stronger) that keeps square cells on any lot.
 *
 * Lot coordinates throughout: x 0..W left → right, z 0..L back → front (front = the house side,
 * nearest the default camera), y up, metres.
 */
import * as THREE from 'three';

export const KERB = { width: 0.07, height: 0.11, color: '#5d554b' };   // low, dark garden edging round the lot (not a light curb)
const HOUSE_PLINTH = { height: 0.45, depth: 0.3, color: '#6b7078' };
const LOT_Y = 0.003;           // the painted lot sits just above the surround
const MAX_PPM = 80;            // pixels per metre of painted ground at most (sharp up close on small lots)
export const DIM_OFFSET = 0.55;  // m: dimension lines this far outside the lot

/* ── Small helpers ───────────────────────────────────────────────────────── */
function seeded(seed) {   // mulberry32: the same yard always paints the same way (no shimmer on redraw)
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// Draw something near a tile's edge on the opposite side too, so the tile repeats without seams
function wrapped(size, x, y, reach, draw) {
  for (const dx of [0, -size, size]) {
    if (dx && (dx < 0 ? x < size - reach : x > reach)) continue;
    for (const dy of [0, -size, size]) {
      if (dy && (dy < 0 ? y < size - reach : y > reach)) continue;
      draw(x + dx, y + dy);
    }
  }
}

/* ── Tiles: small seamless pictures, painted once per visit ──────────────── */
// px: tile size in pixels; metres: how much ground one tile covers
const TILES = {
  grass: { px: 512, metres: 2, seed: 11, paint(ctx, s, r) {
    ctx.fillStyle = '#4c8531'; ctx.fillRect(0, 0, s, s);
    // Soft clumps first (thicker and thinner turf), then thousands of blades seen from above
    for (let i = 0; i < 70; i++) {
      const x = r() * s, y = r() * s, rad = 18 + r() * 40;
      wrapped(s, x, y, rad, (px, py) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, r() < 0.5 ? 'rgba(120,170,70,0.22)' : 'rgba(40,85,25,0.22)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    const greens = ['#3d7426', '#4f8c33', '#5e9d3d', '#6aab47', '#457f2c', '#78b653', '#36692a', '#8cc062'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 11000; i++) {
      const x = r() * s, y = r() * s, len = 3 + r() * 6, a = r() * Math.PI * 2;
      const dx = Math.cos(a) * len, dy = Math.sin(a) * len;
      ctx.strokeStyle = pick(r, greens);
      ctx.globalAlpha = 0.55 + r() * 0.4;
      ctx.lineWidth = 1 + r() * 1.2;
      wrapped(s, x, y, 10, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx, py + dy); ctx.stroke(); });
    }
    ctx.globalAlpha = 0.35;   // a little soil showing through
    for (let i = 0; i < 500; i++) { ctx.fillStyle = r() < 0.5 ? '#2c3b1a' : '#3a3420'; ctx.fillRect(r() * s, r() * s, 1.5, 1.5); }
    ctx.globalAlpha = 1;
  } },
  mulch: { px: 512, metres: 1.2, seed: 23, paint(ctx, s, r) {
    ctx.fillStyle = '#2d1f14'; ctx.fillRect(0, 0, s, s);
    const browns = ['#3f2b1d', '#47301f', '#2f2016', '#55392a', '#22170f', '#5c4330', '#402b1c', '#6a4d36'];
    for (let i = 0; i < 9000; i++) {
      const x = r() * s, y = r() * s, rx = 2.5 + r() * 6, ry = 1.2 + r() * 2.2, a = r() * Math.PI;
      const fill = pick(r, browns);
      wrapped(s, x, y, 10, (px, py) => {
        ctx.fillStyle = 'rgba(10,6,3,0.5)';   // the chip's shadow, then the chip
        ctx.beginPath(); ctx.ellipse(px + 0.9, py + 1.1, rx, ry, a, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.ellipse(px, py, rx, ry, a, 0, Math.PI * 2); ctx.fill();
      });
    }
    const leaves = ['#7a6a3c', '#8a7442', '#5f5a2e', '#6e5530'];   // a few dry leaves and bits of litter
    for (let i = 0; i < 90; i++) {
      const x = r() * s, y = r() * s, rx = 5 + r() * 7, ry = 2.5 + r() * 3, a = r() * Math.PI, fill = pick(r, leaves);
      wrapped(s, x, y, 14, (px, py) => {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.ellipse(px, py, rx, ry, a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
  } },
  gravel: { px: 256, metres: 0.6, seed: 37, paint(ctx, s, r) {
    ctx.fillStyle = '#a99d88'; ctx.fillRect(0, 0, s, s);
    const stones = ['#d6ccb8', '#bdb19c', '#c9bea8', '#9a8f7b', '#e4ddcf', '#b3a48b'];
    for (let i = 0; i < 2600; i++) {
      const x = r() * s, y = r() * s, rad = 1.6 + r() * 2.6, fill = pick(r, stones);
      wrapped(s, x, y, 6, (px, py) => {
        ctx.fillStyle = 'rgba(60,50,40,0.35)';
        ctx.beginPath(); ctx.arc(px + 0.8, py + 0.9, rad, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
      });
    }
  } },
  paving: { px: 256, metres: 1.2, seed: 41, paint(ctx, s, r) {
    const half = s / 2;
    for (const [x, y] of [[0, 0], [half, 0], [0, half], [half, half]]) {   // 2 × 2 slabs of 60 cm
      const v = Math.round(188 + (r() - 0.5) * 16);
      ctx.fillStyle = `rgb(${v},${v - 5},${v - 14})`; ctx.fillRect(x, y, half, half);
    }
    for (let i = 0; i < 3000; i++) {
      const v = Math.round(150 + r() * 80);
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`; ctx.fillRect(r() * s, r() * s, 1.5, 1.5);
    }
    ctx.fillStyle = '#8d877c';   // joints
    for (const p of [0, half]) { ctx.fillRect(p - 1.5, 0, 3, s); ctx.fillRect(0, p - 1.5, s, 3); }
  } },
};
const tileCache = {};
function tileOf(name) {
  if (!tileCache[name]) {
    const t = TILES[name];
    const c = makeCanvas(t.px, t.px);
    t.paint(c.getContext('2d'), t.px, seeded(t.seed));
    tileCache[name] = c;
  }
  return tileCache[name];
}
// A canvas pattern laid in METRE space (the painter's transform is pixels-per-metre)
function patternOf(ctx, name) {
  const t = TILES[name];
  const p = ctx.createPattern(tileOf(name), 'repeat');
  const k = t.metres / t.px;
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  return p;
}

/* ── The painted lot ─────────────────────────────────────────────────────── */
function yardPath(ctx, outline, w, l) {
  ctx.beginPath();
  if (outline) {
    outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
    ctx.closePath();
  } else {
    ctx.rect(0, 0, w, l);
  }
}

function lawnPaths(plan) {
  const out = [];
  const g = plan.lawn;
  if (g.shape === 'ellipse') {
    out.push((ctx) => { ctx.beginPath(); ctx.ellipse(g.cx, g.cz, g.rx, g.rz, 0, 0, Math.PI * 2); });
  } else {
    out.push((ctx) => { ctx.beginPath(); ctx.rect(g.x0, g.z0, g.x1 - g.x0, g.z1 - g.z0); });
  }
  const e = plan.entry;
  if (e) out.push((ctx) => { ctx.beginPath(); ctx.rect(e.x0, e.z0, e.x1 - e.x0, e.z1 - e.z0); });
  return out;
}

// Turf over whatever path is current. A home lawn, not a sports pitch: no mowing stripes, just the gentle
// unevenness of real grass — broad lighter and darker drifts, a few sun-dried (yellower) patches, small clumps
function turf(ctx, r, x0, z0, x1, z1) {
  ctx.fillStyle = patternOf(ctx, 'grass');
  ctx.fill();
  ctx.save();
  ctx.clip();
  const area = (x1 - x0) * (z1 - z0);
  const blot = (n, rad0, rad1, tones) => {
    for (let i = 0; i < n; i++) {
      const cx = x0 + r() * (x1 - x0), cz = z0 + r() * (z1 - z0), rad = rad0 + r() * (rad1 - rad0);
      const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, rad);
      g.addColorStop(0, tones[Math.floor(r() * tones.length)]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cz - rad, rad * 2, rad * 2);
    }
  };
  blot(Math.max(3, Math.round(area / 10)), 1.2, 3.2, ['rgba(20,55,10,0.10)', 'rgba(150,175,80,0.08)']);   // broad drifts
  blot(Math.max(2, Math.round(area / 25)), 0.5, 1.4, ['rgba(176,170,88,0.13)']);                           // sun-dried patches
  blot(Math.min(400, Math.max(6, Math.round(area * 1.5))), 0.12, 0.4, ['rgba(25,60,15,0.12)', 'rgba(140,170,70,0.10)']);   // clumps
  ctx.restore();
}

/* ── The lawn's own shape, as a garden designer cuts it ───────────────────────
   The plan's lawn and its entry are a union of an oval (or rectangle) and a strip. Cut as is, that is a
   stadium. Here the union is drawn into a small mask, blurred and re-thresholded: the joins become rounded
   fillets and the corners soften (about 0.2 m on formal rectangles, 0.45 m on informal ovals), and on
   informal lawns the threshold wanders a little so the edge is gently irregular, like a hand-cut bed edge.
   → { at(x, z): > 0 inside (roughly 0..0.5), canvas: the mask as alpha (any size, drawn over W × L) } */
const MASK_PPM = 32;
function boxBlur(src, w, h, rad) {
  let a = src;
  const tmp = new Float32Array(src.length);
  const k = 1 / (2 * rad + 1);
  for (let it = 0; it < 3; it++) {
    for (let j = 0; j < h; j++) {           // rows
      let acc = 0;
      const row = j * w, at = (i) => a[row + Math.min(w - 1, Math.max(0, i))];
      for (let i = -rad; i <= rad; i++) acc += at(i);
      for (let i = 0; i < w; i++) { tmp[row + i] = acc * k; acc += at(i + rad + 1) - at(i - rad); }
    }
    const out = new Float32Array(src.length);
    for (let i = 0; i < w; i++) {           // columns
      let acc = 0;
      const at = (j) => tmp[Math.min(h - 1, Math.max(0, j)) * w + i];
      for (let j = -rad; j <= rad; j++) acc += at(j);
      for (let j = 0; j < h; j++) { out[j * w + i] = acc * k; acc += at(j + rad + 1) - at(j - rad); }
    }
    a = out;
  }
  return a;
}
const wobble = (x, z) => 0.55 * Math.sin(x * 1.3 + Math.sin(z * 0.7) * 1.7) + 0.3 * Math.sin(z * 1.15 + x * 0.45 + 2) + 0.15 * Math.sin((x + z) * 2.7);

export function lawnShape(plan, w, l) {
  if (!plan?.lawn) return null;
  const mw = Math.max(8, Math.round(w * MASK_PPM)), mh = Math.max(8, Math.round(l * MASK_PPM));
  const c = makeCanvas(mw, mh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(mw / w, 0, 0, mh / l, 0, 0);
  ctx.fillStyle = '#fff';
  lawnPaths(plan).forEach((sh) => { sh(ctx); ctx.fill(); });
  const raw = ctx.getImageData(0, 0, mw, mh).data;
  const a = new Float32Array(mw * mh);
  for (let i = 0; i < a.length; i++) a[i] = raw[i * 4 + 3] / 255;
  const informal = plan.lawn.shape === 'ellipse';
  const soft = boxBlur(a, mw, mh, Math.max(1, Math.round(((informal ? 0.45 : 0.2) * MASK_PPM) / 1.7)));
  const amp = informal ? 0.12 : 0;
  const level = (x, z) => 0.5 + amp * wobble(x, z);
  const at = (x, z) => {
    const i = Math.min(mw - 1, Math.max(0, Math.floor((x / w) * mw))), j = Math.min(mh - 1, Math.max(0, Math.floor((z / l) * mh)));
    return soft[j * mw + i] - level(x, z);
  };
  // The mask as a picture, anti-aliased over ±0.04 of the threshold
  const img = ctx.createImageData(mw, mh);
  for (let j = 0; j < mh; j++) {
    for (let i = 0; i < mw; i++) {
      const k = j * mw + i, d = soft[k] - level(((i + 0.5) / mw) * w, ((j + 0.5) / mh) * l);
      img.data[k * 4] = 255; img.data[k * 4 + 1] = 255; img.data[k * 4 + 2] = 255;
      img.data[k * 4 + 3] = Math.round(Math.min(1, Math.max(0, (d + 0.04) / 0.08)) * 255);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, mw, mh);
  ctx.putImageData(img, 0, 0);
  return { at, canvas: c };
}

/**
 * The lot as a canvas: (px, py) = (x, z) × pixels per metre, top row = the back of the lot.
 * plan: layout_engine.GardenPlan.to_dict() ({ lawn, entry, paths, outline }) or null (all lawn).
 * outline: the yard's shape when the plan has none (a survey's). paved: hard ground the customer marked
 * (driveway, patio, path, tank, meter: data/yardScene.pavedAreas), painted over everything.
 * photo: their own ground from the yard photo (data/photoGround.js, a W × L canvas with alpha) instead of
 * the design's beds and lawn: plain ground where the photo can't be trusted, the photo over it, and the
 * design's lawn edge and paths dashed on top (where the beds will be cut).
 */
// beds: data/plantBeds.plantBeds(...) — a hand-made design's beds round its plants, mulched on the lawn
export function paintGround(plan, w, l, { maxSide = 2048, outline: shape = null, paved = [], photo = null, beds = null } = {}) {
  const ppm = Math.min(MAX_PPM, maxSide / Math.max(w, l));
  const c = makeCanvas(Math.max(2, Math.round(w * ppm)), Math.max(2, Math.round(l * ppm)));
  const ctx = c.getContext('2d');
  ctx.setTransform(c.width / w, 0, 0, c.height / l, 0, 0);
  const r = seeded(Math.round(w * 1000 + l * 7));
  const outline = Array.isArray(plan?.outline) && plan.outline.length >= 3 ? plan.outline
    : Array.isArray(shape) && shape.length >= 3 ? shape : null;
  if (photo) {
    paintPhoto(ctx, photo, plan, w, l);
    return c;
  }
  paintBeds(ctx, r, plan, outline, w, l, ppm);
  if (!plan?.lawn && beds) {
    // Mulch where the plants are: the mulch pattern kept only inside the beds, a soft shadow at their edge
    const layer = makeCanvas(c.width, c.height), lc = layer.getContext('2d');
    lc.setTransform(c.width / w, 0, 0, c.height / l, 0, 0);
    lc.fillStyle = patternOf(lc, 'mulch');
    lc.fillRect(0, 0, w, l);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(beds.canvas, 0, 0, c.width, c.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.max(2, ppm * 0.05);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  paintPaved(ctx, paved);
  return c;
}

function paintPhoto(ctx, photo, plan, w, l) {
  ctx.fillStyle = patternOf(ctx, 'grass');
  ctx.fillRect(0, 0, w, l);
  ctx.fillStyle = 'rgba(178,182,164,0.62)';   // the plain surround's tone: "not in your photo"
  ctx.fillRect(0, 0, w, l);
  ctx.drawImage(photo, 0, 0, w, l);
  if (!plan?.lawn) return;
  ctx.save();
  ctx.setLineDash([0.28, 0.18]);
  ctx.lineWidth = 0.07;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  lawnPaths(plan).forEach((s) => { s(ctx); ctx.stroke(); });
  ctx.strokeStyle = 'rgba(253,230,138,0.95)';   // new paths from the gates, in amber
  (plan.paths || []).forEach((p) => { ctx.beginPath(); ctx.rect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0); ctx.stroke(); });
  ctx.restore();
}

// Hard ground they already have: slabs with joints and a darker edge; a tank or meter gets its lid
function paintPaved(ctx, paved) {
  paved.forEach((p) => {
    const w = p.x1 - p.x0, d = p.z1 - p.z0;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = patternOf(ctx, 'paving');
    ctx.fillRect(p.x0, p.z0, w, d);
    ctx.restore();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = 'rgba(95,88,76,0.7)';
    ctx.strokeRect(p.x0, p.z0, w, d);
    if (/septic|tank|meter/i.test(p.label)) {
      const s = Math.min(w, d) * 0.45;
      ctx.fillStyle = '#7d776c';
      ctx.fillRect(p.x0 + w / 2 - s / 2, p.z0 + d / 2 - s / 2, s, s);
      ctx.strokeStyle = 'rgba(40,36,30,0.6)';
      ctx.lineWidth = 0.03;
      ctx.strokeRect(p.x0 + w / 2 - s / 2, p.z0 + d / 2 - s / 2, s, s);
    }
  });
}

function paintBeds(ctx, r, plan, outline, w, l, ppm) {

  if (outline) {   // beyond the yard's own shape (house, driveway, neighbour): paving
    ctx.fillStyle = patternOf(ctx, 'paving');
    ctx.fillRect(0, 0, w, l);
  }
  if (!plan?.lawn) {
    yardPath(ctx, outline, w, l);
    turf(ctx, r, 0, 0, w, l);
    return;
  }

  // Beds: mulch over the whole yard, with darker and lighter drifts so it isn't a flat tile
  yardPath(ctx, outline, w, l);
  ctx.fillStyle = patternOf(ctx, 'mulch');
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0, n = Math.max(4, Math.round((w * l) / 8)); i < n; i++) {
    const cx = r() * w, cz = r() * l, rad = 0.6 + r() * 1.6;
    const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, rad);
    g.addColorStop(0, r() < 0.4 ? 'rgba(110,90,62,0.12)' : 'rgba(8,5,2,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cz - rad, rad * 2, rad * 2);
  }
  ctx.restore();

  // Gravel paths from the customer's gates (stepping stones go on top in 3D)
  (plan.paths || []).forEach((p) => {
    ctx.beginPath();
    ctx.rect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
    ctx.fillStyle = patternOf(ctx, 'gravel');
    ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = 'rgba(70,60,48,0.55)';
    ctx.stroke();
  });

  // Lawn: its own rounded, hand-cut shape (lawnShape). Where it meets a bed there's no concrete ring but a
  // spade-cut edge: a narrow dark groove of soil, and the grass a touch darker at its rim
  const shape = lawnShape(plan, w, l);
  if (!shape) return;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const layer = () => makeCanvas(cw, ch);
  // The groove: the lawn's shape grown by ~4 cm, in dark soil
  const grow = Math.max(2, Math.round(0.04 * ppm));
  const groove = layer(), gc = groove.getContext('2d');
  gc.fillStyle = 'rgba(30,20,12,0.8)';
  gc.fillRect(0, 0, cw, ch);
  gc.globalCompositeOperation = 'destination-in';
  const spread = layer(), sc = spread.getContext('2d');
  for (const [dx, dy] of [[grow, 0], [-grow, 0], [0, grow], [0, -grow], [grow * 0.7, grow * 0.7], [-grow * 0.7, -grow * 0.7], [grow * 0.7, -grow * 0.7], [-grow * 0.7, grow * 0.7]]) {
    sc.drawImage(shape.canvas, dx, dy, cw, ch);
  }
  gc.drawImage(spread, 0, 0);
  // The turf inside the shape
  const grass = layer(), tc = grass.getContext('2d');
  tc.setTransform(cw / w, 0, 0, ch / l, 0, 0);
  tc.beginPath();
  tc.rect(0, 0, w, l);
  turf(tc, r, 0, 0, w, l);
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(shape.canvas, 0, 0, cw, ch);
  // Its rim: a ~6 cm band just inside the edge, a little darker (the denser grass by a cut edge, in its shade)
  const shrink = Math.max(2, Math.round(0.06 * ppm));
  const inner = layer(), ic = inner.getContext('2d');
  ic.drawImage(shape.canvas, 0, 0, cw, ch);
  ic.globalCompositeOperation = 'destination-in';
  for (const [dx, dy] of [[shrink, 0], [-shrink, 0], [0, shrink], [0, -shrink]]) ic.drawImage(shape.canvas, dx, dy, cw, ch);
  const band = layer(), bc = band.getContext('2d');
  bc.fillStyle = 'rgba(14,38,8,0.26)';
  bc.fillRect(0, 0, cw, ch);
  bc.globalCompositeOperation = 'destination-in';
  bc.drawImage(shape.canvas, 0, 0, cw, ch);
  bc.globalCompositeOperation = 'destination-out';
  bc.drawImage(inner, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(groove, 0, 0);
  ctx.drawImage(grass, 0, 0);
  ctx.drawImage(band, 0, 0);
  ctx.restore();
}

/* ── 3D pieces ───────────────────────────────────────────────────────────── */
function flatUV(geo, w, l) {   // a lot-sized plane's UVs from its own positions: u = x / W, v = 1 − z / L
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w, 1 - pos.getZ(i) / l);
  uv.needsUpdate = true;
}

let grassNormal = null;   // the Studio's grass detail map (shared; loads once, fills in when ready)
function grassNormalMap() {
  if (!grassNormal) {
    grassNormal = new THREE.TextureLoader().load('/textures/grass_normal.jpg');
    grassNormal.colorSpace = THREE.NoColorSpace;
    grassNormal.wrapS = grassNormal.wrapT = THREE.RepeatWrapping;
  }
  return grassNormal;
}

function stoneGeometry() {   // a 55 × 38 cm stepping stone with rounded corners, 4 cm thick
  const w = 0.55, d = 0.38, rr = 0.08;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rr, -d / 2);
  s.lineTo(w / 2 - rr, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr);
  s.lineTo(w / 2, d / 2 - rr); s.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
  s.lineTo(-w / 2 + rr, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr);
  s.lineTo(-w / 2, -d / 2 + rr); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);   // lying flat, top at y ≈ 0.04
  return geo;
}

/**
 * The lot: painted surface + kerbs (or the shaped yard's sides and house plinth) + stepping stones.
 * plan may be null. lite: phones (smaller painting, no grass detail map). exporting: for the .glb
 * (no detail map: it would need texture transforms; 1024 px painting). outline / paved: from the survey
 * (see paintGround). walled: the survey's walls and house stand on the edges, so no kerbs.
 * → { group, dispose }
 */
export function buildGround(plan, w, l, { lite = false, exporting = false, anisotropy = 1, outline: shape = null, paved = [], walled = false, photo = null, beds = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Ground';
  const geos = [], mats = [], texs = [];
  const keep = (geo, mat) => { geos.push(geo); mats.push(mat); };

  // The painted lot
  const painted = new THREE.CanvasTexture(paintGround(plan, w, l, { maxSide: exporting || lite ? 1024 : 2048, outline: shape, paved, photo, beds }));
  painted.colorSpace = THREE.SRGBColorSpace;
  painted.anisotropy = anisotropy;
  texs.push(painted);
  const lotGeo = new THREE.PlaneGeometry(w, l);
  lotGeo.rotateX(-Math.PI / 2);
  lotGeo.translate(w / 2, 0, l / 2);
  flatUV(lotGeo, w, l);
  const lotMat = new THREE.MeshStandardMaterial({ map: painted, roughness: 0.95, metalness: 0 });
  if (!lite && !exporting) {
    const n = grassNormalMap().clone();   // its own repeat for this lot size; shares the picture (and its loading)
    n.repeat.set(Math.max(2, w / 3), Math.max(2, l / 3));
    texs.push(n);
    lotMat.normalMap = n;
    lotMat.normalScale = new THREE.Vector2(0.55, 0.55);
  }
  const lot = new THREE.Mesh(lotGeo, lotMat);
  lot.name = `Lot ${w} x ${l} m`;
  lot.position.y = LOT_Y;
  lot.receiveShadow = true;
  group.add(lot);
  keep(lotGeo, lotMat);

  // Kerbs round the lot, or along the yard's own sides (house walls: a low slate plinth)
  const kerbMat = new THREE.MeshStandardMaterial({ color: KERB.color, roughness: 0.9, metalness: 0 });
  const houseMat = new THREE.MeshStandardMaterial({ color: HOUSE_PLINTH.color, roughness: 0.85, metalness: 0 });
  mats.push(kerbMat, houseMat);
  const outline = Array.isArray(plan?.outline) && plan.outline.length >= 3 ? plan.outline
    : Array.isArray(shape) && shape.length >= 3 ? shape : null;
  // A yard rebuilt from the survey has its own walls and house (data/yardScene.js) where the kerbs would be
  const sides = walled ? [] : outline
    ? outline.map((a, i) => ({ a, b: outline[(i + 1) % outline.length], house: !!a.house }))
    : [[0, 0, w, 0], [w, 0, w, l], [w, l, 0, l], [0, l, 0, 0]].map(([ax, az, bx, bz]) => ({ a: { x: ax, z: az }, b: { x: bx, z: bz }, house: false }));
  sides.forEach(({ a, b, house }) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) return;
    const h = house ? HOUSE_PLINTH.height : KERB.height, d = house ? HOUSE_PLINTH.depth : KERB.width;
    const geo = new THREE.BoxGeometry(len + KERB.width, h, d);
    const m = new THREE.Mesh(geo, house ? houseMat : kerbMat);
    m.position.set((a.x + b.x) / 2, house ? h / 2 : h / 2 - 0.04, (a.z + b.z) / 2);   // kerbs sit 4 cm in the ground
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = house ? 'House wall' : 'Kerb';
    group.add(m);
    geos.push(geo);
  });

  // Stepping stones along each path, ~65 cm apart, a little irregular like hand-laid stones
  const spots = [];
  const r = seeded(Math.round(w * 31 + l * 17));
  (plan?.lawn ? plan.paths || [] : []).forEach((p) => {
    const along = p.x1 - p.x0 >= p.z1 - p.z0 ? 'x' : 'z';
    const len = along === 'x' ? p.x1 - p.x0 : p.z1 - p.z0;
    const n = Math.max(1, Math.floor((len - 0.1) / 0.65));
    const gap = len / n;
    for (let i = 0; i < n; i++) {
      const t = (along === 'x' ? p.x0 : p.z0) + gap * (i + 0.5);
      const mid = along === 'x' ? (p.z0 + p.z1) / 2 : (p.x0 + p.x1) / 2;
      const jitter = (r() - 0.5) * 0.08;
      spots.push({
        x: along === 'x' ? t : mid + jitter,
        z: along === 'x' ? mid + jitter : t,
        turn: (along === 'x' ? Math.PI / 2 : 0) + (r() - 0.5) * 0.25,
        shade: r(),
      });
    }
  });
  if (spots.length) {
    const geo = stoneGeometry();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0 });
    keep(geo, mat);
    const stones = new THREE.InstancedMesh(geo, mat, spots.length);
    stones.name = 'Stepping stones';
    const o = new THREE.Object3D(), col = new THREE.Color();
    spots.forEach((s, i) => {
      o.position.set(s.x, LOT_Y, s.z);
      o.rotation.set(0, s.turn, 0);
      o.updateMatrix();
      stones.setMatrixAt(i, o.matrix);
      stones.setColorAt(i, col.set('#a9a398').offsetHSL(0, 0, (s.shade - 0.5) * 0.08));
    });
    stones.castShadow = true;
    stones.receiveShadow = true;
    group.add(stones);
  }

  return {
    group,
    dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose()); },
  };
}

/* ── Around the lot: plain ground out to a hazy horizon, under a sky dome ── */
export const SKY_DAY = { top: '#8fbbe0', horizon: '#e4ecee' };

let surroundTex = null;
function surroundTexture() {   // the grass, greyed and calmer: plain ground that isn't part of the design
  if (!surroundTex) {
    const c = makeCanvas(TILES.grass.px, TILES.grass.px);
    const ctx = c.getContext('2d');
    ctx.drawImage(tileOf('grass'), 0, 0);
    ctx.fillStyle = 'rgba(176,174,150,0.64)';
    ctx.fillRect(0, 0, c.width, c.height);
    surroundTex = new THREE.CanvasTexture(c);
    surroundTex.colorSpace = THREE.SRGBColorSpace;
    surroundTex.wrapS = surroundTex.wrapT = THREE.RepeatWrapping;
  }
  return surroundTex;
}

// The surround runs out to the horizon under a distance haze (scene fog of the horizon colour), so
// it meets the sky in a straight line however the view is turned. → { group, fog, setSky, dispose }
export function buildBackdrop(w, l) {
  const group = new THREE.Group();
  const size = 1400;
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const map = surroundTexture().clone();
  map.repeat.set(size / TILES.grass.metres, size / TILES.grass.metres);
  map.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map, color: '#e6e4d6', roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(w / 2, -0.01, l / 2);
  ground.receiveShadow = true;
  group.add(ground);
  const d = Math.hypot(w, l);
  const fog = new THREE.Fog(SKY_DAY.horizon, d * 1.2 + 10, d * 4.5 + 70);

  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(SKY_DAY.top) }, horizon: { value: new THREE.Color(SKY_DAY.horizon) } },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 top;', 'uniform vec3 horizon;', 'varying float vY;',
      'void main() {',
      '  gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.55, vY)), 1.0);',
      '  #include <tonemapping_fragment>',   // the same tone mapping as the haze on the ground meets it
      '  #include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(w / 2, 0, l / 2);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  group.add(sky);

  return {
    group,
    fog,
    setSky: (top, horizon) => { skyMat.uniforms.top.value.copy(top); skyMat.uniforms.horizon.value.copy(horizon); fog.color.copy(horizon); },
    dispose: () => { geo.dispose(); mat.dispose(); map.dispose(); skyGeo.dispose(); skyMat.dispose(); },
  };
}

/* ── Dimension lines along the front (house side) and the right side ─────── */
export function buildDimensions(w, l, { y = 0.02 } = {}) {   // y: lifted to the wall tops when the yard has walls
  const group = new THREE.Group();
  group.name = 'Measurements';
  const mat = new THREE.MeshBasicMaterial({ color: '#1e293b', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const geos = [];
  const bar = (x0, z0, x1, z1, width) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.renderOrder = 2;
    group.add(m);
    geos.push(geo);
  };
  const o = DIM_OFFSET, tick = 0.14, t = 0.022;
  bar(0, l + o, w, l + o, t);
  bar(0, l + o - tick, 0, l + o + tick, t);
  bar(w, l + o - tick, w, l + o + tick, t);
  bar(w + o, 0, w + o, l, t);
  bar(w + o - tick, 0, w + o + tick, 0, t);
  bar(w + o - tick, l, w + o + tick, l, t);
  return {
    group,
    anchors: { front: new THREE.Vector3(w / 2, y, l + o), side: new THREE.Vector3(w + o, y, l / 2) },
    dispose: () => { geos.forEach((g) => g.dispose()); mat.dispose(); },
  };
}

/* ── A 1 m grid over the lot (5 m lines and the lot's edge stronger): square cells on any lot ── */
export function buildMetreGrid(w, l, { y = 0.03, color = '#ffffff', minor = 0.28, major = 0.6 } = {}) {
  const group = new THREE.Group();
  const lines = { minor: [], major: [] };
  const add = (k, x0, z0, x1, z1) => lines[k].push(x0, y, z0, x1, y, z1);
  for (let x = 0; x <= w + 1e-6; x += 1) add(x % 5 === 0 ? 'major' : 'minor', x, 0, x, l);
  if (w % 1) add('major', w, 0, w, l);
  for (let z = 0; z <= l + 1e-6; z += 1) add(z % 5 === 0 ? 'major' : 'minor', 0, z, w, z);
  if (l % 1) add('major', 0, l, w, l);
  const parts = [];
  for (const [k, opacity] of [['minor', minor], ['major', major]]) {
    if (!lines[k].length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lines[k], 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
    const seg = new THREE.LineSegments(geo, mat);
    seg.renderOrder = 3;
    group.add(seg);
    parts.push(geo, mat);
  }
  return { group, dispose: () => parts.forEach((p) => p.dispose()) };
}

/** "10 m", "7.5 m": the way the lot sizes are written everywhere else */
export const metres = (v) => `${Number((Number(v) || 0).toFixed(2))} m`;
