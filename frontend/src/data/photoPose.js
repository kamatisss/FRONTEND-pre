/*
 * Where the camera stood when the customer took the photo of their yard (photo overlay).
 *
 * The customer drags four pins onto the yard's corners in the photo. Those four points are the
 * corners of a rectangle on the ground whose size we know (the lot, in metres), so they fix a
 * homography from the ground to the photo. From it we recover the camera: the focal length from
 * the rectangle's right angle, then its position and direction (the standard planar pose method).
 * The 3D design drawn with that camera lands on the real ground, at the real size.
 *
 * Coordinates: the lot is x 0..width (left → right as seen in the photo), z 0..length with z = 0 the
 * BACK of the yard (far side) and z = length the front, y up — the same as the 3D canvas.
 * Pins are fractions of the photo: u 0..1 left → right, v 0..1 top → bottom.
 * Pure maths, no three.js, so it can be tested on its own.
 */

// Pin order: back left, back right, front right, front left (clockwise on the photo)
export const CORNER_LABELS = ['Back left', 'Back right', 'Front right', 'Front left'];

// A first guess for a photo taken standing at the front of the yard: the far side higher and narrower
export const defaultCorners = () => [
  { u: 0.24, v: 0.42 }, { u: 0.76, v: 0.42 }, { u: 0.97, v: 0.9 }, { u: 0.03, v: 0.9 },
];

export const validCorners = (c) =>
  Array.isArray(c) && c.length === 4 && c.every(p => p && Number.isFinite(p.u) && Number.isFinite(p.v));

// Solve the 8×8 system for a homography with h33 = 1 (Gaussian elimination, partial pivoting)
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Homography H (3×3, row-major) with [x, y, 1] ~ H [X, Z, 1] for four point pairs. */
export function homography(ground, image) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [X, Z] = ground[i], [x, y] = image[i];
    A.push([X, Z, 1, 0, 0, 0, -X * x, -Z * x]); b.push(x);
    A.push([0, 0, 0, X, Z, 1, -X * y, -Z * y]); b.push(y);
  }
  const h = solve(A, b);
  return h && [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The four pins must outline a proper four-sided shape (no crossing, no fold)
function isConvex(pts) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = [pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) return false;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}

// The camera for one assumed focal length (px): [r1 r2 t] = λ K⁻¹ H, made orthonormal
function poseForFocal(H, focal, ih) {
  const k1 = [H[0][0] / focal, H[1][0] / focal, H[2][0]];
  const k2 = [H[0][1] / focal, H[1][1] / focal, H[2][1]];
  const k3 = [H[0][2] / focal, H[1][2] / focal, 1];
  let lambda = 2 / (len(k1) + len(k2));
  if (k3[2] * lambda < 0) lambda = -lambda;      // the yard is in front of the camera
  let rx = scale(k1, lambda), rz = scale(k2, lambda);
  const t = scale(k3, lambda);
  rx = scale(rx, 1 / len(rx));
  rz = sub(rz, scale(rx, dot(rz, rx)));
  rz = scale(rz, 1 / len(rz));
  const ry = cross(rz, rx);                      // world up, in camera axes (x right, y down, z forward)
  // Camera centre C = −Rᵀt (R's columns: rx, ry, rz); camera axes in the world are R's rows
  const position = [-dot(rx, t), -dot(ry, t), -dot(rz, t)];
  const row = (i) => [rx[i], ry[i], rz[i]];
  const right = row(0), down = row(1), forward = row(2);
  return {
    position, focal,
    axes: { right, up: scale(down, -1), back: scale(forward, -1) },
    fovY: (2 * Math.atan(ih / 2 / focal) * 180) / Math.PI,
  };
}

/**
 * The camera for this photo.
 *   corners: four pins {u, v} (CORNER_LABELS order); lot size in metres; photo size in pixels.
 * Returns { ok: true, position: [x, y, z], axes: { right, up, back } (unit vectors, three.js camera
 * basis), fovY (degrees), focal (px), estimatedFocal, fitError } or { ok: false, reason }.
 * fitError: how far (fraction of the photo's long side) the lot's corners land from the pins. Large
 * means the pins don't outline a W × L rectangle (wrong yard size, or a pin on the wrong corner).
 */
export function solvePhotoCamera(corners, lotWidth, lotLength, photoWidth, photoHeight) {
  const W = Number(lotWidth), L = Number(lotLength), iw = Number(photoWidth), ih = Number(photoHeight);
  if (!validCorners(corners) || !(W > 0 && L > 0 && iw > 0 && ih > 0)) return { ok: false, reason: 'missing' };
  const image = corners.map(p => [p.u * iw - iw / 2, p.v * ih - ih / 2]);   // pixels from the photo centre, y down
  if (!isConvex(image)) return { ok: false, reason: 'shape' };
  return solveFromGround(corners, [[0, 0], [W, 0], [W, L], [0, L]], iw, ih);
}

