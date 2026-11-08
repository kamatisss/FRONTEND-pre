import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, LocateFixed, Loader2, Check, Plus, AlertTriangle } from 'lucide-react';
import PinMap from './PinMap';
import { getAddressAreas, listAddresses } from '../services/api';
import { emptyAddress, fromSaved, insideTown, metres } from '../data/address';

/*
 * The one address form for checkout and bookings (backend: addresses.py — Quezon Province only, always
 * with a map pin). Saved addresses come first; a new address is town → barangay → street → landmark →
 * a pin dropped on the house. value / onChange carry:
 *   { city_code, barangay_code, street, landmark, lat, lng, source: 'pin' | 'gps',
 *     savedId?  (picked from the address book), save?, label? (remember it after the order / booking) }
 * Send toPayload(value) as `address` with the order or booking, then rememberAddress(value).
 */
const field = 'w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';
const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';

export default function AddressPicker({ value, onChange, signedIn = false, allowSave = true, mapHeight = 240 }) {
  const [areas, setAreas] = useState(null);
  const [areasError, setAreasError] = useState('');
  const [saved, setSaved] = useState(null);         // null = loading / not signed in
  const [locating, setLocating] = useState(false);
  const [gpsNote, setGpsNote] = useState('');
  const a = value || emptyAddress();
  const set = (patch) => onChange({ ...a, ...patch });

  const loadAreas = () => getAddressAreas().then((d) => { setAreasError(''); setAreas(d); }).catch(e => setAreasError(e.message));
  useEffect(() => { loadAreas(); }, []);

  // The address book; the default address is picked for the customer when the form is still empty
  useEffect(() => {
    if (!signedIn) return undefined;
    let alive = true;
    listAddresses().then(list => {
      if (!alive) return;
      setSaved(list);
      const def = list.find(x => x.is_default);
      if (def && !value?.city_code && !value?.savedId) onChange(fromSaved(def));
    }).catch(() => alive && setSaved([]));
    return () => { alive = false; };
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const towns = useMemo(() => areas?.cities || [], [areas]);
  const town = useMemo(() => towns.find(t => t.code === a.city_code), [towns, a.city_code]);
  const brgy = useMemo(() => town?.barangays.find(b => b.code === a.barangay_code), [town, a.barangay_code]);
  const hasPin = Number.isFinite(a.lat) && Number.isFinite(a.lng);
  const pinOutside = hasPin && town && !insideTown(town, a.lat, a.lng);

  // Where the map looks: the barangay if we know its centre, else the town, else the province
  const center = useMemo(() => {
    if (brgy?.lat) return { lat: brgy.lat, lng: brgy.lng, zoom: 16 };
    if (town) return { lat: town.lat, lng: town.lng, zoom: 13 };
    return { lat: 13.95, lng: 121.95, zoom: 9 };
  }, [brgy, town]);

  const pickTown = (code) => {
    const t = towns.find(x => x.code === code);
    // A pin from another town is no longer right; one inside the new town stays
    const keepPin = hasPin && t && insideTown(t, a.lat, a.lng);
    set({ city_code: code, barangay_code: '', savedId: undefined, ...(keepPin ? {} : { lat: null, lng: null }) });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGpsNote("This browser can't share your location. Tap your house on the map instead."); return; }
    setLocating(true);
    setGpsNote('');
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocating(false);
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      const patch = { lat, lng, source: 'gps', savedId: undefined };
      if (!a.city_code) {
        // Fill in the town when the spot is inside exactly one town's box, and the nearest known barangay
        const hits = towns.filter(t => insideTown(t, lat, lng) && t.bbox);
        const strict = hits.filter(t => lat >= t.bbox[0] && lat <= t.bbox[2] && lng >= t.bbox[1] && lng <= t.bbox[3]);
        const only = strict.length === 1 ? strict[0] : null;
        if (only) {
          patch.city_code = only.code;
          const near = only.barangays.filter(b => b.lat).map(b => ({ b, d: metres({ lat, lng }, b) })).sort((x, y) => x.d - y.d)[0];
          if (near && near.d < 1500) patch.barangay_code = near.b.code;
        }
      }
      const acc = Math.round(pos.coords.accuracy || 0);
      setGpsNote(towns.length && !towns.some(t => insideTown(t, lat, lng))
        ? "You seem to be outside Quezon Province. We deliver and build within Quezon; place the pin on the address you're ordering for."
        : `Pinned from your phone's location${acc ? ` (accurate to about ${acc} m)` : ''}. Drag the pin if it's not exactly on your house.`);
      set(patch);
    }, (err) => {
      setLocating(false);
      setGpsNote(err.code === err.PERMISSION_DENIED
        ? 'Location permission is off. Tap your house on the map instead.'
        : "Couldn't get your location. Tap your house on the map instead.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  if (areasError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {areasError}. <button type="button" onClick={loadAreas} className="font-bold underline bg-transparent border-none cursor-pointer text-amber-900">Try again</button>
      </div>
    );
  }

  const book = signedIn ? saved : null;   // the address book only means something when signed in
  const chosenSaved = a.savedId && book?.find(s => s.id === a.savedId);

  return (
    <div className="space-y-3">
      {/* Address book */}
      {book && book.length > 0 && (
        <div role="radiogroup" aria-label="Saved addresses" className="space-y-2">
          {book.map(s => {
            const on = a.savedId === s.id;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(fromSaved(s))}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                  {on && <Check size={12} color="#fff" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">{s.label}{s.is_default && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-700">Default</span>}</span>
                  <span className="block text-xs text-slate-500 leading-snug">{s.text}</span>
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => onChange(emptyAddress())} aria-pressed={!a.savedId}
            className={`w-full flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-sm font-bold ${!a.savedId ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-dashed border-slate-300 bg-white text-slate-600 hover:border-emerald-300'}`}>
            <Plus size={16} /> Use a new address
          </button>
        </div>
      )}

      {chosenSaved ? (
        <PinMap center={{ lat: chosenSaved.lat, lng: chosenSaved.lng, zoom: 16 }} value={{ lat: chosenSaved.lat, lng: chosenSaved.lng }}
          readOnly height={160} ariaLabel={`Map of ${chosenSaved.label}`} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor="addr-town">Town / City</label>
              <select id="addr-town" className={field} value={a.city_code} onChange={e => pickTown(e.target.value)} disabled={!areas} required>
                <option value="">{areas ? 'Choose your town…' : 'Loading towns…'}</option>
                {towns.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} htmlFor="addr-brgy">Barangay</label>
              <select id="addr-brgy" className={field} value={a.barangay_code} disabled={!town} required
                onChange={e => set({ barangay_code: e.target.value, savedId: undefined })}>
                <option value="">{town ? 'Choose your barangay…' : 'Choose a town first'}</option>
                {town?.barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <p className="m-0 text-[11px] text-slate-400">We deliver and build within Quezon Province.</p>
          <div>
            <label className={lbl} htmlFor="addr-street">House no., street, purok / sitio</label>
            <input id="addr-street" className={field} value={a.street} maxLength={200} required autoComplete="address-line1"
              placeholder="e.g. 12 Rizal St., Purok 3" onChange={e => set({ street: e.target.value, savedId: undefined })} />
          </div>
          <div>
            <label className={lbl} htmlFor="addr-landmark">Landmark <span className="normal-case font-medium text-slate-400">(helps our crew find you)</span></label>
            <input id="addr-landmark" className={field} value={a.landmark} maxLength={200}
              placeholder="e.g. green gate beside the chapel" onChange={e => set({ landmark: e.target.value, savedId: undefined })} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <span className={lbl + ' mb-0'}><MapPin size={11} className="inline -mt-0.5" /> Pin your exact location</span>
              <button type="button" onClick={useMyLocation} disabled={locating || !areas}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer disabled:opacity-60">
                {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} Use my location
              </button>
            </div>
            <div className="relative">
              <PinMap center={center} value={hasPin ? { lat: a.lat, lng: a.lng } : null} height={mapHeight}
                onChange={(p) => set({ ...p, source: a.source === 'gps' && hasPin ? 'gps' : 'pin', savedId: undefined })}
                ariaLabel="Map: tap your house to pin it" />
              {!hasPin && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-3 z-[500] px-3 py-1.5 rounded-full bg-slate-900/85 text-white text-xs font-bold whitespace-nowrap">
                  {town ? 'Tap your house on the map' : 'Choose your town, then tap your house'}
                </div>
              )}
            </div>
            {gpsNote && <p className="m-0 mt-1.5 text-xs text-slate-500" role="status">{gpsNote}</p>}
            {pinOutside && (
              <p className="m-0 mt-1.5 text-xs font-semibold text-amber-700 flex items-start gap-1" role="alert">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" /> The pin is outside {town.name}. Move it onto your house, or check the town.
              </p>
            )}
          </div>

          {signedIn && allowSave && (
            <label className="flex items-center gap-2 text-sm text-slate-600 flex-wrap cursor-pointer">
              <input type="checkbox" checked={!!a.save} onChange={e => set({ save: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
              Save to my address book as
              <input value={a.label ?? 'Home'} maxLength={40} onChange={e => set({ label: e.target.value })} disabled={!a.save}
                className="w-28 min-h-[32px] px-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-50" aria-label="Address label" />
            </label>
          )}
        </>
      )}
    </div>
  );
}
