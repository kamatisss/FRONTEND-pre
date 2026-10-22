import { useEffect, useState } from 'react';
import { BellRing, BellOff, Smartphone, Share, Send } from 'lucide-react';
import { pushState, enablePush, disablePush, syncPush, sendTestPush } from '../services/push';

/*
 * Crew home: turn on phone alerts for new jobs, date changes and deliveries (Web Push), with a
 * plain-language way forward for every case (iPhone not installed, blocked, server not set up).
 */

const COPY = {
  off: {
    title: 'Get job alerts on this phone',
    text: 'A ping when you are assigned a job, a date changes, or a delivery is added, even when the app is closed.',
  },
  on: { title: 'Job alerts are on for this phone', text: 'New jobs, date changes and deliveries will pop up here.' },
  denied: {
    title: 'Alerts are blocked for this site',
    text: 'Allow notifications for Garden Studio in your browser\'s site settings (the lock icon next to the address), then come back.',
  },
  'ios-install': {
    title: 'On iPhone, add Garden Studio to your Home Screen first',
    text: 'In Safari tap Share, then "Add to Home Screen". Open Garden Studio from the new icon and turn alerts on there.',
  },
  unsupported: { title: 'This browser can\'t show alerts', text: 'Use Chrome on Android, or Safari on iPhone (added to the Home Screen).' },
  insecure: { title: 'Alerts need a secure address', text: 'Open Garden Studio from its https:// address to turn alerts on.' },
};

// onlyIfActionable: show only when the crew member can do something here (Today screen)
export default function PushAlertsCard({ onlyIfActionable = false }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    pushState().then(s => { if (alive) setState(s); });
    syncPush();   // keep this phone's subscription attached to whoever is signed in
    return () => { alive = false; };
  }, []);

  // Nothing to show while checking, or when the server has no push keys (the bell and email still work)
  if (state === 'loading' || state === 'server-off') return null;
  if (onlyIfActionable && !['off', 'ios-install'].includes(state)) return null;
  const copy = COPY[state] || COPY.unsupported;

  const run = async (fn, done) => {
    setBusy(true); setNote('');
    try {
      const next = await fn();
      if (typeof next === 'string') setState(next);
      if (done) setNote(done(next));
    } catch {
      setNote('That did not work. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const on = state === 'on';
  const Icon = on ? BellRing : state === 'off' ? Smartphone : state === 'ios-install' ? Share : BellOff;

  return (
    <div className={`rounded-2xl border p-4 flex gap-3 items-start ${on ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
        <Icon size={19} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm m-0">{copy.title}</p>
        <p className="text-xs text-slate-600 mt-1 mb-0 leading-relaxed">{copy.text}</p>
        {(state === 'off' || on) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {state === 'off' && (
              <button type="button" disabled={busy} onClick={() => run(enablePush, s => (s === 'denied' ? 'You chose Block. See the steps above to allow alerts.' : ''))}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-60">
                {busy ? 'Turning on…' : 'Turn on job alerts'}
              </button>
            )}
            {on && (
              <>
                <button type="button" disabled={busy}
                  onClick={() => run(async () => { const r = await sendTestPush(); return r.sent ? undefined : 'off'; },
                    () => 'Test sent. It should pop up in a few seconds.')}
                  className="min-h-[40px] px-4 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 text-sm font-bold border border-emerald-300 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60">
                  <Send size={14} /> Send a test
                </button>
                <button type="button" disabled={busy} onClick={() => run(disablePush)}
                  className="min-h-[40px] px-4 rounded-xl bg-transparent hover:bg-white text-slate-600 text-sm font-semibold border border-transparent cursor-pointer disabled:opacity-60">
                  Turn off
                </button>
              </>
            )}
          </div>
        )}
        {note && <p className="text-xs font-semibold text-emerald-800 mt-2 mb-0" role="status">{note}</p>}
      </div>
    </div>
  );
}
