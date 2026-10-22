import { useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Pencil, Archive, ArchiveRestore, X, Wand2, ImageOff, Boxes, History, Box, Loader2,
} from 'lucide-react';
import {
  getInventoryItems, createInventoryItem, patchInventoryItem, deleteInventoryItem, restoreInventoryItem,
  adjustStock, getStockHistory,
} from '../services/api';
import { renderModelThumbnail } from '../services/modelThumbnail';
import { MODEL_OPTIONS, resolveModelUrl } from '../data/modelCatalog';
import { sizeHint, sizeLabel } from '../data/modelSizing';
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

function Modal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="m-0 text-lg font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="m-0 mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ── 3D model picker: the bundled models, with a rendered preview ── */
const previewCache = new Map();
function ModelPicker({ value, category, onChange, usedBy }) {
  const [preview, setPreview] = useState({ file: null, url: null, failed: false });
  const options = useMemo(() => [...MODEL_OPTIONS].sort((a, b) =>
    Number(b.category === category) - Number(a.category === category) || a.label.localeCompare(b.label)), [category]);
  const selected = MODEL_OPTIONS.find(o => o.file === value);

  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    const cached = previewCache.get(selected.file);
    const load = cached || renderModelThumbnail(selected.path, { size: 360 }).then(b => URL.createObjectURL(b));
    previewCache.set(selected.file, load);
    load.then(url => alive && setPreview({ file: selected.file, url, failed: false }))
      .catch(() => alive && setPreview({ file: selected.file, url: null, failed: true }));
    return () => { alive = false; };
  }, [selected]);

  const shown = preview.file === selected?.file ? preview : { url: null, failed: false };
  const groups = Object.keys(CATEGORIES).map(c => ({ c, list: options.filter(o => o.category === c) })).filter(g => g.list.length);

  return (
    <div className="grid grid-cols-[1fr_112px] gap-3 items-start">
      <div>
        <select value={value} onChange={e => onChange(e.target.value)} className={input} aria-label="3D model">
          <option value="">No 3D model (shop only)</option>
          {groups.map(g => (
            <optgroup key={g.c} label={CATEGORIES[g.c]}>
              {g.list.map(o => <option key={o.file} value={o.file}>{o.label}{usedBy[o.file] ? ` (used by ${usedBy[o.file]})` : ''}</option>)}
            </optgroup>
          ))}
        </select>
        <p className="m-0 mt-1.5 text-xs text-slate-500 leading-relaxed">
          {selected ? (usedBy[selected.file]
            ? <span className="text-amber-700 font-semibold">{usedBy[selected.file]} already uses this model.</span>
            : 'Customers see this model in the 3D Studio and AI Designer.')
            : 'Without a model the item is sold in the shop but cannot be placed in 3D.'}
          {' '}New models are added by the developer (they ship with the app).
        </p>
      </div>
      <div className="w-28 h-28 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
        {!selected ? <Box size={26} className="text-slate-300" />
          : shown.url ? <img src={shown.url} alt={`${selected.label} preview`} className="w-full h-full object-cover" />
          : shown.failed ? <span className="text-xs text-slate-400 text-center px-2">No preview</span>
          : <Loader2 size={20} className="text-slate-400 animate-spin" />}
      </div>
    </div>
  );
}

/* ── Add / edit an item (never its stock: see StockDialog) ── */
function ItemForm({ item, items, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: item?.name || '', category: item?.category || 'plant', description: item?.description || '',
    unit_price: item?.unit_price || '', reorder_level: item?.reorder_level ?? 10, stock_quantity: 0,
    model_file: item?.model_file || '', thumbnail: null, real_world_size: item?.real_world_size ?? 1,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const usedBy = useMemo(() => Object.fromEntries(items.filter(i => i.id !== item?.id && i.model_file).map(i => [i.model_file, i.name])), [items, item]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const data = new FormData();
      ['name', 'category', 'description', 'unit_price', 'reorder_level', 'model_file', 'real_world_size'].forEach(k => data.append(k, form[k] ?? ''));
      if (!item) data.append('stock_quantity', form.stock_quantity || 0);   // opening stock, new items only
      if (form.thumbnail) data.append('thumbnail', form.thumbnail);
      // A model and no photo yet: photograph the model so the shop isn't left blank
      const option = MODEL_OPTIONS.find(o => o.file === form.model_file);
      if (option && !form.thumbnail && !productImage(item)) {
        try { data.append('thumbnail', await renderModelThumbnail(option.path), 'product.jpg'); } catch { /* the shop shows a placeholder */ }
      }
      if (item) await patchInventoryItem(item.id, data); else await createInventoryItem(data);
      onSaved(item ? `"${form.name}" saved.` : `"${form.name}" added.`);
    } catch (err) {
      const d = err.response?.data;
      setError(d && typeof d === 'object' ? Object.entries(d).map(([k, v]) => `${k.replace('_', ' ')}: ${[].concat(v).join(' ')}`).join(' · ') : 'Could not save the item.');
    }
    setSaving(false);
  };

  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add an item'} subtitle={item ? 'Stock is changed with the Stock button, so every change is recorded.' : null} onClose={onClose} wide>
      <form onSubmit={submit} className="p-5 flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="inv-name">Name</label>
          <input id="inv-name" className={input} value={form.name} onChange={set('name')} required maxLength={100} placeholder="e.g. Heliconia rostrata" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className={label} htmlFor="inv-cat">Category</label>
            <select id="inv-cat" className={input} value={form.category} onChange={set('category')}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="inv-price">Price (₱)</label>
            <input id="inv-price" className={input} type="number" step="0.01" min="0.01" value={form.unit_price} onChange={set('unit_price')} required />
          </div>
          <div>
            <label className={label} htmlFor="inv-reorder">Low stock at</label>
            <input id="inv-reorder" className={input} type="number" min="0" value={form.reorder_level} onChange={set('reorder_level')} required />
          </div>
          <div>
            {/* What the number measures depends on the category: data/modelSizing.js */}
            <label className={label} htmlFor="inv-size">{sizeLabel(form.category)}</label>
            <input id="inv-size" className={input} type="number" step="0.05" min="0.05" max="30" value={form.real_world_size}
              onChange={set('real_world_size')} required aria-describedby="inv-size-hint" />
            <p id="inv-size-hint" className="m-0 mt-1 text-xs text-slate-500">{sizeHint(form.category)}</p>
          </div>
          {!item && (
            <div>
              <label className={label} htmlFor="inv-stock">Opening stock</label>
              <input id="inv-stock" className={input} type="number" min="0" value={form.stock_quantity} onChange={set('stock_quantity')} />
            </div>
          )}
        </div>
        <div>
          <label className={label} htmlFor="inv-desc">Description</label>
          <textarea id="inv-desc" className={`${input} h-auto py-2.5`} rows={3} value={form.description} onChange={set('description')} />
        </div>
        <div>
          <span className={label}>3D model</span>
          <ModelPicker value={form.model_file} category={form.category} usedBy={usedBy} onChange={(v) => setForm(f => ({ ...f, model_file: v }))} />
        </div>
        <div>
          <label className={label} htmlFor="inv-photo">Photo <span className="font-normal text-slate-500">(optional: made from the 3D model if empty)</span></label>
          <input id="inv-photo" type="file" accept="image/*" onChange={e => setForm(f => ({ ...f, thumbnail: e.target.files?.[0] || null }))}
            className="block w-full text-sm text-slate-600 file:mr-3 file:h-10 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-800 file:font-semibold" />
        </div>
        {error && <p className="m-0 text-sm text-red-700 font-semibold" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="h-11 px-5 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-60">
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </button>
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
