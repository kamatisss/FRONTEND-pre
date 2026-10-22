// Fallback business details, shown only until the real ones load (or if they can't).
// The real details are edited by the owner in Business profile (/admin-settings) and served by
// GET /api/business/ — see services/business.js. Empty fields are never shown on the site.
export const BUSINESS = {
  name: 'Garden Studio',
  tagline: 'Design your garden in 3D, then let our own crew build it.',
  foundedYear: null,          // e.g. 2019 — shown as "since 2019" only when set
  phone: '',                  // e.g. '+63 912 345 6789'
  email: '',                  // e.g. 'hello@yourdomain.ph'
  address: '',                // e.g. 'Brgy. ..., Pagbilao, Quezon'
  serviceArea: 'Quezon Province and nearby areas',
  social: {
    facebook: '',             // full https:// links
    instagram: '',
    tiktok: '',
  },
};
