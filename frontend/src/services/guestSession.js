const KEY = 'gs_guest_design';

export const saveGuestDesign = (data) => {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
};

export const loadGuestDesign = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const clearGuestDesign = () => {
  localStorage.removeItem(KEY);
};
