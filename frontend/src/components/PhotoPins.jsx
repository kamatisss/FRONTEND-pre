// Shared by the 3D photo overlay (ThreeGardenCanvas) and the pre-design survey (YardSurvey).
import { useRef, useState } from 'react';

const LOUPE = 104;   // px: the magnifier shown while a pin is dragged (a finger hides the pin itself)
const ZOOM = 3;

/* ── Four draggable pins on the yard (photo overlay): corners, or back corners + side edges ── */
// outline: draw the dashed shape between the pins (off for pins on scattered points, 'points' mode); a number = only
//   the first that many pins (the rest sit on its edges). Pins with skip: true aren't shown (not in the photo).
// reach: px a pin may go past the photo's edge (a fence or corner that runs out of the picture); the
//   caller leaves that much room round the photo. good: the pins line up (they turn green).
// loupeUrl: the photo, for the magnifier while dragging. warn: indices of pins to show in red (e.g. off their fence).
export default function CornerPins({ frameRef, corners, labels, onChange, outline = true, reach = 0, good = false, loupeUrl = null, warn = [] }) {
  const drag = useRef(null);
  const [active, setActive] = useState(null);   // { i, w, h } while a pin is dragged
  const move = (e) => {
    const i = drag.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (i == null || !box) return;
    const mx = reach / box.width, my = reach / box.height;
    const u = Math.min(1 + mx, Math.max(-mx, (e.clientX - box.left) / box.width));
    const v = Math.min(1 + my, Math.max(-my, (e.clientY - box.top) / box.height));
    onChange?.(corners.map((c, k) => (k === i ? { ...c, u, v } : c)));
  };
  const end = () => { drag.current = null; setActive(null); };
  const points = (typeof outline === 'number' ? corners.slice(0, outline) : corners).map(c => `${c.u * 100},${c.v * 100}`).join(' ');
  const pinColor = good ? '#10b981' : '#fbbf24';
  const held = active && corners[active.i];
  return (
    <div style={{ position: 'absolute', inset: -reach, zIndex: 5, touchAction: 'none' }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div style={{ position: 'absolute', inset: reach }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          {outline && <polygon points={points} fill={good ? 'rgba(16,185,129,0.10)' : 'rgba(251,191,36,0.10)'} stroke={pinColor} strokeWidth="0.5" vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 2 }} strokeDasharray="6 4" />}
        </svg>
        {corners.map((c, i) => {
          if (c.skip) return null;
          const outside = c.u < 0 || c.u > 1 || c.v < 0 || c.v > 1;
          const bad = warn.includes(i);
          const fill = bad ? '#ef4444' : pinColor;
          return (
            <button key={`${i}-${labels[i]}`} type="button" aria-label={`Move the ${labels[i].toLowerCase()} pin`}
              onPointerDown={(e) => {
                drag.current = i;
                const box = frameRef.current?.getBoundingClientRect();
                setActive({ i, w: box?.width || 0, h: box?.height || 0 });
                e.currentTarget.parentElement.parentElement.setPointerCapture?.(e.pointerId);
                e.preventDefault();
              }}
              style={{ position: 'absolute', left: `${c.u * 100}%`, top: `${c.v * 100}%`, transform: 'translate(-50%, -50%)',
                width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, cursor: 'grab', touchAction: 'none' }}>
              <span style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, transform: 'translate(-50%, -50%)', borderRadius: '50%',
                background: fill, border: `3px ${outside ? 'dashed' : 'solid'} #ffffff`, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
              <span style={{ position: 'absolute', left: '50%', top: c.v > 0.5 ? -14 : 40, whiteSpace: 'nowrap',
                // Near a side of the photo the label reaches inwards, so it isn't cut off
                transform: `translateX(${c.u > 0.8 ? '-88%' : c.u < 0.2 ? '-12%' : '-50%'})`,
                fontSize: 11, fontWeight: 800, color: bad ? '#fff' : '#0f172a', background: bad ? 'rgba(239,68,68,0.95)' : good ? 'rgba(167,243,208,0.97)' : 'rgba(251,191,36,0.95)', borderRadius: 4,
                padding: '1px 6px', pointerEvents: 'none' }}>
                {labels[i]}{outside ? ' · off the photo' : ''}
              </span>
            </button>
          );
        })}
        {held && loupeUrl && active.w > 0 && (() => {
          // Above the finger (below it near the top), the photo at 3× round the pin, with a crosshair
          const x = held.u * active.w, y = held.v * active.h;
          const top = y - LOUPE - 34 < -reach ? y + 34 : y - LOUPE - 34;
          const left = Math.min(active.w + reach - LOUPE, Math.max(-reach, x - LOUPE / 2));
          return (
            <div aria-hidden="true" style={{ position: 'absolute', left, top, width: LOUPE, height: LOUPE, borderRadius: '50%', overflow: 'hidden',
              border: `3px solid ${pinColor}`, boxShadow: '0 4px 14px rgba(0,0,0,0.45)', pointerEvents: 'none', background: '#0f172a' }}>
              <div style={{ position: 'absolute', left: LOUPE / 2 - x * ZOOM, top: LOUPE / 2 - y * ZOOM, width: active.w * ZOOM, height: active.h * ZOOM,
                backgroundImage: `url("${loupeUrl}")`, backgroundSize: '100% 100%' }} />
              <div style={{ position: 'absolute', left: LOUPE / 2 - 0.75, top: 14, bottom: 14, width: 1.5, background: 'rgba(255,255,255,0.9)' }} />
              <div style={{ position: 'absolute', top: LOUPE / 2 - 0.75, left: 14, right: 14, height: 1.5, background: 'rgba(255,255,255,0.9)' }} />
              <div style={{ position: 'absolute', left: LOUPE / 2 - 4, top: LOUPE / 2 - 4, width: 8, height: 8, borderRadius: '50%', border: `2px solid ${pinColor}` }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
