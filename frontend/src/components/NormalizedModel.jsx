import { plantOut, hasPot } from '../data/plantedModel';
import { rigGrowth, growsByParts } from '../data/plantGrowth';
import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { realScale, widthFit } from '../data/modelSizing';
import { exactBounds } from '../services/modelBounds';
import { swayObject, releaseSway } from '../data/plantSway';

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
 *   1. Clones the scene and its materials (safe for multiple instances)
 *   2. Computes the bounding box with THREE.Box3
 *   3. Centers the model on the X and Z axes
 *   4. Pins the model's lowest Y point exactly to Y = 0 (ground-flush)
 *   5. Scales it to its real size (data/modelSizing.js: height, or longest side for hardscape)
 *   6. No size on record: largest dimension = 1 unit × a category multiplier
 *   7. Applies the user's `scale` slider on top of everything
 *
 * Props:
 *   url       {string}  — URL of the .glb, resolved via resolveModelUrl() (e.g. /models/plants/bamboo.glb)
 *   scale     {number}  — User's UI scale multiplier (e.g. 0.8 – 2.0)
 *   category  {string}  — 'plant' | 'hardscape' | 'furniture'
 */
// targetWidth: metres wide to draw it (a plant's spread at the growth stage; data/modelSizing.widthFit keeps
// the stretch believable). Empty = keep the model's own shape.
// stage + establishedSize: plants that grow part by part (data/plantGrowth.js) are reshaped for the stage
// sway: moves in the wind (data/plantSway.js) — placed plants in the Studio; the placement ghost stays still
export default function NormalizedModel({ url, scale = 1, category = 'plant', realWorldSize, targetWidth, stage, establishedSize, sway = false }) {
  const { scene } = useGLTF(url);

  const normalizedScene = useMemo(() => {
    // ── 1. Deep-clone so multiple placed instances are independent ─────────────
    const clone = scene.clone(true);

    // ── 2. Enable shadows on every mesh in the hierarchy ──────────────────────
    //    scene.clone() shares materials with the cached GLTF, so clone those too —
    //    otherwise hover/select emissive on one instance lights up every copy.
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((mat) => {
              const own = mat.clone();
              own.side = THREE.DoubleSide;
              own.userData.instanceOwned = true;
              return own;
            });
          } else {
            child.material = child.material.clone();
            child.material.side = THREE.DoubleSide;
            child.material.userData.instanceOwned = true;
          }
        }
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
        }
      }
    });

    // ── 2b. Planted, not potted: nursery models lose their pot and soil before being measured,
    //        so the height is the plant's own and it grows from the ground (data/plantedModel.js)
    plantOut(clone, url);
    if (sway) swayObject(clone);   // this copy's own materials, and its shadow, bend in the wind
    // ── 2c. Growing by parts: the palm's trunk lengthens under its crown; fruit and flowers come later
    const rig = rigGrowth(clone, url);
    const ratio = Number(establishedSize) > 0 && Number(realWorldSize) > 0 ? Number(realWorldSize) / Number(establishedSize) : 1;
    rig?.pose(ratio, stage || 'established');

    // ── 3. Compute the world-space bounding box of the raw clone ──────────────
    //    We must do this BEFORE modifying position/scale so the box reflects
    //    the model's original exported values.
    // Exact vertex bounds (the fast box floated models whose mesh is rotated in the file), measured once per model
    // (a planted model is measured under its own key: the pot changes its size)
    // (reshaped models are measured fresh: their shape depends on the stage)
    const box    = growsByParts(url) ? exactBounds(clone) : exactBounds(clone, hasPot(url) ? (scene.userData.plantedKey ||= {}) : scene);
    const size   = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Guard: if the model has no geometry (empty GLTF) skip transforms
    if (size.x === 0 && size.y === 0 && size.z === 0) return clone;

    // ── 4. Base scale: the item's real size (height, or longest side for hardscape:
    //       data/modelSizing.js); models with no size fall back to 1 unit × category below
    const maxDim   = Math.max(size.x, size.y, size.z);
    const normScale = realWorldSize ? realScale(size, Number(realWorldSize), category) : 1.0 / maxDim;

    // ── 5. Category multiplier ────────────────────────────────────────────────
    const catMult = realWorldSize ? 1.0 : (CATEGORY_SCALE[category] ?? DEFAULT_CATEGORY_SCALE);

    // ── 6. Combined final scale (normalization × category × user slider) ──────
    const finalScale = normScale * catMult * scale;
    const wide = finalScale * widthFit(Number(targetWidth) || 0, Math.max(size.x, size.z) * finalScale);
    clone.scale.set(wide, finalScale, wide);

    // ── 7. Center X / Z, pin bottom to Y = 0 ─────────────────────────────────
    //    After applying scale, the world-space positions shift, so we
    //    recompute position offsets using the pre-scale box values and
    //    multiply by finalScale to stay consistent.
    clone.position.set(
      -center.x * wide,                        // X: center the model
      -box.min.y * finalScale,                 // Y: lift so lowest point = 0
      -center.z * wide                         // Z: center the model
    );

    return clone;
  }, [scene, scale, category, realWorldSize, url, targetWidth, stage, establishedSize, sway]);
  // Re-run whenever the loaded scene, the user's scale, or the category changes.

  // Free this instance's cloned materials when replaced or unmounted.
  // Geometry and textures stay shared with the GLTF cache, so they aren't disposed.
  useEffect(() => () => {
    releaseSway(normalizedScene);
    normalizedScene.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => m.dispose());
    });
  }, [normalizedScene]);

  return <primitive object={normalizedScene} />;
}
