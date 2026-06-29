import { useState, useEffect } from 'react';
import { useDesign } from '../context/DesignContext';
import { getInventoryItems } from '../services/api';
import AssetCard from './AssetCard';
import {
  Leaf, TreePine, Gem, Armchair, Search, MapPin, X
} from 'lucide-react';

const TABS = [
  { key: 'all', label: 'All', icon: Leaf },
  { key: 'plant', label: 'Plants', icon: TreePine },
  { key: 'hardscape', label: 'Hardscape', icon: Gem },
  { key: 'furniture', label: 'Furniture', icon: Armchair },
];


export default function AssetLibrary() {
  const { state, dispatch } = useDesign();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      try {
        const data = await getInventoryItems();
        dispatch({ type: 'SET_PRODUCTS', payload: data });
      } catch (err) {
        console.error('Failed to load inventory items:', err);
      } finally {
        setLoadingProducts(false);
      }
    }
    if (state.products.length === 0) fetchProducts();
  }, [state.products.length, dispatch]);

  const filtered = state.products.filter(p => {
    const matchTab = activeTab === 'all' || p.category === activeTab;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const isSelected = (p) => state.selectedProduct?.id === p.id;
  const isPlacing = state.placementMode !== 'idle';

  const handleSelectAsset = (product) => {
    if (isPlacing && state.selectedProduct?.id === product.id) {
      dispatch({ type: 'CANCEL_PLACEMENT' });
      return;
    }
    if (isPlacing) {
      dispatch({ type: 'CANCEL_PLACEMENT' });
    }
    dispatch({ type: 'START_PLACING', payload: product });
  };

  return (
    <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col font-sans h-full overflow-hidden">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center mb-4">
        <Leaf size={18} className="mr-2 text-emerald-500" />
        Asset Library
      </h3>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 whitespace-nowrap scrollbar-hide mb-4">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 shadow-sm ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
              onClick={() => setActiveTab(t.key)}
            >
              <Icon size={14} className="mr-1.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          placeholder="Search assets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-2 gap-3 pb-2">
          {loadingProducts && <p className="text-slate-500 text-sm italic col-span-2 text-center py-4">Loading catalog...</p>}
        {filtered.map(product => (
          <AssetCard
            key={product.id}
            product={product}
            isSelected={isSelected(product)}
            onClick={handleSelectAsset}
          />
        ))}
          {!loadingProducts && filtered.length === 0 && (
            <p className="col-span-2 text-center text-sm text-slate-500 py-4">No matching assets found.</p>
          )}
        </div>
      </div>

      {/* Selection hint */}
      {isPlacing && state.previewObject && (
        <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-sm text-indigo-900 dark:text-indigo-200 flex items-center mb-1">
            <MapPin size={16} className="mr-2 text-indigo-500" />
            Placing: <strong className="ml-1">{state.previewObject.name}</strong>
          </p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
              ₱{Number(state.previewObject.unit_price || state.previewObject.price).toLocaleString()}
            </p>
            <button
              className="flex items-center text-xs font-semibold px-2 py-1 bg-white/50 dark:bg-black/20 text-indigo-600 dark:text-indigo-300 rounded hover:bg-white dark:hover:bg-black/40 transition-colors"
              onClick={() => dispatch({ type: 'CANCEL_PLACEMENT' })}
            >
              <X size={12} className="mr-1" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
