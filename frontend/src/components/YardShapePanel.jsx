// Yard shape, in Mark your yard: start from a common shape (L around the house, narrower at the back, a cut
// corner…), then drag the corners on the plan or photo (YardSurvey draws the handles). Tap a corner or a side to
// pick it: a side can be marked as a house wall (plants keep 0.6 m off it; its shadow is the house's), a corner
// removed, a corner added in the middle of a side. Lot metres; backend lot_shape.py checks the same rules.
import { Home, Plus, Trash2 } from 'lucide-react';
import { SHAPE_PRESETS, polygonArea, shapeProblem } from '../data/yardSurvey';

const m = (v) => `${Number(v).toFixed(1)} m`;

// showToggle: the "Adjust corners / Done shaping" button (off where the corners can always be dragged: Studio)
export default function YardShapePanel({ W, L, outline, editing, onEditing, selected, onSelect, onChange, showToggle = true }) {
  const pts = outline || null;
  const problem = pts ? shapeProblem(pts) : '';
  const sideLen = (i) => { const a = pts[i], b = pts[(i + 1) % pts.length]; return Math.hypot(b.x - a.x, b.z - a.z); };

  const update = (next) => onChange(next);
  const toggleHouse = (i) => update(pts.map((p, k) => (k === i ? { ...p, house: !p.house } : p)));
  const removeCorner = (i) => { update(pts.filter((_, k) => k !== i)); onSelect(null); };
  const addCorner = (i) => {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mid = { x: Math.round(((a.x + b.x) / 2) * 10) / 10, z: Math.round(((a.z + b.z) / 2) * 10) / 10, house: a.house };
    update([...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)]);
    onSelect({ type: 'corner', i: i + 1 });
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs font-bold text-slate-800">
          Yard shape: <span className="font-semibold text-slate-600">
            {pts ? `${pts.length} corners · ${polygonArea(pts).toFixed(1)} m² of ${(W * L).toFixed(0)} m²` : `rectangle · ${m(W)} × ${m(L)}`}
          </span>
        </p>
        {pts && showToggle && (
          <button type="button" aria-pressed={editing} onClick={() => { onEditing(!editing); onSelect(null); }}
            className={`min-h-[30px] px-2.5 rounded-lg border text-xs font-bold cursor-pointer ${editing ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
            {editing ? 'Done shaping' : 'Adjust corners'}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Start from a shape">
        {SHAPE_PRESETS.map(p => (
          <button key={p.key} type="button"
            onClick={() => { update(p.make(W, L)); onEditing(p.key !== 'rect'); onSelect(null); }}
            className="min-h-[30px] px-2.5 rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 cursor-pointer hover:border-emerald-400">
            {p.label}
          </button>
        ))}
      </div>
      {pts && editing && (
        <p className="m-0 mt-1.5 text-[11px] text-slate-500">
          Drag the round corners to where your fence or wall turns. Tap a side's length to say it's a house wall, or to add a corner on it.
        </p>
      )}
      {problem && <p className="m-0 mt-1.5 text-xs font-semibold text-red-700" role="alert">{problem}</p>}

      {pts && editing && selected?.type === 'side' && pts[selected.i] && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <b>Side {selected.i + 1}</b> · {m(sideLen(selected.i))}
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-slate-800" checked={!!pts[selected.i].house} onChange={() => toggleHouse(selected.i)} />
            <Home size={13} /> This side is a wall of the house
          </label>
          {pts.length < 16 && (
            <button type="button" onClick={() => addCorner(selected.i)}
              className="min-h-[30px] px-2.5 rounded-lg border border-slate-200 bg-white font-semibold cursor-pointer inline-flex items-center gap-1">
              <Plus size={13} /> Add a corner here
            </button>
          )}
        </div>
      )}
      {pts && editing && selected?.type === 'corner' && pts[selected.i] && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <b>Corner {selected.i + 1}</b> · {m(pts[selected.i].x)} from the left, {m(L - pts[selected.i].z)} from the house side
          {pts.length > 3 && (
            <button type="button" onClick={() => removeCorner(selected.i)}
              className="min-h-[30px] px-2.5 rounded-lg border border-red-200 bg-white text-red-700 font-semibold cursor-pointer inline-flex items-center gap-1">
              <Trash2 size={13} /> Remove this corner
            </button>
          )}
        </div>
      )}
    </div>
  );
}