/** Least-squares homography for 4 or more point pairs (normalised so pixels and metres weigh alike). */
export function homographyLS(ground, image) {
  if (ground.length === 4) return homography(ground, image);
  const gs = Math.max(1, ...ground.flat().map(Math.abs)), is = Math.max(1, ...image.flat().map(Math.abs));
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0)), Atb = new Array(8).fill(0);
  const addRow = (row, b) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += row[i] * b;
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
    }
  };
  ground.forEach(([X0, Z0], k) => {
    const X = X0 / gs, Z = Z0 / gs, x = image[k][0] / is, y = image[k][1] / is;
    addRow([X, Z, 1, 0, 0, 0, -X * x, -Z * x], x);
    addRow([0, 0, 0, X, Z, 1, -X * y, -Z * y], y);
  });
  const h = solve(AtA, Atb);
  if (!h) return null;
  // Undo the scaling: H = diag(is, is, 1) · Hn · diag(1/gs, 1/gs, 1)
  const Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  const H = Hn.map((row, r) => row.map((v, c) => v * (r < 2 ? is : 1) * (c < 2 ? 1 / gs : 1)));
  return H.map(row => row.map(v => v / H[2][2]));
}

/**
 * The camera from pins on any known ground points (lot metres): the yard's corners when it isn't a rectangle,
 * a post the customer measured… pins [{u, v}], ground [[x, z]] (same order, 4 or more, not all in a line).
 * The rotation's right angle and equal scale fix the lens just as for a rectangle, so any metric points do.
 * focalHint (px, from the photo's EXIF) is tried too. With 5 or more pins the fit is least squares, and
 * checkError (m) says how far the worst pin's spot lands from where it should be.
 */
export function solveFromGround(pins, ground, iw, ih, focalHint = null) {
  const image = pins.map(p => [p.u * iw - iw / 2, p.v * ih - ih / 2]);
  const H = homographyLS(ground, image);
  if (!H || H.flat().some(v => !Number.isFinite(v))) return { ok: false, reason: 'shape' };
  const corners = pins;
  const longSide = Math.max(iw, ih);
  const minF = 0.4 * longSide, maxF = 3 * longSide;

  const fitError = (pose) => {
    let worst = 0;
    for (let i = 0; i < ground.length; i++) {
      const q = projectGroundPoint(pose, ground[i][0], ground[i][1], iw, ih);
      if (!(q.depth > 0)) return Infinity;
      worst = Math.max(worst, Math.hypot((q.u - corners[i].u) * iw, (q.v - corners[i].v) * ih));
    }
    return worst / longSide;
  };
  const tryFocal = (f) => {
    if (!(f >= minF && f <= maxF)) return null;
    const pose = poseForFocal(H, f, ih);
    return { pose, err: fitError(pose) };
  };

  // 1. The rectangle's right angle: (K⁻¹h1)·(K⁻¹h2) = 0 — exact when the photo has a sideways vanishing point
  // 2. Its known proportions: |K⁻¹h1| = |K⁻¹h2| — still works for a photo taken square-on to the yard
  // 3. Otherwise the lens that makes the lot land closest to the pins
  const [h11, h12, h21, h22, h31, h32] = [H[0][0], H[0][1], H[1][0], H[1][1], H[2][0], H[2][1]];
  const analytic = [];
  if (Math.abs(h31 * h32) > 1e-12) analytic.push(-(h11 * h12 + h21 * h22) / (h31 * h32));
  if (Math.abs(h31 * h31 - h32 * h32) > 1e-12) analytic.push((h12 * h12 + h22 * h22 - h11 * h11 - h21 * h21) / (h31 * h31 - h32 * h32));
  let best = null;
  for (const f2 of analytic) {
    const c = f2 > 0 ? tryFocal(Math.sqrt(f2)) : null;
    if (c && (!best || c.err < best.err)) best = { ...c, estimated: false };
  }
  if (focalHint > 0) {
    const c = tryFocal(focalHint);
    if (c && (!best || c.err < best.err + 0.001)) best = { ...c, estimated: false };   // the photo's own lens wins a tie
  }
  if (!best || best.err > 0.002) {
    for (let i = 0; i <= 48; i++) {                     // log-spaced search, then refine around the best
      const c = tryFocal(minF * Math.pow(maxF / minF, i / 48));
      if (c && (!best || c.err < best.err)) best = { ...c, estimated: true };
    }
    if (best) {
      let lo = best.pose.focal / 1.08, hi = best.pose.focal * 1.08;
      for (let i = 0; i < 30; i++) {
        const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618;
        const ea = tryFocal(a)?.err ?? Infinity, eb = tryFocal(b)?.err ?? Infinity;
        if (ea < eb) hi = b; else lo = a;
      }
      const c = tryFocal((lo + hi) / 2);
      if (c && c.err < best.err) best = { ...c, estimated: true };
    }
  }
  if (!best || !Number.isFinite(best.err)) return { ok: false, reason: 'shape' };
  const { pose } = best;
  if (pose.position[1] <= 0.05) return { ok: false, reason: 'upside_down' };   // pins mirrored / back and front swapped
  if (pose.position[1] > 80) return { ok: false, reason: 'shape' };
  let checkError = null;
  if (ground.length > 4) {
    checkError = 0;
    pins.forEach((p, i) => {
      const g = imageToGround(pose, p.u, p.v, iw, ih);
      checkError = Math.max(checkError, g ? Math.hypot(g.x - ground[i][0], g.z - ground[i][1]) : Infinity);
    });
  }
  return { ok: true, ...pose, estimatedFocal: best.estimated, fitError: best.err, checkError };
}

