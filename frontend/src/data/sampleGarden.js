// The landing page's sample garden, built from real catalog plants so it can be
// opened in the 3D Studio and customised (the "continuity" between hero and Studio).

export const SAMPLE_LOT = { width: 10, length: 8 };

// Tallest plants at the back, a low border at the front. Returns the
// ThreeGardenCanvas shape ({ plant_id, x, z, rotation° }) in lot coordinates.
export function sampleGarden(plants) {
  const usable = plants.filter(p => p.model_file).sort((a, b) => (b.real_world_size || 1) - (a.real_world_size || 1));
  if (!usable.length) return [];
  const tallest = (i) => usable[Math.min(i, usable.length - 1)];
  const small = usable.slice(-3);
  const spots = [
    [2, 1.5, tallest(0)], [5, 1.2, tallest(1)], [8, 1.5, tallest(0)],                       // back row
    [1.5, 4, tallest(2)], [8.5, 4, tallest(2)],                                               // sides
    [3, 6.5, small[0]], [5, 6.8, small[1 % small.length]], [7, 6.5, small[2 % small.length]], // front border
  ];
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
      scale: { x: 0.8, y: 0.8, z: 0.8 },
    };
  }).filter(Boolean);
}

export const sampleToStudioItems = (sample, plants) =>
  lotPlantsToStudioItems(sample, plants, SAMPLE_LOT.width, SAMPLE_LOT.length);
