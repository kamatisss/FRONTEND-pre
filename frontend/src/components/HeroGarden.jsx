import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Move3d, Hand, Sun, Moon, Sunrise, Sunset, Check } from 'lucide-react';
import { getInventoryItems } from '../services/api';
import { loadStudioDraft, saveStudioDraft } from '../services/guestSession';
import { prefetchStudio, prefetchStudioWhenIdle } from '../services/prefetch';
import { SAMPLE_LOT, SAMPLE_STYLES, sampleGarden, sampleToStudioItems } from '../data/sampleGarden';

const ThreeGardenCanvas = lazy(() => import('./ThreeGardenCanvas'));

/*
 * Landing hero visual: a live 3D garden visitors can turn, restyle and light from sunrise to
 * night, which then opens in the free Studio exactly as they left it. Runs on any device with a
 * real GPU (phones included, in a lighter mode) once the page has loaded; everything else keeps
 * `fallback` (the image carousel).
 */
function hero3DSupport() {
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return null;
  if (navigator.deviceMemory && navigator.deviceMemory < 3) return null;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return null;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe's context
    // Software rendering means no real GPU: the 3D would be slow and drain the battery
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return null;
  } catch {
    return null;
  }
  // Phones, tablets and modest laptops get lighter rendering (see ThreeGardenCanvas `lite`)
  const lite = window.innerWidth < 1024 || isTouch() || (navigator.deviceMemory || 8) < 8;
  return { lite };
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches;