/* ── Side-edge pins: the usual photo, where the front corners are out of the frame ───────────────
 *
 * Standing at the house, the yard's front corners are beside or behind you, so they're not in the
 * photo (clamping them to the photo edge gave a camera tens of metres up). The pins are instead:
 * the two BACK corners, and one point anywhere along each SIDE edge (fence line), nearer you.
 *
 * The side edges are parallel on the ground, so on the photo they meet at a vanishing point: the
 * direction of the yard's depth. The back edge is square to them: the remaining tilt. The two back
 * corners W metres apart: position and scale. That fixes the camera for a known lens, so the lens
 * comes from the photo (EXIF 35 mm-equivalent focal length) or a typical phone (26 mm). A wrong lens
 * can't move the yard's outline off the pins; it only changes how depth is foreshortened.
 */
export const EDGE_LABELS = ['Back left', 'Back right', 'Right side', 'Left side'];
export const DEFAULT_FOCAL_35 = 26;   // mm, 35 mm-equivalent: most phones' main camera (24–28)

// A first guess: back corners across the middle, side edges heading out of the bottom corners
export const defaultEdgePins = () => [
  { u: 0.27, v: 0.45 }, { u: 0.73, v: 0.45 }, { u: 0.93, v: 0.88 }, { u: 0.07, v: 0.88 },
];

/** 35 mm-equivalent focal length (mm) → focal length in pixels for this photo (by the diagonal). */
export const focalPixels = (focal35, photoWidth, photoHeight) =>
  ((Number(focal35) > 0 ? Number(focal35) : DEFAULT_FOCAL_35) / 43.27) * Math.hypot(photoWidth, photoHeight);

const unit = (a) => scale(a, 1 / len(a));

