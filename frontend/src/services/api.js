import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Accept': 'application/json' },
});

// ─── Interceptors ────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => { 
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`); 
    const authTokens = localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null;
    if (authTokens && authTokens.access) {
      config.headers.Authorization = `Bearer ${authTokens.access}`;
    }
    return config; 
  },
  (error) => { console.error('❌ Request error:', error); return Promise.reject(error); }
);

api.interceptors.response.use(
  (response) => { console.log(`✅ ${response.status} ${response.config.url}`); return response; },
  (error) => {
    if (error.response) console.error(`❌ ${error.response.status}:`, error.response.data);
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
      onUploadProgress: (p) => console.log(`⏳ Upload: ${Math.round((p.loaded * 100) / p.total)}%`),
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
export const getInventoryItems = async (category = null) => {
  const params = category ? { category } : {};
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

export const deleteInventoryItem = async (id) => {
  const res = await api.delete(`/inventory/${id}/`);
  return res.data;
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

// ─── Stripe Payment ───────────────────────────────────────────────
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

// ─── Forgot / Reset Password ──────────────────────────────────────

/**
 * resetPassword — Verifies username+email then sets a new password.
 * POST /api/reset-password/  { username, email, new_password }
 */
export const resetPassword = async ({ username, email, new_password }) => {
  try {
    const res = await api.post('/reset-password/', { username, email, new_password });
    return res.data; // { message: '...' }
  } catch (err) {
    throw new Error(
      err.response?.data?.error || err.message || 'Password reset failed.'
    );
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
export const getAttendanceLogs = async () => {
  try {
    const res = await api.get('/attendance/');
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

export default api;