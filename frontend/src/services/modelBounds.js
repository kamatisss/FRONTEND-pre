import * as THREE from 'three';

/*
 * Exact bounds of a 3D model, from its vertices.
 *
 * THREE.Box3().setFromObject(obj) without `precise` transforms each mesh's own bounding-box corners,
 * which overshoots when a mesh is rotated inside the file: the box reaches below (and above) the real
 * model. Grounding on that box made models float and sizing on it drew them too small
 * (2026-11-07: bluish river rock floated a full rock-height, croton was drawn 34% short, geranium 10%).
 * Every place that grounds or sizes a model uses this instead (Studio, AI Designer 3D, product photos).
 *
 * cacheKey: pass the shared GLTF scene so each model is measured once, not once per placed copy.
 * The box is in the object's world space as it stands (call before moving/scaling it).
 */
const cache = new WeakMap();

export function exactBounds(object, cacheKey) {
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey).clone();
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object, true);
  if (cacheKey) cache.set(cacheKey, box.clone());
  return box;
}
