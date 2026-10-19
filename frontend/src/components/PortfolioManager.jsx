import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Image as ImageIcon, Plus, X, Eye, EyeOff, Star, Archive, Trash2, Send, RefreshCw,
  Upload, ExternalLink, Home, CheckCircle2, Clock, XCircle, Globe, ShieldCheck, Box, Camera, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import CredentialsManager from './CredentialsManager';
import { toCanvasPlants } from '../data/projectHub';
import {
  listPortfolio, listPortfolioCandidates, createPortfolioEntry, updatePortfolioEntry,
  deletePortfolioEntry, portfolioAction, uploadPortfolioPhoto, updatePortfolioPhoto, deletePortfolioPhoto,
} from '../services/api';

// Must match PRICE_BANDS in backend/apps/library/portfolio.py
const PRICE_BANDS = ['Under ₱25K', '₱25K – ₱50K', '₱50K – ₱100K', '₱100K – ₱250K', '₱250K – ₱500K', '₱500K and up'];
const STYLE_PRESETS = [
  'Tropical', 'Modern', 'Zen', 'Native', 'Cottage', 'Minimalist',
  'Low maintenance', 'Edible garden', 'Water feature', 'Lighting', 'Pool area', 'Hardscape',
];
const KINDS = [['before', 'Before'], ['during', 'During'], ['after', 'After'], ['detail', 'Detail'], ['render', '3D design']];

const STAGES = {
  awaiting_consent: { label: 'Awaiting consent', cls: 'bg-amber-50 text-amber-700 border-amber-200',     Icon: Clock },
  ready:            { label: 'Ready to publish', cls: 'bg-blue-50 text-blue-700 border-blue-200',        Icon: CheckCircle2 },
  consent_refused:  { label: 'Consent refused',  cls: 'bg-red-50 text-red-700 border-red-200',           Icon: XCircle },
  published:        { label: 'Published',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: Globe },
  archived:         { label: 'Archived',         cls: 'bg-slate-100 text-slate-500 border-slate-200',    Icon: Archive },
};
const FILTERS = [
  ['all', 'All'], ['awaiting_consent', 'Awaiting consent'], ['ready', 'Ready'], ['published', 'Published'],
  ['featured', 'Featured'], ['consent_refused', 'Refused'], ['archived', 'Archived'],
];

