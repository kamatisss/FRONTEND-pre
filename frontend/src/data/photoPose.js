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
  const ground = [[0, 0], [W, 0], [W, L], [0, L]];
  const H = homography(ground, image);
  if (!H) return { ok: false, reason: 'shape' };
  const longSide = Math.max(iw, ih);
  const minF = 0.4 * longSide, maxF = 3 * longSide;

  const fitError = (pose) => {
    let worst = 0;
    for (let i = 0; i < 4; i++) {
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
  return { ok: true, ...pose, estimatedFocal: best.estimated, fitError: best.err };
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
export function normalizePins(value) {
  if (validCorners(value)) return { pins: value, mode: 'corners', focal35: null };
  if (value && validCorners(value.pins)) {
    return { pins: value.pins, mode: value.mode === 'corners' ? 'corners' : 'edges',
      focal35: Number(value.focal35) > 0 ? Number(value.focal35) : null };
  }
  return null;
}

export const pinLabels = (mode) => (mode === 'corners' ? CORNER_LABELS : EDGE_LABELS);
export const defaultPins = (mode) => (mode === 'corners' ? defaultCorners() : defaultEdgePins());

/**
 * The camera for saved pins ({ pins, mode, focal35 }) on a W × L lot and a photo of iw × ih pixels.
 * Adds cameraHeight (m) to the result, to sanity-check the pins and the yard size.
 */
export function solvePhotoPose(setup, lotWidth, lotLength, photoWidth, photoHeight) {
  const s = normalizePins(setup) || { pins: defaultEdgePins(), mode: 'edges', focal35: null };
  const pose = s.mode === 'corners'
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
