import { useId, useState } from 'react';
import { Sun, X } from 'lucide-react';
import { SUN_SEASONS, SUN_HOURS, DEFAULT_SUN, clockLabel } from '../data/sunPath';

// "Sun & shade" for the 3D view: the real sun over their yard at a time of day and season (data/sunPath.js),
// so the shadows fall where they will. With the "Show plants" year slider the customer sees how the shade
// grows (in 10 years the plumeria shades the patio at 3 pm). A view setting only, never saved.
//   value: { hour, season } or null (off: the usual fixed daylight); onChange(value | null)
//   facingKnown: the yard's direction was marked (Mark your yard), else north is assumed and it says so
//   up: open the panel above the button (a toolbar at the bottom of the view)
export default function SunControl({ value, onChange, facingKnown = false, touch = false, phone = false, up = false }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const on = !!value;
  const sun = value || DEFAULT_SUN;
  const set = (patch) => onChange({ ...sun, ...patch });
  const toggle = () => {
    if (!on) { onChange({ ...DEFAULT_SUN }); setOpen(true); } else setOpen(o => !o);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`${id}-panel`}
        title="See where the sun is and where the shade falls, at any time of day"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: touch ? 44 : 34, padding: '0 12px',
          borderRadius: 999, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, fontFamily: 'inherit',
          border: `1.5px solid ${on ? '#F59E0B' : 'rgba(255,255,255,0.9)'}`,
          background: on ? '#FFFBEB' : 'rgba(255,255,255,0.92)', color: on ? '#92400E' : '#334155',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
        <Sun size={14} aria-hidden="true" /> {on ? clockLabel(sun.hour) : (phone ? 'Sun' : 'Sun & shade')}
      </button>
      {open && (
        <div id={`${id}-panel`} role="group" aria-label="Sun and shade"
          style={{ position: 'absolute', ...(up ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }), right: 0, zIndex: 6,
            width: phone ? 'min(270px, calc(100vw - 48px))' : 280, padding: '10px 12px 12px', borderRadius: 14,
            background: 'rgba(255,255,255,0.97)', border: '1px solid #FDE68A', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <label htmlFor={`${id}-hour`} style={{ fontSize: 12.5, fontWeight: 800, color: '#78350F' }}>
              Sun at {clockLabel(sun.hour)}
            </label>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close sun settings"
              style={{ display: 'inline-flex', padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <input id={`${id}-hour`} type="range" min={SUN_HOURS[0]} max={SUN_HOURS[1]} step={0.5} value={sun.hour}
            onChange={(e) => set({ hour: Number(e.target.value) })} aria-valuetext={clockLabel(sun.hour)}
            style={{ display: 'block', width: '100%', margin: '6px 0 2px', accentColor: '#F59E0B', cursor: 'pointer' }} />
          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', fontWeight: 600 }}>
            <span>6 am</span><span>Noon</span><span>6 pm</span>
          </div>
          <div role="radiogroup" aria-label="Time of year" style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {SUN_SEASONS.map(s => {
              const picked = sun.season === s.key;
              return (
                <button key={s.key} type="button" role="radio" aria-checked={picked} aria-label={s.label}
                  onClick={() => set({ season: s.key })}
                  style={{ flex: 1, minHeight: touch ? 40 : 30, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 11.5, fontWeight: 800, border: `1px solid ${picked ? '#F59E0B' : '#E2E8F0'}`,
                    background: picked ? '#F59E0B' : '#fff', color: picked ? '#fff' : '#334155' }}>
                  {s.short}
                </button>
              );
            })}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.45, color: '#475569' }}>
            {facingKnown
              ? 'The real sun over your yard, from the direction you marked. Move the years slider to see how the shade grows.'
              : 'Direction not marked yet, so the back of your yard is taken to face north. Mark which way it faces in "Mark your yard" for the real shadows.'}
          </p>
          <button type="button" onClick={() => { onChange(null); setOpen(false); }}
            style={{ marginTop: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, color: '#92400E', textDecoration: 'underline' }}>
            Back to the usual daylight
          </button>
        </div>
      )}
    </div>
  );
}
