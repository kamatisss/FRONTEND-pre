import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Mountain, Sprout, SunMedium, Receipt, HardHat, ArrowRight, Sparkles, Check, Box } from 'lucide-react';
import { getInventoryItems, getEstimate } from '../services/api';
import { prefetchStudio } from '../services/prefetch';
import { SAMPLE_LOT, sampleGarden } from '../data/sampleGarden';

/*
 * Landing "how it works" told as a scroll story: photo → terrain → plants → light → estimate → crew.
 * One pinned illustration builds up chapter by chapter while the text scrolls past. It is drawn in
 * SVG (not a third WebGL canvas) so it stays smooth on any phone. The garden mirrors the hero's
 * Lush sample, and the estimate is the real /pricing/estimate/ for that garden.
 */

const CHAPTERS = [
  { key: 'photo',    Icon: Camera,    title: 'Start with your yard',
    body: 'Snap a photo of your outdoor space and upload it with a free account. No photo yet? Start on our sample yard right away.' },
  { key: 'terrain',  Icon: Mountain,  title: 'It becomes 3D ground',
    body: 'The Studio reads the slope and shape from your photo and builds terrain you can turn and look around. Set your lot size in metres.' },
  { key: 'plants',   Icon: Sprout,    title: 'Place real plants',
    body: 'Every plant comes from our own nursery, shown at its real size. Place them yourself, or let the AI lay out a garden for your budget.' },
  { key: 'light',    Icon: SunMedium, title: 'See it from sunrise to night',
    body: 'Slide through the day to check shade, catch the golden hour, and see the garden lights come on after dark.' },
  { key: 'estimate', Icon: Receipt,   title: 'Know the price as you go',
    body: 'The estimate updates with every plant you add: plants, labour, soil, site prep and delivery. No surprises when the quote comes.' },
  { key: 'crew',     Icon: HardHat,   title: 'Our crew builds it',
    body: 'Book a date and we assign a crew. They check in on site, post progress photos, and you sign off when it is done.' },
];

const CREW_STEPS = ['Date booked', 'Crew assigned', 'Checked in on site', 'Progress photos', 'You sign off'];
const AREA_SQM = SAMPLE_LOT.width * SAMPLE_LOT.length;

/* ─── The drawing: an isometric 10 m × 8 m lot (same as the hero sample) ─── */
const terrainH = (u, v) => 14 * (1 - v) * (0.7 + 0.3 * Math.sin(u * Math.PI)); // the back of the yard rises a little
function iso(x, z, lift = 0) {
  const u = x / SAMPLE_LOT.width, v = z / SAMPLE_LOT.length;
  return [200 + (u - v) * 150, 120 + (u + v) * 78 - terrainH(u, v) - lift];
}
const pts = (list) => list.map(([x, z]) => iso(x, z).map(n => n.toFixed(1)).join(',')).join(' ');
const range = (n) => Array.from({ length: n + 1 }, (_, i) => i);
const W = SAMPLE_LOT.width, L = SAMPLE_LOT.length;

const OUTLINE = [
  ...range(10).map(i => [i, 0]), ...range(8).map(j => [W, j]),
  ...range(10).map(i => [W - i, L]), ...range(8).map(j => [0, L - j]),
];
// The two sides facing the viewer, dropped 16 px, so the lot reads as a little diorama
const SIDE_EDGE = [...range(10).map(i => [i, L]), ...range(8).map(j => [W, L - j])];
const SIDE = [...SIDE_EDGE.map(([x, z]) => iso(x, z)), ...SIDE_EDGE.slice().reverse().map(([x, z]) => { const [sx, sy] = iso(x, z); return [sx, sy + 16]; })];
const GRID = [
  ...range(10).map(i => range(8).map(j => [i, j])),
  ...range(8).map(j => range(10).map(i => [i, j])),
];

// Same spots as the Lush sample garden (data/sampleGarden.js): tall back row, mid sides, low front border
const PLANTS = [
  { x: 2, z: 1.5, kind: 'tree' }, { x: 5, z: 1.2, kind: 'tree' }, { x: 8, z: 1.5, kind: 'tree' },
  { x: 1.5, z: 4, kind: 'shrub' }, { x: 8.5, z: 4, kind: 'shrub' },
  { x: 3, z: 6.5, kind: 'flower', color: '#f472b6' }, { x: 5, z: 6.8, kind: 'flower', color: '#facc15' }, { x: 7, z: 6.5, kind: 'flower', color: '#fb923c' },
].map((p, i) => ({ ...p, i, pos: iso(p.x, p.z) })).sort((a, b) => a.pos[1] - b.pos[1]);
const STONES = [[4, 7.6], [4.25, 6.85], [4.1, 6.05], [3.8, 5.3], [3.95, 4.55]];
const LAMPS = [[2.6, 7.4], [6.3, 7.3], [6, 3.4]];