/** The camera from back-corner + side-edge pins (EDGE_LABELS order), for a focal length in pixels. */
export function solveFromEdges(pins, lotWidth, photoWidth, photoHeight, focal) {
  const W = Number(lotWidth), iw = Number(photoWidth), ih = Number(photoHeight), f = Number(focal);
  if (!validCorners(pins) || !(W > 0 && iw > 0 && ih > 0 && f > 0)) return { ok: false, reason: 'missing' };
  if (!isConvex(pins.map(p => [p.u * iw, p.v * ih]))) return { ok: false, reason: 'shape' };
  // Rays through the pins in camera coordinates (x right, y down, z forward)
  const [bl, br, rs, ls] = pins.map(p => [(p.u * iw - iw / 2) / f, (p.v * ih - ih / 2) / f, 1]);
  const depthDir = cross(cross(bl, ls), cross(br, rs));      // where the two side edges meet
  const backLine = cross(bl, br);
  if (len(depthDir) < 1e-12 || len(backLine) < 1e-12) return { ok: false, reason: 'shape' };
  let rz = unit(depthDir);
  let rx = cross(backLine, rz);                                // on the back edge, square to the depth
  if (len(rx) < 1e-12) return { ok: false, reason: 'shape' };
  rx = unit(rx);
  // Distances along the two back-corner rays: W·rx = λr·br − λl·bl (least squares, 3 equations, 2 unknowns)
  const solve2 = (target) => {
    const a = scale(bl, -1), b = br;
    const aa = dot(a, a), ab = dot(a, b), bb = dot(b, b), at = dot(a, target), bt = dot(b, target);
    const det = aa * bb - ab * ab;
    return Math.abs(det) < 1e-15 ? null : [(at * bb - bt * ab) / det, (bt * aa - at * ab) / det];
  };
  let lam = solve2(scale(rx, W));
  if (!lam) return { ok: false, reason: 'shape' };
  if (lam[0] < 0 && lam[1] < 0) { rx = scale(rx, -1); lam = [-lam[0], -lam[1]]; }   // x runs left → right
  if (!(lam[0] > 0 && lam[1] > 0)) return { ok: false, reason: 'shape' };
  const t = scale(bl, lam[0]);                                 // the back-left corner is the origin
  let ry = cross(rz, rx);
  if (ry[1] > 0) { rz = scale(rz, -1); ry = cross(rz, rx); }   // world up points up in the photo
  // The side pins must be in FRONT of the back edge (z > 0), else back and front are swapped
  const along = (pin, x0) => {
    // ground point (x0, 0, z) seen along this pin's ray: t + x0·rx + z·rz = μ·pin → z by least squares
    // Closest approach of o + z·rz and μ·pin: z = ((0 − o) × pin)·(rz × pin) / |rz × pin|²
    const o = add(t, scale(rx, x0));
    const n = cross(rz, pin);
    return -dot(cross(o, pin), n) / dot(n, n);
  };
  if (!(along(ls, 0) > 0 && along(rs, W) > 0)) return { ok: false, reason: 'upside_down' };
  const pose = poseFromAxes(rx, ry, rz, t, f, ih);
  if (pose.position[1] <= 0.05) return { ok: false, reason: 'upside_down' };
  if (pose.position[1] > 80) return { ok: false, reason: 'shape' };
  return { ok: true, ...pose, estimatedFocal: true, fitError: 0 };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function poseFromAxes(rx, ry, rz, t, focal, ih) {
  const position = [-dot(rx, t), -dot(ry, t), -dot(rz, t)];
  const row = (i) => [rx[i], ry[i], rz[i]];
  const right = row(0), down = row(1), forward = row(2);
  return {
    position, focal,
    axes: { right, up: scale(down, -1), back: scale(forward, -1) },
    fovY: (2 * Math.atan(ih / 2 / focal) * 180) / Math.PI,
  };
}

/* ── Pins as saved with a design ────────────────────────────────────────────────────────────────── */

/**
 * Pins in any saved form → { pins, mode, focal35 }, or null. Older designs saved a bare array of the
 * four yard corners; newer ones { pins, mode: 'edges' | 'corners', focal35 }.
 */
const validPointPins = (v) => v && Array.isArray(v.pins) && Array.isArray(v.anchors) && v.pins.length >= 4
  && v.pins.length <= MAX_POINT_PINS && v.anchors.length === v.pins.length
  && v.pins.every(p => p && Number.isFinite(p.u) && Number.isFinite(p.v))
  && v.anchors.every(a => a && Number.isFinite(a.x) && Number.isFinite(a.z));

export function normalizePins(value) {
  const vantage = value && VANTAGES[value.vantage] ? { vantage: value.vantage } : {};
  if (value?.mode === 'points') {
    return validPointPins(value)
      ? { pins: value.pins, mode: 'points', anchors: value.anchors, focal35: Number(value.focal35) > 0 ? Number(value.focal35) : null, ...vantage }
      : null;
  }
  if (value?.mode === 'fences') {
    return validFencePins(value.pins)
      ? { pins: value.pins, mode: 'fences', focal35: Number(value.focal35) > 0 ? Number(value.focal35) : null, ...vantage,
        ...(Number(value.frontWidth) > 0 && { frontWidth: Number(value.frontWidth) }),   // measured width at the house side
        ...(['left', 'right'].includes(value.lean) && { lean: value.lean }) }               // which fence angles (else both)
      : null;
  }
  if (validCorners(value)) return { pins: value, mode: 'corners', focal35: null };
  if (value && validCorners(value.pins)) {
    return { pins: value.pins, mode: value.mode === 'corners' ? 'corners' : 'edges',
      focal35: Number(value.focal35) > 0 ? Number(value.focal35) : null, ...vantage };
  }
  return null;
}

/**
 * Where the photo was taken from, as the customer says (saved with the pins as `vantage`): the camera height
 * we expect (height) and the heights that still look right (range). Many yard photos are taken from an
 * upstairs window or balcony: judged as "standing", they look 3–8 m too high and the size fix would be wrong.
 */
export const VANTAGES = {
  ground: { label: 'Standing in the yard', height: 1.5, range: [0.8, 2.6] },
  upstairs: { label: 'Upstairs window or balcony', height: 4.5, range: [2.6, 6.5] },
  high: { label: 'Two floors up or higher', height: 7.5, range: [5.5, 14] },
};
export const vantageOf = (setup) => VANTAGES[setup?.vantage] || VANTAGES.ground;

export const pinLabels = (mode, setup = null) => (mode === 'points'
  ? (setup?.anchors || []).map((a, i) => a.label || `Pin ${i + 1}`)
  : mode === 'fences' ? FENCE_LABELS : mode === 'corners' ? CORNER_LABELS : EDGE_LABELS);
export const MAX_POINT_PINS = 6;   // 4 fix the camera; up to 2 more check it
export const defaultPins = (mode) => (mode === 'fences' ? defaultFencePins() : mode === 'corners' ? defaultCorners() : defaultEdgePins());

/**
 * The camera for saved pins ({ pins, mode, focal35 }) on a W × L lot and a photo of iw × ih pixels.
 * Adds cameraHeight (m) to the result, to sanity-check the pins and the yard size.
 */
export function solvePhotoPose(setup, lotWidth, lotLength, photoWidth, photoHeight) {
  const s = normalizePins(setup) || { pins: defaultEdgePins(), mode: 'edges', focal35: null };
  const pose = s.mode === 'fences'
    ? solveFromFences(s.pins, lotWidth, photoWidth, photoHeight, focalPixels(s.focal35, photoWidth, photoHeight),
      { front: s.frontWidth ? { width: s.frontWidth, z: Number(lotLength) } : null, split: s.lean || 'both' })
    : s.mode === 'points'
    ? solveFromGround(s.pins, s.anchors.map(a => [a.x, a.z]), photoWidth, photoHeight,
      s.focal35 ? focalPixels(s.focal35, photoWidth, photoHeight) : null)
    : s.mode === 'corners'
      ? solvePhotoCamera(s.pins, lotWidth, lotLength, photoWidth, photoHeight)
      : solveFromEdges(s.pins, lotWidth, photoWidth, photoHeight, focalPixels(s.focal35, photoWidth, photoHeight));
  return pose.ok ? { ...pose, mode: s.mode, cameraHeight: pose.position[1] } : { ...pose, mode: s.mode };
}

/** Where a ground point (x, z) lands on the photo for a solved camera (for checks and tests). */
export function projectGroundPoint(pose, x, z, photoWidth, photoHeight) {
  const rel = sub([x, 0, z], pose.position);
  const camX = dot(rel, pose.axes.right), camY = dot(rel, pose.axes.up), depth = -dot(rel, pose.axes.back);
  const f = pose.focal;
  return { u: (f * camX / depth + photoWidth / 2) / photoWidth, v: (-f * camY / depth + photoHeight / 2) / photoHeight, depth };
}

/**
 * The ground point (x, z) under a spot on the photo (u, v fractions) — the inverse of projectGroundPoint:
 * the camera ray through that pixel, met with the ground (y = 0). null at or above the horizon (sky, roofs).
 * With the pins lined up, a tap on the photo is a real spot in the yard (Mark your yard, YardSurvey.jsx).
 */
export function imageToGround(pose, u, v, photoWidth, photoHeight) {
  const px = u * photoWidth - photoWidth / 2, py = -(v * photoHeight - photoHeight / 2);
  const { right, up, back } = pose.axes;
  const dir = [0, 1, 2].map(i => right[i] * px + up[i] * py - back[i] * pose.focal);
  if (!(dir[1] < -1e-9)) return null;
  const t = -pose.position[1] / dir[1];
  return { x: pose.position[0] + t * dir[0], z: pose.position[2] + t * dir[2] };
}

/**
 * The yard depth (metres) that best fits the pins for this width — for "these pins look like a
 * 10 × 6 m yard" when the size typed in doesn't match. null if nothing fits well.
 */
export function suggestLength(corners, lotWidth, photoWidth, photoHeight) {
  const W = Number(lotWidth);
  if (!(W > 0)) return null;
  let best = null;
  for (let i = 0; i <= 60; i++) {
    const L = W * 0.25 * Math.pow(16, i / 60);   // 0.25 W … 4 W
    const pose = solvePhotoCamera(corners, W, L, photoWidth, photoHeight);
    if (pose.ok && (!best || pose.fitError < best.err)) best = { L, err: pose.fitError };
  }
  return best && best.err < 0.015 ? Math.round(best.L * 2) / 2 : null;
}

/* ── Helping the customer line up (YardSurvey step 1) ──────────────────────────────────────────── */

/**
 * The lot size that puts the camera where the customer says the photo was taken from (vantageOf) — the
 * usual reason a camera "works out 8 m high" is a yard width typed from memory (or the photo was taken
 * upstairs). With back corners + side fences the pins only fix the shape: the scale comes from the width
 * alone, so it scales straight to that height; with all four corners width and length scale together
 * (their ratio is in the pins). Spots the customer measured fix the scale themselves: null.
 * Length (back corners + side fences): the pins don't fix it, but where the photo was taken does — standing
 * in the yard, or at a window of the house on its front side, the yard reaches about that far (standZ, from
 * the back fence), so a shorter length only grows to it.
 * → { width, length, cameraHeight, standX, standZ, changed } (0.5 m steps) or null.
 */
export function fitSizeToCamera(setup, lotWidth, lotLength, photoWidth, photoHeight, { min = 2, max = 50 } = {}) {
  const s = normalizePins(setup);
  if (!s || s.mode === 'points') return null;
  const W = Number(lotWidth), L = Number(lotLength);
  const pose = solvePhotoPose(s, W, L, photoWidth, photoHeight);
  if (!pose.ok || !(pose.cameraHeight > 0)) return null;
  const k = vantageOf(s).height / pose.cameraHeight;
  const half = (v) => Math.round(v * 2) / 2;
  const width = half(W * k);
  let length = s.mode === 'corners' ? half(L * k) : L;
  const stood = pose.position[2] * k;   // edges: distances scale with the width too
  if ((s.mode === 'edges' || s.mode === 'fences') && stood > length + 0.75) length = half(stood);
  if (s.mode === 'fences' && pose.measuredLength) length = half(pose.measuredLength * k);   // the house-side pin measured it
  if (!(width >= min && width <= max && length >= min && length <= max)) return null;
  const check = solvePhotoPose(s, width, length, photoWidth, photoHeight);
  if (!check.ok) return null;
  return { width, length, cameraHeight: check.cameraHeight, standX: check.position[0], standZ: check.position[2], measured: !!pose.measuredLength,
    changed: Math.abs(width - W) >= 0.5 || Math.abs(length - L) >= 0.5 };
}

/**
 * The patch of ground the photo shows, seen from above: the photo's border walked round, each point taken
 * down to the ground (cut at the horizon, and at `far` metres from the camera). → [{ x, z }] (lot metres).
 */
export function photoFootprint(pose, photoWidth, photoHeight, far = 60) {
  const n = 24, border = [];
  for (let k = 0; k <= n; k++) border.push([0, k / n]);            // left edge, top → bottom
  for (let k = 1; k <= n; k++) border.push([k / n, 1]);            // bottom edge, left → right
  for (let k = 1; k <= n; k++) border.push([1, 1 - k / n]);        // right edge, bottom → top
  for (let k = 1; k < n; k++) border.push([1 - k / n, 0]);         // top edge, right → left
  const [cx, , cz] = pose.position;
  const { right, up, back } = pose.axes;
  const out = [];
  border.forEach(([u, v]) => {
    const px = u * photoWidth - photoWidth / 2, py = -(v * photoHeight - photoHeight / 2);
    const dir = [0, 1, 2].map(i => right[i] * px + up[i] * py - back[i] * pose.focal);
    const g = imageToGround(pose, u, v, photoWidth, photoHeight);
    const flat = Math.hypot(dir[0], dir[2]) || 1;
    const farPt = { x: cx + (dir[0] / flat) * far, z: cz + (dir[2] / flat) * far };
    if (!g || Math.hypot(g.x - cx, g.z - cz) > far) out.push(farPt);   // sky, or very far: cut at `far`
    else out.push(g);
  });
  return out;
}

/** Share (0..1) of the W × L lot inside a ground polygon (e.g. photoFootprint), on a 24 × 24 sample. */
export function lotShareInside(poly, lotWidth, lotLength) {
  if (!poly?.length) return 0;
  const inside = (x, z) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  };
  let hit = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if (inside(((i + 0.5) / 24) * lotWidth, ((j + 0.5) / 24) * lotLength)) hit++;
  return hit / 576;
}

