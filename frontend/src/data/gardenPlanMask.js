/*
 * The AI Designer's garden plan (beds around an open lawn, see backend layout_engine.GardenPlan) as an
 * alpha mask for the 3D Studio: white = planting bed (mulch shown), black = lawn and the entry gap
 * (the grass shows through). Drawn in plan coordinates: x 0..width left → right, z 0..length with
 * z = 0 the BACK of the lot. On a PlaneGeometry laid flat (rotateX −90°) a canvas texture's top row
 * lands at the back, so canvas (px, py) = plan (x, z) × pixels per metre.
 */
const MAX_PX = 1024;

export function planMaskCanvas(plan, width, length) {
  if (!plan?.lawn || !(width > 0 && length > 0)) return null;
  const s = Math.min(64, MAX_PX / Math.max(width, length));   // pixels per metre
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width * s));
  canvas.height = Math.max(2, Math.round(length * s));
  const ctx = canvas.getContext('2d');
  const shape = Array.isArray(plan.outline) && plan.outline.length >= 3 ? plan.outline : null;
  if (shape) {
    // A shaped yard: only its own outline is bed; the rest of the lot isn't garden
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    shape.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.z * s) : ctx.moveTo(p.x * s, p.z * s)));
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = '#000000';
  const g = plan.lawn;
  ctx.beginPath();
  if (g.shape === 'ellipse') ctx.ellipse(g.cx * s, g.cz * s, g.rx * s, g.rz * s, 0, 0, Math.PI * 2);
  else ctx.rect(g.x0 * s, g.z0 * s, (g.x1 - g.x0) * s, (g.z1 - g.z0) * s);
  ctx.fill();
  const e = plan.entry;
  if (e) ctx.fillRect(e.x0 * s, e.z0 * s, (e.x1 - e.x0) * s, (e.z1 - e.z0) * s);
  // Paths from gates are open ground too, not bed
  (plan.paths || []).forEach(p => ctx.fillRect(p.x0 * s, p.z0 * s, (p.x1 - p.x0) * s, (p.z1 - p.z0) * s));
  return canvas;
}
