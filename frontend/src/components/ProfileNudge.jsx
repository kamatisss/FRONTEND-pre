// Customer dashboard: "Finish your account" — a mobile number and a saved address make every checkout and
// booking one step shorter (services/me.js fills them in). Hidden once both are there, or when dismissed
// (remembered on this device only: it's a convenience, not a setting).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useMe } from '../services/me';
import { listAddresses } from '../services/api';

const dismissKey = (id) => `profile_nudge_dismissed_${id}`;
const wasDismissed = (id) => { try { return localStorage.getItem(dismissKey(id)) === '1'; } catch { return false; } };

export default function ProfileNudge() {
  const me = useMe();
  const [addresses, setAddresses] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { listAddresses().then(setAddresses).catch(() => setAddresses(null)); }, []);

  if (!me || me.role !== 'customer' || addresses === null || dismissed || wasDismissed(me.id)) return null;
  const steps = [
    { done: !!me.phone, text: 'Add your mobile number', why: 'so our crew and riders can reach you', to: '/account' },
    { done: addresses.length > 0, text: 'Save your home address', why: 'with a map pin, picked for you at checkout', to: '/account?tab=addresses' },
  ];
  const left = steps.filter(s => !s.done);
  if (!left.length) return null;
  const dismiss = () => {
    try { localStorage.setItem(dismissKey(me.id), '1'); } catch { /* still hidden for this visit */ }
    setDismissed(true);
  };

  return (
    <section className="relative rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5" aria-labelledby="profile-nudge-title">
      <button type="button" onClick={dismiss} aria-label="Hide this"
        className="absolute top-2 right-2 w-9 h-9 rounded-lg border-none bg-transparent text-slate-400 hover:text-slate-700 hover:bg-white/70 cursor-pointer inline-flex items-center justify-center">
        <X size={16} />
      </button>
      <h2 id="profile-nudge-title" className="m-0 pr-8 text-base font-extrabold text-slate-900">Finish your account</h2>
      <p className="m-0 mt-0.5 text-sm text-slate-600">We fill these in for you every time you order plants or book a service.</p>
      <ul className="m-0 mt-3 pl-0 list-none flex flex-col gap-2">
        {steps.map(s => (
          <li key={s.text}>
            {s.done ? (
              <span className="flex items-center gap-2 text-sm text-slate-500 line-through"><CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> {s.text}</span>
            ) : (
              <Link to={s.to} className="flex items-center gap-2 text-sm no-underline text-slate-800 hover:text-emerald-800 min-h-[32px]">
                <Circle size={18} className="text-slate-300 shrink-0" />
                <span><b>{s.text}</b> <span className="text-slate-500">{s.why}</span></span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
