/**
 * Design tips for the 3D Studio: the planting rules a garden designer follows (the AI Designer's engine applies them
 * itself), as gentle suggestions while the customer places plants by hand — never blocking, at most a few at a time.
 *
 *  - a focal point (one taller specimen)          - odd-numbered groups, not singles or pairs scattered about
 *  - repetition (the same plant on both sides)    - layers (low plants in front of taller ones)
 *  - groundcover over bare beds                   - a calm palette (fewer kinds, repeated)
 *
 * placed: the Studio's placedItems (positions centred on the lot); products: the catalog. → [{ id, text }]
 */
import { grownHeight, layoutLayer } from './pricing';

const TALL = 2.4;

export function designTips(placed, products, { ground = null, lotWidth = 10 } = {}) {
  const byId = new Map((products || []).map(p => [p.id, p]));
  const plants = (placed || []).map(i => ({ i, p: byId.get(i.productId) }))
    .filter(({ p }) => p && p.category === 'plant' && !p.is_groundcover);
  const tips = [];
  if (plants.length < 3) return tips;
  const groups = new Map();
  plants.forEach(({ i, p }) => {
    const g = groups.get(p.id) || { p, items: [] };
    g.items.push(i);
    groups.set(p.id, g);
  });
  const mirrored = (items) => items.every(a => items.some(b => b !== a
    && Math.abs((Number(a.position?.x) || 0) + (Number(b.position?.x) || 0)) < 0.3
    && Math.abs((Number(a.position?.z) || 0) - (Number(b.position?.z) || 0)) < 0.3));
  const short = (name) => String(name || 'plant').split(' (')[0];

  // A focal point
  if (plants.length >= 4 && !plants.some(({ p }) => grownHeight(p) >= TALL)) {
    tips.push({ id: 'focal', text: 'Add one taller plant as a focal point, such as a Christmas Palm or Plumeria at the back, where the eye lands from the house.' });
  }
  // Singles and even numbers (small plants: one tree or a pair at a gate is fine)
  for (const { p, items } of groups.values()) {
    if (layoutLayer(p) === 'tall') continue;
    const n = items.length;
    if (n === 1) {
      tips.push({ id: `single-${p.id}`, text: `A single ${short(p.name)} looks lost: plant it in a group of 3 or 5 (choose ×3 when placing).` });
    } else if ((n === 2 || n === 4) && !mirrored(items)) {
      tips.push({ id: `even-${p.id}`, text: `Odd numbers look more natural: try ${n + 1} ${short(p.name)} instead of ${n}.` });
    }
  }
  // Repetition: a plant used on one side only
  if (lotWidth >= 6) {
    for (const { p, items } of groups.values()) {
      if (items.length < 3) continue;
      const left = items.filter(i => (Number(i.position?.x) || 0) < -0.5).length;
      const right = items.filter(i => (Number(i.position?.x) || 0) > 0.5).length;
      if ((left === 0) !== (right === 0)) {
        tips.push({ id: `repeat-${p.id}`, text: `Repeat some ${short(p.name)} on the other side too: the same plant in two places ties a garden together.` });
        break;
      }
    }
  }
  // Layers
  const layers = new Set(plants.map(({ p }) => layoutLayer(p)));
  if (!layers.has('low') && (layers.has('tall') || layers.has('mid')) && plants.length >= 4) {
    tips.push({ id: 'layers', text: 'Add low plants in front of the taller ones, so the beds step down towards the lawn.' });
  }
  // Bare beds
  if (ground && !ground.on && ground.available && ground.bedArea >= 4) {
    tips.push({ id: 'groundcover', text: `About ${Math.round(ground.bedArea)} m² of bare soil between your plants: switch on groundcover (Lot ▸ Groundcover in the beds).` });
  }
  // A calm palette
  if (groups.size > 7 && plants.length < groups.size * 3) {
    tips.push({ id: 'palette', text: `${groups.size} different plants is a lot for this garden: fewer kinds, each repeated, look calmer and more designed.` });
  }
  return tips;
}
