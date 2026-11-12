/**
 * "Your yard, rebuilt": what the customer marked in "Mark your yard" (data/yardSurvey.js, saved with the
 * design as dimensions.siteSurvey), drawn around the design in ThreeGardenCanvas's 3D view.
 *
 *  - The house on its side(s) of the yard at the storey height they gave (one storey if they didn't say),
 *    with windows and a door where they marked one.
 *  - Boundary walls (painted hollow blocks with posts and a coping) on the other sides, with a gate
 *    wherever they marked one.
 *  - Trees and plants they're keeping, as trees of the size they picked (not catalog models: they're
 *    already there and aren't bought).
 *  - Driveways, patios, paths, tanks and meters they marked as paving (painted by data/gardenGround.js).
 *
 * The sizes are the ones the sun & shade map uses (backend sun_map.py: 1.8 m walls, house 3.5 / 6.5 m,
 * a kept tree's crown from 1.5 m up), so the 3D view and the shade calculation describe the same yard.
 * Walls and the house fade to a ghost while they stand between the camera and the garden (a cutaway),
 * so they never hide the design.
 *
 * Lot metres: x 0..W left → right, z 0..L back → front (house side).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const WALL_HEIGHT = 1.8;                               // sun_map.WALL_HEIGHT
export const HOUSE_HEIGHTS = { none: 0, one: 3.5, two: 6.5 };  // sun_map.HOUSE_HEIGHTS (to the ridge)
export const TRUNK = 1.5;                                     // sun_map.TRUNK: a kept tree's crown starts here
const GATE_WIDTH = 1.0;      // layout_engine.WALK_WIDTH: the path from a gate is this wide
const WALL_THICK = 0.15;
const HOUSE_DEPTH = 7;       // m the house is drawn back from its wall (what's beyond the lot isn't known)
const GHOST = { wall: 0.2, house: 0.1 };   // opacity while in the way (the house's roof is hidden then)
const COLORS = { wall: '#ebe5d9', coping: '#b9b2a4', post: '#e2dbcd', gate: '#3d434b', houseWall: '#f1ebe0',
  roof: '#8b4a3b', glass: '#3a5262', frame: '#fbfaf7', door: '#7a5232', plinth: '#9a9386' };

/* ── Reading the survey ──────────────────────────────────────────────────── */
const validOutline = (o) => (Array.isArray(o) && o.length >= 3 ? o : null);

/** Did the customer mark their yard at all (anything worth rebuilding)? */
export function hasSurvey(survey) {
  return !!survey && ((survey.items?.length || 0) > 0 || !!survey.sun || !!validOutline(survey.outline));
}

/** The house's height to the ridge (m), 0 when they said there's none next to the yard */
export function houseHeight(survey) {
  if (!hasSurvey(survey)) return 0;
  const h = survey.sun?.house;
  return h in HOUSE_HEIGHTS ? HOUSE_HEIGHTS[h] : HOUSE_HEIGHTS.one;
}

function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

/**
 * The yard's sides: [{ a, b, len, dir, out, house }] — dir along the side, out = horizontal unit normal
 * pointing away from the yard. The yard's own outline if it has one, else the lot box with the house
 * on the front (z = L) when there is a house.
 */
export function yardSides(survey, w, l, planOutline = null) {
  const outline = validOutline(survey?.outline) || validOutline(planOutline);
  const pts = outline || [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: l, house: houseHeight(survey) > 0 }, { x: 0, z: l }];
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) return null;
    const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    let out = { x: dir.z, z: -dir.x };
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    if (inside(pts, mx + out.x * 0.05, mz + out.z * 0.05)) out = { x: -out.x, z: -out.z };
    return { a: { x: +a.x, z: +a.z }, b: { x: +b.x, z: +b.z }, len, dir, out, house: !!a.house && houseHeight(survey) > 0 };
  }).filter(Boolean);
}

// Distance along a side of a point near it, or null when it is too far from that side
function along(side, x, z, reach = 0.6) {
  const t = (x - side.a.x) * side.dir.x + (z - side.a.z) * side.dir.z;
  if (t < -reach || t > side.len + reach) return null;
  const off = Math.abs((x - side.a.x) * side.out.x + (z - side.a.z) * side.out.z);
  return off <= reach ? Math.min(side.len, Math.max(0, t)) : null;
}

