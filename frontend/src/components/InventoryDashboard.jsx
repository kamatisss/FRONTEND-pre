import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Pencil, Archive, ArchiveRestore, X, Wand2, ImageOff, Boxes, History, Box, Loader2, Sprout, Mountain, Armchair,
  Sun, CloudSun, Cloud, Droplet, ImagePlus, AlertTriangle, Layers, MoveHorizontal,
} from 'lucide-react';
import {
  getInventoryItems, createInventoryItem, patchInventoryItem, deleteInventoryItem, restoreInventoryItem,
  adjustStock, getStockHistory, getPricing,
} from '../services/api';
import { renderModelThumbnail } from '../services/modelThumbnail';
import { MODEL_OPTIONS, resolveModelUrl } from '../data/modelCatalog';
import { sizeHint, sizeLabel, SIZE_MEASURE } from '../data/modelSizing';
import { allIn, installedPrice, labourLayer, MAKEOVER, layoutLayer, layoutSpacing, grownHeight } from '../data/pricing';
import { productImage } from '../data/productImage';

/*
 * Inventory (office). Stock only changes through recorded adjustments (restock / damaged / stock count;
 * orders record their own sales), so an open edit form can never undo a sale. 3D models are picked from
 * the models bundled with the app (data/modelCatalog.js), not uploaded. "Archive" replaces delete:
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

function ModelPicker({ value, category, onPick, usedBy, photoOf }) {
  const selected = MODEL_OPTIONS.find(o => o.file === value) || null;
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const list = MODEL_OPTIONS.filter(o => showAll || o.category === category)
    .sort((a, b) => Number(b.category === category) - Number(a.category === category) || a.label.localeCompare(b.label));
  const pick = (option) => { onPick(option); setOpen(false); };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 pr-3">
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
        <button type="button" id="inv-model" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="inv-model-grid"
          className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 shrink-0">
          {open ? 'Close' : selected ? 'Change' : 'Choose'}
        </button>
      </div>
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
              return (
                <button key={option.file} type="button" role="radio" aria-checked={on} onClick={() => pick(option)}
                  title={user ? `${option.label}: used by ${user}` : option.label}
                  className={`relative rounded-xl border bg-white p-1.5 cursor-pointer text-left ${on ? 'border-emerald-500 ring-2 ring-emerald-400/30' : 'border-slate-200 hover:border-slate-300'}`}>
                  <ModelImage option={option} photo={photoOf[option.file]} className="aspect-square rounded-lg" />
                  <span className="block mt-1 text-[11px] font-semibold text-slate-700 leading-tight truncate">{option.label}</span>
                  {user && <span className="absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5">In use</span>}
                  {showAll && option.category !== category && (
                    <span className="block text-[10px] text-slate-400">{CATEGORIES[option.category]}</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="m-0 mt-2 text-[11px] text-slate-500">New models are added by the developer (they ship with the app).</p>
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

/* ── Photo: drop or pick a file, see it before saving, remove it again ── */
const PHOTO_MAX_MB = 10;
function PhotoDrop({ file, currentUrl, onFile, error }) {
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState('');
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const take = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setProblem('That file isn’t a picture. Use a JPG, PNG or WebP.'); return; }
    if (f.size > PHOTO_MAX_MB * 1024 * 1024) { setProblem(`That picture is over ${PHOTO_MAX_MB} MB. Use a smaller one.`); return; }
    setProblem('');
    onFile(f);
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
        <input id="inv-photo" type="file" accept="image/*" className="sr-only" onChange={e => { take(e.target.files?.[0]); e.target.value = ''; }} />
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
          <p className={`m-0 mt-1 text-[11px] font-semibold ${stock > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{stock > 0 ? `${stock} in stock` : 'Out of stock: the AI Designer won’t use it'}</p>
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
          <p className={row}><Box size={14} className="shrink-0 mt-px text-emerald-600" /> Shown {sizeOk ? `${Number(form.real_world_size).toFixed(2)} m` : ''} {SIZE_MEASURE[form.category] === 'longest' ? 'on its longest side' : 'tall'} in 3D.</p>
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
const CATEGORY_CARDS = [
  { key: 'plant', label: 'Plant', sub: 'Grows: sizes over time, sun and water', Icon: Sprout },
  { key: 'hardscape', label: 'Hardscape', sub: 'Rocks and stones', Icon: Mountain },
  { key: 'furniture', label: 'Furniture', sub: 'Benches and chairs', Icon: Armchair },
];
// Server field → the input it belongs to (errors are shown there, and the form scrolls to the first one)
const FIELD_IDS = {
  name: 'inv-name', category: 'inv-cat-plant', unit_price: 'inv-price', description: 'inv-desc', reorder_level: 'inv-reorder',
  stock_quantity: 'inv-stock', real_world_size: 'inv-size', planting_height: 'inv-planting_height', mature_height: 'inv-mature_height',
  planting_spread: 'inv-planting_spread', established_spread: 'inv-established_spread', mature_spread: 'inv-mature_spread',
  sunlight: 'inv-sun', water_need: 'inv-water', model_file: 'inv-model', thumbnail: 'inv-photo', spacing_cm: 'inv-spacing',
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

function Section({ n, title, hint, children }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`inv-sec-${n}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-slate-100 pb-1.5">
        <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold inline-flex items-center justify-center">{n}</span>
        <h4 id={`inv-sec-${n}`} className="m-0 text-[15px] font-extrabold text-slate-900">{title}</h4>
        {hint && <span className="text-xs text-slate-500 min-w-0 basis-full pl-8 sm:basis-auto sm:pl-0">{hint}</span>}
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

function ItemForm({ item, items, onClose, onSaved }) {
  const initial = useMemo(() => ({
    name: item?.name || '', category: item?.category || 'plant', description: item?.description || '',
    unit_price: item?.unit_price || '', reorder_level: item?.reorder_level ?? 10, stock_quantity: 0,
    model_file: item?.model_file || '', real_world_size: item?.real_world_size ?? 1,
    sunlight: item?.sunlight || 'full_sun', water_need: item?.water_need || 'moderate', is_invasive: !!item?.is_invasive,
    planting_height: item?.planting_height ?? '', mature_height: item?.mature_height ?? '',
    planting_spread: item?.planting_spread ?? '', established_spread: item?.established_spread ?? '',
    mature_spread: item?.mature_spread ?? '', spacing_cm: item?.spacing_cm ?? '',
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
    const first = Object.keys(FIELD_IDS).find(k => errs[k]);
    if (first) {
      const el = document.getElementById(FIELD_IDS[first]);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
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
      if (!item) data.append('stock_quantity', form.stock_quantity || 0);   // opening stock, new items only
      if (photo) data.append('thumbnail', photo);
      // A model and no photo yet: photograph the model so the shop isn't left blank
      const option = MODEL_OPTIONS.find(o => o.file === form.model_file);
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

  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add an item'}
      subtitle={item ? 'Stock is changed with the Stock button, so every change is recorded.' : 'Fields marked * are required.'}
      onClose={requestClose} xl>
      <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
        <div className="overflow-y-auto px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-8 lg:items-start">
        <div className="flex flex-col gap-6">
          {/* Category first: it decides which of the fields below exist */}
          <fieldset className="m-0 p-0 border-0">
            <legend className={label}>What are you adding?<Req /></legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
              {CATEGORY_CARDS.map(({ key, label: text, sub, Icon }) => {
                const on = form.category === key;
                return (
                  <button key={key} id={`inv-cat-${key}`} type="button" role="radio" aria-checked={on} onClick={() => change('category', key)}
                    className={`text-left rounded-xl border p-2.5 sm:p-3 cursor-pointer min-h-[44px] transition-colors ${on
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <Icon size={18} className={on ? 'text-emerald-700' : 'text-slate-400'} />
                    <span className={`block mt-1 text-sm font-bold ${on ? 'text-emerald-900' : 'text-slate-800'}`}>{text}</span>
                    <span className="hidden sm:block text-[11px] leading-snug text-slate-500">{sub}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Section n={1} title="Basics">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="inv-price">Price per {unit}<Req /></label>
                <UnitInput id="inv-price" prefix="₱" step="0.01" min="0.01" value={form.unit_price} onChange={set('unit_price')} required
                  error={fieldErrors.unit_price} describedBy="inv-price-hint" placeholder="0.00" />
                <p id="inv-price-hint" className="m-0 mt-1 text-xs text-slate-500">The shop price. Installed quotes add planting labour on top.</p>
                <FieldError id="inv-price" msg={fieldErrors.unit_price} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="inv-desc">Description<Opt /></label>
              <textarea id="inv-desc" className={`${input} h-auto py-2.5`} rows={3} value={form.description} onChange={set('description')}
                placeholder="Shown on the shop page: what it looks like, where it does well." />
              <FieldError id="inv-desc" msg={fieldErrors.description} />
            </div>
          </Section>

          <Section n={2} title="Picture" hint="How customers see it in the shop and in 3D">
            <div>
              <span className={label}>3D model<Opt /></span>
              <ModelPicker value={form.model_file} category={form.category} usedBy={usedBy} photoOf={photoOf} onPick={pickModel} />
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

          <Section n={3} title={isPlant ? 'Size & growth' : 'Size'}
            hint={isPlant ? 'Sets the 3D size, where the AI Designer puts it, and the planting labour' : 'Sets the size in 3D'}>
            {isPlant ? (
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
                  Height after ~2 years is the one we use for the 3D view, the AI layout and the quote. The others (–) are optional:
                  they show customers how the plant changes. Empty widths follow the height.
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
                      Centre to centre. Empty = worked out from the fully grown height. Used by the AI layout and the work order.
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
            <Section n={4} title="Growing needs" hint="The AI Designer keeps plants with clashing needs apart">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChipGroup id="inv-sun" label="Sunlight" options={SUN_OPTIONS} value={form.sunlight} onChange={(v) => change('sunlight', v)} />
                <ChipGroup id="inv-water" label="Water" options={WATER_OPTIONS} value={form.water_need} onChange={(v) => change('water_need', v)} />
              </div>
              <label htmlFor="inv-invasive" className="flex items-start gap-2.5 text-sm text-slate-700 min-h-[44px] cursor-pointer rounded-xl border border-slate-200 px-3 py-2.5">
                <input id="inv-invasive" type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0" checked={form.is_invasive}
                  onChange={e => change('is_invasive', e.target.checked)} />
                <span><b className="font-semibold text-slate-800">Aggressive roots</b> (e.g. bamboo)
                  <span className="block text-xs text-slate-500">Spreads underground: the AI Designer keeps other plants clear of it.</span></span>
              </label>
            </Section>
          )}

          <Section n={isPlant ? 5 : 4} title="Stock">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!item && (
                <div>
                  <label className={label} htmlFor="inv-stock">Units on hand now</label>
                  <UnitInput id="inv-stock" suffix="units" step="1" min="0" value={form.stock_quantity} onChange={set('stock_quantity')}
                    error={fieldErrors.stock_quantity} describedBy="inv-stock-hint" />
                  <p id="inv-stock-hint" className="m-0 mt-1 text-xs text-slate-500">Recorded as the opening stock. Later changes use the Stock button.</p>
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
            <ItemPreview form={form} model={MODEL_OPTIONS.find(o => o.file === form.model_file) || null} rates={rates}
              picture={photoUrl || (item && productImage(item)) || photoOf[form.model_file] || null}
              stock={item ? item.stock_quantity : Number(form.stock_quantity) || 0} />
          </aside>
        </div>

        {/* Pinned: Save is always in reach, the reason it can't save is right above it */}
        <div className="border-t border-slate-100 bg-white px-5 py-3 rounded-b-2xl">
          {error && <p className="m-0 mb-2 text-sm text-red-700 font-semibold" role="alert">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            {dirty && !saving && <span className="mr-auto text-xs text-slate-400">Unsaved changes</span>}
            <button type="button" onClick={requestClose} className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="h-11 px-5 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── Stock: restock / damaged / count, and the item's history ── */
const MODES = [
  { key: 'restock', label: 'Restock', hint: 'Units that arrived', sign: '+' },
  { key: 'damaged', label: 'Damaged or lost', hint: 'Units to remove', sign: '−' },
  { key: 'count', label: 'Stock count', hint: 'Units actually on hand', sign: '=' },
];
function StockDialog({ item, onClose, onSaved }) {
  const [mode, setMode] = useState('restock');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(item);
  const [history, setHistory] = useState(null);

  useEffect(() => { getStockHistory(item.id).then(setHistory).catch(() => setHistory([])); }, [item.id]);

  const preview = qty === '' ? null : mode === 'restock' ? current.stock_quantity + Number(qty)
    : mode === 'damaged' ? current.stock_quantity - Number(qty) : Number(qty);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { movement, item: updated } = await adjustStock(item.id, { reason: mode, quantity: qty, note });
      setCurrent(updated);
      setHistory(h => [movement, ...(h || [])]);
      setQty(''); setNote('');
      onSaved(`${updated.name}: ${movement.change > 0 ? '+' : ''}${movement.change} → ${updated.stock_quantity} in stock.`);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <Modal title={`Stock · ${item.name}`} subtitle={`${current.stock_quantity} in stock · low at ${current.reorder_level}`} onClose={onClose}>
      <form onSubmit={save} className="p-5 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl" role="group" aria-label="Kind of change">
          {MODES.map(m => (
            <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => { setMode(m.key); setError(''); }}
              className={`min-h-[40px] rounded-lg border-none text-sm font-bold cursor-pointer ${mode === m.key ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className={label} htmlFor="stock-qty">{MODES.find(m => m.key === mode).hint}</label>
            <input id="stock-qty" className={input} type="number" min="0" step="1" value={qty} onChange={e => setQty(e.target.value)} required autoFocus />
          </div>
          <p className="m-0 h-11 flex items-center text-sm text-slate-600 whitespace-nowrap">
            {preview == null ? ' ' : <>New stock: <b className={`ml-1 ${preview < 0 ? 'text-red-700' : 'text-slate-900'}`}>{preview}</b></>}
          </p>
        </div>
        <input className={input} value={note} onChange={e => setNote(e.target.value)} maxLength={200}
          placeholder={mode === 'restock' ? 'Supplier or delivery (optional)' : mode === 'damaged' ? 'What happened (optional)' : 'Who counted (optional)'} />
        {error && <p className="m-0 text-sm text-red-700 font-semibold" role="alert">{error}</p>}
        <button type="submit" disabled={busy || qty === ''} className="h-11 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
      <div className="px-5 pb-5">
        <p className="m-0 mb-2 text-xs font-extrabold tracking-wider uppercase text-slate-500 flex items-center gap-1.5"><History size={13} /> History</p>
        {!history ? <p className="m-0 text-sm text-slate-500">Loading…</p> : !history.length ? <p className="m-0 text-sm text-slate-500">No changes recorded yet.</p> : (
          <ul className="m-0 p-0 list-none divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {history.map(h => (
              <li key={h.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                <span className={`w-14 text-right font-extrabold tabular-nums ${h.change > 0 ? 'text-emerald-700' : h.change < 0 ? 'text-red-700' : 'text-slate-500'}`}>{h.change > 0 ? '+' : ''}{h.change}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-slate-800 truncate">{h.reason_label}{h.note ? ` · ${h.note}` : ''}</span>
                  <span className="block text-xs text-slate-500">{new Date(h.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{h.user_name ? ` · ${h.user_name}` : ''}</span>
                </span>
                <span className="text-slate-500 tabular-nums">→ {h.quantity_after}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

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
  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(t); }, [notice]);

  const active = items.filter(i => i.is_active);
  const shown = showArchived ? items.filter(i => !i.is_active) : active;
  const low = active.filter(i => i.is_low_stock);

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

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Package size={20} /></span>
          <div>
            <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Inventory</h1>
            <p className="m-0 text-sm text-slate-500">{active.length} items for sale{low.length ? <> · <b className="text-amber-700">{low.length} low on stock</b></> : ''}</p>
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
            className="h-11 px-4 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer inline-flex items-center gap-2">
            <Plus size={16} /> Add item
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-4" role="group" aria-label="Which items">
        {[[false, `For sale (${active.length})`], [true, `Archived (${items.length - active.length})`]].map(([v, text]) => (
          <button key={String(v)} type="button" aria-pressed={showArchived === v} onClick={() => setShowArchived(v)}
            className={`min-h-[38px] px-4 rounded-lg border-none text-sm font-bold cursor-pointer ${showArchived === v ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>
            {text}
          </button>
        ))}
      </div>

      {notice && <p role="status" className="m-0 mb-4 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">{notice}</p>}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? <p className="m-0 p-10 text-center text-slate-500">Loading inventory…</p>
          : !shown.length ? <p className="m-0 p-10 text-center text-slate-500">{showArchived ? 'Nothing archived.' : 'No items yet. Add one to get started.'}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-16">Photo</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(item => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      {productImage(item)
                        ? <img src={productImage(item)} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-100 block" />
                        : <span title="No picture yet" className="w-11 h-11 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center"><ImageOff size={16} /></span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="m-0 font-bold text-slate-900">{item.name}</p>
                      <p className="m-0 text-xs text-slate-500">{item.model_file ? `3D: ${MODEL_OPTIONS.find(o => o.file === item.model_file)?.label || item.model_file}` : 'No 3D model · shop only'}</p>
                    </td>
                    <td className="px-4 py-2.5"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${CATEGORY_CHIP[item.category] || ''}`}>{CATEGORIES[item.category] || item.category}</span></td>
                    <td className="px-4 py-2.5 text-right"><StockBadge item={item} /></td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{peso(item.unit_price)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end items-center gap-1">
                        {item.is_active ? (
                          <>
                            <button type="button" onClick={() => setStockFor(item)}
                              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 hover:border-emerald-300">
                              <Boxes size={15} /> Stock
                            </button>
                            {resolveModelUrl(item.model_file) && (
                              <button type="button" onClick={() => generateOne(item)} disabled={!!rendering} className={iconBtn}
                                title="Make the picture from the 3D model" aria-label={`Make a picture of ${item.name} from its 3D model`}>
                                <Wand2 size={16} className={rendering?.id === item.id ? 'animate-pulse text-emerald-600' : needsPhoto(item) ? 'text-emerald-600' : ''} />
                              </button>
                            )}
                            <button type="button" onClick={() => setEditing(item)} className={iconBtn} title="Edit" aria-label={`Edit ${item.name}`}><Pencil size={16} /></button>
                            <button type="button" onClick={() => archive(item)} className={iconBtn} title="Archive" aria-label={`Archive ${item.name}`}><Archive size={16} /></button>
                          </>
                        ) : (
                          <button type="button" onClick={() => restore(item)}
                            className="h-10 px-3 rounded-lg border border-emerald-200 bg-white text-emerald-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5">
                            <ArchiveRestore size={15} /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ItemForm item={editing === 'new' ? null : editing} items={items} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); fetchItems(); }} />
      )}
      {stockFor && <StockDialog item={stockFor} onClose={() => { setStockFor(null); fetchItems(); }} onSaved={setNotice} />}
    </div>
  );
}
