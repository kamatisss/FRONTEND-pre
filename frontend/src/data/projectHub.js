// Shared formatting for the Project Hub pages (kept out of component files for fast refresh).

export const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null);
export const fmtArea = (sqm) => (sqm ? `${Number(sqm).toLocaleString(undefined, { maximumFractionDigits: 1 })} m²` : null);
export const peso = (n) => `₱${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// Saved designs store either AI layouts ({plant_id, x, z}) or Studio items ({position, rotation});
// ThreeGardenCanvas wants the AI shape. Same mapping as the crew 3D preview.
export const toCanvasPlants = (placedItems = []) =>
  (Array.isArray(placedItems) ? placedItems : []).map(item => (item.plant_id !== undefined
    ? { plant_id: item.plant_id, x: item.x ?? 0, z: item.z ?? 0, rotation: item.rotation ?? 0 }
    : {
        plant_id: item.modelType || item.model_type || String(item.productId || item.product_id || ''),
        x: item.position?.x ?? 0,
        z: item.position?.z ?? 0,
        rotation: item.rotation?.y ?? 0,
      }));
