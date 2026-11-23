// Yard shape, in Mark your yard: start from a common shape (L around the house, narrower at the back, a cut
// corner…), then drag the corners on the plan or photo (YardSurvey draws the handles). Tap a corner or a side to
// pick it: a side can be marked as a house wall (plants keep 0.6 m off it; its shadow is the house's), a corner
// removed, a corner added in the middle of a side. Lot metres; backend lot_shape.py checks the same rules.
// The shapes are picture cards (a small plan of each, drawn at this yard's own size), so a first-time customer
// picks the one that looks like their yard instead of reading "L · house at front right".
import { Check, Home, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { SHAPE_PRESETS, polygonArea, shapeProblem } from '../data/yardSurvey';

const m = (v) => `${Number(v).toFixed(1)} m`;

// Plain names for the cards (the preset keys stay the same everywhere else)
const SHAPE_NAMES = {
  rect: 'Rectangle',
  l_right: 'L-shape, house on the right',
  l_left: 'L-shape, house on the left',
  narrow_back: 'Narrower at the back',
  narrow_house: 'Narrower at the house',
  cut_right: 'Cut corner, back right',
  cut_left: 'Cut corner, back left',
};

const same = (a, b) => (a === b) || (!!a && !!b && a.length === b.length
  && a.every((p, i) => Math.abs(p.x - b[i].x) < 0.05 && Math.abs(p.z - b[i].z) < 0.05 && !!p.house === !!b[i].house));

/** A tiny plan of a shape: back of the yard at the top, the house side at the bottom (as on the big plan). */
function ShapeThumb({ pts, W, L }) {
  const box = pts || [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: L, house: true }, { x: 0, z: L }];
  const s = 44 / Math.max(W, L, 1), w = W * s, h = L * s;
  const x = (p) => 4 + p.x * s + (44 - w) / 2, y = (p) => 4 + p.z * s + (44 - h) / 2;
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true" className="shrink-0">
      <polygon points={box.map(p => `${x(p)},${y(p)}`).join(' ')} fill="#d1fae5" stroke="#059669" strokeWidth="1.5" strokeLinejoin="round" />
      {box.map((p, i) => {
        const q = box[(i + 1) % box.length];
        return p.house ? <line key={i} x1={x(p)} y1={y(p)} x2={x(q)} y2={y(q)} stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" /> : null;
      })}
    </svg>
  );
}