/* ── Six pins: back corners + two points on each side fence ('fences', the default from 2026-11-12) ─────────
   A fence is a line, so two pins on each side fence (near and far) say exactly where it runs. With the two back
   corners that is more than the camera needs (8 conditions for 6 unknowns), so the pins can be checked against
   each other: a pin off its fence shows up, and a yard whose fences aren't parallel (narrower or wider towards
   the back) is recognised and measured instead of being forced into a rectangle.
   Order (clockwise on the photo): back left, back right, right fence far, right fence near, left fence near,
   left fence far. The camera is fitted by damped least squares (Levenberg–Marquardt, numeric Jacobian) on the
   pins' ground positions, starting from the four-pin solution. */
/* Eight pins (2026-11-12): the six above, then
     6 · Back fence, middle — a third point on the back fence: the back corners can now be checked too (the three
         must line up), and the fit has one more condition to hold.
     7 · House side — where the yard meets the house (or the front fence), if the photo shows it (taken from
         upstairs or a corner). The other pins fix the camera; this one then MEASURES the yard's length, which six
         pins can't. Most photos are taken from the house, so it's usually out of view: { skip: true } = not used.
   Older saved designs have six pins and work as before. */
export const FENCE_LABELS = ['Back left', 'Back right', 'Right fence, far', 'Right fence, near', 'Left fence, near', 'Left fence, far',
  'Back fence, middle', 'House side'];
