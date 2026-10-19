import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Leaf, X, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GardenDesigner from './GardenDesigner';
import GuestAuthModal from './GuestAuthModal';
import { trackFunnel } from '../services/guestSession';

/*
 * /try-studio — the manual 3D Studio, free and without an account.
 * Anything that costs us money or needs an account (AI design, yard-photo terrain,
 * saving, checkout) opens a sign-in prompt; the draft is carried into the account.
 */

const GATES = {
  ai: {
    title: 'Let AI design your garden',
    subtitle: 'Create a free account to generate AI layouts. Your yard size and the plants you picked come with you.',
    cta: 'Open AI Designer',
    to: '/ai-designer',
  },
  save: {
    title: 'Save your garden design',
    subtitle: 'A free account keeps your designs, lets you come back anytime, and lets you book our crew to build it.',
    cta: 'Save My Design',
    to: '/studio',
  },
  photo: {
    title: 'Design on a photo of your own yard',
    subtitle: 'Sign in and our AI turns a photo of your yard into 3D terrain. Your current design comes with you.',
    cta: 'Continue',
    to: '/studio',
  },
  checkout: {
    title: 'Order the plants in your design',
    subtitle: 'Create a free account to check out. Your design and plant list come with you.',
    cta: 'Continue to Checkout',
    to: '/studio',
  },
  signin: {
    title: 'Welcome to Garden Studio',
    subtitle: 'Sign in to save designs, use the AI Designer and book our crew. Your current design comes with you.',
    cta: 'Continue',
    to: '/studio',
  },
};

export default function TryStudio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Decide once on arrival: signing in from the modal navigates explicitly instead
  const [arrivedSignedIn] = useState(() => !!user);
  const [gate,      setGate]      = useState(null);
  const [mobileTip, setMobileTip] = useState(() => window.innerWidth < 768);

  useEffect(() => { if (!arrivedSignedIn) trackFunnel('studio_opened'); }, [arrivedSignedIn]);

  if (arrivedSignedIn) return <Navigate to="/studio" replace />;

  const openGate = (intent) => {
    if (['save', 'photo', 'checkout'].includes(intent)) trackFunnel('save_clicked');
    setGate(intent);
  };

  const onAuthSuccess = (kind) => {
    trackFunnel(kind === 'register' ? 'account_created' : 'signed_in');
    const target = GATES[gate]?.to || '/studio';
    setGate(null);
    navigate(target);
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif", background: '#F9FAFB' }}>
      <header style={{
        height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '0 16px', background: '#fff', borderBottom: '1px solid #E5E7EB', zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <Leaf size={20} color="#10b981" /> Garden Studio
          </Link>
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0',
            padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Free 3D Studio · no account needed
          </span>
        </div>
        <button onClick={() => openGate('signin')} style={{
          padding: '8px 16px', borderRadius: 999, border: '1px solid #D1D5DB', background: '#fff',
          fontSize: 13, fontWeight: 700, color: '#111827', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Sign in
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <GardenDesigner guest onGate={openGate} />

        {mobileTip && (
          <div style={{
            position: 'absolute', top: 64, left: 12, right: 12, zIndex: 35, display: 'flex', gap: 8, alignItems: 'flex-start',
            background: '#0f172a', color: '#fff', borderRadius: 12, padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}>
            <Smartphone size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1 }}>
              Works best on a tablet or computer. On a phone: pick an item from the bottom bar, then tap the ground where you want it. Drag with one finger to look around.
            </span>
            <button onClick={() => setMobileTip(false)} aria-label="Dismiss tip" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {gate && (
        <GuestAuthModal
          title={GATES[gate].title}
          subtitle={GATES[gate].subtitle}
          cta={GATES[gate].cta}
          onClose={() => setGate(null)}
          onAuthSuccess={onAuthSuccess}
        />
      )}
    </div>
  );
}