/** Gates and doors: [{ side (index), t (m along it) }], each on the side nearest to the mark */
export function yardOpenings(survey, sides) {
  return (survey?.items || []).filter((i) => i.kind === 'entry').map((e) => {
    let best = null;
    sides.forEach((s, idx) => {
      const t = along(s, Number(e.x), Number(e.z), 1.0);
      if (t == null) return;
      const d = Math.abs((Number(e.x) - s.a.x) * s.out.x + (Number(e.z) - s.a.z) * s.out.z);
      if (!best || d < best.d) best = { side: idx, t, d };
    });
    return best && { side: best.side, t: best.t };
  }).filter(Boolean);
}

/** Areas to draw as paving: the keep-clear boxes they marked ([{ x0, z0, x1, z1, label }]) */
export function pavedAreas(survey) {
  return (survey?.items || []).filter((i) => i.kind === 'clear' && i.x1 - i.x0 >= 0.1 && i.z1 - i.z0 >= 0.1)
    .map((i) => ({ x0: +i.x0, z0: +i.z0, x1: +i.x1, z1: +i.z1, label: i.label || '' }));
}

/**
 * One line for under the 3D view: "Built from what you marked: your house (1 storey), boundary walls
 * (1.8 m), 2 trees you're keeping, a gate and a driveway." keptCount comes from the design's plants.
 */
export function yardSummary(survey, keptCount = 0) {
  if (!hasSurvey(survey)) return '';
  const parts = [];
  const h = houseHeight(survey);
  if (h) parts.push(`your house (${survey.sun?.house === 'two' ? '2 storeys' : '1 storey'}${survey.sun?.house ? '' : ', as we guessed'})`);
  parts.push(`boundary walls (${WALL_HEIGHT} m, as for the sun and shade)`);
  if (keptCount) parts.push(keptCount === 1 ? 'the plant you\'re keeping' : `the ${keptCount} plants you're keeping`);
  const gates = (survey.items || []).filter((i) => i.kind === 'entry').length;
  if (gates) parts.push(gates === 1 ? 'your gate or door' : `${gates} gates or doors`);
  const named = { 'septic / tank': 'septic tank', other: 'paved area', '': 'paved area' };
  const paved = [...new Set(pavedAreas(survey).map((p) => named[p.label.toLowerCase()] ?? p.label.toLowerCase()))];
  paved.slice(0, 3).forEach((p) => parts.push(`your ${p}`));
  return `Built from what you marked: ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}.`;
}

/* ── 3D: walls, gates, the house ─────────────────────────────────────────── */
function placeOnSide(mesh, side, t, offOut, y) {
  mesh.position.set(side.a.x + side.dir.x * t + side.out.x * offOut, y, side.a.z + side.dir.z * t + side.out.z * offOut);
  mesh.rotation.y = -Math.atan2(side.dir.z, side.dir.x);
}

