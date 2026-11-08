// What the customer changed on an AI design in the 3D view, compared with the AI's own version
// (AI Designer → booking: saved as dimensions.customerEdits). Staff and crew see it on the booking,
// so they know the plan on site is the customer's, not the engine's.

/** { moved, turned, swapped, added, removed, notesLeft } for an edited layout, or null if unchanged. */
export function editSummary(layout) {
  if (!layout?.edited || !layout.original) return null;
  const items = (list) => (list || []).filter(p => !p.is_existing);
  const before = new Map(items(layout.original.plants).map(p => [p.uid, p]));
  const now = items(layout.plants);
  const out = { moved: 0, turned: 0, swapped: 0, added: 0, removed: 0, notesLeft: (layout.notes || []).length };
  const kept = new Set();
  now.forEach(p => {
    const o = before.get(p.uid);
    if (!o) { out.added += 1; return; }
    kept.add(p.uid);
    if (String(o.plant_id) !== String(p.plant_id)) out.swapped += 1;
    if (Math.hypot(Number(o.x) - Number(p.x), Number(o.z) - Number(p.z)) > 0.05) out.moved += 1;
    if ((Number(o.rotation) || 0) !== (Number(p.rotation) || 0)) out.turned += 1;
  });
  out.removed = [...before.keys()].filter(u => !kept.has(u)).length;
  return out;
}

/** "moved 3, removed 1, added 2" (empty string when nothing changed). */
export function describeEdits(e) {
  if (!e) return '';
  return [['moved', e.moved], ['turned', e.turned], ['swapped', e.swapped], ['added', e.added], ['removed', e.removed]]
    .filter(([, n]) => n > 0).map(([verb, n]) => `${verb} ${n}`).join(', ');
}
