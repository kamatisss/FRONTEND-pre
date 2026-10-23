import axios from 'axios';
import { compressImage } from './imageCompress';
import { API_BASE_URL as API_ROOT } from '../config';

const API_BASE_URL = API_ROOT;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Accept': 'application/json' },
});

// ─── Interceptors ────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => { 
    if (import.meta.env.DEV) console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    const authTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;
    if (authTokens && authTokens.access) {
      config.headers.Authorization = `Bearer ${authTokens.access}`;
    }
    return config; 
  },
  (error) => { console.error('❌ Request error:', error); return Promise.reject(error); }
);

api.interceptors.response.use(
  (response) => { if (import.meta.env.DEV) console.log(`✅ ${response.status} ${response.config.url}`); return response; },
  (error) => {
    if (!import.meta.env.DEV) { /* production: screens show the error; no API details in the console */ }
    else if (error.response) console.error(`❌ ${error.response.status}:`, error.response.data);
    else if (error.request) console.error('❌ No response — is Django running?');
    else console.error('❌', error.message);
    return Promise.reject(error);
  }
);

// ─── Depth Map ───────────────────────────────────────────────────
export const generateDepthMap = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  try {
    const res = await api.post('/generate-depth/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 minutes timeout for model download/inference
      onUploadProgress: (p) => { if (import.meta.env.DEV) console.log(`⏳ Upload: ${Math.round((p.loaded * 100) / p.total)}%`); },
    });
    const data = res.data;
    const required = ['depth_map_url', 'normal_map_url', 'rock_mask_url', 'grass_mask_url'];
    const missing = required.filter(k => !data[k]);
    if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
    return data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Depth generation failed');
  }
};

// ─── Inventory ────────────────────────────────────────────────────
// archived: true lists archived items too (office only; the Inventory page)
export const getInventoryItems = async (category = null, { archived = false } = {}) => {
  const params = { ...(category ? { category } : {}), ...(archived ? { archived: 1 } : {}) };
  const res = await api.get('/inventory/', { params });
  return res.data;
};

export const getInventoryItem = async (id) => {
  const res = await api.get(`/inventory/${id}/`);
  return res.data;
};

export const createInventoryItem = async (data) => {
  const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
  const res = await api.post('/inventory/', data, { headers });
  return res.data;
};

export const updateInventoryItem = async (id, data) => {
  const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
  const res = await api.put(`/inventory/${id}/`, data, { headers });
  return res.data;
};

export const patchInventoryItem = async (id, data) => {
  const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
  const res = await api.patch(`/inventory/${id}/`, data, { headers });
  return res.data;
};

// "Delete" archives: the item leaves the shop and Studio but order history and designs keep it
export const deleteInventoryItem = async (id) => {
  const res = await api.delete(`/inventory/${id}/`);
  return res.data;
};

export const restoreInventoryItem = async (id) => {
  const res = await api.post(`/inventory/${id}/restore/`);
  return res.data;
};

// reason: 'restock' (+quantity) | 'damaged' (−quantity) | 'count' (quantity is what's on hand)
export const adjustStock = async (id, { reason, quantity, note }) => {
  try {
    const res = await api.post(`/inventory/${id}/adjust_stock/`, { reason, quantity, note });
    return res.data;   // { movement, item }
  } catch (err) { throw errorOf(err, 'Could not update stock'); }
};

export const getStockHistory = async (id) => {
  try {
    const res = await api.get(`/inventory/${id}/stock_history/`);
    return res.data;
  } catch (err) { throw errorOf(err, 'Could not load the stock history'); }
};

// ─── Designs CRUD ────────────────────────────────────────────────
export const listDesigns = async () => {
  const res = await api.get('/designs/');
  return res.data;
};

export const loadDesign = async (id) => {
  const res = await api.get(`/designs/${id}/`);
  return res.data;
};

export const saveDesign = async (designData) => {
  if (designData.id) {
    const res = await api.put(`/designs/${designData.id}/`, designData);
    return res.data;
  }
  const res = await api.post('/designs/', designData);
  return res.data;
};

export const deleteDesign = async (id) => {
  await api.delete(`/designs/${id}/`);
};

export const duplicateDesign = async (id) => {
  const res = await api.post(`/designs/${id}/duplicate/`);
  return res.data;
};

export const submitDesign = async (id) => {
  const res = await api.patch(`/designs/${id}/submit/`);
  return res.data;
};

