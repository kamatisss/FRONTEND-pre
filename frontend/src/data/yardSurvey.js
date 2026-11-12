// Mark your yard (YardSurvey.jsx; backend site_survey.py): what's already in the customer's yard, in lot
// metres — x 0..W left → right, z 0..L with z = 0 the BACK of the yard and z = L the front (house side).
//   clear  {x0, z0, x1, z1, label}  nothing is planted there (path, driveway, patio, septic, meter…)
//   keep   {x, z, r, label}         an existing tree or plant that stays (r = canopy radius)
//   entry  {x, z, edge}             gate or door on an edge
//   screen {edge, a, b}             stretch of fence / wall to hide (a..b metres along that edge of the box), or
//          {edge, x0, z0, x1, z1}   on a shaped yard, that stretch of its outline (edge = the side it faces)
//   view   {x0, z0, x1, z1}         keep the view open (low plants only)
// and survey.sun = { facing, house } (or null): which way the back of the yard faces (compass degrees, seen
// from the house) and how tall the house is — the engine works out sun and shade spot by spot (sun_map.py).

export const SURVEY_TOOLS = [
  { kind: 'clear',  label: 'Keep clear',  hint: 'Drag a box over a path, driveway, patio, septic tank or meter. Tap for a small 1 m spot.', color: '#64748b' },
  { kind: 'keep',   label: 'Keep a tree', hint: 'Tap the trunk of a tree or a plant that stays. Pick its size first.', color: '#16a34a' },
  { kind: 'entry',  label: 'Gate / door', hint: 'Tap where people come into the garden: a gate, or the door from the house.', color: '#2563eb' },
  { kind: 'screen', label: 'Hide this',   hint: 'Drag along a fence or wall you want hidden behind tall plants.', color: '#9333ea' },
  { kind: 'view',   label: 'Keep a view', hint: 'Drag a box where only low plants should grow, e.g. in front of a window.', color: '#0891b2' },
];
export const toolOf = (kind) => SURVEY_TOOLS.find(t => t.kind === kind);

export const KEEP_SIZES = [
  { r: 0.75, label: 'Shrub', sub: '1.5 m wide' },
  { r: 1.5, label: 'Small tree', sub: '3 m wide' },
  { r: 3, label: 'Big tree', sub: '6 m wide' },
];
export const CLEAR_LABELS = ['Path', 'Driveway', 'Patio', 'Septic / tank', 'Water meter', 'Other'];
export const MAX_SURVEY_ITEMS = 40;

export const emptySurvey = () => ({ items: [], sun: null });

// Compass points for "Which way does the back of your yard face?", laid out as a compass rose (row, col)
export const FACINGS = [
  { deg: 315, label: 'NW', row: 0, col: 0 }, { deg: 0, label: 'N', row: 0, col: 1 }, { deg: 45, label: 'NE', row: 0, col: 2 },
  { deg: 270, label: 'W', row: 1, col: 0 }, { deg: 90, label: 'E', row: 1, col: 2 },
  { deg: 225, label: 'SW', row: 2, col: 0 }, { deg: 180, label: 'S', row: 2, col: 1 }, { deg: 135, label: 'SE', row: 2, col: 2 },
];
const COMPASS_NAMES = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compassName = (deg) => COMPASS_NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
export const HOUSE_OPTIONS = [
  { key: 'none', label: 'No house beside it' }, { key: 'one', label: 'One storey' }, { key: 'two', label: 'Two storeys' },
];
// Sun & shade layer: colour per hours of direct sun (backend sun_map classes: 6 h+ full sun, under 3 h shade)
export const SUN_LEGEND = [
  { key: 'full_sun', label: 'Full sun', sub: '6 h+', color: '#f59e0b' },
  { key: 'partial_shade', label: 'Part shade', sub: '3–6 h', color: '#a3e635' },
  { key: 'full_shade', label: 'Shade', sub: 'under 3 h', color: '#2563eb' },
];
export const sunColor = (hours, classes = { full_sun: 6, shade: 3 }) =>
  SUN_LEGEND[hours >= classes.full_sun ? 0 : hours >= classes.shade ? 1 : 2].color;
let seq = 0;
export const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clampPoint = (p, W, L) => ({ x: clamp(p.x, 0, W), z: clamp(p.z, 0, L) });

