import React, { useEffect, useState } from 'react';
import { Plus, FileText, Trash2, Pencil, X, AlertTriangle, EyeOff, ExternalLink } from 'lucide-react';
import { listCredentials, saveCredential, deleteCredential } from '../services/api';

/*
 * Office admin: the business's permits, registrations and awards shown on the
 * public Track Record page. Only real documents the business holds — the
 * suggestions below are common Philippine ones, not claims.
 */

const KINDS = [
  ['registration', 'Business registration'],
  ['permit', 'Permit / license'],
  ['certification', 'Certification'],
  ['award', 'Award'],
  ['partnership', 'Partnership / membership'],
];
const SUGGESTIONS = [
  ['registration', 'DTI Business Name Registration', 'Department of Trade and Industry'],
  ['registration', 'SEC Certificate of Registration', 'Securities and Exchange Commission'],
  ['registration', 'BIR Certificate of Registration (Form 2303)', 'Bureau of Internal Revenue'],
  ['permit', "Mayor's / Business Permit", ''],
  ['registration', 'PhilGEPS Registration', 'Philippine Government Electronic Procurement System'],
];
const EMPTY = {
  kind: 'permit', title: '', issuer: '', reference_no: '', show_reference_no: false,
  issued_on: '', expires_on: '', show_document: false, is_public: true, sort_order: 0,
};

const LABEL = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
const INPUT = 'w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400';

export default function CredentialsManager({ flash }) {
  const [items,   setItems]   = useState(null);
  const [editing, setEditing] = useState(null); // null | { ...form, id? }

  useEffect(() => {
    listCredentials().then(setItems).catch(e => { setItems([]); flash(e.message, 'error'); });
  }, []);

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.title}"? Its uploaded file is deleted too.`)) return;
    try {
      await deleteCredential(c.id);
      setItems(prev => prev.filter(x => x.id !== c.id));
      flash('Deleted.');
    } catch (e) { flash(e.message, 'error'); }
  };

  const onSaved = (saved) => {
    setItems(prev => (prev.some(x => x.id === saved.id) ? prev.map(x => (x.id === saved.id ? saved : x)) : [...prev, saved]));
    setEditing(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500 m-0 max-w-2xl">
          Documents shown on the public <a href="/track-record" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-semibold">Track Record</a> page.
          Expired documents disappear from the public page automatically. Add only documents the business actually holds.
        </p>
        <button onClick={() => setEditing({ ...EMPTY })}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl border-none cursor-pointer">
          <Plus size={15} /> Add document
        </button>
      </div>

      {items === null ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <FileText size={32} className="text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-slate-700 font-semibold m-0 mb-3">No documents yet</p>
          <p className="text-xs text-slate-400 m-0 mb-2">Common ones for a Philippine landscaping business:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map(([kind, title, issuer]) => (
              <button key={title} onClick={() => setEditing({ ...EMPTY, kind, title, issuer })}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-full cursor-pointer hover:border-emerald-300">
                + {title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(c => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{c.kind_display}</span>
                  {c.is_expired && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2"><AlertTriangle size={10} /> Expired, hidden</span>}
                  {c.expires_soon && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2"><AlertTriangle size={10} /> Renew soon</span>}
                  {!c.is_public && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2"><EyeOff size={10} /> Internal</span>}
                </div>
                <p className="font-bold text-slate-800 m-0">{c.title}</p>
                <p className="text-xs text-slate-500 m-0">{[c.issuer, c.reference_no && `No. ${c.reference_no}${c.show_reference_no ? '' : ' (hidden)'}`].filter(Boolean).join(' · ') || '—'}</p>
                <p className="text-xs text-slate-400 m-0">{[c.issued_on && `Issued ${c.issued_on}`, c.expires_on && `Expires ${c.expires_on}`].filter(Boolean).join(' · ') || 'No dates'}</p>
                {c.document_url && (
                  <a href={c.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 mt-1">
                    <ExternalLink size={11} /> Document{c.show_document ? ' (public)' : ' (private)'}
                  </a>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing({ ...c, issued_on: c.issued_on || '', expires_on: c.expires_on || '' })} title="Edit"
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg bg-transparent border-none cursor-pointer"><Pencil size={14} /></button>
                <button onClick={() => remove(c)} title="Delete"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg bg-transparent border-none cursor-pointer"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <CredentialForm initial={editing} onClose={() => setEditing(null)} onSaved={onSaved} flash={flash} />}
    </div>
  );
}

function CredentialForm({ initial, onClose, onSaved, flash }) {
  const [form,       setForm]       = useState(initial);
  const [file,       setFile]       = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [busy,       setBusy]       = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        kind: form.kind, title: form.title.trim(), issuer: form.issuer.trim(), reference_no: form.reference_no.trim(),
        show_reference_no: form.show_reference_no, issued_on: form.issued_on || null, expires_on: form.expires_on || null,
        show_document: form.show_document, is_public: form.is_public, sort_order: Number(form.sort_order) || 0,
      };
      if (removeFile) body.document = null;
      // Fields go as JSON (so dates can be cleared); a new file follows as its own multipart PATCH
      let saved = await saveCredential(form.id, body);
      if (file) {
        const data = new FormData();
        data.append('document', file);
        saved = await saveCredential(saved.id, data);
      }
      flash('Saved.');
      onSaved(saved);
    } catch (err) {
      flash(err.message, 'error');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(15,23,42,0.6)' }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-900 text-base m-0">{form.id ? 'Edit document' : 'Add document'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg bg-transparent border-none cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={LABEL}>Type</label>
            <select className={INPUT} value={form.kind} onChange={e => set('kind', e.target.value)}>
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Title</label>
            <input className={INPUT} required maxLength={150} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Issued by</label>
            <input className={INPUT} maxLength={150} value={form.issuer} onChange={e => set('issuer', e.target.value)} placeholder="e.g. City of Lucena" />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Reference / permit no.</label>
            <input className={INPUT} maxLength={80} value={form.reference_no} onChange={e => set('reference_no', e.target.value)} />
            <label className="flex items-center gap-2 text-xs text-slate-600 mt-1.5 cursor-pointer">
              <input type="checkbox" checked={form.show_reference_no} onChange={e => set('show_reference_no', e.target.checked)} /> Show the number publicly
            </label>
          </div>
          <div>
            <label className={LABEL}>Issued on</label>
            <input type="date" className={INPUT} value={form.issued_on} onChange={e => set('issued_on', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Expires on</label>
            <input type="date" className={INPUT} value={form.expires_on} onChange={e => set('expires_on', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Document (PDF or image, max 10 MB)</label>
            {initial.document_url && !removeFile && !file && (
              <p className="text-xs text-slate-500 m-0 mb-1.5">
                Current: <a href={initial.document_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700">view</a>
                {' · '}<button type="button" onClick={() => setRemoveFile(true)} className="text-red-600 bg-transparent border-none p-0 cursor-pointer text-xs">remove</button>
              </p>
            )}
            <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] || null); setRemoveFile(false); }} className="text-xs w-full" />
            <label className="flex items-center gap-2 text-xs text-slate-600 mt-1.5 cursor-pointer">
              <input type="checkbox" checked={form.show_document} onChange={e => set('show_document', e.target.checked)} /> Let visitors view the document
            </label>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.is_public} onChange={e => set('is_public', e.target.checked)} /> Show on the Track Record page
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer">Cancel</button>
          <button type="submit" disabled={busy || !form.title.trim()} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border-none cursor-pointer disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