export const FENCE_OUTLINE = 6;   // the first six pins outline the yard on the photo; the other two sit on its edges
export const defaultFencePins = () => [
  // each fence's far pin a third of the way from its corner to its near pin: on the line, so nothing starts red
  { u: 0.3, v: 0.42 }, { u: 0.7, v: 0.42 }, { u: 0.7875, v: 0.574 }, { u: 0.95, v: 0.86 }, { u: 0.05, v: 0.86 }, { u: 0.2125, v: 0.574 },
  { u: 0.5, v: 0.42 },                 // on the back line, between the corners
  { u: 0.5, v: 0.97, skip: true },     // the house side: only when they can see it
];
export const validFencePins = (p) => Array.isArray(p) && (p.length === 6 || p.length === 8)
  && p.every(q => q && Number.isFinite(q.u) && Number.isFinite(q.v));
const hasMid = (pins) => pins.length >= 7 && !pins[6].skip;
const hasHouse = (pins) => pins.length >= 8 && !pins[7].skip;
export const FENCE_OFF = 0.3;   // m
export const FENCE_BEND = 0.012; // share of the photo's diagonal: a fence pin this far off the line its corner and partner make

// Rotate a vector about an axis (Rodrigues); w = axis × angle
function rotate(v, w) {
  const a = len(w);
  if (a < 1e-12) return v;
  const k = scale(w, 1 / a), c = Math.cos(a), s = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}