function gateLeaf(width, mat, geos) {   // a steel gate: frame and vertical bars, as one mesh
  const h = 1.6, parts = [];
  const box = (w, hh, d, x, y) => { const g = new THREE.BoxGeometry(w, hh, d); g.translate(x, y, 0); parts.push(g); };
  box(width, 0.06, 0.05, 0, 0.12);
  box(width, 0.06, 0.05, 0, h);
  box(0.06, h, 0.05, -width / 2 + 0.03, h / 2 + 0.06);
  box(0.06, h, 0.05, width / 2 - 0.03, h / 2 + 0.06);
  const bars = Math.max(3, Math.round(width / 0.12));
  for (let i = 1; i < bars; i++) box(0.025, h - 0.1, 0.025, -width / 2 + (width * i) / bars, h / 2 + 0.06);
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  geos.push(geo);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

// A boundary wall along one side, open where its gates are → a group (in lot coordinates)
function buildWall(side, gates, mats, geos) {
  const group = new THREE.Group();
  const cuts = gates.map((t) => [Math.max(0, t - GATE_WIDTH / 2), Math.min(side.len, t + GATE_WIDTH / 2)]).sort((p, q) => p[0] - q[0]);
  const pieces = [];
  let from = 0;
  cuts.forEach(([c0, c1]) => { if (c0 > from) pieces.push([from, c0]); from = Math.max(from, c1); });
  if (from < side.len) pieces.push([from, side.len]);
  const add = (geo, mat, t, offOut, y, cast = true) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    placeOnSide(m, side, t, offOut, y);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
  };
  pieces.forEach(([p0, p1]) => {
    const len = p1 - p0;
    if (len < 0.05) return;
    add(new THREE.BoxGeometry(len, WALL_HEIGHT, WALL_THICK), mats.wall, (p0 + p1) / 2, WALL_THICK / 2, WALL_HEIGHT / 2);
    add(new THREE.BoxGeometry(len + 0.04, 0.06, WALL_THICK + 0.08), mats.coping, (p0 + p1) / 2, WALL_THICK / 2, WALL_HEIGHT + 0.03);
    // Posts at both ends and about every 3 m, a little proud of the wall on both faces
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      add(new THREE.BoxGeometry(0.26, WALL_HEIGHT + 0.1, WALL_THICK + 0.1), mats.post, p0 + (len * i) / n, WALL_THICK / 2, (WALL_HEIGHT + 0.1) / 2);
    }
  });
  cuts.forEach(([c0, c1]) => {
    const leaf = gateLeaf(Math.max(0.4, c1 - c0 - 0.04), mats.gate, geos);
    placeOnSide(leaf, side, (c0 + c1) / 2, WALL_THICK / 2, 0);
    group.add(leaf);
  });
  return group;
}

// The house behind one of the yard's house walls: walls, a gable roof, windows, and a door at a marked door
function buildHouse(side, height, doors, mats, geos) {
  const group = new THREE.Group();
  const two = height > HOUSE_HEIGHTS.one + 0.1;
  const rise = two ? 1.3 : 1.0;
  const wallH = height - rise;
  const up = new THREE.Vector3(0, 1, 0);
  const out = new THREE.Vector3(side.out.x, 0, side.out.z);
  const axis = new THREE.Vector3().crossVectors(out, up);   // right-handed basis (out, up, axis)
  const centre = (t, offOut, y) => new THREE.Vector3(side.a.x + side.dir.x * t + side.out.x * offOut, y, side.a.z + side.dir.z * t + side.out.z * offOut);
  const orient = (geo, at) => {
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(out, up, axis));
    geo.translate(at.x, at.y, at.z);
    geos.push(geo);
    return geo;
  };
  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const mid = side.len / 2;

  // Walls (a box: depth along out, length along the side), on a low plinth
  mesh(orient(new THREE.BoxGeometry(HOUSE_DEPTH, wallH, side.len), centre(mid, HOUSE_DEPTH / 2, wallH / 2)), mats.houseWall);
  mesh(orient(new THREE.BoxGeometry(HOUSE_DEPTH + 0.08, 0.3, side.len + 0.08), centre(mid, HOUSE_DEPTH / 2, 0.15)), mats.plinth);
  // Gable roof: ridge along the side, eaves 0.5 m over the walls
  const ov = 0.5, half = HOUSE_DEPTH / 2 + ov;
  const prof = new THREE.Shape();
  prof.moveTo(-half, 0); prof.lineTo(half, 0); prof.lineTo(0, rise + 0.15); prof.closePath();
  const roof = new THREE.ExtrudeGeometry(prof, { depth: side.len + ov * 2, bevelEnabled: false });
  roof.translate(0, 0, -(side.len + ov * 2) / 2);
  mesh(orient(roof, centre(mid, HOUSE_DEPTH / 2, wallH - 0.15)), mats.roof).userData.roof = true;

  // The garden face: windows on each storey, a door where they marked one
  const storeys = two ? 2 : 1;
  const doorAt = doors.filter((t) => t > 0.5 && t < side.len - 0.5);
  doorAt.forEach((t) => {
    mesh(orient(new THREE.BoxGeometry(0.06, 2.1, 0.95), centre(t, -0.03, 1.05)), mats.door, false);
    mesh(orient(new THREE.BoxGeometry(0.04, 2.2, 1.1), centre(t, -0.01, 1.1)), mats.frame, false);
  });
  const count = Math.floor((side.len - 0.8) / 2.6);
  for (let s = 0; s < storeys; s++) {
    for (let i = 0; i < count; i++) {
      const t = (side.len * (i + 0.5)) / count;
      if (s === 0 && doorAt.some((d) => Math.abs(d - t) < 1.3)) continue;
      const y = 1.45 + s * 2.7;
      if (y + 0.6 > wallH - 0.2) continue;
      mesh(orient(new THREE.BoxGeometry(0.04, 1.25, 1.35), centre(t, -0.01, y)), mats.frame, false);
      mesh(orient(new THREE.BoxGeometry(0.05, 1.05, 1.15), centre(t, -0.03, y)), mats.glass, false);
    }
  }
  return group;
}

