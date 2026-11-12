/**
 * Living grass for the 3D view (ThreeGardenCanvas): real blades on the lawn, moving in the wind.
 * Made in the browser — one small blade shape drawn tens of thousands of times in a single draw call
 * (InstancedMesh) — so there is nothing to download.
 *
 *  - Blades only where there is lawn: the design's lawn and its entry (layout_engine GardenPlan), or the whole
 *    yard for a design without a plan; never on paths, paving or outside the yard's own shape.
 *  - Blades grow in clumps (tufts with their own height, shade, dryness and lean) and run from a darker root to a
 *    lighter tip, some tips dried to straw; soft drifts and sun-dried patches, never mowing stripes (a home lawn).
 *    How long it is: LAWN_LOOKS (just mown / natural, the default / long grass).
 *  - Lit like turf: normals lean up, so a blade looks the same from both sides (no dark backs).
 *  - Wind: waves rolling across the lawn in one direction (world space, so neighbours move together), the tip
 *    bending most. Still when the visitor asked for less motion.
 *  - The painted turf underneath stays: from afar it carries the colour, up close the blades add the depth.
 *
 * Lot metres: x 0..W, z 0..L (back → front). Pure three.js, no React.
 */
import * as THREE from 'three';
import { lawnShape } from './gardenGround';

const PER_M2 = 1100;                      // blades per square metre at most
const CAP = { full: 90000, lite: 22000 }; // blades in all, at most (desktop / phones)
const BLADE_W = 0.032;                    // m at the base

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 0..1, the same for the same spot (so the ragged edge doesn't change on every redraw)
const hash = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };

