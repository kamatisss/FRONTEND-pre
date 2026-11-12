// Shared formatting for the Project Hub pages (kept out of component files for fast refresh).

export const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null);
export const fmtArea = (sqm) => (sqm ? `${Number(sqm).toLocaleString(undefined, { maximumFractionDigits: 1 })} m²` : null);
export const peso = (n) => `₱${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// Saved designs store either AI layouts ({plant_id, x, z, rotation°} in lot metres from the corner) or
// Studio items ({product_id, position, rotation.y in radians}, centred on the lot). ThreeGardenCanvas wants
// the AI shape, so Studio items move by half the lot and turn to degrees (the inverse of
// lotPlantsToStudioItems). A design the office adjusted in the Studio then shows in the same place for
// the customer, the crew and the portfolio. Every 3D viewer of a saved design uses this.
export const toCanvasPlants = (placedItems = [], width = 10, length = 15) =>
  (Array.isArray(placedItems) ? placedItems : []).filter(item => item && typeof item === 'object').map((item) => {
    if (!item.position) {
      // AI layout item: already in canvas shape (keeps uid and "already on site" markers)
      return { ...item, x: Number(item.x) || 0, z: Number(item.z) || 0, rotation: Number(item.rotation) || 0 };
    }
    const id = item.productId ?? item.product_id;
    return {
      plant_id: id !== undefined && id !== null && id !== '' ? String(id) : (item.modelType || item.model_type || ''),
      x: (Number(item.position.x) || 0) + Number(width) / 2,
      z: (Number(item.position.z) || 0) + Number(length) / 2,
      rotation: ((Number(item.rotation?.y) || 0) * 180) / Math.PI,
    };
  });
