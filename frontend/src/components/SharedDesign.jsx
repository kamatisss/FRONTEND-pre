import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye, Leaf, Move3d, ReceiptText, Sparkles, Images } from 'lucide-react';
import { useToast } from './ui/Toast';
import { saveBlob, glbFileName, fileSize } from './ui/download';
import { PublicHeader, PageEnd } from './ProjectHub';
import GrowthStagePicker from './GrowthStagePicker';
import { DEFAULT_GROWTH_STAGE } from '../data/modelSizing';
import { peso } from '../data/projectHub';
import { useIsPhone } from './ui/useMediaQuery';
import { getSharedDesign } from '../services/api';

const ThreeGardenCanvas = lazy(() => import('./ThreeGardenCanvas'));

const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const CATEGORY_LABEL = { plant: 'Plants', hardscape: 'Garden features', furniture: 'Seating' };

// Share links are private: keep this page out of search results while it's open
function useNoIndex(title) {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    if (!title) return undefined;
    const before = document.title;
    document.title = `${title} · Garden design`;
    return () => { document.title = before; };
  }, [title]);
}

/*
 * /d/:token — a design someone shared from the AI Designer. Anyone with the link can turn it in 3D
 * and see the plant list and the estimate; nothing here can change it. The server leaves out the
 * yard photo and anything about who made it (share.py).
 */
