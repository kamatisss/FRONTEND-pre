import { useEffect, useState } from 'react';
import { LAWN_LOOKS } from '../data/grassField';
import { Minus, Plus, Home, Info, Grid3x3, Sprout } from 'lucide-react';
import { useDesign } from '../context/DesignContext';
import { LOT_MIN, LOT_MAX, LOT_PRESETS, clampLot, lotArea, lotOf } from '../data/lot';
import YardShapePanel from './YardShapePanel';
import YardShapePlan from './YardShapePlan';

/*
 * Lot size for the 3D Studio: one size for the 3D ground, where items can go, the price
 * estimate (site prep & soil per m²) and the AI Designer hand-off. Typing is free; the value
 * is checked (2–50 m, 0.5 m steps) when the field loses focus or Enter is pressed.
 */
function SideField({ label, value, fallback, onCommit }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = (v) => { const n = clampLot(v, fallback); setText(String(n)); onCommit(n); };
  const btn = (enabled) => ({
    width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: '1px solid #D1D5DB', background: '#fff',
    color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.4,
  });
  const id = `lot-${label.toLowerCase()}`;
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" style={btn(value > LOT_MIN)} disabled={value <= LOT_MIN}
          onClick={() => commit(value - 1)} aria-label={`${label} one metre less`}><Minus size={18} /></button>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input id={id} type="number" inputMode="decimal" min={LOT_MIN} max={LOT_MAX} step="0.5" value={text}
            onChange={e => setText(e.target.value)} onBlur={e => commit(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 12, border: '1px solid #D1D5DB',
              padding: '0 34px 0 12px', fontSize: 16, fontWeight: 700, color: '#111827', textAlign: 'center' }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#6B7280', fontWeight: 600, pointerEvents: 'none' }}>m</span>
        </div>
        <button type="button" style={btn(value < LOT_MAX)} disabled={value >= LOT_MAX}
          onClick={() => commit(value + 1)} aria-label={`${label} one metre more`}><Plus size={18} /></button>
      </div>
    </div>
  );
}

export default function LotSizePanel({ showGrid = false, onToggleGrid, lawnLook = null, onLawnLook }) {
  const { state, dispatch, ground } = useDesign();
  const lot = lotOf(state.dimensions);
  const set = (field) => (v) => dispatch({ type: 'SET_DIMENSIONS', payload: { [field]: v } });
  const area = lotArea(lot);
  // The yard's shape inside the lot (data/lot.js): drawn on the plan below, the 3D ground follows it
  const [picked, setPicked] = useState(null);
  const setOutline = (next) => dispatch({ type: 'SET_DIMENSIONS', payload: { outline: next } });

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
        The size of the area you want landscaped. The green ground in 3D is drawn to this size, and your
        price estimate and the AI designer use it too.
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Common sizes</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 18 }}>
        {LOT_PRESETS.map(p => {
          const on = p.width === lot.width && p.length === lot.length;
          return (
            <button key={p.label} type="button" aria-pressed={on}
              onClick={() => dispatch({ type: 'SET_DIMENSIONS', payload: { width: p.width, length: p.length } })}
              style={{ minHeight: 44, padding: '6px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: on ? '1.5px solid #6ee7b7' : '1px solid #E5E7EB', background: on ? '#ECFDF5' : '#fff', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: on ? '#065F46' : '#374151', lineHeight: 1.25 }}>{p.label}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: '#6B7280', fontWeight: 600 }}>{p.width} × {p.length} m</span>
            </button>
          );
        })}
      </div>
      <SideField label="Width" value={lot.width} fallback={10} onCommit={set('width')} />
      <SideField label="Length" value={lot.length} fallback={15} onCommit={set('length')} />

      <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shape of the yard</p>
      <div style={{ marginBottom: 14 }}>
        <YardShapePanel W={lot.width} L={lot.length} outline={lot.outline} editing showToggle={false} onEditing={() => {}}
          selected={picked} onSelect={setPicked} onChange={setOutline} />
        {lot.outline && (
          <div style={{ marginTop: 8, padding: 6, borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}>
            <YardShapePlan W={lot.width} L={lot.length} outline={lot.outline} selected={picked} onSelect={setPicked} onChange={setOutline} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '10px 12px',
        borderRadius: 12, background: '#ECFDF5', border: '1px solid #A7F3D0', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>Area{lot.outline ? ' of the yard' : ''}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#065F46' }}>{area.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²</span>
      </div>

      {onToggleGrid && (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44,
          padding: '6px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 14, cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#374151' }}>
            <Grid3x3 size={16} style={{ color: '#059669' }} /> Show 1 m grid
          </span>
          <input type="checkbox" checked={showGrid} onChange={onToggleGrid} style={{ width: 20, height: 20, accentColor: '#059669' }} />
        </label>
      )}

      {onLawnLook && (
        <div style={{ marginBottom: 14 }}>
          <p id="lawn-look-label" style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lawn look</p>
          <div role="radiogroup" aria-labelledby="lawn-look-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {Object.entries(LAWN_LOOKS).map(([key, l]) => {
              const on = lawnLook === key;
              return (
                <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onLawnLook(key)}
                  style={{ minHeight: 44, padding: '6px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: on ? '1.5px solid #6ee7b7' : '1px solid #E5E7EB', background: on ? '#ECFDF5' : '#fff',
                    color: on ? '#065F46' : '#374151', minWidth: 0 }}>
                  {l.label}
                </button>
              );
            })}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#6B7280', lineHeight: 1.45 }}>
            How long the grass looks in 3D. It doesn't change your design or its price.
          </p>
        </div>
      )}

      {ground?.available && (
        <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, minHeight: 44,
          padding: '8px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 14, cursor: 'pointer' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#374151' }}>
              <Sprout size={16} style={{ color: '#059669' }} /> Groundcover in the beds
            </span>
            <span style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.4 }}>
              Your plants sit in beds; groundcover fills the soil between them (a shade one under trees).
              {ground.bedArea >= 1 ? ` Beds now: about ${Math.round(ground.bedArea)} m².` : ' Place some plants first.'} Off = mulched beds.
            </span>
          </span>
          <input type="checkbox" checked={ground.on} style={{ width: 20, height: 20, accentColor: '#059669', flexShrink: 0, marginTop: 2 }}
            onChange={e => dispatch({ type: 'SET_DIMENSIONS', payload: { groundcoverOff: !e.target.checked } })} />
        </label>
      )}

      <p style={{ display: 'flex', gap: 8, margin: '0 0 10px', fontSize: 12.5, color: '#4B5563', lineHeight: 1.45 }}>
        <Home size={15} style={{ color: '#059669', flexShrink: 0, marginTop: 1 }} />
        <span>The <strong>front edge</strong> (nearest you when the Studio opens) is the house side, the same as in the AI designer.</span>
      </p>
      <p style={{ display: 'flex', gap: 8, margin: 0, fontSize: 12.5, color: '#6B7280', lineHeight: 1.45 }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{LOT_MIN}–{LOT_MAX} m per side. Bigger property? Book a site visit and our team will plan it with you.</span>
      </p>
    </div>
  );
}
