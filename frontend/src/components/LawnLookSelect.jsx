import { Sprout } from 'lucide-react';
import { LAWN_LOOKS } from '../data/grassField';

/** A small pill to choose how long the lawn's grass looks in a 3D view (just mown / natural / long grass). */
export default function LawnLookSelect({ value, onChange, touch = false, short = false, style }) {
  return (
    <label title="How long the lawn's grass looks in the 3D view"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: touch ? 44 : 34, padding: '0 6px 0 12px',
        borderRadius: 999, background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(255,255,255,0.9)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)', color: '#334155', fontSize: '0.75rem', fontWeight: 800, ...style }}>
      <Sprout size={14} aria-hidden="true" />
      {!short && <span>Lawn</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Lawn look"
        style={{ minHeight: touch ? 38 : 28, border: 'none', background: 'transparent', color: '#065F46', fontWeight: 800,
          fontSize: touch ? 16 : '0.75rem', fontFamily: 'inherit', cursor: 'pointer', paddingRight: 2 }}>
        {Object.entries(LAWN_LOOKS).map(([key, l]) => <option key={key} value={key}>{l.label}</option>)}
      </select>
    </label>
  );
}
