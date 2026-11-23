// The AI's look at the yard photo (backend garden_ai.photo_objects: kind, label and a box on the picture) turned
// into suggested marks in lot metres, with the photo's line-up (photoPose.imageToGround). Gemini says only what and
// where in the picture; all measuring happens here, from the pins the customer placed. Each result is a
// suggestion in "What we found in your photo": nothing is marked until the customer accepts it.
//
// How a box becomes a spot on the ground:
//   tree / shrub  the trunk stands at the bottom middle of its box; the box's width at that depth is the canopy
//   paving, water flat on the ground: all four corners of the box are ground points (top ones may be past the
//                 horizon on a photo from low down: then it is treated like a structure)
//   structure     stands on the ground along the bottom of its box; its depth is guessed from its width, away
//                 from the camera (a shed is about as deep as it is wide)
//   utility       a meter, lid or drain: a 1 m spot at the bottom middle
import { imageToGround } from './photoPose';
import { KEEP_SIZES } from './yardSurvey';

const MIN_AREA = 0.5;        // m²: smaller areas aren't worth a mark
const MAX_SHARE = 0.7;       // a "paving" bigger than this share of the yard is the ground itself
const REACH = 0.6;           // m: how far outside the yard's edge a found thing may stand (a tree on the fence)
const TREE_R = [0.6, 4];     // canopy radius limits, m
const SHRUB_R = [0.4, 1.5];

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

/**
 * objects: [{ kind, label, box: [ymin, xmin, ymax, xmax] 0–1000 }]; pose: the lined-up photo (solvePhotoPose);
 * photoW/H: its natural size; W × L: the lot; inYard(p): whether a ground point is in the yard (its own shape);
 * existing: survey items (things already marked aren't suggested again).
 * → [{ id, kind: 'keep' | 'clear', x, z, r | x0, z0, x1, z1, label, what }]
 */
export function objectsToMarks(objects, pose, photoW, photoH, W, L, inYard = () => true, existing = []) {
  if (!pose?.ok || !(W > 0 && L > 0)) return [];
  const ground = (u, v) => {
    const g = imageToGround(pose, u / 1000, v / 1000, photoW, photoH);
    return g && Number.isFinite(g.x) && Number.isFinite(g.z) ? g : null;
  };
  const near = (p) => p && p.x > -REACH && p.z > -REACH && p.x < W + REACH && p.z < L + REACH && inYard(p);
  const cam = { x: pose.position[0], z: pose.position[2] };
  const out = [];

  const boxOf = (pts) => {
    const xs = pts.map(p => clamp(p.x, 0, W)), zs = pts.map(p => clamp(p.z, 0, L));
    return { x0: r2(Math.min(...xs)), x1: r2(Math.max(...xs)), z0: r2(Math.min(...zs)), z1: r2(Math.max(...zs)) };
  };
  // A thing standing on the ground along a bottom edge a–b, `depth` metres deep away from the camera
  const standing = (a, b, depth) => {
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = Math.hypot(mx - cam.x, mz - cam.z) || 1;
    const dx = ((mx - cam.x) / len) * depth, dz = ((mz - cam.z) / len) * depth;
    return boxOf([a, b, { x: a.x + dx, z: a.z + dz }, { x: b.x + dx, z: b.z + dz }]);
  };
  const clearOk = (box) => {
    const area = (box.x1 - box.x0) * (box.z1 - box.z0);
    if (area < MIN_AREA || area > MAX_SHARE * W * L) return false;
    return !existing.some(it => (it.kind === 'clear' || it.kind === 'view') && overlap(box, it) > 0.5 * area);
  };

  objects.forEach((o, i) => {
    const [ymin, xmin, ymax, xmax] = o.box || [];
    if (![ymin, xmin, ymax, xmax].every(Number.isFinite)) return;
    const base = ground((xmin + xmax) / 2, ymax);
    if (!near(base)) return;   // past the horizon, or outside the yard
    const bl = ground(xmin, ymax), br = ground(xmax, ymax);
    const width = bl && br ? Math.hypot(br.x - bl.x, br.z - bl.z) : 1;
    const label = o.label || o.kind;
    const id = `ai${i}`;

    if (o.kind === 'tree' || o.kind === 'shrub') {
      const [lo, hi] = o.kind === 'tree' ? TREE_R : SHRUB_R;
      const r = r2(clamp(width / 2, lo, hi));
      const x = r2(clamp(base.x, 0, W)), z = r2(clamp(base.z, 0, L));
      if (existing.some(it => it.kind === 'keep' && Math.hypot(it.x - x, it.z - z) < Math.max(1, Math.min(r, it.r)))) return;
      // The nearest of the customer's own tree sizes, so it looks like one they'd have picked
      const size = KEEP_SIZES.reduce((best, s) => (Math.abs(s.r - r) < Math.abs(best.r - r) ? s : best), KEEP_SIZES[0]);
      out.push({ id, kind: 'keep', x, z, r, label, what: o.kind, size: size.label });
      return;
    }
    let box;
    if (o.kind === 'paving' || o.kind === 'water') {
      const tl = ground(xmin, ymin), tr = ground(xmax, ymin);
      box = bl && br && tl && tr ? boxOf([bl, br, tl, tr]) : bl && br ? standing(bl, br, Math.max(1, width * 0.6)) : null;
    } else if (o.kind === 'structure') {
      box = bl && br ? standing(bl, br, clamp(width * 0.8, 1, 4)) : null;
    } else {   // utility
      box = boxOf([{ x: base.x - 0.5, z: base.z - 0.5 }, { x: base.x + 0.5, z: base.z + 0.5 }]);
    }
    if (box && clearOk(box)) out.push({ id, kind: 'clear', ...box, label, what: o.kind });
  });
  return out;
}