// showToggle: the "Adjust corners / Done" button (off where the corners can always be dragged: Studio)
// onUndo / canUndo: optional, the AI Designer keeps the history of shape changes
export default function YardShapePanel({ W, L, outline, editing, onEditing, selected, onSelect, onChange, showToggle = true,
  onUndo, canUndo = false }) {
  const pts = outline || null;
  const problem = pts ? shapeProblem(pts) : '';
  const sideLen = (i) => { const a = pts[i], b = pts[(i + 1) % pts.length]; return Math.hypot(b.x - a.x, b.z - a.z); };
  // Which card is on: the preset the shape still matches, else "your own shape" (corners were moved)
  const current = SHAPE_PRESETS.find(p => same(p.make(W, L), pts))?.key || (pts ? 'custom' : 'rect');

  const update = (next) => onChange(next);
  const toggleHouse = (i) => update(pts.map((p, k) => (k === i ? { ...p, house: !p.house } : p)));
  const removeCorner = (i) => { update(pts.filter((_, k) => k !== i)); onSelect(null); };
  const addCorner = (i) => {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mid = { x: Math.round(((a.x + b.x) / 2) * 10) / 10, z: Math.round(((a.z + b.z) / 2) * 10) / 10, house: a.house };
    update([...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)]);
    onSelect({ type: 'corner', i: i + 1 });
  };
  const area = pts ? polygonArea(pts) : W * L;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 sm:p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="m-0 text-sm font-extrabold text-slate-900">What shape is your yard?</p>
        <p className="m-0 text-xs font-semibold text-slate-600" role="status">
          {pts ? `${pts.length} corners · ${area.toFixed(1)} m²` : `${m(W)} × ${m(L)} · ${area.toFixed(0)} m²`}
        </p>
      </div>
      <p className="m-0 mt-0.5 text-xs text-slate-500">
        Pick the one that looks most like it. The dark line is the house. Close enough is fine: you can drag the corners next.
      </p>

      {/* Phones: two cards a row, the picture above the name; wider screens: picture beside it */}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5"
        role="radiogroup" aria-label="Yard shape">
        {SHAPE_PRESETS.map(p => {
          const on = current === p.key;
          return (
            <button key={p.key} type="button" role="radio" aria-checked={on}
              onClick={() => { update(p.make(W, L)); onEditing(p.key !== 'rect'); onSelect(null); }}
              className={`relative flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-1.5 sm:pr-2 rounded-xl border text-center sm:text-left cursor-pointer transition-colors ${on
                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
              <ShapeThumb pts={p.make(W, L)} W={W} L={L} />
              <span className={`text-xs leading-snug ${on ? 'font-extrabold text-emerald-900' : 'font-semibold text-slate-700'}`}>{SHAPE_NAMES[p.key] || p.label}</span>
              {on && <Check size={14} className="absolute top-1.5 right-1.5 sm:static sm:ml-auto shrink-0 text-emerald-600" aria-hidden="true" />}
            </button>
          );
        })}
        {current === 'custom' && (
          <div className="relative flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-1.5 sm:pr-2 rounded-xl border border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 text-center sm:text-left" role="radio" aria-checked="true">
            <ShapeThumb pts={pts} W={W} L={L} />
            <span className="text-xs font-extrabold leading-snug text-emerald-900">Your own shape</span>
            <Check size={14} className="absolute top-1.5 right-1.5 sm:static sm:ml-auto shrink-0 text-emerald-600" aria-hidden="true" />
          </div>
        )}
      </div>

      {pts && (showToggle || onUndo) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {showToggle && (
            <button type="button" aria-pressed={editing} onClick={() => { onEditing(!editing); onSelect(null); }}
              className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${editing
                ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-400'}`}>
              {editing ? <><Check size={14} /> Done: the shape fits</> : <><Pencil size={13} /> Adjust the corners</>}
            </button>
          )}
          {onUndo && (
            <button type="button" onClick={onUndo} disabled={!canUndo}
              className="min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <Undo2 size={13} /> Undo
            </button>
          )}
          {!editing && showToggle && <span className="text-[11px] text-slate-500">Plants stay inside this outline.</span>}
        </div>
      )}

      {pts && editing && (
        <ol className="m-0 mt-2 pl-0 list-none grid gap-1 text-xs text-slate-700" aria-label="How to fit the shape">
          {[
            <>Drag a <b>round dot</b> on the plan to where your fence or wall turns.</>,
            <>Tap a <b>side's length</b> to mark it as a house wall or add a corner on it. Tap a dot to remove that corner.</>,
            showToggle ? <>Press <b>Done</b> when it matches your yard. Then mark what's already there.</> : <>The plan updates as you go.</>,
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center">{i + 1}</span>
              <span className="leading-snug pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      )}
      {problem && <p className="m-0 mt-1.5 text-xs font-semibold text-red-700" role="alert">{problem}</p>}

      {pts && editing && selected?.type === 'side' && pts[selected.i] && (
        <div className="mt-2 p-2 rounded-lg border border-emerald-200 bg-white flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <b>Side {selected.i + 1}</b> · {m(sideLen(selected.i))}
          <label className="inline-flex items-center gap-1.5 cursor-pointer min-h-[32px]">
            <input type="checkbox" className="w-4 h-4 accent-slate-800" checked={!!pts[selected.i].house} onChange={() => toggleHouse(selected.i)} />
            <Home size={13} /> This side is a wall of the house
          </label>
          {pts.length < 16 && (
            <button type="button" onClick={() => addCorner(selected.i)}
              className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 bg-white font-semibold cursor-pointer inline-flex items-center gap-1">
              <Plus size={13} /> Add a corner here
            </button>
          )}
        </div>
      )}
      {pts && editing && selected?.type === 'corner' && pts[selected.i] && (
        <div className="mt-2 p-2 rounded-lg border border-emerald-200 bg-white flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <b>Corner {selected.i + 1}</b> · {m(pts[selected.i].x)} from the left, {m(L - pts[selected.i].z)} from the house side
          {pts.length > 3 && (
            <button type="button" onClick={() => removeCorner(selected.i)}
              className="min-h-[32px] px-2.5 rounded-lg border border-red-200 bg-white text-red-700 font-semibold cursor-pointer inline-flex items-center gap-1">
              <Trash2 size={13} /> Remove this corner
            </button>
          )}
        </div>
      )}
    </div>
  );
}
