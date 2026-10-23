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
