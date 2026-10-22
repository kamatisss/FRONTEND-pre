import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MapPin, Ruler, CalendarCheck, Clock, Tag, ShieldCheck, Star, Quote,
  ArrowLeft, ArrowRight, Users, Sprout, X, Image as ImageIcon, Eye, Box, ShoppingBag, ChevronRight, Sparkles,
} from 'lucide-react';
// Lazy: the landing page and gallery use ProjectCard and shouldn't pull in three.js
const ThreeGardenCanvas = lazy(() => import('./ThreeGardenCanvas'));
import { useAuth } from '../context/AuthContext';
import { usePageScroll } from './ui/usePageScroll';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { getPublicProjects, getPublicProject } from '../services/api';
import { fmtDate, fmtArea, peso, toCanvasPlants } from '../data/projectHub';

/* Project Hub — public portfolio of finished, customer-approved gardens. */

// The public site's shared header (same as the landing page), for full-page public screens
export function PublicHeader() {
  usePageScroll();
  return <SiteHeader />;
}

// Where every public page ends: a next step instead of a dead end, then the site footer
export function PageEnd({ title, text, children }) {
  return (
    <>
      <section className="bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight m-0 mb-2">{title}</h2>
            <p className="text-slate-300 m-0 max-w-xl leading-relaxed">{text}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">{children}</div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
const endPrimary = 'inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold no-underline border-none cursor-pointer text-base';
const endSecondary = 'inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full border border-white/30 hover:border-emerald-300 bg-transparent text-white font-bold no-underline cursor-pointer text-base';

function Breadcrumbs({ title }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 list-none m-0 p-0 min-w-0">
        <li className="shrink-0"><Link to="/" className="text-slate-500 hover:text-emerald-600 no-underline">Home</Link></li>
        <li className="shrink-0" aria-hidden="true"><ChevronRight size={14} className="text-slate-300 block" /></li>
        <li className="shrink-0"><Link to="/projects" className="text-slate-500 hover:text-emerald-600 no-underline">Projects</Link></li>
        {title && (
          <>
            <li className="shrink-0" aria-hidden="true"><ChevronRight size={14} className="text-slate-300 block" /></li>
            <li aria-current="page" className="text-slate-800 truncate min-w-0">{title}</li>
          </>
        )}
      </ol>
    </nav>
  );
}

/* Drag (or use arrow keys) to compare two photos of the same garden. */
export function CompareSlider({ leftUrl, rightUrl, leftLabel, rightLabel }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative w-full rounded-2xl overflow-hidden select-none bg-slate-200" style={{ aspectRatio: '16 / 10' }}>
      <img src={rightUrl} alt={rightLabel} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={leftUrl} alt={leftLabel} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700">
          <ArrowLeft size={14} /><ArrowRight size={14} />
        </div>
      </div>
      <span className="absolute top-3 left-3 bg-black/65 text-white text-xs font-black tracking-widest uppercase px-2.5 py-1 rounded-full pointer-events-none">{leftLabel}</span>
      <span className="absolute top-3 right-3 bg-black/65 text-white text-xs font-black tracking-widest uppercase px-2.5 py-1 rounded-full pointer-events-none">{rightLabel}</span>
      {/* A full-size transparent range input gives mouse, touch and keyboard control for free */}
      <input
        type="range" min="0" max="100" step="0.5" value={pos}
        onChange={e => setPos(Number(e.target.value))}
        aria-label={`Compare ${leftLabel} and ${rightLabel}`}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize m-0"
      />
    </div>
  );
}

