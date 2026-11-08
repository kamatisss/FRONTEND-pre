import React, { useState, useEffect, useRef, useMemo } from 'react';
import { evaluatePlantCompatibility } from '../data/plantCompatibility';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ArrowLeft, Check, Compass, ShieldAlert, Upload, X, CalendarPlus, Info, Cpu, Wrench, RefreshCw, Box, ChevronLeft, ChevronRight, Leaf, Sun, CloudSun, Cloud, Droplet, Undo2, RotateCcw, Pencil, AlertTriangle, Wand2, Plus, FlipHorizontal2 } from 'lucide-react';
import { productImage } from '../data/productImage';
import ZonePicker from './ZonePicker';
import BudgetPicker from './BudgetPicker';
import PageHero from './ui/PageHero';
import { color, cardStyle, inputStyle, labelStyle, radius } from './ui/tokens';
import { useCart } from '../context/CartContext';
import { lotPlantsToStudioItems } from '../data/sampleGarden';
import { API_BASE_URL as API_ROOT } from '../config';
import { plantBudgetFromAllIn, itemCostToCustomer } from '../data/pricing';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import { useDesign } from '../context/DesignContext';
import { getInventoryItems, getPricing } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { saveGuestDesign, loadGuestDesign, clearGuestDesign, saveAiSession, loadAiSession, clearAiSession, loadAiPrefill, clearAiPrefill } from '../services/guestSession';
import GuestAuthModal from './GuestAuthModal';
import { useIsPhone, useMediaQuery } from './ui/useMediaQuery';
import { DEFAULT_TIME_OF_DAY } from '../data/studioLight';
import { defaultPins } from '../data/photoPose';
import { readFocal35 } from '../data/photoExif';
import { LOT_MAX } from '../data/lot';
import { DEFAULT_GROWTH_STAGE } from '../data/modelSizing';
import GrowthStagePicker from './GrowthStagePicker';
import { editSummary } from '../data/designEdits';
import { mirrorEdit } from '../data/mirrorEdit';

const LOADING_PHASES = [
  'Analyzing your garden space…',
  'Composing Symmetrical layout…',
  'Composing Minimalist layout…',
  'Composing Lush / Organic layout…',
  'Balancing flora and budget…',
  'Finalizing your garden options…',
];

// Garden features the AI Designer places (mirrors garden_ai.FEATURE_CATEGORIES / MAX_SEATS / MAX_ROCKS)
const FEATURE_KIND = { furniture: 'seat', hardscape: 'rock' };
const MAX_SEATS = 2;
const MAX_ROCKS = 9;
const ROCK_GROUP = 3;

// Where a plant goes in the design, by fully grown height — the same layers as the layout engine
// (layout_engine.PlantSpec.layer): tall at the back, low along the borders
const roleOf = (item) => {
  if (!item) return null;
  if (item.category === 'furniture') return 'Seating';
  if (item.category === 'hardscape') return 'Accent';
  const grown = Math.max(Number(item.real_world_size) || 1, Number(item.mature_height) || 0);
  return grown >= 2.5 ? 'Tall · back' : grown >= 0.8 ? 'Medium' : 'Low · border';
};

// A design that spends well under its target budget (the beds are full, the picks are cheap, stock ran
// out): the card says "Uses ₱X of ₱Y" and shows the reason prominently instead of "Designed for ₱Y"
const UNDER_USED = 0.6;
const EDIT_TIMEOUT = 15000;
const timeAgo = (ms) => {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min} minute${min > 1 ? 's' : ''} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
};   // ms: re-price / notes / tidy after an edit; a hung server must not leave the UI waiting

// Each design and each of its plants gets a stable id, so the 3D view can edit it (move, turn,
// remove) and Undo follows the right design. priceCtx = the terms it was priced on (install, scope,
// lawn, lot), so an edited design is re-priced the same way. Older saved guest designs have none.
const tagLayouts = (layouts, priceCtx) => layouts.map((d, i) => ({
  ...d,
  edit_id: d.edit_id || `${Date.now().toString(36)}-${i}`,
  price_ctx: d.price_ctx || priceCtx,
  plants: (d.plants || []).map((p, j) => (p.uid ? p : { ...p, uid: `p${j}` })),
}));
// What "Reset to AI design" brings back
const ORIGINAL_FIELDS = ['plants', 'total_cost', 'plant_cost', 'plant_breakdown', 'cost_breakdown', 'cost_estimate', 'budget_use'];
const snapshotOf = (l) => Object.fromEntries(ORIGINAL_FIELDS.map(k => [k, l[k]]));

// Height layer by fully grown height: the same cut-offs as the engine (layout_engine.PlantSpec.layer),
// so "Swap" offers plants that fill the same role (tall at the back, mid, low border)
const grownOf = (p) => Math.max(Number(p.real_world_size) || 0, Number(p.mature_height) || 0);
const layerOf = (p) => { const g = grownOf(p); return g >= 2.5 ? 'tall' : g >= 0.8 ? 'mid' : 'low'; };
const sizeOf = (p) => {
  const h = Number(p.real_world_size) || 0, g = Number(p.mature_height) || 0;
  return (p.category || 'plant') === 'plant'
    ? (h ? `${h} m${g > h ? `, ${g} m grown` : ''}` : '')
    : (h ? `${h} m` : '');
};
// "+₱1,230" / "−₱200" / "same price": what choosing it does to the customer's total
const peso = (n) => `₱${Math.abs(Math.round(n)).toLocaleString()}`;
const deltaText = (d) => (Math.abs(d) < 1 ? 'same price' : `${d > 0 ? '+' : '−'}${peso(d)}`);

