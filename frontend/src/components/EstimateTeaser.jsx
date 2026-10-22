import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Sparkles, Box, ArrowRight, Info } from 'lucide-react';
import { getQuickEstimate } from '../services/api';
import { loadStudioDraft, saveStudioDraft, saveAiPrefill } from '../services/guestSession';
import { prefetchStudio } from '../services/prefetch';
import { DEFAULT_TIME_OF_DAY } from '../data/studioLight';

/*
 * Landing "what would my garden cost?" calculator. The server builds a typical planting for the
 * yard from in-stock catalog plants and prices it with the same rate card as the Studio and the
 * AI Designer (GET /pricing/quick/). The result hands the yard size (and budget) to either tool.
 */

const SIDE = { min: 2, max: 50 };
const PRESETS = [
  { label: 'Small', w: 5, l: 4 },
  { label: 'Medium', w: 10, l: 8 },
  { label: 'Large', w: 15, l: 12 },
];
const FULLNESS = [
  { key: 'light',    label: 'Light',    hint: 'Open lawn with a few plants' },
  { key: 'balanced', label: 'Balanced', hint: 'Layered beds along the edges' },
  { key: 'full',     label: 'Full',     hint: 'Lush, every bed planted' },
];
const MODES = [
  { key: 'install', label: 'Crew installs' },
  { key: 'plants',  label: 'Plants only' },
];

const clampSide = (v) => Math.min(SIDE.max, Math.max(SIDE.min, Math.round(Number(v) || SIDE.min)));
const peso = (n) => `₱${Number(n).toLocaleString('en-PH')}`;

