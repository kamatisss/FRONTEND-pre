// A small top-down plan of the lot for drawing the yard's shape where the main view is 3D (the Studio's Lot
// drawer). Back of the yard at the top, house side at the bottom, as in Mark your yard. Drag the round corners;
// tap a side's length to pick it (YardShapePanel then offers "house wall" / "add a corner"). Lot metres.
import { useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { sidesOf } from '../data/yardSurvey';

// The browser's focus ring is drawn in plan units here (metres), so a 5 px ring would be 5 m wide: it is off,
// and a focused corner or side is selected instead (the selection is the visible focus).
const snap = (v, hi) => Math.min(hi, Math.max(0, Math.round(v * 10) / 10));

// hintCorner: a corner to show "drag me" on (a ghost dot and a hand moving it in and back), or null. Drawn under
// nothing the customer can touch (pointer-events: none), so the real dot below it still drags.
export default function YardShapePlan({ W, L, outline, selected, onSelect, onChange, hintCorner = null }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const pad = Math.max(W, L) * 0.08;
  const k = Math.max(W, L) / 100;            // marks and text scale with the lot
  const toLot = (e) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: snap(p.x, W), z: snap(p.y, L) };
  };
  const move = (e) => {
    if (drag == null) return;
    const p = toLot(e);
    if (p) onChange(outline.map((c, i) => (i === drag ? { ...c, ...p } : c)));
  };

  return (
    <svg ref={svgRef} viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${L + 2 * pad}`} role="img"
      aria-label={`Plan of your ${W} by ${L} metre lot: back at the top, house side at the bottom`}
      style={{ width: '100%', maxHeight: 280, display: 'block', touchAction: 'none', userSelect: 'none' }}
      onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <rect x={0} y={0} width={W} height={L} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={k * 0.6} strokeDasharray={`${k * 2} ${k * 2}`} />
      {Array.from({ length: Math.floor(W) - 0 }, (_, i) => i + 1).filter(i => i < W).map(i => (
        <line key={`gx${i}`} x1={i} y1={0} x2={i} y2={L} stroke="#cbd5e1" strokeWidth={k * 0.25} />
      ))}
      {Array.from({ length: Math.floor(L) }, (_, i) => i + 1).filter(i => i < L).map(i => (
        <line key={`gz${i}`} x1={0} y1={i} x2={W} y2={i} stroke="#cbd5e1" strokeWidth={k * 0.25} />
      ))}
      <polygon points={outline.map(p => `${p.x},${p.z}`).join(' ')} fill="rgba(16,185,129,0.25)" stroke="#059669" strokeWidth={k * 0.9} />
      {sidesOf(outline).filter(s => s.house).map(s => (
        <line key={`h${s.i}`} x1={s.a.x} y1={s.a.z} x2={s.b.x} y2={s.b.z} stroke="#1e293b" strokeWidth={k * 2.4} strokeLinecap="round" />
      ))}
      <text x={W / 2} y={-pad * 0.35} textAnchor="middle" fontSize={k * 4} fontWeight="700" fill="#64748b">BACK</text>
      <text x={W / 2} y={L + pad * 0.75} textAnchor="middle" fontSize={k * 4} fontWeight="700" fill="#334155">HOUSE SIDE</text>
      {sidesOf(outline).map(s => {
        const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
        const on = selected?.type === 'side' && selected.i === s.i;
        const w = k * (s.house ? 22 : 13);
        return (
          <g key={`s${s.i}`} role="button" tabIndex={0} aria-label={`Side ${s.i + 1}, ${len.toFixed(1)} m${s.house ? ', house wall' : ''}`}
            onClick={() => onSelect({ type: 'side', i: s.i })} onFocus={() => onSelect({ type: 'side', i: s.i })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ type: 'side', i: s.i }); } }}
            style={{ cursor: 'pointer', outline: 'none' }}>
            <rect x={(s.a.x + s.b.x) / 2 - w / 2} y={(s.a.z + s.b.z) / 2 - k * 3.2} width={w} height={k * 6.4} rx={k * 1.2}
              fill={s.house ? '#1e293b' : '#fff'} stroke={on ? '#10b981' : '#94a3b8'} strokeWidth={k * (on ? 1 : 0.4)} />
            <text x={(s.a.x + s.b.x) / 2} y={(s.a.z + s.b.z) / 2 + k * 1.4} textAnchor="middle" fontSize={k * 3.6} fontWeight="700"
              fill={s.house ? '#fff' : '#334155'}>{s.house ? 'House · ' : ''}{len.toFixed(1)} m</text>
          </g>
        );
      })}
      {outline.map((c, i) => {
        const on = selected?.type === 'corner' && selected.i === i;
        return (
          <circle key={`c${i}`} cx={c.x} cy={c.z} r={k * 3.4} fill={on ? '#059669' : '#fff'} stroke={on ? '#fff' : '#059669'} strokeWidth={k * 1.1}
            role="button" tabIndex={0} aria-label={`Corner ${i + 1}: drag to move`} style={{ cursor: 'grab', outline: 'none' }}
            onFocus={() => onSelect({ type: 'corner', i })}
            onPointerDown={e => { e.currentTarget.ownerSVGElement.setPointerCapture?.(e.pointerId); setDrag(i); onSelect({ type: 'corner', i }); }}
            onKeyDown={e => {
              const step = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
              if (!step) return;
              e.preventDefault();
              onChange(outline.map((p, j) => (j === i ? { ...p, x: snap(p.x + step[0], W), z: snap(p.z + step[1], L) } : p)));
            }} />
        );
      })}
      {hintCorner != null && outline[hintCorner] && (() => {
        const c = outline[hintCorner];
        // Toward the middle of the yard: where a customer would usually pull a corner
        const mx = outline.reduce((t, p) => t + p.x, 0) / outline.length, mz = outline.reduce((t, p) => t + p.z, 0) / outline.length;
        const len = Math.hypot(mx - c.x, mz - c.z) || 1, d = Math.max(W, L) * 0.09;
        const dx = ((mx - c.x) / len) * d, dz = ((mz - c.z) / len) * d, hand = k * 11;
        return (
          <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
            <style>{`
              @keyframes yard-hint-drag { 0%, 15% { transform: translate(0, 0); } 55%, 70% { transform: translate(var(--dx), var(--dz)); } 100% { transform: translate(0, 0); } }
              .yard-hint-move { animation: yard-hint-drag 2.4s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) { .yard-hint-move { animation: none; } }
            `}</style>
            <circle cx={c.x} cy={c.z} r={k * 6} fill="none" stroke="#059669" strokeWidth={k * 0.6} strokeDasharray={`${k * 1.5} ${k * 1.5}`} />
            <g className="yard-hint-move" style={{ '--dx': `${dx}px`, '--dz': `${dz}px` }}>
              <circle cx={c.x} cy={c.z} r={k * 3.4} fill="#059669" fillOpacity="0.55" />
              <Hand x={c.x - hand * 0.3} y={c.z - hand * 0.05} width={hand} height={hand} color="#0f172a" fill="#fff" strokeWidth={2} />
            </g>
          </g>
        );
      })()}
    </svg>
  );
}
