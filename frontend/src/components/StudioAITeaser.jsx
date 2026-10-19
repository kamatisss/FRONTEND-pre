import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, X, ArrowRight } from 'lucide-react';
import { useDesign } from '../context/DesignContext';
import { saveAiPrefill, trackFunnel } from '../services/guestSession';
import { useIsPhone } from './ui/useMediaQuery';

/*
 * Floating "Let AI design this yard" card inside the 3D Studio. Carries the lot
 * size and the plants already placed over to the AI Designer. Guests are asked to
 * sign in first (the AI runs on a paid quota); signed-in users go straight there.
 */

const STYLES = [
  { name: 'Minimalist',  bg: 'linear-gradient(135deg,#d1fae5 0%,#a7f3d0 45%,#e2e8f0 100%)' },
  { name: 'Lush',        bg: 'linear-gradient(135deg,#065f46 0%,#10b981 50%,#84cc16 100%)' },
  { name: 'Tropical',    bg: 'linear-gradient(135deg,#14532d 0%,#22c55e 40%,#facc15 100%)' },
];

const clampLot = (v) => Math.max(2, Math.min(100, Number(v) || 0));

export default function StudioAITeaser({ guest, onGate }) {
  const { state, dispatch } = useDesign();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => window.innerWidth >= 900);
  const phone = useIsPhone();

  const { width, length } = state.dimensions;
  const plantIds = [...new Set(state.placedItems
    .map(item => state.products.find(p => p.id === item.productId))
    .filter(p => p && p.category === 'plant')
    .map(p => String(p.id)))];

  const setLot = (field, value) => dispatch({ type: 'SET_DIMENSIONS', payload: { [field]: value } });

  const go = () => {
    saveAiPrefill({ lotWidth: clampLot(width), lotLength: clampLot(length), plantIds });
    if (guest) {
      trackFunnel('ai_teaser_clicked');
      onGate('ai');
    } else {
      navigate('/ai-designer');
    }
  };

  const box = {
    position: 'absolute', left: phone ? 12 : 16, bottom: phone ? 12 : 24, zIndex: 11, fontFamily: "'Inter', system-ui, sans-serif",
  };

  if (!open) {
    return (
      <div style={box}>
        <button onClick={() => setOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, border: 'none',
          background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', fontWeight: 800, fontSize: 13,
          boxShadow: '0 8px 24px rgba(16,185,129,0.35)', cursor: 'pointer',
        }}>
          <Sparkles size={15} /> Let AI design it
        </button>
      </div>
    );
  }

  const input = {
    width: 56, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 8,
    fontSize: 13, fontWeight: 700, color: '#111827', textAlign: 'center',
  };

  return (
    <div style={{ ...box, width: 'min(288px, calc(100% - 24px))', background: '#fff', borderRadius: 16, border: '1px solid #D1FAE5', boxShadow: '0 16px 40px rgba(15,23,42,0.16)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 12px', background: 'linear-gradient(135deg,#ecfdf5,#fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#064e3b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} color="#059669" /> Let AI design this yard
          </p>
          <button onClick={() => setOpen(false)} aria-label="Minimize" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4B5563', lineHeight: 1.5 }}>
          Get three complete layouts that fit your budget, in seconds.
        </p>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 10 }}>
          Yard
          <input type="number" min="2" max="100" step="0.5" value={width} aria-label="Yard width in meters"
                 onChange={e => setLot('width', e.target.value)} onBlur={e => setLot('width', clampLot(e.target.value))} style={input} />
          ×
          <input type="number" min="2" max="100" step="0.5" value={length} aria-label="Yard length in meters"
                 onChange={e => setLot('length', e.target.value)} onBlur={e => setLot('length', clampLot(e.target.value))} style={input} />
          m
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6B7280' }}>
          {plantIds.length
            ? `Uses the ${plantIds.length} plant type${plantIds.length > 1 ? 's' : ''} you picked as favourites.`
            : 'Tip: place a few plants you like and the AI will build around them.'}
        </p>

        {/* Locked previews — a hint of what the AI produces */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {STYLES.map(s => (
            <div key={s.name} style={{ position: 'relative', height: 54, borderRadius: 10, background: s.bg, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(2px)', background: 'rgba(255,255,255,0.15)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                {guest && <Lock size={12} color="#fff" />}
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{s.name}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={go} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#059669', color: '#fff', fontWeight: 800, fontSize: 13,
        }}>
          {guest ? <>Sign in to generate, free <ArrowRight size={14} /></> : <>Open AI Designer <ArrowRight size={14} /></>}
        </button>
        {guest && (
          <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#9CA3AF', textAlign: 'center' }}>
            Free account · your 3D design is kept when you sign in
          </p>
        )}
      </div>
    </div>
  );
}
