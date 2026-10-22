import { useEffect, useState } from 'react';
import api from './api';
import { BUSINESS } from '../data/business';

/*
 * The business's public details (name, contact, socials), edited by the owner in
 * Business profile (GET/PATCH /api/business/). Loaded once per visit and shared by every page;
 * until it arrives (or if it can't load) the defaults in data/business.js are shown.
 */

const fromApi = (d) => ({
  name: d.name || BUSINESS.name,
  tagline: d.tagline || '',
  foundedYear: d.founded_year || null,
  phone: d.phone || '',
  email: d.email || '',
  address: d.address || '',
  serviceArea: d.service_area || '',
  social: { facebook: '', instagram: '', tiktok: '', ...(d.social || {}) },
});

let current = null;
let pending = null;
const listeners = new Set();

export function loadBusiness() {
  if (!pending) {
    pending = api.get('/business/')
      .then(r => { current = fromApi(r.data); return current; })
      .catch(() => { pending = null; return BUSINESS; });  // try again on the next page
  }
  return pending;
}

/** After the owner saves: every mounted header/footer shows the new details at once. */
export function setBusiness(data) {
  current = fromApi(data);
  pending = Promise.resolve(current);
  listeners.forEach(fn => fn(current));
}

export function useBusiness() {
  const [business, setState] = useState(current || BUSINESS);
  useEffect(() => {
    listeners.add(setState);
    if (!current) loadBusiness().then(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return business;
}
