import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// ─── Category scale multipliers ────────────────────────────────────────────────
// After normalizing every model to 1 unit, these multipliers make each category
// look realistically proportioned relative to each other in the garden scene.
const CATEGORY_SCALE = {
  plant:      3.0,   // Trees / shrubs are tall — boost them up
  hardscape:  2.0,   // Paths, rocks, walls — mid-sized structures
  furniture:  1.0,   // Chairs, tables — human-scale objects stay at 1 unit
};

const DEFAULT_CATEGORY_SCALE = 1.5; // fallback for unknown categories

/**
 * NormalizedModel
 *
 * Loads a .glb from `url` and automatically:
 *   1. Clones the scene (safe for multiple instances)
 *   2. Computes the bounding box with THREE.Box3
 *   3. Centers the model on the X and Z axes
 *   4. Pins the model's lowest Y point exactly to Y = 0 (ground-flush)
 *   5. Normalizes the model so its largest dimension = 1 unit
 *   6. Applies a category multiplier for realistic relative sizing
 *   7. Applies the user's `scale` slider on top of everything
 *
 * Props:
 *   url       {string}  — Absolute URL of the .glb (e.g. from Django backend)
 *   scale     {number}  — User's UI scale multiplier (e.g. 0.8 – 2.0)
 *   category  {string}  — 'plant' | 'hardscape' | 'furniture'
 */
export default function NormalizedModel({ url, scale = 1, category = 'plant', realWorldSize }) {
  const { scene } = useGLTF(url);

  const normalizedScene = useMemo(() => {
    // ── 1. Deep-clone so multiple placed instances are independent ─────────────
    const clone = scene.clone(true);

    // ── 2. Enable shadows on every mesh in the hierarchy ──────────────────────
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.side = THREE.DoubleSide;
            });
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
        }
      }
    });

    // ── 3. Compute the world-space bounding box of the raw clone ──────────────
    //    We must do this BEFORE modifying position/scale so the box reflects
    //    the model's original exported values.
    clone.updateWorldMatrix(true, true);
    const box    = new THREE.Box3().setFromObject(clone);
    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Guard: if the model has no geometry (empty GLTF) skip transforms
    if (size.x === 0 && size.y === 0 && size.z === 0) return clone;

    // ── 4. Base normalization scale: largest axis → target scale unit ──────────
    const maxDim   = Math.max(size.x, size.y, size.z);
    const targetScale = realWorldSize || 1.0;
    const normScale = targetScale / maxDim;

    // ── 5. Category multiplier ────────────────────────────────────────────────
    const catMult = realWorldSize ? 1.0 : (CATEGORY_SCALE[category] ?? DEFAULT_CATEGORY_SCALE);

    // ── 6. Combined final scale (normalization × category × user slider) ──────
    const finalScale = normScale * catMult * scale;
    clone.scale.setScalar(finalScale);

    // ── 7. Center X / Z, pin bottom to Y = 0 ─────────────────────────────────
    //    After applying scale, the world-space positions shift, so we
    //    recompute position offsets using the pre-scale box values and
    //    multiply by finalScale to stay consistent.
    clone.position.set(
      -center.x * finalScale,                  // X: center the model
      -box.min.y * finalScale,                 // Y: lift so lowest point = 0
      -center.z * finalScale                   // Z: center the model
    );

    return clone;
  }, [scene, scale, category, realWorldSize]);
  // Re-run whenever the loaded scene, the user's scale, or the category changes.

  return <primitive object={normalizedScene} />;
}
