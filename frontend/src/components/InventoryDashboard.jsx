import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Pencil, Archive, ArchiveRestore, X, Wand2, ImageOff, Boxes, History, Box, Loader2, Sprout, Mountain, Armchair,
  Sun, CloudSun, Cloud, Droplet, ImagePlus, AlertTriangle, Layers, MoveHorizontal, Upload, Trash2, Tag, Ruler,
  Search, Ellipsis, PackageX, Coins, ArrowUpDown, Palette,
  PackagePlus, PackageMinus, ClipboardCheck, ShoppingCart, Undo2, PackageOpen, Minus, ArrowRight, CircleCheck,
} from 'lucide-react';
import {
  getInventoryItems, createInventoryItem, patchInventoryItem, deleteInventoryItem, restoreInventoryItem,
  adjustStock, getStockHistory, getPricing, getUploadedModels, uploadModel, deleteUploadedModel,
} from '../services/api';
import { renderModelThumbnail } from '../services/modelThumbnail';
import { compressModel, formatAdvice } from '../services/modelCompress';
import { MODEL_ACCEPT, PHOTO_ACCEPT, photoProblem, sniff } from '../services/fileCheck';
import { MODEL_OPTIONS, resolveModelUrl, uploadedModelOption } from '../data/modelCatalog';
import { sizeHint, sizeLabel, SIZE_MEASURE } from '../data/modelSizing';
import { allIn, installedPrice, labourLayer, MAKEOVER, layoutLayer, layoutSpacing, grownHeight, featureKind } from '../data/pricing';
import { productImage } from '../data/productImage';

/*
 * Inventory (office). Stock only changes through recorded adjustments (restock / damaged / stock count;
 * orders record their own sales), so an open edit form can never undo a sale. 3D models are picked from
 * the models bundled with the app (data/modelCatalog.js) or ones the office uploaded (.glb, BACKEND
 * model_uploads.py; stored on the server, size-capped). "Archive" replaces delete:
 * the item leaves the shop and Studio, while past orders and saved designs keep it.
 */

const CATEGORIES = { plant: 'Plant', hardscape: 'Hardscape', furniture: 'Furniture' };
const CATEGORY_CHIP = {
  plant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hardscape: 'bg-stone-100 text-stone-700 border-stone-200',
  furniture: 'bg-sky-50 text-sky-700 border-sky-200',
};
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const needsPhoto = (item) => !productImage(item) && !!resolveModelUrl(item.model_file);

const input = 'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400';
const label = 'block text-sm font-semibold text-slate-700 mb-1.5';
const iconBtn = 'w-10 h-10 rounded-lg border-none bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer inline-flex items-center justify-center disabled:opacity-40';

function StockBadge({ item }) {
  if (item.stock_quantity <= 0) return <span className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold bg-red-50 text-red-700 border-red-200">Out of stock</span>;
  if (item.is_low_stock) return <span className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold bg-amber-50 text-amber-800 border-amber-200">Low · {item.stock_quantity}</span>;
  return <span className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-200">{item.stock_quantity} in stock</span>;
}

