/**
 * Plants moving in the wind (ThreeGardenCanvas 3D view), on the GPU: each plant material gets a small addition
 * to its vertex shader that bends the plant away from the wind, more the higher a point is above the ground
 * (h²: a geranium barely trembles, a palm's crown moves a few centimetres). The gusts roll across the garden
 * in the same direction and rhythm as the lawn (data/grassField.js), so neighbours move together.
 *
 *  - Shadows move with the leaves: each swaying mesh gets a matching shadow-depth material (customDepthMaterial,
 *    keeping its leaf cut-outs), else still shadows would lie under moving leaves.
 *  - Benches and rocks never sway (only plants and the trees a customer keeps are patched).
 *  - One switch per frame and per view (SWAY.uAmount): the 3D view sets it to 1 before it draws, the photo
 *    overlay, the PDF picture and anyone who asked their device for less motion to 0. Materials are shared by
 *    every copy of a model (the model cache), so the switch is a value read when each view draws, not a
 *    per-material setting.
 *  - Nothing is downloaded and the plants' shapes are untouched on the CPU (picking, dragging, the .glb file).
 */
import * as THREE from 'three';

export const SWAY = { uTime: { value: 0 }, uAmount: { value: 0 } };
const STRENGTH = 0.0055;   // m of tip movement per m² of height (palm at 4 m: ~9 cm at a gust's peak)

const CHUNK = `#include <begin_vertex>
  {
    mat4 swayM = modelMatrix;
    #ifdef USE_INSTANCING
      swayM = modelMatrix * instanceMatrix;
    #endif
    vec3 swayW = (swayM * vec4(transformed, 1.0)).xyz;
    vec2 swayRoot = (swayM * vec4(0.0, 0.0, 0.0, 1.0)).xz;
    float swayH = clamp(swayW.y, 0.0, 9.0);
    float swayGust = sin(uSwayTime * 1.1 + swayRoot.x * 0.5 + swayRoot.y * 0.35) * 0.7 + 0.3
                   + 0.22 * sin(uSwayTime * 2.4 + swayRoot.x * 1.7 - swayRoot.y * 1.3 + swayW.y * 0.8);
    vec3 swayOff = vec3(0.9, 0.0, 0.45) * swayGust * uSwayAmount * ${STRENGTH} * swayH * swayH;
    transformed += inverse(mat3(swayM)) * swayOff;
  }`;

function inject(shader) {
  shader.uniforms.uSwayTime = SWAY.uTime;
  shader.uniforms.uSwayAmount = SWAY.uAmount;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uSwayTime;\nuniform float uSwayAmount;')
    .replace('#include <begin_vertex>', CHUNK);
}

/** Make a material sway (idempotent; keeps any patch it already had). */
export function swayMaterial(material) {
  if (!material || material.userData.sway) return material;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    inject(shader);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}|sway1`;
  material.userData.sway = true;
  material.needsUpdate = true;
  return material;
}

// The shadow-depth twin of a leaf material: the same cut-out (map / alphaMap / alphaTest) and the same bend
const depthTwins = new WeakMap();
function depthTwin(material) {
  if (!depthTwins.has(material)) {
    const d = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: material.map || null,
      alphaMap: material.alphaMap || null,
      alphaTest: material.alphaTest || 0,
      side: material.side,
    });
    swayMaterial(d);
    depthTwins.set(material, d);
  }
  return depthTwins.get(material);
}

/** Every mesh of a plant model (or a kept tree) sways, its shadow too. */
export function swayObject(object) {
  object.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach(swayMaterial);
    if (m.castShadow) m.customDepthMaterial = depthTwin(mats[0]);
  });
  return object;
}

/** Free the shadow twins made for an object's own materials (the Studio clones materials per plant). */
export function releaseSway(object) {
  object.traverse((m) => {
    if (!m.isMesh || !m.customDepthMaterial?.userData.sway) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => { const d = depthTwins.get(mat); if (d) { d.dispose(); depthTwins.delete(mat); } });
    m.customDepthMaterial = undefined;
  });
}

const reduce = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
/** Set before each view draws: time, and whether this view sways at all. */
export function setSway(on, seconds) {
  SWAY.uTime.value = seconds;
  SWAY.uAmount.value = on && !reduce?.matches ? 1 : 0;
}
