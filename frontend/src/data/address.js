// Customer addresses — Quezon Province only, always with a map pin (backend: apps/library/addresses.py).
// The AddressPicker value:
//   { city_code, barangay_code, street, landmark, lat, lng, source: 'pin' | 'gps',
//     savedId?  (picked from the address book), save?, label? (remember it after the order / booking) }
// Send toPayload(value) as `address` with the order or booking, then rememberAddress(value).
import { createAddress } from '../services/api';

export const PIN_MARGIN = 0.03;   // same margin as the server (degrees around a town's box)

export const emptyAddress = () => ({ city_code: '', barangay_code: '', street: '', landmark: '', lat: null, lng: null, source: 'pin' });

export const addressReady = (a) => !!(a && a.city_code && a.barangay_code && (a.street || '').trim().length >= 3
  && Number.isFinite(a.lat) && Number.isFinite(a.lng));

export const toPayload = (a) => ({
  city_code: a.city_code, barangay_code: a.barangay_code, street: (a.street || '').trim(),
  landmark: (a.landmark || '').trim(), lat: a.lat, lng: a.lng, source: a.source || 'pin',
});

export const fromSaved = (s) => ({ city_code: s.city_code, barangay_code: s.barangay_code, street: s.street,
  landmark: s.landmark, lat: s.lat, lng: s.lng, source: 'pin', savedId: s.id });

/** After a successful order / booking: add a new address to the book when the customer asked to. */
export async function rememberAddress(a) {
  if (!a?.save || a.savedId) return;
  try { await createAddress({ ...toPayload(a), label: (a.label || 'Home').trim() || 'Home' }); } catch { /* the order went through; saving is a convenience */ }
}

/** The first readable message from an API error body ({address: '…'}, {field: ['…']}, {error: '…'}). */
export function firstError(data) {
  if (!data || typeof data !== 'object') return 'Something went wrong. Please try again.';
  const value = data.error || data.address || data.detail || Object.values(data)[0];
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' ? text : 'Please check the form and try again.';
}

export const insideTown = (town, lat, lng) => {
  if (!town?.bbox || !Number.isFinite(lat)) return true;
  const [s, w, n, e] = town.bbox;
  return lat >= s - PIN_MARGIN && lat <= n + PIN_MARGIN && lng >= w - PIN_MARGIN && lng <= e + PIN_MARGIN;
};

/** Great-circle distance in metres between two { lat, lng }. */
export const metres = (a, b) => {
  const R = 6371000, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