// Same range as the Studio's sun slider (6:00–20:00), so the hand-off keeps the light
const HOURS = { min: 6, max: 20 };
const DEFAULT_HOUR = 16.5;
function hourLabel(h) {
  if (h < 7.5) return { text: 'Sunrise', Icon: Sunrise };
  if (h < 11) return { text: 'Morning', Icon: Sun };
  if (h < 15) return { text: 'Midday', Icon: Sun };
  if (h < 18) return { text: 'Golden hour', Icon: Sunset };
  if (h < 19) return { text: 'Dusk', Icon: Sunset };
  return { text: 'Night · garden lights on', Icon: Moon };
}
const clock = (h) => `${((Math.floor(h) + 11) % 12) + 1}:${String(Math.round((h % 1) * 60)).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;

export default function HeroGarden({ fallback }) {
  const navigate = useNavigate();
  const [plants,  setPlants]  = useState(null);   // catalog plants once ready
  const [support, setSupport] = useState(null);   // { lite } when this device can run it
  const [visible, setVisible] = useState(true);
  const [style,   setStyle]   = useState('lush');
  const [hour,    setHour]    = useState(DEFAULT_HOUR);
  const [engaged, setEngaged] = useState(false);  // touch: the visitor tapped in, so the 3D takes their gestures
  const boxRef = useRef(null);
  const touch = useMemo(() => isTouch(), []);
  const height = useMemo(() => (window.innerWidth < 640 ? 300 : 360), []);

  // Start after the page has loaded and the browser is idle, so the hero text paints first
  useEffect(() => {
    const can = hero3DSupport();
    if (!can) return undefined;
    let cancelled = false;
    let idle = null;
    const start = () => {
      getInventoryItems('plant')
        .then(list => {
          if (cancelled || !sampleGarden(list).length) return;
          setSupport(can);
          setPlants(list);
          prefetchStudioWhenIdle();
        })
        .catch(() => { /* keep the image carousel */ });
    };
    const schedule = () => {
      // cancel must be called through window ("Illegal invocation" if detached)
      idle = window.requestIdleCallback
        ? { id: window.requestIdleCallback(start, { timeout: 3000 }), cancel: (id) => window.cancelIdleCallback(id) }
        : { id: setTimeout(start, 1200), cancel: (id) => clearTimeout(id) };
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      if (idle) idle.cancel(idle.id);
    };
  }, []);

  // Pause rendering while the hero is scrolled out of view (and hand scrolling back to the page)
  useEffect(() => {
    if (!plants || !boxRef.current || !window.IntersectionObserver) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) setEngaged(false);
    }, { threshold: 0.05 });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [plants]);

  const sample = useMemo(() => (plants ? sampleGarden(plants, style) : []), [plants, style]);

  if (!plants) return fallback;

  const existingDraft = loadStudioDraft()?.placedItems?.length > 0;
  const { text: lightText, Icon: LightIcon } = hourLabel(hour);

  const customize = () => {
    // A draft the visitor already started wins; otherwise this exact garden becomes their starting point
    if (!existingDraft) {
      saveStudioDraft({
        designName: `My ${SAMPLE_STYLES.find(s => s.key === style)?.label || ''} Garden`.replace('  ', ' '),
        placedItems: sampleToStudioItems(sample, plants),
        dimensions: { ...SAMPLE_LOT, terrainType: 'flat' },
        terrainHeight: 1.5,
        timeOfDay: Math.min(HOURS.max, Math.max(HOURS.min, hour)),
      });
    }
    navigate('/try-studio');
  };

  return (
    <div ref={boxRef} className="gs-hero3d">
      <style>{`
        .gs-hero3d { border-radius: 20px; overflow: hidden; background: #fff;
          border: 1px solid rgba(16,185,129,0.25); box-shadow: 0 24px 60px rgba(15,23,42,0.14);
          animation: gs-hero3d-in .7s ease-out both; }
        @keyframes gs-hero3d-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .gs-hero3d-stage { position: relative; height: ${height}px; background: #eaf4fb; }
        .gs-hero3d-pill { position: absolute; top: 12px; left: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 99px; background: rgba(2,6,23,0.78); color: #fff; font-size: 12px; font-weight: 700; pointer-events: none; }
        .gs-hero3d-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,0.3); }
        .gs-hero3d-gate { position: absolute; inset: 0; z-index: 3; display: flex; align-items: flex-end; justify-content: center;
          padding-bottom: 18px; background: none; border: none; cursor: pointer; touch-action: pan-y; }
        .gs-hero3d-gate span { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 99px;
          background: rgba(2,6,23,0.8); color: #fff; font-weight: 800; font-size: 13px; }
        .gs-hero3d-done { position: absolute; top: 10px; right: 10px; z-index: 3; display: inline-flex; align-items: center; gap: 6px;
          min-height: 40px; padding: 0 14px; border-radius: 99px; border: none; background: #10b981; color: #fff; font-weight: 800; font-size: 13px; cursor: pointer; }
        .gs-hero3d-controls { padding: 12px 14px 4px; display: grid; gap: 10px; }
        .gs-hero3d-styles { display: flex; gap: 6px; padding: 4px; background: #f1f5f9; border-radius: 12px; }
        .gs-hero3d-styles button { flex: 1; min-height: 38px; border: none; border-radius: 9px; background: transparent; color: #475569;
          font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
        .gs-hero3d-styles button[aria-pressed="true"] { background: #fff; color: #065f46; box-shadow: 0 1px 3px rgba(15,23,42,0.12); }
        .gs-hero3d-time { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 10px; }
        .gs-hero3d-time label { grid-column: 1 / -1; display: flex; justify-content: space-between; font-size: 12px; color: #475569; font-weight: 600; }
        .gs-hero3d-time label b { color: #0f172a; display: inline-flex; align-items: center; gap: 5px; }
        .gs-hero3d-time input { grid-column: 1 / -1; width: 100%; accent-color: #10b981; height: 28px; cursor: pointer; }
        .gs-hero3d-cta { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px 14px; }
        .gs-hero3d-cta p { margin: 0; font-size: 13px; color: #475569; line-height: 1.4; }
        .gs-hero3d-cta button { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; min-height: 44px; padding: 0 18px; border-radius: 99px;
          border: none; background: #10b981; color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; }
        .gs-hero3d-cta button:hover { background: #059669; }
        @media (max-width: 480px) { .gs-hero3d-cta { flex-direction: column; align-items: stretch; text-align: center; }
          .gs-hero3d-cta button { justify-content: center; } }
        @media (prefers-reduced-motion: reduce) { .gs-hero3d { animation: none; } }
      `}</style>

      <div className="gs-hero3d-stage">
        <span className="gs-hero3d-pill"><span className="dot" /> Live 3D · <Move3d size={13} /> {touch ? 'tap, then drag' : 'drag to look around'}</span>

        <Suspense fallback={null}>
          <ThreeGardenCanvas
            plants={sample}
            lotWidth={SAMPLE_LOT.width}
            lotLength={SAMPLE_LOT.length}
            height={height}
            readOnly
            enableZoom={false}
            enablePan={false}
            autoRotate={!reducedMotion() && !engaged}
            active={visible}
            lite={support.lite}
            timeOfDay={hour}
          />
        </Suspense>

        {/* Phones: a swipe over the canvas must scroll the page until the visitor chooses to explore */}
        {touch && !engaged && (
          <button className="gs-hero3d-gate" onClick={() => setEngaged(true)} aria-label="Explore the 3D garden">
            <span><Hand size={15} /> Tap to explore in 3D</span>
          </button>
        )}
        {touch && engaged && (
          <button className="gs-hero3d-done" onClick={() => setEngaged(false)}><Check size={15} /> Done</button>
        )}
      </div>

      <div className="gs-hero3d-controls">
        <div className="gs-hero3d-styles" role="group" aria-label="Garden style">
          {SAMPLE_STYLES.map(s => (
            <button key={s.key} aria-pressed={style === s.key} title={s.hint} onClick={() => setStyle(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className="gs-hero3d-time">
          <label htmlFor="gs-hero-hour">
            <b><LightIcon size={14} /> {lightText}</b>
            <span>{clock(hour)}</span>
          </label>
          <input id="gs-hero-hour" type="range" min={HOURS.min} max={HOURS.max} step="0.25" value={hour}
            onChange={e => setHour(Number(e.target.value))} aria-valuetext={`${clock(hour)}, ${lightText}`} />
        </div>
      </div>

      <div className="gs-hero3d-cta">
        <p><b style={{ color: '#0f172a' }}>{existingDraft ? 'Your design is waiting' : 'Like it? Make it yours.'}</b><br />
          {existingDraft ? 'Pick up where you left off, free.' : 'Open this exact garden in the free Studio and change anything.'}</p>
        <button onClick={customize} onPointerEnter={prefetchStudio} onFocus={prefetchStudio}>
          {existingDraft ? 'Continue designing' : 'Customize this garden'} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
