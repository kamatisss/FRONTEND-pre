// ─── Where the backend lives ──────────────────────────────────────────────────
// Set on Vercel (Project → Settings → Environment Variables), then redeploy:
//   VITE_API_BASE_URL    https://<you>.pythonanywhere.com/api              (required in production)
//   VITE_MEDIA_BASE_URL  https://<you>.pythonanywhere.com                  (optional: defaults to the API's site)
// While developing, nothing needs setting: the local Django server on :8000 is used.
// vite.config.js stops a Vercel build that is missing VITE_API_BASE_URL.

const trimSlash = (url) => url.replace(/\/+$/, '');

export const API_BASE_URL = trimSlash(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api');
export const MEDIA_BASE_URL = trimSlash(import.meta.env.VITE_MEDIA_BASE_URL || API_BASE_URL.replace(/\/api$/, ''));
