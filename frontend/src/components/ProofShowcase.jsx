import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, Camera, MapPin, Clock } from 'lucide-react';
import { getProjectShowcase } from '../services/api';
import { CompareSlider } from './ProjectHub';

/* Landing page proof: real finished projects, Before ↔ After and 3D design ↔ Built.
   Only real, published, customer-approved photos (the API applies the same privacy rules
   as the project page). Renders nothing until such a project exists. */

const MODES = {
  before: { label: 'Before → After', Icon: Camera, left: 'before_url', leftLabel: 'Before', note: 'The same yard, before our crew started and after they finished.' },
  design: { label: '3D design → Built', Icon: Box, left: 'render_url', leftLabel: '3D design', note: 'The design the homeowner approved in our 3D Studio, and the garden we built from it.' },
};

export default function ProofShowcase() {
  const [projects, setProjects] = useState([]);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    getProjectShowcase(3).then(setProjects).catch(() => {});
  }, []);

  if (!projects.length) return null;
  const p = projects[Math.min(idx, projects.length - 1)];
  const available = Object.keys(MODES).filter(k => p[MODES[k].left]);
  // Prefer the design comparison: it shows what makes us different
  const current = available.includes(mode) ? mode : (available.includes('design') ? 'design' : available[0]);
  const m = MODES[current];

  return (
    <section id="results" className="gs-proof" style={{ padding: 'clamp(56px, 8vw, 96px) 0', background: '#ffffff' }}>
      <div className="gs-container">
        <div className="gs-section-header">
          <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>Real results</div>
          <h2 className="gs-section-title">Designed in 3D. Built by our crew.</h2>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 560, margin: '12px auto 0', lineHeight: 1.65 }}>
            Real gardens from our Project Hub. Drag the slider to compare.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] gap-6 lg:gap-10 items-start">
          {/* Slider first on phones */}
          <div className="lg:order-2">
            {available.length > 1 && (
              <div className="flex p-1 mb-3 bg-slate-100 rounded-xl" role="group" aria-label="What to compare">
                {available.map(k => {
                  const { label, Icon } = MODES[k];
                  return (
                    <button key={k} onClick={() => setMode(k)} aria-pressed={current === k}
                      className={`flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-bold border-none cursor-pointer
                        ${current === k ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}>
                      <Icon size={15} /> {label}
                    </button>
                  );
                })}
              </div>
            )}
            <CompareSlider key={`${p.slug}-${current}`} leftUrl={p[m.left]} rightUrl={p.after_url} leftLabel={m.leftLabel} rightLabel="Built" />
            <p className="text-sm text-slate-500 mt-3 mb-0">{m.note}</p>
          </div>

          <div className="lg:order-1">
            {projects.length > 1 && (
              <ul className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 -mx-1 px-1 m-0 list-none" aria-label="Projects">
                {projects.map((proj, i) => (
                  <li key={proj.slug} className="shrink-0 lg:shrink">
                    <button onClick={() => setIdx(i)} aria-pressed={i === idx}
                      className={`w-full text-left px-4 py-3 rounded-2xl border cursor-pointer transition-colors min-w-[220px] lg:min-w-0
                        ${i === idx ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <p className="font-bold text-slate-900 m-0 text-sm">{proj.title}</p>
                      <p className="text-xs text-slate-500 m-0 mt-0.5">{proj.service_type}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-extrabold tracking-widest uppercase text-emerald-600 m-0 mb-1">{p.service_type}</p>
              <h3 className="text-lg font-black text-slate-900 m-0 mb-3">{p.title}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mb-4">
                {p.city && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-emerald-600" />{p.city}</span>}
                {p.duration_days && <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-emerald-600" />Built in {p.duration_days} day{p.duration_days > 1 ? 's' : ''}</span>}
              </div>
              <Link to={`/projects/${p.slug}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 no-underline hover:text-emerald-800">
                See the full project <ArrowRight size={15} />
              </Link>
            </div>

            <Link to="/try-studio" className="mt-4 hidden lg:flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-slate-900 hover:bg-slate-700 text-white no-underline">
              <span><b>Want this for your yard?</b><br /><span className="text-sm text-slate-300">Design it in 3D first, free.</span></span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
