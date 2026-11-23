import { useEffect, useState } from 'react';
import { Smartphone, CheckCircle2, CloudUpload, AlertTriangle, WifiOff } from 'lucide-react';
import api from '../services/api';

/*
 * Office: has every crew phone sent its work? (backend crew_sync.py; the phones report from crew/syncReport.js)
 * Tells "the crew hasn't done it" apart from "it's done, still on a phone with no signal". Problems only;
 * everyone up to date is one line. Hidden when there are no field crew.
 */
const REFRESH_MS = 60000;
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');
const ago = (m) => (m == null ? '' : m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min ago` : `${Math.floor(m / 1440)} d ago`);
const sinceText = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toDateString() === new Date().toDateString() ? '' : `${d.toLocaleDateString('en-PH', { weekday: 'short' })} `;
  return ` since ${day}${clock(iso)}`;
};

const LOOK = {
  refused: { Icon: AlertTriangle, tone: 'border-red-200 bg-red-50 text-red-900' },
  unsent: { Icon: CloudUpload, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  quiet: { Icon: WifiOff, tone: 'border-slate-200 bg-slate-50 text-slate-800' },
};

function line(c) {
  if (c.state === 'refused') {
    return <><b>{c.name}</b>: {c.failed} not accepted on the phone. Ask them to open the app and check the reason.</>;
  }
  if (c.state === 'unsent') {
    return <><b>{c.name}</b>: {c.waiting} {c.waiting === 1 ? 'action' : 'actions'} waiting on the phone{sinceText(c.oldest_waiting_at)} (no signal). Last contact {ago(c.minutes_ago)}.</>;
  }
  return <><b>{c.name}</b> is on a job and hasn&apos;t been in touch for {ago(c.minutes_ago).replace(' ago', '')}: probably no signal.</>;
}

export default function CrewSyncPanel() {
  const [crew, setCrew] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/crew-sync/').then((r) => { if (alive) setCrew(r.data.crew || []); }).catch(() => {});
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  if (!crew?.length) return null;
  const problems = crew.filter((c) => LOOK[c.state]);
  const fine = crew.filter((c) => c.state === 'ok').length;
  const never = crew.filter((c) => c.state === 'never').length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="crew-sync-title">
      <h2 id="crew-sync-title" className="m-0 text-base font-extrabold text-slate-900 flex items-center gap-2">
        <Smartphone size={17} className="text-emerald-600" /> Crew phones
      </h2>
      {problems.length > 0 ? (
        <ul className="m-0 mt-3 p-0 list-none flex flex-col gap-2">
          {problems.map((c) => {
            const { Icon, tone } = LOOK[c.state];
            return (
              <li key={c.user_id} className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-snug ${tone}`}>
                <Icon size={16} className="shrink-0 mt-0.5" /><span>{line(c)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 mt-2 text-sm text-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 size={15} /> Every crew phone has sent its work.
        </p>
      )}
      {(problems.length > 0 && fine > 0) || never > 0 ? (
        <p className="m-0 mt-2 text-xs text-slate-500">
          {problems.length > 0 && fine > 0 && `${fine} other${fine === 1 ? '' : 's'} up to date. `}
          {never > 0 && `${never} ${never === 1 ? 'has' : 'have'} not opened the crew app yet.`}
        </p>
      ) : null}
    </section>
  );
}
