import * as THREE from 'three';

// ─── Planted, not potted ──────────────────────────────────────────────────────
// Several catalog models are nursery plants in their pot. In a garden the crew plants them out of
// the pot, so the 3D views (Studio, AI Designer, staff/crew) show them in the ground: the pot and
// soil parts are taken out BEFORE the model is measured, so its height is the plant's own height
// and it grows from the ground (not from a pot that grows with it). Shop photos keep the pot (that
// is how the plant is sold).
//
// Checked 2026-11-08 by rendering each model cut at several heights (models with no entry have no pot:
// the narrow base of the croton is its woody trunk, the geranium is a single stem):
//   removeMaterials / removeMeshes: separate pot and soil parts, by material or mesh name
//   cutBelow: the pot is fused into one mesh, so triangles below this share of the model's height go
const PLANTED = {
  'peace_lilies.glb': { removeMaterials: ['Vase', 'Ground'] },          // vase = bottom 45% of the model
  'strelitzia.glb': { cutBelow: 0.175 },                                 // a small terracotta pot
  'hibiscus.glb': { removeMeshes: [/POT/i, /Dirt/i], removeMaterials: ['PaletteMaterial003', 'Dirt'] },
  'livistona.glb': { removeMaterials: ['PLANTER_BOTTOM_CROSS_Mat'] },
};

const fileOf = (url) => decodeURIComponent(String(url || '').split('?')[0].split('/').pop() || '');

/** True when this model file has a pot to take out. */
export const hasPot = (url) => !!PLANTED[fileOf(url)];

// Cut geometry, made once per source geometry and shared by every copy (never mutate the cached model)
const cutCache = new WeakMap();

function cutGeometry(mesh, minY, h, share) {
  const src = mesh.geometry;
  const key = `${share}`;
  const cached = cutCache.get(src)?.[key];
  if (cached) return cached;
  const pos = src.attributes.position;
  const index = src.index ? src.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const v = new THREE.Vector3();
  const y = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) y[i] = v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y;
  const cutY = minY + share * h;
  const keep = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if ((y[a] + y[b] + y[c]) / 3 >= cutY) keep.push(a, b, c);   // a triangle stays when its middle is above the rim
  }
  const geo = src.clone();
  geo.setIndex(keep);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  geo.userData.planted = true;
  cutCache.set(src, { ...(cutCache.get(src) || {}), [key]: geo });
  return geo;
}

/**
 * Take the pot out of a model (a clone, or the shared template of the AI view) in place.
 * Call before measuring it. Returns the same object. Models without a pot are left untouched.
 */
export function plantOut(object, url) {
  const rule = PLANTED[fileOf(url)];
  if (!rule || object.userData.plantedOut) return object;
  object.updateMatrixWorld(true);
  const drop = [];
  object.traverse((m) => {
    if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x?.name || '');
    if ((rule.removeMaterials || []).some((n) => mats.includes(n)) || (rule.removeMeshes || []).some((re) => re.test(m.name))) drop.push(m);
  });
  drop.forEach((m) => m.parent?.remove(m));
  if (rule.cutBelow) {
    const box = new THREE.Box3().setFromObject(object, true);
    const h = box.max.y - box.min.y;
    object.traverse((m) => { if (m.isMesh && h > 0) m.geometry = cutGeometry(m, box.min.y, h, rule.cutBelow); });
  }
  object.userData.plantedOut = true;
  return object;
}