export default function SharedDesign() {
  const { token } = useParams();
  const phone = useIsPhone();
  const [loaded, setLoaded] = useState({ token: null });
  const [growthStage, setGrowthStage] = useState(DEFAULT_GROWTH_STAGE);
  const canvasRef = useRef(null);
  const [glbBusy, setGlbBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    getSharedDesign(token)
      .then(design => setLoaded({ token, design }))
      .catch(e => setLoaded({ token, error: e.message }));
  }, [token]);

  // Ignore the previous link's result while the next one loads
  const design = loaded.token === token ? loaded.design : null;
  const error = loaded.token === token ? loaded.error : null;
  useNoIndex(design?.name);

  // The owner only: their design as a .glb file (people with just the link view it here)
  const downloadGlb = async () => {
    if (!canvasRef.current || glbBusy) return;
    setGlbBusy(true);
    try {
      const blob = await canvasRef.current.exportGlb({ title: design.name });
      const name = glbFileName(design.name);
      saveBlob(blob, name);
      toast({ id: 'glb', type: 'success', title: '3D file downloaded', message: `${name} · ${fileSize(blob.size)}` });
    } catch (e) {
      toast({ id: 'glb', type: 'error', title: "Couldn't make the 3D file", message: e.message || 'Please try again.' });
    } finally {
      setGlbBusy(false);
    }
  };

  if (error || !design) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <PublicHeader />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16 text-center">
          {error ? (
            <>
              <p className="text-xl font-bold text-slate-800 m-0 mb-2">This design isn't available.</p>
              <p className="text-slate-500 m-0 mb-6">The person who shared it may have stopped sharing, or the link is incomplete.</p>
              <Link to="/ai-designer" className="text-emerald-600 font-semibold">Design your own garden</Link>
            </>
          ) : <p className="text-slate-400 m-0">Loading the design…</p>}
        </main>
        {error && <PageEnd title="Want a garden like this?" text="Upload a photo of your yard and get three ready-to-build layouts in about a minute." />}
      </div>
    );
  }

  const rows = design.plant_breakdown || [];
  const groups = Object.entries(rows.reduce((acc, r) => {
    const key = CATEGORY_LABEL[r.category || 'plant'] ? (r.category || 'plant') : 'plant';
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {}));
  const lines = (design.estimate_lines || []).filter(l => l.amount > 0);
  const total = Number(design.total_cost) || 0;
  const items = rows.reduce((n, r) => n + (Number(r.quantity) || 0), 0);
  const height = phone ? 360 : 500;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PublicHeader />

      {design.is_owner && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-sm font-semibold text-center px-4 py-2.5 flex items-center justify-center gap-2">
          <Eye size={15} className="shrink-0" /> This is your share link. Anyone you send it to sees this page. Your yard photo isn't included.
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="mb-5">
          <p className="text-xs font-extrabold tracking-widest uppercase text-emerald-600 m-0 mb-2 flex items-center gap-1.5">
            <Sparkles size={13} /> Garden design
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight m-0 mb-2 leading-tight">{design.name}</h1>
          <p className="text-slate-500 m-0">
            For a {design.lot.width} × {design.lot.length} m yard{items > 0 && ` · ${items} item${items === 1 ? '' : 's'}`}
            {' · '}Made with Garden Studio's AI garden designer
          </p>
        </div>

        <section aria-label="3D view of the design" className="relative rounded-3xl overflow-hidden border border-slate-200 bg-white mb-2" style={{ height }}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Loading 3D view…</div>}>
            <ThreeGardenCanvas
              ref={canvasRef}
              height={height}
              plants={design.plants}
              gardenPlan={design.garden_plan}
              lotWidth={Number(design.lot.width)}
              lotLength={Number(design.lot.length)}
              survey={design.site}
              groundcover={design.groundcover}
              growthStage={growthStage}
            />
          </Suspense>
          <GrowthStagePicker value={growthStage} onChange={setGrowthStage} short={phone}
            style={{ position: 'absolute', top: 10, left: 10, zIndex: 5 }} />
        </section>
        {design.is_owner && (
          <div className="flex justify-end mb-2">
            <button type="button" onClick={downloadGlb} disabled={glbBusy} aria-busy={glbBusy}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-emerald-800 font-bold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait">
              <Download size={16} /> {glbBusy ? 'Preparing 3D file…' : 'Download 3D file (.glb)'}
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400 m-0 mb-8 flex items-center gap-1.5">
          <Move3d size={13} /> {phone ? 'Drag to turn, pinch to zoom.' : 'Drag to turn, scroll to zoom.'} Switch between planting day and fully grown at the top left.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 md:p-6">
            <h2 className="text-lg font-black text-slate-900 m-0 mb-4 flex items-center gap-2"><Leaf size={18} className="text-emerald-600" /> What's in this garden</h2>
            {groups.length === 0 && <p className="text-slate-500 m-0">No item list was saved with this design.</p>}
            {groups.map(([key, list]) => (
              <div key={key} className="mb-4 last:mb-0">
                {groups.length > 1 && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0 mb-2">{CATEGORY_LABEL[key]}</p>}
                <ul className="list-none m-0 p-0 divide-y divide-slate-100">
                  {list.map((r, i) => (
                    <li key={`${r.plant_id}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="font-semibold text-slate-800">{r.name}</span>
                      <span className="text-sm text-slate-500 shrink-0">× {r.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <aside className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 h-fit">
            <h2 className="text-lg font-black text-slate-900 m-0 mb-4 flex items-center gap-2"><ReceiptText size={18} className="text-emerald-600" /> Price estimate</h2>
            {lines.length > 0 && (
              <ul className="list-none m-0 p-0 mb-3 flex flex-col gap-2">
                {lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">{l.label}</span>
                    <span className="font-semibold text-slate-800 shrink-0">{peso(l.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between items-baseline gap-3 border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-800">Estimated total</span>
              <span className="text-2xl font-black text-emerald-700">{peso(total)}</span>
            </div>
            <p className="text-xs text-slate-400 m-0 mt-3 leading-relaxed">
              Prices as of {fmtDay(design.priced_at)}. Prices and stock can change; the final price is confirmed after a site visit.
            </p>
          </aside>
        </div>
      </main>

      <PageEnd title="Want a garden like this?" text="Upload a photo of your yard and our AI designer makes three ready-to-build layouts in about a minute. Our own crew can build it.">
        <Link to="/ai-designer" className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold no-underline text-base">
          <Sparkles size={17} /> Design my garden
        </Link>
        <Link to="/projects" className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full border border-white/30 hover:border-emerald-300 text-white font-bold no-underline text-base">
          <Images size={17} /> See finished gardens
        </Link>
      </PageEnd>
    </div>
  );
}