function inPoly(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

/** Where grass grows: { areas: [{ test(x, z), x0, z0, x1, z1, area }], avoid(x, z) } */
function lawnAreas(plan, w, l, outline, paved) {
  const yard = Array.isArray(outline) && outline.length >= 3 ? outline : null;
  const inYard = (x, z) => x >= 0 && z >= 0 && x <= w && z <= l && (!yard || inPoly(yard, x, z));
  const areas = [];
  const g = plan?.lawn;
  if (g) {
    // The lawn as painted (gardenGround.lawnShape: rounded joins, hand-cut edge); a few blades spill a
    // couple of centimetres over the cut, as real grass does
    const shape = lawnShape(plan, w, l);
    const box = g.shape === 'ellipse'
      ? { x0: g.cx - g.rx, x1: g.cx + g.rx, z0: g.cz - g.rz, z1: g.cz + g.rz }
      : { x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 };
    const e = plan.entry;
    if (e) Object.assign(box, { x0: Math.min(box.x0, e.x0), x1: Math.max(box.x1, e.x1), z0: Math.min(box.z0, e.z0), z1: Math.max(box.z1, e.z1) });
    const pad = 0.3;
    const lawnArea = (g.shape === 'ellipse' ? Math.PI * g.rx * g.rz : (g.x1 - g.x0) * (g.z1 - g.z0)) + (e ? (e.x1 - e.x0) * (e.z1 - e.z0) : 0);
    areas.push({ x0: box.x0 - pad, x1: box.x1 + pad, z0: box.z0 - pad, z1: box.z1 + pad, area: lawnArea,
      fill: lawnArea / ((box.x1 - box.x0 + 2 * pad) * (box.z1 - box.z0 + 2 * pad)),
      test: (x, z) => shape.at(x, z) > -0.03 * hash(x, z) });
  } else {
    areas.push({ x0: 0.06, x1: w - 0.06, z0: 0.06, z1: l - 0.06, area: w * l, test: () => true });
  }
  const holes = [...(plan?.lawn ? plan.paths || [] : []), ...(paved || [])];
  const avoid = (x, z) => !inYard(x, z) || holes.some((p) => x >= p.x0 - 0.04 && x <= p.x1 + 0.04 && z >= p.z0 - 0.04 && z <= p.z1 + 0.04);
  return { areas, avoid };
}

// One blade, 1 m tall (and 1 m of forward curve) before its instance scale: four tapering segments and a tip,
// curving forward more towards the tip. The two edges' normals lean apart a little, so a blade reads as rounded
// (lit on one side, a touch darker on the other) rather than a flat card.
function bladeGeometry() {
  const levels = [[0, 0.5, 0], [0.3, 0.46, 0.06], [0.55, 0.38, 0.2], [0.78, 0.24, 0.45], [1, 0, 1]];   // [height, half width (× BLADE_W·2), forward bend]
  const pos = [], nor = [], col = [], idx = [];
  const nL = new THREE.Vector3(-0.32, 0.82, 0.2).normalize(), nR = new THREE.Vector3(0.32, 0.82, 0.2).normalize();
  const nT = new THREE.Vector3(0, 0.9, 0.2).normalize();
  levels.forEach(([y, hw, bend], i) => {
    const shade = 0.5 + 0.5 * Math.pow(y, 0.8);   // darker at the root: the turf's own shade (fake occlusion)
    const half = hw * BLADE_W;
    if (i === levels.length - 1) {
      pos.push(0, y, bend); nor.push(nT.x, nT.y, nT.z); col.push(shade, shade, shade);
    } else {
      pos.push(-half, y, bend, half, y, bend);
      nor.push(nL.x, nL.y, nL.z, nR.x, nR.y, nR.z);
      col.push(shade, shade, shade, shade, shade, shade);
    }
  });
  const segs = levels.length - 2;
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  idx.push(segs * 2, segs * 2 + 1, segs * 2 + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

// Turf lighting + wind, on top of the standard material (so it takes the scene's sun, sky and plant shadows).
// aDry (per blade, 0..1): how much of its tip has dried to straw — the colour runs from the blade's own green at
// the root to pale straw at the tip, as in a real lawn between mowings.
function grassMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;\nattribute float aDry;\nvarying float vH;\nvarying float vDry;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = position.y;
        vDry = aDry;
        #ifdef USE_INSTANCING
          vec2 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
          float gust = sin(uTime * 1.25 + root.x * 0.55 + root.y * 0.35);
          float flutter = 0.35 * sin(uTime * 3.1 + root.x * 2.7 - root.y * 2.1);
          float bladeH = length(instanceMatrix[1].xyz);   // this blade's height (m)
          float bend = (gust * 0.75 + 0.25 + flutter) * uWind * position.y * position.y * bladeH;
          // the push is the same direction for every blade (world), taken into this blade's own turned frame;
          // at most about a third of the blade's height at the tip in a gust
          transformed += inverse(mat3(instanceMatrix)) * vec3(bend * 0.34, -abs(bend) * 0.06, bend * 0.16);
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;\nvarying float vDry;')
      // root → tip: a little lighter and yellower up the blade, dry tips pale straw
      .replace('#include <color_fragment>', `#include <color_fragment>
        float up = smoothstep(0.35, 1.0, vH);
        vec3 straw = vec3(0.74, 0.66, 0.36) * (0.55 + 0.45 * dot(diffuseColor.rgb, vec3(0.6)));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.1, 0.82), up * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, straw, up * up * vDry);`)
      // Both faces lit like the front: a thin blade seen from behind isn't dark
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'garden-grass-v2';
  return mat;
}

/* Clumps (the Ghost of Tsushima way): the lawn is split into cells round jittered points (Voronoi); each blade
   belongs to the nearest point and takes that clump's height, shade, dryness and lean, and leans out from its
   centre, so the grass grows in tufts instead of an even pile. */
function clumpAt(x, z, size, look) {
  const i0 = Math.floor(x / size), j0 = Math.floor(z / size);
  let best = null, bd = Infinity;
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const cx = (i + 0.15 + 0.7 * hash(i * 1.7, j * 2.3)) * size, cz = (j + 0.15 + 0.7 * hash(i * 3.1, j * 0.9 + 7)) * size;
      const d = (cx - x) ** 2 + (cz - z) ** 2;
      if (d < bd) { bd = d; best = [i, j, cx, cz]; }
    }
  }
  const [i, j, cx, cz] = best;
  const r = (k) => hash(i * 12.9898 + k * 4.1, j * 78.233 - k * 2.7);
  return {
    dx: x - cx, dz: z - cz, dist: Math.sqrt(bd) / size,
    height: 1 + (r(1) - 0.5) * 2 * look.clumpHeight,
    hue: (r(2) - 0.5) * 0.035, light: (r(3) - 0.5) * 0.07,
    dry: r(4), leanA: r(5) * Math.PI * 2, lean: r(6) * look.clumpLean,
  };
}

