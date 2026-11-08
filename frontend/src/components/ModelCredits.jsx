import { Box } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { MODEL_CREDITS } from '../data/modelCredits';

/* /credits — the 3D models by other artists that our Studio, AI Designer and shop use, with the
   credit their licences ask for (data/modelCredits.js). */
export default function ModelCredits() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Box size={22} /></span>
            <h1 className="m-0 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">3D model credits</h1>
          </div>
          <p className="m-0 mt-4 text-[15px] text-slate-600 leading-relaxed">
            Some of the 3D plants and furniture in our Studio, AI Designer and shop were made by other artists and shared under
            open licences. Thank you to them.
          </p>
          <ul className="m-0 mt-6 p-0 list-none flex flex-col gap-4">
            {MODEL_CREDITS.map(c => (
              <li key={c.url} className="border border-slate-200 rounded-xl p-4">
                <p className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">{c.product}</p>
                <p className="m-0 mt-1 text-[15px] text-slate-800 leading-relaxed">
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700">"{c.title}"</a>
                  {' '}by {c.author}, licensed under{' '}
                  <a href={c.license.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700">{c.license.name}</a>.
                </p>
                {c.changes && <p className="m-0 mt-1 text-sm text-slate-500">Changes: {c.changes}</p>}
              </li>
            ))}
          </ul>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
