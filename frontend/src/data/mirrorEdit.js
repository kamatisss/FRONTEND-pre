// "Mirror my changes" (Symmetrical designs): the engine plants mirrored pairs at (x, z) and (W − x, z)
// (layout_engine._symmetrical). When the customer changes one plant of a pair, the same change is made
// to its partner on the other side, so the design stays symmetrical: move (reflected), turn (reflected:
// 360° − angle), swap (same new plant) and remove. One edit at a time; adding and Tidy aren't mirrored.

const PAIR_TOLERANCE = 0.15;   // m: how close to the reflected spot a partner must be
const AXIS_GAP = 0.3;          // m: a plant moved onto the centre line has no room for a mirror image

const live = (p) => !p.is_existing;

/** The mirror partner of `plant` in `plants` (same plant, reflected spot), or null. */
export function partnerOf(plant, plants, width) {
  if (!plant || !live(plant) || Math.abs(Number(plant.x) - width / 2) < PAIR_TOLERANCE) return null;   // on the axis: its own mirror
  const mx = width - Number(plant.x), z = Number(plant.z);
  let best = null, bestD = PAIR_TOLERANCE;
  plants.forEach((q) => {
    if (q === plant || q.uid === plant.uid || !live(q) || String(q.plant_id) !== String(plant.plant_id)) return;
    const d = Math.hypot(Number(q.x) - mx, Number(q.z) - z);
    if (d <= bestD) { best = q; bestD = d; }
  });
  return best;
}

/**
 * prev → next is one customer edit. Returns { plants, partner } with the partner changed the same way,
 * or { plants: next, partner: null } when there is nothing to mirror (no partner, several items changed,
 * an item added, or a plant moved onto the centre line).
 */
export function mirrorEdit(prev, next, width) {
  const none = { plants: next, partner: null };
  const before = new Map(prev.filter(live).map((p) => [p.uid, p]));
  const after = new Map(next.filter(live).map((p) => [p.uid, p]));
  const changed = [...before.keys()].filter((u) => {
    const a = before.get(u), b = after.get(u);
    return !b || String(a.plant_id) !== String(b.plant_id) || a.x !== b.x || a.z !== b.z || (a.rotation || 0) !== (b.rotation || 0);
  });
  if (changed.length !== 1 || [...after.keys()].some((u) => !before.has(u))) return none;
  const uid = changed[0];
  const old = before.get(uid), now = after.get(uid);
  const partner = partnerOf(old, prev, width);
  if (!partner || (now && changed.includes(partner.uid))) return none;

  if (!now) return { plants: next.filter((p) => p.uid !== partner.uid), partner };   // removed: remove both
  let update = {};
  if (String(old.plant_id) !== String(now.plant_id)) update.plant_id = now.plant_id;   // swapped
  if (old.x !== now.x || old.z !== now.z) {
    if (Math.abs(Number(now.x) - width / 2) < AXIS_GAP) return none;   // onto the centre line: leave the partner
    update = { ...update, x: Math.round((width - Number(now.x)) * 1000) / 1000, z: now.z };
  }
  if ((old.rotation || 0) !== (now.rotation || 0)) update.rotation = (360 - (Number(now.rotation) || 0)) % 360;
  return { plants: next.map((p) => (p.uid === partner.uid ? { ...p, ...update } : p)), partner };
}