/** The lot edge nearest a point: { edge, along (m from the edge's start), x, z (on the edge) }. */
export function nearestEdge(p, W, L) {
  const c = [
    { edge: 'back', d: p.z, along: p.x, x: p.x, z: 0 },
    { edge: 'front', d: L - p.z, along: p.x, x: p.x, z: L },
    { edge: 'left', d: p.x, along: p.z, x: 0, z: p.z },
    { edge: 'right', d: W - p.x, along: p.z, x: W, z: p.z },
  ];
  return c.reduce((best, e) => (e.d < best.d ? e : best));
}
/** How far along an edge a point is (its projection onto that edge). */
export const alongEdge = (edge, p) => (edge === 'back' || edge === 'front' ? p.x : p.z);
export const edgeLength = (edge, W, L) => (edge === 'back' || edge === 'front' ? W : L);
/** A point at `t` metres along an edge, `inset` metres inside the lot. */
export function edgePoint(edge, t, W, L, inset = 0) {
  if (edge === 'back') return { x: t, z: inset };
  if (edge === 'front') return { x: t, z: L - inset };
  if (edge === 'left') return { x: inset, z: t };
  return { x: W - inset, z: t };
}
const EDGE_NAMES = { back: 'back', front: 'front (house side)', left: 'left side', right: 'right side' };

/** Ground outline of an item, densely sampled so it projects onto a photo correctly. */
export function outline(item, W, L) {
  const pts = [];
  if (item.kind === 'clear' || item.kind === 'view') {
    const c = [[item.x0, item.z0], [item.x1, item.z0], [item.x1, item.z1], [item.x0, item.z1]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
      for (let k = 0; k < 8; k++) pts.push({ x: ax + ((bx - ax) * k) / 8, z: az + ((bz - az) * k) / 8 });
    }
    return { closed: true, pts };
  }
  if (item.kind === 'keep') {
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      pts.push({ x: item.x + Math.cos(a) * item.r, z: item.z + Math.sin(a) * item.r });
    }
    return { closed: true, pts };
  }
  if (item.kind === 'screen' && item.x0 !== undefined) {
    for (let k = 0; k <= 12; k++) pts.push({ x: item.x0 + ((item.x1 - item.x0) * k) / 12, z: item.z0 + ((item.z1 - item.z0) * k) / 12 });
    return { closed: false, pts };
  }
  if (item.kind === 'screen') {
    for (let k = 0; k <= 12; k++) pts.push(edgePoint(item.edge, item.a + ((item.b - item.a) * k) / 12, W, L, 0.15));
    return { closed: false, pts };
  }
  return { closed: false, pts: [{ x: item.x, z: item.z }] };
}

/** Where to put an item's label (ground point). */
export function labelPoint(item, W, L) {
  if (item.kind === 'clear' || item.kind === 'view') return { x: (item.x0 + item.x1) / 2, z: (item.z0 + item.z1) / 2 };
  if (item.kind === 'screen' && item.x0 !== undefined) return { x: (item.x0 + item.x1) / 2, z: (item.z0 + item.z1) / 2 };
  if (item.kind === 'screen') return edgePoint(item.edge, (item.a + item.b) / 2, W, L, 0.6);
  return { x: item.x, z: item.z };
}

const m = (v) => `${Number(v).toFixed(1)} m`;
/** One line for the list under the map. */
export function describe(item) {
  if (item.kind === 'clear') return `${item.label || 'Keep clear'} · ${m(item.x1 - item.x0)} × ${m(item.z1 - item.z0)}`;
  if (item.kind === 'view') return `Keep a view · ${m(item.x1 - item.x0)} × ${m(item.z1 - item.z0)}`;
  if (item.kind === 'keep') return `${item.label || 'Tree or plant to keep'} · about ${m(item.r * 2)} wide`;
  if (item.kind === 'entry') return `Gate / door on the ${EDGE_NAMES[item.edge]}`;
  const len = item.x0 !== undefined ? Math.hypot(item.x1 - item.x0, item.z1 - item.z0) : item.b - item.a;
  return `Hide the ${EDGE_NAMES[item.edge]} · ${m(len)} of it`;
}

// ── The yard's shape (survey.outline: [{x, z, house}] corners in order; side i runs from corner i to i + 1 and
// `house` marks it as a house wall). null = the whole W × L box. Backend lot_shape.py checks the same rules.
export const polygonArea = (pts) => Math.abs(pts.reduce((s, a, i) => {
  const b = pts[(i + 1) % pts.length];
  return s + a.x * b.z - b.x * a.z;
}, 0)) / 2;
/** The yard's real area in m² (pricing). */
export const yardArea = (survey, W, L) => (survey?.outline?.length >= 3 ? polygonArea(survey.outline) : Number(W) * Number(L));

const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** The yard as corners: its own outline, or the W × L box (house side z = L). */
export const yardPolygon = (survey, W, L) => (survey?.outline?.length >= 3 ? survey.outline
  : [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: L, house: true }, { x: 0, z: L }]);
