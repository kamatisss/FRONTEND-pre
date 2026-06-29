import { useState, useEffect } from 'react';
import { useDesign } from '../context/DesignContext';
import { getInventoryItems } from '../services/api';
import AssetCard from './AssetCard';
import {
  Leaf, TreePine, Gem, Armchair, Search, X,
  Package, Sparkles, ChevronRight,
} from 'lucide-react';

const TABS = [
  { key: 'all',        label: 'All',        icon: Sparkles },
  { key: 'plant',      label: 'Plants',     icon: TreePine },
  { key: 'hardscape',  label: 'Hardscape',  icon: Gem },
  { key: 'furniture',  label: 'Furniture',  icon: Armchair },
];

/* ── Skeleton card for loading state ── */
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 14,
      overflow: 'hidden',
      background: '#f8fafc',
      border: '1px solid #f1f5f9',
    }}>
      <div style={{
        height: 96,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'als-shimmer 1.4s infinite',
      }} />
      <div style={{ padding: '10px 10px 12px' }}>
        <div style={{ height: 10, borderRadius: 6, background: '#e2e8f0', marginBottom: 6, width: '70%', animation: 'als-shimmer 1.4s infinite' }} />
        <div style={{ height: 8,  borderRadius: 6, background: '#f1f5f9', marginBottom: 6, width: '50%', animation: 'als-shimmer 1.4s infinite' }} />
        <div style={{ height: 10, borderRadius: 6, background: '#dcfce7', width: '40%', animation: 'als-shimmer 1.4s infinite' }} />
      </div>
    </div>
  );
}

