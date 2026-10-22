import { useLocation } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { applyUpdate } from '../../pwa/pwa';
import { useOnline, usePwa } from '../../pwa/usePwa';

/*
 * App-wide PWA notices, under the top navigation:
 *   - "New version available — Refresh" after a deploy (nothing switches until the person taps it,
 *     so no one loses what they're typing)
 *   - "You're offline" (crew screens have their own, more specific banner)
 */
export default function PwaStatus() {
  const { updateReady } = usePwa();
  const online = useOnline();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const crewScreen = user?.staff_role === 'FIELD_CREW' && pathname.startsWith('/staff-dashboard');
  const showOffline = !online && !crewScreen;
  if (!updateReady && !showOffline) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[250] flex flex-col items-center gap-2 w-[calc(100%-32px)] max-w-md pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 76px)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {showOffline && (
        <p role="status" className="m-0 pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900 text-white text-sm font-semibold px-4 py-2 shadow-lg">
          <WifiOff size={16} className="shrink-0" /> You're offline. Some pages may be out of date.
        </p>
      )}
      {updateReady && (
        <div role="status" className="pointer-events-auto w-full flex items-center gap-3 rounded-2xl bg-white border border-slate-200 shadow-xl px-4 py-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><RefreshCw size={17} /></span>
          <span className="flex-1 min-w-0 text-sm text-slate-700"><b className="text-slate-900">New version available.</b> Refresh to get the latest.</span>
          <button type="button" onClick={applyUpdate}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold border-none cursor-pointer shrink-0">
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
