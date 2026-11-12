// Mark your yard, before the design is made (AI Designer). Step 1 lines the photo up with the yard (the same
// four pins as the photo overlay, so the overlay is ready too); step 2 marks what's already there — areas to keep
// clear, trees to keep, the gate or door, a wall to hide, a view to keep — by tapping the photo (each tap is a real
// spot in the yard: data/photoPose.js imageToGround) or a plan of the lot (no photo, or not lined up).
// The marks are lot metres (data/yardSurvey.js); the design engine plans around them (backend site_survey.py).
// The yard's shape (YardShapePanel + the corner handles here): when it isn't the whole W × L box, marks stay
// inside it, gates and screens follow its sides, and the engine plans inside it (backend lot_shape.py).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, Crosshair, Map as MapIcon, Sparkles, Sun, Trash2, X } from 'lucide-react';
import CornerPins from './PhotoPins';
import PhotoPlanCheck from './PhotoPlanCheck';
import SunSetup from './SunSetup';
import YardShapePanel from './YardShapePanel';
import { getSunMap } from '../services/api';
import { findPaving, loadPixels } from '../data/photoHints';
import { FENCE_LABELS, FENCE_OUTLINE, MAX_POINT_PINS, VANTAGES, defaultFencePins, defaultPins, fitSizeToCamera, imageToGround, pinLabels, projectGroundPoint, solvePhotoPose, vantageOf } from '../data/photoPose';
import {
  CLEAR_LABELS, KEEP_SIZES, MAX_SURVEY_ITEMS, SUN_LEGEND, SURVEY_TOOLS, alongEdge, clampPoint, describe, edgeLength,
  facingOf, fitOutline, insidePolygon, labelPoint, nearestEdge, nearestSide, newId, onSide, outline, sidesOf, sunColor,
  toolOf, yardPolygon,
} from '../data/yardSurvey';

const REACH = 30;            // px of dark border round the photo where a pin may go (a fence that runs out of the picture)
const NARROWEST = 2.5;       // m: a size fix narrower than this is more likely a wrong pin or vantage than a real yard
const PHOTO_MAX_H = 380;
const PLAN_MAX_H = 340;

/** Corners → points every few cm along each side (a straight side still projects straight, but a side partly
 * behind the camera needs the in-between points to be cut correctly). */
function densify(pts, closed = true) {
  const out = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let k = 0; k < 10; k++) out.push({ x: a.x + ((b.x - a.x) * k) / 10, z: a.z + ((b.z - a.z) * k) / 10 });
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

