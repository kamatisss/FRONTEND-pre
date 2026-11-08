import * as THREE from 'three';

// ─── Growing part by part ──────────────────────────────────────────────────────
// Uniform scaling makes a young plant a toy copy of the adult. These profiles grow the parts of
// multi-part models the way the plant grows (models with one mesh keep simple scaling):
//   stem:   materials of the trunk. A Christmas palm (Adonidia) gets taller by its TRUNK: its crown is
//           nearly full size when young and changes little after, and the trunk thickens only a little.
//   later:  parts that only appear from a stage on (flowers, fruit), with the note the height card shows.
//           A banana planted as a young sucker has no fruit yet; a young heliconia clump no flowers yet.
//           Plumeria and peace lily are kept flowering: nurseries usually sell them in flower.
// Checked against the part names in the .glb files (2026-11-08).
const PROFILES = {
  'christmas_palm.glb': {
    stem: ['Ardonidia_trunk'],
    crownGrowth: 0.25,    // crown size ∝ (height ratio)^0.25: 0.89× at planting, 1.13× fully grown
    stemThicken: 0.15,    // trunk thickness ∝ (height ratio)^0.15
  },
  'banana_tree.glb': {
    later: { materials: ['Buah_gedang', 'Ontong'], from: 'established',
      note: 'No fruit yet: a banana fruits about 9–12 months after planting.' },
  },
  'heliconia_rostrata.glb': {
    later: { materials: ['flower'], from: 'established',
      note: 'No flowers yet: heliconia usually flowers from about its first year.' },
  },
};

const ORDER = { planting: 0, established: 1, mature: 2 };
const fileOf = (url) => decodeURIComponent(String(url || '').split('?')[0].split('/').pop() || '');
const matsOf = (m) => (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x?.name || '');

/** True when this model changes shape with growth (needs measuring per stage, not a plain scale). */
export const growsByParts = (url) => !!PROFILES[fileOf(url)]?.stem;

/** The height card's note for a stage (e.g. no fruit yet), or ''. */
export function growthNote(url, stage) {
  const later = PROFILES[fileOf(url)]?.later;
  return later && (ORDER[stage] ?? 1) < ORDER[later.from] ? later.note : '';
}

/**
 * Rig a model (a clone, never the shared template) for growing by parts. Call after plantOut and before
 * any root scale or position. Returns null when the model has no profile, else { pose(ratio, stage) }:
 * ratio = this stage's height ÷ the established height. pose() reshapes the parts in the model's own
 * units (the caller then measures and sizes it as usual) and shows or hides parts for the stage.
 */
export function rigGrowth(object, url) {
  const profile = PROFILES[fileOf(url)];
  if (!profile) return null;
  object.updateMatrixWorld(true);
  const meshes = [];
  object.traverse((m) => { if (m.isMesh) meshes.push(m); });
  const later = profile.later ? meshes.filter((m) => matsOf(m).some((n) => profile.later.materials.includes(n))) : [];

  let stemPivot = null, crownPivot = null, stemH = 0, crownAbove = 0, ground = 0;
  if (profile.stem) {
    const stem = meshes.filter((m) => matsOf(m).some((n) => profile.stem.includes(n)));
    const crown = meshes.filter((m) => !stem.includes(m));
    if (stem.length && crown.length) {
      const all = new THREE.Box3().setFromObject(object, true);
      const stemBox = new THREE.Box3();
      stem.forEach((m) => stemBox.union(new THREE.Box3().setFromObject(m, true)));
      const cx = (all.min.x + all.max.x) / 2, cz = (all.min.z + all.max.z) / 2;
      // Pivots: the trunk grows up from the ground; the crown sits on the trunk's top and grows about it
      stemPivot = new THREE.Group();
      stemPivot.position.set(cx, all.min.y, cz);
      crownPivot = new THREE.Group();
      crownPivot.position.set(cx, stemBox.max.y, cz);
      object.add(stemPivot, crownPivot);
      object.updateMatrixWorld(true);
      stem.forEach((m) => stemPivot.attach(m));
      crown.forEach((m) => crownPivot.attach(m));
      stemH = stemBox.max.y - all.min.y;
      // Total height at established = stemH + (crown above the trunk top)
      crownAbove = all.max.y - stemBox.max.y;
      ground = all.min.y;
    }
  }

  return {
    pose(ratio, stage) {
      const r = Number(ratio) > 0 ? Number(ratio) : 1;
      if (stemPivot && crownPivot) {
        const crownS = Math.pow(r, profile.crownGrowth ?? 0.25);
        const thick = Math.pow(r, profile.stemThicken ?? 0.15);
        const total = (stemH + crownAbove) * r;               // the stage's height, model units
        const newStem = Math.max(stemH * 0.15, total - crownAbove * crownS);
        stemPivot.scale.set(thick, newStem / stemH, thick);
        crownPivot.scale.setScalar(crownS);
        crownPivot.position.y = ground + newStem;
      }
      const show = (ORDER[stage] ?? 1) >= ORDER[profile.later?.from ?? 'planting'];
      later.forEach((m) => { m.visible = show; });
      object.updateMatrixWorld(true);
    },
  };
}

/** Bounds of a rigged model in its own units (root transform ignored), visible parts only. */
export function rigBounds(object) {
  const pos = object.position.clone(), scale = object.scale.clone(), rot = object.rotation.clone();
  object.position.set(0, 0, 0); object.scale.set(1, 1, 1); object.rotation.set(0, 0, 0);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  object.traverse((m) => { if (m.isMesh && m.visible) box.union(new THREE.Box3().setFromObject(m, true)); });
  object.position.copy(pos); object.scale.copy(scale); object.rotation.copy(rot);
  object.updateMatrixWorld(true);
  return box;
}
