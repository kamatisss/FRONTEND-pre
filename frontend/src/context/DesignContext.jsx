import { createContext, useContext, useReducer, useCallback } from 'react';

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

  // Design settings
  terrainHeight: 1.5,
  timeOfDay: 14,
  dimensions: { width: 10, length: 15, terrainType: 'flat' },

  // Save/load
  designId: null,
  designName: 'Untitled Design',
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
          scale: { x: 0.8, y: 0.8, z: 0.8 },
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

      // New placement
      return {
        ...state,
        placedItems: [...state.placedItems, newItem],
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
      return { ...state, dimensions: { ...state.dimensions, ...action.payload }, isDirty: true };

    case 'SET_TRANSFORM_MODE':
      return { ...state, transformMode: action.payload };

    case 'LOAD_DESIGN':
      return {
        ...state,
        ...action.payload,
        isDirty: false,
      };

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

export function DesignProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Helper function to get live price from catalog
  const getLivePrice = (item) => {
    const catalogItem = state.products.find(p => p.id === item.productId);
    return catalogItem ? Number(catalogItem.unit_price) : Number(item.unit_price || item.price || 0);
  };

  const totalCost = state.placedItems.reduce((sum, item) => sum + getLivePrice(item), 0);

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

  const value = {
    state,
    dispatch,
    totalCost,
    costBreakdown: Object.values(costBreakdown),
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
