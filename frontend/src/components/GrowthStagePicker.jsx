import { Sprout } from 'lucide-react';
import { GROWTH_STAGES, DEFAULT_GROWTH_STAGE } from '../data/modelSizing';

// "At planting · In 2 years · Fully grown": how big the plants are drawn. A view setting only, never saved.
// Used on the 3D Studio canvas and the AI Designer's 3D view.
export default function GrowthStagePicker({ value, onChange, short = false, style }) {
  const current = value || DEFAULT_GROWTH_STAGE;
  return (
    <div role="radiogroup" aria-label="Show plants" title="See your plants when planted, after about 2 years, or fully grown"
      style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 999, pointerEvents: 'auto',
        border: '1px solid #A7F3D0', background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(6px)', ...style,
      }}>
      <Sprout size={14} style={{ color: '#059669', margin: '0 2px 0 6px', flexShrink: 0 }} aria-hidden="true" />
      {GROWTH_STAGES.map(g => {
        const on = current === g.key;
        return (
          <button key={g.key} type="button" role="radio" aria-checked={on} aria-label={g.label}
            onClick={() => onChange(g.key)}
            style={{
              minHeight: 30, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 800, background: on ? '#059669' : 'transparent', color: on ? '#fff' : '#065F46',
            }}>
            {short ? g.short : g.label}
          </button>
        );
      })}
    </div>
  );
}