function StageBadge({ stage }) {
  const s = STAGES[stage] || STAGES.awaiting_consent;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${s.cls}`}>
      <s.Icon size={11} /> {s.label}
    </span>
  );
}

export default function PortfolioManager() {
  const { user } = useAuth();
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [editingId,  setEditingId]  = useState(null);
  const [candidates, setCandidates] = useState(null); // null = picker closed
  const [notice,     setNotice]     = useState(null);  // { msg, type }
  const [section,    setSection]    = useState('projects'); // 'projects' | 'documents'

  const flash = useCallback((msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(n => (n?.msg === msg ? null : n)), 4500);
  }, []);

  useEffect(() => {
    listPortfolio().then(setProjects).catch(e => flash(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (user?.staff_role === 'FIELD_CREW') {
    return <div className="p-10 text-center text-slate-500">The project portfolio is managed by office admins.</div>;
  }

  const replace = (updated) => setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)));

  const openPicker = async () => {
    setCandidates([]);
    try { setCandidates(await listPortfolioCandidates()); } catch (e) { flash(e.message, 'error'); setCandidates(null); }
  };

  const addFromBooking = async (bookingId) => {
    try {
      const created = await createPortfolioEntry(bookingId);
      setProjects(prev => [created, ...prev.filter(p => p.id !== created.id)]);
      setCandidates(null);
      setEditingId(created.id);
      flash('Draft created and the customer was asked for permission.');
    } catch (e) { flash(e.message, 'error'); }
  };

  const visible = projects.filter(p =>
    filter === 'all' ? true : filter === 'featured' ? p.is_featured : p.stage === filter);
  const countFor = (key) => projects.filter(p =>
    key === 'all' ? true : key === 'featured' ? p.is_featured : p.stage === key).length;
  const editing = projects.find(p => p.id === editingId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 shadow-sm"><ImageIcon size={20} className="text-white" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">Project Portfolio</h1>
              <p className="text-slate-500 text-xs md:text-sm m-0">Curate finished jobs for the public Project Hub. Publishing needs the customer's permission.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/projects" target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl no-underline hover:bg-slate-50">
              <ExternalLink size={14} /> Public gallery
            </Link>
            <button onClick={openPicker} className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl border-none cursor-pointer">
              <Plus size={15} /> Add finished job
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 mb-5 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-fit">
          {[['projects', 'Projects', ImageIcon], ['documents', 'Track record documents', FileText]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-none cursor-pointer
                ${section === key ? 'bg-emerald-600 text-white' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {section === 'documents' ? <CredentialsManager flash={flash} /> : (<>
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors
                ${filter === key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
            >
              {label} <span className="opacity-70">{countFor(key)}</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading portfolio…</p>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl py-16 text-center">
            <ImageIcon size={36} className="text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-slate-700 font-semibold m-0">No projects here yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-0">Jobs are added automatically when you sign them off as Finished.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map(p => (
              <button
                key={p.id}
                onClick={() => setEditingId(p.id)}
                className="text-left bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer p-0"
              >
                <div className="relative h-40 bg-slate-100">
                  {p.cover_url
                    ? <img src={p.cover_url} alt="" className="w-full h-full object-cover block" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={32} /></div>}
                  {p.is_featured && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-amber-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      <Star size={10} fill="white" /> FEATURED
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <StageBadge stage={p.stage} />
                  <p className="font-bold text-slate-800 mt-2 mb-0.5 leading-snug">{p.title}</p>
                  <p className="text-xs text-slate-400 m-0">
                    #{p.booking} · {p.booking_info.customer_name} · {p.media.filter(m => m.is_public).length}/{p.media.length} photos public
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        </>)}
      </div>

      {/* Finished-job picker */}
      {candidates !== null && (
        <Modal title="Add a finished job" onClose={() => setCandidates(null)} width={560}>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-500 m-0">Every signed-off job already has a portfolio entry.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {candidates.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm text-slate-800 m-0">#{c.id} · {c.service_type}</p>
                    <p className="text-xs text-slate-400 m-0">{c.customer_name}{c.city ? ` · ${c.city}` : ''} · {c.scheduled_date}</p>
                  </div>
                  <button onClick={() => addFromBooking(c.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border-none cursor-pointer">
                    Create draft
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {editing && (
        <PortfolioEditor
          project={editing}
          onChange={replace}
          onDeleted={() => { setProjects(prev => prev.filter(p => p.id !== editing.id)); setEditingId(null); }}
          onClose={() => setEditingId(null)}
          flash={flash}
        />
      )}

      {notice && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white
          ${notice.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {notice.msg}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, width = 980 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(15,23,42,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full my-6" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-900 text-base m-0">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg bg-transparent border-none cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const FIELD_LABEL = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
const INPUT = 'w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400';

function PortfolioEditor({ project, onChange, onDeleted, onClose, flash }) {
  const toForm = (p) => ({
    title: p.title, summary: p.summary, story: p.story, style_tags: p.style_tags, city: p.city,
    lot_area_sqm: p.lot_area_sqm ?? '', price_band: p.price_band, started_on: p.started_on || '', completed_on: p.completed_on || '',
  });
  const [form,    setForm]    = useState(() => toForm(project));
  const [dirty,   setDirty]   = useState(false);
  const [busy,    setBusy]    = useState(null);
  const [tagText, setTagText] = useState('');
  const [upload,  setUpload]  = useState({ file: null, kind: 'after', key: 0 });
  const [capture, setCapture] = useState(false);

  const consent = project.consent;
  const info = project.booking_info;
  const houseAllowed = consent?.status === 'granted' && consent.show_house;

  const set = (field, value) => { setForm(f => ({ ...f, [field]: value })); setDirty(true); };
  const toggleTag = (tag) => set('style_tags', form.style_tags.includes(tag)
    ? form.style_tags.filter(t => t !== tag) : [...form.style_tags, tag].slice(0, 8));

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const result = await fn();
      if (result && result.id === project.id) onChange(result);
      if (okMsg) flash(okMsg);
      return result;
    } catch (e) {
      flash(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const save = () => run('save', async () => {
    const body = { ...form, lot_area_sqm: form.lot_area_sqm === '' ? null : Number(form.lot_area_sqm),
      started_on: form.started_on || null, completed_on: form.completed_on || null };
    const updated = await updatePortfolioEntry(project.id, body);
    setForm(toForm(updated));
    setDirty(false);
    return updated;
  }, 'Changes saved.');

  const publish = async () => {
    if (dirty && !(await save())) return;
    run('publish', () => portfolioAction(project.id, 'publish'), 'Published — it is now visible in the public gallery.');
  };

  const patchPhoto = (media, data) => run(`m${media.id}`, async () => {
    const updated = await updatePortfolioPhoto(project.id, media.id, data);
    return { ...project, media: project.media.map(m => (m.id === media.id ? updated : m)) };
  });

  const removePhoto = (media) => {
    if (!window.confirm('Remove this photo from the portfolio?')) return;
    run(`m${media.id}`, async () => {
      await deletePortfolioPhoto(project.id, media.id);
      return { ...project, media: project.media.filter(m => m.id !== media.id),
        cover: project.cover === media.id ? null : project.cover, cover_url: project.cover === media.id ? null : project.cover_url };
    });
  };

  const setCover = (media) => run(`m${media.id}`, () => updatePortfolioEntry(project.id, { cover: media.id }), 'Cover photo updated.');

  const addPhoto = () => run('upload', async () => {
    const created = await uploadPortfolioPhoto(project.id, upload);
    setUpload(u => ({ file: null, kind: u.kind, key: u.key + 1 }));
    return { ...project, media: [...project.media, created],
      cover: project.cover ?? created.id, cover_url: project.cover_url ?? created.url };
  }, 'Photo added.');

  const remove = async () => {
    if (!window.confirm('Delete this portfolio entry? The booking and crew photos are kept.')) return;
    setBusy('delete');
    try { await deletePortfolioEntry(project.id); onDeleted(); flash('Entry deleted.'); }
    catch (e) { flash(e.message, 'error'); setBusy(null); }
  };

  const isPublished = project.status === 'published';
  const isArchived = project.status === 'archived';

  return (
    <Modal title={`Portfolio · Booking #${project.booking}`} onClose={onClose}>
      {/* Status + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <StageBadge stage={project.stage} />
          {isPublished && <span className="text-xs text-slate-400">{project.view_count} views</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg no-underline hover:bg-slate-50">
            <Eye size={13} /> Preview
          </a>
          {isPublished ? (
            <>
              <button disabled={!!busy} onClick={() => run('feature', () => updatePortfolioEntry(project.id, { is_featured: !project.is_featured }),
                project.is_featured ? 'Removed from the landing page.' : 'Featured on the landing page.')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer disabled:opacity-50
                  ${project.is_featured ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'}`}>
                <Star size={13} fill={project.is_featured ? 'white' : 'none'} /> {project.is_featured ? 'Featured' : 'Feature'}
              </button>
              <button disabled={!!busy} onClick={() => run('unpublish', () => portfolioAction(project.id, 'unpublish'), 'Unpublished.')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 disabled:opacity-50">
                <EyeOff size={13} /> Unpublish
              </button>
            </>
          ) : (
            <button disabled={!!busy || project.stage !== 'ready'} onClick={publish}
              title={project.stage !== 'ready' ? 'The customer must give permission first' : ''}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Globe size={13} /> {busy === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {!isArchived && (
            <button disabled={!!busy} onClick={() => run('archive', () => portfolioAction(project.id, 'archive'), 'Archived.')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 disabled:opacity-50">
              <Archive size={13} /> Archive
            </button>
          )}
          {!isPublished && (
            <button disabled={!!busy} onClick={remove}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg cursor-pointer hover:bg-red-50 disabled:opacity-50">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: consent + job facts */}
        <div className="flex flex-col gap-4">
          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><ShieldCheck size={13} /> Customer permission</p>
            {!consent || consent.status === 'pending' ? (
              <>
                <p className="text-sm text-amber-700 font-semibold m-0">Waiting for the customer's answer.</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">Asked {consent ? new Date(consent.requested_at).toLocaleDateString() : '—'}. You can prepare the entry meanwhile.</p>
                <button disabled={!!busy} onClick={() => run('remind', () => portfolioAction(project.id, 'request-consent'), 'Reminder sent to the customer.')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border-none cursor-pointer disabled:opacity-50">
                  <Send size={12} /> Send reminder
                </button>
              </>
            ) : consent.status === 'granted' ? (
              <ul className="text-sm text-slate-700 m-0 pl-0 list-none flex flex-col gap-1">
                <li className="text-emerald-700 font-semibold">Granted {new Date(consent.responded_at).toLocaleDateString()}</li>
                <li>Name: {consent.name_display === 'initials' ? 'First name + last initial' : 'Anonymous'}</li>
                <li>House photos: {consent.show_house ? 'Allowed' : <b className="text-red-600">Not allowed</b>}</li>
                <li>Review: {consent.include_review ? 'Include' : 'Leave out'}</li>
              </ul>
            ) : (
              <p className="text-sm text-red-600 font-semibold m-0">
                The customer {consent.status === 'withdrawn' ? 'withdrew' : 'declined'} permission{consent.responded_at ? ` on ${new Date(consent.responded_at).toLocaleDateString()}` : ''}. This project can't be published; archive it or keep it as an internal record.
              </p>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Job</p>
            <p className="m-0"><b>{info.service_type}</b></p>
            <p className="m-0 text-slate-500">{info.customer_name} · scheduled {info.scheduled_date}</p>
            <p className="mt-2 mb-0 text-slate-500">Crew: {info.crew.length ? info.crew.join(', ') : '—'}</p>
            {info.review ? (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="m-0 text-amber-500">{'★'.repeat(info.review.rating)}<span className="text-slate-300">{'★'.repeat(5 - info.review.rating)}</span></p>
                {info.review.comment && <p className="m-0 mt-1 text-xs text-slate-600 italic">"{info.review.comment}"</p>}
              </div>
            ) : <p className="mt-2 mb-0 text-xs text-slate-400">No customer review yet.</p>}
          </div>
        </div>

        {/* Right: content */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div>
            <label className={FIELD_LABEL}>Title</label>
            <input className={INPUT} value={form.title} maxLength={120} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Summary <span className="normal-case font-normal">— one line for the gallery card</span></label>
            <input className={INPUT} value={form.summary} maxLength={300} onChange={e => set('summary', e.target.value)}
                   placeholder="A bare backyard turned into a shaded tropical retreat." />
          </div>
          <div>
            <label className={FIELD_LABEL}>Story <span className="normal-case font-normal">— the challenge, what we did, the result</span></label>
            <textarea className={INPUT} rows={5} value={form.story} onChange={e => set('story', e.target.value)} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Style & features</label>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...STYLE_PRESETS, ...form.style_tags])].map(tag => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer
                    ${form.style_tags.includes(tag) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                  {tag}
                </button>
              ))}
              <input value={tagText} onChange={e => setTagText(e.target.value)} placeholder="+ custom tag" maxLength={30}
                onKeyDown={e => { if (e.key === 'Enter' && tagText.trim()) { e.preventDefault(); toggleTag(tagText.trim()); setTagText(''); } }}
                className="px-2.5 py-1 rounded-full text-xs border border-dashed border-slate-300 w-28 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={FIELD_LABEL}>City (public)</label>
              <input className={INPUT} value={form.city} maxLength={80} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Lot area (m²)</label>
              <input className={INPUT} type="number" min="0" step="0.1" value={form.lot_area_sqm} onChange={e => set('lot_area_sqm', e.target.value)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Price range</label>
              <select className={INPUT} value={form.price_band} onChange={e => set('price_band', e.target.value)}>
                <option value="">Hidden</option>
                {PRICE_BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Started</label>
              <input className={INPUT} type="date" value={form.started_on} onChange={e => set('started_on', e.target.value)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Completed</label>
              <input className={INPUT} type="date" value={form.completed_on} onChange={e => set('completed_on', e.target.value)} />
            </div>
            <div className="flex items-end">
              <button disabled={!dirty || !!busy} onClick={save}
                className="w-full py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 rounded-lg border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                {busy === 'save' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-extrabold text-slate-800 m-0">Photos</p>
            <p className="text-xs text-slate-400 m-0">Crew photos come in hidden. Turn on the ones worth showing and pick a cover.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          {project.design && (
            <button disabled={!!busy} onClick={() => setCapture(true)}
              title="Save a picture of the customer's 3D design for the Design vs Reality slider"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100 disabled:opacity-50">
              <Box size={12} /> Capture 3D render
            </button>
          )}
          <button disabled={!!busy} onClick={() => run('sync', async () => {
              const r = await portfolioAction(project.id, 'sync-media');
              flash(r.imported ? `Imported ${r.imported} new crew photo(s).` : 'No new crew photos.');
              return r;
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={12} /> Import crew photos
          </button>
          </div>
        </div>
        {project.design && !project.media.some(m => m.kind === 'render') && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
            Tip: capture a 3D render and mark a finished photo as "After" to show the <b>Design vs Reality</b> slider on the public page.
          </p>
        )}

        {!houseAllowed && project.media.some(m => m.is_public && m.shows_house) && (
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Photos marked "Shows house" stay hidden from the public: the customer hasn't allowed photos of their house.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {project.media.map(m => {
            const isCover = project.cover === m.id;
            const hiddenByConsent = m.shows_house && !houseAllowed;
            return (
              <div key={m.id} className={`border rounded-xl overflow-hidden bg-white ${isCover ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'} ${busy === `m${m.id}` ? 'opacity-50' : ''}`}>
                <div className="relative">
                  <img src={m.url} alt={m.caption} className={`w-full h-28 object-cover block ${!m.is_public || hiddenByConsent ? 'opacity-50' : ''}`} loading="lazy" />
                  {isCover && <span className="absolute top-1.5 left-1.5 text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded">COVER</span>}
                  <button onClick={() => patchPhoto(m, { is_public: !m.is_public })} title={m.is_public ? 'Public — click to hide' : 'Hidden — click to show'}
                    className={`absolute top-1.5 right-1.5 p-1 rounded border-none cursor-pointer ${m.is_public ? 'bg-emerald-600 text-white' : 'bg-white/90 text-slate-500'}`}>
                    {m.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                </div>
                <div className="p-2 flex flex-col gap-1.5">
                  <select value={m.kind} onChange={e => patchPhoto(m, { kind: e.target.value })} className="text-[11px] px-1.5 py-1 border border-slate-200 rounded">
                    {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <input defaultValue={m.caption} maxLength={200} placeholder="Caption"
                    onBlur={e => e.target.value !== m.caption && patchPhoto(m, { caption: e.target.value })}
                    className="text-[11px] px-1.5 py-1 border border-slate-200 rounded" />
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={m.shows_house} onChange={e => patchPhoto(m, { shows_house: e.target.checked })} />
                    <Home size={11} /> Shows house
                  </label>
                  <div className="flex gap-1">
                    {!isCover && (
                      <button onClick={() => setCover(m)} className="flex-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded py-1 border-none cursor-pointer">
                        Set cover
                      </button>
                    )}
                    <button onClick={() => removePhoto(m)} title="Remove" className="px-2 text-red-500 bg-red-50 hover:bg-red-100 rounded py-1 border-none cursor-pointer">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Upload extra photo */}
          <div className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col gap-2 justify-center bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500 m-0 flex items-center gap-1"><Upload size={12} /> Add a photo</p>
            <input key={upload.key} type="file" accept="image/*" onChange={e => setUpload(u => ({ ...u, file: e.target.files?.[0] || null }))}
              className="text-[11px] w-full" />
            <select value={upload.kind} onChange={e => setUpload(u => ({ ...u, kind: e.target.value }))} className="text-[11px] px-1.5 py-1 border border-slate-200 rounded bg-white">
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button disabled={!upload.file || !!busy} onClick={addPhoto}
              className="text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-700 rounded py-1.5 border-none cursor-pointer disabled:opacity-40">
              {busy === 'upload' ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 mb-0">Attendance selfies are never used here. Uploaded photos have their location data removed.</p>
      </div>
      {capture && (
        <RenderCapture
          design={project.design}
          onClose={() => setCapture(false)}
          onCaptured={(file) => run('upload', async () => {
            const created = await uploadPortfolioPhoto(project.id, { file, kind: 'render', caption: '3D design from Garden Studio' });
            setCapture(false);
            return { ...project, media: [...project.media, created],
              cover: project.cover ?? created.id, cover_url: project.cover_url ?? created.url };
          }, '3D render saved. It is public; turn it off if you prefer.')}
          busy={busy === 'upload'}
        />
      )}
    </Modal>
  );
}

/* Orbit the customer's 3D design to a good angle, then save it as a portfolio photo. */
function RenderCapture({ design, onClose, onCaptured, busy }) {
  const holder = React.useRef(null);
  const [error, setError] = useState(null);

  const save = () => {
    const canvas = holder.current?.querySelector('canvas');
    if (!canvas) return;
    try {
      canvas.toBlob(blob => {
        if (!blob) { setError('Could not capture the view — try again once the plants have loaded.'); return; }
        onCaptured(new File([blob], 'design-render.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    } catch {
      // A texture served without CORS headers "taints" the canvas and blocks export
      setError('The browser blocked capturing this view (a model was loaded from another site without CORS).');
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.75)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <p className="font-extrabold text-slate-900 m-0">Capture 3D render</p>
            <p className="text-xs text-slate-400 m-0">Drag to orbit and scroll to zoom. Try to match the angle of your best "After" photo.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg bg-transparent border-none cursor-pointer"><X size={18} /></button>
        </div>
        <div ref={holder} style={{ height: 450 }}>
          <ThreeGardenCanvas
            plants={toCanvasPlants(design.placed_items)}
            lotWidth={design.width || 10}
            lotLength={design.length || 15}
            preserveDrawingBuffer
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
          <p className="text-xs text-red-600 font-semibold m-0">{error}</p>
          <button onClick={save} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border-none cursor-pointer disabled:opacity-50">
            <Camera size={14} /> {busy ? 'Saving…' : 'Save this view'}
          </button>
        </div>
      </div>
    </div>
  );
}
