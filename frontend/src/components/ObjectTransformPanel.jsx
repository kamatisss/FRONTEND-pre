import { useEffect, useRef, useState } from 'react';
import { useDesign } from '../context/DesignContext';
import { patchItemRotation } from '../services/api';
import {
  RotateCw, X, Save, Compass, RotateCcw, CheckCircle2
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   OBJECT TRANSFORM PANEL — Inline styles for light theme
   ═══════════════════════════════════════════════════════════════ */

const radToDeg = (rad) => ((rad * 180) / Math.PI) % 360;
const degToRad = (deg) => (deg * Math.PI) / 180;
const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;

const O = {
  panel: {
    width: 300, background: '#fff', borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)', border: '1px solid #E5E7EB',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 20px', borderBottom: '1px solid #E5E7EB',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#FAFAFA',
  },
  headerTitle: {
    fontSize: '0.85rem', fontWeight: 700, color: '#1f2937',
    display: 'flex', alignItems: 'center', gap: 8, margin: 0,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: 'transparent', cursor: 'pointer', color: '#9CA3AF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 20 },
  nameRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  itemName: {
    fontSize: '0.85rem', fontWeight: 700, color: '#1f2937',
    maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  autoBadge: {
    padding: '2px 8px', background: '#F0FDF4', color: '#059669',
    fontSize: 10, fontWeight: 700, borderRadius: 4, textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  /* Section labels — HIGHER CONTRAST */
  sectionLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: '0.7rem', fontWeight: 700, color: '#4B5563',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  degValue: {
    color: '#059669', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem',
  },
  sliderInput: {
    width: '100%', height: 6, borderRadius: 4, appearance: 'none',
    cursor: 'pointer', background: '#E5E7EB', accentColor: '#10b981',
    outline: 'none', marginTop: 8,
  },
  sliderLabels: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 10, color: '#9CA3AF', fontWeight: 700, padding: '4px 2px 0',
  },
  quickGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12,
  },
  quickBtn: {
    padding: '6px 0', background: '#F9FAFB', border: '1px solid #E5E7EB',
    borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#4B5563',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    transition: 'all 0.15s',
  },
  /* Details grid — HIGHER CONTRAST labels */
  detailGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20,
  },
  detailLabel: {
    fontSize: 10, fontWeight: 700, color: '#4B5563',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
  },
  detailBox: {
    background: '#F9FAFB', borderRadius: 10, padding: 12,
  },
  coordRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 11, fontWeight: 700, marginBottom: 4,
  },
  coordLabel: { color: '#6B7280' },
  coordValue: { color: '#374151', fontFamily: 'monospace' },
  scaleBox: {
    background: '#F9FAFB', borderRadius: 10, padding: 12,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: 76,
  },
  scaleValue: { fontSize: '1.25rem', fontWeight: 900, color: '#1f2937', fontFamily: 'monospace' },
  scaleLabel: { fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 },
  /* Save button — VISIBLE BORDER & PROPER STYLING */
  saveBtn: (status) => ({
    width: '100%', padding: '12px 0', borderRadius: 10,
    fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, transition: 'all 0.15s',
    background: status === 'saved' ? '#F0FDF4' : '#fff',
    border: status === 'saved' ? '1px solid #BBF7D0' : '1px solid #D1D5DB',
    color: status === 'saved' ? '#059669' : '#374151',
  }),
  errorMsg: { fontSize: 10, color: '#EF4444', fontWeight: 700, textAlign: 'center', marginTop: 8 },
};

