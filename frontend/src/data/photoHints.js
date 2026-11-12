// Hints from the photo's colours (Mark your yard, after the photo is lined up): where the ground looks like paving —
// concrete, tiles, gravel — so the customer can mark it "Keep clear" with one tap. Runs in the browser only: the
// photo isn't sent anywhere for this. They are suggestions; nothing is marked until the customer accepts one.
//
// How: every CELL metres of the lot is projected into the photo (photoPose.projectGroundPoint) and a small patch
// of pixels around it averaged. Neutral grey, smooth and light = paving (concrete and tiles are grey and even;
// pale sandy soil is warm-tinted and grainy, so it isn't); green = plants or grass; the rest = soil, mulch, shade.
// Only light grey counts: soil in shade turns the same neutral blue-grey as concrete, so shaded paving is left
// for the customer to mark. A "paving" region covering most of the yard is the ground itself: not suggested. Paving cells that touch make a region; regions of at least MIN_AREA m² that
// fill most of their box become suggested boxes. Lot metres as everywhere (data/yardSurvey.js).
import { projectGroundPoint } from './photoPose';

const CELL = 0.5;            // m
const INSET = 0.4;           // m: skip the lot's edges, where walls and fences stand in front of the ground
const MIN_AREA = 1.0;        // m²
const MIN_FILL = 0.5;        // share of a region's box that must be paving
const MAX_SUGGESTIONS = 6;
const SAMPLE_MAX = 900;      // px: the photo is scaled down to this before sampling
const PATCH = 2;             // px each side of the sample point (5 × 5)
const PAVING_MAX_SAT = 0.08; // concrete / tiles are near-neutral; sandy soil measured 0.09–0.15 (warm)
const PAVING_MIN_V = 0.55;   // sunlit; shaded sand measured 0.47–0.53 and neutral
const PAVING_MAX_SD = 14;    // brightness spread in the patch (0–255): paving is even, soil and gravel-on-soil grainy
const MAX_SHARE = 0.6;       // a region bigger than this share of the seen yard is the ground itself

/** HSV (0–360, 0–1, 0–1) of an RGB colour (0–255). */
export function hsv(r, g, b) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r / 255) h = 60 * (((g - b) / 255 / d) % 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else h = 60 * ((r - g) / 255 / d + 4);
  }
  return { h: (h + 360) % 360, s: max > 0 ? d / max : 0, v: max };
}

/** 'paving' | 'green' | 'other' for an average colour and its brightness spread. */
export function classify(r, g, b, sd = 0) {
  const { h, s, v } = hsv(r, g, b);
  if (s < PAVING_MAX_SAT && v > PAVING_MIN_V && sd < PAVING_MAX_SD) return 'paving';
  if (h >= 65 && h <= 170 && s > 0.18 && v > 0.12) return 'green';
  return 'other';
}

/** Draw the photo small enough to sample quickly. → { data, w, h } or null. */
export function loadPixels(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, SAMPLE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      try {
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ data: ctx.getImageData(0, 0, w, h).data, w, h });
      } catch {
        resolve(null);   // a photo from another site can't be read
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function average(px, u, v) {
  const cx = Math.round(u * (px.w - 1)), cy = Math.round(v * (px.h - 1));
  let r = 0, g = 0, b = 0, n = 0, l = 0, l2 = 0;
  for (let y = cy - PATCH; y <= cy + PATCH; y++) {
    if (y < 0 || y >= px.h) continue;
    for (let x = cx - PATCH; x <= cx + PATCH; x++) {
      if (x < 0 || x >= px.w) continue;
      const i = (y * px.w + x) * 4, lum = (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3;
      r += px.data[i]; g += px.data[i + 1]; b += px.data[i + 2]; l += lum; l2 += lum * lum; n += 1;
    }
  }
  return n ? [r / n, g / n, b / n, Math.sqrt(Math.max(0, l2 / n - (l / n) ** 2))] : null;
}

const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

/**
 * Suggested keep-clear boxes where the photo shows paving: [{ x0, z0, x1, z1, label, area }], biggest first.
 * pose: the lined-up photo (solvePhotoPose); photoW/H: its natural size; existing: survey items (areas already
 * marked aren't suggested again). Also { green, seen }: shares of the visible yard that look green / were seen.
 */
export function findPaving(px, pose, W, L, photoW, photoH, existing = []) {
  const nx = Math.max(1, Math.round(W / CELL)), nz = Math.max(1, Math.round(L / CELL));
  const cw = W / nx, cl = L / nz;
  const kind = new Array(nx * nz).fill(null);
  let seen = 0, green = 0;
  for (let gz = 0; gz < nz; gz++) {
    for (let gx = 0; gx < nx; gx++) {
      const x = (gx + 0.5) * cw, z = (gz + 0.5) * cl;
      if (x < INSET || z < INSET || x > W - INSET || z > L - INSET) continue;
      const q = projectGroundPoint(pose, x, z, photoW, photoH);
      if (!(q.depth > 0.05) || !(q.u >= 0 && q.u <= 1 && q.v >= 0 && q.v <= 1)) continue;
      const c = average(px, q.u, q.v);
      if (!c) continue;
      const k = classify(...c);
      kind[gz * nx + gx] = k;
      seen += 1;
      if (k === 'green') green += 1;
    }
  }

  const done = new Uint8Array(nx * nz), regions = [];
  for (let start = 0; start < kind.length; start++) {
    if (kind[start] !== 'paving' || done[start]) continue;
    const stack = [start];
    done[start] = 1;
    let n = 0, gx0 = Infinity, gx1 = -Infinity, gz0 = Infinity, gz1 = -Infinity;
    while (stack.length) {
      const i = stack.pop(), gx = i % nx, gz = (i - gx) / nx;
      n += 1;
      gx0 = Math.min(gx0, gx); gx1 = Math.max(gx1, gx); gz0 = Math.min(gz0, gz); gz1 = Math.max(gz1, gz);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = gx + dx, az = gz + dz, j = az * nx + ax;
        if (ax >= 0 && ax < nx && az >= 0 && az < nz && !done[j] && kind[j] === 'paving') { done[j] = 1; stack.push(j); }
      }
    }
    const box = { x0: gx0 * cw, x1: (gx1 + 1) * cw, z0: gz0 * cl, z1: (gz1 + 1) * cl };
    const area = (box.x1 - box.x0) * (box.z1 - box.z0);
    if (n * cw * cl < MIN_AREA || (n * cw * cl) / area < MIN_FILL || n > MAX_SHARE * seen) continue;
    const marked = existing.some(it => (it.kind === 'clear' || it.kind === 'view') && overlap(box, it) > 0.5 * area);
    if (marked) continue;
    const w = box.x1 - box.x0, d = box.z1 - box.z0;
    const label = Math.min(w, d) <= 1.6 && Math.max(w, d) >= 3 * Math.min(w, d) ? 'Path' : 'Patio';
    const r3 = (v) => Math.round(v * 100) / 100;
    regions.push({ x0: r3(box.x0), z0: r3(box.z0), x1: r3(box.x1), z1: r3(box.z1), label, area: r3(area) });
  }
  regions.sort((a, b) => b.area - a.area);
  return { suggestions: regions.slice(0, MAX_SUGGESTIONS), green: seen ? green / seen : 0, seen: seen / (nx * nz) };
}