/* ─── Light: the same 6:00–20:00 day as the hero and Studio sun sliders ─── */
const SKY = [
  [5.5, '#1b2747', '#3a4a76'], [6.5, '#9ec9e8', '#fde2c4'], [9, '#7cc0ec', '#dff1fb'], [13, '#6db7ea', '#e6f5fd'],
  [16.5, '#8fb8e0', '#fcd9a8'], [18.5, '#3b4a7a', '#f29d6b'], [20, '#0f1b3d', '#24345e'],
];
const hex = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => `rgb(${hex(a).map((n, i) => Math.round(n + (hex(b)[i] - n) * t)).join(',')})`;
function skyAt(h) {
  const k = SKY.findIndex(s => s[0] >= h);
  if (k <= 0) return k === 0 ? [SKY[0][1], SKY[0][2]] : [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
  const [h0, t0, b0] = SKY[k - 1], [h1, t1, b1] = SKY[k];
  const t = (h - h0) / (h1 - h0);
  return [mix(t0, t1, t), mix(b0, b1, t)];
}
const nightness = (h) => Math.min(1, Math.max(0, (h - 17.8) / 1.7));
function lightLabel(h) {
  const clock = `${((Math.floor(h) + 11) % 12) + 1}:${String(Math.floor((h % 1) * 4) * 15).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const name = h < 7.5 ? 'Sunrise' : h < 11 ? 'Morning' : h < 15 ? 'Midday' : h < 18 ? 'Golden hour' : h < 19 ? 'Dusk' : 'Night';
  return `${clock} · ${name}`;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const peso = (n) => `₱${Number(n).toLocaleString('en-PH')}`;

function Plant({ p, shown, h }) {
  const [sx, sy] = p.pos;
  const night = nightness(h);
  const shadowDx = (13 - h) * 2.4;
  const style = {
    transform: shown ? 'scale(1)' : 'scale(0)', transformOrigin: `${sx}px ${sy}px`,
    transition: `transform .55s cubic-bezier(.34,1.56,.64,1) ${shown ? p.i * 0.08 : 0}s`,
  };
  return (
    <g style={style}>
      <ellipse cx={sx + shadowDx} cy={sy + 1} rx={p.kind === 'tree' ? 16 + Math.abs(shadowDx) * 0.4 : 10} ry={p.kind === 'tree' ? 5 : 3.5}
        fill="#14532d" opacity={0.28 * (1 - night)} />
      {p.kind === 'tree' && (
        <>
          <rect x={sx - 2.5} y={sy - 22} width="5" height="22" rx="2" fill="#7c4a2a" />
          <circle cx={sx} cy={sy - 36} r="17" fill="#15803d" />
          <circle cx={sx - 8} cy={sy - 28} r="11" fill="#16a34a" />
          <circle cx={sx + 7} cy={sy - 42} r="9" fill="#22c55e" />
        </>
      )}
      {p.kind === 'shrub' && (
        <>
          <ellipse cx={sx} cy={sy - 9} rx="13" ry="10" fill="#15803d" />
          <ellipse cx={sx - 4} cy={sy - 13} rx="7" ry="6" fill="#22c55e" />
        </>
      )}
      {p.kind === 'flower' && (
        <>
          <ellipse cx={sx} cy={sy - 4} rx="11" ry="5.5" fill="#16a34a" />
          {[-7, -2, 3, 8].map((dx, k) => <circle key={k} cx={sx + dx} cy={sy - 6 - (k % 2) * 2.5} r="2.6" fill={p.color} />)}
        </>
      )}
    </g>
  );
}

function Stage({ chapter, hour }) {
  const c = chapter;
  const [skyTop, skyBottom] = skyAt(hour);
  const night = nightness(hour);
  const t = Math.min(1, Math.max(0, (hour - 6) / 13.5));
  const sun = [40 + t * 320, 122 - Math.sin(t * Math.PI) * 58]; // peaks below the chapter rail
  const fade = (on, delay = 0) => ({ opacity: on ? 1 : 0, transition: `opacity .5s ease ${on ? delay : 0}s` });
  // Chapter 1 shows the photo big; afterwards it shrinks to a corner thumbnail ("your photo")
  const photoStyle = {
    transform: c === 0 ? 'translate(0px, 0px) scale(1) rotate(-3deg)' : 'translate(-104px, -66px) scale(0.3) rotate(0deg)',
    transformOrigin: '200px 150px', transition: 'transform .7s cubic-bezier(.22,1,.36,1)',
  };

  return (
    <svg viewBox="0 0 400 300" className="ss-svg" aria-hidden="true">
      <defs>
        <linearGradient id="ss-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} /><stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id="ss-lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3d977" /><stop offset="1" stopColor="#6fbf5a" />
        </linearGradient>
        <radialGradient id="ss-glow"><stop offset="0" stopColor="#fde68a" stopOpacity=".95" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" /></radialGradient>
        <linearGradient id="ss-photo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfdbfe" /><stop offset="1" stopColor="#eff6ff" /></linearGradient>
        <clipPath id="ss-photo-clip"><rect x="92" y="62" width="216" height="150" rx="3" /></clipPath>
      </defs>

      <rect width="400" height="300" fill="url(#ss-sky)" />
      <g style={fade(c >= 3 && hour < 18.8)}><circle cx={sun[0]} cy={sun[1]} r="13" fill="#fde68a" /><circle cx={sun[0]} cy={sun[1]} r="22" fill="#fde68a" opacity=".25" /></g>
      <g style={fade(c >= 3 && night > 0.5)}><circle cx="318" cy="80" r="10" fill="#e2e8f0" /><circle cx="323" cy="76" r="9" fill={skyTop} /></g>

      {/* Terrain */}
      <g style={fade(c >= 1)}>
        <polygon points={SIDE.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')} fill="#8b5e3c" />
        <polygon points={pts(OUTLINE)} fill={c >= 2 ? 'url(#ss-lawn)' : '#e7efe3'} style={{ transition: 'fill .6s' }} />
        <g className={c >= 1 ? 'ss-grid on' : 'ss-grid'} stroke={c >= 2 ? '#ffffff' : '#059669'} strokeOpacity={c >= 2 ? 0.28 : 0.7} strokeWidth="0.9" fill="none">
          {GRID.map((line, k) => <polyline key={k} points={pts(line)} pathLength="1" />)}
        </g>
        <g style={fade(c === 1, 0.4)} fontSize="10" fontWeight="700" fill="#065f46" fontFamily="Inter, system-ui, sans-serif">
          <text x={iso(W / 2, L)[0] + 66} y={iso(W / 2, L)[1] + 30} textAnchor="middle">10 m</text>
          <text x={iso(0, L / 2)[0] - 34} y={iso(0, L / 2)[1] + 30} textAnchor="middle">8 m</text>
        </g>
      </g>

      {/* Garden */}
      <g style={fade(c >= 2)}>
        {STONES.map(([x, z], k) => { const [sx, sy] = iso(x, z); return <ellipse key={k} cx={sx} cy={sy} rx="7" ry="3.4" fill="#e7e5e4" stroke="#a8a29e" strokeWidth=".6" />; })}
        {LAMPS.map(([x, z], k) => { const [sx, sy] = iso(x, z); return <rect key={k} x={sx - 1.2} y={sy - 12} width="2.4" height="12" rx="1" fill="#334155" />; })}
      </g>
      {PLANTS.map(p => <Plant key={p.i} p={p} shown={c >= 2} h={hour} />)}

      {/* Night: darken the scene, then the path lights glow on top */}
      <rect width="400" height="300" fill="#0b1530" opacity={c >= 3 ? night * 0.55 : 0} pointerEvents="none" />
      {LAMPS.map(([x, z], k) => { const [sx, sy] = iso(x, z); return (
        <g key={k} opacity={c >= 3 ? night : 0}>
          <ellipse cx={sx} cy={sy - 4} rx="26" ry="14" fill="url(#ss-glow)" opacity=".7" />
          <circle cx={sx} cy={sy - 13} r="2.6" fill="#fef3c7" />
        </g>
      ); })}

      {/* The visitor's photo */}
      <g style={photoStyle}>
        <rect x="84" y="54" width="232" height="182" rx="6" fill="#fff" stroke="#e2e8f0" />
        <g clipPath="url(#ss-photo-clip)">
          <rect x="92" y="62" width="216" height="150" fill="url(#ss-photo-sky)" />
          <rect x="92" y="62" width="58" height="150" fill="#e5d3b3" />
          <rect x="100" y="84" width="22" height="30" fill="#94a3b8" opacity=".55" />
          {range(15).map(i => <rect key={i} x={150 + i * 11} y="108" width="9" height="48" fill={i % 2 ? '#c4a27a' : '#b8936a'} />)}
          <rect x="92" y="150" width="216" height="62" fill="#9fb878" />
          <ellipse cx="190" cy="178" rx="40" ry="9" fill="#b59a6b" opacity=".75" />
          <ellipse cx="262" cy="196" rx="30" ry="7" fill="#b59a6b" opacity=".6" />
          <ellipse cx="128" cy="200" rx="22" ry="6" fill="#86a865" />
        </g>
        <g stroke="#10b981" strokeWidth="3" fill="none" strokeLinecap="round" style={fade(c === 0)}>
          <path d="M100 82v-12h12" /><path d="M300 82v-12h-12" /><path d="M100 192v12h12" /><path d="M300 192v12h-12" />
        </g>
        <text x="200" y="228" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569" fontFamily="Inter, system-ui, sans-serif">your-yard.jpg</text>
      </g>
    </svg>
  );
}

export default function ScrollStory() {
  const [chapter, setChapter] = useState(0);
  const [hour, setHour] = useState(10.5);
  const [onScreen, setOnScreen] = useState(false);
  const [estimate, setEstimate] = useState(null); // real estimate for the sample garden, when the catalog allows one
  const sectionRef = useRef(null);
  const chapterRefs = useRef([]);
  const fetched = useRef(false);

  // The chapter crossing the middle of the screen drives the picture
  useEffect(() => {
    if (!window.IntersectionObserver) return undefined;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setChapter(Number(e.target.dataset.chapter)); });
    }, { rootMargin: '-55% 0px -40% 0px' });
    chapterRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Fetch the estimate shortly before the section arrives; animate only while it is on screen
  useEffect(() => {
    if (!sectionRef.current || !window.IntersectionObserver) return undefined;
    const io = new IntersectionObserver(([e]) => {
      setOnScreen(e.isIntersecting);
      if (e.isIntersecting && !fetched.current) {
        fetched.current = true;
        getInventoryItems('plant')
          .then(list => {
            const counts = {};
            sampleGarden(list, 'lush').forEach(s => { counts[s.plant_id] = (counts[s.plant_id] || 0) + 1; });
            const items = Object.entries(counts).map(([product_id, quantity]) => ({ product_id: Number(product_id), quantity }));
            return items.length ? getEstimate(items, AREA_SQM) : null;
          })
          .then(est => { if (est?.total > 0) setEstimate(est); })
          .catch(() => { /* the chapter reads fine without numbers */ });
      }
    }, { rootMargin: '400px 0px' });
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  // Chapter 4 plays a day from sunrise to night; other chapters hold a fixed light
  useEffect(() => {
    if (chapter !== 3) { setHour(chapter > 3 ? 16.5 : 10.5); return undefined; }
    if (reducedMotion() || !onScreen) { setHour(19.5); return undefined; }
    let raf, start, shown = null;
    const DAY_MS = 9000;
    const tick = (now) => {
      start ??= now;
      const t = ((now - start) % (DAY_MS + 1200)) / DAY_MS; // a short pause at night before the next sunrise
      // Redraw in 0.1 h steps (~15 a second) rather than every frame: the light still glides, and
      // phones keep the main thread free for scrolling
      const next = Math.round((6 + Math.min(1, t) * 14) * 10) / 10;
      if (next !== shown) { shown = next; setHour(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chapter, onScreen]);

  const goTo = (i) => chapterRefs.current[i]?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  const lines = useMemo(() => (estimate ? estimate.lines.filter(l => l.amount > 0).slice(0, 4) : []), [estimate]);

  return (
    <section id="how-it-works" ref={sectionRef} className="ss">
      <style>{`
        .ss { padding: clamp(64px, 9vw, 110px) 0 clamp(56px, 8vw, 96px); background: #fff; }
        .ss-grid-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 56px; align-items: start; }
        .ss-stage-wrap { position: sticky; top: 104px; order: 2; }
        .ss-stage { position: relative; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0;
          box-shadow: 0 24px 60px rgba(15,23,42,0.12); background: #eaf4fb; aspect-ratio: 4 / 3; }
        .ss-svg { display: block; width: 100%; height: 100%; }
        .ss-grid polyline { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.1s ease .15s; }
        .ss-grid.on polyline { stroke-dashoffset: 0; }
        .ss-rail { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; pointer-events: none; }
        .ss-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; background: rgba(2,6,23,0.78);
          color: #fff; font-size: 12px; font-weight: 700; white-space: nowrap; min-width: 0; overflow: hidden; }
        .ss-dots { display: flex; gap: 4px; pointer-events: auto; flex-shrink: 0; }
        .ss-dots button { width: 22px; height: 24px; padding: 0; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ss-dots span { width: 8px; height: 8px; border-radius: 99px; background: rgba(255,255,255,0.6); box-shadow: 0 0 0 1px rgba(2,6,23,0.25); transition: width .3s, background .3s; }
        .ss-dots button[aria-current="step"] span { width: 20px; background: #10b981; }
        .ss-card { position: absolute; right: 12px; bottom: 12px; width: min(260px, calc(100% - 24px)); padding: 14px 16px; border-radius: 16px;
          background: rgba(255,255,255,0.96); box-shadow: 0 12px 32px rgba(15,23,42,0.18); transition: opacity .45s, transform .45s cubic-bezier(.22,1,.36,1); }
        .ss-card[data-on="false"] { opacity: 0; transform: translateY(14px); pointer-events: none; }
        .ss-card h4 { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #059669; }
        .ss-line { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #475569; padding: 3px 0; }
        .ss-line b { color: #0f172a; font-variant-numeric: tabular-nums; }
        .ss-total { margin-top: 6px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .ss-total span { font-size: 12px; color: #475569; font-weight: 600; }
        .ss-total b { font-size: 17px; font-weight: 900; color: #065f46; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ss-skel { height: 9px; border-radius: 4px; background: #e2e8f0; width: 34%; align-self: center; }
        .ss-crew { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
        .ss-crew li { display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 600; color: #334155; }
        .ss-crew .tick { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          background: #e2e8f0; color: #fff; transition: background .3s; }
        .ss-crew li.done .tick { background: #10b981; }
        .ss-text { order: 1; }
        .ss-chapter { min-height: 62vh; display: flex; flex-direction: column; justify-content: center; padding: 24px 0; }
        .ss-chapter:first-child { min-height: 40vh; justify-content: flex-start; padding-top: 8vh; }
        .ss-chapter-inner { transition: opacity .4s; }
        .ss-chapter[data-active="false"] .ss-chapter-inner { opacity: .38; }
        .ss-num { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #059669; margin-bottom: 12px; }
        .ss-num i { width: 34px; height: 34px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; justify-content: center; font-style: normal; }
        .ss-chapter h3 { font-size: clamp(22px, 2.4vw, 30px); font-weight: 900; letter-spacing: -0.5px; color: #0f172a; margin: 0 0 10px; line-height: 1.2; }
        .ss-chapter p { font-size: 16px; color: #475569; line-height: 1.7; margin: 0; max-width: 460px; }
        .ss-note { margin-top: 10px !important; font-size: 14px !important; color: #065f46 !important; font-weight: 600; }
        .ss-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
        .ss-primary { display: inline-flex; align-items: center; gap: 8px; padding: 15px 26px; border-radius: 100px; background: #10b981; color: #fff; font-weight: 800; text-decoration: none; box-shadow: 0 8px 30px rgba(16,185,129,0.35); }
        .ss-primary:hover { background: #059669; }
        .ss-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 15px 22px; border-radius: 100px; border: 1.5px solid #cbd5e1; color: #0f172a; font-weight: 700; text-decoration: none; }
        .ss-secondary:hover { border-color: #10b981; color: #047857; }
        @media (max-width: 900px) {
          .ss-grid-layout { grid-template-columns: 1fr; gap: 0; }
          /* Phones: the picture pins under the navbar and the chapters scroll up beneath it */
          .ss-stage-wrap { order: 0; top: calc(var(--site-nav-h, 60px) - 8px); z-index: 2; background: #fff; padding: 16px 0 10px; margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
          .ss-stage { max-height: 42vh; margin: 0 auto; border-radius: 18px; }
          .ss-text { order: 1; }
          .ss-chapter, .ss-chapter:first-child { min-height: 44vh; padding: 28px 0; justify-content: flex-start; }
          .ss-chapter:last-child { min-height: 52vh; }
          /* Phones: the estimate card shrinks to its total (the full sentence is in the chapter text) */
          .ss-card { padding: 9px 12px; width: auto; left: 10px; right: 10px; bottom: 10px; }
          .ss-card .ss-line { display: none; }
          .ss-card h4 { margin-bottom: 2px; font-size: 10px; }
          .ss-total { margin-top: 0; padding-top: 0; border-top: none; }
          .ss-total b { font-size: 15px; }
          .ss-crew { grid-template-columns: 1fr 1fr; }
          .ss-crew li { font-size: 12px; } .ss-crew { gap: 4px; }
          .ss-pill .ss-pill-text { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ss *, .ss-grid polyline { transition: none !important; }
        }
      `}</style>

      <div className="gs-container">
        <div className="gs-section-header">
          <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>How it works</div>
          <h2 className="gs-section-title">From a photo to a finished garden</h2>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 520, margin: '12px auto 0', lineHeight: 1.65 }}>
            Scroll to watch a garden come together, the same way yours will.
          </p>
        </div>

        <div className="ss-grid-layout">
          <div className="ss-stage-wrap">
            <div className="ss-stage">
              <Stage chapter={chapter} hour={hour} />

              <div className="ss-rail">
                <span className="ss-pill">
                  {chapter === 3
                    ? <><SunMedium size={13} /> {lightLabel(hour)}</>
                    : <>{chapter + 1} / {CHAPTERS.length}<span className="ss-pill-text"> · {CHAPTERS[chapter].title}</span></>}
                </span>
                <div className="ss-dots" role="group" aria-label="Story chapters">
                  {CHAPTERS.map((ch, i) => (
                    <button key={ch.key} onClick={() => goTo(i)} aria-label={ch.title} aria-current={i === chapter ? 'step' : undefined}><span /></button>
                  ))}
                </div>
              </div>

              <div className="ss-card" data-on={chapter === 4} aria-hidden="true">
                <h4>Estimate · this garden</h4>
                {estimate ? lines.map(l => (
                  <div key={l.key} className="ss-line"><span>{l.label.replace(/ \(.*\)$/, '')}</span><b>{peso(l.amount)}</b></div>
                )) : ['Plants', 'Labour', 'Site preparation'].map(t => (
                  <div key={t} className="ss-line"><span>{t}</span><span className="ss-skel" /></div>
                ))}
                {estimate && (
                  <div className="ss-total"><span>Installed</span><b>{peso(estimate.low)} – {peso(estimate.high)}</b></div>
                )}
              </div>

              <div className="ss-card" data-on={chapter === 5} aria-hidden="true">
                <h4>Your project</h4>
                <ul className="ss-crew">
                  {CREW_STEPS.map((s, i) => (
                    <li key={s} className={chapter === 5 && i < 4 ? 'done' : ''} style={{ transitionDelay: `${i * 0.25}s` }}>
                      <span className="tick" style={{ transitionDelay: `${0.2 + i * 0.3}s` }}><Check size={12} strokeWidth={3} /></span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <ol className="ss-text" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {CHAPTERS.map((ch, i) => (
              <li key={ch.key} ref={el => { chapterRefs.current[i] = el; }} data-chapter={i} data-active={i === chapter} className="ss-chapter">
                <div className="ss-chapter-inner">
                  <div className="ss-num"><i><ch.Icon size={17} /></i> Step {i + 1}</div>
                  <h3>{ch.title}</h3>
                  <p>{ch.body}</p>
                  {ch.key === 'estimate' && estimate && (
                    <p className="ss-note">
                      This sample garden ({SAMPLE_LOT.width} m × {SAMPLE_LOT.length} m, 8 plants): about {peso(estimate.low)} – {peso(estimate.high)} installed
                      {estimate.is_sample_rates ? ', at sample rates' : ''}.
                    </p>
                  )}
                  {ch.key === 'crew' && (
                    <div className="ss-actions" style={{ marginTop: 24 }}>
                      <Link to="/try-studio" className="ss-primary" onPointerEnter={prefetchStudio} onFocus={prefetchStudio} onTouchStart={prefetchStudio}>
                        <Box size={18} /> Start designing free <ArrowRight size={16} />
                      </Link>
                      <Link to="/ai-designer" className="ss-secondary"><Sparkles size={16} /> Let AI design it</Link>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
