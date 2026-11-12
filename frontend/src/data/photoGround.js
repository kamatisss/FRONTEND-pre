/**
 * The customer's own ground in the 3D view: their yard photo laid back onto the lot.
 *
 * With the photo's pins lined up (data/photoPose.js) we know the camera that took it, so every spot
 * (x, z) of the lot has a pixel in the photo (projectGroundPoint). Walking the lot at a few cm per
 * pixel and reading the photo there gives a top-down picture of their real ground at true scale
 * (an "inverse perspective" warp), which the 3D view puts under the design.
 *
 * Honest about its limits: spots outside the photo, behind the camera, or so far away that a metre is
 * only a few photo pixels fade out (alpha), so the view shows plain ground there instead of a smear.
 * Upright things in the photo (walls, trunks, people) do stretch across the ground: it's one photo,
 * not a scan. The UI says so.
 *
 * Lot metres: x 0..W left → right, z 0..L back → front. Pure canvas maths, no three.js.
 */

const MAX_PPM = 64;            // ground pixels per metre at most
const EDGE_FEATHER = 0.04;     // share of the photo over which its edges fade
const SHARP = [3, 12];         // photo pixels per metre: none below the first, full from the second

/** The photo's pixels, capped in size (the pose works in fractions, so any scale of the photo will do) */
export function photoPixels(img, maxSide = 2048) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(1, maxSide / Math.max(iw, ih));
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(iw * k)), height: Math.max(1, Math.round(ih * k)) });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, iw, ih };
}

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * pose: solvePhotoPose(...) for this photo at its natural size (iw × ih); px: photoPixels(img).
 * → { canvas (W·ppm × L·ppm, top row = the back, alpha = how far to trust it), coverage (0..1 of the lot) }
 */
export function photoGroundCanvas(px, pose, w, l, { maxSide = 1536 } = {}) {
  const ppm = Math.min(MAX_PPM, maxSide / Math.max(w, l));
  const cw = Math.max(2, Math.round(w * ppm)), ch = Math.max(2, Math.round(l * ppm));
  const canvas = Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(cw, ch);
  const o = out.data, src = px.data, sw = px.w, sh = px.h;
  const [cx0, cy0, cz0] = pose.position;
  const { right: R, up: U, back: B } = pose.axes;
  const f = pose.focal, iw = px.iw, ih = px.ih;
  let covered = 0;
  for (let j = 0; j < ch; j++) {
    const z = ((j + 0.5) / ch) * l;
    for (let i = 0; i < cw; i++) {
      const x = ((i + 0.5) / cw) * w;
      const rx = x - cx0, ry = -cy0, rz = z - cz0;
      const depth = -(rx * B[0] + ry * B[1] + rz * B[2]);
      if (depth < 0.2) continue;
      const camX = rx * R[0] + ry * R[1] + rz * R[2], camY = rx * U[0] + ry * U[1] + rz * U[2];
      const u = (f * camX / depth + iw / 2) / iw, v = (-f * camY / depth + ih / 2) / ih;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      // Trust: fade at the photo's edges and where the ground is too far away to be sharp
      const edge = smooth(0, EDGE_FEATHER, Math.min(u, 1 - u, v, 1 - v));
      const sharp = smooth(SHARP[0], SHARP[1], f / depth);   // photo pixels per metre there (about)
      const a = edge * sharp;
      if (a <= 0.004) continue;
      // Bilinear read of the photo
      const fx = u * sw - 0.5, fy = v * sh - 0.5;
      const x0 = Math.max(0, Math.min(sw - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(sh - 1, Math.floor(fy)));
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
      const p00 = (y0 * sw + x0) * 4, p10 = (y0 * sw + x1) * 4, p01 = (y1 * sw + x0) * 4, p11 = (y1 * sw + x1) * 4;
      const k = (j * cw + i) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[p00 + c] + (src[p10 + c] - src[p00 + c]) * tx;
        const bot = src[p01 + c] + (src[p11 + c] - src[p01 + c]) * tx;
        o[k + c] = top + (bot - top) * ty;
      }
      o[k + 3] = Math.round(a * 255);
      if (a > 0.5) covered++;
    }
  }
  ctx.putImageData(out, 0, 0);
  return { canvas, coverage: covered / (cw * ch) };
}
