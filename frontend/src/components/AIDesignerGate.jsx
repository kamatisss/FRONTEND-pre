import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Wallet, Sprout, Camera, ArrowRight, Box } from 'lucide-react';
import { PublicHeader } from './ProjectHub';
import GuestAuthModal from './GuestAuthModal';
import aiPreview from '../assets/images/feature-steps/step-3.png';

/*
 * /ai-designer for visitors who aren't signed in. The AI runs on a paid quota, so it
 * needs a free account; this page shows what it does first and offers the free 3D
 * Studio as the no-account alternative. Once signed in, the route renders the designer.
 */

const POINTS = [
  { Icon: Sparkles, title: 'Three layouts in seconds', text: 'Minimalist, lush and more, each a complete plan you can explore in 3D.' },
  { Icon: Wallet,   title: 'Built around your budget', text: 'Every layout comes with a cost breakdown from our real price list.' },
  { Icon: Sprout,   title: 'Plants we actually stock', text: 'Only plants from our nursery, so any design can be ordered and built.' },
  { Icon: Camera,   title: 'See it on your own yard',  text: 'Upload a photo and preview the design on top of it.' },
];

export default function AIDesignerGate() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-widest uppercase text-emerald-700 bg-white border border-emerald-200 rounded-full px-3 py-1 m-0 mb-4">
            <Sparkles size={13} /> AI Garden Designer
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight m-0 mb-4 leading-tight">
            Tell us your yard and budget.<br /><span className="text-emerald-600">AI designs the garden.</span>
          </h1>
          <p className="text-lg text-slate-500 m-0 mb-8 leading-relaxed max-w-xl">
            The AI Designer is free with a Garden Studio account. Sign in and you'll have three ready-to-build layouts in under a minute.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {POINTS.map(({ Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Icon size={17} /></div>
                <div>
                  <p className="font-bold text-slate-800 m-0 text-sm">{title}</p>
                  <p className="text-sm text-slate-500 m-0 leading-snug">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowAuth(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none cursor-pointer shadow-lg shadow-emerald-500/30">
              Sign in to start, free <ArrowRight size={16} />
            </button>
            <Link to="/try-studio" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-slate-300 text-slate-700 font-bold no-underline hover:border-emerald-400">
              <Box size={16} /> Try the 3D Studio first, no account
            </Link>
          </div>
        </div>

        <div className="relative">
          <img src={aiPreview} alt="An AI-generated garden layout shown in the interactive 3D canvas"
               className="w-full rounded-3xl border border-slate-200 shadow-xl block" />
          <span className="absolute -bottom-3 left-6 bg-white border border-slate-200 shadow text-xs font-bold text-slate-600 px-3 py-1.5 rounded-full">
            A real AI layout in the 3D canvas
          </span>
        </div>
      </main>

      {showAuth && (
        <GuestAuthModal
          title="Use the AI Garden Designer"
          subtitle="Create a free account or sign in. It takes under a minute."
          cta="Open AI Designer"
          onClose={() => setShowAuth(false)}
          onAuthSuccess={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
