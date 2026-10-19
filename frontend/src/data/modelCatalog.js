// ─── Static 3D model catalog ──────────────────────────────────────────────────
// Core catalog .glb files ship with the frontend in `public/models/<category>/`
// and are served from the same origin as the app (no CORS, no backend round-trip).
// Keys are the model file names as stored on InventoryItem.model_file.

export const MODEL_CATALOG = {
  // Furniture
  'bamboo_bench.glb':        '/models/furniture/bamboo_bench.glb',
  'outdoor_bench.glb':       '/models/furniture/outdoor_bench.glb',
  'rocking_chair.glb':       '/models/furniture/rocking_chair.glb',

  // Hardscape
  'blueish_river_rock.glb':  '/models/hardscape/blueish_river_rock.glb',
  'coral_stone.glb':         '/models/hardscape/coral_stone.glb',
  'mossy_rock.glb':          '/models/hardscape/mossy_rock.glb',
  'volcanic_rock.glb':       '/models/hardscape/volcanic_rock.glb',

  // Plants
  'bamboo.glb':              '/models/plants/bamboo.glb',
  'banana_tree.glb':         '/models/plants/banana_tree.glb',
  'christmas_palm.glb':      '/models/plants/christmas_palm.glb',
  'codiaeum_variegatum.glb': '/models/plants/codiaeum_variegatum.glb',
  'geranium.glb':            '/models/plants/geranium.glb',
  'geranium_flower.glb':     '/models/plants/geranium_flower.glb',
  'heliconia_rostrata.glb':  '/models/plants/heliconia_rostrata.glb',
  'hibiscus.glb':            '/models/plants/hibiscus.glb',
  'livistona.glb':           '/models/plants/livistona.glb',
  'peace_lilies.glb':        '/models/plants/peace_lilies.glb',
  'plumeria_flower.glb':     '/models/plants/plumeria_flower.glb',
  'strelitzia.glb':          '/models/plants/strelitzia.glb',
};

const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000';

/**
 * Resolve a model reference to a loadable URL.
 *
 * Accepts whatever the API / saved designs hold — an absolute backend URL
 * (`http://127.0.0.1:8000/media/models/bamboo.glb`), a relative media path
 * (`/media/models/bamboo.glb`), a bare file name, or a `/models/...` public path.
 *
 *   1. Known catalog models  → frontend public path (`/models/plants/bamboo.glb`)
 *   2. Already a public path → returned as-is
 *   3. Anything else (models uploaded by staff via the Inventory Dashboard that
 *      are not bundled with the frontend) → served from backend media
 */
export function resolveModelUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const fileName = rawUrl.split(/[?#]/)[0].split('/').pop().toLowerCase();
  // Django appends "_<7 random chars>" when an upload name already exists
  const baseName = fileName.replace(/_[a-z0-9]{7}(\.gl(b|tf))$/, '$1');
  const publicPath = MODEL_CATALOG[fileName] || MODEL_CATALOG[baseName];
  if (publicPath) return publicPath;

  if (rawUrl.startsWith('/models/') || /^https?:\/\//.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/')) return `${MEDIA_BASE_URL}${rawUrl}`;
  // Bare file name / modelType with no matching file — nothing loadable
  return /\.gl(b|tf)$/i.test(rawUrl) ? `${MEDIA_BASE_URL}/media/models/${rawUrl}` : null;
}
