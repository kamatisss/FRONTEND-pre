// The selected item's details and actions in the 3D Studio, docked OUTSIDE the plant (bottom centre of the 3D
// view on desktop, a bottom sheet above the tool bar on phones) instead of a card and a button bar floating on
// it in the scene. The same light card as the AI Designer's panel (PlantHeightCard `panel`), worked out exactly
// as the plant in the scene works out its own (PlacedObject: size at the slider's year, its ±8% variation, its
// own scale, crowding at that year).
//   Move:        pick it up and place it again (the Studio's re-place mode)
//   Turn:        a click turns it 45°; dragging sideways on the button turns it smoothly (as the old bar did)
//   Move apart:  a plant that crowds a neighbour at this year moves straight away from it, just far enough
//                (data/crowding.crowdingNeighbours: the distance at which they stop crowding), inside the lot.
//                The Studio has no Undo, so the panel says how far it went; it can be dragged back.
import { useRef, useState } from 'react';
import { Move, MoveHorizontal, RotateCw, Trash2, X } from 'lucide-react';
import PlantHeightCard from './PlantHeightCard';
import { useDesign } from '../context/DesignContext';
import { crowdingNeighbours, crowdingNotes } from '../data/crowding';
import { clampToLot } from '../data/lot';
import { DEFAULT_GROWTH_STAGE, isFullyGrown, matureWhen, placedScale, plantVariation, stageSize, stageSpread } from '../data/modelSizing';
import { growthNote } from '../data/plantGrowth';
import { resolveModelUrl } from '../data/modelCatalog';

const BTN = (fg, extra) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 40, padding: '0 12px', borderRadius: 999, border: 'none',
  background: 'transparent', color: fg, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
  fontFamily: 'inherit', ...extra,
});
const SLACK = 0.05;   // m past the crowding distance, so a rounding step doesn't bring the note straight back