export default function ObjectTransformPanel() {
  const { state, dispatch } = useDesign();
  const { placedItems, selectedItemId, placementMode } = state;
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const saveTimeoutRef = useRef(null);

  const selectedItem = placedItems.find(i => i.id === selectedItemId);

  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  if (!selectedItem || placementMode !== 'idle') return null;

  let rawRotY = selectedItem.rotation?.y;
  if (typeof rawRotY === 'string') rawRotY = parseFloat(rawRotY);
  const currentRadians = Number.isFinite(rawRotY) ? rawRotY : 0;
  const currentDegrees = normalizeDeg(radToDeg(currentRadians));

  const updateRotation = (newDegrees) => {
    const normalized = normalizeDeg(newDegrees);
    const newRadians = degToRad(normalized);
    dispatch({
      type: 'UPDATE_ITEM',
      payload: {
        id: selectedItem.id,
        updates: {
          rotation: {
            x: selectedItem.rotation?.x || 0,
            y: newRadians,
            z: selectedItem.rotation?.z || 0,
          },
        },
      },
    });
    setSaveStatus('');
  };

  const handleSliderChange = (e) => updateRotation(Number(e.target.value));
  const rotateBy = (deltaDeg) => updateRotation(currentDegrees + deltaDeg);

  const handleSaveRotation = async () => {
    if (!selectedItem.productId) {
      setSaveStatus('saved');
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus(''), 2500);
      return;
    }
    setSaving(true);
    setSaveStatus('');
    try {
      await patchItemRotation(selectedItem.productId, selectedItem.id, {
        rotation_y: selectedItem.rotation?.y || 0,
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save rotation:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const pos = selectedItem.position;
  const scale = selectedItem.scale?.x || selectedItem.scale || 1;

  const quickBtns = [
    { label: '-90°', delta: -90, Icon: RotateCcw },
    { label: '-15°', delta: -15 },
    { label: '-5°', delta: -5 },
    { label: '+5°', delta: 5 },
    { label: '+15°', delta: 15 },
    { label: '+90°', delta: 90, Icon: RotateCw },
  ];

  return (
    <div style={O.panel} id="transform-panel">
      {/* Header */}
      <div style={O.header}>
        <h3 style={O.headerTitle}>
          <Compass size={16} style={{ color: '#10b981' }} />
          Object Transform
        </h3>
        <button onClick={() => dispatch({ type: 'DESELECT_ALL' })} style={O.closeBtn}
          onMouseEnter={e => e.currentTarget.style.color = '#374151'}
          onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}>
          <X size={16} />
        </button>
      </div>

      <div style={O.body}>
        {/* Object info */}
        <div style={O.nameRow}>
          <span style={O.itemName}>{selectedItem.name}</span>
          {selectedItem.autoDetected && <span style={O.autoBadge}>Auto-detected</span>}
        </div>

        {/* ── Y-Axis Rotation ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={O.sectionLabel}>
              <RotateCw size={12} /> Rotation (Y)
            </span>
            <span style={O.degValue}>{Math.round(currentDegrees)}°</span>
          </div>

          <input type="range" min="0" max="360" step="1"
            value={Math.round(currentDegrees)} onChange={handleSliderChange}
            style={O.sliderInput} />
          <div style={O.sliderLabels}>
            <span>0°</span><span>180°</span><span>360°</span>
          </div>

          {/* Quick rotation buttons */}
          <div style={O.quickGrid}>
            {quickBtns.map((btn, idx) => (
              <button key={idx} onClick={() => rotateBy(btn.delta)} style={O.quickBtn}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.borderColor = '#BBF7D0'; e.currentTarget.style.color = '#059669'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#4B5563'; }}>
                {btn.Icon && <btn.Icon size={10} />}
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Position & Scale ── */}
        <div style={O.detailGrid}>
          <div>
            <div style={O.detailLabel}>Position</div>
            <div style={O.detailBox}>
              <div style={O.coordRow}><span style={O.coordLabel}>X</span><span style={O.coordValue}>{Number(pos?.x || 0).toFixed(1)}</span></div>
              <div style={O.coordRow}><span style={O.coordLabel}>Y</span><span style={O.coordValue}>{Number(pos?.y || 0).toFixed(1)}</span></div>
              <div style={{ ...O.coordRow, marginBottom: 0 }}><span style={O.coordLabel}>Z</span><span style={O.coordValue}>{Number(pos?.z || 0).toFixed(1)}</span></div>
            </div>
          </div>
          <div>
            <div style={O.detailLabel}>Scale</div>
            <div style={O.scaleBox}>
              <span style={O.scaleValue}>{Number(scale || 1).toFixed(2)}</span>
              <span style={O.scaleLabel}>Uniform</span>
            </div>
          </div>
        </div>

        {/* ── Save Button ── */}
        <button onClick={handleSaveRotation} disabled={saving} style={O.saveBtn(saveStatus)}
          onMouseEnter={e => { if (saveStatus !== 'saved') { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#059669'; } }}
          onMouseLeave={e => { if (saveStatus !== 'saved') { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#374151'; } }}>
          {saving ? (
            <><RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving Changes...</>
          ) : saveStatus === 'saved' ? (
            <><CheckCircle2 size={14} /> Transformations Saved</>
          ) : (
            <><Save size={14} /> Save Transformations</>
          )}
        </button>

        {saveStatus === 'error' && <p style={O.errorMsg}>Failed to save — check connection</p>}
      </div>
    </div>
  );
}