/**
 * Walls, gates and the house around the yard → { group, update(camera), dispose }.
 * update(camera) fades whatever stands between the camera and the garden (call it every frame; it
 * eases, so a turned view settles smoothly). exporting: everything solid, nothing fades.
 */
export function buildYard(survey, w, l, { planOutline = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Your yard';
  if (!hasSurvey(survey)) return { group, update: () => {}, dispose: () => {} };
  const sides = yardSides(survey, w, l, planOutline);
  const openings = yardOpenings(survey, sides);
  const h = houseHeight(survey);
  const geos = [], allMats = [];
  const parts = [];   // { group, mats, out, mid, ghost, op }
  const matSet = (keys, transparentOk) => {
    const m = {};
    keys.forEach((k) => {
      m[k] = new THREE.MeshStandardMaterial({ color: COLORS[k], roughness: k === 'glass' ? 0.15 : 0.9, metalness: k === 'glass' ? 0.2 : (k === 'gate' ? 0.4 : 0) });
      if (transparentOk) m[k].userData.fades = true;
      allMats.push(m[k]);
    });
    return m;
  };
  sides.forEach((side, idx) => {
    const ts = openings.filter((o) => o.side === idx).map((o) => o.t);
    const isHouse = side.house && h > 0;
    const mats = matSet(isHouse ? ['houseWall', 'roof', 'glass', 'frame', 'door', 'plinth'] : ['wall', 'coping', 'post', 'gate'], true);
    const g = isHouse ? buildHouse(side, h, ts, mats, geos) : buildWall(side, ts, mats, geos);
    g.name = isHouse ? 'House' : 'Boundary wall';
    group.add(g);
    // Its solid, in the side's own frame: t along the side, y up, o outwards (eaves and posts included)
    const box = isHouse
      ? { t0: -0.6, t1: side.len + 0.6, y1: h, o0: -0.1, o1: HOUSE_DEPTH + 0.6 }
      : { t0: -0.15, t1: side.len + 0.15, y1: WALL_HEIGHT + 0.1, o0: -0.05, o1: WALL_THICK + 0.05 };
    parts.push({ group: g, mats: Object.values(mats), side, box, ghost: isHouse ? GHOST.house : GHOST.wall, op: 1 });
  });

  // Spots across the yard (a coarse grid, just above the ground): a part is "in the way" when it cuts the
  // line of sight from the camera to any of them
  const outlinePts = validOutline(survey?.outline) || validOutline(planOutline);
  const step = Math.max(1.2, Math.max(w, l) / 7);
  const spots = [];
  for (let x = step / 2; x < w; x += step) {
    for (let z = step / 2; z < l; z += step) {
      if (!outlinePts || inside(outlinePts, x, z)) spots.push([x, 0.3, z]);
    }
  }
  const blocks = (p, cx, cy, cz) => spots.some(([x, y, z]) => segmentHitsBox(p.side, p.box, cx, cy, cz, x, y, z));

  let last = '';
  const update = (camera, instant = false) => {
    if (!camera) return;
    const { x: cx, y: cy, z: cz } = camera.position;
    const key = `${cx.toFixed(2)},${cy.toFixed(2)},${cz.toFixed(2)}`;
    const moved = key !== last;
    last = key;
    parts.forEach((p) => {
      if (moved || instant) p.target = blocks(p, cx, cy, cz) ? p.ghost : 1;
      const target = p.target ?? 1;
      const op = instant ? target : p.op + (target - p.op) * 0.18;
      if (Math.abs(op - p.op) < 1e-4 && op === p.op) return;
      p.op = Math.abs(op - target) < 0.005 ? target : op;
      const see = p.op < 0.999;
      p.mats.forEach((m) => { m.opacity = p.op; m.transparent = see; m.depthWrite = !see; });
      p.group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = !see || p.op > 0.6;
        if (o.userData.roof) o.visible = p.op > 0.5;   // a see-through roof just clouds the garden
      });
    });
  };
  return {
    group,
    update,
    dispose: () => { geos.forEach((g) => g.dispose()); allMats.forEach((m) => m.dispose()); },
  };
}

