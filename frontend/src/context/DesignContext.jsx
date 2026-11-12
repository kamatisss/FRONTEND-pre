import { createContext, useContext, useMemo, useReducer } from 'react';
import { DEFAULT_TIME_OF_DAY } from '../data/studioLight';
import { fitLotToItems, lotOf, lotArea, insideLot, moveInsideLot, resizeDimensions } from '../data/lot';
import { plantBeds, bedSpread, groundcoverFor } from '../data/plantBeds';
import { layoutSpacing, grownHeight } from '../data/pricing';

const DesignContext = createContext(null);

const initialState = {
  // Image & depth
  originalImageUrl: null,
  depthData: null,         // { depth_map_url, normal_map_url, rock_mask_url, grass_mask_url }

  // Placed objects
  placedItems: [],         // [{ id, productId, name, model_file, thumbnail, unit_price, position, rotation, scale }]
  selectedItemId: null,

  // Catalog
  products: [],
  selectedProduct: null,   // product object from catalog

  // ── Placement workflow ──────────────────────────────────────
  placementMode: 'idle',   // 'idle' | 'placing' | 'editing'
  previewObject: null,     // { id, productId, name, model_file, thumbnail, unit_price, position, rotation, scale }
  editingItemId: null,     // id of existing item being re-positioned
  previewValid: true,      // whether current preview position is valid
  groupSize: 1,            // plants: place a drift of this many (1, 3, 5 or 7) with one tap ("Plant a group")

  // Design settings
  terrainHeight: 1.5,
  timeOfDay: DEFAULT_TIME_OF_DAY,
  dimensions: { width: 10, length: 15, terrainType: 'flat' },
  growthStage: 'established',   // view only (not saved): 'planting' | 'established' | 'mature'

  // Save/load
  designId: null,
  designName: 'Untitled Design',
  designLocked: false,
  carriedItems: [],             // saved items the Studio can't show (e.g. AI 'already on site' markers): saved back as they were          // a booking uses this design: saving offers a new design (design_lock.py)
  savedDesigns: [],
  isDirty: false,

  // UI
  loading: false,
  error: '',
  transformMode: 'translate',  // translate | rotate | scale
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_IMAGE':
      return { ...state, originalImageUrl: action.payload, isDirty: true };

    case 'SET_DEPTH_DATA':
      return { ...state, depthData: action.payload, isDirty: true };

    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };

    case 'SELECT_PRODUCT':
      return { ...state, selectedProduct: action.payload, selectedItemId: null };

    // ── Placement Workflow Actions ────────────────────────────
    case 'START_PLACING': {
      const product = action.payload;
      // Give a random initial position spread across the terrain so items don't stack
      const randomX = (Math.random() - 0.5) * 8;  // -4 to +4
      const randomZ = (Math.random() - 0.5) * 8;  // -4 to +4
      return {
        ...state,
        placementMode: 'placing',
        selectedProduct: product,
        selectedItemId: null,
        editingItemId: null,
        previewValid: true,
        previewObject: {
          id: `preview_${Date.now()}`,
          productId: product.id,
          name: product.name,
          model_file: product.model_file || null,
          thumbnail:  product.thumbnail  || null,
          unit_price: Number(product.unit_price),
          position: { x: randomX, y: 0, z: randomZ },
          rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
          scale: { x: 1, y: 1, z: 1 },   // real size (data/modelSizing.js)
        },
      };
    }

    case 'UPDATE_PREVIEW_POSITION': {
      if (!state.previewObject) return state;
      return {
        ...state,
        previewObject: {
          ...state.previewObject,
          position: action.payload.position,
        },
        previewValid: action.payload.valid !== undefined ? action.payload.valid : state.previewValid,
      };
    }

    case 'SET_GROUP_SIZE':
      return { ...state, groupSize: [1, 3, 5, 7].includes(action.payload) ? action.payload : 1 };

    case 'CONFIRM_PLACEMENT': {
      if (!state.previewObject) return state;
      const newItem = {
        ...state.previewObject,
        id: Date.now() + Math.random(), // permanent id
      };

      if (state.placementMode === 'editing' && state.editingItemId) {
        // Update existing item's position
        return {
          ...state,
          placedItems: state.placedItems.map(item =>
            item.id === state.editingItemId
              ? { ...item, position: state.previewObject.position }
              : item
          ),
          placementMode: 'idle',
          previewObject: null,
          editingItemId: null,
          selectedProduct: null,
          previewValid: true,
          isDirty: true,
        };
      }

      // New placement: one, or a natural drift of the same plant ("Plant a group": odd numbers, spaced to grow)
      const product = state.products.find(p => p.id === newItem.productId);
      const group = product?.category === 'plant' && state.groupSize > 1
        ? driftAround(newItem, product, state.groupSize, state.placedItems, state.products, state.dimensions)
        : [newItem];
      return {
        ...state,
        placedItems: [...state.placedItems, ...group],
        placementMode: 'idle',
        previewObject: null,
        selectedProduct: null,
        previewValid: true,
        isDirty: true,
      };
    }

    case 'CANCEL_PLACEMENT': {
      if (state.placementMode === 'editing' && state.editingItemId) {
        // Restore the original item visibility (it was hidden, not removed)
        return {
          ...state,
          placementMode: 'idle',
          previewObject: null,
          editingItemId: null,
          selectedProduct: null,
          previewValid: true,
        };
      }
      return {
        ...state,
        placementMode: 'idle',
        previewObject: null,
        selectedProduct: null,
        previewValid: true,
      };
    }

    case 'START_EDITING': {
      const itemId = action.payload;
      const item = state.placedItems.find(i => i.id === itemId);
      if (!item) return state;

      return {
        ...state,
        placementMode: 'editing',
        editingItemId: itemId,
        selectedItemId: null,
        selectedProduct: null,
        previewValid: true,
        previewObject: {
          ...item,
          id: `preview_edit_${Date.now()}`,
        },
      };
    }

    // ── Original Actions (unchanged) ─────────────────────────
    case 'ADD_ITEM': {
      const item = action.payload;
      return {
        ...state,
        placedItems: [...state.placedItems, item],
        isDirty: true,
      };
    }

    case 'UPDATE_ITEM': {
      const { id, updates } = action.payload;
      return {
        ...state,
        placedItems: state.placedItems.map(item =>
          item.id === id ? { ...item, ...updates } : item
        ),
        isDirty: true,
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        placedItems: state.placedItems.filter(i => i.id !== action.payload),
        selectedItemId: state.selectedItemId === action.payload ? null : state.selectedItemId,
        isDirty: true,
      };

    case 'SELECT_ITEM':
      return { ...state, selectedItemId: action.payload, selectedProduct: null };

    case 'DESELECT_ALL':
      return { ...state, selectedItemId: null };

    case 'SET_TERRAIN_HEIGHT':
      return { ...state, terrainHeight: action.payload, isDirty: true };

    case 'SET_TIME_OF_DAY':
      return { ...state, timeOfDay: action.payload, isDirty: true };

    case 'SET_DIMENSIONS':
      return { ...state, dimensions: resizeDimensions(state.dimensions, action.payload), isDirty: true };

    // Items left outside after the lot was made smaller: bring them just inside the edge…
    case 'MOVE_ITEMS_INTO_LOT': {
      const lot = lotOf(state.dimensions);
      return {
        ...state,
        isDirty: true,
        placedItems: state.placedItems.map(it => {
          const x = Number(it?.position?.x), z = Number(it?.position?.z);
          if (!Number.isFinite(x) || !Number.isFinite(z) || insideLot(x, z, lot)) return it;
          return { ...it, position: { ...it.position, ...moveInsideLot(x, z, lot) } };
        }),
      };
    }
    // …or grow the lot to fit them
    case 'FIT_LOT_TO_ITEMS':
      return { ...state, isDirty: true, dimensions: fitLotToItems(state.dimensions, state.placedItems) };

    case 'SET_GROWTH_STAGE':
      return { ...state, growthStage: action.payload };   // a view setting: the design isn't changed

    case 'SET_TRANSFORM_MODE':
      return { ...state, transformMode: action.payload };

    case 'LOAD_DESIGN': {
      // Older designs (made on the fixed 24 m ground) get a lot that fits their items
      const next = { ...state, designLocked: false, carriedItems: [], ...action.payload, isDirty: false };
      return { ...next, dimensions: fitLotToItems(next.dimensions, next.placedItems) };
    }

    case 'SET_DESIGN_META':
      return { ...state, ...action.payload };

    case 'SET_SAVED_DESIGNS':
      return { ...state, savedDesigns: action.payload };

    case 'MARK_CLEAN':
      return { ...state, isDirty: false };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_DESIGN':
      return { ...state, placedItems: [], isDirty: true };

    case 'RESET':
      return { ...initialState, products: state.products };

    default:
      return state;
  }
}

