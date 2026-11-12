import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, LocateFixed, Loader2, Check, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import PinMap from './PinMap';
import { getAddressAreas, listAddresses, locateAddress } from '../services/api';
import { emptyAddress, fromSaved, insideTown } from '../data/address';

/*
 * The one address form for checkout and bookings (backend: addresses.py — Quezon Province only, always
 * with a map pin). Saved addresses come first; a new address is town → barangay → street → landmark →
 * a pin dropped on the house. value / onChange carry:
 *   { city_code, barangay_code, street, landmark, lat, lng, source: 'pin' | 'gps',
 *     savedId?  (picked from the address book), save?, label? (remember it after the order / booking) }
 * Send toPayload(value) as `address` with the order or booking, then rememberAddress(value).
 *
 * The pin tells us the town and barangay (backend geo_lookup.py, official boundaries, looked up on our
 * server): "Use my location" fills them in (the person asked); tapping or dragging the pin fills them when
 * they're empty, and otherwise only suggests ("This pin is in Brgy. X. Use these?"), never overwriting a choice.
 */
const ROUGH_GPS_M = 150;   // phone location worse than this: ask the person to check the pin and barangay
const pinKey = (lat, lng) => `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
const placeName = (r) => `${/^barangay\b/i.test(r.barangay_name) ? '' : 'Brgy. '}${r.barangay_name}, ${r.city_name}`;
const field = 'w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';
const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';

export default function AddressPicker({ value, onChange, signedIn = false, allowSave = true, mapHeight = 240 }) {
  const [areas, setAreas] = useState(null);
  const [areasError, setAreasError] = useState('');
  const [saved, setSaved] = useState(null);         // null = loading / not signed in
  const [locating, setLocating] = useState(false);
  const [gpsNote, setGpsNote] = useState('');
  const a = value || emptyAddress();
  const set = (patch) => send({ ...a, ...patch });   // send(): defined below, called only from events
  // Lookups answer after the person may have typed more: apply them to the latest value, not this render's
  const latest = useRef(a);
  useEffect(() => { latest.current = a; });
  // Record what we sent at once: a cached lookup can answer before the parent re-renders with it
  const send = (next) => { latest.current = next; onChange(next); };
  const patchLatest = (patch) => send({ ...latest.current, ...patch });
  const [found, setFound] = useState(null);         // { key, status: 'ok' | 'error', result } for one pin
  const [dismissed, setDismissed] = useState('');   // the pin whose suggestion the person turned down
  const seq = useRef(0);
  // → the place, null (outside Quezon), or undefined (couldn't ask: offline…)
  const lookup = async (lat, lng) => {
    const n = ++seq.current;
    const key = pinKey(lat, lng);
    try {
      const r = await locateAddress(lat, lng);
      const result = r?.match ? r : null;
      if (n === seq.current) setFound({ key, status: 'ok', result });
      return n === seq.current ? result : undefined;
    } catch {
      if (n === seq.current) setFound({ key, status: 'error', result: null });
      return undefined;
    }
  };

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

  // fresh: called from a saved address ("Not at this address?"): the new address starts clean (no street,
  // landmark or label from the saved one), and only once the phone has answered, so a refused or failed
  // location leaves the saved address picked
  const locateMe = (fresh = false) => {
    if (!navigator.geolocation) { setGpsNote("This browser can't share your location. Tap your house on the map instead."); return; }
    setLocating(true);
    setGpsNote('');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setLocating(false);
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      const acc = Math.round(pos.coords.accuracy || 0);
      const rough = acc > ROUGH_GPS_M
        ? ` Your phone's location is rough (about ${acc} m): check that the pin is on your house and the barangay is right.` : '';
      setDismissed('');
      const pin = { lat, lng, source: 'gps', savedId: undefined };
      if (fresh) send({ ...emptyAddress(), ...pin }); else patchLatest(pin);
      setGpsNote('Pinned. Finding your town and barangay…');
      const next = fresh ? ' Now add your street and a landmark.' : '';
      const place = await lookup(lat, lng);
      if (place) {
        // The person asked for their location: fill both in, even over an earlier choice, and say so
        patchLatest({ lat, lng, source: 'gps', savedId: undefined, city_code: place.city_code, barangay_code: place.barangay_code });
        setGpsNote(`Filled in from your location: ${placeName(place)}. Change them if this isn't right.${next}${rough || ' Drag the pin if it isn\'t exactly on your house.'}`);
      } else if (place === null) {
        setGpsNote("You seem to be outside Quezon Province. We deliver and build within Quezon; place the pin on the address you're ordering for.");
      } else {
        setGpsNote(`Pinned from your phone's location${acc ? ` (accurate to about ${acc} m)` : ''}. Choose your town and barangay above.${next}${rough}`);
      }
    }, (err) => {
      setLocating(false);
      setGpsNote(err.code === err.PERMISSION_DENIED
        ? 'Location permission is off. Tap your house on the map instead.'
        : "Couldn't get your location. Tap your house on the map instead.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  const movePin = async (p) => {
    patchLatest({ ...p, source: a.source === 'gps' && hasPin ? 'gps' : 'pin', savedId: undefined });
    setGpsNote('');
    setDismissed('');
    const place = await lookup(p.lat, p.lng);
    if (!place) return;
    const cur = latest.current;
    if (!cur.city_code || (cur.city_code === place.city_code && !cur.barangay_code)) {
      patchLatest({ city_code: place.city_code, barangay_code: place.barangay_code });
      setGpsNote(`Town and barangay filled in from the pin: ${placeName(place)}.`);
    }
  };

  // What the boundaries say about the pin as it is now (only the answer for this exact pin counts)
  const here = hasPin && found?.key === pinKey(a.lat, a.lng) ? found : null;
  const place = here?.status === 'ok' ? here.result : undefined;          // undefined: not asked / failed
  const outsideQuezon = here?.status === 'ok' && here.result === null;
  const disagrees = place && a.city_code && (place.city_code !== a.city_code || place.barangay_code !== a.barangay_code);
  const suggest = disagrees && dismissed !== pinKey(a.lat, a.lng);
  const agrees = place && place.city_code === a.city_code && place.barangay_code === a.barangay_code;

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
        <div>
          <PinMap center={{ lat: chosenSaved.lat, lng: chosenSaved.lng, zoom: 16 }} value={{ lat: chosenSaved.lat, lng: chosenSaved.lng }}
            readOnly height={160} ariaLabel={`Map of ${chosenSaved.label}`} />
          {/* Ordering for where you are right now, not this saved place: start a new address from the phone's location */}
          <button type="button" onClick={() => locateMe(true)} disabled={locating || !areas}
            className="mt-2 inline-flex items-center gap-1.5 min-h-[36px] px-1 bg-transparent border-none text-xs font-bold text-emerald-700 cursor-pointer disabled:opacity-60 hover:underline">
            {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            {locating ? 'Finding where you are…' : `Not at ${chosenSaved.label}? Use my location instead`}
          </button>
          {gpsNote && <p className="m-0 mt-1 text-xs text-slate-500" role="status">{gpsNote}</p>}
        </div>
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
              <button type="button" onClick={() => locateMe()} disabled={locating || !areas}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer disabled:opacity-60">
                {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} Use my location
              </button>
            </div>
            <div className="relative">
              <PinMap center={center} value={hasPin ? { lat: a.lat, lng: a.lng } : null} height={mapHeight}
                onChange={movePin}
                ariaLabel="Map: tap your house to pin it" />
              {!hasPin && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-3 z-[500] px-3 py-1.5 rounded-full bg-slate-900/85 text-white text-xs font-bold whitespace-nowrap">
                  {town ? 'Tap your house on the map' : 'Choose your town, then tap your house'}
                </div>
              )}
            </div>
            {gpsNote && <p className="m-0 mt-1.5 text-xs text-slate-500" role="status">{gpsNote}</p>}
            {suggest && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                <p className="m-0">This pin is in <b>{placeName(place)}</b>{place.match === 'near' ? ' (just at its edge)' : ''}, not the {place.city_code !== a.city_code ? 'town' : 'barangay'} you chose.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { set({ city_code: place.city_code, barangay_code: place.barangay_code, savedId: undefined }); setGpsNote(''); }}
                    className="min-h-[36px] px-3 rounded-lg border-none bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer">
                    Use {/^barangay\b/i.test(place.barangay_name) ? place.barangay_name : `Brgy. ${place.barangay_name}`}
                  </button>
                  <button type="button" onClick={() => setDismissed(pinKey(a.lat, a.lng))}
                    className="min-h-[36px] px-3 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-bold cursor-pointer">
                    Keep my choice
                  </button>
                </div>
              </div>
            )}
            {agrees && !gpsNote && (
              <p className="m-0 mt-1.5 text-xs text-emerald-700 flex items-center gap-1" role="status">
                <CheckCircle2 size={13} className="shrink-0" /> The pin is in {placeName(place)}.
              </p>
            )}
            {outsideQuezon && !gpsNote && (
              <p className="m-0 mt-1.5 text-xs font-semibold text-amber-700 flex items-start gap-1" role="alert">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" /> This pin is outside Quezon Province. We deliver and build within Quezon: move it onto the address.
              </p>
            )}
            {pinOutside && !here && (
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
