// Sun & shade setup in Mark your yard: which way the back of the yard faces, and how tall the house beside it is.
// With these the design engine works out the hours of direct sun at every spot (backend sun_map.py) and puts each
// plant where the light suits it. Optional: without it the whole-yard "Sun on the garden" answer is used.
// "Use my phone's compass": stand at the house, look out over the yard, hold the phone flat pointing that way.
import { useEffect, useRef, useState } from 'react';
import { Compass, Sun, X } from 'lucide-react';
import { FACINGS, HOUSE_OPTIONS, compassName } from '../data/yardSurvey';

const READ_MS = 1500;   // average the compass over this long: a single reading jumps around

const hasCompass = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  && window.matchMedia?.('(pointer: coarse)').matches;

/** Average compass heading (degrees, 0 = north) over READ_MS, or an error message. */
async function readCompass() {
  const DOE = window.DeviceOrientationEvent;
  if (typeof DOE?.requestPermission === 'function') {          // iPhone: ask first (needs a tap, which this is)
    const answer = await DOE.requestPermission().catch(() => 'denied');
    if (answer !== 'granted') throw new Error('Compass access was not allowed. Pick the direction below instead.');
  }
  return new Promise((resolve, reject) => {
    let sx = 0, sy = 0, n = 0;
    const absolute = 'ondeviceorientationabsolute' in window;
    const type = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
    const on = (e) => {
      let heading = null;
      if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;     // iPhone
      else if ((absolute || e.absolute) && typeof e.alpha === 'number') heading = 360 - e.alpha;   // Android
      if (heading == null || !Number.isFinite(heading)) return;
      const screen = window.screen?.orientation?.angle || 0;        // phone turned sideways
      const a = ((heading + screen) * Math.PI) / 180;
      sx += Math.sin(a); sy += Math.cos(a); n += 1;
    };
    window.addEventListener(type, on);
    setTimeout(() => {
      window.removeEventListener(type, on);
      if (!n) { reject(new Error("This phone didn't give a compass reading. Pick the direction below instead.")); return; }
      resolve(((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360);
    }, READ_MS);
  });
}

export default function SunSetup({ sun, onChange }) {
  const [open, setOpen] = useState(!!sun);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const set = (patch) => onChange({ facing: sun?.facing ?? 0, house: sun?.house ?? 'one', ...patch });

  const readFromCompass = async () => {
    setError(''); setReading(true);
    try {
      const deg = await readCompass();
      if (alive.current) set({ facing: Math.round(deg) });
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setReading(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-3 w-full text-left rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2.5 cursor-pointer hover:bg-amber-50">
        <span className="flex items-center gap-2 text-sm font-bold text-amber-900"><Sun size={15} /> Add sun &amp; shade</span>
        <span className="block mt-0.5 text-xs text-amber-900/70">
          Tell us which way your yard faces and we'll work out the sun at every spot, so each plant goes where the light suits it.
        </span>
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-sm font-bold text-slate-900 flex items-center gap-1.5"><Sun size={15} className="text-amber-600" /> Sun &amp; shade</p>
        <button type="button" aria-label="Remove sun and shade" onClick={() => { onChange(null); setOpen(false); setError(''); }}
          className="w-8 h-8 -mt-1 -mr-1 rounded-lg border-none bg-transparent text-slate-400 hover:text-slate-700 cursor-pointer inline-flex items-center justify-center">
          <X size={15} />
        </button>
      </div>

      <p className="m-0 mt-1 text-xs text-slate-600" id="facing-q">
        Standing at the house and looking out over the yard, which way are you facing?
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-labelledby="facing-q" className="grid grid-cols-3 gap-1 w-[132px] shrink-0">
          {Array.from({ length: 9 }, (_, i) => {
            const f = FACINGS.find(x => x.row * 3 + x.col === i);
            if (!f) {
              return <span key={i} aria-hidden="true" className="h-10 rounded-full flex items-center justify-center text-slate-300"><Compass size={18} /></span>;
            }
            const on = sun && Math.round((((sun.facing % 360) + 360) % 360) / 45) % 8 === Math.round(f.deg / 45) % 8;
            return (
              <button key={i} type="button" role="radio" aria-checked={!!on} aria-label={compassName(f.deg)}
                onClick={() => set({ facing: f.deg })}
                className={`h-10 rounded-lg border text-xs font-extrabold cursor-pointer ${on ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'}`}>
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-[10rem] text-xs text-slate-600">
          {sun ? <p className="m-0">The back of your yard faces <b className="text-slate-900">{compassName(sun.facing)}</b> ({Math.round(sun.facing)}°).</p>
            : <p className="m-0">Not sure? Open a map app: the direction from your house to the back of the yard.</p>}
          {hasCompass() && (
            <button type="button" onClick={readFromCompass} disabled={reading}
              className="mt-2 min-h-[36px] px-3 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60">
              <Compass size={14} /> {reading ? 'Hold still…' : "Use my phone's compass"}
            </button>
          )}
          {error && <p className="m-0 mt-1.5 font-semibold text-amber-700" role="alert">{error}</p>}
        </div>
      </div>

      <p className="m-0 mt-3 text-xs text-slate-600" id="house-q">How tall is the house beside the yard?</p>
      <div role="radiogroup" aria-labelledby="house-q" className="mt-1.5 flex flex-wrap gap-1.5">
        {HOUSE_OPTIONS.map(h => {
          const on = (sun?.house ?? 'one') === h.key && !!sun;
          return (
            <button key={h.key} type="button" role="radio" aria-checked={on} onClick={() => set({ house: h.key })}
              className={`min-h-[36px] px-3 rounded-lg border text-xs cursor-pointer ${on ? 'border-amber-500 bg-white text-amber-900 font-bold' : 'border-slate-200 bg-white text-slate-600'}`}>
              {h.label}
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-2 text-[11px] text-slate-500">
        We follow the sun's path over Quezon through the year, with the shadows of your house, a 1.8 m boundary wall and the trees you're keeping.
      </p>
    </div>
  );
}
