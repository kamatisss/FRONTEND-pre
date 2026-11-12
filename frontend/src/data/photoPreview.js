/**
 * "Before & after" picture of a design in the customer's own yard: their photo as it is, next to
 * the same photo with the garden drawn in (ThreeGardenCanvas.renderPhotoPreview gives both, the same
 * size). Laid out side by side with a title and a footer, saved as a JPEG that opens on any phone.
 */

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

function pill(ctx, text, x, y, size, bg, fg) {
  ctx.font = `800 ${size}px ${FONT}`;
  const padX = size * 0.75, h = size * 1.9, w = ctx.measureText(text).width + padX * 2, r = h / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2 + size * 0.04);
}

// Shorten text with "…" until it fits maxWidth
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * before / after: canvases of the same size. Returns a canvas with both side by side.
 * title: the design's name; stage: e.g. "In 2 years" (how big the plants are drawn)
 */
export function composeBeforeAfter({ before, after, title, stage, date = new Date() }) {
  const W = after.width, H = after.height;
  const unit = Math.max(12, Math.round(Math.min(W, H) * 0.035));   // text scales with the photo
  const pad = Math.round(unit * 1.6);
  const gap = Math.round(unit * 0.8);
  const header = Math.round(unit * 4.2);
  const footer = Math.round(unit * 3.4);

  const out = document.createElement('canvas');
  out.width = pad * 2 + W * 2 + gap;
  out.height = header + H + footer;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);

  // Header: the design's name, and the brand on the right
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#047857';
  ctx.font = `800 ${Math.round(unit * 0.85)}px ${FONT}`;
  const brand = 'Garden Studio';
  const brandW = ctx.measureText(brand).width;
  ctx.fillText(brand, out.width - pad - brandW, header * 0.62);
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${Math.round(unit * 1.45)}px ${FONT}`;
  ctx.fillText(fit(ctx, title || 'Garden design', out.width - pad * 3 - brandW), pad, header * 0.62);

  // The two pictures, with rounded corners and labels
  const radius = Math.round(unit * 0.6);
  [[before, pad, 'BEFORE', 'rgba(15,23,42,0.78)'], [after, pad + W + gap, 'AFTER', '#059669']].forEach(([img, x, label, bg]) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, header, W, H, radius);
    ctx.clip();
    ctx.drawImage(img, x, header, W, H);
    ctx.restore();
    pill(ctx, label, x + unit * 0.8, header + unit * 0.8, Math.round(unit * 0.75), bg, '#ffffff');
  });

  // Footer: what it is, when, and that it's a preview
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 ${Math.round(unit * 0.7)}px ${FONT}`;
  const when = date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const line = `Design preview made with Garden Studio's AI garden designer · ${when}${stage ? ` · Plants shown: ${stage}` : ''}`;
  ctx.fillText(fit(ctx, line, out.width - pad * 2), pad, header + H + footer * 0.42);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 ${Math.round(unit * 0.6)}px ${FONT}`;
  ctx.fillText(fit(ctx, 'A preview: real plants vary in size, shape and colour.', out.width - pad * 2), pad, header + H + footer * 0.75);
  return out;
}

export const canvasToJpeg = (canvas, quality = 0.9) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/jpeg', quality);
});
