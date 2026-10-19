import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Check, Lock, Play, ArrowRight, Sparkles } from 'lucide-react';
import { getInventoryItems } from '../services/api';
import { prefetchStudio } from '../services/prefetch';
import { SAMPLE_LOT, sampleGarden } from '../data/sampleGarden';
import poster from '../assets/images/feature-steps/step-3.png';

// three.js only downloads when a visitor asks for the live preview
const ThreeGardenCanvas = lazy(() => import('./ThreeGardenCanvas'));

const FREE = [
  'Design on a sample yard in real 3D',
  'Place, move and rotate plants, stones and furniture',
  'Morning-to-evening sunlight preview',
  'Live cost estimate as you design',
];
const WITH_ACCOUNT = [
  'AI designs complete layouts for your budget',
  'Turn a photo of your own yard into 3D terrain',
  'Save designs and book our crew',
];

export default function LandingStudioTeaser() {
  const [preview, setPreview] = useState('idle'); // idle | loading | live | error
  const [plants,  setPlants]  = useState([]);

  const loadPreview = () => {
    setPreview('loading');
    getInventoryItems('plant')
      .then(items => { setPlants(sampleGarden(items)); setPreview('live'); })
      .catch(() => setPreview('error'));
  };

  return (
    <section id="try-studio" style={{ padding: '100px 0', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
      <style>{`
        .gs-st-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 56px; align-items: center; }
        .gs-st-list { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .gs-st-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; color: #334155; line-height: 1.5; }
        .gs-st-list .ico { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
        .gs-st-label { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 12px; }
        .gs-st-frame { position: relative; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 24px 60px rgba(15,23,42,0.12); background: #f8fafc; height: 450px; }
        .gs-st-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: saturate(1.05); }
        .gs-st-play {
          position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
          background: linear-gradient(to top, rgba(2,44,34,0.55), rgba(2,44,34,0.1)); border: none; cursor: pointer; color: #fff; width: 100%;
        }
        .gs-st-play-btn { width: 72px; height: 72px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(16,185,129,0.5); transition: transform .2s; }
        .gs-st-play:hover .gs-st-play-btn { transform: scale(1.08); }
        .gs-st-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
        .gs-st-primary { display: inline-flex; align-items: center; gap: 8px; padding: 15px 28px; border-radius: 100px; background: #10b981; color: #fff; font-weight: 800; text-decoration: none; box-shadow: 0 8px 30px rgba(16,185,129,0.35); }
        .gs-st-primary:hover { background: #059669; }
        .gs-st-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 15px 24px; border-radius: 100px; border: 1.5px solid #cbd5e1; color: #0f172a; font-weight: 700; text-decoration: none; }
        .gs-st-secondary:hover { border-color: #10b981; color: #047857; }
        @media (max-width: 900px) { .gs-st-grid { grid-template-columns: 1fr; gap: 36px; } .gs-st-frame { height: 340px; } }
      `}</style>

      <div className="gs-container gs-st-grid">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>Try it now · free</div>
          <h2 className="gs-section-title" style={{ margin: '0 0 14px' }}>Design your garden in 3D. No sign-up.</h2>
          <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.65, margin: '0 0 28px', maxWidth: 520 }}>
            Open the Studio and start placing plants right away. When you're ready, let our AI finish the design for you.
          </p>

          <p className="gs-st-label" style={{ color: '#059669' }}>Free, right now</p>
          <ul className="gs-st-list">
            {FREE.map(t => (
              <li key={t}><span className="ico" style={{ background: '#d1fae5', color: '#047857' }}><Check size={13} strokeWidth={3} /></span>{t}</li>
            ))}
          </ul>
          <p className="gs-st-label" style={{ color: '#64748b', marginTop: 22 }}>With a free account</p>
          <ul className="gs-st-list">
            {WITH_ACCOUNT.map(t => (
              <li key={t}><span className="ico" style={{ background: '#f1f5f9', color: '#64748b' }}><Lock size={11} /></span>{t}</li>
            ))}
          </ul>

          <div className="gs-st-actions">
            <Link to="/try-studio" className="gs-st-primary" onPointerEnter={prefetchStudio} onFocus={prefetchStudio} onTouchStart={prefetchStudio}><Box size={18} /> Open the free 3D Studio</Link>
            <Link to="/ai-designer" className="gs-st-secondary"><Sparkles size={16} /> Let AI design it</Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="gs-st-frame">
            {preview === 'live' ? (
              <Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Loading 3D…</div>}>
                <ThreeGardenCanvas plants={plants} lotWidth={SAMPLE_LOT.width} lotLength={SAMPLE_LOT.length} readOnly enableZoom={false} enablePan={false} />
              </Suspense>
            ) : (
              <>
                <img src={poster} alt="A garden layout in the Garden Studio 3D canvas" className="gs-st-poster" />
                <button className="gs-st-play" onClick={loadPreview} disabled={preview === 'loading'}>
                  <span className="gs-st-play-btn"><Play size={28} fill="#fff" /></span>
                  <span style={{ fontWeight: 800, fontSize: 15, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                    {preview === 'loading' ? 'Loading live 3D preview…' : preview === 'error' ? 'Could not load. Try again' : 'Play with a live 3D preview'}
                  </span>
                </button>
              </>
            )}
          </div>
          {preview === 'live' && (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '12px 0 0' }}>
              Drag to look around. <Link to="/try-studio" style={{ color: '#059669', fontWeight: 700 }}>Open the full Studio <ArrowRight size={12} style={{ verticalAlign: 'middle' }} /></Link> to design your own.
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
