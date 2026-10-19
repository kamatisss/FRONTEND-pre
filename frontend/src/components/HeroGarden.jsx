import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Move3d } from 'lucide-react';
import { getInventoryItems } from '../services/api';
import { loadStudioDraft, saveStudioDraft } from '../services/guestSession';
import { prefetchStudio, prefetchStudioWhenIdle } from '../services/prefetch';
import { SAMPLE_LOT, sampleGarden, sampleToStudioItems } from '../data/sampleGarden';

const ThreeGardenCanvas = lazy(() => import('./ThreeGardenCanvas'));
const HEIGHT = 420;

/*
 * Landing hero visual: a live 3D garden visitors can turn right away, which opens
 * in the free Studio ready to customise. Only on capable desktops, and only after the
 * page has loaded; everyone else keeps `fallback` (the image carousel).
 */
function canRunHero3D() {
  if (window.innerWidth < 1024) return false;
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe's context
    // Software rendering means no real GPU: the 3D would be slow and drain the battery
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return false;
  } catch {
    return false;
  }
  return true;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function HeroGarden({ fallback }) {
  const navigate = useNavigate();
  const [garden,  setGarden]  = useState(null); // { sample, plants } once ready
  const [visible, setVisible] = useState(true);
  const boxRef = useRef(null);

  // Start after the page has loaded and the browser is idle, so the hero text paints first
  useEffect(() => {
    if (!canRunHero3D()) return;
    let cancelled = false;
    let idle = null;
    const start = () => {
      getInventoryItems('plant')
        .then(plants => {
          const sample = sampleGarden(plants);
          if (cancelled || !sample.length) return;
          setGarden({ sample, plants });
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

  // Pause rendering while the hero is scrolled out of view
  useEffect(() => {
    if (!garden || !boxRef.current || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [garden]);

  if (!garden) return fallback;

  const existingDraft = loadStudioDraft()?.placedItems?.length > 0;

  const customize = () => {
    // A draft the visitor already started wins; otherwise this garden becomes their starting point
    if (!existingDraft) {
      saveStudioDraft({
        designName: 'My Garden',
        placedItems: sampleToStudioItems(garden.sample, garden.plants),
        dimensions: { ...SAMPLE_LOT, terrainType: 'flat' },
        terrainHeight: 1.5,
        timeOfDay: 14,
      });
    }
    navigate('/try-studio');
  };

  return (
    <div ref={boxRef} className="gs-hero3d">
      <style>{`
        .gs-hero3d { position: relative; border-radius: 20px; overflow: hidden; height: ${HEIGHT}px;
          border: 1px solid rgba(16,185,129,0.25); box-shadow: 0 24px 60px rgba(15,23,42,0.14); background: #f8fafc;
          animation: gs-hero3d-in .7s ease-out both; }
        @keyframes gs-hero3d-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .gs-hero3d-pill { position: absolute; top: 14px; left: 14px; z-index: 2; display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 99px; background: rgba(2,6,23,0.78); color: #fff; font-size: 12px; font-weight: 700; pointer-events: none; }
        .gs-hero3d-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,0.3); }
        .gs-hero3d-cta { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 2; display: flex; align-items: center;
          justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.92);
          backdrop-filter: blur(8px); border: 1px solid #e2e8f0; }
        .gs-hero3d-cta p { margin: 0; font-size: 13px; color: #475569; line-height: 1.4; }
        .gs-hero3d-cta button { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 10px 16px; border-radius: 99px;
          border: none; background: #10b981; color: #fff; font-weight: 800; font-size: 13px; cursor: pointer; }
        .gs-hero3d-cta button:hover { background: #059669; }
        @media (prefers-reduced-motion: reduce) { .gs-hero3d { animation: none; } }
      `}</style>

      <span className="gs-hero3d-pill"><span className="dot" /> Live 3D · <Move3d size={13} /> drag to look around</span>

      <Suspense fallback={null}>
        <ThreeGardenCanvas
          plants={garden.sample}
          lotWidth={SAMPLE_LOT.width}
          lotLength={SAMPLE_LOT.length}
          height={HEIGHT}
          readOnly
          enableZoom={false}
          enablePan={false}
          autoRotate={!reducedMotion()}
          active={visible}
        />
      </Suspense>

      <div className="gs-hero3d-cta">
        <p><b style={{ color: '#0f172a' }}>{existingDraft ? 'Your design is waiting' : 'Like it? Make it yours.'}</b><br />
          {existingDraft ? 'Pick up where you left off, free.' : 'Open this garden in the free Studio and change anything.'}</p>
        <button onClick={customize} onPointerEnter={prefetchStudio} onFocus={prefetchStudio}>
          {existingDraft ? 'Continue designing' : 'Customize this garden'} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
