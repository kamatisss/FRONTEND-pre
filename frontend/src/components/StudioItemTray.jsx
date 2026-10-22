import { Sprout, BrickWall, Armchair, LayoutGrid, X, Hand } from 'lucide-react';
import { useDesign } from '../context/DesignContext';
import { productImage } from '../data/productImage';

/*
 * Phone Studio catalog: one swipeable row of items above the bottom bar, so the garden stays
 * in view (the old bottom sheet covered ~72% of it and stayed open while placing).
 * Tap an item → the tray shrinks to a "tap the ground" bar → tap the ground → the tray is back
 * for the next item. "See all" opens the full library with search.
 */

const TRAY_CATEGORIES = [
  { key: 'plant',     label: 'Plants',    Icon: Sprout },
  { key: 'hardscape', label: 'Hardscape', Icon: BrickWall },
  { key: 'furniture', label: 'Furniture', Icon: Armchair },
];

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

export default function StudioItemTray({ category, onCategory, onClose, onSeeAll }) {
  const { state, dispatch } = useDesign();
  const placing = state.placementMode === 'placing' && state.previewObject;
  const items = state.products.filter(p => p.category === category);
  const count = (key) => state.products.filter(p => p.category === key).length;

  const pick = (product) => {
    if (placing && state.selectedProduct?.id === product.id) { dispatch({ type: 'CANCEL_PLACEMENT' }); return; }
    if (state.placementMode !== 'idle') dispatch({ type: 'CANCEL_PLACEMENT' });
    dispatch({ type: 'START_PLACING', payload: product });
  };

  return (
    <div className="sit" role="region" aria-label="Add items">
      <style>{`
        .sit { position: absolute; left: 0; right: 0; bottom: 0; z-index: 25; background: #fff; border-top: 1px solid #E5E7EB;
          border-radius: 18px 18px 0 0; box-shadow: 0 -8px 28px rgba(15,23,42,0.14); font-family: 'Inter', system-ui, sans-serif;
          animation: sit-in .22s cubic-bezier(.22,1,.36,1); }
        @keyframes sit-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .sit-head { display: flex; align-items: center; gap: 6px; padding: 10px 10px 6px 12px; }
        .sit-chips { display: flex; gap: 6px; overflow-x: auto; flex: 1; min-width: 0; scrollbar-width: none; }
        .sit-chips::-webkit-scrollbar { display: none; }
        .sit-chip { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 11px; border-radius: 99px;
          border: 1px solid #E5E7EB; background: #fff; color: #475569; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .sit-chip[aria-pressed="true"] { border-color: #6ee7b7; background: #ECFDF5; color: #065F46; }
        .sit-chip small { font-size: 11px; color: #94a3b8; font-weight: 700; }
        .sit-icon-btn { flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; border: none; background: #F3F4F6; color: #475569;
          display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .sit-row { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 4px 12px 12px; scrollbar-width: none;
          overscroll-behavior-x: contain; }
        .sit-row::-webkit-scrollbar { display: none; }
        .sit-card { flex: 0 0 108px; scroll-snap-align: start; border: 1.5px solid #E5E7EB; border-radius: 14px; overflow: hidden; background: #fff;
          padding: 0; text-align: left; cursor: pointer; font: inherit; }
        .sit-card[aria-pressed="true"] { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.18); }
        .sit-img { width: 100%; height: 72px; object-fit: cover; display: block; background: #F0FDF4; }
        .sit-ph { width: 100%; height: 72px; display: flex; align-items: center; justify-content: center; background: #F0FDF4; color: #6ee7b7; }
        .sit-name { margin: 6px 8px 0; font-size: 12.5px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sit-price { margin: 1px 8px 7px; font-size: 12px; font-weight: 800; color: #059669; }
        .sit-empty { padding: 18px 16px 22px; font-size: 13px; color: #64748b; }
        .sit-placing { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 12px; }
        .sit-placing img, .sit-placing .ph { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: #F0FDF4; }
        .sit-placing p { margin: 0; line-height: 1.3; }
        .sit-cancel { flex-shrink: 0; min-height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid #fecaca; background: #fef2f2;
          color: #b91c1c; font-weight: 800; font-size: 13px; cursor: pointer; }
        @media (prefers-reduced-motion: reduce) { .sit { animation: none; } }
      `}</style>

      {placing ? (
        // While placing, the tray gets out of the way: one bar, the ground stays tappable
        <div className="sit-placing" role="status">
          {productImage(state.previewObject)
            ? <img src={productImage(state.previewObject)} alt="" />
            : <span className="ph" />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Placing {state.previewObject.name}
            </p>
            <p style={{ fontSize: 12.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Hand size={13} /> Tap the ground where it goes
            </p>
          </div>
          <button type="button" className="sit-cancel" onClick={() => dispatch({ type: 'CANCEL_PLACEMENT' })}>Cancel</button>
        </div>
      ) : (
        <>
          <div className="sit-head">
            <div className="sit-chips" role="group" aria-label="Category">
              {TRAY_CATEGORIES.map(({ key, label, Icon }) => (
                <button key={key} type="button" className="sit-chip" aria-pressed={category === key} onClick={() => onCategory(key)}>
                  <Icon size={14} /> {label} <small>{count(key)}</small>
                </button>
              ))}
            </div>
            <button type="button" className="sit-icon-btn" onClick={onSeeAll} aria-label="See all items and search"><LayoutGrid size={17} /></button>
            <button type="button" className="sit-icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>
          {state.products.length === 0 ? (
            <p className="sit-empty">Loading items…</p>
          ) : items.length === 0 ? (
            <p className="sit-empty">Nothing in this category yet.</p>
          ) : (
            <div className="sit-row">
              {items.map(p => {
                const img = productImage(p);
                return (
                  <button key={p.id} type="button" className="sit-card" onClick={() => pick(p)}
                    aria-pressed={state.selectedProduct?.id === p.id} aria-label={`Add ${p.name}, ${peso(p.unit_price)}`}>
                    {img ? <img className="sit-img" src={img} alt="" loading="lazy" /> : <span className="sit-ph"><Sprout size={22} /></span>}
                    <p className="sit-name">{p.name}</p>
                    <p className="sit-price">{peso(p.unit_price)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
