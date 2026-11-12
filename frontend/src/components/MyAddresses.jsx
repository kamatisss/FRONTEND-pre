import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Star, Pencil, Trash2, Loader2, X } from 'lucide-react';
import AddressPicker from './AddressPicker';
import { addressReady, emptyAddress, toPayload } from '../data/address';
import PinMap from './PinMap';
import { listAddresses, createAddress, updateAddress, deleteAddress, makeDefaultAddress } from '../services/api';
import { normalizePhMobile } from '../services/checkout';

import { useMe } from '../services/me';
/* The customer's address book (Quezon Province only, every address pinned). Checkout and bookings
   offer these first; the default one is picked automatically. */
const MAX = 10;

export default function MyAddresses({ embedded = false }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);   // null | { id?, label, contact_name, contact_phone, address }
  const [busy, setBusy] = useState(false);

  const load = () => listAddresses().then(setList).catch(() => setError('Could not load your addresses.'));
  useEffect(() => { load(); }, []);

  // A new address starts with the account's own name and mobile as the receiver (change it for someone else)
  const me = useMe();
  const startNew = () => setEditing({ label: list?.length ? 'Other' : 'Home',
    contact_name: me ? `${me.first_name} ${me.last_name}`.trim() : '', contact_phone: me?.phone || '', address: emptyAddress() });
  const startEdit = (a) => setEditing({
    id: a.id, label: a.label, contact_name: a.contact_name, contact_phone: a.contact_phone,
    address: { city_code: a.city_code, barangay_code: a.barangay_code, street: a.street, landmark: a.landmark, lat: a.lat, lng: a.lng, source: 'pin' },
  });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!addressReady(editing.address)) { setError('Choose the town and barangay, enter the street, and pin the house on the map.'); return; }
    if (editing.contact_phone && !normalizePhMobile(editing.contact_phone)) { setError('Enter a valid PH mobile number, e.g. 09171234567.'); return; }
    setBusy(true);
    const body = { ...toPayload(editing.address), label: editing.label.trim() || 'Home',
      contact_name: editing.contact_name.trim(), contact_phone: editing.contact_phone.trim() };
    try {
      if (editing.id) await updateAddress(editing.id, body); else await createAddress(body);
      setEditing(null);
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Remove "${a.label}" from your address book? Past orders and bookings keep their address.`)) return;
    await deleteAddress(a.id).catch(() => setError('Could not remove it. Try again.'));
    load();
  };
  const makeDefault = async (a) => { await makeDefaultAddress(a.id).catch(() => {}); load(); };

  return (
    <div className={embedded ? '' : 'max-w-3xl mx-auto px-4 py-6 sm:py-8'}>
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          {/* Inside My account the tab already names it */}
          {embedded ? <h2 className="m-0 text-lg font-extrabold text-slate-900">Addresses</h2>
            : <h1 className="m-0 text-2xl font-extrabold text-slate-900">My Addresses</h1>}
          <p className="m-0 mt-1 text-sm text-slate-500">Saved addresses for deliveries and garden services in Quezon Province. Checkout picks your default.</p>
        </div>
        {!editing && list && list.length < MAX && (
          <button type="button" onClick={startNew}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold border-none cursor-pointer">
            <Plus size={16} /> Add an address
          </button>
        )}
      </div>

      {error && <p role="alert" className="m-0 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</p>}

      {editing && (
        <form onSubmit={save} className="mb-6 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold text-slate-800">{editing.id ? 'Edit address' : 'New address'}</h2>
            <button type="button" onClick={() => { setEditing(null); setError(''); }} aria-label="Cancel"
              className="p-2 rounded-lg bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-700"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[['label', 'Label', 'Home, Work…', 40], ['contact_name', 'Receiver (optional)', 'Who receives it', 150],
              ['contact_phone', 'Receiver mobile (optional)', '09171234567', 20]].map(([key, text, ph, max]) => (
              <div key={key}>
                <label htmlFor={`a-${key}`} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">{text}</label>
                <input id={`a-${key}`} value={editing[key]} maxLength={max} placeholder={ph} inputMode={key === 'contact_phone' ? 'tel' : undefined}
                  onChange={e => setEditing(v => ({ ...v, [key]: e.target.value }))}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
              </div>
            ))}
          </div>
          <AddressPicker value={editing.address} onChange={(address) => setEditing(v => ({ ...v, address }))} allowSave={false} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setEditing(null); setError(''); }}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 cursor-pointer">Cancel</button>
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-60">
              {busy && <Loader2 size={16} className="animate-spin" />} Save address
            </button>
          </div>
        </form>
      )}

      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list && list.length === 0 && !editing && (
        <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center">
          <MapPin className="mx-auto text-emerald-600" size={28} />
          <p className="m-0 mt-2 font-bold text-slate-700">No saved addresses yet</p>
          <p className="m-0 mt-1 text-sm text-slate-500">Add your home once and checkout fills it in for you.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {list?.map(a => (
          <div key={a.id} className={`rounded-2xl border bg-white overflow-hidden ${a.is_default ? 'border-emerald-400' : 'border-slate-200'}`}>
            <PinMap center={{ lat: a.lat, lng: a.lng, zoom: 16 }} value={{ lat: a.lat, lng: a.lng }} readOnly height={130} ariaLabel={`Map of ${a.label}`} />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{a.label}</span>
                {a.is_default && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Default</span>}
              </div>
              <p className="m-0 mt-1 text-sm text-slate-600 leading-snug">{a.text}</p>
              {(a.contact_name || a.contact_phone) && (
                <p className="m-0 mt-1 text-xs text-slate-400">{[a.contact_name, a.contact_phone].filter(Boolean).join(' · ')}</p>
              )}
              <div className="flex gap-1 mt-3 flex-wrap">
                {!a.is_default && (
                  <button type="button" onClick={() => makeDefault(a)} className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 cursor-pointer"><Star size={13} /> Make default</button>
                )}
                <button type="button" onClick={() => startEdit(a)} className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 cursor-pointer"><Pencil size={13} /> Edit</button>
                <button type="button" onClick={() => remove(a)} className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg border border-red-100 bg-white text-xs font-bold text-red-600 cursor-pointer"><Trash2 size={13} /> Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