function nudged(base, p) {   // p: [dx, dy, dz, wx, wy, wz] applied to a pose
  const w = [p[3], p[4], p[5]];
  return { ...base, position: add(base.position, [p[0], p[1], p[2]]),
    axes: { right: rotate(base.axes.right, w), up: rotate(base.axes.up, w), back: rotate(base.axes.back, w) } };
}

// The ground under each pin for a pose; null above the horizon
const groundOf = (pose, pins, iw, ih) => pins.map(q => imageToGround(pose, q.u, q.v, iw, ih));
const rmsOf = (r) => Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length);

// Residuals (m): back corners on (0,0) and (W,0); side pins on the fence lines. taper = [a, b]: each fence leaves
// its back corner at that angle from straight ahead (0 = square to the back fence)
function fenceResiduals(pose, pins, W, iw, ih, taper, front = null) {
  const g = groundOf(pose, pins.slice(0, 7), iw, ih);   // (the house-side pin isn't fitted: it measures)
  if (g.some((p, i) => !p && !(i === 6 && !hasMid(pins)))) return null;
  const [a, b] = taper || [0, 0];
  const off = (p, x0, t) => (p.x - x0 - p.z * Math.tan(t)) * Math.cos(t);
  const r = [g[0].x, g[0].z, g[1].x - W, g[1].z, off(g[2], W, b), off(g[3], W, b), off(g[4], 0, a), off(g[5], 0, a)];
  if (hasMid(pins)) r.push(g[6].z);   // the back fence's middle pin: on the back fence too
  // A measured width at the house side (front.width at front.z metres from the back): the one thing a single
  // photo can't tell — a tapering yard looks exactly like a rectangle seen from another height
  if (front) r.push((W + front.z * (Math.tan(b) - Math.tan(a))) - front.width);
  return r;
}

// Damped least squares over the pose (and the fence angles when `free`); skip: a side pin (2–5) left out
// split (with a front width): which fences lean — 'both' (equally, mirrored), 'left' or 'right' (the other is square)
const leanOf = (q, split) => (split === 'left' ? [q[6], 0] : split === 'right' ? [0, q[6]] : [-q[6], q[6]]);
function fitFences(start, pins, W, iw, ih, { free = false, skip = [], front = null, split = 'both' } = {}) {
  let p = new Array(free ? 7 : 6).fill(0);
  const weight = (i) => (skip.includes(i - 2) ? 0 : 1);
  const res = (q) => {
    const r = fenceResiduals(nudged(start, q), pins, W, iw, ih, free ? leanOf(q, split) : null, front);
    return r && r.map((v, i) => v * weight(i));
  };
  const cost = (r) => (r ? r.reduce((s, v) => s + v * v, 0) : Infinity);
  let r = res(p), c = cost(r), lambda = 1e-3;
  if (!r) return null;
  for (let it = 0; it < 80; it++) {
    const J = p.map((_, j) => {
      const h = j < 3 ? 1e-4 : 1e-6, q = p.slice();
      q[j] += h;
      const rq = res(q);
      return rq ? rq.map((v, i) => (v - r[i]) / h) : null;
    });
    if (J.some(col => !col)) break;
    const n = p.length;
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => J[i].reduce((s, v, k) => s + v * J[j][k], 0)));
    const g = Array.from({ length: n }, (_, i) => -J[i].reduce((s, v, k) => s + v * r[k], 0));
    let improved = false, moved = false;
    for (let tries = 0; tries < 10 && !moved; tries++) {
      const Ad = A.map((row, i) => row.map((v, j) => v + (i === j ? lambda * (v + 1e-9) : 0)));
      const step = solve(Ad, g);
      if (!step) { lambda *= 10; continue; }
      const q = p.map((v, i) => v + step[i]);
      const rq = res(q), cq = cost(rq);
      if (cq < c) { improved = c - cq > 1e-16; p = q; r = rq; c = cq; lambda = Math.max(1e-12, lambda / 3); moved = true; }
      else lambda *= 10;
    }
    if (!improved) break;
  }
  const pose = nudged(start, p), taper = free ? leanOf(p, split) : [0, 0];
  return { pose, taper, residuals: fenceResiduals(pose, pins, W, iw, ih, taper, front) };
}

