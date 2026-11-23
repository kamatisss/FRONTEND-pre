import { GROWTH_STAGES, SIZE_MEASURE, GROWN, stageYears } from '../data/modelSizing';

// The "how tall is it" card shown on hover (desktop) or when an item is selected (phones), in the
// 3D Studio (PlacedObject) and the AI Designer's 3D view (ThreeGardenCanvas). One card, so both
// screens always say the same thing.
//   name, shown: metres drawn now (at the current growth stage), stage: years after planting
//   (data/modelSizing.stageYears: a number, GROWN, or an old key)
//   heights: { planting, established, mature } in metres (0 / missing = unknown)
//   category: plants get the growth lines; garden features just say their size
//   notes: designer's notes on this item (AI Designer edits: too close, on the lawn, …), shown in amber
const metres = (v) => `${Math.round(v * 10) / 10} m`;
const yearsAfter = (y) => (y === 2 ? 'about 2 years after planting' : `${y} ${y === 1 ? 'year' : 'years'} after planting`);

//   wide: metres wide at this stage (0 = unknown)
//   growthNote: why something isn't there yet at this stage ("No fruit yet: …", data/plantGrowth.js)
//   matureWhen: when it is fully grown ("about 12 years after planting", data/modelSizing.matureWhen), '' = unknown
//   grown: this plant is at its full size in this view (data/modelSizing.isFullyGrown)
//   specimen: planted height (m) when this plant is ordered in the bigger specimen size, else 0
//   compact: just pointing at it (AI Designer): name and height, and how many warnings, in two short lines; the
//            whole card is for the plant the customer clicks, so a quick look never covers half the garden
//   panel:   the same facts in the details panel under the 3D view (AI Designer): light, larger, not a tooltip,
//            each warning as its point (first sentence, bold) and its advice (the rest)
// `shown` is THIS plant (each is drawn within ±8% of the catalog size, like real nursery stock); the row
// below gives the catalog's typical heights, so it is labelled "Typical".
// Colours for the dark tooltip and the light panel
const DARK = { text: '#fff', sub: '#cbd5e1', faint: '#94a3b8', on: '#6ee7b7', warn: '#FCD34D', note: '#A5F3FC', rule: 'rgba(255,255,255,0.15)' };
const LIGHT = { text: '#0F172A', sub: '#475569', faint: '#64748B', on: '#047857', warn: '#B45309', note: '#0E7490', rule: '#FDE68A' };
// A note: a sentence ("In 10 years its crown … overlap. Plan a yearly trim…" → its first sentence is the point),
// or { point, advice } from the design engine (its short headline for this plant, then the reason)
const splitNote = (n) => {
  if (n && typeof n === 'object') return [n.point, n.advice || ''];
  const m = /^(.+?[.!?])\s+(.+)$/s.exec(n);
  return m ? [m[1], m[2]] : [n, ''];
};
const noteText = (n) => (n && typeof n === 'object' ? n.point : n);

export default function PlantHeightCard({ name, shown, stage = 'established', heights = {}, category = 'plant', notes = [], wide = 0, growthNote = '', matureWhen = '', grown = false, specimen = 0, compact = false, panel = false, style }) {
  const c = panel ? LIGHT : DARK;
  const isPlant = category === 'plant';
  const hasGrowth = isPlant && (heights.planting > 0 || heights.mature > 0);
  const years = stageYears(stage);
  const full = years >= GROWN || (grown && years > 0);
  const when = years <= 0 ? 'when we plant it'
    : years >= GROWN ? `fully grown${matureWhen ? `, ${matureWhen}` : ''}`
      : full ? `${yearsAfter(years)} · fully grown` : yearsAfter(years);
  if (compact) {
    return (
      <div role="tooltip" style={{
        width: 'max-content', maxWidth: 220, padding: '4px 9px', borderRadius: 8,
        background: 'rgba(15,23,42,0.82)', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11.5, lineHeight: 1.35, boxShadow: '0 4px 12px rgba(0,0,0,0.22)', userSelect: 'none',
        pointerEvents: 'none', ...style,
      }}>
        <div style={{ fontWeight: 800 }}>
          {name}{shown > 0 && <> · <span style={{ color: '#6ee7b7' }}>{metres(shown)}</span></>}
        </div>
        {notes.length > 0 && (
          <div style={{ color: '#FCD34D', fontWeight: 700 }}>⚠ {notes.length} {notes.length === 1 ? 'warning' : 'warnings'} · click for details</div>
        )}
      </div>
    );
  }
  return (
    <div role={panel ? undefined : 'tooltip'} style={panel ? {
      color: c.text, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, lineHeight: 1.5, minWidth: 0, ...style,
    } : {
      width: 'max-content', maxWidth: 270, padding: '7px 10px', borderRadius: 10,
      background: 'rgba(15,23,42,0.88)', color: c.text, fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 11.5, lineHeight: 1.4, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', userSelect: 'none',
      pointerEvents: 'none', ...style,
    }}>
      <div style={{ fontWeight: 800, fontSize: panel ? 15 : 12.5 }}>
        {name}{shown > 0 && <> · <span style={{ color: c.on }}>{metres(shown)}</span></>}
      </div>
      {shown > 0 && (
        <div style={{ color: c.sub }}>
          {!isPlant ? (SIZE_MEASURE[category] === 'longest' ? 'across' : 'tall')
            : when}
          {wide > 0 && ` · ${metres(wide)} wide`}
        </div>
      )}
      {hasGrowth && (
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, marginTop: 4, color: c.faint }}>
          <span>Typical</span>
          {GROWTH_STAGES.map(g => {
            const h = heights[g.key];
            if (!h) return null;
            // The catalog size this view shows exactly, if any (in between: none lit)
            // (a specimen is bigger than the standard sizes on the way, so only "Grown" can be its size)
            const on = g.years >= GROWN ? full : g.years === years && !full && !(specimen > 0);
            return (
              <span key={g.key} style={{ color: on ? c.on : c.sub, fontWeight: on ? 800 : 500 }}>
                {g.short} {metres(h)}
              </span>
            );
          })}
        </div>
      )}
      {hasGrowth && matureWhen && !full && heights.mature > 0 && (
        <div style={{ color: c.faint }}>Fully grown {matureWhen}</div>
      )}
      {specimen > 0 && (
        <div style={{ marginTop: 4, color: c.warn, fontWeight: 700 }}>Specimen size: planted at {metres(specimen)}</div>
      )}
      {growthNote && <div style={{ marginTop: 4, color: c.note, fontStyle: 'italic' }}>{growthNote}</div>}
      {panel ? notes.map((n, i) => {
        const [point, advice] = splitNote(n);
        return (
          <div key={i} role="note" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: '#FFFBEB', border: `1px solid ${c.rule}` }}>
            <div style={{ color: c.warn, fontWeight: 700 }}>⚠ {point}</div>
            {advice && <div style={{ marginTop: 2, color: c.sub, fontSize: 12.5 }}>{advice}</div>}
          </div>
        );
      }) : notes.map((n, i) => (
        <div key={i} style={{ marginTop: 5, paddingTop: 5, borderTop: `1px solid ${c.rule}`, color: c.warn, fontWeight: 600 }}>
          ⚠ {noteText(n)}
        </div>
      ))}
    </div>
  );
}
