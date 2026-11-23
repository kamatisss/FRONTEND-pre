// Design card pictures (backend design_preview.py). After a design is saved, its garden is drawn in a hidden
// 3D view (the same ThreeGardenCanvas overview the PDF proposal uses: whole lot, plants at rest, no labels)
// and uploaded as an 800 × 500 JPEG. Runs in the background, one design at a time, and never bothers the
// customer: a failure only means the card keeps its placeholder.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { toCanvasPlants } from './projectHub';
import { uploadDesignPreview } from '../services/api';

const W = 800;
const H = 500;
const READY_MS = 20000;   // catalog + first frame; models then have their own 30 s wait in renderOverview

// A saved design (API shape) → what the 3D view draws. AI Designer layouts pass `layout` props directly.
export function previewScene(design) {
  const dims = design?.dimensions || {};
  const lotWidth = Number(dims.width) || 10;
  const lotLength = Number(dims.length) || 15;
  return {
    plants: toCanvasPlants(design?.placed_items, lotWidth, lotLength),
    lotWidth, lotLength,
    gardenPlan: dims.gardenPlan && typeof dims.gardenPlan === 'object' ? dims.gardenPlan : null,
    survey: dims.siteSurvey || null,
    groundcover: Array.isArray(dims.groundcover) ? dims.groundcover : null,
  };
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* Draw `scene` off screen → a JPEG Blob. */
export async function renderPreview(scene) {
  const { default: ThreeGardenCanvas } = await import('../components/ThreeGardenCanvas');
  const holder = document.createElement('div');
  // In the page (WebGL needs a real size) but off screen and out of reach of clicks and screen readers
  holder.setAttribute('aria-hidden', 'true');
  Object.assign(holder.style, { position: 'fixed', left: '-10000px', top: '0', width: `${W}px`, height: `${H}px`, pointerEvents: 'none' });
  document.body.appendChild(holder);
  const root = createRoot(holder);
  const ref = { current: null };
  try {
    root.render(createElement(ThreeGardenCanvas, {
      ref, height: H, lotLabels: false, enableZoom: false, enablePan: false,
      plants: scene.plants || [], lotWidth: scene.lotWidth, lotLength: scene.lotLength,
      gardenPlan: scene.gardenPlan || null, survey: scene.survey || null, groundcover: scene.groundcover || null,
    }));
    const start = Date.now();
    while (!ref.current?.catalogReady?.()) {
      if (Date.now() - start > READY_MS) throw new Error('The 3D view took too long to load.');
      await new Promise((r) => setTimeout(r, 200));
    }
    await frame(); await frame();   // the plants are placed in an effect after the catalog arrives
    const canvas = await ref.current.renderOverview({ width: W, height: H, measurements: false, room: 0.95 });
    return await new Promise((resolve, reject) => canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/jpeg', 0.85));
  } finally {
    root.unmount();
    holder.remove();
  }
}

// One at a time: each render is a full 3D view. A newer request for the same design replaces a waiting one.
const waiting = new Map();   // designId → { scene, revision, resolve }
let running = false;

async function drain() {
  if (running) return;
  running = true;
  try {
    while (waiting.size) {
      const [id, job] = waiting.entries().next().value;
      waiting.delete(id);
      try {
        const blob = await renderPreview(job.scene);
        job.resolve(await uploadDesignPreview(id, blob, job.revision));
      } catch (e) {
        console.warn(`Design ${id}: no card picture`, e);
        job.resolve(null);
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Make and upload the card picture for a saved design, in the background.
 * scene: previewScene(savedDesign), or the AI Designer's own layout props. Resolves to
 * { preview_url, preview_revision } or null (never rejects).
 */
export function queuePreview(designId, scene, revision) {
  if (!designId || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    waiting.get(designId)?.resolve(null);
    waiting.set(designId, { scene, revision, resolve });
    // Let the save's own work (toasts, navigation) finish first
    setTimeout(drain, 400);
  });
}

// Cards: a picture that shows an older version is still better than none, but gets redrawn
export const previewIsCurrent = (d) => !!d?.preview_url && (d.preview_revision ?? 0) >= (d.revision ?? 1);
