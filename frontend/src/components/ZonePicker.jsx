import { ScanSearch, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/*
 * Keep-clear zones over the customer's yard photo. The AI scan suggests zones
 * (paths, pools, patios); the customer confirms or changes them with a tap. If the
 * scan fails, the customer marks them — the designer never depends on the scan.
 *
 * Zone ids match the backend (layout_engine.ZONES). In a photo the far side of the
 * garden is at the top, so "background" is the top strip and "foreground" the bottom row.
 */

const AREAS = [
  { id: 'background_perimeter', label: 'Far edge',      top: 0,  height: 28, left: 0,     width: 100 },
  { id: 'midground_left',       label: 'Middle left',   top: 28, height: 32, left: 0,     width: 33.3 },
  { id: 'midground_center',     label: 'Middle',        top: 28, height: 32, left: 33.3, width: 33.4 },
  { id: 'midground_right',      label: 'Middle right',  top: 28, height: 32, left: 66.7, width: 33.3 },
  { id: 'foreground_left',      label: 'Front left',    top: 60, height: 40, left: 0,     width: 33.3 },
  { id: 'foreground_center',    label: 'Front',         top: 60, height: 40, left: 33.3, width: 33.4 },
  { id: 'foreground_right',     label: 'Front right',   top: 60, height: 40, left: 66.7, width: 33.3 },
];
const NAMES = { ...Object.fromEntries(AREAS.map(a => [a.id, a.label])), blocked: 'Centre (occupied area)' };
const pretty = (label) => (label || '').replace(/_/g, ' ');

export default function ZonePicker({ imageUrl, scan, selected, onChange }) {
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(z => z !== id) : [...selected, id]);
  const labelFor = (id) => scan.zones.find(z => z.zone === id)?.label;

  const message = {
    scanning:    { Icon: Loader2,       color: '#059669', text: 'Checking your photo for paths, pools and structures…', spin: true },
    ok:          { Icon: CheckCircle2,  color: '#059669', text: scan.zones.length
                     ? `We found ${scan.zones.length} area${scan.zones.length > 1 ? 's' : ''} to keep clear. Tap to adjust.`
                     : 'No obstacles found. Tap any area with a path, pool or structure to keep it clear.' },
    failed:      { Icon: AlertTriangle, color: '#B45309', text: "We couldn't scan your photo. Tap any areas with paths, pools or structures to keep them clear." },
    unavailable: { Icon: AlertTriangle, color: '#B45309', text: 'Automatic detection is off right now. Tap any areas with paths, pools or structures to keep them clear.' },
  }[scan.status];

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
        <ScanSearch size={15} color="#059669" /> Areas to keep clear
      </div>
      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: message.color, fontWeight: 600, marginBottom: '8px' }}>
          <message.Icon size={14} className={message.spin ? 'animate-spin' : ''} /> {message.text}
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', maxWidth: '520px', aspectRatio: '4 / 3', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #E2E8F0' }}>
        <img src={imageUrl} alt="Your yard" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {AREAS.map(a => {
          const on = selected.includes(a.id);
          return (
            <button
              key={a.id} type="button" onClick={() => toggle(a.id)} disabled={scan.status === 'scanning'}
              aria-pressed={on} aria-label={`${a.label}: ${on ? 'keep clear' : 'plantable'}`}
              style={{
                position: 'absolute', top: `${a.top}%`, left: `${a.left}%`, width: `${a.width}%`, height: `${a.height}%`,
                border: '1px dashed rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4,
                background: on ? 'rgba(220,38,38,0.38)' : 'rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                color: '#fff', fontSize: '0.66rem', fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
              }}
            >
              {on ? `Keep clear${labelFor(a.id) ? ` · ${pretty(labelFor(a.id))}` : ''}` : a.label}
            </button>
          );
        })}
      </div>
      {selected.includes('blocked') && (
        <button type="button" onClick={() => toggle('blocked')}
          style={{ marginTop: '8px', fontSize: '0.72rem', fontWeight: 700, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '99px', padding: '4px 10px', cursor: 'pointer' }}>
          {NAMES.blocked}{labelFor('blocked') ? ` · ${pretty(labelFor('blocked'))}` : ''} ✕
        </button>
      )}
      <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '6px' }}>
        Red areas stay free of new plants in every design.
      </div>
    </div>
  );
}
