import { useDesign } from '../context/DesignContext';
import { Wallet } from 'lucide-react';

export default function CostEstimation() {
  const { totalCost, costBreakdown, state } = useDesign();

  if (state.placedItems.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-5 mt-4 font-sans">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center mb-3">
          <Wallet size={18} className="mr-2 text-amber-500" />
          Cost Estimate
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
          Place items to see cost breakdown
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-5 mt-4 font-sans">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center mb-4">
        <Wallet size={18} className="mr-2 text-amber-500" />
        Cost Estimate
      </h3>

      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
        {costBreakdown.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2 max-w-[120px]">{item.name}</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">×{item.quantity}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">₱{item.subtotal.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700 w-full mb-4" />

      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">Total Estimated Cost</span>
        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">₱{totalCost.toLocaleString()}</span>
      </div>

      <p className="text-[10px] text-slate-400 text-center">* Prices in Philippine Peso (₱) and are subject to change.</p>
    </div>
  );
}
