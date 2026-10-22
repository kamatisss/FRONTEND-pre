import { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useInstall } from '../pwa/useInstall';
import { IosInstallSteps } from './ui/InstallAppSheet';

/*
 * "Install Garden Studio" card on the crew "Me" tab and the customer dashboard (opens full-screen,
 * works on weak signal, and on iPhone it's needed for job alerts). Hidden once installed, or for
 * 14 days after "Not now". The account menu has the same action for everyone (TopNavbar).
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
  const { available, ios, install } = useInstall();
  const [hidden, setHidden] = useState(dismissedRecently);
  const [iosSteps, setIosSteps] = useState(false);
  if (!available || hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* fine: it shows again next time */ }
    setHidden(true);
  };
  const onInstall = async () => {
    const outcome = await install();
    if (outcome === 'steps') setIosSteps(true);
    if (outcome === 'accepted') setHidden(true);
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
        <div className="mt-4"><IosInstallSteps /></div>
      ) : (
        <button type="button" onClick={onInstall}
          className="mt-4 h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none cursor-pointer inline-flex items-center gap-2">
          <Download size={17} /> {ios ? 'Show me how' : 'Install app'}
        </button>
      )}
    </section>
  );
}
