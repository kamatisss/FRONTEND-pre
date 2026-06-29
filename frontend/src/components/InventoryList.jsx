import { useDesign } from '../context/DesignContext';
import {
  ClipboardList, Pencil, Trash2, MousePointer, Upload, ArrowDownToLine,
  Move, Keyboard
} from 'lucide-react';

export default function InventoryList() {
  const { state, dispatch } = useDesign();
  const { placedItems, selectedItemId, placementMode } = state;
  const isPlacing = placementMode !== 'idle';

  const plantCounts = placedItems.reduce((acc, item) => {
    const key = item.name || item.modelType;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const handleEdit = (itemId) => {
    if (isPlacing) return;
    dispatch({ type: 'START_EDITING', payload: itemId });
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-5 mt-4 font-sans flex flex-col max-h-[400px]">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center mb-4 shrink-0">
        <ClipboardList size={18} className="mr-2 text-emerald-500" />
        Placed Items
      </h3>

      {placedItems.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 mb-4">No items placed yet</p>
      ) : (
        <div className="overflow-y-auto pr-1 custom-scrollbar flex-1 mb-4 space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Summary</h4>
            {Object.entries(plantCounts).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center text-sm py-1">
                <span className="text-slate-700 dark:text-slate-300 truncate pr-2 max-w-[150px]">{type}</span>
                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">×{count}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Items ({placedItems.length})</h4>
            <div className="space-y-1.5">
              {placedItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex justify-between items-center p-2 rounded-lg text-sm border transition-all duration-200 ${
                    selectedItemId === item.id 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-500/50' 
                      : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-200 cursor-pointer'
                  }`}
                  onClick={() => !isPlacing && dispatch({ type: 'SELECT_ITEM', payload: item.id })}
                >
                  <span className="flex items-center text-slate-700 dark:text-slate-200 truncate pr-2">
                    <span className="text-slate-400 mr-1.5">#{index + 1}</span>
                    {item.autoDetected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 shrink-0">
                        <rect width="18" height="10" x="3" y="11" rx="2"/>
                        <circle cx="12" cy="16" r="1"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                      </svg>
                    )}
                    <span className="truncate max-w-[100px]">{item.name}</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item.id);
                      }}
                      title="Move object"
                      disabled={isPlacing}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'REMOVE_ITEM', payload: item.id });
                      }}
                      title="Delete object"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mt-auto shrink-0">
        <h4 className="flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
          <Keyboard size={14} className="mr-1.5" />
          Controls
        </h4>
        <ol className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 space-y-1.5 leading-tight">
          <li className="flex items-start">
            <Upload size={12} className="mr-1.5 mt-0.5 shrink-0" />
            <span>Upload a garden image</span>
          </li>
          <li className="flex items-start">
            <MousePointer size={12} className="mr-1.5 mt-0.5 shrink-0" />
            <span>Select an asset to enter preview mode</span>
          </li>
          <li className="flex items-start">
            <Move size={12} className="mr-1.5 mt-0.5 shrink-0" />
            <span>Move mouse to position the object</span>
          </li>
          <li className="flex items-start">
            <ArrowDownToLine size={12} className="mr-1.5 mt-0.5 shrink-0" />
            <span>Click Confirm or press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[9px]">Enter</kbd></span>
          </li>
          <li className="flex items-start">
            <Pencil size={12} className="mr-1.5 mt-0.5 shrink-0" />
            <span>Click object → Edit to re-position</span>
          </li>
          <li className="flex items-start">
            <Trash2 size={12} className="mr-1.5 mt-0.5 shrink-0" />
            <span>Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[9px]">Delete</kbd> to remove selected</span>
          </li>
          <li className="pl-4">Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[9px]">Esc</kbd> to cancel / deselect</li>
        </ol>
      </div>
    </div>
  );
}