// "Add" / "Swap for…" picker shown above the 3D view while editing a design
function EditPicker({ title, hint, sections, onPick, onClose, busy, error, emptyText, touch, costOf }) {
  const empty = !sections.some(sec => sec.options.length);
  return (
    <div role="region" aria-label={title}
      style={{ margin: '0 0 10px', padding: 12, border: `1px solid ${color.border}`, borderRadius: 12, background: '#F8FAFC' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>{title}</div>
          {hint && <div style={{ fontSize: '0.75rem', color: color.muted, marginTop: 2 }}>{hint}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{ width: touch ? 44 : 32, height: touch ? 44 : 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', color: color.muted, cursor: 'pointer', borderRadius: 8 }}>
          <X size={16} />
        </button>
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: '0.8rem', fontWeight: 600, color: '#B91C1C' }}>{error}</p>}
      {empty && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: color.muted }}>{emptyText}</p>}
      {sections.filter(sec => sec.options.length).map(sec => (
        <div key={sec.label} style={{ marginTop: 10 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: color.muted, marginBottom: 6 }}>{sec.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {sec.options.map(item => {
              const img = productImage(item);
              return (
                <button key={item.id} type="button" onClick={() => onPick(item)} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, minHeight: 52, textAlign: 'left', borderRadius: 10,
                    border: `1px solid ${color.border}`, background: color.white, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {img
                    ? <img src={img} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', background: '#ECFDF5', flexShrink: 0 }} />
                    : <span style={{ width: 40, height: 40, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Leaf size={16} color="#059669" /></span>}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>{item.name}</span>
                    {sizeOf(item) && <span style={{ display: 'block', fontSize: '0.68rem', color: color.muted, marginTop: 2 }}>{sizeOf(item)}</span>}
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, marginTop: 1,
                      color: costOf(item) > 0 ? '#92400E' : costOf(item) < 0 ? '#047857' : color.muted }}>
                      {deltaText(costOf(item))} <span style={{ fontWeight: 500, color: color.muted }}>to your total</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
const underUsed = (d) => !!d.target_budget && Number(d.total_cost) < UNDER_USED * Number(d.target_budget);

/** A labelled single choice as chips. options: [value, label, hint]. */
function ChoiceChips({ label, value, onChange, options, touch }) {
  const hint = options.find(([v]) => v === value)?.[2];
  return (
    <div role="radiogroup" aria-label={label}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(([v, text, tip]) => {
          const on = v === value;
          return (
            <button key={String(v)} type="button" role="radio" aria-checked={on} title={tip} onClick={() => onChange(v)}
              style={{ minHeight: touch ? 44 : 34, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: '0.78rem',
                fontWeight: 700, border: `1.5px solid ${on ? '#10b981' : '#E2E8F0'}`, background: on ? '#ECFDF5' : '#FFFFFF',
                color: on ? '#047857' : '#475569' }}>
              {text}
            </button>
          );
        })}
      </div>
      {hint && <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#94A3B8' }}>{hint}</div>}
    </div>
  );
}

/** One row per plant (name, quantity, role) for a design card, plants before garden features. */
function plantingSchedule(design, catalog, featureItems) {
  const find = (id) => catalog.find(i => String(i.id) === String(id)) || featureItems.find(i => String(i.id) === String(id));
  let rows = design.plant_breakdown?.length
    ? design.plant_breakdown.map(r => ({ id: String(r.plant_id), quantity: r.quantity, name: r.name }))
    : null;
  if (!rows) {
    const counts = new Map();
    (design.plants || []).filter(p => !p.is_existing).forEach(p => counts.set(String(p.plant_id), (counts.get(String(p.plant_id)) || 0) + 1));
    rows = [...counts].map(([id, quantity]) => ({ id, quantity }));
  }
  return rows.map(r => {
    const detail = find(r.id);
    return { ...r, detail, name: r.name || detail?.name || `Plant #${r.id}`, role: roleOf(detail) };
  });
}

// The product's real photo (uploaded, or rendered from its 3D model). No photo or a broken link →
// a leaf tile: never an emoji, which Windows shows as an empty box for many plant emojis.
// Growing needs as small chips (icons, not emoji: they render the same on every device)
const SUN_CHIP = {
  full_sun: { Icon: Sun, label: 'Full sun', fg: '#B45309', bg: '#FEF3C7' },
  partial_shade: { Icon: CloudSun, label: 'Part shade', fg: '#047857', bg: '#D1FAE5' },
  full_shade: { Icon: Cloud, label: 'Shade', fg: '#475569', bg: '#E2E8F0' },
};
const WATER_CHIP = {
  low: { label: 'Low water', fg: '#92400E', bg: '#FEF3C7' },
  moderate: { label: 'Moderate', fg: '#0369A1', bg: '#E0F2FE' },
  high: { label: 'High water', fg: '#1D4ED8', bg: '#DBEAFE' },
};
const chip = (fg, bg) => ({ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999,
  fontSize: '0.62rem', fontWeight: 700, lineHeight: 1.3, color: fg, background: bg, whiteSpace: 'nowrap' });

function NeedChips({ plant }) {
  const sun = SUN_CHIP[plant.sunlight] || SUN_CHIP.full_sun;
  const water = WATER_CHIP[plant.water_need] || WATER_CHIP.moderate;
  const SunIcon = sun.Icon;
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      <span style={chip(sun.fg, sun.bg)}><SunIcon size={10} aria-hidden="true" />{sun.label}</span>
      <span style={chip(water.fg, water.bg)}><Droplet size={10} aria-hidden="true" />{water.label}</span>
      {plant.is_invasive && <span style={chip('#9A3412', '#FFEDD5')} title="Aggressive roots: needs a root barrier">Spreader</span>}
    </span>
  );
}

function PlantThumb({ item, size, rounded = 8, style }) {
  const [failed, setFailed] = useState(false);
  const src = !failed && productImage(item);
  const box = { width: size || '100%', height: size || 'auto', borderRadius: rounded, flexShrink: 0,
    background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style };
  if (!src) {
    return <span style={box} aria-hidden="true"><Leaf size={size ? Math.max(12, size * 0.5) : 28} color="#059669" /></span>;
  }
  return (
    <span style={box}>
      <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: size ? 'contain' : 'cover', display: 'block' }} />
    </span>
  );
}

const BotanicalSVG = () => (
  <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12 }}>
    {/* Large fern left */}
    <g transform="translate(60, 180)">
      {[-40,-25,-10,5,20,35,50].map((angle, i) => (
        <ellipse key={i} rx="38" ry="8" cx={Math.sin((angle*Math.PI)/180)*i*10} cy={-i*18}
          transform={`rotate(${angle})`} fill="#6B9E5A" />
      ))}
    </g>
    {/* Tree silhouette center-left */}
    <g transform="translate(200, 200)">
      <rect x="-5" y="-80" width="10" height="80" fill="#5C4033" />
      <circle cx="0" cy="-90" r="45" fill="#4A7A3A" />
      <circle cx="-25" cy="-75" r="30" fill="#3D6B2E" />
      <circle cx="28" cy="-72" r="33" fill="#4A7A3A" />
    </g>
    {/* Flowers scattered */}
    {[350, 420, 490, 560].map((x, i) => (
      <g key={i} transform={`translate(${x}, ${170 - i * 10})`}>
        <rect x="-2" y="-30" width="4" height="30" fill="#6B8F5A" />
        <circle cx="0" cy="-35" r="10" fill={['#E8A87C','#D4A5C9','#F0C060','#A8D5A2'][i]} />
      </g>
    ))}
    {/* Palm right */}
    <g transform="translate(680, 200)">
      <rect x="-4" y="-100" width="8" height="100" fill="#7A5C33" transform="rotate(5)" />
      {[-60,-30,0,30,60,90].map((angle, i) => (
        <ellipse key={i} rx="50" ry="6" cx="0" cy="-105"
          transform={`rotate(${angle})`} fill="#3D7A2E" />
      ))}
    </g>
    {/* Shrubs right area */}
    <circle cx="770" cy="185" r="28" fill="#4A7A3A" />
    <circle cx="790" cy="192" r="20" fill="#5C9440" />
    {/* Ground line */}
    <rect x="0" y="195" width="800" height="5" fill="#3D5C2E" rx="2" />
  </svg>
);

export default function AIGardenDesigner() {
  const navigate = useNavigate();
  const { dispatch } = useDesign();
  const { user } = useAuth();
  const ownerId = user ? String(user.user_id ?? user.id ?? 'me') : null;
  const [restored, setRestored] = useState(null);   // { at, hadPhoto, edited }: "We kept your designs" banner

  // Budget as a range; three designs spread across it. "install" = all-in with our crew,
  // otherwise plants only (the customer plants them).
  const [budgetRange, setBudgetRange] = useState({ min: 50000, max: 100000 });
  const [install, setInstall] = useState(true);
  // The yard's conditions (garden_ai.SUN_LEVELS / MAINTENANCE_LEVELS); sun null = not sure
  const [sun, setSun] = useState(null);
  const [maintenance, setMaintenance] = useState('medium');
  const [lawn, setLawn] = useState('new');
  // Installed: a full garden makeover, or planting into the customer's existing garden (no ground work)
  const [scope, setScope] = useState('makeover');
  const { addToCart } = useCart();
  const [rates, setRates] = useState(null);   // admin rate card
  useEffect(() => { getPricing().then(setRates).catch(() => {}); }, []);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getInventoryItems('plant')
      .then(data => { if (alive) setInventory(data); })
      .catch(() => {})
      .finally(() => { if (alive) setInventoryLoading(false); });
    return () => { alive = false; };
  }, []);

  // Garden features the designer can place: seating (furniture) and accent rocks (hardscape) with a 3D model
  const [featureItems, setFeatureItems] = useState([]);
  useEffect(() => {
    let alive = true;
    getInventoryItems()
      .then(data => {
        if (!alive) return;
        setFeatureItems((data || []).filter(i => FEATURE_KIND[i.category] && i.model_file && Number(i.stock_quantity) > 0));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  // Everything a design can contain: plants + features (results, Studio, cart all look items up here)
  const catalog = useMemo(() => [...inventory, ...featureItems], [inventory, featureItems]);
  const [featureQty, setFeatureQty] = useState({});   // { id: quantity }
  // A restored guest choice may name a feature that has since sold out or been archived: drop it
  useEffect(() => {
    if (!featureItems.length) return;
    const live = new Set(featureItems.map(i => String(i.id)));
    setFeatureQty(prev => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([id]) => live.has(id)));
      return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
    });
  }, [featureItems]);
  const seatTotal = featureItems.filter(i => FEATURE_KIND[i.category] === 'seat')
    .reduce((n, i) => n + (featureQty[String(i.id)] || 0), 0);
  const toggleFeature = (item) => {
    const id = String(item.id);
    setFeatureQty(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = FEATURE_KIND[item.category] === 'seat' ? 1 : ROCK_GROUP;
      return next;
    });
  };
  const changeFeatureQty = (item, delta) => {
    const id = String(item.id);
    setFeatureQty(prev => {
      const max = FEATURE_KIND[item.category] === 'seat' ? (prev[id] || 0) + MAX_SEATS - seatTotal : MAX_ROCKS;
      const qty = Math.min(max, Math.min(Number(item.stock_quantity) || 0, (prev[id] || 0) + delta));
      const next = { ...prev };
      if (qty <= 0) delete next[id]; else next[id] = qty;
      return next;
    });
  };

  const handleDesignManually = () => {
    dispatch({ type: 'RESET' });
    navigate('/studio');
  };
  // Coming from the 3D Studio's "Let AI design it": reuse its yard size and plants
  const [prefill] = useState(() => (user ? loadAiPrefill() : null));
  const [prefillNote, setPrefillNote] = useState(!!prefill);
  useEffect(() => {
    if (!prefill) return;
    clearAiPrefill();
    if (typeof prefill.install === 'boolean') setInstall(prefill.install);
    if (prefill.budgetRange?.max) setBudgetRange(prefill.budgetRange);
  }, [prefill]);

  const [lotWidth, setLotWidth] = useState(prefill?.lotWidth || 10.0);
  const [lotLength, setLotLength] = useState(prefill?.lotLength || 10.0);
  const [preferredPlants, setPreferredPlants] = useState(prefill?.plantIds || []);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedLayouts, setGeneratedLayouts] = useState([]);
  // The design shown in 3D, by id: edits replace the design inside generatedLayouts, so the cards,
  // the 3D view, booking and the cart all read the same (edited) version
  const [activeId, setActiveId] = useState(null);
  const activeLayout = generatedLayouts.find(l => l.edit_id === activeId) || null;
  const setActiveLayout = (layout) => setActiveId(layout ? layout.edit_id : null);
  const [editHistory, setEditHistory] = useState({});   // edit_id → earlier plant lists (Undo)
  // Designer's notes by plant uid, for the amber rings and the height card in 3D
  const activeNotes = activeLayout?.notes;
  const notesByUid = useMemo(() => {
    const out = {};
    (activeNotes || []).forEach(n => (n.uids || []).forEach(u => { if (u) (out[u] = out[u] || []).push(n.message); }));
    return out;
  }, [activeNotes]);
  const [growthStage, setGrowthStage] = useState(DEFAULT_GROWTH_STAGE);
  const [mirrorOn, setMirrorOn] = useState(true);   // Symmetrical designs: "Mirror my changes"
  const [mirrorNote, setMirrorNote] = useState('');
  const [activeView, setActiveView] = useState('3d');
  const phone = useIsPhone();
  const touch = useMediaQuery('(pointer: coarse)');
  // Phones & tablets: the three options are a swipe carousel. Desktop keeps them side by
  // side, because comparing the three at a glance is the point of this screen.
  const carousel = useMediaQuery('(max-width: 1023px)');
  const carouselRef = useRef(null);
  const previewRef = useRef(null);
  const [slide, setSlide] = useState(0);
  const [bookingLoading, setBookingLoading] = useState(false);
  // Photo overlay: four pins on the yard's corners in the photo (null = not placed yet, a guess is used)
  const [photoCorners, setPhotoCorners] = useState(null);   // the 4 pins on the photo ({u, v} each)
  // 'edges': back corners + a point on each side edge (the usual photo: the front corners are out of
  // shot); 'corners': all four corners are visible. photoLens: 35 mm-equivalent focal length from EXIF.
  const [pinMode, setPinMode] = useState('edges');
  const [photoLens, setPhotoLens] = useState(null);
  const photoSetup = useMemo(() => (photoCorners ? { pins: photoCorners, mode: pinMode, focal35: photoLens } : null),
    [photoCorners, pinMode, photoLens]);
  const [editingCorners, setEditingCorners] = useState(false);
  const [poseStatus, setPoseStatus] = useState(null);
  const [photoTone, setPhotoTone] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [budgetWarning, setBudgetWarning] = useState('');
  // Keep-clear zones from the photo: suggested by the AI scan, confirmed by the customer
  const [zoneScan, setZoneScan] = useState({ status: 'idle', zones: [] });
  const [keepClear, setKeepClear] = useState([]);
  const [seed, setSeed] = useState(0);          // "Show other variations"
  const [notice, setNotice] = useState('');     // e.g. AI unavailable → smart layouts
  const scanFileRef = React.useRef(null);

  // Unlock body scroll for this page (App.css sets body { overflow: hidden } globally)
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    return () => { document.body.style.overflowY = ''; };
  }, []);

  // Restore the last session on this device: designs, edits, answers and the design that was open.
  // Signed in: their own (saved per account); else, or when they have none yet, the guest one.
  // A fresh hand-off from the Studio (prefill) keeps its own lot and plants.
  useEffect(() => {
    const saved = (ownerId && loadAiSession(ownerId)) || loadGuestDesign();
    if (!saved?.layouts?.length) return;
    const layouts = tagLayouts(saved.layouts, null);
    setGeneratedLayouts(layouts);
    setActiveLayout(layouts.find(l => l.edit_id === saved.activeId) || layouts[0]);
    if (!prefill) {
      if (saved.budgetRange) setBudgetRange(saved.budgetRange);
      else if (saved.budget) setBudgetRange({ min: saved.budget, max: saved.budget });
      if (saved.lotWidth) setLotWidth(saved.lotWidth);
      if (saved.lotLength) setLotLength(saved.lotLength);
      if (Array.isArray(saved.preferredPlants)) setPreferredPlants(saved.preferredPlants);
    }
    if (saved.featureQty && typeof saved.featureQty === 'object') setFeatureQty(saved.featureQty);
    if (typeof saved.install === 'boolean') setInstall(saved.install);
    if (saved.scope) setScope(saved.scope);
    if (saved.lawn) setLawn(saved.lawn);
    if (saved.sun !== undefined) setSun(saved.sun);
    if (saved.maintenance) setMaintenance(saved.maintenance);
    if (Array.isArray(saved.keepClear)) setKeepClear(saved.keepClear);
    if (saved.savedAt) setRestored({ at: saved.savedAt, hadPhoto: !!saved.hadPhoto, edited: layouts.some(l => l.edited) });
    // Left mid-update (closed while a price was on its way): price those designs again
    layouts.filter(l => l.pricing === 'pending' || l.pricing === 'error').forEach(l => reprice(l.edit_id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival

  const toggleBreakdown = (index) => {
    setExpandedBreakdowns(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Space requirement validation
  useEffect(() => {
    if (preferredPlants.length === 0 || inventory.length === 0) {
      setToastMessage('');
      return;
    }
    const lotSize = Number(lotWidth) * Number(lotLength);
    if (isNaN(lotSize) || lotSize <= 0) return;

    const totalSpace = preferredPlants.reduce((sum, id) => {
      const plant = inventory.find(p => String(p.id) === String(id));
      if (!plant) return sum;
      const size = Number(plant.real_world_size) || 1.0;
      return sum + (size * size);
    }, 0);

    if (totalSpace > lotSize) {
      setToastMessage(
        `Selected plants require at least ${totalSpace.toFixed(1)}m² of space, but your lot is only ${lotSize.toFixed(1)}m². The composition may be overcrowded.`
      );
    } else {
      setToastMessage('');
    }
  }, [preferredPlants, lotWidth, lotLength, inventory]);

  // Real-time botanical compatibility evaluator (sunlight, irrigation, root competition, canopy)
  // Height groups, as the layout engine sorts them (layout_engine.PlantSpec.layer)
  const missingLayers = useMemo(() => {
    const ids = new Set(preferredPlants.map(String));
    const picked = inventory.filter(p => ids.has(String(p.id)));
    if (!picked.length) return [];
    // By fully grown height, like the layout engine (PlantSpec.layer → grown)
    const layer = (p) => { const h = Math.max(Number(p.real_world_size) || 1, Number(p.mature_height) || 0); return h >= 2.5 ? 'tall' : h >= 0.8 ? 'mid-height' : 'low'; };
    const have = new Set(picked.map(layer));
    return ['tall', 'mid-height', 'low'].filter(l => !have.has(l));
  }, [preferredPlants, inventory]);

  const selectedPlantObjects = useMemo(() => {
    return preferredPlants
      .map(id => inventory.find(p => String(p.id) === String(id)))
      .filter(Boolean);
  }, [preferredPlants, inventory]);

  const compatibilityWarnings = useMemo(() => {
    return evaluatePlantCompatibility(selectedPlantObjects);
  }, [selectedPlantObjects]);

  // Pre-flight budget guard: what's left for plants after site prep, materials, delivery and fees
  const lotAreaNow = Number(lotWidth) * Number(lotLength);
  useEffect(() => {
    const lotArea = Number(lotWidth) * Number(lotLength);
    if (!budgetRange.max || !lotWidth || !lotLength || isNaN(lotArea) || lotArea <= 0 || !rates) return;
    // Judge by the top of the range: that's the most the customer will spend
    const plantBudget = install
      ? plantBudgetFromAllIn(budgetRange.max, lotArea, rates)
      : Number(budgetRange.max) - Number(rates.shipping_fee);
    const cheapest = inventory.length > 0
      ? Math.min(...inventory.map(p => Number(p.unit_price)))
      : 200;
    const minPlants = Math.max(5, Math.ceil(lotArea / 15));
    if (plantBudget < minPlants * cheapest) {
      setBudgetWarning(
        'Budget may be too tight for an area of this size. Consider increasing your budget or choosing low-cost flora.'
      );
    } else {
      setBudgetWarning('');
    }
  }, [budgetRange.max, install, lotWidth, lotLength, inventory, rates]);

  useEffect(() => {
    if (!loading) return;
    setLoadingPhase(0);
    const id = setInterval(() => {
      setLoadingPhase(prev => (prev + 1) % LOADING_PHASES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [loading]);

  const handleTogglePlant = (id) => {
    setPreferredPlants(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const authHeaders = () => {
    try {
      const tokens = JSON.parse(localStorage.getItem('authTokens') || 'null');
      return tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {};
    } catch { return {}; }
  };

  // Ask the AI to suggest keep-clear zones; the customer confirms them in ZonePicker.
  // A failed scan just means the customer marks the zones themselves.
  const scanZones = async (file) => {
    scanFileRef.current = file;
    setZoneScan({ status: 'scanning', zones: [] });
    setKeepClear([]);
    try {
      const form = new FormData();
      form.append('image', file);
      const API_BASE_URL = API_ROOT;
      const res = await axios.post(`${API_BASE_URL}/scan-zones/`, form, { headers: authHeaders() });
      if (scanFileRef.current !== file) return; // a newer photo replaced this one
      const zones = res.data.zones || [];
      setZoneScan({ status: res.data.status || 'failed', zones });
      setKeepClear([...new Set(zones.map(z => z.zone))]);
    } catch {
      if (scanFileRef.current === file) setZoneScan({ status: 'failed', zones: [] });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setPhotoCorners(null);   // a new photo needs its own pins
      setPhotoLens(null);
      scanZones(file);   // sets scanFileRef: the photo now on screen
      readFocal35(file).then(mm => { if (scanFileRef.current === file) setPhotoLens(mm); });
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    scanFileRef.current = null;
    setSelectedImage(null);
    setImagePreview(null);
    setPhotoCorners(null);
    setPhotoLens(null);
    setZoneScan({ status: 'idle', zones: [] });
    setKeepClear([]);
  };

  const handleGenerateDesigns = async (e, variationSeed = seed) => {
    e?.preventDefault?.();
    setLoading(true);
    setNotice('');
    setError('');
    const API_BASE_URL = API_ROOT;
    const headers = {};
    const storedAuth = localStorage.getItem('authTokens');
    if (storedAuth) {
      try {
        const tokens = JSON.parse(storedAuth);
        if (tokens?.access) headers['Authorization'] = `Bearer ${tokens.access}`;
      } catch (err) { console.error(err); }
    }
    const formData = new FormData();
    formData.append('budget_min', Number(budgetRange.min));
    formData.append('budget_max', Number(budgetRange.max));
    formData.append('install', install);
    formData.append('lot_width', Number(lotWidth));
    formData.append('lot_length', Number(lotLength));
    formData.append('preferred_plant_ids', JSON.stringify(preferredPlants));
    formData.append('features', JSON.stringify(Object.entries(featureQty).map(([id, quantity]) => ({ id: Number(id), quantity }))));
    // The photo stays in the browser for the AR view; only the confirmed zones are sent
    formData.append('keep_clear_zones', JSON.stringify(keepClear));
    formData.append('seed', variationSeed);
    if (sun) formData.append('sun', sun);
    formData.append('maintenance', maintenance);
    formData.append('lawn', lawn);
    formData.append('scope', scope);
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-layouts/`, formData, { headers });
      if (response.data?.designs) {
        const inventoryIds = new Set(catalog.map(item => String(item.id)));
        const validated = tagLayouts(response.data.designs.map(design => ({
          ...design,
          plants: (design.plants || []).filter(p =>
            p.is_existing || inventoryIds.has(String(p.plant_id))
          ),
        })), { install, scope: response.data.scope || scope, newLawn: lawn !== 'keep', lot: [Number(lotWidth), Number(lotLength)], keepClear });
        setEditHistory({});
        setGeneratedLayouts(validated);
        setSlide(0);
        setActiveLayout(null);
        setNotice(response.data.notice || '');
        if (response.data.budget_warning) setBudgetWarning(response.data.budget_warning);
        setRestored(null);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLayout = (layout) => {
    setActiveLayout(layout);
    setEditPanel(null);
    setTidyPreview(null);
    setMirrorNote('');
    if (carousel) setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el?.children.length) return;
    const cards = [...el.children];
    // Scrolled to the end: the last card counts as shown even if it can't reach the centre
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) { setSlide(cards.length - 1); return; }
    const mid = el.scrollLeft + el.clientWidth / 2;
    const dist = cards.map(c => Math.abs(c.offsetLeft - el.offsetLeft + c.offsetWidth / 2 - mid));
    setSlide(dist.indexOf(Math.min(...dist)));
  };
  const goToSlide = (i) => {
    const el = carouselRef.current;
    const card = el?.children[i];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  };

  const handleShowVariations = () => {
    const next = seed + 1;
    setSeed(next);
    handleGenerateDesigns(null, next);
  };

  // Phase B: any design becomes an editable Studio design (unsaved until the customer saves)
  const handleEditInStudio = (design) => {
    const w = Number(lotWidth), l = Number(lotLength);
    dispatch({
      type: 'LOAD_DESIGN',
      payload: {
        designId: null,
        designName: `${design.design_name} (from AI Designer)`,
        placedItems: lotPlantsToStudioItems(design.plants || [], catalog, w, l),
        // The beds and lawn come along, so the Studio shows the same garden (dropped if the lot is resized)
        dimensions: { width: w, length: l, terrainType: 'flat',
          ...(design.garden_plan?.lawn && { gardenPlan: { ...design.garden_plan, newLawn: lawn !== 'keep' } }) },
        depthData: null,
        originalImageUrl: null,
        terrainHeight: 1.5,
        timeOfDay: DEFAULT_TIME_OF_DAY,
      },
    });
    dispatch({ type: 'SET_DESIGN_META', payload: { isDirty: true } });
    navigate('/studio');
  };
  const handleReset = () => { setGeneratedLayouts([]); setError(''); setActiveLayout(null); setEditHistory({}); };

  // ── Editing a design in the 3D view (move, turn, remove) ──────────────────────
  // The price is re-done by the server's rate card (POST /pricing/estimate/) on the design's own
  // terms; booking waits until the new price is in. The AI's version is kept for "Reset to AI design".
  const layoutsRef = useRef(generatedLayouts);
  useEffect(() => { layoutsRef.current = generatedLayouts; });
  const priceTimers = useRef({});
  const priceSeq = useRef({});
  useEffect(() => {
    const timers = priceTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);
  const patchLayout = (id, patch) => setGeneratedLayouts(ls => ls.map(l =>
    (l.edit_id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)));

  const reprice = (id) => {
    clearTimeout(priceTimers.current[id]);
    priceTimers.current[id] = setTimeout(async () => {
      const seq = (priceSeq.current[id] || 0) + 1;
      priceSeq.current[id] = seq;
      const layout = layoutsRef.current.find(l => l.edit_id === id);
      if (!layout) return;
      const ctx = layout.price_ctx || { install, scope, newLawn: lawn !== 'keep', lot: [Number(lotWidth), Number(lotLength)] };
      const area = ctx.lot[0] * ctx.lot[1];
      // Designer's notes (too close, on the lawn, tall at the front…): suggestions only, never blocking
      axios.post(`${API_ROOT}/layout-review/`, layoutBody(layout, ctx), { timeout: EDIT_TIMEOUT })
        .then(({ data }) => { if (priceSeq.current[id] === seq) patchLayout(id, { notes: data.notes || [] }); })
        .catch(() => { if (priceSeq.current[id] === seq) patchLayout(id, { notes: null }); });
      const counts = {};
      layout.plants.forEach(p => { if (!p.is_existing) counts[p.plant_id] = (counts[p.plant_id] || 0) + 1; });
      try {
        const { data: est } = await axios.post(`${API_ROOT}/pricing/estimate/`, {
          items: Object.entries(counts).map(([pid, quantity]) => ({ product_id: Number(pid), quantity })),
          area_sqm: area,
          lawn_sqm: ctx.install ? Math.min(area, Number(layout.garden_plan?.lawn_area) || 0) : 0,
          new_lawn: ctx.newLawn, scope: ctx.scope || 'makeover', install: ctx.install,
        }, { timeout: EDIT_TIMEOUT });
        if (priceSeq.current[id] !== seq) return;   // a newer edit is being priced
        patchLayout(id, l => ({
          pricing: 'ok', total_cost: est.total, plant_cost: est.plant_cost, plant_breakdown: est.plant_breakdown, cost_estimate: est,
          cost_breakdown: { lines: est.lines, total: est.total, low: est.low, high: est.high, is_sample_rates: est.is_sample_rates },
          budget_use: l.target_budget ? Math.round((est.total / l.target_budget) * 100) / 100 : l.budget_use,
        }));
      } catch {
        if (priceSeq.current[id] === seq) patchLayout(id, { pricing: 'error' });
      }
    }, 450);
  };

  const layoutBody = (layout, ctx) => ({
    plants: layout.plants, lot_width: ctx.lot[0], lot_length: ctx.lot[1],
    garden_plan: layout.garden_plan || null, keep_clear_zones: ctx.keepClear || [],
  });

  const handlePlantsEdit = (nextPlants, opts = {}) => {
    const cur = activeLayout;
    if (!cur) return;
    setTidyNote('');
    setTidyPreview(null);
    setMirrorNote('');
    // Symmetrical designs: the same change to the plant's partner on the other side (one Undo step)
    if (mirrorOn && cur.design_name === 'Symmetrical' && !opts.noMirror) {
      const width = cur.price_ctx?.lot?.[0] || Number(lotWidth);
      const mirrored = mirrorEdit(cur.plants, nextPlants, width);
      if (mirrored.partner) {
        nextPlants = mirrored.plants;
        setMirrorNote('Mirrored on the other side to keep the design symmetrical.');
      }
    }
    setEditHistory(h => ({ ...h, [cur.edit_id]: [...(h[cur.edit_id] || []), cur.plants].slice(-50) }));
    patchLayout(cur.edit_id, l => ({ plants: nextPlants, edited: true, original: l.original || snapshotOf(l), pricing: 'pending' }));
    reprice(cur.edit_id);
  };
  const restoreOriginal = (id) => {
    clearTimeout(priceTimers.current[id]);
    priceSeq.current[id] = (priceSeq.current[id] || 0) + 1;   // drop any price still on its way
    patchLayout(id, l => (l.original ? { ...l.original, edited: false, original: null, pricing: 'ok', notes: [] } : {}));
    setTidyNote('');
    setTidyPreview(null);
    setMirrorNote('');
  };

  // "Tidy up for me": the engine moves only what breaks a rule, the shortest distance; it is one
  // more edit, so Undo takes it back
  const [tidying, setTidying] = useState(false);
  const [tidyNote, setTidyNote] = useState('');
  const [tidyPreview, setTidyPreview] = useState(null);   // { moves: [{ uid, x, z }], notes }: shown, not applied yet
  const handleTidy = async () => {
    const cur = activeLayout;
    if (!cur || tidying) return;
    const ctx = cur.price_ctx || { lot: [Number(lotWidth), Number(lotLength)], keepClear };
    setTidying(true);
    try {
      const { data } = await axios.post(`${API_ROOT}/layout-review/`, { ...layoutBody(cur, ctx), tidy: true }, { timeout: EDIT_TIMEOUT });
      const moves = (data.moves || []).filter(m => m.uid);
      const note = (data.tidy_notes || []).join(' ');
      // Shown first (blue rings + dashed lines in 3D): nothing changes until the customer applies it
      if (moves.length) setTidyPreview({ moves, notes: data.tidy_notes || [], left: (data.notes || []).length });
      else setTidyNote(note);
    } catch {
      setTidyNote("Couldn't tidy up just now. Please try again.");
    } finally {
      setTidying(false);
    }
  };
  const applyTidy = () => {
    const cur = activeLayout;
    if (!cur || !tidyPreview) return;
    const moves = new Map(tidyPreview.moves.map(m => [m.uid, m]));
    const note = tidyPreview.notes.join(' ');
    handlePlantsEdit(cur.plants.map(p => (moves.has(p.uid) ? { ...p, x: moves.get(p.uid).x, z: moves.get(p.uid).z } : p)), { noMirror: true });
    setTidyNote(note);
  };
  const handleUndo = () => {
    const cur = activeLayout;
    const stack = (cur && editHistory[cur.edit_id]) || [];
    if (!stack.length) return;
    setEditHistory(h => ({ ...h, [cur.edit_id]: stack.slice(0, -1) }));
    if (stack.length === 1) { restoreOriginal(cur.edit_id); return; }   // back to the AI's own design and price
    patchLayout(cur.edit_id, { plants: stack[stack.length - 1], pricing: 'pending' });
    reprice(cur.edit_id);
  };
  const handleResetEdits = () => {
    if (!activeLayout) return;
    restoreOriginal(activeLayout.edit_id);
    setEditHistory(h => ({ ...h, [activeLayout.edit_id]: [] }));
  };

  // ── Add / Swap (phase C) ──────────────────────────────────────────────────────
  // Swap: same kind of item and (plants) the same height layer, in stock, the customer's own picks
  // first, then the closest price. Add: any in-stock catalog item; the engine puts it where a designer
  // would (POST /layout-place/) and it is selected, ready to drag elsewhere.
  const [editPanel, setEditPanel] = useState(null);   // null | { mode: 'add' } | { mode: 'swap', uid }
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [focusReq, setFocusReq] = useState(null);     // { uid, n }: select this item in 3D
  const activePlants = activeLayout?.plants;
  const usedCount = useMemo(() => {
    const m = {};
    (activePlants || []).forEach(p => { if (!p.is_existing) m[String(p.plant_id)] = (m[String(p.plant_id)] || 0) + 1; });
    return m;
  }, [activePlants]);
  const isPick = (item) => preferredPlants.some(id => String(id) === String(item.id));
  const inStock = (item) => !!item.model_file && Number(item.stock_quantity) - (usedCount[String(item.id)] || 0) > 0;
  const swapFor = editPanel?.mode === 'swap' ? (activePlants || []).find(p => p.uid === editPanel.uid) : null;
  const swapItem = swapFor ? catalog.find(c => String(c.id) === String(swapFor.plant_id)) : null;
  const swapOptions = swapItem ? catalog
    .filter(c => String(c.id) !== String(swapItem.id) && (c.category || 'plant') === (swapItem.category || 'plant')
      && ((c.category || 'plant') !== 'plant' || layerOf(c) === layerOf(swapItem)) && inStock(c))
    .sort((a, b) => (isPick(b) - isPick(a)) || Math.abs(a.unit_price - swapItem.unit_price) - Math.abs(b.unit_price - swapItem.unit_price))
    .slice(0, 8) : [];
  const addSections = editPanel?.mode === 'add' ? [
    { label: 'Your plants', options: catalog.filter(c => (c.category || 'plant') === 'plant' && isPick(c) && inStock(c)) },
    { label: 'More plants', options: catalog.filter(c => (c.category || 'plant') === 'plant' && !isPick(c) && inStock(c)) },
    { label: 'Seating & rocks', options: catalog.filter(c => (c.category || 'plant') !== 'plant' && inStock(c)) },
  ] : [];
  const openPanel = (panel) => { setEditPanel(panel); setPanelError(''); };
  const costTerms = { install: activeLayout?.price_ctx?.install ?? install, scope: activeLayout?.price_ctx?.scope || scope };
  const addCost = (item) => itemCostToCustomer(rates, item, costTerms);
  const swapCost = (item) => (swapItem ? addCost(item) - addCost(swapItem) : 0);

  const handleSwap = (item) => {
    const uid = editPanel?.uid;
    if (!activeLayout || !uid) return;
    handlePlantsEdit(activeLayout.plants.map(p => (p.uid === uid ? { ...p, plant_id: String(item.id) } : p)));
    setEditPanel(null);
    setFocusReq({ uid, n: Date.now() });
  };
  const handleAdd = async (item) => {
    const cur = activeLayout;
    if (!cur || panelBusy) return;
    const ctx = cur.price_ctx || { lot: [Number(lotWidth), Number(lotLength)], keepClear };
    setPanelBusy(true);
    setPanelError('');
    try {
      const { data } = await axios.post(`${API_ROOT}/layout-place/`, { ...layoutBody(cur, ctx), add: item.id }, { timeout: EDIT_TIMEOUT });
      const uid = `n${Date.now().toString(36)}`;
      handlePlantsEdit([...cur.plants, { plant_id: String(data.plant_id), x: data.x, z: data.z, rotation: data.rotation, uid }]);
      setFocusReq({ uid, n: Date.now() });
      setEditPanel(null);
    } catch (err) {
      setPanelError(err.response?.data?.error || "Couldn't add it just now. Please try again.");
    } finally {
      setPanelBusy(false);
    }
  };

  // Keep the session on this device (signed in: per account; guests: the guest slot), so a refresh or a
  // later visit doesn't lose designs or edits. No designs on screen ("Adjust parameters") = nothing kept.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!generatedLayouts.length) {
        if (ownerId) clearAiSession(ownerId); else clearGuestDesign();
        return;
      }
      const data = {
        layouts: generatedLayouts, activeId, budgetRange, lotWidth, lotLength, featureQty, preferredPlants,
        install, scope, lawn, sun, maintenance, keepClear, hadPhoto: !!imagePreview,
      };
      if (ownerId) saveAiSession(ownerId, data); else saveGuestDesign(data);
    }, 600);
    return () => clearTimeout(t);
  }, [generatedLayouts, activeId, ownerId, budgetRange, lotWidth, lotLength, featureQty, preferredPlants,
    install, scope, lawn, sun, maintenance, keepClear, imagePreview]);

  // Analyse the uploaded photo's average colour to warm/cool the 3D lighting
  useEffect(() => {
    if (!imagePreview) { setPhotoTone(null); return; }
    const img = new Image();
    img.onload = () => {
      const size = 48;
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const d = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      }
      if (n > 0) setPhotoTone({ r: r / n / 255, g: g / n / 255, b: b / n / 255 });
    };
    img.src = imagePreview;
  }, [imagePreview]);

  // Opening the photo overlay before the pins are placed: start by placing them; leaving it ends editing
  const openView = (key) => {
    setActiveView(key);
    setEditingCorners(key === 'ar' && !!imagePreview && !photoCorners);
  };

  const handleBookDesign = async () => {
    if (activeLayout?.pricing === 'pending' || activeLayout?.pricing === 'error') return;   // wait for the edited price
    if (activeLayout && activeLayout.plants && !(activeLayout.price_ctx?.install ?? install)) {
      // Plants only: put this design's plant list in the shop cart
      (activeLayout.plant_breakdown || []).forEach(row => {
        const product = catalog.find(p => String(p.id) === String(row.plant_id));
        if (product) addToCart(product, row.quantity);
      });
      navigate('/shop?cart=open');
      return;
    }
    if (!user) {
      const context = {
        selectedProfile: activeLayout?.design_name || '',
        estimatedPricing: activeLayout?.total_cost || 0,
        lotWidth: lotWidth,
        lotLength: lotLength,
        budget: activeLayout?.target_budget || budgetRange.max,
        imagePreview: imagePreview || '/login-hero-bg.webp',
      };
      localStorage.setItem('pending_booking_context', JSON.stringify(context));
      setShowAuthModal(true);
      return;
    }
    setBookingLoading(true);
    const API_BASE_URL = API_ROOT;
    const storedAuth = localStorage.getItem('authTokens');
    const tokens = storedAuth ? JSON.parse(storedAuth) : null;
    const authHeader = tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {};

    let referenceImageUrl = '';
    try {
      if (selectedImage) {
        const imgForm = new FormData();
        imgForm.append('image', selectedImage);
        const uploadRes = await axios.post(`${API_BASE_URL}/upload-design-image/`, imgForm, { headers: authHeader });
        referenceImageUrl = uploadRes.data.url || '';
      }
      const designPayload = {
        name: activeLayout.design_name,
        placed_items: activeLayout.plants,
        plant_breakdown: activeLayout.plant_breakdown || [],
        // The pins and the beds/lawn plan travel with the design so the office and crew see the same garden
        dimensions: { width: Number(lotWidth), length: Number(lotLength), ...(photoSetup && { photoCorners: photoSetup }),
          ...(activeLayout.garden_plan?.lawn && { gardenPlan: { ...activeLayout.garden_plan, newLawn: lawn !== 'keep' } }),
          // The customer moved, turned or removed things after the AI designed it
          ...(activeLayout.edited && { editedByCustomer: true, customerEdits: {
            ...editSummary(activeLayout), notes: (activeLayout.notes || []).slice(0, 10).map(n => n.message) } }) },
        total_cost: activeLayout.total_cost,
        cost_estimate: activeLayout.cost_estimate || {},
        reference_image_url: referenceImageUrl,
        status: 'draft',
      };
      const designRes = await axios.post(`${API_BASE_URL}/designs/`, designPayload, { headers: authHeader });
      navigate('/my-bookings', {
        state: {
          designId: designRes.data.id,
          designName: activeLayout.design_name,
          totalCost: activeLayout.total_cost,
          autoOpenModal: true,
        },
      });
    } catch (err) {
      console.error('Failed to save design:', err);
      navigate('/my-bookings', {
        state: {
          designId: null,
          designName: activeLayout.design_name,
          totalCost: activeLayout.total_cost,
          autoOpenModal: true,
        },
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const styles = {
    editBtn: (off, big) => ({
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: big ? 44 : 34, padding: '6px 12px', borderRadius: 8,
      border: `1.5px solid ${color.border}`, background: color.white, color: off ? '#94A3B8' : color.brandDeep,
      fontSize: '0.75rem', fontWeight: 700, cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }),
    page: { minHeight: '100vh', background: color.bg, fontFamily: "'Inter', system-ui, sans-serif", padding: 'clamp(1rem, 4vw, 2rem) 1rem' },
    container: { maxWidth: '960px', margin: '0 auto' },
    card: { ...cardStyle, padding: 'clamp(1.25rem, 4vw, 2.25rem)', marginTop: '1.5rem', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' },
    sectionLabel: { ...labelStyle },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
    },
    inputWrapper: {
      position: 'relative',
    },
    inputPrefix: {
      position: 'absolute',
      left: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#64748B',
      fontWeight: 700,
      fontSize: '0.95rem',
      pointerEvents: 'none',
      zIndex: 1,
    },
    input: { ...inputStyle },
    inputWithPrefix: {
      paddingLeft: '28px',
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '1.25rem',
      marginBottom: '1.75rem',
    },
    divider: {
      border: 'none',
      borderTop: '1.5px solid #E2E8F0',
      margin: '1.75rem 0',
    },
    uploadZone: {
      border: '2px dashed #CBD5E1',
      borderRadius: '14px',
      padding: '2rem',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#FFFFFF',
      display: 'block',
    },
    uploadIcon: { width: '36px', height: '36px', background: color.brandSurface, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
    plantsGrid: {
      display: 'grid',
      // Phones: always two columns (150 px minimum would drop to one); wider screens fill the row
      gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: phone ? '8px' : '10px',
      alignItems: 'stretch',
    },
    plantCard: (isSelected) => ({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '8px',
      padding: '8px',
      textAlign: 'left',
      font: 'inherit',
      width: '100%',
      height: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      borderRadius: '12px',
      border: isSelected ? '2px solid #059669' : '1.5px solid #E2E8F0',
      background: isSelected ? color.brandSurface : color.white,
      cursor: 'pointer',
      transition: 'all 0.18s',
      boxShadow: isSelected ? '0 4px 16px rgba(5,150,105,0.15)' : 'none',
    }),
    plantPhoto: {
      aspectRatio: '1 / 1',
    },
    stepBtn: (enabled) => ({
      width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: '1px solid #A7F3D0', background: '#fff',
      color: '#065F46', fontWeight: 800, fontSize: '1rem', lineHeight: 1,
      cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.4,
    }),
    plantInfo: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      padding: '0 4px 4px',
    },
    plantName: (isSelected) => ({
      fontWeight: 700,
      fontSize: '0.8rem',
      lineHeight: 1.3,
      color: isSelected ? '#1E293B' : '#334155',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      overflowWrap: 'anywhere',
    }),
    plantPrice: (isSelected) => ({
      fontSize: '0.72rem',
      color: isSelected ? '#059669' : '#94A3B8',
      fontWeight: 600,
      marginTop: '2px',
      display: 'block',
    }),
    plantCheck: {
      position: 'absolute',
      top: '12px',
      right: '12px',
      boxShadow: '0 0 0 2px #fff',
      width: '20px',
      height: '20px',
      background: '#059669',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    submitBtn: { width: '100%', padding: '14px 24px', background: color.brand, color: color.white, fontWeight: 700, fontSize: '0.95rem', border: 'none', borderRadius: `${radius.button}px`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 14px rgba(16,185,129,0.2)', transition: 'background 0.2s', marginTop: '1.75rem' },
    secondaryBtn: { width: '100%', padding: '14px 24px', background: color.white, color: color.text, fontWeight: 700, fontSize: '0.95rem', border: `1px solid ${color.border}`, borderRadius: `${radius.button}px`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'border-color 0.2s, color 0.2s', marginTop: '1rem' },
    errorBox: {
      background: '#FEF2F2',
      border: '1.5px solid #FECACA',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex',
      gap: '12px',
      marginBottom: '1.5rem',
      color: '#991B1B',
    },
    loadingWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5rem 2rem',
      gap: '1.5rem',
    },
    spinner: {
      width: '56px',
      height: '56px',
      border: '4px solid #ECFDF5',
      borderTop: '4px solid #059669',
      borderRadius: '50%',
      animation: 'spin 0.9s linear infinite',
    },
    resultsHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1.75rem',
    },
    resultsTitle: {
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '1.5rem',
      fontWeight: 800,
      color: '#0F172A',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    backBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.8rem',
      fontWeight: 700,
      color: '#059669',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 14px',
      borderRadius: '8px',
      transition: 'all 0.15s',
    },
    layoutsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
      gap: '1.25rem',
    },
    // Swipe carousel: one card per view with the next one peeking in
    layoutsCarousel: {
      display: 'flex',
      gap: '12px',
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      padding: '4px 2px 8px',
      alignItems: 'stretch',
    },
    layoutCard: { ...cardStyle, overflow: 'hidden', transition: 'transform 0.25s, box-shadow 0.25s', boxShadow: '0 2px 12px rgba(15,23,42,0.05)' },
    layoutCardTop: { background: color.white, padding: '1.5rem 1.5rem 1rem', borderBottom: `1px solid ${color.divider}` },
    layoutBadge: { fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.brandDeep, background: color.brandSurface, border: `1px solid ${color.brandBorder}`, borderRadius: '100px', padding: '3px 10px', display: 'inline-block', marginBottom: '10px' },
    layoutName: { fontSize: '1.15rem', fontWeight: 800, color: color.ink, margin: '0 0 6px' },
    layoutCost: { fontSize: '1.5rem', fontWeight: 800, color: color.ink },
    layoutBody: {
      padding: '1.25rem 1.5rem 1.5rem',
    },
    plantListLabel: {
      fontSize: '9px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#94A3B8',
      marginBottom: '10px',
      display: 'block',
    },
    plantItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #F1F5F9',
    },
    plantItemName: {
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#1E293B',
    },
    plantItemCoord: {
      fontSize: '0.68rem',
      fontWeight: 600,
      color: '#94A3B8',
      background: '#F1F5F9',
      padding: '2px 8px',
      borderRadius: '6px',
      fontFamily: 'monospace',
    },
    selectBtn: { width: '100%', padding: '11px 20px', background: color.brand, color: color.white, fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: `${radius.button}px`, cursor: 'pointer', marginTop: '1.25rem', transition: 'background 0.2s' },
    carouselArrow: {
      width: 36, height: 36, borderRadius: '50%', border: `1px solid ${color.border}`, background: color.white,
      color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    previewPanel: {
      marginTop: '2rem',
      background: '#F8FAFC',
      border: `1px solid ${color.border}`,
      borderRadius: `${radius.card}px`,
      padding: 'clamp(1rem, 4vw, 1.75rem)',
    },
    previewHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1.25rem',
      flexWrap: 'wrap',
      gap: '1rem',
    },
    previewTitle: {
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '1.2rem',
      fontWeight: 800,
      color: '#0F172A',
      margin: '0 0 4px',
    },
    previewSub: {
      fontSize: '0.75rem',
      color: '#64748B',
      margin: 0,
    },
    previewCostBadge: { background: color.brand, color: color.white, fontWeight: 800, fontSize: '0.85rem', padding: '8px 18px', borderRadius: '100px', whiteSpace: 'nowrap' },
    canvasPlaceholder: {
      background: '#ECFDF5',
      borderRadius: '12px',
      height: '300px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#10B981',
      fontWeight: 600,
      fontSize: '0.9rem',
    },
  };

  return (
    <>
      <style>{`
        .ai-carousel::-webkit-scrollbar { display: none; }
        .carousel-arrow:not(:disabled):hover { border-color: #10B981 !important; color: #059669 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .garden-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; }
        .upload-zone:hover { border-color: #10B981 !important; background: #F0FDF4 !important; }
        .plant-card:hover { transform: translateY(-1px); }
        .layout-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(15,23,42,0.1) !important; }
        .submit-btn:hover { background: #059669 !important; }
        .secondary-btn:hover { border-color: #10B981 !important; color: #059669 !important; }
        .back-btn:hover { background: #ECFDF5 !important; color: #047857 !important; }
        .select-btn:hover { background: #059669 !important; }
        .fade-in { animation: fadeUp 0.4s ease both; }
        
        .tooltip-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
        }
        .tooltip-text {
          visibility: hidden;
          width: 250px;
          background-color: #0F172A;
          color: #F8FAFC;
          text-align: left;
          border-radius: 12px;
          padding: 10px 14px;
          position: absolute;
          z-index: 999;
          bottom: 130%;
          right: -10px;
          opacity: 0;
          transition: opacity 0.25s ease, transform 0.25s ease;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          font-size: 0.76rem;
          line-height: 1.4;
          font-weight: 500;
          pointer-events: none;
          border: 1px solid rgba(148,163,184,0.2);
        }
        .tooltip-text::after {
          content: "";
          position: absolute;
          top: 100%;
          right: 14px;
          border-width: 6px;
          border-style: solid;
          border-color: #0F172A transparent transparent transparent;
        }
        .tooltip-container:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
          transform: translateY(-4px);
        }
      `}</style>

      <div className="w-full min-h-screen flex flex-col items-center justify-start bg-[#F8FAFC] py-6 px-4 md:px-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {prefillNote && (
          <div style={{
            width: '100%', maxWidth: '1100px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px',
            background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: '12px',
            padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600,
          }}>
            <Sparkles size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              {prefill.source === 'estimate'
                ? <>We filled in your {prefill.lotWidth} × {prefill.lotLength} m yard and the budget from your estimate. Adjust anything, then generate.</>
                : <>We filled in your {prefill.lotWidth} × {prefill.lotLength} m yard
                  {prefill.plantIds?.length ? ` and the ${prefill.plantIds.length} plant type${prefill.plantIds.length > 1 ? 's' : ''} you picked` : ''} from the 3D Studio. Set your budget and generate.</>}
            </span>
            <button onClick={() => setPrefillNote(false)} aria-label="Dismiss"
              style={{ border: 'none', background: 'none', color: '#065F46', cursor: 'pointer', fontWeight: 800 }}>×</button>
          </div>
        )}

        {/* Space Warning Toast */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: '#FEF2F2',
            border: '1.5px solid #FECACA',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.1), 0 8px 10px -6px rgba(220, 38, 38, 0.1)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '400px',
            animation: 'fadeUp 0.3s ease-out forwards',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: '#FEE2E2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldAlert size={20} color="#DC2626" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#991B1B' }}>Lot Space Warning</div>
              <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: '2px', lineHeight: 1.4 }}>{toastMessage}</div>
            </div>
            <button
              onClick={() => setToastMessage('')}
              style={{
                border: 'none',
                background: 'none',
                color: '#991B1B',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.7,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="w-full max-w-6xl flex flex-col gap-6">

          {/* Hero Banner */}
          <PageHero
            eyebrow={<><Compass size={11} /> AI-Powered · 3D Visualization</>}
            title="Design your dream garden in 3D"
            subtitle="Set your budget, define the lot, pick your flora, and let the AI compose a garden layout tailored to your space."
            decoration={<BotanicalSVG />}
          />

          {/* Main Card */}
          <div style={styles.card}>

            {/* Error */}
            {error && (
              <div style={styles.errorBox}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '3px' }}>Generation failed</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{error}</div>
                </div>
              </div>
            )}

            {/* FORM */}
            {!loading && generatedLayouts.length === 0 && (
              <form onSubmit={handleGenerateDesigns}>

                {/* Dimensions, then the budget range (its suggestion depends on the area) */}
                <div style={styles.grid3}>
                  <div style={{ ...styles.inputGroup, gridColumn: '1 / -1' }}>
                    {budgetWarning && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                        <ShieldAlert size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600, lineHeight: 1.35 }}>{budgetWarning}</span>
                      </div>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.sectionLabel}>Lot Width (m)</label>
                    <input
                      type="number" step="0.1" min="1" max="100" value={lotWidth}
                      onChange={e => setLotWidth(e.target.value)}
                      className="garden-input"
                      style={styles.input} required
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.sectionLabel}>Lot Length (m)</label>
                    <input
                      type="number" step="0.1" min="1" max="100" value={lotLength}
                      onChange={e => setLotLength(e.target.value)}
                      className="garden-input"
                      style={styles.input} required
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <label style={styles.sectionLabel}>Budget</label>
                  <BudgetPicker
                    areaSqm={lotAreaNow}
                    lotWidth={lotWidth}
                    lotLength={lotLength}
                    install={install}
                    onInstallChange={setInstall}
                    scope={scope}
                    onScopeChange={setScope}
                    lawn={lawn}
                    range={budgetRange}
                    onRangeChange={setBudgetRange}
                    rates={rates}
                  />
                </div>

                {/* The yard's conditions: which plants will thrive, how much care, the lawn */}
                <div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.9rem' }}>
                  <ChoiceChips label="Sun on the garden" value={sun} onChange={setSun} touch={touch} options={[
                    ['full', 'Full sun', '6+ hours of direct sun'], ['part', 'Part sun', '3–6 hours'],
                    ['shade', 'Mostly shade', 'under 3 hours'], [null, 'Not sure', 'we check at the site visit'],
                  ]} />
                  <ChoiceChips label="Upkeep you want" value={maintenance} onChange={setMaintenance} touch={touch} options={[
                    ['low', 'Low', 'fewer, hardier plants'], ['medium', 'Medium', 'regular watering'],
                    ['high', 'I love gardening', 'richer planting'],
                  ]} />
                  {install && scope === 'makeover' && (
                    <ChoiceChips label="The open lawn" value={lawn} onChange={setLawn} touch={touch} options={[
                      ['new', 'Lay new grass', 'turf supplied & laid'], ['keep', 'Keep my grass', 'we leave the lawn as it is'],
                    ]} />
                  )}
                </div>

                <hr style={styles.divider} />

                {/* Image Upload */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <label style={styles.sectionLabel}>Reference Photo <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <label className="upload-zone" style={{ ...styles.uploadZone, flex: 1 }}>
                      <div style={styles.uploadIcon}>
                        <Upload size={16} color="#10B981" />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                        Drop a photo of your garden space
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        PNG, JPG or WEBP · max 5MB
                      </div>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                    </label>

                    {imagePreview && (
                      <div style={{ position: 'relative', width: '88px', height: '88px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '1.5px solid #E2E8F0' }} className="group">
                        <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button" onClick={handleRemoveImage}
                          style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 700, border: 'none', cursor: 'pointer', gap: '4px' }}
                        >
                          <X size={14} /><span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {imagePreview && (
                    <ZonePicker imageUrl={imagePreview} scan={zoneScan} selected={keepClear} onChange={setKeepClear} />
                  )}
                </div>

                <hr style={styles.divider} />

                {/* Plant Picker */}
                <div>
                  <label style={styles.sectionLabel}>Your Plants <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45 }}>
                    {selectedPlantObjects.length
                      ? <>Every design will use <strong style={{ color: '#065F46' }}>only the {selectedPlantObjects.length} plant{selectedPlantObjects.length > 1 ? 's' : ''} you picked</strong>. Clear them all and we choose from the whole catalog.</>
                      : 'Pick plants and every design uses only those. Leave this empty and we choose from the whole catalog.'}
                  </p>
                  {missingLayers.length > 0 && (
                    <p role="note" style={{ margin: '0 0 10px', padding: '8px 10px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: '0.75rem', color: '#166534', lineHeight: 1.45 }}>
                      <strong>Design tip:</strong> your picks have no {missingLayers.join(' or ')} plants. Gardens look fuller with
                      tall plants at the back, mid-height in the middle and low ones in front: add one of each height for a layered design.
                    </p>
                  )}
                  {inventoryLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ height: '60px', borderRadius: '12px', background: '#F1F5F9', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      ))}
                    </div>
                  ) : inventory.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>No plants found in inventory.</p>
                  ) : (
                    <div style={styles.plantsGrid}>
                      {inventory.map(plant => {
                        const isSelected = preferredPlants.includes(String(plant.id));
                        return (
                          <button
                            key={plant.id} type="button"
                            onClick={() => handleTogglePlant(String(plant.id))}
                            className="plant-card"
                            style={styles.plantCard(isSelected)}
                          >
                            <PlantThumb item={plant} style={styles.plantPhoto} />
                            <span style={styles.plantInfo}>
                              <span style={styles.plantName(isSelected)}>{plant.name}</span>
                              <span style={styles.plantPrice(isSelected)}>₱{Number(plant.unit_price).toLocaleString()}</span>
                              <NeedChips plant={plant} />
                            </span>
                            {isSelected && (
                              <span style={styles.plantCheck}>
                                <Check size={10} color="#fff" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Botanical Compatibility Advisory */}
                  {compatibilityWarnings.length > 0 && (
                    <div style={{
                      marginTop: '1rem',
                      background: '#FFFBEB',
                      border: '1.5px solid #FCD34D',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      animation: 'fadeUp 0.3s ease-out both',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 800, fontSize: '0.85rem' }}>
                        <ShieldAlert size={17} style={{ flexShrink: 0 }} />
                        <span>Botanical Compatibility Advisory ({compatibilityWarnings.length})</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350F', lineHeight: 1.45 }}>
                        Some of the plants you picked have different sun, water or root needs. You can still generate: the layout keeps them apart as described below.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                        {compatibilityWarnings.map(w => (
                          <div key={w.id} style={{
                            background: 'rgba(255, 255, 255, 0.7)',
                            border: '1px solid #FDE68A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '0.75rem',
                          }}>
                            <div style={{ fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{w.icon}</span>
                              <span>{w.title}</span>
                            </div>
                            <div style={{ color: '#451A03', marginTop: '2px', lineHeight: 1.4 }}>
                              {w.message}
                            </div>
                            <div style={{ color: '#047857', marginTop: '4px', fontStyle: 'italic', fontSize: '0.72rem' }}>
                              💡 <strong>Horticultural tip:</strong> {w.recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Garden features: seating and accent rocks, placed before any plant */}
                {featureItems.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <label style={styles.sectionLabel}>Garden Features <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                    <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45 }}>
                      A seating spot gets open ground and a path to the house; rocks go in small groups in the planting beds.
                      They are placed first and paid for from your budget before the plants.
                    </p>
                    <div style={styles.plantsGrid}>
                      {featureItems.map(item => {
                        const id = String(item.id);
                        const qty = featureQty[id] || 0;
                        const isSeat = FEATURE_KIND[item.category] === 'seat';
                        const canAdd = isSeat ? seatTotal < MAX_SEATS : qty < MAX_ROCKS;
                        return (
                          // The card is the frame; the tap area and the counter both live inside it,
                          // so a selected card grows with its row instead of hanging a counter below it
                          <div key={id} className="plant-card"
                            style={{ ...styles.plantCard(qty > 0), cursor: 'default', opacity: !qty && !canAdd ? 0.55 : 1 }}>
                            <button type="button" onClick={() => toggleFeature(item)} aria-pressed={qty > 0}
                              disabled={!qty && !canAdd}
                              style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, width: '100%', minWidth: 0, padding: 0,
                                border: 'none', background: 'transparent', font: 'inherit', textAlign: 'left',
                                cursor: !qty && !canAdd ? 'not-allowed' : 'pointer' }}>
                              <PlantThumb item={item} style={styles.plantPhoto} />
                              <span style={styles.plantInfo}>
                                <span style={styles.plantName(qty > 0)}>{item.name}</span>
                                <span style={styles.plantPrice(qty > 0)}>₱{Number(item.unit_price).toLocaleString()} each</span>
                                <span style={{ display: 'flex', marginTop: 6 }}>
                                  <span style={chip(isSeat ? '#6D28D9' : '#475569', isSeat ? '#EDE9FE' : '#F1F5F9')}>{isSeat ? 'Seating' : 'Accent rock'}</span>
                                </span>
                              </span>
                            </button>
                            {qty > 0 && <span style={styles.plantCheck}><Check size={10} color="#fff" /></span>}
                            {qty > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                                paddingTop: 8, borderTop: '1px solid #D1FAE5' }}>
                                <button type="button" onClick={() => changeFeatureQty(item, -1)} aria-label={`One less ${item.name}`}
                                  style={styles.stepBtn(true)}>−</button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#065F46', minWidth: 0 }} aria-live="polite">
                                  {qty}<span style={{ fontWeight: 600, color: '#64748B', fontSize: '0.7rem' }}> {isSeat ? (qty > 1 ? 'seats' : 'seat') : (qty > 1 ? 'rocks' : 'rock')}</span>
                                </span>
                                <button type="button" onClick={() => changeFeatureQty(item, 1)} disabled={!canAdd} aria-label={`One more ${item.name}`}
                                  style={styles.stepBtn(canAdd)}>+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {seatTotal >= MAX_SEATS && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#64748B' }}>Up to {MAX_SEATS} seats make one seating spot.</p>
                    )}
                  </div>
                )}

                {/* Submit */}
                <button type="submit" className="submit-btn" style={styles.submitBtn}>
                  <Sparkles size={16} />
                  Generate AI Garden Designs
                </button>

                <button 
                  type="button" 
                  className="secondary-btn" 
                  style={styles.secondaryBtn} 
                  onClick={handleDesignManually}
                >
                  Design Manually from Scratch
                </button>
              </form>
            )}

            {/* Loading – skeleton cards with progressive phase text */}
            {loading && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.5rem' }}>
                  <div style={styles.spinner} />
                  <div>
                    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: '1.15rem', color: '#0F172A' }}>
                      Composing your garden…
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '3px', minHeight: '1.1em', transition: 'opacity 0.4s' }}>
                      {LOADING_PHASES[loadingPhase]}
                    </div>
                  </div>
                </div>
                <div style={carousel ? styles.layoutsCarousel : styles.layoutsGrid} className="ai-carousel">
                  {[0.7, 0.8, 0.9].map((op, i) => (
                    <div key={i} style={{ ...styles.layoutCard, opacity: op, ...(carousel ? { flex: `0 0 ${phone ? '86%' : '58%'}` } : null) }}>
                      <div style={styles.layoutCardTop}>
                        <div style={{ height: '10px', width: '60px', background: '#E2E8F0', borderRadius: '8px', marginBottom: '12px' }} />
                        <div style={{ height: '18px', width: '75%', background: '#F1F5F9', borderRadius: '8px', marginBottom: '10px' }} />
                        <div style={{ height: '28px', width: '45%', background: '#D1FAE5', borderRadius: '8px' }} />
                      </div>
                      <div style={styles.layoutBody}>
                        {[1, 0.8, 0.65, 0.5, 0.35].map((lineOp, j) => (
                          <div key={j} style={{ height: '12px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '10px', opacity: lineOp }} />
                        ))}
                        <div style={{ height: '36px', background: '#E2E8F0', borderRadius: '10px', marginTop: '1.25rem', opacity: 0.5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {!loading && generatedLayouts.length > 0 && (
              <div className="fade-in">
                <div style={styles.resultsHeader}>
                  <h2 style={styles.resultsTitle}>
                    <Sparkles size={20} color="#059669" />
                    Your Garden Options
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={handleShowVariations} className="back-btn" style={styles.backBtn}>
                      <RefreshCw size={14} />
                      Show other variations
                    </button>
                    <button onClick={handleReset} className="back-btn" style={styles.backBtn}>
                      <ArrowLeft size={14} />
                      Adjust parameters
                    </button>
                  </div>
                </div>

                {restored && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap',
                    padding: '10px 14px', background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#065F46', lineHeight: 1.45 }}>
                      <strong>Welcome back.</strong> We kept your designs{restored.edited ? ' and your changes' : ''} from {timeAgo(restored.at)}.
                      {restored.hadPhoto && !imagePreview && ' Add your yard photo again to use the photo overlay.'}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                      <button type="button" onClick={() => setRestored(null)} style={styles.editBtn(false, touch)}>OK</button>
                      <button type="button" onClick={() => { setRestored(null); handleReset(); }} style={styles.editBtn(false, touch)}>Start over</button>
                    </span>
                  </div>
                )}

                {notice && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <Cpu size={18} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: '0.8rem', color: '#1E3A8A', lineHeight: 1.45 }}>
                      {notice} Smart layouts follow the same spacing, stock and budget rules.
                    </div>
                  </div>
                )}

                {budgetWarning && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <ShieldAlert size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e' }}>Budget Note</div>
                      <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '2px', lineHeight: 1.4 }}>{budgetWarning}</div>
                    </div>
                  </div>
                )}

                <div
                  ref={carouselRef}
                  onScroll={carousel ? onCarouselScroll : undefined}
                  className="ai-carousel"
                  style={carousel ? styles.layoutsCarousel : styles.layoutsGrid}
                  role={carousel ? 'region' : undefined}
                  aria-roledescription={carousel ? 'carousel' : undefined}
                  aria-label={carousel ? 'Garden design options' : undefined}
                >
                  {generatedLayouts.map((design, index) => (
                    <div
                      key={index}
                      className="layout-card"
                      aria-label={carousel ? `Option ${index + 1} of ${generatedLayouts.length}` : undefined}
                      style={carousel
                        ? { ...styles.layoutCard, flex: `0 0 ${phone ? '86%' : '58%'}`, scrollSnapAlign: 'center' }
                        : styles.layoutCard}
                    >
                      <div style={{ ...styles.layoutCardTop, position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ ...styles.layoutBadge, marginBottom: 0 }}>Option {index + 1}</span>
                            <span title={design.source === 'ai' ? 'Designed by our AI, then checked by our design engine' : 'Designed by our rule-based design engine'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '99px',
                                       background: design.source === 'ai' ? '#ECFDF5' : '#F1F5F9', color: design.source === 'ai' ? '#047857' : '#475569', border: `1px solid ${design.source === 'ai' ? '#A7F3D0' : '#E2E8F0'}` }}>
                              {design.source === 'ai' ? <><Sparkles size={10} /> AI design</> : <><Cpu size={10} /> Smart layout</>}
                            </span>
                            {design.edited && (
                              <span title="You changed this design after it was made"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '99px',
                                         background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                                <Pencil size={10} /> Edited
                              </span>
                            )}
                          </span>
                          {design.reasoning && (
                            <div className="tooltip-container">
                              <Info size={16} className="text-[#94A3B8] hover:text-[#059669] transition-colors" />
                              <div className="tooltip-text">
                                <div className="font-bold mb-1 pb-1 border-b border-white/10 text-[#6EE7B7] text-[0.8rem]">{design.source === 'ai' ? 'AI Design Reasoning' : 'Design Approach'}</div>
                                {design.reasoning}
                              </div>
                            </div>
                          )}
                        </div>
                        <h3 style={styles.layoutName}>{design.design_name}</h3>
                        <div style={styles.layoutCost}>≈ ₱{design.total_cost.toLocaleString()}</div>
                        {design.target_budget && (underUsed(design) ? (
                          // Far under its target (beds full, cheap picks, little stock): say so plainly
                          <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: '4px', fontWeight: 700 }}>
                            Uses ₱{Number(design.total_cost).toLocaleString()} of ₱{Number(design.target_budget).toLocaleString()} · see why below
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '4px', fontWeight: 600 }}>
                            Designed for ₱{Number(design.target_budget).toLocaleString()} · {
                              { Minimalist: 'low end', Symmetrical: 'middle', 'Lush / Organic': 'top' }[design.design_name] || 'within'
                            } of your range
                          </div>
                        ))}
                      </div>
                      <div style={styles.layoutBody}>
                        {(() => {
                          const items = design.plants?.filter(p => !p.is_existing) || [];
                          const featureIds = new Set(featureItems.map(f => String(f.id)));
                          const nFeatures = items.filter(p => featureIds.has(String(p.plant_id))).length;
                          return <span style={styles.plantListLabel}>Flora Arrangement · {items.length - nFeatures} plants{nFeatures ? ` · ${nFeatures} garden feature${nFeatures > 1 ? 's' : ''}` : ''}</span>;
                        })()}
                        {(() => {
                          // A planting schedule: one row per plant with its quantity (the server's breakdown is
                          // already ordered plants → rocks → seating), not one row per plant position
                          const rows = plantingSchedule(design, catalog, featureItems);
                          const shown = rows.slice(0, 6);
                          const hidden = rows.length - shown.length;
                          return (
                            <div>
                              {shown.map(row => (
                                <div key={row.id} style={styles.plantItem}>
                                  <span style={{ ...styles.plantItemName, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <PlantThumb item={row.detail} size={24} rounded={6} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                                  </span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {row.role && <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B' }}>{row.role}</span>}
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', minWidth: 30, textAlign: 'right' }}>× {row.quantity}</span>
                                  </span>
                                </div>
                              ))}
                              {hidden > 0 && (
                                <div style={{ textAlign: 'center', padding: '10px 0 2px', fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                                  + {hidden} more kind{hidden > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {design.adjustments?.length > 0 && (
                          <div style={{ marginTop: '0.75rem', padding: '8px 10px', borderRadius: '8px', background: '#F1F5F9', fontSize: '0.72rem', color: '#475569', lineHeight: 1.45 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                              <Wrench size={11} /> What we adjusted
                            </div>
                            {design.adjustments.map((note, ni) => <div key={ni}>• {note}</div>)}
                          </div>
                        )}
                        {design.budget_note && (underUsed(design) ? (
                          <div role="note" style={{ marginTop: '0.6rem', padding: '8px 10px', borderRadius: '8px', background: '#FFFBEB',
                            border: '1px solid #FDE68A', fontSize: '0.74rem', color: '#78350F', lineHeight: 1.45 }}>
                            <Info size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{design.budget_note}
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#64748B', lineHeight: 1.45 }}>
                            <Info size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />{design.budget_note}
                          </div>
                        ))}
                        {/* Cost Breakdown — always visible */}
                        {design.cost_breakdown && (
                          <div style={{ marginTop: '1rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '8px' }}>
                              Cost Breakdown
                            </div>
                            {(design.cost_breakdown.lines || []).map(line => (
                              <div key={line.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '8px', background: line.key === 'plants' ? '#ECFDF5' : '#F8FAFC', marginBottom: '3px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155' }}>{line.label}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', whiteSpace: 'nowrap' }}>
                                  ₱{Number(line.amount).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            <div style={{ padding: '10px', borderRadius: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Estimated total
                                </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                                  ₱{Number(design.cost_breakdown.low).toLocaleString()}–₱{Number(design.cost_breakdown.high).toLocaleString()}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.66rem', color: '#64748B', marginTop: '3px' }}>
                                Final price confirmed after a site inspection.
                              </div>
                            </div>

                            {/* Plant BOM — still togglable */}
                            <button
                              type="button"
                              onClick={() => toggleBreakdown(index)}
                              style={{ background: 'transparent', border: 'none', color: '#059669', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 0 0', outline: 'none' }}
                            >
                              {expandedBreakdowns[index] ? 'Hide Plant List ▲' : 'View Plant List ▼'}
                            </button>
                            {expandedBreakdowns[index] && (
                              <div style={{ marginTop: '8px', overflowX: 'auto' }} className="fade-in">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1.5px solid #E2E8F0' }}>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700 }}>Item</th>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700, textAlign: 'center' }}>Qty</th>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700, textAlign: 'right' }}>Unit</th>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700, textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(design.plant_breakdown || []).map((item, itemIdx) => (
                                      <tr key={itemIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '8px 4px', fontWeight: 600, color: '#1E293B' }}><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PlantThumb item={catalog.find(i => String(i.id) === String(item.plant_id)) || catalog.find(i => i.name === item.name)} size={22} rounded={5} /> {item.name}</span></td>
                                        <td style={{ padding: '8px 4px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>{item.quantity}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', color: '#64748B' }}>₱{Number(item.unit_price).toLocaleString()}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>₱{Number(item.subtotal).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => handleSelectLayout(design)}
                          className="select-btn"
                          style={styles.selectBtn}
                        >
                          View in 3D →
                        </button>
                        <button
                          onClick={() => handleEditInStudio(design)}
                          className="secondary-btn"
                          style={{ ...styles.secondaryBtn, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          title="Open this design in the 3D Studio to move, add or swap plants"
                        >
                          <Box size={14} /> Edit in Studio
                        </button>
                        {(Number(lotWidth) > LOT_MAX || Number(lotLength) > LOT_MAX) && (
                          <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: '#92400E', lineHeight: 1.4 }}>
                            The 3D Studio handles up to {LOT_MAX} × {LOT_MAX} m: it opens on a {LOT_MAX} m lot and offers to move plants beyond it inside.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Carousel controls: arrows + one dot per option */}
                {carousel && generatedLayouts.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '10px' }}>
                    <button type="button" onClick={() => goToSlide(slide - 1)} disabled={slide === 0} aria-label="Previous option"
                      className="carousel-arrow" style={{ ...styles.carouselArrow, opacity: slide === 0 ? 0.35 : 1 }}>
                      <ChevronLeft size={18} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {generatedLayouts.map((d, i) => (
                        <button key={i} type="button" onClick={() => goToSlide(i)} aria-label={`Show option ${i + 1}: ${d.design_name}`}
                          aria-current={slide === i}
                          style={{ width: slide === i ? 22 : 8, height: 8, borderRadius: 99, border: 'none', padding: 0, cursor: 'pointer',
                                   background: slide === i ? color.brand : '#CBD5E1', transition: 'all 0.25s' }} />
                      ))}
                    </div>
                    <button type="button" onClick={() => goToSlide(slide + 1)} disabled={slide === generatedLayouts.length - 1} aria-label="Next option"
                      className="carousel-arrow" style={{ ...styles.carouselArrow, opacity: slide === generatedLayouts.length - 1 ? 0.35 : 1 }}>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
                {carousel && generatedLayouts[slide] && (
                  <p style={{ textAlign: 'center', fontSize: '0.75rem', color: color.muted, margin: '6px 0 0', fontWeight: 600 }}>
                    Option {slide + 1} of {generatedLayouts.length} · {generatedLayouts[slide].design_name} · swipe to compare
                  </p>
                )}

                {/* 3D / AR Preview */}
                {activeLayout && (
                  <div ref={previewRef} style={{ ...styles.previewPanel, scrollMarginTop: '72px' }} className="fade-in">
                    <div style={styles.previewHeader}>
                      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <h3 style={{ ...styles.previewTitle, margin: 0 }}>{activeLayout.design_name}</h3>
                          {/* View switch (segmented control) */}
                          <div role="tablist" aria-label="Preview mode" style={{
                            display: 'flex',
                            width: phone ? '100%' : 'auto',
                            background: color.divider,
                            border: `1px solid ${color.border}`,
                            borderRadius: '10px',
                            padding: '3px',
                            gap: '2px',
                          }}>
                            {[
                              { key: '3d', label: phone ? '3D view' : 'Interactive 3D Canvas' },
                              { key: 'ar', label: phone ? 'Photo overlay' : 'Photo Overlay Preview' },
                            ].map(tab => (
                              <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={activeView === tab.key}
                                onClick={() => openView(tab.key)}
                                style={{
                                  flex: phone ? 1 : 'none',
                                  padding: phone ? '9px 10px' : '6px 13px',
                                  borderRadius: '7px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  transition: 'all 0.2s',
                                  background: activeView === tab.key ? color.white : 'transparent',
                                  color: activeView === tab.key ? color.brandDeep : color.muted,
                                  boxShadow: activeView === tab.key ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p style={styles.previewSub}>
                          {activeView === 'ar' && editingCorners
                            ? (pinMode === 'corners'
                              ? 'Drag the 4 yellow pins onto the corners of your yard. The design moves with them.'
                              : 'Put the two "Back" pins on the far corners of your yard, and the "side" pins anywhere along the left and right edges (fence lines), as near you as you can see them.')
                            : activeView === 'ar'
                              ? (touch ? 'Seen from where you took the photo · tap a plant to move, turn or remove it'
                                : 'Seen from where you took the photo · drag a plant to move it, click it to turn or remove it')
                              : touch
                                ? 'Tap a plant to see its height, then drag it to move it · drag the ground to rotate · pinch to zoom'
                                : 'Drag a plant to move it, click it to turn or remove it · drag the ground to rotate · scroll to zoom'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {activeView === 'ar' && imagePreview && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!editingCorners && !photoCorners) setPhotoCorners(defaultPins(pinMode));
                              setEditingCorners(v => !v);
                            }}
                            style={{
                              minHeight: touch ? 44 : 34,
                              padding: '7px 14px',
                              background: editingCorners ? 'rgba(251,191,36,0.15)' : 'transparent',
                              border: `1.5px solid ${editingCorners ? '#d97706' : '#CBD5E1'}`,
                              color: editingCorners ? '#b45309' : '#64748B',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.18s',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {editingCorners ? '✓ Done' : '⊕ Line up with my yard'}
                          </button>
                        )}
                        <div style={{ ...styles.previewCostBadge, opacity: activeLayout.pricing === 'pending' ? 0.55 : 1 }}
                          aria-live="polite" title={activeLayout.pricing === 'pending' ? 'Updating the price…' : undefined}>
                          ₱{activeLayout.total_cost.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Editing: this design is a starting point the customer can change */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap', margin: '0 0 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700,
                        color: activeLayout.edited ? '#92400E' : color.muted }}>
                        {activeLayout.edited
                          ? <><Pencil size={13} aria-hidden="true" /> Edited by you{activeLayout.pricing === 'pending' ? ' · updating the price…' : ''}</>
                          : <><Sparkles size={13} aria-hidden="true" /> AI draft: make it yours by moving, turning or removing things</>}
                      </span>
                      {activeLayout.design_name === 'Symmetrical' && (
                        <button type="button" aria-pressed={mirrorOn} onClick={() => { setMirrorOn(v => !v); setMirrorNote(''); }}
                          title="Change one plant of a mirrored pair and its partner on the other side changes too"
                          style={{ ...styles.editBtn(false, touch), background: mirrorOn ? '#ECFDF5' : color.white,
                            borderColor: mirrorOn ? '#10B981' : color.border, color: mirrorOn ? '#065F46' : color.muted }}>
                          <FlipHorizontal2 size={14} aria-hidden="true" /> Mirror my changes: {mirrorOn ? 'on' : 'off'}
                        </button>
                      )}
                      <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => openPanel(editPanel?.mode === 'add' ? null : { mode: 'add' })}
                          aria-expanded={editPanel?.mode === 'add'} style={styles.editBtn(false, touch)}>
                          <Plus size={14} aria-hidden="true" /> Add
                        </button>
                        <button type="button" onClick={handleUndo} disabled={!(editHistory[activeLayout.edit_id] || []).length}
                          style={styles.editBtn(!(editHistory[activeLayout.edit_id] || []).length, touch)}>
                          <Undo2 size={14} aria-hidden="true" /> Undo
                        </button>
                        {activeLayout.edited && (
                          <button type="button" onClick={handleResetEdits} style={styles.editBtn(false, touch)}>
                            <RotateCcw size={14} aria-hidden="true" /> Reset to AI design
                          </button>
                        )}
                      </span>
                    </div>

                    {mirrorNote && (
                      <p role="status" style={{ margin: '-4px 0 8px', fontSize: '0.75rem', fontWeight: 600, color: '#065F46', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FlipHorizontal2 size={13} aria-hidden="true" /> {mirrorNote}
                      </p>
                    )}

                    {activeLayout.edited && budgetRange?.max > 0 && (() => {
                      const total = Number(activeLayout.total_cost) || 0;
                      const min = Number(budgetRange.min) || 0, max = Number(budgetRange.max);
                      const over = total - max;
                      const pct = Math.min(100, (total / max) * 100);
                      return (
                        <div style={{ margin: '0 0 10px' }} aria-live="polite">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 700,
                            color: over > 0 ? '#B45309' : color.muted }}>
                            <span>{activeLayout.pricing === 'pending' ? 'Updating…' : `₱${total.toLocaleString()}`} of your ₱{min.toLocaleString()}–₱{max.toLocaleString()} budget</span>
                            {over > 0 && activeLayout.pricing !== 'pending' && <span>₱{Math.round(over).toLocaleString()} over: remove or swap something to bring it back</span>}
                          </div>
                          <div role="img" aria-label={`Total ${Math.round(pct)}% of your top budget`}
                            style={{ position: 'relative', height: 6, borderRadius: 99, background: color.divider, marginTop: 5, overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, borderRadius: 99,
                              background: over > 0 ? '#F59E0B' : color.brand, transition: 'width 0.3s' }} />
                            {min > 0 && min < max && (
                              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(min / max) * 100}%`, width: 2, background: 'rgba(15,23,42,0.35)' }} />
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {editPanel?.mode === 'add' && (
                      <EditPicker title="Add to this design" touch={touch} busy={panelBusy} error={panelError}
                        hint={`We'll put it where it fits best (tall at the back, small at the front). Then drag it anywhere.${costTerms.install ? ' Prices include planting.' : ''}`}
                        sections={addSections} onPick={handleAdd} onClose={() => setEditPanel(null)} costOf={addCost}
                        emptyText="Everything in our catalog is already used up in this design." />
                    )}
                    {editPanel?.mode === 'swap' && swapItem && (
                      <EditPicker title={`Swap ${swapItem.name} for…`} touch={touch} busy={panelBusy} error={panelError}
                        hint={(swapItem.category || 'plant') === 'plant'
                          ? `Similar plants that grow to a similar height (${layerOf(swapItem) === 'tall' ? 'tall, for the back' : layerOf(swapItem) === 'mid' ? 'medium height' : 'low, for the front'}), in stock.`
                          : 'Similar items in stock.'}
                        sections={[{ label: 'Similar', options: swapOptions }]} onPick={handleSwap} onClose={() => setEditPanel(null)} costOf={swapCost}
                        emptyText={`No similar ${(swapItem.category || 'plant') === 'plant' ? 'plants' : 'items'} in stock right now. You can remove it or add something else.`} />
                    )}

                    <div style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative', height: phone ? 340 : 450 }}>
                      <ThreeGardenCanvas
                        height={phone ? 340 : 450}
                        plants={activeLayout.plants}
                        gardenPlan={activeLayout.garden_plan}
                        lotWidth={Number(lotWidth)}
                        lotLength={Number(lotLength)}
                        backgroundImageUrl={imagePreview}
                        arMode={activeView === 'ar'}
                        arGrid={activeView === 'ar' && editingCorners}
                        photoCorners={photoSetup}
                        editCorners={activeView === 'ar' && editingCorners}
                        onCornersChange={setPhotoCorners}
                        onPoseStatus={setPoseStatus}
                        photoTone={activeView === 'ar' ? photoTone : null}
                        editable
                        onPlantsChange={handlePlantsEdit}
                        growthStage={growthStage}
                        notesByUid={notesByUid}
                        onSwapRequest={(uid) => openPanel({ mode: 'swap', uid })}
                        previewMoves={tidyPreview?.moves || null}
                        focus={focusReq}
                      />
                      {!(activeView === 'ar' && editingCorners) && (
                        <GrowthStagePicker value={growthStage} onChange={setGrowthStage} short={phone}
                          style={{ position: 'absolute', top: 10, left: 10, zIndex: 5 }} />
                      )}

                      {activeView === 'ar' && !imagePreview && (
                        <div style={{
                          position: 'absolute',
                          bottom: '16px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(15,23,42,0.85)',
                          color: '#F8FAFC',
                          padding: '8px 20px',
                          borderRadius: '100px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backdropFilter: 'blur(8px)',
                          width: 'max-content',
                          maxWidth: 'calc(100% - 24px)',
                          textAlign: 'center',
                          pointerEvents: 'none',
                        }}>
                          Upload a garden photo above to enable the overlay effect
                        </div>
                      )}
                    </div>

                    {activeView === 'ar' && imagePreview && editingCorners && (
                      <div role="radiogroup" aria-label="Front corners of the yard"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: '0.8rem', color: color.muted }}>
                        <span style={{ fontWeight: 600 }}>The front corners of my yard are</span>
                        {[['edges', 'out of the photo'], ['corners', 'in the photo']].map(([mode, label]) => (
                          <button key={mode} type="button" role="radio" aria-checked={pinMode === mode}
                            onClick={() => { if (pinMode !== mode) { setPinMode(mode); setPhotoCorners(defaultPins(mode)); } }}
                            style={{ minHeight: touch ? 44 : 32, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                              fontSize: '0.75rem', border: `1.5px solid ${pinMode === mode ? '#d97706' : '#CBD5E1'}`,
                              background: pinMode === mode ? 'rgba(251,191,36,0.15)' : 'transparent',
                              color: pinMode === mode ? '#b45309' : '#64748B' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeView === 'ar' && imagePreview && poseStatus && (() => {
                      const note = !poseStatus.ok
                        ? (poseStatus.reason === 'upside_down'
                          ? (poseStatus.mode === 'corners'
                            ? 'The "Back" pins go on the far side of the yard (higher in the photo), the "Front" pins on the near side.'
                            : 'The "Back" pins go on the far corners of the yard (higher in the photo); the side pins nearer you, lower down.')
                          : 'Those pins don\'t outline the yard: check that no two sides cross.')
                        : poseStatus.fitWarn
                          ? (poseStatus.suggestedLength
                            ? `These pins fit a yard about ${lotWidth} × ${poseStatus.suggestedLength} m, but the size above is ${lotWidth} × ${lotLength} m. Fix the size (then generate again), or move a pin.`
                            : `The pins don't match a ${lotWidth} × ${lotLength} m yard. Check the yard size above, or move a pin.`)
                          : poseStatus.heightWarn
                            ? `These pins put the camera about ${poseStatus.cameraHeight.toFixed(1)} m above the ground. If you took the photo standing in the yard, check the yard width (${lotWidth} m) or move the "Back" pins onto the far corners.`
                            : poseStatus.guessed && !editingCorners
                              ? 'This is a rough placement. Tap "Line up with my yard" and drag the pins onto your yard for an exact match.'
                              : null;
                      return note && (
                        <p role="status" style={{ margin: '10px 0 0', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.5,
                          color: poseStatus.ok && poseStatus.guessed ? color.muted : '#b45309' }}>{note}</p>
                      );
                    })()}

                    {(activeLayout.notes?.length > 0 || tidyNote) && (
                      <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid #FDE68A', background: '#FFFBEB' }}>
                        {activeLayout.notes?.length > 0 && (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.85rem', color: '#92400E' }}>
                                  <AlertTriangle size={15} aria-hidden="true" /> Designer's notes · {activeLayout.notes.length} {activeLayout.notes.length === 1 ? 'thing' : 'things'} to check
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#A16207', marginTop: 2 }}>
                                  Suggestions only: the design is yours. The plants in question have an amber ring.
                                </div>
                              </div>
                              {!tidyPreview && (
                                <button type="button" onClick={handleTidy} disabled={tidying}
                                  style={{ ...styles.editBtn(tidying, touch), borderColor: '#F59E0B', color: '#92400E' }}>
                                  <Wand2 size={14} aria-hidden="true" /> {tidying ? 'Working it out…' : 'Tidy up for me'}
                                </button>
                              )}
                            </div>
                            {tidyPreview && (
                              <div role="status" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E3A8A' }}>
                                  Tidy would move {tidyPreview.moves.length} {tidyPreview.moves.length === 1 ? 'item' : 'items'}: see the blue rings and dashed lines in 3D.
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#1E40AF', marginTop: 2 }}>
                                  Nothing changes until you apply it{tidyPreview.left > 0 ? ` (${tidyPreview.left} ${tidyPreview.left === 1 ? 'note stays' : 'notes stay'}: not enough room)` : ''}.
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                  <button type="button" onClick={applyTidy}
                                    style={{ ...styles.editBtn(false, touch), background: '#2563EB', borderColor: '#2563EB', color: '#fff' }}>
                                    <Check size={14} aria-hidden="true" /> Apply these moves
                                  </button>
                                  <button type="button" onClick={() => setTidyPreview(null)} style={styles.editBtn(false, touch)}>Cancel</button>
                                </div>
                              </div>
                            )}
                            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.8rem', color: '#78350F', lineHeight: 1.5 }}>
                              {activeLayout.notes.slice(0, 5).map((n, i) => <li key={i}>{n.message}</li>)}
                            </ul>
                            {activeLayout.notes.length > 5 && (
                              <div style={{ fontSize: '0.75rem', color: '#A16207', marginTop: 4 }}>and {activeLayout.notes.length - 5} more: look for the amber rings.</div>
                            )}
                          </>
                        )}
                        {tidyNote && (
                          <p role="status" style={{ margin: activeLayout.notes?.length ? '8px 0 0' : 0, fontSize: '0.8rem', fontWeight: 600, color: '#065F46' }}>
                            <Wand2 size={13} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4 }} />{tidyNote}{' '}
                            {(editHistory[activeLayout.edit_id] || []).length > 0 && 'Undo puts things back.'}
                          </p>
                        )}
                      </div>
                    )}

                    {activeLayout.pricing === 'error' && (
                      <p role="alert" style={{ margin: '10px 0 0', fontSize: '0.8rem', fontWeight: 600, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        We couldn't update the price after your change.
                        <button type="button" onClick={() => { patchLayout(activeLayout.edit_id, { pricing: 'pending' }); reprice(activeLayout.edit_id); }}
                          style={styles.editBtn(false, touch)}>
                          <RefreshCw size={14} aria-hidden="true" /> Try again
                        </button>
                      </p>
                    )}

                    {/* Book This Design CTA */}
                    <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: phone ? 'stretch' : 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleBookDesign}
                        disabled={bookingLoading || activeLayout.pricing === 'pending' || activeLayout.pricing === 'error'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          width: phone ? '100%' : 'auto',
                          padding: phone ? '13px 18px' : '11px 22px',
                          textAlign: 'center',
                          background: color.brand,
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          border: 'none',
                          borderRadius: `${radius.button}px`,
                          cursor: bookingLoading ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 14px rgba(16,185,129,0.2)',
                          letterSpacing: '0.01em',
                          transition: 'all 0.18s',
                          opacity: bookingLoading ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!bookingLoading) e.currentTarget.style.background = color.brandDark; }}
                        onMouseLeave={e => { e.currentTarget.style.background = color.brand; }}
                      >
                         <CalendarPlus size={15} />
                         {bookingLoading ? 'Saving Design…' : activeLayout.pricing === 'pending' ? 'Updating the price…'
                           : (activeLayout.price_ctx?.install ?? install) ? 'Book Final Site Inspection & Consultation'
                           : (activeLayout?.plant_breakdown || []).some(r => (r.category || 'plant') !== 'plant') ? 'Add these items to my cart' : 'Add these plants to my cart'}
                       </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {showAuthModal && (
        <GuestAuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={() => { setShowAuthModal(false); handleBookDesign(); }}
        />
      )}
    </>
  );
}