// A drift of n of one plant round the tapped spot (Studio coordinates: centred on the lot): a sunflower spiral at the
// plant's planting distance, skipping spots outside the lot or too close to plants already there. The first is the spot.
function driftAround(first, product, n, placed, products, dimensions) {
  const spacing = layoutSpacing(product);
  const lot = lotOf(dimensions);
  const byId = new Map(products.map(p => [p.id, p]));
  const taken = placed.map(i => ({ x: Number(i.position?.x) || 0, z: Number(i.position?.z) || 0, s: byId.get(i.productId) ? layoutSpacing(byId.get(i.productId)) : 0.5 }));
  const out = [first];
  const cx = Number(first.position.x) || 0, cz = Number(first.position.z) || 0;
  for (let k = 1, tries = 0; out.length < n && tries < n * 12; k++, tries++) {
    const r = spacing * 0.95 * Math.sqrt(k), a = k * 2.39996;
    const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
    const fits = insideLot(x, z, lot, Math.min(0.3, spacing / 4))
      && out.every(o => Math.hypot(o.position.x - x, o.position.z - z) >= spacing * 0.9)
      && taken.every(t => Math.hypot(t.x - x, t.z - z) >= (spacing + t.s) / 2 * 0.9);
    if (!fits) continue;
    out.push({ ...first, id: Date.now() + Math.random(), position: { ...first.position, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 },
      rotation: { ...first.rotation, y: (first.rotation?.y || 0) + k * 1.3 } });
  }
  return out;
}