/**
 * The camera for six fence pins on a yard whose back is W metres wide, and how well the pins agree.
 * front: { width, z } — the yard's width measured at the house side, z metres from the back fence (optional).
 * Without it the yard is taken as a rectangle (a single photo can't tell a tapering yard from a rectangle seen
 * from another height); with it, fences that lean are measured.
 * → { ok, ...pose, mode: 'fences', fitError (m, RMS), offPins: [side pins that sit off their fence],
 *     taper: null | { left, right (radians), outline(L) → [{x, z}] from the back-left corner } } or { ok: false, reason }.
 */
export function solveFromFences(pins, lotWidth, photoWidth, photoHeight, focal, { front = null, split = 'both' } = {}) {
  const W = Number(lotWidth), iw = Number(photoWidth), ih = Number(photoHeight);
  if (!validFencePins(pins) || !(W > 0 && iw > 0 && ih > 0)) return { ok: false, reason: 'missing' };
  // Pins off their fence: a straight fence is a straight line on the photo too (whatever the camera or the yard's
  // shape), so each back corner and its two fence pins must line up. With three points the photo can't say which
  // one moved, so the fence is named (both its pins are highlighted). Checked first: it holds even when no camera fits.
  const offPins = [], diag = Math.hypot(iw, ih);
  const dist = (p, q, r) => Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1);
  for (const [c, a, b] of [[1, 2, 3], [0, 5, 4]]) {
    const P = [c, a, b].map(k => [pins[k].u * iw, pins[k].v * ih]);
    if (Math.max(dist(P[0], P[2], P[1]), dist(P[0], P[1], P[2])) / diag > FENCE_BEND) offPins.push(a, b);
  }
  // The back fence: its middle pin must line up with the two back corners (any of the three may be the one off)
  if (hasMid(pins)) {
    const P = [0, 6, 1].map(k => [pins[k].u * iw, pins[k].v * ih]);
    if (dist(P[0], P[2], P[1]) / diag > FENCE_BEND) offPins.push(0, 1, 6);
  }
  // Start: the four-pin solution from whichever pair of side pins gives a camera nearest eye level
  // (no convexity test: on a straight fence the back corner and its two pins are in a line, as they should be)
  let start = null;
  for (const [r, l] of [[2, 5], [3, 4], [2, 4], [3, 5]]) {
    const s = solveFromEdges([pins[0], pins[1], pins[r], pins[l]], W, iw, ih, focal);
    if (s.ok && (!start || Math.abs(s.position[1] - 1.7) < Math.abs(start.position[1] - 1.7))) start = s;
  }
  if (!start) return { ok: false, reason: 'upside_down', offPins };
  const hasFront = front && Number(front.width) > 0 && Number(front.z) > 0 && Math.abs(Number(front.width) - W) >= 0.1;
  let fit = hasFront
    ? fitFences(start, pins, W, iw, ih, { free: true, split, front: { width: Number(front.width), z: Number(front.z) } })
    : fitFences(start, pins, W, iw, ih);
  // A stray pin can drag the fit somewhere impossible: keep the plain four-pin camera then
  const sane = (f) => f?.residuals && f.pose.position[1] > 0.05 && f.pose.position[1] <= 80;
  if (!sane(fit)) {
    const r = fenceResiduals(start, pins, W, iw, ih, null);
    fit = r ? { pose: start, taper: [0, 0], residuals: r } : null;
  }
  if (!sane(fit)) return { ok: false, reason: 'shape', offPins };
  const pose = fit.pose;
  const rms = rmsOf(fit.residuals.slice(0, hasMid(pins) ? 9 : 8));
  const [ta, tb] = fit.taper;
  const taper = hasFront && (Math.abs(ta) > 1e-4 || Math.abs(tb) > 1e-4) && Math.abs(ta) < 0.45 && Math.abs(tb) < 0.45
    ? { left: ta, right: tb, outline: (L) => [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W + L * Math.tan(tb), z: L }, { x: L * Math.tan(ta), z: L }] }
    : null;
  // The house-side pin, when they could see it: the ground under it is how far the yard runs from the back fence
  const house = hasHouse(pins) ? imageToGround(pose, pins[7].u, pins[7].v, iw, ih) : null;
  const measuredLength = house && house.z > 0.5 && house.z < 200 ? house.z : null;
  return { ok: true, ...pose, mode: 'fences', estimatedFocal: true, fitError: rms, offPins, taper, measuredLength };
}