function useImageSize(url) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setSize({ url, w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  return size && size.url === url ? size : null;
}

/** Pins for "spots I choose" (a yard that isn't a rectangle): the yard's corners farthest from the house first —
 * the ones a photo taken from the house shows — with a first guess of where each is on the photo. */
function defaultPointSetup(yard, W, L) {
  const order = yard.map((c, i) => ({ ...c, i })).sort((a, b) => a.z - b.z || a.x - b.x).slice(0, 4);
  const anchors = order.map(c => ({ x: c.x, z: c.z, corner: c.i, label: `Corner ${c.i + 1}` }));
  while (anchors.length < 4) anchors.push({ x: W / 2, z: L / 2, label: `Spot ${anchors.length + 1}` });
  return { anchors, pins: anchors.map(guessPin(W, L)) };
}
const guessPin = (W, L) => (a) => ({ u: 0.1 + 0.8 * (W ? a.x / W : 0.5), v: 0.38 + 0.52 * (L ? a.z / L : 0.5) });

// pinVantage / onPinVantage: where the photo was taken from (photoPose VANTAGES), saved with the pins.
// onLotSize(width, length): the one-tap size fix when the camera height shows the typed size is off.
// pinFront / onPinFront: { width, lean } — the yard's width measured at the house side, and which fence angles
// ('both' | 'left' | 'right'); with six fence pins it measures a yard that narrows or widens (photoPose.solveFromFences).
export default function YardSurvey({ imageUrl, lotWidth, lotLength, pinSetup, pinMode, onPinMode, onPins, pinAnchors,
  onPinAnchors, survey, onSurvey, pinVantage = 'ground', onPinVantage, onLotSize, pinFront = null, onPinFront }) {
  const W = Number(lotWidth) || 0, L = Number(lotLength) || 0;
  const photo = useImageSize(imageUrl);
  const shape0 = useMemo(() => fitOutline(survey?.outline || null, W, L), [survey?.outline, W, L]);
  const yard0 = useMemo(() => yardPolygon({ outline: shape0 }, W, L), [shape0, W, L]);
  // A shaped yard can only be lined up on spots the customer chooses: the other two modes assume a rectangle
  const mode = shape0 ? 'points' : pinMode;
  const setup0 = useMemo(() => {
    if (mode === 'points') {
      const base = defaultPointSetup(yard0, W, L);
      // Pins on a corner follow that corner if the shape was changed after (else it isn't a corner any more)
      const anchors = (pinAnchors?.length >= 4 ? pinAnchors : base.anchors).map(an => (an.corner == null ? an
        : yard0[an.corner] ? { ...an, x: yard0[an.corner].x, z: yard0[an.corner].z } : { ...an, corner: null, label: `Spot` }));
      const given = pinSetup?.mode === 'points' && pinSetup.pins?.length === anchors.length ? pinSetup.pins : null;
      return { pins: given || anchors.map(guessPin(W, L)), anchors, mode: 'points', focal35: pinSetup?.focal35 ?? null };
    }
    if (pinSetup && pinSetup.mode === mode) {
      // Six fence pins saved before the back-middle and house-side pins: add them (the middle halfway between the
      // back corners, so it starts on the line; the house side hidden until they say they can see it)
      if (mode === 'fences' && pinSetup.pins?.length === 6) {
        const [a, b] = pinSetup.pins;
        return { ...pinSetup, pins: [...pinSetup.pins, { u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 }, defaultFencePins()[7]] };
      }
      return pinSetup;
    }
    return { pins: defaultPins(mode), mode, focal35: null };
  }, [pinSetup, mode, pinAnchors, yard0, W, L]);
  const setup = useMemo(() => ({
    ...setup0, vantage: VANTAGES[pinVantage] ? pinVantage : 'ground',
    ...(setup0.mode === 'fences' && Number(pinFront?.width) > 0 && { frontWidth: Number(pinFront.width), lean: pinFront.lean || 'both' }),
  }), [setup0, pinVantage, pinFront]);
  const vantage = vantageOf(setup);
  // Every change to the pins also fixes their mode and what they sit on
  const commitPins = (pins, anchors = setup.anchors) => {
    onPinMode(mode);
    if (mode === 'points') onPinAnchors?.(anchors);
    onPins(pins);
  };
  const setAnchor = (i, patch) => {
    const anchors = setup.anchors.map((a, k) => (k === i ? { ...a, ...patch } : a));
    commitPins(setup.pins, anchors);
  };
  const pose = useMemo(() => (photo && W > 0 && L > 0 ? solvePhotoPose(setup, W, L, photo.w, photo.h) : null),
    [photo, setup, W, L]);
  const poseOk = !!pose?.ok;
  const heightOk = poseOk && pose.cameraHeight >= vantage.range[0] && pose.cameraHeight <= vantage.range[1];
  const offFence = mode === 'fences' && pose?.offPins ? pose.offPins : [];
  // A yard that narrows or widens (six pins + the width at the house): its shape becomes the yard's outline, the lot
  // the box round it, and the pins measured spots on it ("Corners or spots I choose", which shaped yards use)
  const applyTaper = () => {
    if (!poseOk || !pose.taper || !photo) return;
    const r2 = (v) => Math.round(v * 100) / 100;
    const pts = pose.taper.outline(L);
    const minX = Math.min(...pts.map(q => q.x)), maxX = Math.max(...pts.map(q => q.x));
    const outline = pts.map((q, i) => ({ x: r2(q.x - minX), z: r2(q.z), house: i === 2 }));   // side 2→3 is the house side
    const anchors = setup.pins.slice(0, FENCE_OUTLINE).map((pin, i) => {
      if (i < 2) return { x: outline[i].x, z: 0, corner: i, label: `Corner ${i + 1}` };
      const g = imageToGround(pose, pin.u, pin.v, photo.w, photo.h);
      return { x: r2((g?.x ?? 0) - minX), z: r2(g?.z ?? 0), corner: null, label: FENCE_LABELS[i] };
    });
    onLotSize?.(r2(maxX - minX), L);
    save({ outline });
    onPinMode('points');
    onPinAnchors?.(anchors);
    onPins(setup.pins.slice(0, FENCE_OUTLINE));
  };
  // The house-side pin: shown when they can see where the yard meets the house (it then measures the length)
  const housePin = mode === 'fences' && setup.pins.length === 8 ? setup.pins[7] : null;
  const toggleHousePin = () => commitPins(setup.pins.map((p, i) => (i === 7 ? { u: p.u, v: p.v, ...(p.skip ? {} : { skip: true }) } : p)));
  const measured = mode === 'fences' && poseOk && pose.measuredLength ? Math.round(pose.measuredLength * 2) / 2 : null;
  // The size that fits the camera height they told us (back corners + side fences, or all four corners)
  const fit = useMemo(() => (photo && poseOk && mode !== 'points' && W > 0 && L > 0
    ? fitSizeToCamera(setup, W, L, photo.w, photo.h) : null), [photo, poseOk, mode, setup, W, L]);
  // When the height is off, the size each "I took it from…" would mean: the customer knows which is true
  const fits = useMemo(() => (photo && poseOk && !heightOk && mode !== 'points' && W > 0 && L > 0
    ? Object.keys(VANTAGES).map(k => ({ k, fit: fitSizeToCamera({ ...setup, vantage: k }, W, L, photo.w, photo.h) }))
      .filter(o => o.fit && o.fit.width >= NARROWEST)
    : []), [photo, poseOk, heightOk, mode, setup, W, L]);

  // Which step, per photo: a new photo starts at "line up" (no effect needed: the state remembers its photo)
  const [stepFor, setStepFor] = useState({ url: imageUrl, step: imageUrl && !pinSetup ? 'line' : 'mark' });
  const step = imageUrl ? (stepFor.url === imageUrl ? stepFor.step : 'line') : 'mark';
  const setStep = (s) => setStepFor({ url: imageUrl, step: s });
  const [onPlan, setOnPlan] = useState(false);
  const usePhoto = !!(imageUrl && photo && poseOk && step === 'mark' && !onPlan);

  const [tool, setTool] = useState('clear');
  const [keepR, setKeepR] = useState(1.5);
  const [drag, setDrag] = useState(null);       // { start, now } ground points while drawing
  const [hint, setHint] = useState('');
  const frameRef = useRef(null);
  const items = survey?.items || [];
  const sun = survey?.sun || null;
  // The yard's own shape (null = the whole box); kept inside the box if the lot size changes
  const shape = shape0, yard = yard0;
  const save = (patch) => onSurvey({ items, sun, outline: shape, ...patch });
  const put = (next) => save({ items: next });
  const [shaping, setShaping] = useState(false);       // dragging the yard's corners instead of marking
  const [picked, setPicked] = useState(null);          // { type: 'corner' | 'side', i }
  const [cornerDrag, setCornerDrag] = useState(null);  // index of the corner being dragged

  // Show sun & shade: hours of direct sun per spot from the server (same maths as the design engine)
  const [showSun, setShowSun] = useState(false);
  const [sunMap, setSunMap] = useState({ key: '', data: null, error: '' });
  const keepKey = JSON.stringify(items.filter(i => i.kind === 'keep').map(i => [i.x, i.z, i.r]));
  const sunKey = sun && W > 0 && L > 0 ? JSON.stringify([W, L, sun, keepKey, shape]) : '';
  const surveyRef = useRef(survey);
  useEffect(() => { surveyRef.current = survey; });
  useEffect(() => {
    if (!showSun || !sunKey) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      getSunMap(W, L, surveyRef.current)
        .then(data => { if (alive) setSunMap({ key: sunKey, data, error: '' }); })
        .catch(err => { if (alive) setSunMap({ key: sunKey, data: null, error: err.message }); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [showSun, sunKey, W, L]);
  const sunData = showSun && sunMap.key === sunKey ? sunMap.data : null;

  // Hints from the photo's colours (data/photoHints.js, in this browser only): paving the customer can keep clear.
  // Tied to this photo and these pins: lining it up again or a new photo needs a new look.
  const hintKey = imageUrl && poseOk ? JSON.stringify([imageUrl, setup.pins, W, L]) : '';
  const [hints, setHints] = useState({ key: '', status: 'idle', list: [], green: 0 });
  const hintsNow = hints.key === hintKey ? hints : { key: '', status: 'idle', list: [], green: 0 };
  const spotPaving = async () => {
    const key = hintKey;
    setHints({ key, status: 'busy', list: [], green: 0 });
    const px = await loadPixels(imageUrl);
    if (!px || !photo) { setHints({ key, status: 'failed', list: [], green: 0 }); return; }
    const found = findPaving(px, pose, W, L, photo.w, photo.h, items);
    setHints({ key, status: 'done', list: found.suggestions.map(s => ({ ...s, id: newId() })), green: found.green });
  };
  const dropHint = (id) => setHints(h => ({ ...h, list: h.list.filter(x => x.id !== id) }));
  const acceptHint = (hint) => {
    const { x0, z0, x1, z1, label } = hint;
    add({ kind: 'clear', x0, z0, x1, z1, label });
    dropHint(hint.id);
  };
  const sunCells = useMemo(() => {
    if (!sunData) return [];
    const n = sunData.grid, cw = W / n, cl = L / n, cells = [];
    sunData.hours.forEach((row, gz) => row.forEach((h, gx) => {
      if (h == null) return;   // outside the yard's shape
      const x0 = gx * cw, z0 = gz * cl, x1 = x0 + cw, z1 = z0 + cl;
      cells.push({ key: `${gx}-${gz}`, color: sunColor(h, sunData.classes),
        pts: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] });
    }));
    return cells;
  }, [sunData, W, L]);

  // The two drawing surfaces: the lined-up photo, or a plan of the lot (back at the top, house at the bottom)
  const pad = Math.max(W, L) * 0.07 || 0.5;
  const surface = (usePhoto || step === 'line') && photo && pose?.ok
    ? {
        toView: (p) => { const q = projectGroundPoint(pose, p.x, p.z, photo.w, photo.h); return q.depth > 0.05 ? { u: q.u, v: q.v } : null; },
        toGround: (u, v) => imageToGround(pose, u, v, photo.w, photo.h),
      }
    : {
        toView: (p) => ({ u: (p.x + pad) / (W + 2 * pad), v: (p.z + pad) / (L + 2 * pad) }),
        toGround: (u, v) => ({ x: u * (W + 2 * pad) - pad, z: v * (L + 2 * pad) - pad }),
      };
  const aspect = (step === 'line' || usePhoto) && photo ? photo.w / photo.h : (W + 2 * pad) / (L + 2 * pad);
  const maxH = (step === 'line' || usePhoto) ? PHOTO_MAX_H : PLAN_MAX_H;
  const lineView = step === 'line' && !!imageUrl;   // lining up: a dark border round the photo for pins past its edge

  const toPath = (pts, closed) => {
    const seg = [];
    let cur = [];
    for (const p of pts) {
      const q = surface.toView(p);
      if (q && Number.isFinite(q.u)) cur.push(`${(q.u * 100).toFixed(2)},${(q.v * 100).toFixed(2)}`);
      else if (cur.length) { seg.push(cur); cur = []; }
    }
    if (cur.length) seg.push(cur);
    return seg.map(s => `M${s.join(' L')}${closed && seg.length === 1 ? ' Z' : ''}`).join(' ');
  };
  const pos = (p) => { const q = surface.toView(p); return q && Number.isFinite(q.u) && q.u > -0.05 && q.u < 1.05 && q.v > -0.05 && q.v < 1.05 ? q : null; };

  // The lot's 1 m grid (2 m on big lots): on the photo it shows the pins are right — it lies flat on the ground
  const grid = useMemo(() => {
    if (!(W > 0 && L > 0)) return [];
    const step_ = Math.max(W, L) > 30 ? 2 : 1, lines = [];
    const sample = (a, b) => Array.from({ length: 13 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / 12, z: a.z + ((b.z - a.z) * k) / 12 }));
    for (let x = 0; x <= W + 1e-6; x += step_) lines.push(sample({ x, z: 0 }, { x, z: L }));
    for (let z = 0; z <= L + 1e-6; z += step_) lines.push(sample({ x: 0, z }, { x: W, z }));
    return lines;
  }, [W, L]);
  const lotOutline = [...Array.from({ length: 9 }, (_, k) => ({ x: (W * k) / 8, z: 0 })), ...Array.from({ length: 9 }, (_, k) => ({ x: W, z: (L * k) / 8 })),
    ...Array.from({ length: 9 }, (_, k) => ({ x: W - (W * k) / 8, z: L })), ...Array.from({ length: 9 }, (_, k) => ({ x: 0, z: L - (L * k) / 8 }))];

  // ── Drawing ──
  const groundAt = (e) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return null;
    const g = surface.toGround((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
    return g && Number.isFinite(g.x) && Number.isFinite(g.z) ? g : null;
  };
  const add = (item) => {
    if (items.length >= MAX_SURVEY_ITEMS) { setHint(`That's the most marks we take (${MAX_SURVEY_ITEMS}).`); return; }
    put([...items, { id: newId(), ...item }]);
    setHint('');
  };
  const down = (e) => {
    const g = groundAt(e);
    if (!g) { setHint('That spot is above the ground (sky or a roof). Tap on the yard itself.'); return; }
    const far = g.x < -1.5 || g.z < -1.5 || g.x > W + 1.5 || g.z > L + 1.5;
    if (far) { setHint('That spot is outside your yard. Mark things inside the grid.'); return; }
    const p = clampPoint(g, W, L);
    if (shape) {
      const off = nearestSide(yard, p);
      if (tool === 'entry') {
        add({ kind: 'entry', x: off.x, z: off.z, edge: facingOf(yard, off.side.a, off.side.b) });
        return;
      }
      if (!insidePolygon(yard, p.x, p.z) && off.d > 0.6 && tool !== 'screen') {
        setHint("That spot is outside your yard's shape. Mark things inside the green outline.");
        return;
      }
    }
    if (tool === 'keep') { add({ kind: 'keep', x: p.x, z: p.z, r: keepR, label: '' }); return; }
    if (tool === 'entry') { const e2 = nearestEdge(p, W, L); add({ kind: 'entry', x: e2.x, z: e2.z, edge: e2.edge }); return; }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ start: p, now: p });
  };
  const move = (e) => {
    if (!drag) return;
    const g = groundAt(e);
    if (g) setDrag(d => d && { ...d, now: clampPoint(g, W, L) });
  };
  const draft = (d) => {
    if (!d) return null;
    const { start: a, now: b } = d;
    if (tool === 'screen' && shape) {
      // Along the side of the shape nearest where the drag started
      const { side } = nearestSide(yard, a);
      const len = Math.hypot(side.b.x - side.a.x, side.b.z - side.a.z) || 1;
      let s0 = onSide(a, side.a, side.b).t * len, s1 = onSide(b, side.a, side.b).t * len;
      if (Math.abs(s1 - s0) < 0.5) { s0 -= 1.5; s1 += 1.5; }
      const lo = Math.max(0, Math.min(s0, s1)) / len, hi = Math.min(len, Math.max(s0, s1)) / len;
      const at = (t) => ({ x: side.a.x + (side.b.x - side.a.x) * t, z: side.a.z + (side.b.z - side.a.z) * t });
      const p0 = at(lo), p1 = at(hi);
      return { kind: 'screen', edge: facingOf(yard, side.a, side.b), x0: p0.x, z0: p0.z, x1: p1.x, z1: p1.z };
    }
    if (tool === 'screen') {
      const e2 = nearestEdge(a, W, L), n = edgeLength(e2.edge, W, L);
      let s = alongEdge(e2.edge, a), t = alongEdge(e2.edge, b);
      if (Math.abs(t - s) < 0.5) { s -= 1.5; t += 1.5; }   // a tap: 3 m of it
      return { kind: 'screen', edge: e2.edge, a: Math.max(0, Math.min(s, t)), b: Math.min(n, Math.max(s, t)) };
    }
    let x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
    if (x1 - x0 < 0.3 && z1 - z0 < 0.3) { x0 = a.x - 0.5; x1 = a.x + 0.5; z0 = a.z - 0.5; z1 = a.z + 0.5; }   // a tap: 1 m spot
    const c0 = clampPoint({ x: x0, z: z0 }, W, L), c1 = clampPoint({ x: x1, z: z1 }, W, L);
    return { kind: tool, x0: c0.x, z0: c0.z, x1: Math.max(c1.x, c0.x + 0.3), z1: Math.max(c1.z, c0.z + 0.3),
      label: tool === 'clear' ? 'Path' : '' };
  };
  const up = () => {
    const item = draft(drag);
    setDrag(null);
    if (item) add(item);
  };

  const moveCorner = (e) => {
    if (cornerDrag == null || !shape) return;
    const g = groundAt(e);
    if (!g) return;
    const snap = (v, hi) => Math.min(hi, Math.max(0, Math.round(v * 10) / 10));
    save({ outline: shape.map((c, k) => (k === cornerDrag ? { ...c, x: snap(g.x, W), z: snap(g.z, L) } : c)) });
  };
  const editingShape = !!shape && shaping && step === 'mark';

  const shapes = [...items.map((it, i) => ({ it, n: i + 1 })), ...(drag ? [{ it: draft(drag), n: null }] : [])];
  const tone = (kind) => toolOf(kind)?.color || '#64748b';

  if (!(W > 0 && L > 0)) {
    return <p className="m-0 mt-2 text-xs text-slate-500">Enter your yard's width and length to mark what's in it.</p>;
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      {/* Steps */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="m-0 text-sm font-extrabold text-slate-900">
          {step === 'line' ? 'Step 1 of 2 · Line up your photo' : imageUrl ? 'Step 2 of 2 · Mark what\'s in your yard' : 'Mark what\'s in your yard'}
          <span className="font-normal text-slate-500"> (optional)</span>
        </p>
        {imageUrl && step === 'mark' && (
          <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100">
            {[['photo', 'On my photo', Camera], ['plan', 'On a plan', MapIcon]].map(([k, text, Icon]) => {
              const on = k === 'plan' ? (onPlan || !poseOk) : (!onPlan && poseOk);
              return (
                <button key={k} type="button" aria-pressed={on} disabled={k === 'photo' && !poseOk}
                  onClick={() => (k === 'photo' ? setOnPlan(false) : setOnPlan(true))}
                  className={`min-h-[32px] px-2.5 rounded-md border-none text-xs font-bold cursor-pointer inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>
                  <Icon size={13} /> {text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {step === 'line' ? (
        <>
          <p className="m-0 mt-1 text-xs text-slate-600 leading-relaxed">
            {mode === 'points'
              ? <>Drag each yellow pin onto the spot it names: a <b>corner of your yard</b> you can see in the photo, or a spot you <b>measured</b> (a post, a tree trunk).
                  Pick what each pin is on below.</>
              : mode === 'corners'
                ? <>Drag the yellow pins onto the <b>four corners</b> of your yard, where the ground meets the fence.</>
                : mode === 'fences'
                  ? <>Drag the yellow pins onto the two <b>back corners</b> and the <b>middle of the back fence</b>, then <b>two pins on each side
                      fence</b>, where the fence meets the ground: one far, one near. Each fence gets more than one pin, so we can check the pins
                      against each other. Can you see where the yard meets the <b>house</b> (photo from upstairs or a corner)? Add the house-side
                      pin too: it measures how long your yard is.</>
                  : <>Drag the yellow pins onto the two <b>back corners</b>, then each side pin onto the <b>bottom of that side's fence</b>:
                      anywhere along it, and the farther from you the better.</>}
            {' '}A fence or corner that runs out of the picture? Drag its pin into the dark border, where it would carry on.
            When the grid lies flat on your ground, each square is 1 m and everything you mark next lands in the right spot.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Where you took the photo from">
            <span className="text-xs font-semibold text-slate-600 mr-1">I took it:</span>
            {Object.entries(VANTAGES).map(([k, v]) => (
              <button key={k} type="button" role="radio" aria-checked={setup.vantage === k} onClick={() => onPinVantage?.(k)}
                className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${setup.vantage === k ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where the pins go">
            {[['fences', 'Back and side fences (7–8 pins)'], ['corners', 'All four corners'], ['points', 'Corners or spots I choose']].map(([k, text]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} disabled={!!shape && k !== 'points'}
                onClick={() => {
                  if (k === mode) return;
                  onPinMode(k);
                  if (k === 'points') {
                    const base = defaultPointSetup(yard, W, L);
                    onPinAnchors?.(base.anchors);
                    onPins(base.pins);
                  } else onPins(defaultPins(k));
                }}
                className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${mode === k ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                {text}
              </button>
            ))}
          </div>
          {shape && <p className="m-0 mt-1 text-[11px] text-slate-500">Your yard isn't a rectangle, so pin the corners or spots you can see.</p>}
          {housePin && !shape && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <button type="button" onClick={toggleHousePin} aria-pressed={!housePin.skip}
                className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${housePin.skip ? 'border-dashed border-amber-400 bg-white text-amber-900' : 'border-amber-500 bg-amber-50 text-amber-900'}`}>
                {housePin.skip ? '+ House-side pin' : 'Remove the house-side pin'}
              </button>
              <span className="text-[11px] text-slate-500">
                {housePin.skip ? 'Only if your photo shows where the yard meets the house or the front fence.'
                  : 'Put it where the yard meets the house (or the front fence). It measures the length.'}
              </span>
            </div>
          )}
          {mode === 'fences' && !shape && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-600">
              <label className="inline-flex items-center gap-1.5">
                <span className="font-semibold">Width at the house side</span>
                <input type="number" inputMode="decimal" step="0.1" min="1" max="60" placeholder={`${W || ''}`}
                  value={pinFront?.width ?? ''} aria-label="The yard's width at the house side, in metres (optional)"
                  onChange={e => onPinFront?.(e.target.value === '' ? null : { width: Math.max(0, Number(e.target.value) || 0), lean: pinFront?.lean || 'both' })}
                  className="w-20 h-8 px-2 rounded-lg border border-slate-200 text-xs" /> m
              </label>
              <span className="text-[11px] text-slate-500">(optional: only if your yard is narrower or wider at the back)</span>
              {Number(pinFront?.width) > 0 && Math.abs(Number(pinFront.width) - W) >= 0.1 && (
                <span className="inline-flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Which fence angles">
                  <span className="font-semibold mr-0.5">Which fence angles:</span>
                  {[['both', 'Both'], ['left', 'Left'], ['right', 'Right']].map(([k, t]) => (
                    <button key={k} type="button" role="radio" aria-checked={(pinFront.lean || 'both') === k}
                      onClick={() => onPinFront?.({ ...pinFront, lean: k })}
                      className={`min-h-[30px] px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${(pinFront.lean || 'both') === k ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {t}
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}
          {mode === 'points' && (
            <ul className="m-0 mt-2 pl-0 list-none flex flex-col gap-1.5">
              {setup.anchors.map((a, i) => {
                const measured = a.corner == null;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
                    <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-amber-400 text-slate-900 font-extrabold flex items-center justify-center">{i + 1}</span>
                    <select aria-label={`What pin ${i + 1} is on`} value={measured ? 'measured' : String(a.corner)}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === 'measured') setAnchor(i, { corner: null, label: `Spot ${i + 1}` });
                        else { const c = yard[Number(v)]; setAnchor(i, { corner: Number(v), x: c.x, z: c.z, label: `Corner ${Number(v) + 1}` }); }
                      }}
                      className="h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs">
                      {yard.map((c, k) => (
                        <option key={k} value={k}>Corner {k + 1} · {c.x.toFixed(1)} m from the left, {(L - c.z).toFixed(1)} m from the house side</option>
                      ))}
                      <option value="measured">A spot I measured…</option>
                    </select>
                    {measured && (
                      <>
                        <label className="inline-flex items-center gap-1">
                          <input type="number" step="0.1" min="0" max={W} value={a.x} aria-label={`Pin ${i + 1}: metres from the left side`}
                            onChange={e => setAnchor(i, { x: Math.min(W, Math.max(0, Number(e.target.value) || 0)) })}
                            className="w-16 h-8 px-1.5 rounded-lg border border-slate-200 text-xs" /> m from the left
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input type="number" step="0.1" min="0" max={L} value={Math.round((L - a.z) * 100) / 100} aria-label={`Pin ${i + 1}: metres from the house side`}
                            onChange={e => setAnchor(i, { z: L - Math.min(L, Math.max(0, Number(e.target.value) || 0)) })}
                            className="w-16 h-8 px-1.5 rounded-lg border border-slate-200 text-xs" /> m from the house side
                        </label>
                      </>
                    )}
                    {i >= 4 && <span className="text-[11px] text-slate-500">check pin</span>}
                    {setup.anchors.length > 4 && (
                      <button type="button" aria-label={`Remove pin ${i + 1}`}
                        onClick={() => commitPins(setup.pins.filter((_, k) => k !== i), setup.anchors.filter((_, k) => k !== i))}
                        className="w-8 h-8 rounded-lg border-none bg-transparent text-slate-400 hover:text-red-600 cursor-pointer inline-flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
              {setup.anchors.length < MAX_POINT_PINS && (
                <li>
                  <button type="button"
                    onClick={() => {
                      const used = new Set(setup.anchors.map(a => a.corner));
                      const k = yard.findIndex((_, j) => !used.has(j));
                      const a = k >= 0 ? { x: yard[k].x, z: yard[k].z, corner: k, label: `Corner ${k + 1}` } : { x: W / 2, z: L / 2, corner: null, label: `Spot ${setup.anchors.length + 1}` };
                      commitPins([...setup.pins, guessPin(W, L)(a)], [...setup.anchors, a]);
                    }}
                    className="min-h-[30px] px-2.5 rounded-lg border border-dashed border-amber-400 bg-white text-amber-900 text-xs font-bold cursor-pointer">
                    + Add a check pin
                  </button>
                  <span className="ml-2 text-[11px] text-slate-500">A 5th pin tells you how well the photo lines up.</span>
                </li>
              )}
            </ul>
          )}
        </>
      ) : (
        <>
          <YardShapePanel W={W} L={L} outline={shape} editing={editingShape} onEditing={setShaping}
            selected={picked} onSelect={setPicked} onChange={(next) => save({ outline: next })} />
          <div className={`mt-2 flex flex-wrap gap-1.5 ${editingShape ? 'opacity-40 pointer-events-none' : ''}`} role="radiogroup" aria-label="What to mark">
            {SURVEY_TOOLS.map(t => (
              <button key={t.kind} type="button" role="radio" aria-checked={tool === t.kind} onClick={() => { setTool(t.kind); setHint(''); }}
                className={`min-h-[36px] px-3 rounded-full border text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${tool === t.kind ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                style={tool === t.kind ? { background: t.color } : undefined}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: tool === t.kind ? '#fff' : t.color }} /> {t.label}
              </button>
            ))}
          </div>
          {tool === 'keep' && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tree size">
              {KEEP_SIZES.map(s => (
                <button key={s.r} type="button" role="radio" aria-checked={keepR === s.r} onClick={() => setKeepR(s.r)}
                  className={`min-h-[32px] px-2.5 rounded-lg border text-xs cursor-pointer ${keepR === s.r ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-600'}`}>
                  {s.label} <span className="text-slate-400 font-normal">· {s.sub}</span>
                </button>
              ))}
            </div>
          )}
          <p className="m-0 mt-1.5 text-xs text-slate-500">{toolOf(tool).hint}</p>
        </>
      )}

      {/* The picture: photo (lined up) or plan */}
      <div className={`mt-2 flex justify-center ${lineView ? 'flex-wrap items-start gap-3' : ''}`}>
        <div className={lineView ? 'relative overflow-hidden rounded-2xl' : 'contents'}
          style={lineView ? { padding: REACH, background: '#1e293b', width: `min(100%, ${maxH * aspect + 2 * REACH}px)`, boxSizing: 'border-box' } : undefined}>
        {lineView && <span className="absolute left-2.5 top-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">Beyond your photo</span>}
        <div ref={frameRef} className={`relative ${lineView ? '' : 'overflow-hidden'} rounded-xl select-none`}
          role="img" aria-label={step === 'line' ? 'Your photo with the yard grid: drag the yellow pins'
            : `${usePhoto ? 'Your photo' : 'Plan of your yard'}: tap or drag to mark ${toolOf(tool).label.toLowerCase()}`}
          style={{ width: lineView ? '100%' : `min(100%, ${maxH * aspect}px)`, aspectRatio: `${aspect}`, touchAction: 'none',
            background: (step === 'line' || usePhoto) && imageUrl ? `#0f172a url("${imageUrl}") center / 100% 100% no-repeat` : '#f8fafc' }}
          onPointerDown={step === 'mark' && !editingShape ? down : undefined} onPointerMove={step === 'mark' && !editingShape ? move : undefined}
          onPointerUp={step === 'mark' && !editingShape ? up : undefined} onPointerCancel={() => setDrag(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none"
            style={lineView ? { overflow: 'visible' } : undefined}>
            {!(step === 'line' || usePhoto) && <path d={toPath(lotOutline, true)} fill={shape ? '#f1f5f9' : '#ecfdf5'} />}
            {!(step === 'line' || usePhoto) && shape && <path d={toPath(densify(yard), true)} fill="#ecfdf5" />}
            {step === 'mark' && sunCells.map(c => (
              <path key={c.key} d={toPath(c.pts, true)} fill={c.color} fillOpacity={usePhoto ? 0.4 : 0.55} stroke="none" />
            ))}
            {(step !== 'line' || poseOk) && grid.map((line, i) => (
              <path key={i} d={toPath(line, false)} fill="none" stroke={step === 'line' || usePhoto ? 'rgba(255,255,255,0.75)' : '#cbd5e1'}
                strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {(step !== 'line' || poseOk) && (
              <path d={toPath(lotOutline, true)} fill="none" stroke={step === 'line' || usePhoto ? '#fbbf24' : '#059669'}
                strokeWidth={shape && step === 'mark' ? 1.2 : 2.5} strokeDasharray={shape && step === 'mark' ? '4 4' : undefined} vectorEffect="non-scaling-stroke" />
            )}
            {(step === 'mark' || poseOk) && shape && (
              <path d={toPath(densify(yard), true)} fill="none" stroke={usePhoto ? '#34d399' : '#059669'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            )}
            {step === 'mark' && shape && sidesOf(yard).filter(sd => sd.house).map(sd => (
              <path key={`h${sd.i}`} d={toPath(densify([sd.a, sd.b], false), false)} fill="none" stroke="#1e293b" strokeWidth="6"
                strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {usePhoto && hintsNow.list.map(h => (
              <path key={`h${h.id}`} d={toPath([{ x: h.x0, z: h.z0 }, { x: h.x1, z: h.z0 }, { x: h.x1, z: h.z1 }, { x: h.x0, z: h.z1 }], true)}
                fill="rgba(255,255,255,0.18)" stroke="#fff" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            ))}
            {step === 'mark' && shapes.map(({ it, n }) => {
              if (!it || it.kind === 'entry') return null;
              const o = outline(it, W, L);
              const c = tone(it.kind);
              return (
                <path key={it.id || 'draft'} d={toPath(o.pts, o.closed)} fill={o.closed ? `${c}55` : 'none'} stroke={c}
                  strokeWidth={it.kind === 'screen' ? 6 : 2} strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  strokeDasharray={n == null ? '6 4' : undefined} />
              );
            })}
          </svg>
          {step === 'mark' && !usePhoto && (
            <>
              <span className="absolute left-1/2 -translate-x-1/2 top-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 pointer-events-none">Back of the yard</span>
              <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 pointer-events-none">House side (front)</span>
            </>
          )}
          {usePhoto && hintsNow.list.map((h, i) => {
            const q = pos({ x: (h.x0 + h.x1) / 2, z: (h.z0 + h.z1) / 2 });
            return q && (
              <span key={`h${h.id}`} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold text-slate-700 bg-white flex items-center justify-center shadow"
                style={{ left: `${q.u * 100}%`, top: `${q.v * 100}%`, border: '2px dashed #475569' }}>
                ?{i + 1}
              </span>
            );
          })}
          {step === 'mark' && shapes.map(({ it, n }) => {
            if (!it || (n == null && it.kind !== 'entry')) return null;
            const q = pos(it.kind === 'entry' ? { x: it.x, z: it.z } : labelPoint(it, W, L));
            if (!q) return null;
            return (
              <span key={`l${it.id || 'draft'}`} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none min-w-[20px] h-5 px-1 rounded-full text-[11px] font-extrabold text-white flex items-center justify-center shadow"
                style={{ left: `${q.u * 100}%`, top: `${q.v * 100}%`, background: tone(it.kind), border: '2px solid #fff' }}>
                {n ?? '+'}
              </span>
            );
          })}
          {editingShape && sidesOf(yard).map(sd => {
            const q = pos({ x: (sd.a.x + sd.b.x) / 2, z: (sd.a.z + sd.b.z) / 2 });
            const on = picked?.type === 'side' && picked.i === sd.i;
            return q && (
              <button key={`s${sd.i}`} type="button" onClick={() => setPicked({ type: 'side', i: sd.i })}
                aria-label={`Side ${sd.i + 1}, ${Math.hypot(sd.b.x - sd.a.x, sd.b.z - sd.a.z).toFixed(1)} m${sd.house ? ', house wall' : ''}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 px-1.5 h-6 rounded-md border text-[10px] font-bold cursor-pointer whitespace-nowrap shadow-sm ${on ? 'ring-2 ring-emerald-500' : ''} ${sd.house ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
                style={{ left: `${q.u * 100}%`, top: `${q.v * 100}%` }}>
                {sd.house ? 'House · ' : ''}{Math.hypot(sd.b.x - sd.a.x, sd.b.z - sd.a.z).toFixed(1)} m
              </button>
            );
          })}
          {editingShape && yard.map((c, i) => {
            const q = pos(c);
            const on = picked?.type === 'corner' && picked.i === i;
            return q && (
              <button key={`c${i}`} type="button" aria-label={`Corner ${i + 1}: drag to move`}
                onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); setCornerDrag(i); setPicked({ type: 'corner', i }); }}
                onPointerMove={moveCorner} onPointerUp={() => setCornerDrag(null)} onPointerCancel={() => setCornerDrag(null)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-[3px] cursor-grab touch-none shadow ${on ? 'bg-emerald-600 border-white' : 'bg-white border-emerald-600'}`}
                style={{ left: `${q.u * 100}%`, top: `${q.v * 100}%`, touchAction: 'none' }} />
            );
          })}
          {step === 'line' && imageUrl && (
            <CornerPins frameRef={frameRef} corners={setup.pins}
              labels={mode === 'points' ? setup.pins.map((_, i) => `${i + 1} · ${setup.anchors[i].label}`) : pinLabels(mode)}
              outline={mode === 'fences' ? FENCE_OUTLINE : mode !== 'points'} onChange={(pins) => commitPins(pins)} reach={REACH} good={heightOk && !offFence.length}
              loupeUrl={imageUrl} warn={offFence} />
          )}
        </div>
        </div>
        {lineView && photo && poseOk && W > 0 && L > 0 && (
          <PhotoPlanCheck pose={pose} photoW={photo.w} photoH={photo.h} W={W} L={L} good={heightOk} />
        )}
      </div>

      {step === 'line' ? (
        <>
          <p className={`m-0 mt-2 text-xs font-semibold ${heightOk ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
            {!photo ? 'Loading your photo…'
              : !poseOk ? (mode === 'points' ? 'Move each pin onto the spot it names. Use spots spread over the yard, not all in a line.'
                : 'Move the pins onto the back corners and the side fences of your yard.')
                : heightOk ? `Lined up: your camera was about ${pose.cameraHeight.toFixed(1)} m high. If the grid lies flat on your ground, you're done.`
                  : `The camera works out ${pose.cameraHeight.toFixed(1)} m high, which doesn't fit "${vantage.label.toLowerCase()}" (about ${vantage.height} m).`}
          </p>
          {mode === 'fences' && offFence.length > 0 && (
            <p className="m-0 mt-2 p-2.5 rounded-xl border border-red-200 bg-red-50 text-xs leading-relaxed text-red-800" role="alert">
              {(() => {
                const names = [offFence.includes(6) && 'back', offFence.includes(2) && 'right', offFence.includes(5) && 'left'].filter(Boolean);
                return <>The {names.join(' and ')} fence pins (red) don't line up. A straight fence is a straight line in the photo too: put
                  {names.includes('back') ? ' the back corners and the middle pin' : ' both pins'} where the fence meets the ground. If a fence
                  really bends, use <b>Corners or spots I choose</b>.</>;
              })()}
            </p>
          )}
          {mode === 'fences' && poseOk && pose.taper && (() => {
            const pts = pose.taper.outline(L);
            const front = Math.abs(pts[2].x - pts[3].x);
            return (
              <div className="mt-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs leading-relaxed text-emerald-900" role="status">
                Your yard is <b>{W} m</b> wide at the back and <b>{front.toFixed(1)} m</b> at the house: not a rectangle.
                We can use that shape, so plants stay inside your fences and the price uses the real area.
                <div className="mt-1.5">
                  <button type="button" onClick={applyTaper}
                    className="min-h-[36px] px-3 rounded-lg border-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                    Use this shape
                  </button>
                </div>
              </div>
            );
          })()}
          {poseOk && !heightOk && mode !== 'points' && (
            <div className="mt-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs leading-relaxed text-amber-900" role="status">
              {fits.length
                ? <>Usually the yard's size was a guess, or the photo was taken from higher up. Pick what's true and we'll fix the size
                    (you typed {W} × {L} m):</>
                : <>No yard size fits these pins well. Check that each side pin sits at the <b>bottom</b> of its fence, and the back pins on the back corners.</>}
              {fits.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {fits.map(({ k, fit: f }) => (
                    <button key={k} type="button" onClick={() => { onPinVantage?.(k); onLotSize?.(f.width, f.length); }}
                      className="min-h-[38px] px-3 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold cursor-pointer text-left">
                      {VANTAGES[k].label}: <span className="whitespace-nowrap">{f.width} × {f.length} m</span>
                    </button>
                  ))}
                </div>
              )}
              {fits.length > 0 && <p className="m-0 mt-1.5 text-[11px] text-amber-800/90">None of these? Then a pin is off: side pins go at the bottom of the fences.</p>}
            </div>
          )}
          {heightOk && measured && Math.abs(measured - L) >= 0.5 && (
            <div className="mt-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs leading-relaxed text-emerald-900" role="status">
              Your house-side pin says the yard is about <b>{measured} m</b> long from the back fence (it's set to {L} m).
              {onLotSize && (
                <div className="mt-1.5">
                  <button type="button" onClick={() => onLotSize(W, measured)}
                    className="min-h-[36px] px-3 rounded-lg border-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                    Make it {measured} m long
                  </button>
                </div>
              )}
            </div>
          )}
          {poseOk && heightOk && !measured && fit && fit.changed && fit.length > L + 0.4 && Math.abs(fit.width - W) < 0.5 && (
            <div className="mt-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs leading-relaxed text-emerald-900" role="status">
              You took the photo about <b>{Math.round(fit.standZ * 2) / 2} m</b> from the back fence, but your yard is set to {L} m long, so the grid
              stops short. If you took it from inside the yard or from the house, it's about <b>{fit.length} m</b> long.
              {onLotSize && (
                <div className="mt-1.5">
                  <button type="button" onClick={() => onLotSize(W, fit.length)}
                    className="min-h-[36px] px-3 rounded-lg border-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                    Make it {fit.length} m long
                  </button>
                </div>
              )}
            </div>
          )}
          {poseOk && pose.checkError != null && (
            <p className={`m-0 mt-1 text-xs font-semibold ${pose.checkError <= 0.3 ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
              {pose.checkError <= 0.3
                ? `Check pin: every pin lands within ${Math.max(1, Math.round(pose.checkError * 100))} cm of its spot.`
                : `Check pin: a pin is ${pose.checkError.toFixed(1)} m off its spot. One of the pins is on the wrong spot, or a measurement is off.`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!poseOk}
              onClick={() => { commitPins(setup.pins); setOnPlan(false); setStep('mark'); }}
              className="min-h-[40px] px-4 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
              <Check size={15} /> It lines up: mark my yard
            </button>
            <button type="button" onClick={() => { setOnPlan(true); setStep('mark'); }}
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold cursor-pointer">
              Skip: mark on a plan
            </button>
          </div>
        </>
      ) : (
        <>
          {hint && <p className="m-0 mt-2 text-xs font-semibold text-amber-700" role="alert">{hint}</p>}
          {imageUrl && (
            <button type="button" onClick={() => setStep('line')}
              className="mt-1.5 inline-flex items-center gap-1 bg-transparent border-none p-0 text-xs font-bold text-emerald-700 cursor-pointer hover:underline">
              <Crosshair size={13} /> {poseOk ? 'Line up the photo again' : 'Line up my photo to mark on it'}
            </button>
          )}
          {usePhoto && (
            <div className="mt-2">
              <button type="button" onClick={spotPaving} disabled={hintsNow.status === 'busy'}
                className="min-h-[32px] px-3 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-slate-300 disabled:opacity-60">
                <Sparkles size={13} /> {hintsNow.status === 'busy' ? 'Looking at your photo…' : hintsNow.status === 'done' ? 'Look again' : 'Spot paving in my photo'}
              </button>
              {hintsNow.status === 'failed' && (
                <p className="m-0 mt-1.5 text-xs font-semibold text-amber-700" role="alert">We couldn't read this photo. Mark the paving yourself with Keep clear.</p>
              )}
              {hintsNow.status === 'done' && (
                <div className="mt-2" role="status">
                  {hintsNow.list.length ? (
                    <>
                      <p className="m-0 text-xs text-slate-600">
                        These look like paving, concrete or gravel from their colour. Check each one on your photo: keep the ones that are right.
                      </p>
                      <ul className="m-0 mt-1.5 pl-0 list-none flex flex-col gap-1.5">
                        {hintsNow.list.map((h, i) => (
                          <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                            <span className="min-w-[24px] h-5 px-1 rounded-full text-[11px] font-extrabold text-slate-700 bg-white flex items-center justify-center shrink-0" style={{ border: '2px dashed #475569' }}>?{i + 1}</span>
                            <span className="flex-1 min-w-[10rem]">Looks like a {h.label.toLowerCase()} · {(h.x1 - h.x0).toFixed(1)} × {(h.z1 - h.z0).toFixed(1)} m</span>
                            <button type="button" onClick={() => acceptHint(h)}
                              className="min-h-[32px] px-2.5 rounded-lg border-none bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1">
                              <Check size={13} /> Keep it clear
                            </button>
                            <button type="button" onClick={() => dropHint(h.id)} aria-label={`Not paving: dismiss suggestion ${i + 1}`}
                              className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold cursor-pointer inline-flex items-center gap-1">
                              <X size={13} /> Not paving
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="m-0 text-xs text-slate-500">
                      No paving stood out{hintsNow.green > 0.5 ? ': most of what we can see is green' : ''}. Paving in shade is hard to tell from soil, so if there is some, mark it with Keep clear.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {sun && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <button type="button" aria-pressed={showSun} onClick={() => setShowSun(v => !v)}
                className={`min-h-[32px] px-3 rounded-full border text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${showSun ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-700'}`}>
                <Sun size={13} /> {showSun ? 'Hide sun & shade' : 'Show sun & shade'}
              </button>
              {showSun && (sunData ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600" role="status">
                  {SUN_LEGEND.map(l => (
                    <span key={l.key} className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm" style={{ background: l.color, opacity: 0.75 }} />
                      <b className="text-slate-800">{l.label}</b> {l.sub} · {Math.round((sunData.summary[l.key] || 0) * 100)}%
                    </span>
                  ))}
                </span>
              ) : sunMap.key === sunKey && sunMap.error
                ? <span className="text-xs font-semibold text-amber-700" role="alert">{sunMap.error}</span>
                : <span className="text-xs text-slate-500" role="status">Working out the sun…</span>)}
            </div>
          )}
          {items.length > 0 ? (
            <ul className="m-0 mt-3 pl-0 list-none flex flex-col gap-1.5">
              {items.map((it, i) => (
                <li key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full text-[11px] font-extrabold text-white flex items-center justify-center shrink-0" style={{ background: tone(it.kind) }}>{i + 1}</span>
                  <span className="flex-1 min-w-[11rem]">{describe(it)}</span>
                  {it.kind === 'clear' && (
                    <select value={it.label || 'Path'} aria-label={`What area ${i + 1} is`}
                      onChange={e => put(items.map(x => (x.id === it.id ? { ...x, label: e.target.value } : x)))}
                      className="h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs">
                      {CLEAR_LABELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  )}
                  {it.kind === 'keep' && (
                    <input value={it.label || ''} maxLength={40} placeholder="e.g. Mango tree" aria-label={`Name of plant ${i + 1}`}
                      onChange={e => put(items.map(x => (x.id === it.id ? { ...x, label: e.target.value } : x)))}
                      className="h-8 w-32 px-2 rounded-lg border border-slate-200 text-xs" />
                  )}
                  <button type="button" onClick={() => put(items.filter(x => x.id !== it.id))} aria-label={`Remove mark ${i + 1}`}
                    className="w-8 h-8 rounded-lg border-none bg-transparent text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer inline-flex items-center justify-center">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-2 text-xs text-slate-500">Nothing marked yet. Skip this if your yard is an empty space.</p>
          )}
          <SunSetup sun={sun} onChange={(next) => { save({ sun: next }); if (!next) setShowSun(false); }} />
        </>
      )}
    </div>
  );
}