export function ProjectCard({ project }) {
  return (
    <Link to={`/projects/${project.slug}`} className="group block no-underline bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="relative h-56 bg-slate-100 overflow-hidden">
        {project.cover_url ? (
          <img src={project.cover_url} alt={project.title} loading="lazy"
               className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={40} /></div>
        )}
        {project.price_band && (
          <span className="absolute bottom-3 left-3 bg-white/95 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">{project.price_band}</span>
        )}
      </div>
      <div className="p-5">
        <p className="text-[11px] font-extrabold tracking-widest uppercase text-emerald-600 m-0 mb-1">{project.service_type}</p>
        <h3 className="text-lg font-extrabold text-slate-900 m-0 mb-2 leading-snug">{project.title}</h3>
        {project.summary && <p className="text-sm text-slate-500 m-0 mb-3 leading-relaxed line-clamp-2">{project.summary}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {project.city && <span className="flex items-center gap-1"><MapPin size={12} /> {project.city}</span>}
          {project.lot_area_sqm && <span className="flex items-center gap-1"><Ruler size={12} /> {fmtArea(project.lot_area_sqm)}</span>}
          {project.completed_on && <span className="flex items-center gap-1"><CalendarCheck size={12} /> {fmtDate(project.completed_on)}</span>}
        </div>
      </div>
    </Link>
  );
}

/* ── /projects ─────────────────────────────────────────────────────────── */
export function ProjectGallery() {
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [filters, setFilters] = useState({ service: '', style: '', city: '', price_band: '' });

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getPublicProjects(params).then(setData).catch(e => setError(e.message));
  }, [filters]);

  const options = data?.filters || { services: [], styles: [], cities: [], price_bands: [] };
  const anyFilter = Object.values(filters).some(Boolean);
  const select = (key, label, values) => values.length > 1 || filters[key] ? (
    <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
            className="px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl cursor-pointer">
      <option value="">{label}</option>
      {values.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PublicHeader />
      <section className="bg-gradient-to-b from-emerald-50 to-slate-50 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-widest uppercase text-emerald-700 bg-white border border-emerald-200 rounded-full px-3 py-1 m-0 mb-4">
            <ShieldCheck size={13} /> Real projects · Verified on site
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight m-0 mb-3">Gardens we've built</h1>
          <p className="text-lg text-slate-500 max-w-2xl m-0 leading-relaxed">
            Every project here was completed by our crews, signed off by our team and shared with the homeowner's permission.
          </p>
          <Link to="/track-record" className="inline-flex items-center gap-1 mt-4 text-sm font-bold text-emerald-700 no-underline hover:underline">
            See our track record <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        {data && (data.results.length > 0 || anyFilter) && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {select('service', 'All services', options.services)}
            {select('style', 'All styles', options.styles)}
            {select('city', 'All cities', options.cities)}
            {select('price_band', 'Any budget', options.price_bands)}
            {anyFilter && (
              <button onClick={() => setFilters({ service: '', style: '', city: '', price_band: '' })}
                      className="px-3 py-2 text-sm font-semibold text-emerald-700 bg-transparent border-none cursor-pointer hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}

        {error ? (
          <p className="text-red-600 font-semibold">{error}</p>
        ) : !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map(i => <div key={i} className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
          </div>
        ) : data.results.length === 0 ? (
          <div className="text-center bg-white border border-slate-200 rounded-2xl py-16 px-6">
            <Sprout size={40} className="text-emerald-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-lg font-bold text-slate-800 m-0">{anyFilter ? 'No projects match these filters' : 'Our first featured projects are on their way'}</p>
            <p className="text-slate-500 mt-2 mb-6">Meanwhile, you can design your own garden in 3D — free.</p>
            <Link to="/try-studio" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold no-underline">
              Start designing <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.results.map(p => <ProjectCard key={p.slug} project={p} />)}
          </div>
        )}
      </main>

      <PageEnd title="Picture one of these in your yard" text="Design your garden in 3D for free, or let our AI lay it out for your budget.">
        <Link to="/try-studio" className={endPrimary}>Design my garden free <ArrowRight size={16} /></Link>
        <Link to="/ai-designer" className={endSecondary}><Sparkles size={16} /> Let AI design it</Link>
      </PageEnd>
    </div>
  );
}

/* ── /projects/:slug ───────────────────────────────────────────────────── */
export function ProjectDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded,   setLoaded]   = useState({ slug: null });
  const [lightbox, setLightbox] = useState(null);
  const [show3d,   setShow3d]   = useState(false);
  const [others,   setOthers]   = useState([]);

  useEffect(() => {
    getPublicProject(slug)
      .then(project => setLoaded({ slug, project }))
      .catch(e => setLoaded({ slug, error: e.message }));
  }, [slug]);

  // "More projects": a way onward at the end of the page, same kind of project first
  useEffect(() => {
    getPublicProjects({ limit: 7 })
      .then(d => setOthers(d.results.filter(p => p.slug !== slug)))
      .catch(() => {});
  }, [slug]);

  // Ignore a previous project's result while the next slug loads
  const project = loaded.slug === slug ? loaded.project : null;
  const error = loaded.slug === slug ? loaded.error : null;

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const bookSimilar = () => {
    localStorage.setItem('pending_booking_context', JSON.stringify({
      serviceType: project.service_key,
      notes: `Inspired by your project "${project.title}" (/projects/${project.slug}).`,
    }));
    navigate(user ? '/book-service' : '/login');
  };

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <PublicHeader />
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 md:py-10">
          <Breadcrumbs />
          <div className="text-center py-16">
            {error ? (
              <>
                <p className="text-xl font-bold text-slate-800">This project isn't available.</p>
                <Link to="/projects" className="text-emerald-600 font-semibold">See all projects</Link>
              </>
            ) : <p className="text-slate-400">Loading project…</p>}
          </div>
        </div>
        {error && <SiteFooter />}
      </div>
    );
  }

  const media = project.media;
  const before = media.find(m => m.kind === 'before');
  const after = media.find(m => m.kind === 'after');
  const render = media.find(m => m.kind === 'render');
  const heroUrl = project.cover_url || after?.url || media.find(m => m.kind !== 'render')?.url;
  const design = project.design;
  const v = project.verified || {};
  const proofs = [
    v.on_site_gps && 'Crew GPS check-in on site',
    v.signed_off && 'Signed off by our office',
    v.customer_reviewed && 'Reviewed by the homeowner',
  ].filter(Boolean);
  const facts = [
    project.completed_on && { Icon: CalendarCheck, label: 'Completed', value: fmtDate(project.completed_on) },
    project.duration_days && { Icon: Clock, label: 'Duration', value: `${project.duration_days} day${project.duration_days > 1 ? 's' : ''}` },
    project.lot_area_sqm && { Icon: Ruler, label: 'Lot area', value: fmtArea(project.lot_area_sqm) },
    project.price_band && { Icon: Tag, label: 'Project range', value: project.price_band },
    project.city && { Icon: MapPin, label: 'Location', value: project.city },
  ].filter(Boolean);
  const isCustomer = !user || (!user.is_staff && !user.is_superuser);

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PublicHeader />

      {project.is_preview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm font-semibold text-center px-4 py-2.5 flex items-center justify-center gap-2">
          <Eye size={15} /> Private preview — this page isn't public. Only you and our team can see it.
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Breadcrumbs title={project.title} />

        <div className="mb-6">
          <p className="text-xs font-extrabold tracking-widest uppercase text-emerald-600 m-0 mb-2">{project.service_type}</p>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight m-0 mb-3 leading-tight">{project.title}</h1>
          {project.summary && <p className="text-lg text-slate-500 m-0 max-w-3xl leading-relaxed">{project.summary}</p>}
        </div>

        {heroUrl && (
          <button onClick={() => setLightbox(Math.max(0, media.findIndex(m => m.url === heroUrl)))}
                  className="block w-full p-0 border-none bg-transparent cursor-zoom-in rounded-3xl overflow-hidden mb-6">
            <img src={heroUrl} alt={project.title} className="w-full max-h-[560px] object-cover block" />
          </button>
        )}

        {facts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
            {facts.map(({ Icon, label, value }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0 mb-1 flex items-center gap-1"><Icon size={12} /> {label}</p>
                <p className="text-sm md:text-base font-extrabold text-slate-800 m-0">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-10">
            {render && after && (
              <section>
                <h2 className="text-xl font-black text-slate-900 m-0 mb-1">Design vs reality</h2>
                <p className="text-sm text-slate-500 m-0 mb-4">
                  Left: the 3D design planned in our Garden Studio. Right: the garden our crew built. Drag to compare.
                </p>
                <CompareSlider leftUrl={render.url} rightUrl={after.url} leftLabel="3D design" rightLabel="Built" />
              </section>
            )}

            {before && after && (
              <section>
                <h2 className="text-xl font-black text-slate-900 m-0 mb-4">Before & after</h2>
                <CompareSlider leftUrl={before.url} rightUrl={after.url} leftLabel="Before" rightLabel="After" />
              </section>
            )}

            {design && (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 m-0 mb-1">The 3D design</h2>
                    <p className="text-sm text-slate-500 m-0">The layout the homeowner planned before work began. Drag to orbit.</p>
                  </div>
                  {!show3d && (
                    <button onClick={() => setShow3d(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold border-none cursor-pointer">
                      <Box size={15} /> Open 3D viewer
                    </button>
                  )}
                </div>
                {show3d ? (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white" style={{ height: 450 }}>
                    <Suspense fallback={<p className="p-6 text-slate-400 m-0">Loading 3D…</p>}>
                      <ThreeGardenCanvas
                        plants={toCanvasPlants(design.placed_items)}
                        lotWidth={design.width || 10}
                        lotLength={design.length || 15}
                        readOnly
                      />
                    </Suspense>
                  </div>
                ) : (
                  <button onClick={() => setShow3d(true)}
                          className="w-full h-40 rounded-2xl border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-400 flex flex-col items-center justify-center gap-2 cursor-pointer">
                    <Box size={30} strokeWidth={1.5} />
                    <span className="text-sm font-semibold">
                      {design.width && design.length ? `${design.width} m × ${design.length} m lot` : 'Interactive 3D layout'} · click to load
                    </span>
                  </button>
                )}
              </section>
            )}

            {project.story && (
              <section>
                <h2 className="text-xl font-black text-slate-900 m-0 mb-3">The story</h2>
                {project.story.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="text-slate-600 leading-relaxed m-0 mb-4 whitespace-pre-line">{para}</p>
                ))}
              </section>
            )}

            {media.length > 0 && (
              <section>
                <h2 className="text-xl font-black text-slate-900 m-0 mb-4">Photos</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {media.map((m, i) => (
                    <button key={m.id} onClick={() => setLightbox(i)} className="relative p-0 border-none bg-transparent cursor-zoom-in rounded-xl overflow-hidden">
                      <img src={m.url} alt={m.caption || project.title} className="w-full h-40 object-cover block hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <span className="absolute bottom-2 left-2 bg-white/90 text-slate-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">{m.kind === 'render' ? '3D design' : m.kind}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {project.testimonial && (
              <section className="relative bg-white border border-slate-200 rounded-3xl p-7">
                <Quote size={40} className="absolute top-5 right-6 text-emerald-100" />
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill={i < project.testimonial.rating ? '#10b981' : 'none'} color="#10b981" />
                  ))}
                </div>
                {project.testimonial.comment && (
                  <p className="text-lg text-slate-700 leading-relaxed m-0 mb-4">"{project.testimonial.comment}"</p>
                )}
                <p className="text-sm font-extrabold text-slate-900 m-0">{project.client}</p>
                <p className="text-xs text-emerald-600 font-semibold m-0">Homeowner{project.city ? `, ${project.city}` : ''}</p>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            {proofs.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <p className="flex items-center gap-2 text-emerald-800 font-black m-0 mb-3"><ShieldCheck size={18} /> Verified project</p>
                <ul className="list-none m-0 p-0 flex flex-col gap-2">
                  {proofs.map(p => (
                    <li key={p} className="text-sm text-emerald-900 flex items-start gap-2"><span className="text-emerald-600 font-black">✓</span> {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {isCustomer && (
              <div className="bg-slate-900 text-white rounded-2xl p-5">
                <p className="font-black text-lg m-0 mb-1">Want something like this?</p>
                <p className="text-sm text-slate-300 m-0 mb-4">Book a visit and we'll plan a {project.service_type.toLowerCase()} project for your space.</p>
                <button onClick={bookSimilar} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold border-none cursor-pointer">
                  Book a similar project <ArrowRight size={16} />
                </button>
              </div>
            )}

            {project.style_tags.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 m-0 mb-3">Style & features</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.style_tags.map(t => (
                    <Link key={t} to="/projects" className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full no-underline">{t}</Link>
                  ))}
                </div>
              </div>
            )}

            {project.plants.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 m-0 mb-1 flex items-center gap-1.5"><Sprout size={13} /> Shop the look</p>
                <p className="text-xs text-slate-400 m-0 mb-3">Plants used in this garden. Prices are today's shop prices.</p>
                <ul className="list-none m-0 p-0 flex flex-col gap-3">
                  {project.plants.map(p => (
                    <li key={p.name} className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-emerald-50 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.product?.image_url
                          ? <img src={p.product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          : <Sprout size={18} className="text-emerald-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 m-0 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 m-0">
                          {p.quantity ? `× ${p.quantity} in this garden` : 'Used in this garden'}
                          {p.product ? ` · ${peso(p.product.price)} each` : ''}
                        </p>
                      </div>
                      {p.product && isCustomer && (
                        p.product.in_stock ? (
                          <Link to={`/shop?product=${p.product_id}`} title="View in shop"
                                className="shrink-0 p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 no-underline">
                            <ShoppingBag size={15} />
                          </Link>
                        ) : <span className="shrink-0 text-[10px] font-bold text-slate-400 uppercase">Out of stock</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {project.crew.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 m-0 mb-2 flex items-center gap-1.5"><Users size={13} /> Built by</p>
                <p className="text-sm text-slate-700 m-0">{project.crew.join(', ')}</p>
              </div>
            )}
          </aside>
        </div>

        {others.length > 0 && (
          <section className="mt-14 pt-10 border-t border-slate-200" aria-labelledby="more-projects">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <h2 id="more-projects" className="text-2xl font-black text-slate-900 m-0">More gardens we've built</h2>
              <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 no-underline hover:underline">
                See all projects <ArrowRight size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...others]
                .sort((a, b) => Number(b.service_type === project.service_type) - Number(a.service_type === project.service_type))
                .slice(0, 3)
                .map(p => <ProjectCard key={p.slug} project={p} />)}
            </div>
          </section>
        )}
      </main>

      {isCustomer ? (
        <PageEnd title="Want a garden like this?" text={`Design yours in 3D for free, or book a visit and we'll plan a ${project.service_type.toLowerCase()} project for your space.`}>
          <Link to="/try-studio" className={endPrimary}>Design my garden free <ArrowRight size={16} /></Link>
          <button type="button" onClick={bookSimilar} className={endSecondary}>Book a similar project</button>
        </PageEnd>
      ) : <SiteFooter />}

      {lightbox !== null && media[lightbox] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 text-white bg-white/10 hover:bg-white/20 rounded-full border-none cursor-pointer" onClick={() => setLightbox(null)}>
            <X size={22} />
          </button>
          {media.length > 1 && (
            <>
              <button className="absolute left-4 p-3 text-white bg-white/10 hover:bg-white/20 rounded-full border-none cursor-pointer"
                      onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + media.length) % media.length); }}>
                <ArrowLeft size={20} />
              </button>
              <button className="absolute right-4 p-3 text-white bg-white/10 hover:bg-white/20 rounded-full border-none cursor-pointer"
                      onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % media.length); }}>
                <ArrowRight size={20} />
              </button>
            </>
          )}
          <figure className="m-0 max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img src={media[lightbox].url} alt={media[lightbox].caption || project.title} className="w-full max-h-[80vh] object-contain block" />
            {media[lightbox].caption && <figcaption className="text-center text-slate-300 text-sm mt-3">{media[lightbox].caption}</figcaption>}
          </figure>
        </div>
      )}
    </div>
  );
}