// Does the straight line from the camera (c) to a spot (s) pass through a part's solid? Both ends are
// taken into the side's frame (t along, y up, o outwards), then a slab test on that box.
function segmentHitsBox(side, box, cx, cy, cz, sx, sy, sz) {
  const local = (x, y, z) => {
    const dx = x - side.a.x, dz = z - side.a.z;
    return [dx * side.dir.x + dz * side.dir.z, y, dx * side.out.x + dz * side.out.z];
  };
  const a = local(cx, cy, cz), b = local(sx, sy, sz);
  const lo = [box.t0, 0, box.o0], hi = [box.t1, box.y1, box.o1];
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) {
      if (a[k] < lo[k] || a[k] > hi[k]) return false;
      continue;
    }
    let u0 = (lo[k] - a[k]) / d, u1 = (hi[k] - a[k]) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}

/* ── A plant they're keeping: a tree (or a shrub) of the size they marked ── */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * r: canopy radius (m) as marked (0.75 shrub, 1.5 small tree, 3 big tree). Trees: trunk to TRUNK, crown
 * a cluster of leaf masses round TRUNK + r (as sun_map shades with); shrubs (r < 1): a mound from the ground.
 * → a Group at the origin (its own geometry and materials; userData.keptTree).
 */
export function keptTree(r, seed = 1) {
  const rand = seeded(seed * 7919 + Math.round(r * 100));
  const group = new THREE.Group();
  group.userData.keptTree = true;
  const shrub = r < 1;
  const leafColors = ['#3f6b2f', '#4c7a35', '#36612b', '#567f3a'];
  const blobs = leafColors.map(() => []);
  const blob = (x, y, z, rad) => {
    const g = new THREE.IcosahedronGeometry(rad, 1);
    const p = g.attributes.position;   // knobbly, not a ball
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (rand() - 0.5) * 0.22;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.92, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    g.translate(x, y, z);
    blobs[Math.floor(rand() * blobs.length)].push(g);
  };
  if (shrub) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand();
      blob(Math.cos(a) * r * 0.45, r * (0.45 + rand() * 0.25), Math.sin(a) * r * 0.45, r * (0.45 + rand() * 0.15));
    }
    blob(0, r * 0.8, 0, r * 0.55);
  } else {
    const cy = TRUNK + r;
    const n = Math.round(8 + r * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 0.62;
      const y = cy + (rand() - 0.35) * r * 0.75;
      blob(Math.cos(a) * d, y, Math.sin(a) * d, r * (0.36 + rand() * 0.2));
    }
    blob(0, cy + r * 0.25, 0, r * 0.5);
    // Trunk and a few limbs into the crown
    const bark = [];
    const tr = 0.07 + r * 0.045;
    const trunk = new THREE.CylinderGeometry(tr * 0.7, tr, cy, 8);
    trunk.translate(0, cy / 2, 0);
    bark.push(trunk);
    for (let i = 0; i < 3; i++) {
      const limb = new THREE.CylinderGeometry(tr * 0.25, tr * 0.5, r * 0.9, 6);
      limb.translate(0, r * 0.45, 0);
      limb.rotateZ(0.6 + rand() * 0.3);
      limb.rotateY((i / 3) * Math.PI * 2 + rand());
      limb.translate(0, TRUNK + r * 0.15, 0);
      bark.push(limb);
    }
    const geo = mergeGeometries(bark);
    bark.forEach((g) => g.dispose());
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 0.95 }));
    m.castShadow = true;
    group.add(m);
  }
  blobs.forEach((list, i) => {
    if (!list.length) return;
    const geo = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: leafColors[i], roughness: 0.85, flatShading: true }));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  return group;
}
