/**
 * Groundcover in the 3D view (ThreeGardenCanvas): the carpet of low plants over the design's beds (backend
 * groundcover.py: design.groundcover = [{plant_id, name, area_sqm, sunlight}]), made in the browser like the
 * lawn's grass — nothing downloaded.
 *
 *  - Where: the beds = the yard less its lawn (gardenGround.lawnShape), its paths and marked paving. The shade
 *    groundcover goes under the crowns of tall plants and kept trees, the sun one everywhere else.
 *  - How it grows (the growth stage): at planting, separate plugs on the mulch about 28 cm apart; in 2 years
 *    close clumps with a green carpet under them; fully grown a closed carpet — no soil left, as in a real garden.
 *  - Its look follows the plant: mani-mani round bright leaves with yellow flowers, bangka-bangkaan purple-green
 *    strap leaves, mondo grass dark grassy tufts, Asiatic jasmine small glossy dark leaves.
 *  - A design covering only part of its beds (budget) shows that share of them covered.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lawnShape } from './gardenGround';

const MASK_PPM = 20;
const TALL = 2.4;   // m (backend groundcover.TALL)
const STAGE = {
  planting: { gap: 0.28, size: 0.55, carpet: 0 },
  established: { gap: 0.17, size: 0.85, carpet: 0.6 },
  mature: { gap: 0.13, size: 1.0, carpet: 0.92 },
};
const CAP = { full: 16000, lite: 5000 };

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** How a groundcover looks, from its name (sample catalog; anything else: a generic leafy carpet). */
export function profileOf(name = '') {
  const n = name.toLowerCase();
  if (/mani|arachis|peanut/.test(n)) return { form: 'leafy', colors: ['#5aa33a', '#67b245', '#4d9030'], carpet: '#4f8f32', flower: '#f2c230' };
  if (/bangka|rhoeo|tradescantia|oyster/.test(n)) return { form: 'strap', colors: ['#4e6e3b', '#6a4b78', '#5c3f6c'], carpet: '#4a4f3a' };
  if (/mondo|ophiopogon|liriope/.test(n)) return { form: 'grassy', colors: ['#2f4f27', '#38592f', '#2a4623'], carpet: '#2c4a25' };
  if (/jasmin|trachelospermum/.test(n)) return { form: 'leafy', colors: ['#2f5a2a', '#3a6a32', '#28502a'], carpet: '#2d5428', small: true };
  return { form: 'leafy', colors: ['#3f7a2c', '#4a8a34', '#376d28'], carpet: '#3d7029' };
}

