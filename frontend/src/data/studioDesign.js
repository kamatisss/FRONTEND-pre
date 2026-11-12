// A saved design (GET /designs/:id/) as the Studio's LOAD_DESIGN payload. Designs come in two formats:
//  - Studio:      { productId | product_id, position, rotation, scale }
//  - AI Designer: { plant_id, x, z, rotation° } in lot metres (also is_existing markers: trees already on site)
// AI items are converted with lotPlantsToStudioItems. Items the Studio can't show (existing-feature markers,
// items no longer in the catalog) are carried along untouched and saved back with the design, so an office
// edit after the site visit never drops them. Every place that opens a saved design in the Studio uses this.
import { lotPlantsToStudioItems } from './sampleGarden';
import { DEFAULT_TIME_OF_DAY } from './studioLight';
import { loadDesign, getInventoryItems } from '../services/api';

const isLotItem = (item) => item && typeof item === 'object' && !item.position
  && (item.plant_id !== undefined || item.is_existing);

export const designNeedsCatalog = (design) => (design?.placed_items || []).some(isLotItem);

export function designToStudioPayload(design, products = []) {
  const items = Array.isArray(design.placed_items) ? design.placed_items : [];
  const dims = design.dimensions || { width: 10, length: 15, terrainType: 'flat' };
  const width = Number(dims.width) || 10;
  const length = Number(dims.length) || 15;
  const now = Date.now();
  const placedItems = [];
  const carriedItems = [];
  items.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    if (isLotItem(item)) {
      const [converted] = lotPlantsToStudioItems([item], products, width, length);
      if (converted) placedItems.push({ ...converted, id: now + idx });
      else carriedItems.push(item);
      return;
    }
    placedItems.push({
      id: now + idx,
      productId: item.productId ?? item.product_id,
      name: item.name,
      modelType: item.model_type || item.modelType,
      price: item.price,
      position: item.position || { x: 0, y: 0, z: 0 },
      rotation: item.rotation || { x: 0, y: 0, z: 0 },
      scale: item.scale || { x: 1, y: 1, z: 1 },
    });
  });
  return {
    designId: design.id,
    designName: design.name,
    designLocked: !!design.locked,
    depthData: design.depth_data,
    originalImageUrl: design.original_image_url || '',
    placedItems,
    carriedItems,
    dimensions: { terrainType: 'flat', ...dims },
    terrainHeight: design.terrain_height || 1.5,
    timeOfDay: design.time_of_day ?? DEFAULT_TIME_OF_DAY,
  };
}

// Load a saved design and turn it into the Studio payload (fetches the catalog when an AI design needs it).
// Returns { payload, products } — products is the fetched catalog, or null if the one passed in was used.
export async function loadDesignForStudio(id, products) {
  const design = await loadDesign(id);
  let fetched = null;
  if (designNeedsCatalog(design) && !products?.length) fetched = await getInventoryItems();
  return { payload: designToStudioPayload(design, fetched || products || []), products: fetched };
}