function Modal({ title, subtitle, onClose, children, wide = false, xl = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className={`relative w-full ${xl ? 'sm:max-w-2xl lg:max-w-5xl' : wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="m-0 mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} /></button>
        </div>
        {/* Flex body: a form can keep its own scroll area and a pinned footer (ItemForm) */}
        <div className="min-h-0 flex-1 flex flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ── 3D model picker: a picture grid of the bundled models ──
 * The chosen model shows as a card; "Change" opens the grid, filtered to the item's category ("All" shows the
 * rest). Pictures: an item already using the model lends its photo; otherwise the model is rendered off-screen,
 * ONE AT A TIME (each render opens a WebGL context, and browsers drop contexts past ~16). */
const previewCache = new Map();   // model file → Promise<object URL>
let renderQueue = Promise.resolve();
function modelPreview(option) {
  if (!previewCache.has(option.file)) {
    const job = renderQueue.then(() => renderModelThumbnail(option.path, { size: 240 })).then(b => URL.createObjectURL(b));
    renderQueue = job.catch(() => {});
    previewCache.set(option.file, job);
  }
  return previewCache.get(option.file);
}

function ModelImage({ option, photo, className = '' }) {
  const [rendered, setRendered] = useState({ file: null, url: null, failed: false });
  useEffect(() => {
    if (!option || photo) return undefined;
    let alive = true;
    modelPreview(option)
      .then(url => alive && setRendered({ file: option.file, url, failed: false }))
      .catch(() => alive && setRendered({ file: option.file, url: null, failed: true }));
    return () => { alive = false; };
  }, [option, photo]);
  if (!option) return <div className={`flex items-center justify-center bg-slate-50 ${className}`}><Box size={24} className="text-slate-300" /></div>;
  const mine = rendered.file === option.file ? rendered : { url: null, failed: false };
  const src = photo || mine.url;
  return (
    <div className={`flex items-center justify-center bg-slate-50 overflow-hidden ${className}`}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
        : mine.failed ? <span className="text-[11px] text-slate-400 text-center px-1">No preview</span>
          : <Loader2 size={18} className="text-slate-300 animate-spin" />}
    </div>
  );
}

const mb = (bytes) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);
const RAW_LIMIT = 200 * 1024 * 1024;   // bigger files are too heavy to compress in a browser tab
const STEP_TEXT = {
  loading: 'Opening the model…', shapes: 'Compressing the shapes…', textures: 'Shrinking the textures…',
  packing: 'Packing it up…', preview: 'Making a preview…',
};
const autoLabel = (fileName) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().replace(/^./, c => c.toUpperCase()).slice(0, 80);

/* ── Upload from device (BACKEND model_uploads.py) ──
 * A picked or dropped file is prepared at once: format check (with how-to-convert advice for .fbx, .obj…),
 * compression in the browser (services/modelCompress.js: Meshopt + WebP, as scripts/optimize-models.md),
 * then a picture rendered with the 3D Studio's own loader, which also proves the model opens. Staff confirm
 * the name and category and upload; the server repeats the file checks. Mounted with a fresh key per file. */
function ModelUpload({ file, category, space, onDone, onCancel, onChooseAnother, onStatus }) {
  const [step, setStep] = useState('loading');
  const [ready, setReady] = useState(null);         // { file, before, after, textures, preview, thumb }
  const [prepError, setPrepError] = useState(null); // { message, howTo }: one firm line, conversion steps on request
  const [error, setError] = useState('');
  const [name, setName] = useState(() => autoLabel(file.name));
  const [cat, setCat] = useState(category);
  const [progress, setProgress] = useState(null);   // 0..1 while uploading
  const maxFile = space?.max_file_bytes;
  const tooBig = !!(ready && maxFile && ready.after > maxFile);

  useEffect(() => {
    let alive = true;
    let preview = null;
    const fail = (message, howTo = null) => { if (alive) { setPrepError({ message, howTo }); onStatus?.('error'); } };
    (async () => {
      const advice = formatAdvice(file.name);
      if (advice) return fail(advice.message, advice.howTo);
      if (file.size > RAW_LIMIT) return fail(`This file is ${mb(file.size)}, too big to prepare here.`, 'In Blender, lower the polygon count (Decimate modifier) and the texture sizes, then export it again.');
      if (await sniff(file) !== 'glb') return fail('This file ends in .glb but isn’t a real 3D model.', 'Export it again from Blender: File → Export → glTF 2.0, Format “glTF Binary (.glb)”.');
      let result;
      try { result = await compressModel(file, (s) => alive && setStep(s)); } catch (err) { return fail(err.message); }
      if (!alive) return undefined;
      setStep('preview');
      const local = URL.createObjectURL(result.file);
      let thumb;
      try { thumb = await renderModelThumbnail(local, { size: 360 }); preview = URL.createObjectURL(thumb); }
      catch { return fail('The 3D Studio can’t open this model.', 'Export it again from Blender as glTF Binary (.glb), without Draco compression.'); }
      finally { URL.revokeObjectURL(local); }
      if (alive) { setReady({ ...result, preview, thumb }); onStatus?.('ready'); }
      return undefined;
    })();
    return () => { alive = false; if (preview) URL.revokeObjectURL(preview); };
  }, [file, onStatus]);   // onStatus is the form's state setter: stable, so this runs once per file

  const upload = async () => {
    setError('');
    if (!name.trim()) return setError('Give the model a name.');
    setProgress(0);
    onStatus?.('uploading');
    try {
      const info = space || await getUploadedModels();
      const model = await uploadModel({ file: ready.file, label: name.trim(), category: cat }, setProgress, info?.storage);
      onDone(model, ready.thumb);
    } catch (err) {
      const d = err.response?.data;
      // An R2 reply is XML, not our JSON: a refused upload there is a storage setup problem (CORS / keys)
      setError(d && typeof d === 'object' ? [d.file, d.label, d.category, d.error, d.detail].flat().filter(Boolean).join(' ') || 'Could not upload the model.'
        : err.config?.url?.includes('r2.cloudflarestorage.com')
          ? 'Cloud storage refused the upload. Ask the developer to check the R2 bucket’s CORS rules and keys.'
          : 'Could not upload the model. Check your connection and try again.');
      setProgress(null);
      onStatus?.('ready');
    }
    return undefined;
  };
  const uploading = progress !== null;
  const smallBtn = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 cursor-pointer disabled:opacity-50';

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex flex-col gap-3" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="w-24 h-24 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
          {ready ? <img src={ready.preview} alt={`Preview of ${name || 'the model'}`} className="w-full h-full object-contain" />
            : prepError ? <AlertTriangle size={22} className="text-red-400" />
              : <Loader2 size={22} className="text-emerald-500 animate-spin" />}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="m-0 font-bold text-slate-900 truncate">{file.name}</p>
          {prepError ? (
            <div role="alert" className="mt-1 text-xs leading-snug">
              <p className="m-0 font-semibold text-red-700">{prepError.message}</p>
              {prepError.howTo && (
                <details className="mt-1 text-slate-600">
                  <summary className="cursor-pointer font-bold text-emerald-700 underline">How to convert it</summary>
                  <p className="m-0 mt-1">{prepError.howTo}</p>
                </details>
              )}
            </div>
          )
            : !ready ? <p className="m-0 mt-1 text-xs text-slate-600">{STEP_TEXT[step]} <span className="text-slate-400">({mb(file.size)})</span></p>
              : (
                <p className="m-0 mt-1 text-xs text-slate-600 leading-snug">
                  {ready.after < ready.before
                    ? <>Compressed <b className="text-emerald-800">{mb(ready.before)} → {mb(ready.after)}</b>{ready.textures ? ` (${ready.textures} texture${ready.textures > 1 ? 's' : ''} to WebP)` : ''}. </>
                    : <>{mb(ready.after)}, already compact. </>}
                  {tooBig
                    ? <span className="text-red-700 font-semibold">That’s still over the {mb(maxFile)} limit. In Blender, lower the polygon count (Decimate) or texture sizes, then try again.</span>
                    : 'It opens in the 3D Studio.'}
                </p>
              )}
        </div>
      </div>
      {ready && !tooBig && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <input className={input} value={name} maxLength={80} disabled={uploading} onChange={(e) => setName(e.target.value)}
            placeholder="Model name, e.g. Boston fern" aria-label="Model name" />
          <select className={`${input} sm:w-36`} value={cat} disabled={uploading} onChange={(e) => setCat(e.target.value)} aria-label="Model category">
            {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}
      {error && <p role="alert" className="m-0 text-xs font-semibold text-red-700 flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-px" />{error}</p>}
      {uploading && (
        <div className="h-1.5 rounded-full bg-white overflow-hidden" role="progressbar" aria-label="Upload progress"
          aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <label className={`${smallBtn} inline-flex items-center focus-within:ring-2 focus-within:ring-emerald-400/50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          Choose another file
          <input type="file" accept={MODEL_ACCEPT} className="sr-only" disabled={uploading} onChange={(e) => { onChooseAnother(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={onCancel} disabled={uploading} className={smallBtn}>Cancel</button>
        <button type="button" onClick={upload} disabled={!ready || tooBig || uploading}
          className="h-9 px-3 rounded-lg border-none bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-default">
          {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading {Math.round(progress * 100)}%</> : <><Upload size={14} /> Upload and use</>}
        </button>
      </div>
    </div>
  );
}

/* ── 3D model: choose from the library (bundled + uploaded) or upload from the device ──
 * The model card is also a drop zone for a .glb. "Upload from device" never depends on the uploaded-models
 * list having loaded; the server enforces the limits. The picker only shows .glb files on computers
 * (MODEL_ACCEPT): phones don't know the type and would grey real models out, so there every file is offered
 * and checked after it's picked. While a model is being prepared, waiting for "Upload and use" or uploading,
 * the form can't be saved (onStatusChange): saving then would store the item without its model. */
function ModelPicker({ value, category, onPick, usedBy, photoOf, options, space, onUploaded, onDeleteModel, onStatusChange }) {
  const selected = options.find(o => o.file === value) || null;
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPendingState] = useState(null);   // { file, n }: a picked or dropped file being prepared / uploaded
  const [over, setOver] = useState(false);
  const list = options.filter(o => showAll || o.category === category)
    .sort((a, b) => Number(b.category === category) - Number(a.category === category) || a.label.localeCompare(b.label));
  // The form hears what the upload panel is doing (preparing / ready / uploading / error, null = no panel)
  const setPending = (next) => { setPendingState(next); onStatusChange?.(next ? 'preparing' : null); };
  const pick = (option) => { onPick(option); setOpen(false); };
  const take = (file) => { if (file) { setPending({ file, n: (pending?.n || 0) + 1 }); setOpen(false); } };
  const uploaded = (model, thumb) => {
    // The browser already rendered this model while checking it: show that picture, no second download
    if (thumb) previewCache.set(model.file_name, Promise.resolve(URL.createObjectURL(thumb)));
    setPending(null); onUploaded(model); pick(uploadedModelOption(model));
  };

  return (
    <div className="flex flex-col gap-2">
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
        className={`rounded-xl border-2 border-dashed p-2 transition-colors ${over ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3">
          <ModelImage option={selected} photo={selected ? photoOf[selected.file] : null} className="w-16 h-16 rounded-lg shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-bold text-slate-900 truncate">{selected ? selected.label : 'No 3D model'}</p>
            <p className="m-0 text-xs text-slate-500 leading-snug">
              {selected ? (selected.category !== category
                ? <span className="text-amber-700 font-semibold">This is a {CATEGORIES[selected.category].toLowerCase()} model, but the item is a {CATEGORIES[category].toLowerCase()}.</span>
                : usedBy[selected.file]
                ? <span className="text-amber-700 font-semibold">{usedBy[selected.file]} already uses this model.</span>
                : 'Customers can place it in the 3D Studio and AI Designer.')
                : 'Sold in the shop only: it can’t be placed in 3D.'}
            </p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" id="inv-model" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="inv-model-grid"
            className="min-h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
            <Box size={15} /> {open ? <>Close<span className="hidden sm:inline">&nbsp;library</span></>
              : <><span className="sm:hidden">Library</span><span className="hidden sm:inline">Choose from library</span></>}
          </button>
          <label className="min-h-10 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 inline-flex items-center justify-center gap-1.5 focus-within:ring-2 focus-within:ring-emerald-400/50">
            <Upload size={15} /> <span className="sm:hidden">Upload .glb</span><span className="hidden sm:inline">Upload from device</span>
            <input type="file" accept={MODEL_ACCEPT} className="sr-only" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        <p className="m-0 mt-1.5 text-[11px] text-slate-500 text-center">
          {over ? 'Drop the .glb to upload it.' : <><span className="hidden sm:inline">Or drag a .glb file here. </span>Large models are compressed for you.</>}
        </p>
      </div>
      {pending && (
        <ModelUpload key={pending.n} file={pending.file} category={category} space={space}
          onCancel={() => setPending(null)} onChooseAnother={take} onDone={uploaded} onStatus={onStatusChange} />
      )}
      {open && (
        <div id="inv-model-grid" className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-600">
              {showAll ? 'All models' : `${CATEGORIES[category]} models`} · {list.length}
            </span>
            <button type="button" onClick={() => setShowAll(s => !s)}
              className="text-xs font-bold text-emerald-700 bg-transparent border-none cursor-pointer p-1 underline">
              {showAll ? `Only ${CATEGORIES[category].toLowerCase()} models` : 'Show all categories'}
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="3D model">
            <button type="button" role="radio" aria-checked={!selected} onClick={() => pick(null)}
              className={`rounded-xl border bg-white p-1.5 cursor-pointer text-left ${!selected ? 'border-emerald-500 ring-2 ring-emerald-400/30' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="aspect-square rounded-lg bg-slate-50 flex items-center justify-center"><ImageOff size={22} className="text-slate-300" /></div>
              <span className="block mt-1 text-[11px] font-semibold text-slate-700 leading-tight">No 3D model</span>
            </button>
            {list.map(option => {
              const on = option.file === value;
              const user = usedBy[option.file];
              // Uploaded and unused (by any item, archived too): it can be deleted to free space
              const deletable = option.uploaded && !on && !user && !option.usedBy?.length;
              return (
                <div key={option.file} className="relative">
                  <button type="button" role="radio" aria-checked={on} onClick={() => pick(option)}
                    title={user ? `${option.label}: used by ${user}` : option.label}
                    className={`relative w-full rounded-xl border bg-white p-1.5 cursor-pointer text-left ${on ? 'border-emerald-500 ring-2 ring-emerald-400/30' : 'border-slate-200 hover:border-slate-300'}`}>
                    <ModelImage option={option} photo={photoOf[option.file]} className="aspect-square rounded-lg" />
                    <span className="block mt-1 text-[11px] font-semibold text-slate-700 leading-tight truncate">{option.label}</span>
                    {user && <span className="absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5">In use</span>}
                    {option.uploaded && <span className="block text-[10px] text-slate-400">Uploaded · {mb(option.size)}</span>}
                    {showAll && option.category !== category && (
                      <span className="block text-[10px] text-slate-400">{CATEGORIES[option.category]}</span>
                    )}
                  </button>
                  {deletable && (
                    <button type="button" onClick={() => onDeleteModel(option)} aria-label={`Delete the uploaded model ${option.label}`} title="Delete this uploaded model"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full border-none bg-white/90 shadow text-slate-500 hover:text-red-600 cursor-pointer inline-flex items-center justify-center">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {space && <p className="m-0 mt-2 text-[11px] text-slate-500">Uploaded models: {mb(space.used_bytes)} of {mb(space.limit_bytes)} used.</p>}
        </div>
      )}
    </div>
  );
}

/* ── One-tap choices (sun, water): a labelled radio group of chips ── */
function ChipGroup({ id, label: text, options, value, onChange }) {
  return (
    <div>
      <span className={label} id={`${id}-label`}>{text}<span className="text-red-600" aria-hidden="true"> *</span></span>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby={`${id}-label`} id={id}>
        {options.map(({ value: v, label: l, icon }) => {
          const on = value === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
              className={`min-h-[52px] rounded-xl border px-1.5 py-1.5 cursor-pointer flex flex-col items-center justify-center gap-0.5 text-center ${on
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/30' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              <span className={`inline-flex ${on ? 'text-emerald-700' : 'text-slate-400'}`}>{icon}</span>
              <span className="text-xs font-semibold leading-tight">{l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
const drops = (n) => Array.from({ length: n }, (_, i) => <Droplet key={i} size={14} className="-mx-px" />);
const SUN_OPTIONS = [
  { value: 'full_sun', label: 'Full sun (6+ h)', icon: <Sun size={18} /> },
  { value: 'partial_shade', label: 'Partial shade', icon: <CloudSun size={18} /> },
  { value: 'full_shade', label: 'Full shade', icon: <Cloud size={18} /> },
];
const WATER_OPTIONS = [
  { value: 'low', label: 'Low / drought-tolerant', icon: drops(1) },
  { value: 'moderate', label: 'Moderate', icon: drops(2) },
  { value: 'high', label: 'High / moist soil', icon: drops(3) },
];

/* ── Looks: how the AI Designer combines plants (layout_engine.py "Looks"; same values as models.py) ──
 * All optional: an empty field leaves the plant chosen by its height alone. */
const swatch = (bg) => <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ background: bg }} />;
const FLOWER_OPTIONS = [
  { value: 'none', label: 'No showy flowers' },
  { value: 'red', label: 'Red', icon: swatch('#dc2626') },
  { value: 'orange', label: 'Orange', icon: swatch('#f97316') },
  { value: 'yellow', label: 'Yellow', icon: swatch('#facc15') },
  { value: 'pink', label: 'Pink', icon: swatch('#ec4899') },
  { value: 'purple', label: 'Purple', icon: swatch('#9333ea') },
  { value: 'white', label: 'White', icon: swatch('#ffffff') },
];
const FOLIAGE_OPTIONS = [
  { value: 'green', label: 'Green', icon: swatch('#4d9a3a') },
  { value: 'dark_green', label: 'Dark green', icon: swatch('#1f5130') },
  { value: 'lime', label: 'Lime / golden', icon: swatch('#a3c93a') },
  { value: 'variegated', label: 'Variegated', icon: swatch('linear-gradient(135deg, #2f7d32 50%, #f2d14a 50%)') },
  { value: 'red_purple', label: 'Red / purple', icon: swatch('#7a1f3d') },
  { value: 'silver', label: 'Silver / grey', icon: swatch('#a8b5b0') },
];
const FORM_OPTIONS = [
  { value: 'upright', label: 'Upright' },
  { value: 'mounding', label: 'Mounding' },
  { value: 'spreading', label: 'Spreading / umbrella' },
  { value: 'palm', label: 'Palm' },
  { value: 'bold', label: 'Bold leaves' },
  { value: 'grassy', label: 'Grassy / fine' },
];
const ROLE_OPTIONS = [
  { value: 'specimen', label: 'Specimen', hint: 'the focal point' },
  { value: 'structure', label: 'Structure', hint: 'screens, hedges, formal frames' },
  { value: 'filler', label: 'Filler', hint: 'fills the beds in drifts' },
  { value: 'edging', label: 'Edging', hint: 'along the front border' },
  { value: 'accent', label: 'Accent', hint: 'a spot of colour' },
];
const LOOK_FIELDS = ['flower_color', 'foliage_color', 'plant_form', 'design_role'];

// What a furniture / hardscape item is in a design (models.FEATURE_TYPE_CHOICES; layout_engine.place_features).
// Empty = by category: furniture is seating, hardscape an accent rock.
const FEATURE_TYPE_OPTIONS = [
  { value: 'seat', label: 'Seating', hint: 'one seating spot on the lawn, with a path to the house' },
  { value: 'rock', label: 'Accent rock', hint: 'small groups in the planting beds' },
  { value: 'pot', label: 'Pot / planter', hint: 'a pair framing the way in, then beside the seating and round the lawn' },
  { value: 'light', label: 'Garden light', hint: 'along the walkways and round the lawn; needs a power point' },
  { value: 'water', label: 'Water feature', hint: 'one, where the eye lands across the lawn; needs a power point' },
];
const FEATURE_PREVIEW = {
  seat: 'Placed as seating: one spot on the lawn with a clear path to the house.',
  rock: 'Placed as an accent rock, in small groups in the beds.',
  pot: 'Placed as a pot: framing the way in from the house and the seating, then round the lawn.',
  light: 'Placed as a garden light along the walkways and round the lawn (needs a power point).',
  water: 'Placed as a water feature, the focal point across the lawn (needs a power point).',
};

// Optional single choice: tap the chosen chip again to clear it
function LookChips({ id, label: text, options, value, onChange, hint }) {
  const chosen = options.find(o => o.value === value);
  return (
    <div>
      <span className={label} id={`${id}-label`}>{text}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={`${id}-label`} id={id}>
        {options.map(({ value: v, label: l, icon }) => {
          const on = value === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? '' : v)}
              className={`min-h-[36px] rounded-full border px-3 py-1 cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold ${on
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/30' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {icon}{l}
            </button>
          );
        })}
      </div>
      {hint && <p className="m-0 mt-1 text-xs text-slate-500">{chosen?.hint ? `${chosen.label}: ${chosen.hint}.` : hint}</p>}
    </div>
  );
}

/* ── Photo: drop or pick a file, see it before saving, remove it again ── */
const PHOTO_MAX_MB = 10;
function PhotoDrop({ file, currentUrl, onFile, error }) {
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState('');
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  // Judged by its bytes (services/fileCheck.js), so a renamed file or an iPhone HEIC gets a plain answer here
  const take = async (f) => {
    if (!f) return;
    const problem = await photoProblem(f, PHOTO_MAX_MB);
    setProblem(problem || '');
    if (!problem) onFile(f);
  };
  const shown = preview || currentUrl;
  return (
    <div>
      <label htmlFor="inv-photo"
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-emerald-400/50 ${over
          ? 'border-emerald-400 bg-emerald-50' : error || problem ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
        <div className="w-16 h-16 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
          {shown ? <img src={shown} alt="Photo preview" className="w-full h-full object-cover" /> : <ImagePlus size={22} className="text-slate-300" />}
        </div>
        <div className="min-w-0 text-sm">
          <p className="m-0 font-semibold text-slate-800">
            {file ? file.name : currentUrl ? 'Current photo' : 'Drop a photo here, or tap to choose'}
          </p>
          <p className="m-0 text-xs text-slate-500">
            {file ? 'New photo: saved with the item.' : currentUrl ? 'Drop or tap to replace it.' : `JPG, PNG or WebP, up to ${PHOTO_MAX_MB} MB.`}
          </p>
        </div>
        <input id="inv-photo" type="file" accept={PHOTO_ACCEPT} className="sr-only" onChange={e => { take(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {file && (
        <button type="button" onClick={() => onFile(null)} className="mt-1.5 text-xs font-bold text-slate-600 bg-transparent border-none cursor-pointer p-1 underline">
          {currentUrl ? 'Keep the current photo' : 'Remove this photo'}
        </button>
      )}
      {problem && <p className="m-0 mt-1 text-xs font-semibold text-red-700" role="alert">{problem}</p>}
    </div>
  );
}

/* ── Live preview: what this item becomes, from the numbers typed so far ──
 * The shop card customers see, how the AI Designer places it (layer by fully grown height, spacing) and
 * what it adds to a quote (catalog price + planting labour by the 2-year height, with the design fee and
 * VAT). Same rules as the server: data/pricing.js mirrors pricing.py and layout_engine.py. */
const LAYER_TEXT = {
  tall: ['Tall plant', 'goes at the back of the beds'],
  mid: ['Middle plant', 'goes in the middle of the beds'],
  low: ['Low plant', 'goes along the front border'],
};
const SUN_TEXT = { full_sun: 'Full sun', partial_shade: 'Partial shade', full_shade: 'Full shade' };
const WATER_TEXT = { low: 'Low water', moderate: 'Moderate water', high: 'High water' };

function ItemPreview({ form, picture, model, rates, stock }) {
  const isPlant = form.category === 'plant';
  const price = Number(form.unit_price) || 0;
  const sizeOk = Number(form.real_world_size) > 0;
  const shape = { ...form, real_world_size: Number(form.real_world_size) || 1, mature_height: num(form.mature_height), spacing_cm: num(form.spacing_cm) };
  const layer = isPlant && sizeOk ? layoutLayer(shape) : null;
  const spacing = isPlant && sizeOk ? layoutSpacing(shape) : null;
  const labour = labourLayer(shape);
  const installed = rates && price > 0 ? Math.round(allIn(installedPrice(rates, { ...shape, unit_price: price }, MAKEOVER), rates)) : null;
  const unit = isPlant ? 'plant' : 'piece';
  const row = 'flex items-start gap-2 text-xs text-slate-600 leading-snug';

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
      {/* The shop card */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-36 bg-slate-50">
          {picture ? <img src={picture} alt="" className="w-full h-full object-cover" />
            : model ? <ModelImage option={model} className="w-full h-full" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300"><ImageOff size={26} /><span className="text-[11px]">No picture yet</span></div>}
        </div>
        <div className="p-3">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${CATEGORY_CHIP[form.category]}`}>{CATEGORIES[form.category]}</span>
          <p className="m-0 mt-1 font-extrabold text-slate-900 leading-tight break-words">{form.name.trim() || <span className="text-slate-300">Item name</span>}</p>
          <p className="m-0 mt-0.5 text-sm font-bold text-emerald-700">{price > 0 ? peso(price) : <span className="text-slate-300">₱ –</span>}</p>
          {isPlant && <p className="m-0 mt-1 text-[11px] text-slate-500">{SUN_TEXT[form.sunlight]} · {WATER_TEXT[form.water_need]}</p>}
          <p className={`m-0 mt-1 text-[11px] font-semibold ${stock > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{stock > 0 ? `${stock} in stock` : 'No stock yet: the AI Designer won’t use it'}</p>
        </div>
      </div>

      {/* How the AI Designer and the 3D views treat it */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-2">
        <p className="m-0 text-xs font-extrabold text-slate-800">In 3D and the AI Designer</p>
        {!model ? (
          <p className={row}><ImageOff size={14} className="shrink-0 mt-px text-slate-400" /> No 3D model: sold in the shop only, it can’t be placed in a design.</p>
        ) : isPlant ? (
          <>
            {layer && <p className={row}><Layers size={14} className="shrink-0 mt-px text-emerald-600" /><span><b className="text-slate-800">{LAYER_TEXT[layer][0]}</b>: {LAYER_TEXT[layer][1]} (fully grown {grownHeight(shape).toFixed(2)} m).</span></p>}
            {spacing && <p className={row}><MoveHorizontal size={14} className="shrink-0 mt-px text-emerald-600" /><span>Planted about <b className="text-slate-800">{spacing.toFixed(2)} m</b> apart{num(form.spacing_cm) ? '' : ' (worked out from its height)'}.</span></p>}
            {form.is_invasive && <p className={row}><AlertTriangle size={14} className="shrink-0 mt-px text-amber-600" /> Other plants are kept clear of its roots.</p>}
          </>
        ) : (
          <>
            <p className={row}><Box size={14} className="shrink-0 mt-px text-emerald-600" /> Shown {sizeOk ? `${Number(form.real_world_size).toFixed(2)} m` : ''} {SIZE_MEASURE[form.category] === 'longest' ? 'on its longest side' : 'tall'} in 3D.</p>
            {featureKind(form) && <p className={row}><Layers size={14} className="shrink-0 mt-px text-emerald-600" /> {FEATURE_PREVIEW[featureKind(form)]}</p>}
          </>
        )}
      </div>

      {/* What it adds to a quote */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-1">
        <p className="m-0 text-xs font-extrabold text-slate-800">In quotes</p>
        {installed == null ? (
          <p className="m-0 text-xs text-slate-500">{price > 0 ? 'Loading the rate card…' : 'Enter a price to see it.'}</p>
        ) : (
          <>
            <p className="m-0 text-xs text-slate-600">Installed by the crew: <b className="text-slate-900">≈ {peso(installed)}</b> per {unit}</p>
            <p className="m-0 text-[11px] text-slate-500 leading-snug">
              {labour === 'other' ? 'Placement labour' : `${labour[0].toUpperCase()}${labour.slice(1)}-plant planting rate (by its 2-year height)`}
              {', design fee'}{rates.vat_registered ? ' and VAT' : ''} included. {isPlant ? 'Plants only' : 'Without installation'}: {peso(price)} + delivery.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Add / edit an item (never its stock: see StockDialog) ──
 * Category first (it decides which fields exist), then Basics · Picture · Size & growth · Growing needs ·
 * Stock. Every number here feeds something: real_world_size = the 3D size, the AI Designer's layer and the
 * labour rate; sun/water/roots = compatibility warnings; the six sizes = the Studio growth slider. So the
 * sizes sit together in one table with soft checks, and nothing typed is lost by a stray click. */
// Same colours as the category chips in the inventory table, so a category looks the same everywhere
const CATEGORY_CARDS = [
  { key: 'plant', label: 'Plant', sub: 'Grows over time', Icon: Sprout, tint: 'bg-emerald-100 text-emerald-700' },
  { key: 'hardscape', label: 'Hardscape', sub: 'Rocks and stones', Icon: Mountain, tint: 'bg-stone-200 text-stone-700' },
  { key: 'furniture', label: 'Furniture', sub: 'Benches and chairs', Icon: Armchair, tint: 'bg-sky-100 text-sky-700' },
];
// Optional plant sizes: tucked behind "Add growth details" until wanted (or already filled in)
const GROWTH_EXTRAS = ['planting_height', 'mature_height', 'planting_spread', 'established_spread', 'mature_spread', 'spacing_cm'];
// Server field → the input it belongs to (errors are shown there, and the form scrolls to the first one)
const FIELD_IDS = {
  name: 'inv-name', category: 'inv-cat-plant', unit_price: 'inv-price', description: 'inv-desc', reorder_level: 'inv-reorder',
  stock_quantity: 'inv-stock', real_world_size: 'inv-size', planting_height: 'inv-planting_height', mature_height: 'inv-mature_height',
  planting_spread: 'inv-planting_spread', established_spread: 'inv-established_spread', mature_spread: 'inv-mature_spread',
  sunlight: 'inv-sun', water_need: 'inv-water', model_file: 'inv-model', thumbnail: 'inv-photo', spacing_cm: 'inv-spacing',
  flower_color: 'inv-flower', foliage_color: 'inv-foliage', plant_form: 'inv-form', design_role: 'inv-role',
  feature_type: 'inv-feature',
};
const FIELD_NAMES = { unit_price: 'Price', real_world_size: 'Size', reorder_level: 'Low-stock alert', stock_quantity: 'Units on hand' };

const num = (v) => (v === '' || v == null ? null : Number(v));
// Soft checks on the growth table: a plant shouldn't shrink as it grows. Warnings, never blocking.
function sizeWarnings(f) {
  const out = [];
  const check = (what, a, b, c) => {
    const [p, e, m] = [num(a), num(b), num(c)];
    if (p != null && e != null && p > e) out.push(`${what} at planting is more than after ~2 years.`);
    if (m != null && e != null && m < e) out.push(`${what} fully grown is less than after ~2 years.`);
    if (p != null && m != null && e == null && p > m) out.push(`${what} at planting is more than fully grown.`);
  };
  check('Height', f.planting_height, f.real_world_size, f.mature_height);
  check('Width', f.planting_spread, f.established_spread, f.mature_spread);
  return out;
}

// Each part of the form is its own white card on the grey form body (design system: card = white,
// 1px border, large radius, soft shadow): clear groups and breathing room instead of one long wall.
function Section({ id, icon: Icon, title, hint, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-4" aria-labelledby={`inv-sec-${id}`}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h4 id={`inv-sec-${id}`} className="m-0 text-[15px] font-extrabold text-slate-900 leading-tight">{title}</h4>
          {hint && <p className="m-0 mt-0.5 text-xs text-slate-500 leading-snug">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const Req = () => <span className="text-red-600" aria-hidden="true"> *</span>;
const Opt = () => <span className="font-normal text-slate-400"> (optional)</span>;
const FieldError = ({ id, msg }) => (msg ? <p id={`${id}-err`} className="m-0 mt-1 text-xs font-semibold text-red-700">{msg}</p> : null);

// A number input with its unit inside the box (₱ before, m / units after)
function UnitInput({ id, value, onChange, prefix, suffix, error, describedBy, compact = false, ...rest }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[15px] pointer-events-none">{prefix}</span>}
      <input id={id} type="number" className={`${input} ${prefix ? 'pl-7' : ''} ${suffix ? (compact ? 'px-2 pr-6' : 'pr-14') : ''} ${error ? 'border-red-400 focus:ring-red-300/40 focus:border-red-400' : ''}`}
        value={value} onChange={onChange} aria-invalid={!!error || undefined}
        aria-describedby={[describedBy, error ? `${id}-err` : null].filter(Boolean).join(' ') || undefined} {...rest} />
      {suffix && <span className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${compact ? 'right-2 text-xs' : 'right-3 text-sm'}`}>{suffix}</span>}
    </div>
  );
}

function ItemForm({ item, items, onClose, onSaved, modelOptions, modelSpace, onModelUploaded, onDeleteModel }) {
  const initial = useMemo(() => ({
    name: item?.name || '', category: item?.category || 'plant', description: item?.description || '',
    unit_price: item?.unit_price || '', reorder_level: item?.reorder_level ?? 10, stock_quantity: 0,
    model_file: item?.model_file || '', real_world_size: item?.real_world_size ?? 1,
    sunlight: item?.sunlight || 'full_sun', water_need: item?.water_need || 'moderate', is_invasive: !!item?.is_invasive,
    planting_height: item?.planting_height ?? '', mature_height: item?.mature_height ?? '',
    planting_spread: item?.planting_spread ?? '', established_spread: item?.established_spread ?? '',
    mature_spread: item?.mature_spread ?? '', spacing_cm: item?.spacing_cm ?? '',
    flower_color: item?.flower_color || '', foliage_color: item?.foliage_color || '',
    plant_form: item?.plant_form || '', design_role: item?.design_role || '',
    feature_type: item?.feature_type || '',
  }), [item]);
  const [form, setForm] = useState(initial);
  const [photo, setPhoto] = useState(null);
  const [autoName, setAutoName] = useState('');
  const [rates, setRates] = useState(null);   // rate card, for the preview's installed price
  useEffect(() => { getPricing().then(setRates).catch(() => {}); }, []);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [modelStatus, setModelStatus] = useState(null);   // the 3D model upload panel: preparing / ready / uploading / error
  const modelBusy = ['preparing', 'ready', 'uploading'].includes(modelStatus);
  // Optional growth sizes start hidden, unless this item already has some
  const [growthOpen, setGrowthOpen] = useState(() => GROWTH_EXTRAS.some(k => initial[k] !== '' && initial[k] != null));
  const isPlant = form.category === 'plant';
  const unit = isPlant ? 'plant' : 'piece';
  const dirty = !!photo || Object.keys(initial).some(k => String(initial[k]) !== String(form[k]));
  const warnings = isPlant ? sizeWarnings(form) : [];
  const usedBy = useMemo(() => Object.fromEntries(items.filter(i => i.id !== item?.id && i.model_file).map(i => [i.model_file, i.name])), [items, item]);
  // An item's photo doubles as its model's picture in the grid (no render needed)
  const photoOf = useMemo(() => Object.fromEntries(items.filter(i => i.model_file && productImage(i)).map(i => [i.model_file, productImage(i)])), [items]);
  // Same name already in the list (archived ones too: restoring beats a duplicate)
  const twin = useMemo(() => {
    const key = form.name.trim().toLowerCase().replace(/\s+/g, ' ');
    return key ? items.find(i => i.id !== item?.id && i.name.trim().toLowerCase().replace(/\s+/g, ' ') === key) : null;
  }, [form.name, items, item]);

  const change = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (fieldErrors[k]) setFieldErrors(({ [k]: _gone, ...rest }) => rest);
  };
  const set = (k) => (e) => change(k, e.target.value);
  // Picking a model on a NEW item fills in what it obviously is: its category, and its name if none typed yet
  const pickModel = (option) => {
    change('model_file', option?.file || '');
    if (item || !option) return;
    if (option.category !== form.category) change('category', option.category);
    if (!form.name.trim() || form.name === autoName) { change('name', option.label); setAutoName(option.label); }
  };
  // Backdrop, Escape, ✕ and Cancel all come here: typed work is never lost by a stray click
  const requestClose = () => {
    if (!saving && (!dirty || window.confirm(item ? 'Discard your changes to this item?' : 'Discard this new item? What you typed will be lost.'))) onClose();
  };

  const showErrors = (errs) => {
    setFieldErrors(errs);
    // An error in a hidden growth field opens that part first, so the field exists to scroll to
    const hidden = GROWTH_EXTRAS.some(k => errs[k]) && !growthOpen;
    if (hidden) setGrowthOpen(true);
    const first = Object.keys(FIELD_IDS).find(k => errs[k]);
    if (first) {
      setTimeout(() => {
        const el = document.getElementById(FIELD_IDS[first]);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus({ preventScroll: true });
      }, hidden ? 50 : 0);
    }
  };

  // Required fields still empty, shown live in the footer (each one jumps to its field)
  const missing = [
    !form.name.trim() && ['Name', 'name'],
    !(Number(form.unit_price) > 0) && ['Price', 'unit_price'],
    !(Number(form.real_world_size) > 0) && [isPlant ? 'Height after ~2 years' : 'Size', 'real_world_size'],
    String(form.reorder_level).trim() === '' && ['Low-stock alert', 'reorder_level'],
  ].filter(Boolean);
  const jumpTo = (field) => {
    const el = document.getElementById(FIELD_IDS[field]);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (modelBusy) {
      // Saving now would store the item without the model that's still on its way
      setError(modelStatus === 'ready' ? 'Click “Upload and use” to attach the 3D model, or cancel it, before saving.'
        : 'Wait for the 3D model to finish, or cancel it, before saving.');
      jumpTo('model_file');
      return;
    }
    setSaving(true); setError(''); setFieldErrors({});
    try {
      const data = new FormData();
      ['name', 'category', 'description', 'unit_price', 'reorder_level', 'model_file', 'real_world_size'].forEach(k => data.append(k, form[k] ?? ''));
      // Growing needs drive the AI Designer's compatibility warnings and planting gaps (plants only)
      data.append('sunlight', isPlant ? form.sunlight : 'full_sun');
      data.append('water_need', isPlant ? form.water_need : 'moderate');
      data.append('is_invasive', isPlant && form.is_invasive ? 'true' : 'false');
      // Empty = unknown (the Studio label then shows just the height after ~2 years)
      data.append('planting_height', isPlant ? form.planting_height : '');
      data.append('mature_height', isPlant ? form.mature_height : '');
      // Widths at the same stages: the 3D growth view widens plants at their own pace (empty = follows height)
      ['planting_spread', 'established_spread', 'mature_spread'].forEach(k => data.append(k, isPlant ? form[k] : ''));
      // Planting distance: empty = the AI layout works it out from the fully grown height
      data.append('spacing_cm', isPlant ? form.spacing_cm : '');
      // Looks: how the AI Designer combines plants (empty = not set)
      LOOK_FIELDS.forEach(k => data.append(k, isPlant ? form[k] : ''));
      // How the AI Designer places a furniture / hardscape item (empty = by category)
      data.append('feature_type', isPlant ? '' : form.feature_type);
      if (!item) data.append('stock_quantity', form.stock_quantity || 0);   // opening stock, new items only
      if (photo) data.append('thumbnail', photo);
      // A model and no photo yet: photograph the model so the shop isn't left blank
      const option = modelOptions.find(o => o.file === form.model_file);
      if (option && !photo && !productImage(item)) {
        try { data.append('thumbnail', await renderModelThumbnail(option.path), 'product.jpg'); } catch { /* the shop shows a placeholder */ }
      }
      if (item) await patchInventoryItem(item.id, data); else await createInventoryItem(data);
      onSaved(item ? `"${form.name}" saved.` : `"${form.name}" added.`);
    } catch (err) {
      const d = err.response?.data;
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        const errs = {}, other = [];
        Object.entries(d).forEach(([k, v]) => {
          const msg = [].concat(v).join(' ');
          if (FIELD_IDS[k]) errs[k] = msg; else other.push(k === 'detail' || k === 'error' || k === 'non_field_errors' ? msg : `${FIELD_NAMES[k] || k.replace(/_/g, ' ')}: ${msg}`);
        });
        showErrors(errs);
        setError(other.length ? other.join(' · ') : Object.keys(errs).length ? 'Please fix the highlighted fields.' : 'Could not save the item.');
      } else {
        setError('Could not save the item. Check your connection and try again.');
      }
    }
    setSaving(false);
  };

  const growth = [
    ['Height', [['planting_height', false], ['real_world_size', true], ['mature_height', false]]],
    ['Width', [['planting_spread', false], ['established_spread', false], ['mature_spread', false]]],
  ];

  const requiredTotal = 4;   // name, price, size, low-stock alert (the category always has a value)
  const requiredDone = requiredTotal - missing.length;

  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add an item'}
      subtitle={item ? 'Stock is changed with the Stock button, so every change is recorded.' : (
        <span className="flex items-center gap-2.5 mt-1">
          <span className="w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
            <span className="block h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(requiredDone / requiredTotal) * 100}%` }} />
          </span>
          <span className="text-xs font-semibold text-slate-500">{requiredDone === requiredTotal ? 'Ready to add' : `${requiredDone} of ${requiredTotal} required done`}</span>
        </span>
      )}
      onClose={requestClose} xl>
      <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
        <div className="overflow-y-auto bg-slate-50 px-4 sm:px-5 py-4 sm:py-5 lg:grid lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-4">
          {/* Category first: it decides which of the fields below exist */}
          <fieldset className="m-0 p-0 border-0">
            <legend className={label}>What are you adding?</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Category">
              {CATEGORY_CARDS.map(({ key, label: text, sub, Icon, tint }) => {
                const on = form.category === key;
                return (
                  <button key={key} id={`inv-cat-${key}`} type="button" role="radio" aria-checked={on} onClick={() => change('category', key)}
                    className={`text-left rounded-2xl border bg-white p-2.5 sm:p-3 cursor-pointer min-h-[44px] transition-all flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${on
                      ? 'border-emerald-500 ring-2 ring-emerald-400/30 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
                    <span className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl inline-flex items-center justify-center ${on ? tint : 'bg-slate-100 text-slate-400'}`}>
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold ${on ? 'text-slate-900' : 'text-slate-700'}`}>{text}</span>
                      <span className="hidden sm:block text-[11px] leading-snug text-slate-500">{sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Section id="media" icon={Box} title="3D model & photo"
            hint={item ? 'How customers see it in the shop and in 3D' : 'Start here if you have a 3D model: it fills in the name and category'}>
            <div>
              <span className={label}>3D model<Opt /></span>
              <ModelPicker value={form.model_file} category={form.category} usedBy={usedBy} photoOf={photoOf} onPick={pickModel}
                options={modelOptions} space={modelSpace} onUploaded={onModelUploaded} onDeleteModel={onDeleteModel} onStatusChange={setModelStatus} />
              <FieldError id="inv-model" msg={fieldErrors.model_file} />
            </div>
            <div>
              <span className={label}>Photo<Opt /></span>
              <PhotoDrop file={photo} currentUrl={item ? productImage(item) : null} onFile={setPhoto} error={fieldErrors.thumbnail} />
              {!photo && !(item && productImage(item)) && (
                <p className="m-0 mt-1 text-xs text-slate-500">{form.model_file ? 'Leave empty and we make one from the 3D model.' : 'Without a photo or a 3D model the shop shows a placeholder.'}</p>
              )}
              <FieldError id="inv-photo" msg={fieldErrors.thumbnail} />
            </div>
          </Section>

          <Section id="basics" icon={Tag} title="Basics" hint="What customers see in the shop">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-3 items-start">
            <div>
              <label className={label} htmlFor="inv-name">Name<Req /></label>
              <input id="inv-name" className={`${input} ${fieldErrors.name ? 'border-red-400' : ''}`} value={form.name} onChange={set('name')}
                required maxLength={100} placeholder={isPlant ? 'e.g. Heliconia rostrata' : form.category === 'hardscape' ? 'e.g. Mossy rock' : 'e.g. Bamboo bench'}
                aria-invalid={!!fieldErrors.name || undefined} aria-describedby={fieldErrors.name ? 'inv-name-err' : undefined} />
              <FieldError id="inv-name" msg={fieldErrors.name} />
              {twin && (
                <p className="m-0 mt-1.5 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5" role="status">
                  <AlertTriangle size={14} className="shrink-0 mt-px" />
                  <span>“{twin.name}” is already in the inventory{twin.is_active === false
                    ? ' (archived). Restore it from Archived instead of adding it again?'
                    : '. Customers will see two items with the same name.'}</span>
                </p>
              )}
              {!item && form.name && form.name === autoName && !twin && (
                <p className="m-0 mt-1 text-xs text-slate-500">Filled in from the 3D model. Change it if you sell it under another name.</p>
              )}
            </div>
              <div>
                <label className={label} htmlFor="inv-price">Price per {unit}<Req /></label>
                <UnitInput id="inv-price" prefix="₱" step="0.01" min="0.01" value={form.unit_price} onChange={set('unit_price')} required
                  error={fieldErrors.unit_price} describedBy="inv-price-hint" placeholder="0.00" />
                <p id="inv-price-hint" className="m-0 mt-1 text-xs text-slate-500">Shop price. Quotes add labour.</p>
                <FieldError id="inv-price" msg={fieldErrors.unit_price} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="inv-desc">Description<Opt /></label>
              <textarea id="inv-desc" className={`${input} h-auto py-2.5`} rows={2} value={form.description} onChange={set('description')}
                placeholder="What it looks like and where it does well." />
              <FieldError id="inv-desc" msg={fieldErrors.description} />
            </div>
          </Section>

          <Section id="size" icon={Ruler} title={isPlant ? 'Size & growth' : 'Size'}
            hint={isPlant ? 'Sets its 3D size, where the AI Designer puts it, and the labour' : 'Sets its size in 3D'}>
            {isPlant && !growthOpen ? (
              <>
                {/* Just the one size that matters; the rest of the growth table waits behind the button */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <label className={label} htmlFor="inv-size">Height after ~2 years<Req /></label>
                    <UnitInput id="inv-size" suffix="m" step="0.05" min="0.05" max="30" value={form.real_world_size}
                      onChange={set('real_world_size')} required error={fieldErrors.real_world_size} describedBy="inv-size-hint" />
                    <FieldError id="inv-size" msg={fieldErrors.real_world_size} />
                  </div>
                  <p id="inv-size-hint" className="m-0 sm:pt-7 text-xs text-slate-500 leading-relaxed">Used for the 3D view, the AI layout and the quote.</p>
                </div>
                <button type="button" onClick={() => setGrowthOpen(true)} aria-expanded="false"
                  className="self-start inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-50">
                  <Plus size={15} /> Add growth details
                  <span className="font-normal text-emerald-700/80 hidden sm:inline">· heights over time, widths, spacing</span>
                </button>
              </>
            ) : isPlant ? (
              <>
                {/* One table for the plant's size over time: the Studio "At planting · In 2 years · Fully grown" view */}
                <div className="grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] sm:grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] gap-x-1.5 sm:gap-x-2 gap-y-2 items-center">
                  <span />
                  {['At planting', 'After ~2 years', 'Fully grown'].map((h, i) => (
                    <span key={h} className="text-xs font-bold text-slate-600 leading-tight">{h}{i === 1 ? <Req /> : ''}</span>
                  ))}
                  {growth.map(([rowLabel, cells]) => (
                    <Fragment key={rowLabel}>
                      <span className="text-sm font-semibold text-slate-700">{rowLabel}</span>
                      {cells.map(([k, required]) => (
                        <div key={k}>
                          <UnitInput id={FIELD_IDS[k]} suffix="m" step="0.05" min="0.05" max={k === 'real_world_size' ? 30 : 40}
                            value={form[k]} onChange={set(k)} required={required} error={fieldErrors[k]} compact
                            aria-label={`${rowLabel} ${k.startsWith('planting') ? 'at planting' : k.startsWith('mature') ? 'fully grown' : 'after about 2 years'} (metres)`}
                            placeholder={required ? '' : '–'} />
                          <FieldError id={FIELD_IDS[k]} msg={fieldErrors[k]} />
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
                <p className="m-0 text-xs text-slate-500 leading-relaxed">
                  Only the height after ~2 years is required. The others (–) show customers how it grows; empty widths follow the height.
                </p>
                {warnings.length > 0 && (
                  <ul className="m-0 pl-0 list-none rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex flex-col gap-0.5" role="status">
                    {warnings.map(w => <li key={w}>{w} Please check.</li>)}
                  </ul>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <label className={label} htmlFor="inv-spacing">Planting distance<Opt /></label>
                    <UnitInput id="inv-spacing" suffix="cm" step="5" min="10" max="400" value={form.spacing_cm} onChange={set('spacing_cm')}
                      error={fieldErrors.spacing_cm} describedBy="inv-spacing-hint"
                      placeholder={`Auto: ${Math.round(layoutSpacing({ ...form, real_world_size: Number(form.real_world_size) || 1, mature_height: num(form.mature_height), spacing_cm: null }) * 100)}`} />
                    <FieldError id="inv-spacing" msg={fieldErrors.spacing_cm} />
                  </div>
                  <div className="sm:pt-7">
                    <p id="inv-spacing-hint" className="m-0 text-xs text-slate-500 leading-relaxed">
                      Centre to centre. Empty = worked out from its fully grown height.
                    </p>
                    {num(form.mature_spread) > 0 && String(Math.round(num(form.mature_spread) * 100)) !== String(form.spacing_cm) && (
                      <button type="button" onClick={() => change('spacing_cm', String(Math.min(400, Math.max(10, Math.round(num(form.mature_spread) * 100)))))}
                        className="mt-1 text-xs font-bold text-emerald-700 bg-transparent border-none cursor-pointer p-0 underline">
                        Use its fully grown width ({Math.round(num(form.mature_spread) * 100)} cm)
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="inv-size">{sizeLabel(form.category).replace(' (m)', '')}<Req /></label>
                  <UnitInput id="inv-size" suffix="m" step="0.05" min="0.05" max="30" value={form.real_world_size}
                    onChange={set('real_world_size')} required error={fieldErrors.real_world_size} describedBy="inv-size-hint" />
                  <p id="inv-size-hint" className="m-0 mt-1 text-xs text-slate-500">{sizeHint(form.category)}</p>
                  <FieldError id="inv-size" msg={fieldErrors.real_world_size} />
                </div>
              </div>
            )}
          </Section>

          {isPlant && (
            <Section id="needs" icon={Sun} title="Growing needs" hint="The AI Designer keeps plants with clashing needs apart">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChipGroup id="inv-sun" label="Sunlight" options={SUN_OPTIONS} value={form.sunlight} onChange={(v) => change('sunlight', v)} />
                <ChipGroup id="inv-water" label="Water" options={WATER_OPTIONS} value={form.water_need} onChange={(v) => change('water_need', v)} />
              </div>
              <label htmlFor="inv-invasive" className="flex items-start gap-2.5 text-sm text-slate-700 min-h-[44px] cursor-pointer rounded-xl border border-slate-200 px-3 py-2.5">
                <input id="inv-invasive" type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0" checked={form.is_invasive}
                  onChange={e => change('is_invasive', e.target.checked)} />
                <span><b className="font-semibold text-slate-800">Aggressive roots</b> (e.g. bamboo)
                  <span className="block text-xs text-slate-500">Other plants are kept clear of it.</span></span>
              </label>
            </Section>
          )}

          {isPlant && (
            <Section id="looks" icon={Palette} title="Looks" hint="Optional. The AI Designer keeps a design to one flower-colour family, sets contrasting shapes side by side and gives each plant its job">
              <LookChips id="inv-flower" label="Flower colour" options={FLOWER_OPTIONS} value={form.flower_color} onChange={(v) => change('flower_color', v)} />
              <LookChips id="inv-foliage" label="Leaf colour" options={FOLIAGE_OPTIONS} value={form.foliage_color} onChange={(v) => change('foliage_color', v)} />
              <LookChips id="inv-form" label="Shape" options={FORM_OPTIONS} value={form.plant_form} onChange={(v) => change('plant_form', v)} />
              <LookChips id="inv-role" label="Role in a design" options={ROLE_OPTIONS} value={form.design_role} onChange={(v) => change('design_role', v)}
                hint="Empty: placed by its height alone. Tap a chosen chip again to clear it." />
            </Section>
          )}

          {!isPlant && (
            <Section id="feature" icon={Layers} title="In designs" hint="How the AI Designer places it when a customer picks it">
              <LookChips id="inv-feature" label="Placed as" options={FEATURE_TYPE_OPTIONS} value={form.feature_type} onChange={(v) => change('feature_type', v)}
                hint={`Empty: by category (${form.category === 'furniture' ? 'seating' : 'accent rock'}). Tap a chosen chip again to clear it.`} />
            </Section>
          )}

          <Section id="stock" icon={Boxes} title="Stock">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!item && (
                <div>
                  <label className={label} htmlFor="inv-stock">Units on hand now</label>
                  <UnitInput id="inv-stock" suffix="units" step="1" min="0" value={form.stock_quantity} onChange={set('stock_quantity')}
                    error={fieldErrors.stock_quantity} describedBy="inv-stock-hint" />
                  <p id="inv-stock-hint" className="m-0 mt-1 text-xs text-slate-500">Later changes use the Stock button.</p>
                  <FieldError id="inv-stock" msg={fieldErrors.stock_quantity} />
                </div>
              )}
              <div>
                <label className={label} htmlFor="inv-reorder">Low-stock alert at<Req /></label>
                <UnitInput id="inv-reorder" suffix="units" step="1" min="0" value={form.reorder_level} onChange={set('reorder_level')} required
                  error={fieldErrors.reorder_level} describedBy="inv-reorder-hint" />
                <p id="inv-reorder-hint" className="m-0 mt-1 text-xs text-slate-500">Marked “Low” when stock drops to this.</p>
                <FieldError id="inv-reorder" msg={fieldErrors.reorder_level} />
              </div>
            </div>
          </Section>
        </div>
          <aside className="mt-6 lg:mt-0 lg:sticky lg:top-0 border-t border-slate-100 pt-5 lg:border-0 lg:pt-0" aria-label="Preview">
            <ItemPreview form={form} model={modelOptions.find(o => o.file === form.model_file) || null} rates={rates}
              picture={photoUrl || (item && productImage(item)) || photoOf[form.model_file] || null}
              stock={item ? item.stock_quantity : Number(form.stock_quantity) || 0} />
          </aside>
        </div>

        {/* Pinned: Save is always in reach, the reason it can't save is right above it */}
        <div className="border-t border-slate-100 bg-white px-5 py-3 rounded-b-2xl">
          {error && <p className="m-0 mb-2 text-sm text-red-700 font-semibold" role="alert">{error}</p>}
          {!error && (modelBusy || missing.length > 0) && (
            <p className="m-0 mb-2 text-xs text-slate-600 flex flex-wrap items-center gap-1.5" aria-live="polite">
              {modelStatus === 'ready' ? <><AlertTriangle size={13} className="text-amber-600" /> Click “Upload and use” to attach the 3D model, or cancel it.</>
                : modelBusy ? <><Loader2 size={13} className="animate-spin text-emerald-600" /> The 3D model is still being prepared or uploaded.</> : <>
                <span className="font-semibold text-slate-700">Still needed:</span>
                {missing.map(([text, field]) => (
                  <button key={field} type="button" onClick={() => jumpTo(field)}
                    className="rounded-full border border-amber-200 bg-amber-50 text-amber-900 text-xs font-semibold px-2.5 py-0.5 cursor-pointer hover:bg-amber-100">
                    {text}
                  </button>
                ))}
              </>}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            {dirty && !saving && <span className="mr-auto text-xs text-slate-400">Unsaved changes</span>}
            <button type="button" onClick={requestClose} className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving || modelBusy} title={modelBusy ? 'Finish or cancel the 3D model upload first' : undefined}
              className="h-11 px-5 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── Stock: restock / remove / count, and the item's history ──
 * Built around the one thing staff need to see: what's on hand now → what it will be after this change,
 * and whether that's still low. The server's rules (inventory.adjust) are checked as they type, so Save is
 * only offered for a change that will go through, and the button says exactly what it will do. */
const MODES = [
  { key: 'restock', label: 'Restock', sub: 'Units arrived', Icon: PackagePlus, tint: 'bg-emerald-100 text-emerald-700',
    ask: 'How many arrived?', note: 'Supplier or delivery', chips: [5, 10, 25, 50] },
  { key: 'damaged', label: 'Remove', sub: 'Damaged or lost', Icon: PackageMinus, tint: 'bg-rose-100 text-rose-700',
    ask: 'How many to remove?', note: 'What happened', chips: [1, 2, 5] },
  { key: 'count', label: 'Count', sub: 'Set what’s on hand', Icon: ClipboardCheck, tint: 'bg-sky-100 text-sky-700',
    ask: 'How many are on hand?', note: 'Who counted', chips: [] },
];
// History rows: an icon and a short name per kind of change (the server's labels are long)
const REASON_LOOK = {
  opening: ['Opening stock', PackageOpen, 'bg-slate-100 text-slate-600'],
  restock: ['Restock', PackagePlus, 'bg-emerald-50 text-emerald-700'],
  damaged: ['Damaged or lost', PackageMinus, 'bg-rose-50 text-rose-700'],
  count: ['Stock count', ClipboardCheck, 'bg-sky-50 text-sky-700'],
  sale: ['Sold', ShoppingCart, 'bg-slate-100 text-slate-600'],
  released: ['Back in stock (order cancelled)', Undo2, 'bg-slate-100 text-slate-600'],
};
const MAX_UNITS = 100000;

// Where a stock level stands against the item's alert level
function stockState(n, alertAt) {
  if (n <= 0) return { text: 'Out of stock', Icon: PackageX, cls: 'bg-red-50 text-red-700 border-red-200' };
  if (n <= alertAt) return { text: `Low · alert at ${alertAt}`, Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { text: `Healthy · alert at ${alertAt}`, Icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
}

function StockDialog({ item, onClose, onSaved }) {
  const [mode, setMode] = useState('restock');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');   // confirmation of the last change, shown in the dialog
  const [current, setCurrent] = useState(item);
  const [history, setHistory] = useState(null);

  useEffect(() => { getStockHistory(item.id).then(setHistory).catch(() => setHistory([])); }, [item.id]);

  const m = MODES.find(x => x.key === mode);
  const stock = current.stock_quantity;
  const alertAt = current.reorder_level;
  const n = qty === '' ? null : Number(qty);
  // The same rules the server applies (inventory.adjust), checked while typing
  let problem = null;
  if (n != null) {
    if (!Number.isInteger(n) || n < 0 || n > MAX_UNITS) problem = 'Enter a whole number from 0 to 100,000.';
    else if (mode !== 'count' && n === 0) problem = mode === 'restock' ? 'Enter how many units arrived.' : 'Enter how many units were damaged or lost.';
    else if (mode === 'damaged' && n > stock) problem = `Only ${stock} in stock: you can remove at most ${stock}.`;
    else if (mode === 'count' && n === stock) problem = `Stock is already ${stock}. Nothing to change.`;
  }
  const after = n == null || problem ? null : mode === 'restock' ? stock + n : mode === 'damaged' ? stock - n : n;
  const now = stockState(stock, alertAt);
  const next = after == null ? null : stockState(after, alertAt);
  const action = n == null ? 'Enter a number' : problem ? 'Check the amount' : mode === 'restock' ? `Add ${n} unit${n === 1 ? '' : 's'}`
    : mode === 'damaged' ? `Remove ${n} unit${n === 1 ? '' : 's'}` : `Set stock to ${n}`;

  const pickMode = (key) => { setMode(key); setQty(''); setError(''); setSaved(''); };
  const step = (by) => setQty(String(Math.max(0, Math.min(MAX_UNITS, (Number(qty) || 0) + by))));

  const save = async (e) => {
    e.preventDefault();
    if (after == null) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const { movement, item: updated } = await adjustStock(item.id, { reason: mode, quantity: qty, note });
      setCurrent(updated);
      setHistory(h => [movement, ...(h || [])]);
      setQty(''); setNote('');
      const msg = `${movement.change > 0 ? '+' : ''}${movement.change} → ${updated.stock_quantity} in stock.`;
      setSaved(msg);
      onSaved(`${updated.name}: ${msg}`);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <Modal title={current.name} subtitle="Update stock" onClose={onClose}>
      <form onSubmit={save} className="p-4 sm:p-5 flex flex-col gap-4 bg-slate-50">
        {/* Now */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <Thumb item={current} size="w-14 h-14" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs font-semibold text-slate-500">On hand now</p>
            <p className="m-0 text-2xl font-extrabold text-slate-900 tabular-nums leading-tight">{stock} <span className="text-sm font-semibold text-slate-500">units</span></p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold shrink-0 ${now.cls}`}>
            <now.Icon size={13} /> {now.text}
          </span>
        </div>

        {/* What happened */}
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kind of change">
          {MODES.map(({ key, label: text, sub, Icon, tint }) => {
            const on = mode === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={on} onClick={() => pickMode(key)}
                className={`rounded-2xl border bg-white p-2.5 cursor-pointer text-left flex flex-col gap-1.5 transition-all ${on
                  ? 'border-emerald-500 ring-2 ring-emerald-400/30 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center ${on ? tint : 'bg-slate-100 text-slate-400'}`}><Icon size={17} /></span>
                <span className="block text-sm font-bold text-slate-900 leading-tight">{text}</span>
                <span className="block text-[11px] text-slate-500 leading-snug">{sub}</span>
              </button>
            );
          })}
        </div>

        {/* How many */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm flex flex-col gap-3">
          <label className="text-sm font-bold text-slate-800" htmlFor="stock-qty">{m.ask}</label>
          <div className="flex items-stretch gap-2">
            <button type="button" onClick={() => step(-1)} disabled={!qty || Number(qty) <= 0} aria-label="One less"
              className="w-12 h-12 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer inline-flex items-center justify-center disabled:opacity-40"><Minus size={18} /></button>
            <input id="stock-qty" type="number" inputMode="numeric" min="0" max={MAX_UNITS} step="1" value={qty} required autoFocus
              onChange={(e) => { setQty(e.target.value); setSaved(''); }} placeholder="0"
              aria-invalid={!!problem || undefined} aria-describedby="stock-result"
              className={`flex-1 min-w-0 h-12 px-3 rounded-xl border bg-white text-center text-xl font-extrabold text-slate-900 tabular-nums focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${problem
                ? 'border-red-300 focus:ring-red-300/40' : 'border-slate-200 focus:ring-emerald-400/40 focus:border-emerald-400'}`} />
            <button type="button" onClick={() => step(1)} aria-label="One more"
              className="w-12 h-12 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer inline-flex items-center justify-center"><Plus size={18} /></button>
          </div>
          {(m.chips.length > 0 || mode === 'damaged') && (
            <div className="flex flex-wrap gap-1.5" aria-label="Quick amounts">
              {m.chips.filter(c => mode !== 'damaged' || c < stock).map(c => (
                <button key={c} type="button" onClick={() => { setQty(String(c)); setSaved(''); }}
                  className={`h-8 px-3 rounded-full border text-xs font-bold cursor-pointer ${Number(qty) === c ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {mode === 'restock' ? `+${c}` : c}
                </button>
              ))}
              {mode === 'damaged' && stock > 0 && (
                <button type="button" onClick={() => { setQty(String(stock)); setSaved(''); }}
                  className={`h-8 px-3 rounded-full border text-xs font-bold cursor-pointer ${Number(qty) === stock ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  All {stock}
                </button>
              )}
            </div>
          )}

          {/* Before → after: the answer to "what will this do?" */}
          <div id="stock-result" aria-live="polite"
            className={`rounded-xl px-3 py-2.5 text-sm ${problem ? 'bg-red-50 text-red-800' : after != null ? 'bg-slate-50' : 'bg-slate-50 text-slate-500'}`}>
            {problem ? <span className="font-semibold flex items-start gap-1.5"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{problem}</span>
              : after == null ? (mode === 'count' ? 'Count what’s on the shelf and enter the total.' : 'Enter a number to see the new stock.')
                : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-extrabold text-slate-900 tabular-nums text-lg">
                      <span className="text-slate-400">{stock}</span><ArrowRight size={16} className="text-slate-400" />{after}
                      <span className="text-xs font-semibold text-slate-500">units</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${next.cls}`}><next.Icon size={13} /> {next.text}</span>
                  </div>
                )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="stock-note">Note<span className="font-normal text-slate-400"> (optional)</span></label>
            <input id="stock-note" className={input} value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder={`${m.note}…`} />
          </div>
        </div>

        {error && <p className="m-0 text-sm text-red-700 font-semibold" role="alert">{error}</p>}
        {saved && !error && (
          <p className="m-0 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-1.5" role="status">
            <CircleCheck size={16} /> Saved: {saved}
          </p>
        )}
        <button type="submit" disabled={busy || after == null}
          className="h-12 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-sm">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><m.Icon size={17} /> {action}</>}
        </button>
      </form>

      {/* What happened before */}
      <div className="px-4 sm:px-5 pt-1 pb-5 bg-slate-50">
        <p className="m-0 mb-2 text-xs font-extrabold tracking-wider uppercase text-slate-500 flex items-center gap-1.5"><History size={13} /> Recent changes</p>
        {!history ? <p className="m-0 text-sm text-slate-500">Loading…</p> : !history.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center">
            <History size={20} className="text-slate-300 mx-auto" />
            <p className="m-0 mt-1.5 text-sm font-semibold text-slate-600">No changes recorded yet</p>
            <p className="m-0 mt-0.5 text-xs text-slate-500">Restocks, removals, counts and sales will show here.</p>
          </div>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {history.map(h => {
              const [name, Icon, tint] = REASON_LOOK[h.reason] || [h.reason_label, History, 'bg-slate-100 text-slate-600'];
              return (
                <li key={h.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                  <span className={`w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center ${tint}`} aria-hidden="true"><Icon size={15} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-slate-800 truncate">{name}{h.note ? <span className="font-normal text-slate-500"> · {h.note}</span> : ''}</span>
                    <span className="block text-xs text-slate-500">{new Date(h.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{h.user_name ? ` · ${h.user_name}` : ''}</span>
                  </span>
                  <span className="text-right shrink-0 tabular-nums">
                    <span className={`block font-extrabold ${h.change > 0 ? 'text-emerald-700' : h.change < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{h.change > 0 ? '+' : ''}{h.change}</span>
                    <span className="block text-[11px] text-slate-500">→ {h.quantity_after}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/* ── Inventory page pieces ──────────────────────────────────────────────────────────────────
 * Stat tiles answer the first questions (how many, what's running low, what's sold out, what's it worth).
 * Numbers stay in ink; status colour only marks the icon and always comes with a label (dataviz rules). */
const wholePeso = (n) => `₱${Math.round(Number(n) || 0).toLocaleString('en-PH')}`;
const TILE_TONES = {
  emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600', slate: 'bg-slate-100 text-slate-600',
};
function StatTile({ icon: Icon, tone, label, value, sub, pressed, onClick }) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className={`w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center ${TILE_TONES[tone]}`} aria-hidden="true"><Icon size={16} /></span>
        <span className="text-xs font-semibold text-slate-500 leading-tight">{label}</span>
      </span>
      <span className="block mt-2 text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-none">{value}</span>
      {sub && <span className="block mt-1 text-[11px] text-slate-500 leading-snug line-clamp-2">{sub}</span>}
    </>
  );
  const base = 'block text-left rounded-2xl border bg-white p-3.5 sm:p-4 shadow-sm min-w-0';
  if (!onClick) return <div className={`${base} border-slate-200`}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed}
      className={`${base} cursor-pointer transition-all ${pressed ? 'border-emerald-500 ring-2 ring-emerald-400/30' : 'border-slate-200 hover:border-slate-300 hover:shadow'}`}>
      {body}
    </button>
  );
}

// "⋯" menu for the less frequent row actions. Positioned `fixed` from the button, so the table's own
// scroll box can't clip it; closes on outside click, Escape, scroll and resize.
function RowMenu({ label, actions }) {
  const [at, setAt] = useState(null);   // { top, right } in viewport px while open
  useEffect(() => {
    if (!at) return undefined;
    const close = () => setAt(null);
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', close);
    };
  }, [at]);
  const open = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    // `fixed` offsets are measured from the page area, which excludes the scrollbar (innerWidth includes it)
    const { clientWidth: vw, clientHeight: vh } = document.documentElement;
    const below = vh - r.bottom > 140;
    setAt(at ? null : { top: below ? r.bottom + 4 : undefined, bottom: below ? undefined : vh - r.top + 4, right: vw - r.right });
  };
  const shown = actions.filter(Boolean);
  if (!shown.length) return null;
  return (
    <>
      <button type="button" onClick={open} className={iconBtn} aria-haspopup="menu" aria-expanded={!!at} aria-label={`More actions for ${label}`} title="More">
        <Ellipsis size={18} />
      </button>
      {at && (
        <div role="menu" style={{ position: 'fixed', top: at.top, bottom: at.bottom, right: at.right }} onPointerDown={(e) => e.stopPropagation()}
          className="z-[120] min-w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {shown.map(({ text, Icon, onSelect, danger, disabled }) => (
            <button key={text} type="button" role="menuitem" disabled={disabled} onClick={() => { setAt(null); onSelect(); }}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold border-none bg-transparent cursor-pointer disabled:opacity-40 ${danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}>
              <Icon size={16} className="shrink-0" /> {text}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Stock as people say it: "7 left · alert at 10" when low, "Out of stock" in plain words, "52 in stock" otherwise
function StockCell({ item }) {
  const n = item.stock_quantity;
  if (n <= 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700"><PackageX size={14} /> Out of stock</span>;
  if (item.is_low_stock) {
    return (
      <span className="inline-flex flex-col items-end leading-tight">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800"><AlertTriangle size={13} /> {n} left</span>
        <span className="text-[11px] text-slate-500">alert at {item.reorder_level}</span>
      </span>
    );
  }
  return <span className="text-sm font-semibold text-slate-700 tabular-nums">{n} <span className="text-xs font-normal text-slate-500">in stock</span></span>;
}

function Thumb({ item, size = 'w-12 h-12' }) {
  return productImage(item)
    ? <img src={productImage(item)} alt="" className={`${size} rounded-xl object-cover bg-slate-100 block shrink-0`} />
    : <span title="No picture yet" className={`${size} rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center shrink-0`}><ImageOff size={16} /></span>;
}
function CategoryChip({ item }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${CATEGORY_CHIP[item.category] || ''}`}>{CATEGORIES[item.category] || item.category}</span>;
}

const SORTS = [
  ['name', 'Name A–Z', (a, b) => a.name.localeCompare(b.name)],
  ['stock', 'Lowest stock first', (a, b) => a.stock_quantity - b.stock_quantity || a.name.localeCompare(b.name)],
  ['price_high', 'Price: high to low', (a, b) => Number(b.unit_price) - Number(a.unit_price)],
  ['price_low', 'Price: low to high', (a, b) => Number(a.unit_price) - Number(b.unit_price)],
];

export default function InventoryDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);     // item, or 'new'
  const [stockFor, setStockFor] = useState(null);
  const [rendering, setRendering] = useState(null); // { id } or { done, total }
  const [notice, setNotice] = useState('');

  const fetchItems = async () => {
    try { setItems(await getInventoryItems(null, { archived: true })); } catch { /* keep what we have */ }
    setLoading(false);
  };
  useEffect(() => {
    getInventoryItems(null, { archived: true }).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Uploaded 3D models + the space they use (null until loaded: the picker then offers bundled models only)
  const [modelSpace, setModelSpace] = useState(null);
  const fetchModels = () => getUploadedModels().then(setModelSpace).catch(() => {});
  useEffect(() => { fetchModels(); }, []);
  const modelOptions = useMemo(() => [...MODEL_OPTIONS, ...(modelSpace?.models || []).map(uploadedModelOption)], [modelSpace]);
  const modelUploaded = (model) => {
    setModelSpace(s => s && { ...s, models: [...s.models, model], used_bytes: s.used_bytes + model.size_bytes });
    setNotice(`3D model "${model.label}" uploaded.`);
  };
  const deleteModel = async (option) => {
    if (!window.confirm(`Delete the uploaded 3D model "${option.label}"? This can't be undone.`)) return;
    try { await deleteUploadedModel(option.id); setNotice(`3D model "${option.label}" deleted.`); }
    catch (err) { setNotice(err.response?.data?.error || `Could not delete "${option.label}".`); }
    fetchModels();
  };
  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(t); }, [notice]);

  const active = items.filter(i => i.is_active);
  const archivedItems = items.filter(i => !i.is_active);
  const low = active.filter(i => i.is_low_stock && i.stock_quantity > 0);
  const out = active.filter(i => i.stock_quantity <= 0);
  const stockValue = active.reduce((sum, i) => sum + Math.max(0, i.stock_quantity) * Number(i.unit_price || 0), 0);
  const countBy = (list) => Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, list.filter(i => i.category === c).length]));

  // What the list shows: tab → stock filter (tiles) → category → search → sort
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [stockFilter, setStockFilter] = useState(null);   // 'low' | 'out' | null
  const [sort, setSort] = useState('name');
  const base = showArchived ? archivedItems : active;
  const catCounts = countBy(base);
  const q = query.trim().toLowerCase();
  const shown = base
    .filter(i => showArchived || !stockFilter || (stockFilter === 'low' ? low.includes(i) : out.includes(i)))
    .filter(i => cat === 'all' || i.category === cat)
    .filter(i => !q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
    .sort(SORTS.find(([k]) => k === sort)[2]);
  const filtered = !!q || cat !== 'all' || (!showArchived && !!stockFilter);
  const clearFilters = () => { setQuery(''); setCat('all'); setStockFilter(null); };
  const toggleStock = (which) => { setShowArchived(false); setStockFilter(f => (f === which ? null : which)); };

  const renderAndUpload = async (item) => {
    const data = new FormData();
    data.append('thumbnail', await renderModelThumbnail(resolveModelUrl(item.model_file)), 'product.jpg');
    return patchInventoryItem(item.id, data);
  };
  const generateOne = async (item) => {
    if (productImage(item) && !window.confirm(`Replace the picture of "${item.name}" with one made from its 3D model?`)) return;
    setRendering({ id: item.id });
    try { await renderAndUpload(item); await fetchItems(); setNotice(`New picture for "${item.name}".`); }
    catch { setNotice(`Could not make a picture of "${item.name}" from its 3D model.`); }
    setRendering(null);
  };
  const generateMissing = async () => {
    const todo = active.filter(needsPhoto);
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      setRendering({ done: i, total: todo.length });
      try { await renderAndUpload(todo[i]); } catch { failed++; }
    }
    setRendering(null);
    await fetchItems();
    setNotice(failed ? `${failed} of ${todo.length} pictures could not be made.` : `${todo.length} pictures made.`);
  };
  const archive = async (item) => {
    if (!window.confirm(`Archive "${item.name}"? It leaves the shop, 3D Studio and AI Designer. Past orders and saved designs keep it, and you can restore it any time.`)) return;
    await deleteInventoryItem(item.id); await fetchItems(); setNotice(`"${item.name}" archived.`);
  };
  const restore = async (item) => { await restoreInventoryItem(item.id); await fetchItems(); setNotice(`"${item.name}" is back in the shop.`); };

  // The same actions serve the desktop table and the phone cards
  const rowActions = (item) => (item.is_active ? (
    <>
      <button type="button" onClick={() => setStockFor(item)}
        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-emerald-300 hover:bg-emerald-50/50">
        <Boxes size={15} /> Stock
      </button>
      <button type="button" onClick={() => setEditing(item)}
        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-emerald-300 hover:bg-emerald-50/50">
        <Pencil size={15} /> Edit
      </button>
      <RowMenu label={item.name} actions={[
        resolveModelUrl(item.model_file) && {
          text: rendering?.id === item.id ? 'Making picture…' : 'Make picture from 3D model', Icon: Wand2,
          onSelect: () => generateOne(item), disabled: !!rendering,
        },
        { text: 'Archive', Icon: Archive, onSelect: () => archive(item), danger: true },
      ]} />
    </>
  ) : (
    <button type="button" onClick={() => restore(item)}
      className="h-10 px-3 rounded-lg border border-emerald-200 bg-white text-emerald-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5">
      <ArchiveRestore size={15} /> Restore
    </button>
  ));

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Package size={20} /></span>
          <div>
            <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Inventory</h1>
            <p className="m-0 text-sm text-slate-500">Products for the shop, the 3D Studio and the AI Designer</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {active.some(needsPhoto) && (
            <button type="button" onClick={generateMissing} disabled={!!rendering}
              className="h-11 px-4 rounded-xl border border-emerald-200 bg-white text-emerald-800 text-sm font-bold cursor-pointer inline-flex items-center gap-2 disabled:opacity-60">
              <Wand2 size={16} /> {rendering?.total ? `Making ${rendering.done + 1} of ${rendering.total}…` : `Make ${active.filter(needsPhoto).length} missing pictures`}
            </button>
          )}
          <button type="button" onClick={() => setEditing('new')}
            className="h-11 px-4 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer inline-flex items-center gap-2 shadow-sm">
            <Plus size={16} /> Add item
          </button>
        </div>
      </div>

      {/* The four questions first: how many, what's running low, what's sold out, what's it all worth */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatTile icon={Package} tone="emerald" label="Items for sale" value={active.length}
            sub={Object.entries(countBy(active)).filter(([, n]) => n).map(([c, n]) => `${n} ${CATEGORIES[c].toLowerCase()}`).join(' · ') || 'None yet'} />
          <StatTile icon={AlertTriangle} tone="amber" label="Low on stock" value={low.length}
            sub={stockFilter === 'low' ? 'Showing these · tap to clear' : low.length ? 'Tap to see them' : 'All above their alert level'}
            pressed={stockFilter === 'low'} onClick={low.length || stockFilter === 'low' ? () => toggleStock('low') : undefined} />
          <StatTile icon={PackageX} tone="red" label="Out of stock" value={out.length}
            sub={stockFilter === 'out' ? 'Showing these · tap to clear' : out.length ? 'Not offered by the AI Designer' : 'Nothing sold out'}
            pressed={stockFilter === 'out'} onClick={out.length || stockFilter === 'out' ? () => toggleStock('out') : undefined} />
          <StatTile icon={Coins} tone="slate" label="Stock value" value={wholePeso(stockValue)} sub="Units on hand × shop price" />
        </div>
      )}

      {/* Find: search · category · sort, then which list (for sale / archived) */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products"
            aria-label="Search products" className={`${input} pl-9 h-10`} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto max-w-full -mx-1 px-1 pb-0.5" role="group" aria-label="Category">
          {[['all', 'All', base.length], ...Object.entries(CATEGORIES).map(([k, l]) => [k, l, catCounts[k]])].map(([k, l, n]) => (
            <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
              className={`shrink-0 h-10 px-3.5 rounded-full border text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5 ${cat === k
                ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {l} <span className={`text-xs tabular-nums ${cat === k ? 'text-slate-300' : 'text-slate-400'}`}>{n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <label className="relative flex-1 sm:flex-none">
            <span className="sr-only">Sort</span>
            <ArrowUpDown size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${input} h-10 pl-9 pr-8 text-sm font-semibold text-slate-700 cursor-pointer`}>
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0" role="group" aria-label="Which items">
            {[[false, 'For sale'], [true, `Archived${archivedItems.length ? ` (${archivedItems.length})` : ''}`]].map(([v, text]) => (
              <button key={String(v)} type="button" aria-pressed={showArchived === v} onClick={() => setShowArchived(v)}
                className={`h-8 px-3 rounded-lg border-none text-sm font-bold cursor-pointer whitespace-nowrap ${showArchived === v ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && <p role="status" className="m-0 mb-4 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">{notice}</p>}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? <p className="m-0 p-10 text-center text-slate-500">Loading inventory…</p>
          : !shown.length ? (
            <div className="p-10 text-center">
              <p className="m-0 text-slate-600 font-semibold">
                {filtered ? 'No products match these filters.' : showArchived ? 'Nothing archived.' : 'No products yet.'}
              </p>
              {filtered
                ? <button type="button" onClick={clearFilters} className="mt-3 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 cursor-pointer">Clear filters</button>
                : !showArchived && <button type="button" onClick={() => setEditing('new')} className="mt-3 h-10 px-4 rounded-xl border-none bg-emerald-600 text-white text-sm font-bold cursor-pointer inline-flex items-center gap-2"><Plus size={16} /> Add your first product</button>}
            </div>
          ) : (
          <>
            {/* Computers and tablets: a table */}
            <table className="hidden md:table w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(item => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Thumb item={item} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => (item.is_active ? setEditing(item) : null)}
                            className={`block max-w-full truncate p-0 border-none bg-transparent text-left text-[15px] font-bold text-slate-900 ${item.is_active ? 'cursor-pointer hover:text-emerald-700' : 'cursor-default'}`}>
                            {item.name}
                          </button>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <CategoryChip item={item} />
                            {!item.model_file && <span className="text-[11px] text-slate-500">Shop only, no 3D model</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap"><StockCell item={item} /></td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{peso(item.unit_price)}</td>
                    <td className="px-4 py-3"><div className="flex justify-end items-center gap-1.5">{rowActions(item)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phones: one card per product, everything visible without sideways scrolling */}
            <ul className="md:hidden m-0 p-0 list-none divide-y divide-slate-100">
              {shown.map(item => (
                <li key={item.id} className="p-3.5 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <Thumb item={item} size="w-14 h-14" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[15px] font-bold text-slate-900 leading-snug">{item.name}</p>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5"><CategoryChip item={item} /></span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="m-0 font-bold text-slate-900 tabular-nums">{peso(item.unit_price)}</p>
                      <div className="mt-1"><StockCell item={item} /></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">{rowActions(item)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {!loading && shown.length > 0 && filtered && (
        <p className="m-0 mt-2.5 text-xs text-slate-500">
          Showing {shown.length} of {base.length} · <button type="button" onClick={clearFilters} className="p-0 border-none bg-transparent text-xs font-bold text-emerald-700 underline cursor-pointer">Clear filters</button>
        </p>
      )}

      {editing && (
        <ItemForm item={editing === 'new' ? null : editing} items={items} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); fetchItems(); fetchModels(); }}
          modelOptions={modelOptions} modelSpace={modelSpace} onModelUploaded={modelUploaded} onDeleteModel={deleteModel} />
      )}
      {stockFor && <StockDialog item={stockFor} onClose={() => { setStockFor(null); fetchItems(); }} onSaved={setNotice} />}
    </div>
  );
}