/* ── Individual enhanced asset card ── */
function EnhancedAssetCard({ product, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);
  const hasImage = product.image_url || product.image || product.thumbnail;
  const imageUrl = product.image_url || product.image || product.thumbnail;
  const price = Number(product.unit_price || product.price || 0);
  const stock = product.stock_quantity ?? product.quantity ?? product.available ?? null;

  return (
    <div
      onClick={() => onClick(product)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: isSelected
          ? '2px solid #10b981'
          : hovered
          ? '2px solid #a7f3d0'
          : '2px solid transparent',
        background: isSelected ? '#ecfdf5' : hovered ? '#f8fafc' : 'white',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(16,185,129,0.15), 0 4px 12px rgba(16,185,129,0.1)'
          : hovered
          ? '0 4px 16px rgba(15,23,42,0.08)'
          : '0 1px 3px rgba(15,23,42,0.05)',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.22,1,0.36,1)',
        transform: hovered && !isSelected ? 'translateY(-2px)' : 'none',
        position: 'relative',
      }}
    >
      {/* Image / Preview area */}
      <div style={{
        height: 96,
        background: hasImage
          ? 'transparent'
          : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {hasImage ? (
          <img
            src={imageUrl}
            alt={product.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
              transform: hovered ? 'scale(1.08)' : 'scale(1)',
            }}
          />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4,
          }}>
            <Leaf size={22} color="#a7f3d0" />
            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Preview
            </span>
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 20, height: 20, borderRadius: '50%',
            background: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(16,185,129,0.4)',
          }}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* Category dot */}
        {product.category && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            padding: '2px 6px', borderRadius: 100,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(4px)',
            fontSize: 9, fontWeight: 800, color: '#059669',
            letterSpacing: 0.3, textTransform: 'uppercase',
            border: '1px solid rgba(167,243,208,0.6)',
          }}>
            {product.category}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '9px 10px 11px' }}>
        <p style={{
          fontSize: 12.5, fontWeight: 700, color: '#0f172a',
          margin: '0 0 3px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {product.name}
        </p>

        {stock !== null && (
          <p style={{
            fontSize: 10.5, fontWeight: 600,
            color: stock > 10 ? '#64748b' : stock > 0 ? '#f59e0b' : '#ef4444',
            margin: '0 0 5px',
          }}>
            {stock > 0 ? `${stock} available` : 'Out of stock'}
          </p>
        )}

        <p style={{
          fontSize: 13, fontWeight: 800,
          color: '#059669', margin: 0, letterSpacing: '-0.3px',
        }}>
          ₱{price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Hover "place" hint */}
      {hovered && !isSelected && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(16,185,129,0.92) 0%, transparent 100%)',
          padding: '20px 10px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'white', letterSpacing: 0.3 }}>
            CLICK TO PLACE
          </span>
          <ChevronRight size={10} color="white" />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AssetLibrarySidebar({ category }) {
  const { state, dispatch } = useDesign();
  const [search, setSearch]             = useState('');
  const [activeTab, setActiveTab]       = useState(category || 'all');
  const [loadingProducts, setLoading]   = useState(false);

  useEffect(() => {
    if (category) setActiveTab(category);
  }, [category]);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const data = await getInventoryItems();
        dispatch({ type: 'SET_PRODUCTS', payload: data });
      } catch (err) {
        console.error('Failed to load inventory items:', err);
      } finally {
        setLoading(false);
      }
    }
    if (state.products.length === 0) fetchProducts();
  }, [state.products.length, dispatch]);

  const filtered = state.products.filter(p => {
    const matchTab    = activeTab === 'all' || p.category === activeTab;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const isSelected = (p) => state.selectedProduct?.id === p.id;
  const isPlacing  = state.placementMode !== 'idle';

  const handleSelectAsset = (product) => {
    if (isPlacing && state.selectedProduct?.id === product.id) {
      dispatch({ type: 'CANCEL_PLACEMENT' });
      return;
    }
    if (isPlacing) dispatch({ type: 'CANCEL_PLACEMENT' });
    dispatch({ type: 'START_PLACING', payload: product });
  };

  // Count per tab
  const countFor = (key) => key === 'all'
    ? state.products.length
    : state.products.filter(p => p.category === key).length;

  return (
    <>
      <style>{`
        @keyframes als-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .als-tab-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 10px; border: none;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all 0.18s; white-space: nowrap; font-family: inherit;
          letter-spacing: -0.1px;
        }
        .als-tab-btn.active {
          background: #ecfdf5; color: #059669;
          box-shadow: 0 0 0 1.5px #a7f3d0;
        }
        .als-tab-btn:not(.active) {
          background: transparent; color: #64748b;
        }
        .als-tab-btn:not(.active):hover {
          background: #f8fafc; color: #10b981;
        }
        .als-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 16px; border-radius: 100px;
          font-size: 10px; font-weight: 800; padding: 0 4px;
        }
        .als-tab-btn.active .als-count {
          background: #10b981; color: white;
        }
        .als-tab-btn:not(.active) .als-count {
          background: #e2e8f0; color: #94a3b8;
        }
        .als-search {
          width: 100%; padding: 9px 12px 9px 36px;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          border-radius: 12px; font-size: 13px; font-weight: 500;
          color: #0f172a; outline: none; font-family: inherit;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .als-search:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
          background: white;
        }
        .als-search::placeholder { color: #94a3b8; }
        .als-scroll::-webkit-scrollbar { width: 4px; }
        .als-scroll::-webkit-scrollbar-track { background: transparent; }
        .als-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .als-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: 'white', fontFamily: "'Inter', system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '16px 16px 0',
          borderBottom: '1px solid #f1f5f9',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
              }}>
                <Package size={14} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Asset Library
                </h3>
                <p style={{ margin: 0, fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                  {state.products.length} items available
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} color="#94a3b8" style={{
              position: 'absolute', left: 11, top: '50%',
              transform: 'translateY(-50%)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              className="als-search"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#e2e8f0', border: 'none', borderRadius: '50%',
                  width: 16, height: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >
                <X size={10} color="#64748b" />
              </button>
            )}
          </div>

          {/* Tab pills */}
          <div style={{
            display: 'flex', gap: 4, overflowX: 'auto',
            paddingBottom: 12, scrollbarWidth: 'none',
          }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`als-tab-btn${activeTab === key ? ' active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                <Icon size={12} />
                {label}
                <span className="als-count">{countFor(key)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="als-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px' }}>
          {loadingProducts ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {filtered.map(product => (
                <EnhancedAssetCard
                  key={product.id}
                  product={product}
                  isSelected={isSelected(product)}
                  onClick={handleSelectAsset}
                />
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '48px 16px', textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <Search size={22} color="#cbd5e1" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>
                No assets found
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
                {search ? `No results for "${search}"` : 'Nothing in this category yet.'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    padding: '7px 16px', borderRadius: 100,
                    background: '#ecfdf5', border: '1px solid #a7f3d0',
                    fontSize: 12, fontWeight: 700, color: '#059669',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Active placement banner ── */}
        {isPlacing && state.previewObject && (
          <div style={{
            margin: '0 12px 12px',
            padding: '12px 14px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: '1.5px solid #a7f3d0',
            borderRadius: 14,
            boxShadow: '0 4px 12px rgba(16,185,129,0.1)',
            animation: 'als-slide-up 0.25s cubic-bezier(0.22,1,0.36,1)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{
                fontSize: 9.5, fontWeight: 800, color: '#059669',
                textTransform: 'uppercase', letterSpacing: 0.8,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 0 3px rgba(16,185,129,0.25)',
                  display: 'inline-block',
                  animation: 'als-pulse 1.5s infinite',
                }} />
                Placing Asset
              </span>
              <button
                onClick={() => dispatch({ type: 'CANCEL_PLACEMENT' })}
                style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: 'rgba(239,68,68,0.1)', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ef4444', padding: 0,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                title="Cancel placement"
              >
                <X size={11} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'white', border: '1px solid #d1fae5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, overflow: 'hidden',
              }}>
                {state.previewObject.image_url || state.previewObject.image || state.previewObject.thumbnail ? (
                  <img
                    src={state.previewObject.image_url || state.previewObject.image || state.previewObject.thumbnail}
                    alt={state.previewObject.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Leaf size={18} color="#10b981" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 800, color: '#0f172a',
                  margin: '0 0 2px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {state.previewObject.name}
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', margin: 0 }}>
                  ₱{Number(state.previewObject.unit_price || state.previewObject.price || 0)
                    .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <p style={{
              fontSize: 10.5, color: '#64748b', margin: '8px 0 0',
              fontWeight: 500, lineHeight: 1.4,
            }}>
              Click anywhere on the canvas to place this asset.
            </p>
          </div>
        )}

        <style>{`
          @keyframes als-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes als-slide-up {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </>
  );
}
