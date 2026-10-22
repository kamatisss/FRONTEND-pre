// The landing page's sample garden, built from real catalog plants so it can be
// opened in the 3D Studio and customised (the "continuity" between hero and Studio).

export const SAMPLE_LOT = { width: 10, length: 8 };

// The same three styles the AI Designer produces (BACKEND layout_engine.STYLES), so what
// visitors preview on the landing page matches what the AI later designs for them.
export const SAMPLE_STYLES = [
  { key: 'lush',        label: 'Lush',        hint: 'Layered and full: tall at the back, colour at the front' },
  { key: 'symmetrical', label: 'Symmetrical', hint: 'Mirrored and formal around a centre line' },
  { key: 'minimalist',  label: 'Minimalist',  hint: 'One focal plant, small groups, lots of open lawn' },
];

// Plants are picked by size (tall / mid / low), not by name, so new catalog plants just work.
// Returns the ThreeGardenCanvas shape ({ plant_id, x, z, rotation° }) in lot coordinates.
export function sampleGarden(plants, style = 'lush') {
  const usable = plants.filter(p => p.model_file).sort((a, b) => (b.real_world_size || 1) - (a.real_world_size || 1));
  if (!usable.length) return [];
  const tallest = (i) => usable[Math.min(i, usable.length - 1)];
  const small = usable.slice(-3);
  const low = (i) => small[i % small.length];
  const W = SAMPLE_LOT.width;

  let spots;
  if (style === 'symmetrical') {
    // Mirrored pairs around x = W/2, with a single focal plant on the axis
    const half = [[1.4, 1.4, tallest(0)], [2.6, 4.2, tallest(2)], [1.8, 6.8, low(0)], [3.8, 6.8, low(1)]];
    spots = [[W / 2, 1.8, tallest(1)], ...half.flatMap(([x, z, p]) => [[x, z, p], [W - x, z, p]])];
    // Mirrored rotations too, so the pairs really read as reflections
    return spots.map(([x, z, plant]) => ({ plant_id: String(plant.id), x, z, rotation: x < W / 2 ? 30 : x > W / 2 ? 330 : 0 }));
  }
  if (style === 'minimalist') {
    // One focal plant on a third, an odd-numbered low group, open lawn everywhere else
    spots = [[W / 3, 2.6, tallest(0)], [8.4, 2.2, tallest(2)], [7.2, 5.4, low(0)], [7.8, 6.1, low(0)], [6.7, 6.2, low(0)]];
  } else {
    // Lush: tallest at the back, layered sides, a low border at the front
    spots = [
      [2, 1.5, tallest(0)], [5, 1.2, tallest(1)], [8, 1.5, tallest(0)],   // back row
      [1.5, 4, tallest(2)], [8.5, 4, tallest(2)],                         // sides
      [3, 6.5, low(0)], [5, 6.8, low(1)], [7, 6.5, low(2)],               // front border
    ];
  }
  return spots.map(([x, z, plant], i) => ({ plant_id: String(plant.id), x, z, rotation: (i * 47) % 360 }));
}

// Any lot-coordinate layout (hero sample, AI Designer results) as Studio placed items.
// The Studio's flat terrain is centred on the origin with the ground at y = 0, and its
// rotations are in radians. Existing-feature markers and unknown plants are skipped.
export function lotPlantsToStudioItems(layout, products, width, length) {
  const byId = new Map(products.map(p => [String(p.id), p]));
  const now = Date.now();
  return layout.map((s, i) => {
    const p = !s.is_existing && byId.get(String(s.plant_id));
    if (!p) return null;
    return {
      id: now + i,
      productId: p.id,
      name: p.name,
      model_file: p.model_file || null,
      thumbnail: p.thumbnail || null,
      unit_price: Number(p.unit_price),
      position: { x: Number(s.x) - width / 2, y: 0, z: Number(s.z) - length / 2 },
      rotation: { x: 0, y: ((Number(s.rotation) || 0) * Math.PI) / 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
  }).filter(Boolean);
}

export const sampleToStudioItems = (sample, plants) =>
  lotPlantsToStudioItems(sample, plants, SAMPLE_LOT.width, SAMPLE_LOT.length);
