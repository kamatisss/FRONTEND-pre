import { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { isIos, promptInstall } from '../pwa/pwa';
import { usePwa } from '../pwa/usePwa';

/*
 * "Install Garden Studio" — puts the app on the home screen (opens full-screen, works on weak signal,
 * and on iPhone it is required for job alerts). Hidden once installed, or after "Not now".
 *   Android / desktop Chrome: one tap (the browser's own install prompt)
 *   iPhone / iPad Safari: a two-step how-to (Apple has no install button)
 */
const DISMISS_KEY = 'installCardDismissedAt';
const DISMISS_DAYS = 14;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch { return false; }
}

export default function InstallAppCard({ reason = 'Opens full-screen like an app and loads faster on weak signal.' }) {
  const { installEvent, installed } = usePwa();
  const [hidden, setHidden] = useState(dismissedRecently);
  const [iosSteps, setIosSteps] = useState(false);
  const ios = isIos();
  if (installed || hidden || (!installEvent && !ios)) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* fine: it shows again next time */ }
    setHidden(true);
  };
  const install = async () => {
    if (ios) { setIosSteps(true); return; }
    if (await promptInstall() === 'accepted') setHidden(true);
  };

  return (
    <section aria-label="Install the app" className="relative bg-white border border-emerald-200 rounded-2xl p-4 md:p-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <button type="button" onClick={dismiss} aria-label="Not now"
        className="absolute top-2 right-2 w-9 h-9 rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center">
        <X size={18} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Smartphone size={20} /></span>
        <div className="min-w-0">
          <p className="m-0 font-bold text-slate-900 text-[15px]">Install Garden Studio</p>
          <p className="m-0 mt-0.5 text-sm text-slate-600">{reason}</p>
        </div>
      </div>
      {iosSteps ? (
        <ol className="m-0 mt-4 pl-0 list-none flex flex-col gap-2 text-sm text-slate-700">
          <li className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            In Safari, tap <Share size={16} className="text-sky-600 shrink-0" aria-label="the Share button" /> <b>Share</b> at the bottom of the screen.</li>
          <li className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
            Choose <PlusSquare size={16} className="shrink-0" aria-hidden="true" /> <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li className="text-xs text-slate-500 pl-8">Using Chrome on iPhone? Open this page in Safari first.</li>
        </ol>
      ) : (
        <button type="button" onClick={install}
          className="mt-4 h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none cursor-pointer inline-flex items-center gap-2">
          <Download size={17} /> {ios ? 'Show me how' : 'Install app'}
        </button>
      )}
    </section>
  );
}