export default function StudioItemPanel({ item, lot, phone = false }) {
  const { state, dispatch } = useDesign();
  const [note, setNote] = useState(null);   // { id, text }: what Move apart did
  const turn = useRef(null);                // { x, y0, moved } while dragging on Turn

  const stage = state.growthStage ?? DEFAULT_GROWTH_STAGE;
  const product = state.products.find(p => p.id === item.productId);
  const category = item.category || product?.category || 'plant';
  const source = product || item;
  const vary = plantVariation(item.id, category);
  const scale = placedScale(item.scale?.x ?? item.scale ?? 1);
  const realH = (Number(stageSize(source, stage, category)) || 0) * vary.h;
  // Every plant as the crowding check sees it (the same list PlacedObject builds)
  const list = state.placedItems.map((it) => {
    const prod = state.products.find(p => p.id === it.productId);
    return { key: it.id, x: it.position?.x, z: it.position?.z, product: prod,
      vary: plantVariation(it.id, it.category || prod?.category), scale: placedScale(it.scale?.x ?? it.scale ?? 1) };
  });
  const isPlant = category === 'plant';
  const notes = isPlant ? (crowdingNotes(list, stage).get(item.id) || []) : [];
  const crowd = isPlant ? crowdingNeighbours(list, stage).get(item.id) : null;
  const name = product?.name || item.name || 'Item';

  const update = (updates) => dispatch({ type: 'UPDATE_ITEM', payload: { id: item.id, updates } });
  const rotY = item.rotation?.y ?? 0;
  const setRot = (y) => update({ rotation: { x: item.rotation?.x ?? 0, y, z: item.rotation?.z ?? 0 } });

  const onTurnDown = (e) => {
    turn.current = { x: e.clientX, y0: rotY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onTurnMove = (e) => {
    const t = turn.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    if (!t.moved && Math.abs(dx) > 4) t.moved = true;
    if (t.moved) setRot(t.y0 + dx * 0.01);
  };
  const onTurnUp = () => {
    const t = turn.current;
    turn.current = null;
    if (t && !t.moved) setRot(rotY + Math.PI / 4);   // a click: 45°
  };

  const moveApart = () => {
    if (!crowd) return;
    const x = item.position?.x ?? 0, z = item.position?.z ?? 0, o = crowd.other;
    let dx = x - o.x, dz = z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
    const target = clampToLot(o.x + dx * (crowd.need + SLACK), o.z + dz * (crowd.need + SLACK), lot);
    update({ position: { x: target.x, y: item.position?.y ?? 0, z: target.z } });
    const moved = Math.hypot(target.x - x, target.z - z);
    const apart = Math.hypot(target.x - o.x, target.z - o.z);
    setNote({ id: item.id, text: apart >= crowd.need - 0.01
      ? `Moved ${moved.toFixed(1)} m away from the ${o.name}: now ${apart.toFixed(1)} m apart. Drag it back if you liked it there.`
      : `Moved it as far from the ${o.name} as your lot allows (${apart.toFixed(1)} m apart). Moving the ${o.name} too would help.` });
  };

  const wrap = phone
    ? { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25, maxHeight: '55%', overflowY: 'auto',
      padding: '8px 16px 14px', background: '#fff', borderRadius: '16px 16px 0 0',
      boxShadow: '0 -8px 24px rgba(15,23,42,0.18)', borderTop: '1px solid #E2E8F0' }
    // Bottom centre: the Studio's Project Summary sits on the right and the "Let AI design" card bottom-left
    : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 16, zIndex: 25, width: 380,
      maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 96px)',
      overflowY: 'auto', padding: '12px 14px', background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
      boxShadow: '0 10px 30px rgba(15,23,42,0.16)' };

  return (
    <div role="region" aria-label={`${name}: details`} style={{ ...wrap, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {phone && <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 99, background: '#CBD5E1', margin: '0 auto 10px' }} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <PlantHeightCard panel name={name} category={category} stage={stage} shown={realH * scale}
          heights={{ planting: Number(product?.planting_height) || 0, established: Number(source.real_world_size) || 0,
            mature: Number(product?.mature_height) || 0 }}
          wide={stageSpread(product || item, stage, category) * vary.w}
          matureWhen={matureWhen(product)} grown={!!product && isFullyGrown(product, stage)}
          notes={notes}
          growthNote={isPlant ? growthNote(resolveModelUrl(item.model_file || product?.model_file || item.modelPath || item.modelType), stage) : ''}
          style={{ flex: 1 }} />
        <button type="button" onClick={() => dispatch({ type: 'DESELECT_ALL' })} aria-label="Close the details" title="Close"
          style={{ width: 36, height: 36, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 10, background: 'transparent', color: '#64748B', cursor: 'pointer' }}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div role="toolbar" aria-label={`${name} actions`}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10, padding: 4, borderRadius: 14, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        {crowd && (
          <button type="button" onClick={moveApart} title={`Move it straight away from the ${crowd.other.name}, just far enough`}
            style={BTN('#92400E', { background: '#FEF3C7' })}>
            <MoveHorizontal size={15} aria-hidden="true" /> Move apart
          </button>
        )}
        <button type="button" onClick={() => dispatch({ type: 'START_EDITING', payload: item.id })} title="Pick it up and place it again"
          style={BTN('#065F46')}>
          <Move size={15} aria-hidden="true" /> Move
        </button>
        <button type="button" onPointerDown={onTurnDown} onPointerMove={onTurnMove} onPointerUp={onTurnUp}
          onPointerCancel={() => { turn.current = null; }}
          onClick={(e) => { if (e.detail === 0) setRot(rotY + Math.PI / 4); }}   /* keyboard: Enter / Space */
          title="Click to turn 45°, or drag sideways to turn it smoothly" style={BTN('#1D4ED8', { touchAction: 'none', cursor: 'ew-resize' })}>
          <RotateCw size={15} aria-hidden="true" /> Turn
        </button>
        <button type="button" onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: item.id })} title="Remove (Delete)"
          style={BTN('#B91C1C')}>
          <Trash2 size={15} aria-hidden="true" /> Remove
        </button>
      </div>
      {note?.id === item.id && (
        <p role="status" style={{ margin: '8px 2px 0', fontSize: 12.5, fontWeight: 600, color: '#065F46' }}>{note.text}</p>
      )}
    </div>
  );
}