/* How the lawn looks (the customer's choice): just mown, a few weeks since the mower (the default: how a home lawn
   usually looks), or left to grow (long, tufted, with dry tips — rough grass). */
export const LAWN_LOOKS = {
  // greens: the blades' base colours — a fresh lawn is greener; real, unwatered-for-a-week grass runs to olive and
  // yellow-green (the reference the customer showed: a field, not a putting green)
  mown:    { label: 'Just mown',  height: [0.05, 0.11], clump: 0.14, clumpHeight: 0.18, clumpLean: 0.08, tilt: 0.22, droop: 0.12, dry: 0.15, width: [0.75, 1.2], density: 1,
    greens: ['#3f7a2c', '#4a8633', '#376f27', '#55913a', '#457f30', '#5e9940'] },
  natural: { label: 'Natural',    height: [0.08, 0.2],  clump: 0.22, clumpHeight: 0.32, clumpLean: 0.15, tilt: 0.38, droop: 0.2,  dry: 0.4,  width: [0.5, 0.85], density: 1,
    greens: ['#3f7a2c', '#4a8633', '#55913a', '#5f8f34', '#6b9038', '#4f7d2a', '#7a9640'] },
  wild:    { label: 'Long grass', height: [0.15, 0.42], clump: 0.32, clumpHeight: 0.45, clumpLean: 0.25, tilt: 0.55, droop: 0.3,  dry: 0.65, width: [0.38, 0.7], density: 0.8,
    greens: ['#4f7d2a', '#5f8f34', '#6b9038', '#7a9640', '#869a45', '#5a7f2c', '#8f9c4c'] },
};
export const DEFAULT_LAWN_LOOK = 'natural';

/**
 * plan: the design's GardenPlan dict or null (all lawn). outline: the yard's shape. paved: [{x0,z0,x1,z1}] hard
 * ground the customer marked. lite: phones. still: no wind (prefers-reduced-motion). look: LAWN_LOOKS key.
 * heightAt(x, z): ground height (m) under a blade, for uneven ground (default flat).
 * → { mesh, tick(seconds), dispose } (mesh null when there's no lawn)
 */
