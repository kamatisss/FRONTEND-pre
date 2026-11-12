// "Line up your photo" (YardSurvey step 1): the yard seen from above with where the photo was taken from and the
// ground it shows, so a wrong pin or size is plain to see ("I wasn't standing 40 m behind my house!") without
// any maths. Pure SVG from the solved camera (data/photoPose.js).
import { useMemo } from 'react';
import { lotShareInside, photoFootprint } from '../data/photoPose';

export default function PhotoPlanCheck({ pose, photoW, photoH, W, L, good }) {
  const view = useMemo(() => {
    const far = Math.max(W, L) * 3 + 10;
    const footprint = photoFootprint(pose, photoW, photoH, far);
    const cap = Math.max(W, L) * 2;                     // a camera farther off is drawn at this distance, marked "far"
    const raw = { x: pose.position[0], z: pose.position[2] };
    const cam = { x: Math.min(W + cap, Math.max(-cap, raw.x)), z: Math.min(L + cap, Math.max(-cap, raw.z)) };
    const x0 = Math.min(-1, cam.x - 1.5), x1 = Math.max(W + 1, cam.x + 1.5);
    const z0 = Math.min(-1, cam.z - 1.5), z1 = Math.max(L + 1, cam.z + 1.5);
    const fwd = { x: -pose.axes.back[0], z: -pose.axes.back[2] };
    const n = Math.hypot(fwd.x, fwd.z) || 1;
    return { footprint, share: lotShareInside(footprint, W, L), cam, far: cam.x !== raw.x || cam.z !== raw.z,
      box: { x0, z0, w: x1 - x0, h: z1 - z0 }, dir: { x: fwd.x / n, z: fwd.z / n } };
  }, [pose, photoW, photoH, W, L]);
  const { box, cam, dir } = view;
  const fs = Math.max(box.w, box.h) * 0.05;          // text size in metres, so it reads the same on any yard
  const accent = good ? '#059669' : '#d97706';
  const clipId = `pc-${Math.round(W * 10)}-${Math.round(L * 10)}`;
  return (
    <figure className="m-0 flex flex-col items-center gap-1" style={{ width: 'min(100%, 220px)' }}>
      <svg viewBox={`${box.x0} ${box.z0} ${box.w} ${box.h}`} role="img" preserveAspectRatio="xMidYMid meet"
        aria-label={`Your yard from above: the photo was taken about ${pose.cameraHeight.toFixed(1)} m up and shows ${Math.round(view.share * 100)}% of it`}
        style={{ width: '100%', maxHeight: 240, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <defs><clipPath id={clipId}><rect x={box.x0} y={box.z0} width={box.w} height={box.h} /></clipPath></defs>
        <rect x={0} y={0} width={W} height={L} fill="#ecfdf5" stroke="#059669" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <polygon clipPath={`url(#${clipId})`} points={view.footprint.map((p) => `${p.x},${p.z}`).join(' ')}
          fill={good ? 'rgba(16,185,129,0.22)' : 'rgba(251,191,36,0.28)'} stroke={accent} strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
        <text x={W / 2} y={fs * 1.15} textAnchor="middle" fontSize={fs * 0.8} fontWeight="700" fill="#64748b">Back</text>
        <text x={W / 2} y={L - fs * 0.4} textAnchor="middle" fontSize={fs * 0.8} fontWeight="700" fill="#64748b">House side</text>
        <line x1={cam.x} y1={cam.z} x2={cam.x + dir.x * fs * 2.2} y2={cam.z + dir.z * fs * 2.2} stroke="#0f172a" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <circle cx={cam.x} cy={cam.z} r={fs * 0.55} fill="#0f172a" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <text x={cam.x + fs * 0.85} y={cam.z + fs * 0.3} textAnchor="start" fontSize={fs * 0.8} fontWeight="800" fill="#0f172a"
          stroke="#f8fafc" strokeWidth={fs * 0.18} paintOrder="stroke">
          {view.far ? 'You (far away)' : 'You'}
        </text>
      </svg>
      <figcaption className="text-[11px] leading-snug text-slate-600 text-center">
        From above: you took the photo here, about <b>{pose.cameraHeight.toFixed(1)} m</b> up. Shaded: the ground it shows
        ({Math.round(view.share * 100)}% of your yard{view.share < 0.95 ? '; mark the rest on the plan next' : ''}).
      </figcaption>
    </figure>
  );
}
