import { stageSpread, stageSize, stageYears, GROWN } from './modelSizing';

// ─── Crowding: crowns that will grow into each other ──────────────────────────
// The AI layout spaces plants for good looks when grown (layout_engine.spacing_for), and lets crowns knit
// together on purpose: a bed of fillers, a bamboo screen. Where a TREE, PALM or BIG SHRUB grows into its
// neighbour, though, the customer will be trimming it every year, so the 3D views point it out for the year
// on the "Show plants" slider: an amber ring and a note on the plant's card. Advice only, never blocking.
//
// A pair is noted when, at that year:
//   - their crowns (each plant's width at that year, data/modelSizing.stageSpread) overlap by more than
//     CROWD_SHARE of the smaller crown's width,
//   - and at least one of them is CROWD_TALL or taller (low plants growing together is the look we want),
//   - and they are not two of the same "structure" plant (a screen or a row is meant to close up),
//   - and the lower one is not UNDERSTOREY: under CROWD_UNDER of the other's height it grows beneath that
//     crown (peace lilies under a palm, ferns under a tree), which is ordinary underplanting; whether it
//     gets enough light there is the sun check's job (backend layout_engine sun_suits / under_canopy).
// Plants with no width on record are left out (nothing to measure). Groundcover is a carpet, not plants.
export const CROWD_SHARE = 0.25;   // crowns touching is normal; a quarter of one grown into the other means pruning
export const CROWD_TALL = 2.5;   // m
export const CROWD_UNDER = 0.4;  // share of the taller plant's height

const m1 = (v) => `${(Math.round(v * 10) / 10).toFixed(1)} m`;
const when = (years) => (years >= GROWN ? 'When fully grown,' : `In ${years} ${years === 1 ? 'year' : 'years'},`);

/**
 * plants: [{ key, x, z, product, vary?: {h, w}, scale?, stage? }] (product = the catalog item; vary = this
 * plant's own size, data/modelSizing.plantVariation; scale = a Studio item's own scale; stage = this plant's own
 * stage when it differs, e.g. a specimen-size plant ahead on its curve, data/modelSizing.sizedStage).
 * → Map key → [note] for the plants that crowd a neighbour at this stage (years after planting).
 */
export function crowdingNotes(plants, stage) {
  const { years, list, worst } = crowdingPairs(plants, stage);
  const out = new Map();
  worst.forEach(({ other, overlap, need, count }, key) => {
    const self = list.find((p) => p.key === key);
    const them = self && other.prod.id === self.prod.id ? `another ${other.prod.name}` : `the ${other.prod.name}`;
    out.set(key, [
      `${when(years)} its crown and ${them}'s next to it overlap by about ${m1(overlap)}. `
      + `Plan a yearly trim, or plant them about ${m1(need)} apart.`
      + (count > 1 ? ` It crowds ${count - 1} more ${count - 1 === 1 ? 'plant' : 'plants'} too.` : ''),
    ]);
  });
  return out;
}

/**
 * The same check, for "Move apart" in the 3D Studio: per crowding plant, the neighbour it crowds most and the
 * centre-to-centre distance at which they stop crowding at this year.
 * → Map key → { other: { key, x, z, name }, need (m), overlap (m), count }
 */
export function crowdingNeighbours(plants, stage) {
  const out = new Map();
  crowdingPairs(plants, stage).worst.forEach(({ other, need, overlap, count }, key) => {
    out.set(key, { other: { key: other.key, x: other.x, z: other.z, name: other.prod.name }, need, overlap, count });
  });
  return out;
}

// Each crowding plant's worst neighbour at this stage: { years, list, worst: Map key → { other, overlap, need, count } }
function crowdingPairs(plants, stage) {
  const years = stageYears(stage);
  const worst = new Map();
  if (!(years > 0) || !Array.isArray(plants)) return { years, list: [], worst };

  const list = [];
  plants.forEach((p) => {
    const prod = p?.product;
    if (!prod || (prod.category || 'plant') !== 'plant' || prod.is_groundcover) return;
    const x = Number(p.x), z = Number(p.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const s = Number(p.scale) > 0 ? Number(p.scale) : 1;
    const v = p.vary || { h: 1, w: 1 };
    const own = p.stage ?? years;
    const w = stageSpread(prod, own, 'plant') * v.w * s;
    if (!(w > 0)) return;
    const h = (Number(stageSize(prod, own, 'plant')) || 0) * v.h * s;
    list.push({ key: p.key, x, z, prod, w, h });
  });

  // Per plant: its worst neighbour, and how many it crowds
  const note = (a, b, overlap, need) => {
    const cur = worst.get(a.key);
    if (!cur) worst.set(a.key, { other: b, overlap, need, count: 1 });
    else {
      cur.count += 1;
      if (overlap > cur.overlap) Object.assign(cur, { other: b, overlap, need });
    }
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const small = Math.min(a.w, b.w);
      const overlap = (a.w + b.w) / 2 - Math.hypot(a.x - b.x, a.z - b.z);
      if (overlap <= CROWD_SHARE * small) continue;
      if (Math.max(a.h, b.h) < CROWD_TALL) continue;
      if (Math.min(a.h, b.h) < CROWD_UNDER * Math.max(a.h, b.h)) continue;   // grows under the crown
      if (a.prod.id === b.prod.id && a.prod.design_role === 'structure') continue;
      // Far enough apart that they only just touch at this year (rounded up to 10 cm)
      const need = Math.ceil(((a.w + b.w) / 2 - CROWD_SHARE * small) * 10) / 10;
      note(a, b, overlap, need);
      note(b, a, overlap, need);
    }
  }
  return { years, list, worst };
}
