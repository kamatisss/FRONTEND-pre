import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';

// Any address the app doesn't know (an old link, a typo): say so, and offer the way back.
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-md">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Leaf size={26} /></span>
          <p className="m-0 mt-5 text-sm font-bold uppercase tracking-wider text-emerald-700">Page not found</p>
          <h1 className="m-0 mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">This path leads nowhere</h1>
          <p className="m-0 mt-3 text-slate-600">The page may have moved, or the link has a typo. Everything else is still here.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/" className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold no-underline inline-flex items-center">Go to the home page</Link>
            <Link to="/try-studio" className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold no-underline inline-flex items-center">Design a garden</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
