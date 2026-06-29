import React from 'react';
import { ShoppingCart, Leaf, Box, Sofa } from 'lucide-react';

const CATEGORY_ICONS = {
  plant: Leaf,
  hardscape: Box,
  furniture: Sofa,
};

const CATEGORY_COLORS = {
  plant:      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  hardscape:  'bg-amber-100   text-amber-600   dark:bg-amber-900/40   dark:text-amber-400',
  furniture:  'bg-sky-100     text-sky-600     dark:bg-sky-900/40     dark:text-sky-400',
};

export default function AssetCard({ product, isSelected, onClick }) {
  const CatIcon  = CATEGORY_ICONS[product.category]  || Leaf;
  const catColor = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.plant;
  const price    = Number(product.unit_price).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      onClick={() => onClick(product)}
      className={`
        group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-300 select-none bg-white
        border border-gray-200
        ${isSelected
          ? 'ring-2 ring-emerald-500 shadow-lg'
          : 'hover:shadow-lg hover:border-emerald-200'}
      `}
    >
      {/* ── Product Image ── */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-50 border-b border-gray-50">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
            <CatIcon size={32} strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Preview</span>
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      {/* ── Product Info ── */}
      <div className="flex flex-col p-3 pb-4">
        <p className="text-sm font-bold text-gray-800 truncate mb-1" title={product.name}>
          {product.name}
        </p>
        
        {product.stock_quantity !== undefined && (
          <p className="text-[11px] font-bold text-gray-400 truncate mb-2 uppercase tracking-tight">
            {product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Restocking soon'}
          </p>
        )}
        
        <p className="text-sm font-black text-emerald-600">
          ₱{price}
        </p>
      </div>
    </div>
  );
}
