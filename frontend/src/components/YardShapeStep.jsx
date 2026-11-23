// AI Designer step 1, right under the yard size: the yard's shape, before the photo and the marks. A shaped
// yard changes how a photo is lined up (only "corners or spots I choose" fit it: YardSurvey) and where marks may
// go, so it comes first. The picture cards (YardShapePanel) pick a starting shape; the plan below them
// (YardShapePlan) is where the corners are dragged. The shape is survey.outline (lot metres, null = the box).
// The first time a customer sees the plan, a hand shows a corner being dragged, until they move a corner
// themselves or press "Got it" (remembered on this device).
import { useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import YardShapePanel from './YardShapePanel';
import YardShapePlan from './YardShapePlan';
import { fitOutline } from '../data/yardSurvey';

const UNDO_MAX = 30;
const ONE_DRAG_MS = 600;   // changes closer together than this are one drag: one Undo brings back the shape before it
const HINT_KEY = 'shimerey.hint.yardCornerDrag';

// Storage can be blocked (private window, site data off): then the hint simply shows again next time
const hintSeen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
const rememberHint = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch { /* not remembered: fine */ } };

/** The corner worth showing: where two house walls meet (the corner an L-shape is about), else the first one. */
const hintCornerOf = (pts) => {
  const i = pts.findIndex((p, k) => p.house && pts[(k - 1 + pts.length) % pts.length].house);
  return i >= 0 ? i : 0;
};

export default function YardShapeStep({ W, L, outline, onOutline }) {
  const shape = fitOutline(outline || null, W, L);
  const [picked, setPicked] = useState(null);   // { type: 'corner' | 'side', i }
  const [history, setHistory] = useState([]);
  const [showHint, setShowHint] = useState(() => !hintSeen());
  const lastChange = useRef(0);

  const change = (next) => {
    const now = Date.now();
    if (now - lastChange.current > ONE_DRAG_MS) setHistory(h => [...h.slice(-(UNDO_MAX - 1)), shape]);
    lastChange.current = now;
    onOutline(next);
  };
  const doneHint = () => { if (showHint) { setShowHint(false); rememberHint(); } };
  // A corner moved on the plan (drag or arrow keys): they've got it
  const changeOnPlan = (next) => { doneHint(); change(next); };
  const undo = () => {
    if (!history.length) return;
    setPicked(null);
    lastChange.current = 0;
    onOutline(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  };

  if (!(W > 0 && L > 0)) return null;
  const hint = showHint && !!shape;
  return (
    <div>
      <YardShapePanel W={W} L={L} outline={shape} editing showToggle={false} onEditing={() => {}}
        selected={picked} onSelect={setPicked} onChange={change} onUndo={undo} canUndo={history.length > 0} />
      {shape && (
        <div className="mt-2 max-w-[460px] mx-auto">
          {hint && (
            <div role="status" className="mb-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs">
              <Hand size={15} aria-hidden="true" className="shrink-0" />
              <span className="flex-1"><b>Tip:</b> drag a round dot to move that corner of your yard.</span>
              <button type="button" onClick={doneHint}
                className="min-h-[30px] px-2.5 rounded-md border border-white/60 bg-transparent text-white text-xs font-bold cursor-pointer hover:bg-white/10">
                Got it
              </button>
            </div>
          )}
          <div className="p-1.5 rounded-xl border border-slate-200 bg-white">
            <YardShapePlan W={W} L={L} outline={shape} selected={picked} onSelect={setPicked} onChange={changeOnPlan}
              hintCorner={hint ? hintCornerOf(shape) : null} />
          </div>
        </div>
      )}
    </div>
  );
}
