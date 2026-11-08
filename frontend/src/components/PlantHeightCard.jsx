import { GROWTH_STAGES, SIZE_MEASURE } from '../data/modelSizing';

// The "how tall is it" card shown on hover (desktop) or when an item is selected (phones), in the
// 3D Studio (PlacedObject) and the AI Designer's 3D view (ThreeGardenCanvas). One card, so both
// screens always say the same thing.
//   name, shown: metres drawn now (at the current growth stage), stage: 'planting' | 'established' | 'mature'
//   heights: { planting, established, mature } in metres (0 / missing = unknown)
//   category: plants get the growth lines; garden features just say their size
//   notes: designer's notes on this item (AI Designer edits: too close, on the lawn, …), shown in amber
const metres = (v) => `${Math.round(v * 10) / 10} m`;

//   wide: metres wide at this stage (0 = unknown)
//   growthNote: why something isn't there yet at this stage ("No fruit yet: …", data/plantGrowth.js)
export default function PlantHeightCard({ name, shown, stage = 'established', heights = {}, category = 'plant', notes = [], wide = 0, growthNote = '', style }) {
  const isPlant = category === 'plant';
  const hasGrowth = isPlant && (heights.planting > 0 || heights.mature > 0);
  return (
    <div role="tooltip" style={{
      width: 'max-content', maxWidth: 270, padding: '7px 10px', borderRadius: 10,
      background: 'rgba(15,23,42,0.88)', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 11.5, lineHeight: 1.4, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', userSelect: 'none',
      pointerEvents: 'none', ...style,
    }}>
      <div style={{ fontWeight: 800, fontSize: 12.5 }}>
        {name}{shown > 0 && <> · <span style={{ color: '#6ee7b7' }}>{metres(shown)}</span></>}
      </div>
      {shown > 0 && (
        <div style={{ color: '#cbd5e1' }}>
          {!isPlant ? (SIZE_MEASURE[category] === 'longest' ? 'across' : 'tall')
            : stage === 'planting' ? 'when we plant it' : stage === 'mature' ? 'fully grown' : 'about 2 years after planting'}
          {wide > 0 && ` · ${metres(wide)} wide`}
        </div>
      )}
      {hasGrowth && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, color: '#94a3b8' }}>
          {GROWTH_STAGES.map(g => {
            const h = heights[g.key];
            if (!h) return null;
            const on = g.key === stage;
            return (
              <span key={g.key} style={{ color: on ? '#6ee7b7' : '#cbd5e1', fontWeight: on ? 800 : 500 }}>
                {g.short} {metres(h)}
              </span>
            );
          })}
        </div>
      )}
      {growthNote && <div style={{ marginTop: 4, color: '#A5F3FC', fontStyle: 'italic' }}>{growthNote}</div>}
      {notes.map((n, i) => (
        <div key={i} style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,0.15)', color: '#FCD34D', fontWeight: 600 }}>
          ⚠ {n}
        </div>
      ))}
    </div>
  );
}