// ─── Placed Item Transform (PATCH) ──────────────────────────────
// PATCH /api/designs/:designId/items/:itemId/
// Persists position, rotation, or scale changes for a single placed item.
export const patchItemTransform = async (designId, itemId, transformData) => {
  if (!designId) {
    console.warn('patchItemTransform: no designId — changes are local only until design is saved.');
    return { status: 'local_only' };
  }
  try {
    const res = await api.patch(`/designs/${designId}/items/${itemId}/`, transformData);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn('Item not found in design — may have been removed.');
      return { status: 'not_found' };
    }
    throw new Error(
      err.response?.data?.error || err.message || 'Failed to save transform'
    );
  }
};

// Legacy alias kept for backwards compatibility
export const patchItemRotation = (productId, itemId, rotationData) => {
  console.warn('patchItemRotation is deprecated. Use patchItemTransform(designId, itemId, data) instead.');
  return Promise.resolve({ status: 'local_only' });
};
// ─── Checkout & Inventory Sync ────────────────────────────────────
export const submitOrder = async (orderData) => {
  try {
    const res = await api.post('/checkout/', orderData);
    return res.data;
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      throw new Error(err.response.data.error);
    }
    throw new Error(err.message || 'Checkout failed');
  }
};

// ─── Online Payment (PayMongo: QR Ph / GCash / Maya / Card) ──────────
export const createCheckoutSession = async (orderId) => {
  try {
    const res = await api.post('/create-checkout-session/', { order_id: orderId });
    return res.data; // { checkout_url: '...' }
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      throw new Error(err.response.data.error);
    }
    throw new Error(err.message || 'Failed to create checkout session');
  }
};

// Project payment links (/pay/<token>): staff-requested downpayments and other installments
export const getProjectPayment = async (token) => {
  try {
    const res = await api.get(`/project-payments/${token}/`);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Could not load this payment.');
  }
};

export const startProjectPayment = async (token) => {
  try {
    const res = await api.post(`/project-payments/${token}/checkout/`);
    return res.data; // { checkout_url }
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Could not open the payment page.');
  }
};

// Real order + payment state for the order-success page (token lets guests in)
export const getOrderReceipt = async (orderId, token) => {
  try {
    const res = await api.get(`/order-receipt/${orderId}/`, { params: token ? { token } : {} });
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Could not load the order.');
  }
};

// ─── Forgot / Reset Password ──────────────────────────────────────

/**
 * Password reset by emailed link (components/ForgotPassword.jsx).
 * POST /api/password-reset/          { email }                    → { message } (same answer for every email)
 * POST /api/password-reset/confirm/  { uid, token, new_password } → { message, username }
 */
const resetError = (err, fallback) => new Error(
  err.response?.status === 429 ? 'Too many tries. Please wait a while and try again.'
    : err.response?.data?.error || (err.response ? fallback : 'No connection. Check your internet and try again.'));

export const requestPasswordReset = async (email) => {
  try {
    return (await api.post('/password-reset/', { email })).data;
  } catch (err) {
    throw resetError(err, 'Could not send the reset link.');
  }
};

export const confirmPasswordReset = async ({ uid, token, new_password }) => {
  try {
    return (await api.post('/password-reset/confirm/', { uid, token, new_password })).data;
  } catch (err) {
    throw resetError(err, 'Could not change the password.');
  }
};

// ─── User Management (Admin only) ──────────────────────────────
export const listUsers = async () => {
  try {
    const res = await api.get('/users/');
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to fetch users');
  }
};

export const createUser = async (userData) => {
  try {
    const res = await api.post('/users/', userData);
    return res.data;
  } catch (err) {
    // If the error response is an object with validation details, format them
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      const messages = Object.entries(data).map(([field, msgs]) => {
        const msg = Array.isArray(msgs) ? msgs[0] : msgs;
        return `${field}: ${msg}`;
      });
      throw new Error(messages.join(', '));
    }
    throw new Error(err.response?.data?.error || err.message || 'Failed to create user');
  }
};

export const updateUser = async (id, userData) => {
  try {
    const res = await api.patch(`/users/${id}/`, userData);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to update user');
  }
};

export const getUserActivityLogs = async (id) => {
  try {
    const res = await api.get(`/users/${id}/activity_log/`);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to fetch activity logs');
  }
};


// ─── Attendance Management (Staff & Admin) ──────────────────────
// params: optional { from, to } (YYYY-MM-DD) — one period instead of every shift ever recorded
export const getAttendanceLogs = async (params) => {
  try {
    const res = await api.get('/attendance/', { params });
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to fetch attendance logs');
  }
};

export const getCurrentAttendance = async () => {
  try {
    const res = await api.get('/attendance/current/');
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Failed to fetch current attendance status');
  }
};

export const clockIn = async (attendanceData) => {
  try {
    const res = await api.post('/attendance/clock_in/', attendanceData);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Clock in failed');
  }
};

export const clockOut = async (attendanceData) => {
  try {
    const res = await api.post('/attendance/clock_out/', attendanceData);
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message || 'Clock out failed');
  }
};

