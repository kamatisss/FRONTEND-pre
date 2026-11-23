import { Sprout } from 'lucide-react';
import { GROWTH_STOPS, GROWN, stageYears } from '../data/modelSizing';

// "Show plants": a year slider (At planting · 1 · 2 · 5 · 10 years · Fully grown). How big the plants are
// drawn. A view setting only, never saved. Used on the 3D Studio canvas, the AI Designer's 3D view and
// shared designs. value / onChange: years after planting (data/modelSizing: GROWN = each plant fully grown).
// Each plant grows at its own pace (a banana is full size in about 2 years, a plumeria in 10–15), so from
// 5 years on a note says so; each plant's card says when it is fully grown.
// inline: drawn in a toolbar row ABOVE the 3D view (AI Designer), not floating on it: no card of its own, and
// its note is a short line beside the slider instead of a dark bubble over the picture.
const HINTS = {
  later: 'Each plant grows at its own pace: fast plants are full size by now, slow palms and trees are still growing. Point at a plant to see.',
  grown: 'Each plant at its own full size. Fast plants get there in about 2 years, slow palms and trees take 10 or more. Point at a plant to see when.',
};
const SHORT_HINTS = {
  now: 'Drag to see your garden grow.',
  later: 'Fast plants are full size by now; palms and trees are still growing.',
  grown: 'Each plant at its own full size (2 to 10+ years).',
};

export default function GrowthStagePicker({ value, onChange, short = false, inline = false, style }) {
  const years = stageYears(value);
  // The nearest stop (an old key or an in-between value lands on the closest)
  let index = 0;
  GROWTH_STOPS.forEach((s, i) => { if (Math.abs(s.years - years) < Math.abs(GROWTH_STOPS[index].years - years)) index = i; });
  const stop = GROWTH_STOPS[index];
  const hint = stop.years >= GROWN ? HINTS.grown : stop.years >= 5 ? HINTS.later : '';
  const pick = (i) => { if (i !== index) onChange(GROWTH_STOPS[i].years); };

  const slider = (
    <div title="See your garden when planted, in 1 to 10 years, or fully grown"
      style={inline
        ? { width: short ? 220 : 240, flexShrink: 0, fontFamily: "'Inter', system-ui, sans-serif" }
        : {
          width: short ? 214 : 252, padding: '5px 10px 4px', borderRadius: 14,
          border: '1px solid #A7F3D0', background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(6px)', fontFamily: "'Inter', system-ui, sans-serif",
        }}>
      <label htmlFor="growth-years" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#065F46' }}>
        <Sprout size={14} style={{ color: '#059669', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ color: '#64748B', fontWeight: 600 }}>Show plants:</span> {stop.label}
      </label>
      <input id="growth-years" type="range" min={0} max={GROWTH_STOPS.length - 1} step={1} value={index}
        onChange={(e) => pick(Number(e.target.value))}
        aria-valuetext={stop.label} aria-describedby={hint || inline ? 'growth-years-hint' : undefined}
        style={{ display: 'block', width: '100%', margin: '4px 0 0', accentColor: '#059669', cursor: 'pointer', height: 18 }} />
      {/* Tick labels, tappable too (the slider itself is what keyboards and screen readers use) */}
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', margin: '0 -4px' }}>
        {GROWTH_STOPS.map((s, i) => (
          <button key={s.years} type="button" tabIndex={-1} onClick={() => pick(i)}
            style={{
              minWidth: 0, padding: '2px 2px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 10, lineHeight: 1.2, whiteSpace: 'nowrap',
              fontWeight: i === index ? 800 : 600, color: i === index ? '#047857' : '#64748B',
            }}>
            {s.short}
          </button>
        ))}
      </div>
    </div>
  );

  if (inline) {
    // Always a line beside it (never appearing / disappearing), so the toolbar doesn't jump as the slider moves
    const note = stop.years >= GROWN ? SHORT_HINTS.grown : stop.years >= 5 ? SHORT_HINTS.later : SHORT_HINTS.now;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px 14px', flexWrap: 'wrap', minWidth: 0, ...style }}>
        {slider}
        <p id="growth-years-hint" role="status" style={{ margin: 0, flex: '1 1 160px', minWidth: 0, fontSize: 11.5, lineHeight: 1.4, color: '#64748B' }}>
          {note}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', pointerEvents: 'auto', ...style }}>
      {slider}
      {hint && (
        // Under the slider, out of the layout flow (the toolbars around it don't move)
        <p id="growth-years-hint" role="status" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 'max-content', maxWidth: 'min(300px, calc(100vw - 32px))',
          margin: 0, padding: '6px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.86)', color: '#fff',
          fontSize: 11.5, lineHeight: 1.4, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.18)', pointerEvents: 'none',
        }}>
          {hint}
        </p>
      )}
    </div>
  );
}
