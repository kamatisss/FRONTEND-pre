import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, EyeOff, Link2, Loader2, Share2, X } from 'lucide-react';
import useDialog from './ui/useDialog';

/*
 * "Share this design" from the AI Designer.
 * sheet: { status: 'working' | 'ready' | 'error', url?, name?, message? }
 * The phone's share sheet (Messenger, Viber…) opens from the "Send" tap itself: browsers only allow it
 * straight after a tap, and making the link first takes a moment.
 */
export default function ShareDesignDialog({ sheet, onClose, onStop, onRetry }) {
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const busy = sheet?.status === 'working' || stopping;
  const ref = useDialog(!!sheet, onClose, { busy });
  if (!sheet) return null;

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const text = `Here's the garden design "${sheet.name}" I made. Turn it around in 3D:`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sheet.url);
    } catch {
      // Older browsers / blocked clipboard: select the text so a long-press or Ctrl+C works
      document.getElementById('share-design-url')?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const send = () => navigator.share({ title: sheet.name, text, url: sheet.url }).catch(() => {});
  const stop = async () => {
    setStopping(true);
    try { await onStop(); } finally { setStopping(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      onClick={() => { if (!busy) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="share-design-title" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 outline-none"
        style={{ fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id="share-design-title" className="m-0 text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Link2 size={19} className="text-emerald-600" /> Share this design
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            className="w-9 h-9 -mt-1 -mr-1 rounded-xl border-none bg-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center disabled:opacity-40">
            <X size={19} />
          </button>
        </div>

        {sheet.status === 'working' && (
          <p className="m-0 py-6 text-slate-500 flex items-center justify-center gap-2" role="status">
            <Loader2 size={18} className="animate-spin" /> Making your link…
          </p>
        )}

        {sheet.status === 'error' && (
          <div role="alert">
            <p className="m-0 mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{sheet.message}</p>
            <button type="button" onClick={onRetry}
              className="w-full min-h-[46px] rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">
              Try again
            </button>
          </div>
        )}

        {sheet.status === 'ready' && (
          <>
            <p className="m-0 mb-4 text-sm text-slate-600 leading-relaxed">
              Anyone with this link can turn <strong>{sheet.name}</strong> around in 3D and see the plant list and the
              estimate. They can't change it. Your yard photo isn't included. It's also saved in your account.
            </p>
            <div className="flex gap-2 mb-3">
              <input id="share-design-url" readOnly value={sheet.url} aria-label="Share link"
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 px-3 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-400" />
              <button type="button" onClick={copy}
                className="shrink-0 min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 text-slate-700 font-bold text-sm cursor-pointer flex items-center gap-1.5">
                {copied ? <><Check size={16} className="text-emerald-600" /> Copied</> : <><Copy size={16} /> Copy</>}
              </button>
            </div>
            <span className="sr-only" role="status">{copied ? 'Link copied' : ''}</span>
            {canNativeShare && (
              <button type="button" onClick={send}
                className="w-full min-h-[48px] mb-3 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center justify-center gap-2">
                <Share2 size={17} /> Send with Messenger, Viber…
              </button>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-emerald-700">
                See what they'll see
              </a>
              <button type="button" onClick={stop} disabled={stopping}
                className="text-sm font-semibold text-slate-500 hover:text-red-600 bg-transparent border-none cursor-pointer flex items-center gap-1.5 px-0 disabled:opacity-50">
                <EyeOff size={15} /> {stopping ? 'Stopping…' : 'Stop sharing'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