// ─── Crew progress photos (before / during / after) ─────────────
const errorOf = (err, fallback) => new Error(err.response?.data?.error || err.response?.data?.detail || err.message || fallback);

export const listProgressPhotos = async (bookingId) => {
  try {
    const res = await api.get(`/bookings/${bookingId}/progress-media/`);
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to load photos'); }
};

export const uploadProgressPhoto = async (bookingId, { file, phase, description }) => {
  const form = new FormData();
  form.append('file', await compressImage(file));   // phone photos shrink to ~300 KB before upload
  form.append('construction_phase', phase);
  form.append('description', description || '');
  try {
    const res = await api.post(`/bookings/${bookingId}/progress-media/`, form, { timeout: 120000 });
    return res.data;
  } catch (err) { throw errorOf(err, 'Photo upload failed'); }
};

export const deleteProgressPhoto = async (bookingId, mediaId) => {
  try {
    await api.delete(`/bookings/${bookingId}/progress-media/${mediaId}/`);
  } catch (err) { throw errorOf(err, 'Failed to delete photo'); }
};

// ─── Project Hub (portfolio) ─────────────────────────────────────
// Public — no login needed. A stale saved token makes the server answer 401 even
// on public endpoints, so retry those anonymously.
const publicGet = async (url, config = {}) => {
  try {
    return await api.get(url, config);
  } catch (err) {
    if (err.response?.status !== 401) throw err;
    return axios.get(`${API_BASE_URL}${url}`, { ...config, headers: { Accept: 'application/json' } });
  }
};

export const getPublicProjects = async (params = {}) => {
  try {
    const res = await publicGet('/portfolio/public/', { params });
    return res.data; // { results, filters }
  } catch (err) { throw errorOf(err, 'Failed to load projects'); }
};

export const getPublicProject = async (slug) => {
  try {
    const res = await publicGet(`/portfolio/public/${slug}/`);
    return res.data;
  } catch (err) { throw errorOf(err, 'Project not found'); }
};

// Landing page proof: projects with a Before/After and/or 3D design/Built photo pair
export const getProjectShowcase = async (limit = 3) => {
  try {
    const res = await publicGet('/portfolio/showcase/', { params: { limit } });
    return res.data.results;
  } catch (err) { throw errorOf(err, 'Failed to load projects'); }
};

export const getTrackRecord = async () => {
  try {
    const res = await publicGet('/portfolio/track-record/');
    return res.data; // { stats, credentials, as_of }
  } catch (err) { throw errorOf(err, 'Failed to load track record'); }
};

// ─── Free 3D Studio funnel (office admin) ────────────────────────
export const getFunnelSummary = async (days = 30) => {
  try {
    const res = await api.get('/funnel-events/summary/', { params: { days } });
    return res.data; // { days, steps: [{name, label, count, rate}], conversion_rate }
  } catch (err) { throw errorOf(err, 'Failed to load funnel'); }
};

// ─── Rate card & estimates ───────────────────────────────────────
export const getPricing = async () => {
  try {
    const res = await publicGet('/pricing/');
    return res.data; // rates + { vat_registered, service_area, is_sample, updated_at }
  } catch (err) { throw errorOf(err, 'Failed to load pricing'); }
};

// mode: 'install' | 'plants' → { bands: [{label, min, max}], suggested: { low, high } | null }
export const getBudgetSuggestion = async (areaSqm, mode = 'install') => {
  try {
    const res = await publicGet('/pricing/suggest/', { params: { area_sqm: areaSqm, mode } });
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to load budget suggestions'); }
};

// Office admin
export const updatePricing = async (data) => {
  try {
    const res = await api.patch('/pricing/', data);
    return res.data;
  } catch (err) { throw fieldErrors(err, 'Failed to save pricing'); }
};

// items: [{ product_id, quantity }]; area_sqm: garden area → { lines, total, low, high, is_sample_rates }
export const getEstimate = async (items, areaSqm) => {
  try {
    const res = await axios.post(`${API_BASE_URL}/pricing/estimate/`, { items, area_sqm: areaSqm });
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to estimate'); }
};

// Landing calculator: a typical planting of this yard, priced → same shape as getEstimate + { plant_count }
// fullness: 'light' | 'balanced' | 'full'; mode: 'install' | 'plants'
export const getQuickEstimate = async (areaSqm, fullness = 'balanced', mode = 'install') => {
  try {
    const res = await publicGet('/pricing/quick/', { params: { area_sqm: areaSqm, fullness, mode } });
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to estimate'); }
};

// ─── AI Designer health (office admin) ───────────────────────────
export const getAIDesignerHealth = async (days = 30) => {
  try {
    const res = await api.get('/ai-designer/health/', { params: { days } });
    return res.data; // { days, total, statuses: [{status, label, count}], ai_share, avg_ms, mode, paused }
  } catch (err) { throw errorOf(err, 'Failed to load AI Designer health'); }
};

// ─── Customer reviews ────────────────────────────────────────────
// source: 'all' | 'service' | 'product'
export const getReviewHighlights = async (source = 'all') => {
  try {
    const res = await publicGet('/review-highlights/', { params: { source } });
    return res.data; // { summary: { service, product }, results }
  } catch (err) { throw errorOf(err, 'Failed to load reviews'); }
};

// Office admin: params { source, status, rating, q, page }
export const listReviewsForModeration = async (params = {}) => {
  try {
    const res = await api.get('/review-moderation/', { params });
    return res.data; // { count, page, pages, needs_reply, results }
  } catch (err) { throw errorOf(err, 'Failed to load reviews'); }
};

// data: any of { is_hidden, is_featured, reply }
export const moderateReview = async (source, id, data) => {
  try {
    const res = await api.patch(`/review-moderation/${source}/${id}/`, data);
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to update review'); }
};

// Office admin — permits, registrations, awards (Track Record page)
const fieldErrors = (err, fallback) => {
  const data = err.response?.data;
  if (data && typeof data === 'object' && !data.error && !data.detail) {
    return new Error(Object.entries(data).map(([f, m]) => `${f}: ${Array.isArray(m) ? m[0] : m}`).join(', '));
  }
  return errorOf(err, fallback);
};

export const listCredentials = async () => {
  try {
    const res = await api.get('/business-credentials/');
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to load credentials'); }
};

// data: FormData (with a document file) or a plain object
export const saveCredential = async (id, data) => {
  try {
    const res = id ? await api.patch(`/business-credentials/${id}/`, data) : await api.post('/business-credentials/', data);
    return res.data;
  } catch (err) { throw fieldErrors(err, 'Failed to save'); }
};

export const deleteCredential = async (id) => {
  try {
    await api.delete(`/business-credentials/${id}/`);
  } catch (err) { throw errorOf(err, 'Failed to delete'); }
};

// Customer
export const getMyPortfolio = async () => {
  try {
    const res = await api.get('/portfolio/mine/');
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to load your garden stories'); }
};

export const answerPortfolioConsent = async (projectId, body) => {
  try {
    const res = await api.post(`/portfolio/mine/${projectId}/consent/`, body);
    return res.data;
  } catch (err) { throw errorOf(err, 'Could not save your choice'); }
};

// Office admin
export const listPortfolio = async () => {
  try {
    const res = await api.get('/portfolio/');
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to load portfolio'); }
};

export const listPortfolioCandidates = async () => {
  try {
    const res = await api.get('/portfolio/candidates/');
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to load finished jobs'); }
};

export const createPortfolioEntry = async (bookingId) => {
  try {
    const res = await api.post('/portfolio/', { booking: bookingId });
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to create entry'); }
};

export const updatePortfolioEntry = async (id, data) => {
  try {
    const res = await api.patch(`/portfolio/${id}/`, data);
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    if (data && typeof data === 'object' && !data.error) {
      throw new Error(Object.entries(data).map(([f, m]) => `${f}: ${Array.isArray(m) ? m[0] : m}`).join(', '));
    }
    throw errorOf(err, 'Failed to save');
  }
};

export const deletePortfolioEntry = async (id) => {
  try {
    await api.delete(`/portfolio/${id}/`);
  } catch (err) { throw errorOf(err, 'Failed to delete entry'); }
};

// action: 'publish' | 'unpublish' | 'archive' | 'request-consent' | 'sync-media'
export const portfolioAction = async (id, action) => {
  try {
    const res = await api.post(`/portfolio/${id}/${action}/`);
    return res.data;
  } catch (err) { throw errorOf(err, 'Action failed'); }
};

export const uploadPortfolioPhoto = async (id, { file, kind, caption }) => {
  const form = new FormData();
  form.append('image', file);
  form.append('kind', kind);
  form.append('caption', caption || '');
  try {
    const res = await api.post(`/portfolio/${id}/media/`, form, { timeout: 120000 });
    return res.data;
  } catch (err) { throw errorOf(err, 'Photo upload failed'); }
};

export const updatePortfolioPhoto = async (id, mediaId, data) => {
  try {
    const res = await api.patch(`/portfolio/${id}/media/${mediaId}/`, data);
    return res.data;
  } catch (err) { throw errorOf(err, 'Failed to update photo'); }
};

export const deletePortfolioPhoto = async (id, mediaId) => {
  try {
    await api.delete(`/portfolio/${id}/media/${mediaId}/`);
  } catch (err) { throw errorOf(err, 'Failed to remove photo'); }
};

export default api;