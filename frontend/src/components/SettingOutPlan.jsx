// The crew's setting-out plan (backend setting_out.py, booking design_details.setting_out): the lot from
// above with every item labelled, and the tape measurements for each one — straight out from the house
// side, then across from the nearer side boundary. Tap a row to find the item on the plan (and back).
// Drawn in lot metres: SVG y = lot z, so the back of the garden is at the top and the house at the bottom.
import { useState } from 'react';

const FILL = { plant: '#16a34a', hardscape: '#78716c', furniture: '#b45309', existing: '#334155' };
const m = (v) => `${Number(v).toFixed(2)} m`;

export default function SettingOutPlan({ data, gardenPlan }) {
  const [picked, setPicked] = useState(null);
  if (!data?.items?.length) {
    return <p className="m-0 p-4 text-sm text-slate-500">This design has no items to set out.</p>;
  }
  const W = Number(data.width) || 10;
  const L = Number(data.length) || 15;
  const pad = Math.max(0.6, Math.min(W, L) * 0.08);
  // Sized from the lot so markers and words stay readable on a phone screen (~13 px)
  const r = Math.max(0.2, Math.min(0.9, Math.min(W, L) / 22));
  const font = Math.max(W, L) / 34;
  const lawn = gardenPlan?.lawn;
  const shapes = [lawn, gardenPlan?.entry].filter(g => g && typeof g === 'object');
  // The yard's own shape (setting_out.yard_outline: Studio lot, survey or garden plan)
  const yardShape = [data?.outline, gardenPlan?.outline].find(o => Array.isArray(o) && o.length >= 3) || null;
  const items = data.items.filter(it => !it.outside);
  const outside = data.items.filter(it => it.outside);

  return (
    <div className="flex flex-col">
      <p className="m-0 px-4 pt-3 text-xs text-slate-600 leading-relaxed">
        Stand at the house facing the garden. Measure <b>straight out from the house side</b>, then <b>across from the nearer side</b>.
        The number before the dot is the item on the work order list.
      </p>
      <div className="px-2 pt-2">
        <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${L + 2 * pad + pad * 0.6}`} className="w-full block"
          style={{ maxHeight: '52vh' }} role="img"
          aria-label={`Lot ${W} by ${L} metres, ${items.length} items, house side at the bottom`}>
          {yardShape ? (
            <>
              {/* A shaped yard: the rest of the lot (house, driveway…) in grey, the yard's outline in bed colour */}
              <rect x={0} y={0} width={W} height={L} fill="#e2e8f0" />
              <polygon points={yardShape.map(p => `${p.x},${p.z}`).join(' ')} fill={shapes.length ? '#e7d3b8' : '#f0fdf4'}
                stroke="#047857" strokeWidth={Math.max(W, L) / 250} />
              {yardShape.map((a, i) => {
                if (!a.house) return null;
                const b = yardShape[(i + 1) % yardShape.length];
                return <line key={`h${i}`} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#0f172a" strokeWidth={Math.max(W, L) / 80} strokeLinecap="round" />;
              })}
            </>
          ) : <rect x={0} y={0} width={W} height={L} fill={shapes.length ? '#e7d3b8' : '#f0fdf4'} />}
          {shapes.map((g, i) => (g.shape === 'ellipse'
            ? <ellipse key={i} cx={g.cx} cy={g.cz} rx={g.rx} ry={g.rz} fill="#bbf7d0" />
            : <rect key={i} x={g.x0} y={g.z0} width={(g.x1 ?? 0) - (g.x0 ?? 0)} height={(g.z1 ?? 0) - (g.z0 ?? 0)} fill="#bbf7d0" />))}
          {/* Paths from the customer's gates and doors */}
          {(gardenPlan?.paths || []).map((g, i) => (
            <rect key={`p${i}`} x={g.x0} y={g.z0} width={g.x1 - g.x0} height={g.z1 - g.z0} fill="#d6cfc2" />))}
          {Array.from({ length: Math.ceil(W) - 1 }, (_, i) => (
            <line key={`x${i}`} x1={i + 1} y1={0} x2={i + 1} y2={L} stroke="#94a3b8" strokeWidth={0.015} opacity={0.6} />))}
          {Array.from({ length: Math.ceil(L) - 1 }, (_, i) => (
            <line key={`z${i}`} x1={0} y1={i + 1} x2={W} y2={i + 1} stroke="#94a3b8" strokeWidth={0.015} opacity={0.6} />))}
          <rect x={0} y={0} width={W} height={L} fill="none" stroke="#047857" strokeWidth={0.06} />
          <line x1={0} y1={L} x2={W} y2={L} stroke="#0f172a" strokeWidth={0.14} />
          <text x={W / 2} y={-pad * 0.35} textAnchor="middle" fontSize={font} fontWeight="700" fill="#475569">Back · {m(W)} wide</text>
          <text x={W / 2} y={L + pad * 0.75} textAnchor="middle" fontSize={font * 1.05} fontWeight="800" fill="#0f172a">House side (measure from here)</text>
          <text x={-pad * 0.25} y={L / 2} textAnchor="end" fontSize={font * 0.9} fontWeight="700" fill="#475569" transform={`rotate(-90 ${-pad * 0.25} ${L / 2})`}>Left</text>
          <text x={W + pad * 0.25} y={L / 2} textAnchor="start" fontSize={font * 0.9} fontWeight="700" fill="#475569" transform={`rotate(90 ${W + pad * 0.25} ${L / 2})`}>Right</text>
          {items.map(it => {
            const on = picked === it.label;
            const fill = FILL[it.category] || FILL.plant;
            return (
              <g key={it.label} onClick={() => setPicked(on ? null : it.label)} style={{ cursor: 'pointer' }}>
                {on && <circle cx={it.x} cy={it.z} r={r * 2} fill="none" stroke="#f59e0b" strokeWidth={0.08} />}
                {on && (
                  <>
                    <line x1={it.x} y1={it.z} x2={it.x} y2={L} stroke="#f59e0b" strokeWidth={0.05} strokeDasharray="0.15 0.1" />
                    <line x1={it.x} y1={it.z} x2={it.side === 'left' ? 0 : W} y2={it.z} stroke="#f59e0b" strokeWidth={0.05} strokeDasharray="0.15 0.1" />
                  </>
                )}
                <circle cx={it.x} cy={it.z} r={r} fill={it.existing ? '#fff' : fill} fillOpacity={it.existing ? 1 : 0.85}
                  stroke={it.existing ? fill : '#fff'} strokeWidth={it.existing ? 0.05 : 0.03} strokeDasharray={it.existing ? '0.08 0.05' : undefined} />
                <text x={it.x} y={it.z + r * 0.3} textAnchor="middle" fontSize={r * (it.label.length > 3 ? 0.68 : 0.85)}
                  fontWeight="800" fill={it.existing ? fill : '#fff'} style={{ pointerEvents: 'none' }}>{it.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {outside.length > 0 && (
        <p className="m-0 mx-4 mt-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {outside.map(it => it.label).join(', ')} {outside.length === 1 ? 'is' : 'are'} outside the lot on the plan. Check with the office.
        </p>
      )}
      <div className="px-4 py-3">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
              <th className="py-1.5 pr-2 font-bold">Label</th>
              <th className="py-1.5 pr-2 font-bold">Item</th>
              <th className="py-1.5 pr-2 font-bold text-right">From house</th>
              <th className="py-1.5 font-bold text-right">From side</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(it => {
              const on = picked === it.label;
              return (
                <tr key={it.label} onClick={() => setPicked(on ? null : it.label)} aria-selected={on}
                  className={`border-t border-slate-100 cursor-pointer ${on ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <td className="py-2 pr-2 font-extrabold text-slate-900 whitespace-nowrap">{it.label}</td>
                  <td className="py-2 pr-2 text-slate-700">{it.name}</td>
                  <td className="py-2 pr-2 text-right font-semibold text-slate-900 whitespace-nowrap">{m(it.from_house)}</td>
                  <td className="py-2 text-right text-slate-700 whitespace-nowrap">{m(it.from_side)} <span className="text-slate-400">{it.side}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
