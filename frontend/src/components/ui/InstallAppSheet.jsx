import { useEffect } from 'react';
import { Share, PlusSquare, X, Smartphone } from 'lucide-react';

/* iPhone / iPad: Apple has no install button, so these two steps are the way (Safari only). */
export function IosInstallSteps() {
  const step = 'w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0';
  return (
    <ol className="m-0 pl-0 list-none flex flex-col gap-2.5 text-sm text-slate-700">
      <li className="flex items-center gap-2"><span className={step}>1</span>
        <span>In Safari, tap <Share size={16} className="inline -mt-0.5 text-sky-600" aria-label="the Share button" /> <b>Share</b> (bottom of the screen).</span></li>
      <li className="flex items-center gap-2"><span className={step}>2</span>
        <span>Choose <PlusSquare size={16} className="inline -mt-0.5" aria-hidden="true" /> <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
      <li className="text-xs text-slate-500 pl-8">Using Chrome on iPhone? Open this page in Safari first.</li>
    </ol>
  );
}

/* Bottom sheet (phones) / dialog (desktop) with the iPhone install steps. */
export default function InstallAppSheet({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Install Garden Studio"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-3 mb-4">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Smartphone size={20} /></span>
          <div className="flex-1 min-w-0">
            <h2 className="m-0 text-lg font-extrabold text-slate-900">Install Garden Studio</h2>
            <p className="m-0 mt-0.5 text-sm text-slate-500">Opens full-screen from your home screen, like an app.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-10 h-10 -mt-1 -mr-1 rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center">
            <X size={20} />
          </button>
        </div>
        <IosInstallSteps />
      </div>
    </div>
  );
}
