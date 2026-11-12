import { Box, MapPin } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { MODEL_CREDITS } from '../data/modelCredits';

/* /credits — the 3D models by other artists that our Studio, AI Designer and shop use, and the map and
   address data behind the address form, with the credit their licences ask for (data/modelCredits.js). */
const MAP_CREDITS = [
  { what: 'Barangay boundaries (finding your town and barangay from the map pin)',
    text: <>National Mapping and Resource Information Authority (NAMRIA) and Philippine Statistics Authority (PSA), through{' '}
      <a href="https://data.humdata.org/dataset/cod-ab-phl" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-semibold">OCHA's Philippines administrative boundaries (COD-AB)</a>,
      licensed under <a href="https://creativecommons.org/licenses/by/3.0/igo/legalcode" target="_blank" rel="noopener noreferrer" className="text-emerald-700">CC BY-IGO 3.0</a>;
      prepared as web maps by <a href="https://github.com/faeldon/philippines-json-maps" target="_blank" rel="noopener noreferrer" className="text-emerald-700">philippines-json-maps</a> (MIT).
      Boundaries simplified for the web; not an official survey.</> },
  { what: 'Town and barangay names and codes',
    text: <>Philippine Standard Geographic Code (PSGC), Philippine Statistics Authority, via{' '}
      <a href="https://psgc.gitlab.io/api/" target="_blank" rel="noopener noreferrer" className="text-emerald-700">psgc.gitlab.io</a>.</> },
  { what: 'Map and place centres',
    text: <>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-emerald-700">OpenStreetMap contributors</a> (ODbL).</> },
];
export default function ModelCredits() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <SiteHeader />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Box size={22} /></span>
            <h1 className="m-0 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Credits: 3D models</h1>
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

          <div className="flex items-center gap-3 mt-10">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><MapPin size={22} /></span>
            <h2 className="m-0 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Map and address data</h2>
          </div>
          <ul className="m-0 mt-5 p-0 list-none flex flex-col gap-4">
            {MAP_CREDITS.map(c => (
              <li key={c.what} className="border border-slate-200 rounded-xl p-4">
                <p className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">{c.what}</p>
                <p className="m-0 mt-1 text-[15px] text-slate-800 leading-relaxed">{c.text}</p>
              </li>
            ))}
          </ul>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