function SideInput({ id, label, value, onChange }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = (v) => { const n = clampSide(v); onChange(n); setText(String(n)); };
  return (
    <div className="et-side">
      <label htmlFor={id}>{label}</label>
      <div className="et-stepper">
        <button type="button" onClick={() => commit(value - 1)} disabled={value <= SIDE.min} aria-label={`Smaller ${label.toLowerCase()}`}><Minus size={16} /></button>
        <input id={id} type="number" inputMode="numeric" min={SIDE.min} max={SIDE.max} value={text}
          onChange={e => { setText(e.target.value); if (e.target.value !== '' && Number(e.target.value) >= SIDE.min) onChange(clampSide(e.target.value)); }}
          onBlur={e => commit(e.target.value)} />
        <span className="unit">m</span>
        <button type="button" onClick={() => commit(value + 1)} disabled={value >= SIDE.max} aria-label={`Larger ${label.toLowerCase()}`}><Plus size={16} /></button>
      </div>
    </div>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="et-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

export default function EstimateTeaser() {
  const navigate = useNavigate();
  const [width, setWidth] = useState(10);
  const [length, setLength] = useState(8);
  const [fullness, setFullness] = useState('balanced');
  const [mode, setMode] = useState('install');
  // Only start asking the server once the visitor is close
  const [near, setNear] = useState(() => !window.IntersectionObserver);
  const [result, setResult] = useState(null);     // last answer, tagged with the inputs it was for
  const [failed, setFailed] = useState(false);
  const sectionRef = useRef(null);
  const resultRef = useRef(null);
  const requestNo = useRef(0);
  const area = width * length;
  const inputs = `${area}|${fullness}|${mode}`;
  const loading = !failed && result?.inputs !== inputs;

  useEffect(() => {
    if (near || !sectionRef.current) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, [near]);

  // Debounced: stepping through sizes sends one request, and a late answer never replaces a newer one
  useEffect(() => {
    if (!near) return undefined;
    const no = ++requestNo.current;
    const t = setTimeout(() => {
      getQuickEstimate(area, fullness, mode)
        .then(r => { if (no === requestNo.current) { setResult({ ...r, inputs: `${area}|${fullness}|${mode}` }); setFailed(false); } })
        .catch(() => { if (no === requestNo.current) setFailed(true); });
    }, 300);
    return () => clearTimeout(t);
  }, [near, area, fullness, mode]);

  // No catalog to price from (or the server is down before we ever had a number): leave the page as it was
  if (failed && !result) return null;

  const installed = mode === 'install';
  const single = result && result.low === result.high;
  const lines = result ? result.lines.filter(l => l.amount > 0) : [];
  const biggest = Math.max(1, ...lines.map(l => l.amount));

  const designWithAI = () => {
    saveAiPrefill({
      lotWidth: width, lotLength: length, install: installed, source: 'estimate',
      budgetRange: result ? { min: result.low, max: result.high } : null,
    });
    navigate('/ai-designer');
  };
  const designMyself = () => {
    // Never replace a design the visitor already started; otherwise the Studio opens at their yard size
    if (!loadStudioDraft()?.placedItems?.length) {
      saveStudioDraft({ designName: 'My Garden', placedItems: [], sizeOnly: true,
        dimensions: { width, length, terrainType: 'flat' }, terrainHeight: 1.5, timeOfDay: DEFAULT_TIME_OF_DAY });
    }
    navigate('/try-studio');
  };

  return (
    <section id="estimate" ref={sectionRef} className="et">
      <style>{`
        .et { padding: clamp(64px, 9vw, 104px) 0; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .et-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; align-items: stretch; margin-top: 8px; }
        .et-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 28px; }
        .et-label { display: block; font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
        .et-block + .et-block { margin-top: 24px; }
        .et-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .et-side label { display: block; font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px; }
        .et-stepper { display: flex; align-items: center; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; }
        .et-stepper:focus-within { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
        .et-stepper button { width: 44px; height: 48px; flex-shrink: 0; border: none; background: #f8fafc; color: #0f172a; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .et-stepper button:hover:not(:disabled) { background: #ecfdf5; color: #047857; }
        .et-stepper button:disabled { color: #cbd5e1; cursor: default; }
        .et-stepper input { width: 100%; min-width: 0; border: none; outline: none; text-align: right; font-size: 18px; font-weight: 800; color: #0f172a; padding: 0 2px; background: transparent; -moz-appearance: textfield; }
        .et-stepper input::-webkit-outer-spin-button, .et-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .et-stepper .unit { padding: 0 10px 0 4px; font-size: 14px; font-weight: 700; color: #64748b; }
        .et-presets { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
        .et-presets button { min-height: 36px; padding: 0 12px; border-radius: 99px; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-size: 13px; font-weight: 600; cursor: pointer; }
        .et-presets button[aria-pressed="true"] { border-color: #6ee7b7; background: #ecfdf5; color: #065f46; }
        .et-area { margin-left: auto; font-size: 13px; color: #64748b; font-weight: 600; }
        .et-seg { display: flex; gap: 4px; padding: 4px; background: #f1f5f9; border-radius: 14px; }
        .et-seg button { flex: 1; min-height: 42px; border: none; border-radius: 10px; background: transparent; color: #475569; font-weight: 700; font-size: 14px; cursor: pointer; padding: 0 8px; }
        .et-seg button[aria-pressed="true"] { background: #fff; color: #065f46; box-shadow: 0 1px 3px rgba(15,23,42,0.12); }
        .et-hint { font-size: 13px; color: #64748b; margin: 8px 0 0; }
        .et-result { background: #052e22; color: #ecfdf5; border-color: #052e22; display: flex; flex-direction: column; }
        .et-result .kicker { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6ee7b7; margin: 0 0 8px; }
        .et-price { font-size: clamp(30px, 4vw, 44px); font-weight: 900; letter-spacing: -1px; line-height: 1.1; margin: 0; font-variant-numeric: tabular-nums; transition: opacity .2s; }
        .et-price[data-loading="true"] { opacity: .45; }
        .et-sub { font-size: 14px; color: #a7f3d0; margin: 8px 0 0; }
        .et-lines { list-style: none; margin: 22px 0 0; padding: 0; display: grid; gap: 10px; }
        .et-lines li { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font-size: 13px; }
        .et-lines li span { color: #d1fae5; }
        .et-lines li b { color: #fff; font-variant-numeric: tabular-nums; }
        .et-bar { grid-column: 1 / -1; height: 5px; border-radius: 99px; background: rgba(255,255,255,0.1); overflow: hidden; }
        .et-bar i { display: block; height: 100%; border-radius: 99px; background: #34d399; transition: width .35s ease; }
        .et-note { display: flex; gap: 8px; font-size: 12px; color: #a7f3d0; line-height: 1.5; margin: 20px 0 0; }
        .et-note svg { flex-shrink: 0; margin-top: 2px; }
        .et-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto; padding-top: 24px; }
        .et-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 20px; border-radius: 99px; font-weight: 800; font-size: 14px; cursor: pointer; }
        .et-ai { border: none; background: #10b981; color: #fff; box-shadow: 0 8px 24px rgba(16,185,129,0.35); }
        .et-ai:hover { background: #34d399; }
        .et-self { border: 1.5px solid rgba(255,255,255,0.3); background: transparent; color: #fff; }
        .et-self:hover { border-color: #6ee7b7; }
        .et-live { display: none; }
        .et-skel { height: 44px; width: 70%; border-radius: 10px; background: rgba(255,255,255,0.08); }
        @media (max-width: 900px) {
          .et-grid { grid-template-columns: 1fr; }
          .et-panel { padding: 22px 18px; border-radius: 20px; }
          .et-actions button { flex: 1 1 100%; }
          /* Phones: the result card is below the controls, so a pinned bar shows the price changing */
          .et-live { position: sticky; bottom: 12px; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 10px;
            width: 100%; margin-top: 22px; padding: 12px 16px; border: none; border-radius: 16px; background: #052e22; color: #fff; cursor: pointer;
            box-shadow: 0 10px 30px rgba(2,44,34,0.35); text-align: left; }
          .et-live span { font-size: 12px; color: #a7f3d0; font-weight: 600; }
          .et-live b { font-size: 17px; font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; transition: opacity .2s; }
          .et-live b[data-loading="true"] { opacity: .45; }
        }
        @media (prefers-reduced-motion: reduce) { .et-bar i, .et-price { transition: none; } }
      `}</style>

      <div className="gs-container">
        <div className="gs-section-header">
          <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>Instant estimate</div>
          <h2 className="gs-section-title">What would your garden cost?</h2>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 540, margin: '12px auto 0', lineHeight: 1.65 }}>
            Enter your yard size and get a price range in seconds, worked out from our real plant prices and rates.
          </p>
        </div>

        <div className="et-grid">
          <div className="et-panel">
            <div className="et-block">
              <span className="et-label">Yard size</span>
              <div className="et-sides">
                <SideInput id="et-width" label="Width" value={width} onChange={setWidth} />
                <SideInput id="et-length" label="Length" value={length} onChange={setLength} />
              </div>
              <div className="et-presets">
                {PRESETS.map(p => (
                  <button key={p.label} type="button" aria-pressed={width === p.w && length === p.l}
                    onClick={() => { setWidth(p.w); setLength(p.l); }}>{p.label} · {p.w} × {p.l} m</button>
                ))}
                <span className="et-area">{area.toLocaleString('en-PH')} m²</span>
              </div>
            </div>

            <div className="et-block">
              <span className="et-label">How full?</span>
              <Segmented label="How full" options={FULLNESS} value={fullness} onChange={setFullness} />
              <p className="et-hint">{FULLNESS.find(f => f.key === fullness).hint}</p>
            </div>

            <div className="et-block">
              <span className="et-label">Who plants it?</span>
              <Segmented label="Who plants it" options={MODES} value={mode} onChange={setMode} />
              <p className="et-hint">{installed
                ? 'Includes site preparation, soil, planting labour and delivery.'
                : 'Plants from our nursery delivered to you. You plant them yourself.'}</p>
            </div>

            {result && (
              <button type="button" className="et-live" aria-hidden="true" tabIndex={-1}
                onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                <span>Estimate · see breakdown</span>
                <b data-loading={loading}>{single ? peso(result.total) : <>{peso(result.low)} – {peso(result.high)}</>}</b>
              </button>
            )}
          </div>

          <div className="et-panel et-result" ref={resultRef} style={{ scrollMarginTop: 80 }}>
            <p className="kicker">Estimated cost</p>
            <div aria-live="polite">
              {result ? (
                <>
                  <p className="et-price" data-loading={loading}>
                    {single ? peso(result.total) : <>{peso(result.low)} – {peso(result.high)}</>}
                  </p>
                  <p className="et-sub">
                    About {result.plant_count} plants on {Number(result.area_sqm).toLocaleString('en-PH')} m² · {installed ? 'installed by our crew' : 'delivered'}
                  </p>
                </>
              ) : <div className="et-skel" />}
            </div>

            {lines.length > 0 && (
              <ul className="et-lines" aria-label="What the price includes">
                {lines.map(l => (
                  <li key={l.key}>
                    <span>{l.label}</span><b>{peso(l.amount)}</b>
                    <div className="et-bar" aria-hidden="true"><i style={{ width: `${(l.amount / biggest) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}

            <p className="et-note">
              <Info size={14} />
              <span>
                {installed
                  ? 'A rough guide for a typical layout. Your final price is confirmed after we inspect the site.'
                  : 'Catalog prices plus delivery for a typical mix of plants.'}
                {result?.is_sample_rates ? ' Based on sample rates.' : ''}
              </span>
            </p>

            <div className="et-actions">
              <button type="button" className="et-ai" onClick={designWithAI}><Sparkles size={16} /> Let AI design it for this budget</button>
              <button type="button" className="et-self" onClick={designMyself} onPointerEnter={prefetchStudio} onFocus={prefetchStudio}>
                <Box size={16} /> Design it myself in 3D <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