export function DesignProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Helper function to get live price from catalog
  const getLivePrice = (item) => {
    const catalogItem = state.products.find(p => p.id === item.productId);
    return catalogItem ? Number(catalogItem.unit_price) : Number(item.unit_price || item.price || 0);
  };

  // The beds round the placed plants (data/plantBeds.js) and their groundcover: a hand-made design gets planting beds
  // where its plants are, mulched or carpeted (switch: dimensions.groundcoverOff). A design from the AI Designer keeps
  // its own beds (gardenPlan): its groundcover covers the yard less its lawn.
  const ground = useMemo(() => {
    const lot = lotOf(state.dimensions);
    const W = lot.width, L = lot.length;
    const byId = new Map(state.products.map(p => [p.id, p]));
    const plants = state.placedItems.map(i => ({ item: i, product: byId.get(i.productId) }))
      .filter(({ product }) => product && product.category === 'plant' && !product.is_groundcover);
    const plan = state.dimensions?.gardenPlan;
    const beds = plan?.lawn ? null : plantBeds(plants.map(({ item, product }) => ({
      x: (Number(item.position?.x) || 0) + W / 2, z: (Number(item.position?.z) || 0) + L / 2,
      spread: bedSpread(product, layoutSpacing),
    })), W, L, { outline: lot.outline });
    const bedArea = plan?.lawn ? Math.max(0, lotArea(lot) - (Number(plan.lawn_area) || 0)) : (beds?.area || 0);
    const crowns = plants.reduce((sum, { product }) => (grownHeight(product) >= 2.4
      ? sum + Math.PI * (bedSpread(product, layoutSpacing) / 2) ** 2 : sum), 0);
    const on = !state.dimensions?.groundcoverOff;
    const entries = on ? groundcoverFor(bedArea, state.products, crowns) : [];
    return { beds, bedArea, entries, on, available: state.products.some(p => p.is_groundcover && Number(p.stock_quantity) > 0) };
  }, [state.placedItems, state.products, state.dimensions]);

  const groundcoverCost = ground.entries.reduce((sum, e) => {
    const product = state.products.find(p => String(p.id) === String(e.plant_id));
    return sum + (product ? Number(product.unit_price) * e.area_sqm : 0);
  }, 0);
  const totalCost = state.placedItems.reduce((sum, item) => sum + getLivePrice(item), 0) + groundcoverCost;

  const costBreakdown = state.placedItems.reduce((acc, item) => {
    const key = item.name || item.model_file || item.modelType;
    const price = getLivePrice(item);
    if (!acc[key]) {
      acc[key] = { name: key, unitPrice: price, quantity: 0, subtotal: 0 };
    }
    acc[key].quantity += 1;
    acc[key].subtotal += price;
    return acc;
  }, {});

  // Groundcover lines: per m² (checkout orders that many units of the product)
  ground.entries.forEach(e => {
    const product = state.products.find(p => String(p.id) === String(e.plant_id));
    if (!product) return;
    costBreakdown[product.name] = { name: product.name, unitPrice: Number(product.unit_price), quantity: e.area_sqm,
      subtotal: Number(product.unit_price) * e.area_sqm, unit: 'm²', groundcover: true };
  });

  const value = {
    state,
    dispatch,
    totalCost,
    costBreakdown: Object.values(costBreakdown),
    ground,   // { beds, bedArea, entries, on, available }
  };

  return (
    <DesignContext.Provider value={value}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used within DesignProvider');
  return ctx;
}

export default DesignContext;