/** Sides as [{ i, a, b, house }] (side i runs from corner i to corner i + 1). */
export const sidesOf = (pts) => pts.map((a, i) => ({ i, a, b: pts[(i + 1) % pts.length], house: !!a.house }));

export function insidePolygon(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z)) inside = !inside;
  }
  return inside;
}
/** Nearest point on side a→b: { x, z, t (0..1), d }. */
export function onSide(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 < 1e-12 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  const x = a.x + t * dx, z = a.z + t * dz;
  return { x, z, t, d: Math.hypot(p.x - x, p.z - z) };
}
/** The side of the yard nearest a point: { side, x, z, t, d }. */
export function nearestSide(pts, p) {
  return sidesOf(pts).map(side => ({ side, ...onSide(p, side.a, side.b) })).reduce((best, c) => (c.d < best.d ? c : best));
}
/** Unit normal of a side pointing into the yard. */
export function inwardNormal(pts, a, b) {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
  const m = { x: (a.x + b.x) / 2 + n.x * 0.05, z: (a.z + b.z) / 2 + n.z * 0.05 };
  return insidePolygon(pts, m.x, m.z) ? n : { x: -n.x, z: -n.z };
}
/** Which side of the lot a stretch of the outline is on (backend lot_shape.facing). */
export function facingOf(pts, a, b) {
  const n = inwardNormal(pts, a, b);
  if (Math.abs(n.z) >= Math.abs(n.x)) return n.z > 0 ? 'back' : 'front';
  return n.x > 0 ? 'left' : 'right';
}
const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
/** No two sides cross (backend lot_shape.is_simple). */
export function isSimplePolygon(pts) {
  const s = sidesOf(pts), n = s.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const { a: p1, b: p2 } = s[i], { a: p3, b: p4 } = s[j];
      if (orient(p1, p2, p3) * orient(p1, p2, p4) < 0 && orient(p3, p4, p1) * orient(p3, p4, p2) < 0) return false;
    }
  }
  return true;
}
/** Why a shape can't be used, or '' (mirrors lot_shape.clean). */
export function shapeProblem(pts) {
  if (!pts || pts.length < 3) return 'A yard needs at least 3 corners.';
  if (pts.some((p, i) => near(p, pts[(i + 1) % pts.length]) < 0.3)) return 'Two corners are on top of each other: move one apart.';
  if (!isSimplePolygon(pts)) return "The sides cross over each other. Move the corners so they don't.";
  if (polygonArea(pts) < 2) return 'The yard shape is too small.';
  return '';
}

// Common yard shapes to start from (then drag the corners). House side is z = L; `house` marks house walls.
const r1 = (v) => Math.round(v * 10) / 10;
export const SHAPE_PRESETS = [
  { key: 'rect', label: 'Rectangle', make: () => null },
  { key: 'l_right', label: 'L · house at front right', make: (W, L) => {
    const a = r1(W * 0.4), c = r1(L * 0.4);
    return [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: L - c, house: true }, { x: W - a, z: L - c, house: true },
      { x: W - a, z: L }, { x: 0, z: L }];   // the house takes the corner: its two walls; the rest of the front is a fence
  } },
  { key: 'l_left', label: 'L · house at front left', make: (W, L) => {
    const a = r1(W * 0.4), c = r1(L * 0.4);
    return [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: L }, { x: a, z: L, house: true },
      { x: a, z: L - c, house: true }, { x: 0, z: L - c }];
  } },
  { key: 'narrow_back', label: 'Narrower at the back', make: (W, L) => [
    { x: r1(W * 0.2), z: 0 }, { x: r1(W * 0.8), z: 0 }, { x: W, z: L, house: true }, { x: 0, z: L }] },
  { key: 'narrow_house', label: 'Narrower at the house', make: (W, L) => [
    { x: 0, z: 0 }, { x: W, z: 0 }, { x: r1(W * 0.8), z: L, house: true }, { x: r1(W * 0.2), z: L }] },
  { key: 'cut_right', label: 'Cut corner · back right', make: (W, L) => [
    { x: 0, z: 0 }, { x: r1(W * 0.65), z: 0 }, { x: W, z: r1(L * 0.35) }, { x: W, z: L, house: true }, { x: 0, z: L }] },
  { key: 'cut_left', label: 'Cut corner · back left', make: (W, L) => [
    { x: 0, z: r1(L * 0.35) }, { x: r1(W * 0.35), z: 0 }, { x: W, z: 0 }, { x: W, z: L, house: true }, { x: 0, z: L }] },
];
/** Keep corners inside the box when the lot size changes (null stays null). */
export const fitOutline = (outline, W, L) => (outline ? outline.map(p => ({ ...p, x: clamp(p.x, 0, W), z: clamp(p.z, 0, L) })) : null);