// One clump, about 20 cm across before its instance scale (y up, origin on the ground)
function clumpGeometry(form) {
  const parts = [];
  const leaf = (len, wide, tilt, turn, lift = 0) => {
    const g = new THREE.PlaneGeometry(wide, len, 1, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {   // pointed tip, slight arch
      const y = pos.getY(i) / len + 0.5;
      pos.setX(i, pos.getX(i) * (1 - 0.75 * y * y));
      pos.setZ(i, -0.25 * len * y * y);
    }
    g.translate(0, len / 2, 0);
    g.rotateX(-tilt);
    g.rotateY(turn);
    g.translate(0, lift, 0);
    g.computeVertexNormals();
    const n = g.attributes.normal;   // lit like foliage seen from above
    for (let i = 0; i < n.count; i++) { const v = new THREE.Vector3(n.getX(i), Math.abs(n.getY(i)) + 0.8, n.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    const shade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = 0.62 + 0.38 * Math.min(1, Math.max(0, pos.getY(i) / Math.max(0.01, len * 0.9))); shade.set([k, k, k], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(shade, 3));
    parts.push(g);
  };
  if (form === 'grassy') {
    for (let i = 0; i < 11; i++) leaf(0.16 + (i % 3) * 0.03, 0.012, 0.25 + (i % 4) * 0.12, (i / 11) * Math.PI * 2);
  } else if (form === 'strap') {
    for (let i = 0; i < 7; i++) leaf(0.2 + (i % 2) * 0.05, 0.04, 0.55 + (i % 3) * 0.12, (i / 7) * Math.PI * 2);
  } else {
    for (let i = 0; i < 8; i++) leaf(0.07, 0.06, 1.05 + (i % 3) * 0.12, (i / 8) * Math.PI * 2 + 0.3, 0.015);
    for (let i = 0; i < 4; i++) leaf(0.06, 0.05, 0.5, (i / 4) * Math.PI * 2, 0.03);
  }
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return geo;
}

function inPoly(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

/**
 * entries: design.groundcover. plants: the design's plants; heightOf(plant) → grown height (m) and spreadOf(plant)
 * → grown spread (m) from the catalog. → { group, dispose } (empty group when there's nothing to draw).
 */
// beds: data/plantBeds.plantBeds(...) for a design without a plan (hand-made in the Studio): its beds round the plants
export function buildGroundcover(plan, w, l, entries, { plants = [], heightOf, spreadOf, stage = 'established', outline = null, paved = [], lite = false, beds = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Groundcover';
  const list = (entries || []).filter((e) => Number(e.area_sqm) > 0);
  if (!list.length) return { group, dispose: () => {} };
  const st = STAGE[stage] || STAGE.established;
  const sun = list.find((e) => e.sunlight !== 'full_shade') || list[0];
  const shade = list.find((e) => e !== sun && e.sunlight === 'full_shade') || list.find((e) => e !== sun) || null;

  // The beds as a mask
  const mw = Math.max(8, Math.round(w * MASK_PPM)), mh = Math.max(8, Math.round(l * MASK_PPM));
  const mc = Object.assign(document.createElement('canvas'), { width: mw, height: mh });
  const ctx = mc.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(mw / w, 0, 0, mh / l, 0, 0);
  ctx.fillStyle = '#fff';
  const shape = Array.isArray(outline) && outline.length >= 3 ? outline : (Array.isArray(plan?.outline) && plan.outline.length >= 3 ? plan.outline : null);
  if (beds) {   // the beds round the plants (already inside the yard's shape)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(beds.canvas, 0, 0, mw, mh); ctx.restore();
  } else {
    ctx.beginPath();
    if (shape) { shape.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z))); ctx.closePath(); } else ctx.rect(0, 0, w, l);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'destination-out';
  const lawn = !beds && plan?.lawn ? lawnShape(plan, w, l) : null;
  if (lawn) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lawn.canvas, 0, 0, mw, mh); ctx.restore(); }
  [...(plan?.paths || []), ...(paved || [])].forEach((p) => ctx.fillRect(p.x0 - 0.05, p.z0 - 0.05, p.x1 - p.x0 + 0.1, p.z1 - p.z0 + 0.1));
  ctx.globalCompositeOperation = 'source-over';
  const mask = ctx.getImageData(0, 0, mw, mh).data;
  const inBed = (x, z) => {
    const i = Math.floor((x / w) * mw), j = Math.floor((z / l) * mh);
    return i >= 0 && j >= 0 && i < mw && j < mh && mask[(j * mw + i) * 4 + 3] > 128 && (!shape || inPoly(shape, x, z));
  };

  // Shade under tall crowns and kept trees
  const crowns = [];
  plants.forEach((p) => {
    if (p.is_existing) { if (Number(p.r) > 0) crowns.push([Number(p.x), Number(p.z), Number(p.r)]); return; }
    if ((heightOf?.(p) || 0) >= TALL) crowns.push([Number(p.x), Number(p.z), Math.max(0.6, (spreadOf?.(p) || 1.6) / 2)]);
  });
  const shaded = (x, z) => !!shade && crowns.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r);

  // Share of the beds covered (a budget may cover only part)
  let bedCells = 0;
  for (let k = 3; k < mask.length; k += 4) if (mask[k] > 128) bedCells++;
  const bedM2 = bedCells / (MASK_PPM * MASK_PPM);
  const covered = list.reduce((s, e) => s + Number(e.area_sqm), 0);
  const share = bedM2 > 0 ? Math.min(1, covered / bedM2) : 0;
  if (share <= 0) return { group, dispose: () => {} };

  const geos = [], mats = [], texs = [];
  // Covered part: the beds nearest the lawn first (the eye-level front of each bed), by a smooth noise threshold
  const rand = seeded(Math.round(w * 131 + l * 977));
  const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 1.7 + 1.1) * Math.sin(z * 1.3 + 0.4) + 0.25 * Math.sin((x - z) * 0.9);
  const isCovered = (x, z) => share >= 0.999 || noise(x, z) < share;

  // The carpet under the clumps (from 2 years on): the groundcover's own green over the covered beds
  if (st.carpet > 0) {
    const cc = Object.assign(document.createElement('canvas'), { width: mw, height: mh });
    const c2 = cc.getContext('2d');
    const img = c2.createImageData(mw, mh);
    const sunCol = new THREE.Color(profileOf(sun.name).carpet), shadeCol = shade ? new THREE.Color(profileOf(shade.name).carpet) : sunCol;
    for (let j = 0; j < mh; j++) {
      for (let i = 0; i < mw; i++) {
        const k = (j * mw + i) * 4;
        if (mask[k + 3] <= 128) continue;
        const x = ((i + 0.5) / mw) * w, z = ((j + 0.5) / mh) * l;
        if (!isCovered(x, z)) continue;
        const col = shaded(x, z) ? shadeCol : sunCol;
        const v = 0.85 + rand() * 0.3;
        img.data[k] = Math.min(255, col.r * 255 * v); img.data[k + 1] = Math.min(255, col.g * 255 * v); img.data[k + 2] = Math.min(255, col.b * 255 * v);
        img.data[k + 3] = Math.round(255 * st.carpet * (0.75 + rand() * 0.25));
      }
    }
    c2.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cc);
    tex.colorSpace = THREE.SRGBColorSpace;
    texs.push(tex);
    const geo = new THREE.PlaneGeometry(w, l);
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2, 0.006, l / 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, metalness: 0, depthWrite: false });
    geos.push(geo); mats.push(mat);
    const carpet = new THREE.Mesh(geo, mat);
    carpet.receiveShadow = true;
    carpet.renderOrder = 0;
    group.add(carpet);
  }

  // The clumps: a jittered grid at the stage's spacing, per groundcover
  const spots = { sun: [], shade: [] };
  const cap = lite ? CAP.lite : CAP.full;
  let gap = st.gap;
  const estimate = (bedM2 * share) / (gap * gap);
  if (estimate > cap) gap *= Math.sqrt(estimate / cap);
  for (let z = gap / 2; z < l; z += gap) {
    for (let x = gap / 2; x < w; x += gap) {
      const px = x + (rand() - 0.5) * gap * 0.8, pz = z + (rand() - 0.5) * gap * 0.8;
      if (!inBed(px, pz) || !isCovered(px, pz)) continue;
      (shaded(px, pz) ? spots.shade : spots.sun).push([px, pz]);
    }
  }
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (const [key, entry] of [['sun', sun], ['shade', shade]]) {
    const pts = spots[key];
    if (!entry || !pts.length) continue;
    const prof = profileOf(entry.name);
    const geo = clumpGeometry(prof.form);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: prof.small ? 0.55 : 0.85, metalness: 0, side: THREE.DoubleSide });
    geos.push(geo); mats.push(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
    mesh.name = entry.name;
    pts.forEach(([x, z], i) => {
      const s = st.size * (0.8 + rand() * 0.45) * (prof.small ? 0.8 : 1);
      o.position.set(x, 0.008, z);
      o.rotation.set(0, rand() * Math.PI * 2, 0);
      o.scale.set(s, s * (0.85 + rand() * 0.3), s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      const flower = prof.flower && stage !== 'planting' && rand() < 0.12;
      mesh.setColorAt(i, c.set(flower ? prof.flower : prof.colors[Math.floor(rand() * prof.colors.length)]).offsetHSL(0, 0, (rand() - 0.5) * 0.06));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return {
    group,
    dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((t) => t.dispose()); },
  };
}