export function buildGrass(plan, w, l, { outline = null, paved = [], lite = false, still = false, beds = null, look: lookName = DEFAULT_LAWN_LOOK, heightAt = null } = {}) {
  const look = LAWN_LOOKS[lookName] || LAWN_LOOKS[DEFAULT_LAWN_LOOK];
  const lawn = lawnAreas(plan, w, l, outline, paved);
  const { areas } = lawn;
  const avoid = beds ? (x, z) => lawn.avoid(x, z) || beds.at(x, z) : lawn.avoid;   // a hand-made design's beds
  const total = areas.reduce((s, a) => s + a.area, 0);
  if (!(total > 0.2)) return { mesh: null, tick: () => {}, dispose: () => {} };
  const cap = lite ? CAP.lite : CAP.full;
  const density = Math.min(PER_M2 * look.density, cap / total);
  const rand = seeded(Math.round(w * 977 + l * 131));
  const spots = [];
  areas.forEach((a) => {
    const want = Math.round(a.area * density);
    const bw = a.x1 - a.x0, bl = a.z1 - a.z0;
    for (let tries = 0, made = 0; made < want && tries < (want * 3) / (a.fill || 1); tries++) {
      const x = a.x0 + rand() * bw, z = a.z0 + rand() * bl;
      if (!a.test(x, z) || avoid(x, z)) continue;
      spots.push([x, z]);
      made++;
    }
  });
  if (!spots.length) return { mesh: null, tick: () => {}, dispose: () => {} };

  const uniforms = { uTime: { value: 0 }, uWind: { value: still ? 0 : 1 } };
  const geo = bladeGeometry();
  const mat = grassMaterial(uniforms);
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  mesh.name = 'Lawn grass';
  const o = new THREE.Object3D(), c = new THREE.Color();
  const qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), axis = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const dryAttr = new Float32Array(spots.length);
  const greens = look.greens;
  const [h0, h1] = look.height, [w0, w1] = look.width;
  spots.forEach(([x, z], i) => {
    const k = clumpAt(x, z, look.clump, look);
    // Soft drifts across the lawn and the odd sun-dried patch (a home lawn: no mowing stripes)
    const drift = 0.03 * Math.sin(x * 0.9 + 1.3) * Math.sin(z * 0.7 + 0.4);
    const patch = Math.max(0, Math.sin(x * 0.53 + 2.1) * Math.sin(z * 0.61 + 0.7) - 0.6) * 2.5;   // 0..1, here and there
    // Height: the clump's, shorter towards its rim (a tuft is domed), each blade a little different
    const h = (h0 + (h1 - h0) * Math.pow(rand(), 1.3)) * k.height * (1 - 0.3 * Math.min(1, k.dist));
    // Lean: out from the clump's centre (the tuft opens up) plus the clump's own lean and a little of the blade's own
    const lx = k.dx * 4 + Math.cos(k.leanA) * k.lean, lz = k.dz * 4 + Math.sin(k.leanA) * k.lean;
    const len = Math.hypot(lx, lz) || 1;
    const tilt = Math.min(1.1, look.tilt * Math.min(1, k.dist + 0.25) + k.lean + (rand() - 0.5) * 0.2);
    qYaw.setFromAxisAngle(Y, rand() * Math.PI * 2);
    qTilt.setFromAxisAngle(axis.set(lz / len, 0, -lx / len), tilt);
    o.quaternion.copy(qTilt).multiply(qYaw);
    o.position.set(x, (heightAt ? heightAt(x, z) : 0) + 0.004, z);   // heightAt: uneven ground (the Studio's terrain)
    // Width across, height up, forward curve: a longer blade bends over more (some flop over in long grass)
    o.scale.set(w0 + (w1 - w0) * rand(), h, h * look.droop * (0.6 + rand() * (lookName === 'wild' ? 1.8 : 0.9)));
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    dryAttr[i] = Math.min(1, look.dry * (0.35 + 0.65 * k.dry) * (0.6 + rand() * 0.8) + patch * 0.35);
    mesh.setColorAt(i, c.set(greens[Math.floor(rand() * greens.length)])
      .offsetHSL(k.hue + (rand() - 0.5) * 0.015 - patch * 0.02, (rand() - 0.5) * 0.06 - patch * 0.08,
        k.light + (rand() - 0.5) * 0.04 + drift + patch * 0.05));
  });
  geo.setAttribute('aDry', new THREE.InstancedBufferAttribute(dryAttr, 1));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;   // the plants' shadows fall on it; blades are too small to cast their own
  mesh.castShadow = false;
  mesh.frustumCulled = false;  // one mesh over the whole lawn: its bounds are the lawn's anyway
  mesh.userData.noExport = true;
  return {
    mesh,
    tick: (t) => { uniforms.uTime.value = t; },
    dispose: () => { geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}
