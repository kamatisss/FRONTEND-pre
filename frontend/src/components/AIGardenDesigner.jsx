import React, { useState, useEffect, useEffectEvent, useRef, useMemo } from 'react';
import { evaluatePlantCompatibility } from '../data/plantCompatibility';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ArrowLeft, Camera, Check, ShieldAlert, Upload, X, CalendarPlus, Info, Cpu, Wrench, RefreshCw, Box, ChevronLeft, ChevronRight, Leaf, Sun, CloudSun, Cloud, Droplet, Undo2, RotateCcw, Pencil, AlertTriangle, Wand2, Plus, FlipHorizontal2, Link2, Download, ImageDown, FileText, Grid3x3 } from 'lucide-react';
import { useToast } from './ui/Toast';
import { saveBlob, glbFileName, designFileName, fileSize } from './ui/download';
import { productImage } from '../data/productImage';
import YardSurvey from './YardSurvey';
import YardShapeStep from './YardShapeStep';
import { emptySurvey, newId, yardArea } from '../data/yardSurvey';
import BudgetPicker from './BudgetPicker';
import { color, cardStyle, inputStyle, labelStyle, radius } from './ui/tokens';
import { useCart } from '../context/CartContext';
import { lotPlantsToStudioItems } from '../data/sampleGarden';
import { API_BASE_URL as API_ROOT } from '../config';
import { plantBudgetFromAllIn, itemCostToCustomer, isSmallStone, layoutSpacing, layoutLayer, rockLimits, featureKind, featureLimits } from '../data/pricing';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import { yardSummary, hasSurvey } from '../data/yardScene';
import { useDesign } from '../context/DesignContext';
import api, { getInventoryItems, getPricing, shareDesign, stopSharingDesign, downloadDesignProposal } from '../services/api';
import { queuePreview } from '../data/designPreview';
import { MODEL_CREDITS } from '../data/modelCredits';
import ShareDesignDialog from './ShareDesignDialog';
import { useAuth } from '../context/AuthContext';
import { saveGuestDesign, loadGuestDesign, clearGuestDesign, saveAiSession, loadAiSession, clearAiSession, loadAiPrefill, clearAiPrefill } from '../services/guestSession';
import GuestAuthModal from './GuestAuthModal';
import { useIsPhone, useMediaQuery } from './ui/useMediaQuery';
import { DEFAULT_TIME_OF_DAY } from '../data/studioLight';
import { defaultPins, vantageOf } from '../data/photoPose';
import { readFocal35 } from '../data/photoExif';
import { LOT_MAX } from '../data/lot';
import { DEFAULT_GROWTH_STAGE, growthLabel } from '../data/modelSizing';
import GrowthStagePicker from './GrowthStagePicker';
import SunControl from './SunControl';
import { SUN_SEASONS, surveyFacing } from '../data/sunPath';
import LawnLookSelect from './LawnLookSelect';
import { useLawnLook } from '../data/lawnLook';
import { editSummary } from '../data/designEdits';
import { mirrorEdit } from '../data/mirrorEdit';

import InstallOffer from './InstallOffer';
import { PHOTO_ACCEPT, photoProblem } from '../services/fileCheck';
const LOADING_PHASES = [
  'Analyzing your garden space…',
  'Composing Symmetrical layout…',
  'Composing Minimalist layout…',
  'Composing Lush / Organic layout…',
  'Balancing flora and budget…',
  'Finalizing your garden options…',
];

// Garden features the AI Designer places (mirrors garden_ai.FEATURE_CATEGORIES / MAX_SEATS; rocks: rockLimits, pots,
// lights and water features: featureLimits by yard size). Kind = featureKind (the item's feature_type, else by category).
// first: how many a tap selects (a pair of pots frames the way in; a few lights start a walkway)
const FEATURE_INFO = {
  seat: { label: 'Seating', unit: ['seat', 'seats'], fg: '#6D28D9', bg: '#EDE9FE', first: 1 },
  rock: { label: 'Accent boulder', unit: ['rock', 'rocks'], fg: '#475569', bg: '#F1F5F9', first: 3 },
  pot: { label: 'Pot / planter', unit: ['pot', 'pots'], fg: '#9A3412', bg: '#FFEDD5', first: 2 },
  light: { label: 'Garden light', unit: ['light', 'lights'], fg: '#A16207', bg: '#FEF9C3', first: 4 },
  water: { label: 'Water feature', unit: ['water feature', 'water features'], fg: '#0369A1', bg: '#E0F2FE', first: 1 },
};
const MAX_SEATS = 2;
const ROCK_GROUP = 3;
// Small garden stones (data/pricing isSmallStone): ordered half a dozen at a time, from a dozen
const STONE_STEP = 6;
const STONE_FIRST = 12;

// Where a plant goes in the design, by fully grown height — the same layers as the layout engine
// (layout_engine.PlantSpec.layer): tall at the back, low along the borders
const roleOf = (item) => {
  if (!item) return null;
  const kind = featureKind(item);
  if (kind) return kind === 'rock' ? 'Accent' : FEATURE_INFO[kind].label;
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
// The AI Designer's guided form. Only step 1 (the yard size) is required.
const FORM_STEPS = [
  { n: 1, title: 'Your yard', short: 'Yard', hint: 'How big is it and what shape? A photo is optional but makes the design fit better.' },
  { n: 2, title: 'Budget & style', short: 'Budget', hint: 'What you want to spend and how the garden should feel.' },
  { n: 3, title: 'Plants & features', short: 'Plants', hint: 'Optional: skip this and we choose from our whole catalog.' },
  { n: 4, title: 'Review & generate', short: 'Review', hint: 'Check your answers, then we make 3 designs to compare in 3D.' },
];
// "See an example first": a typical backyard, so a first-time customer sees what they get before measuring
// anything. A door from the house and a tree that stays show that the designs plan around what's there.
// Engine designs only (example=1): it never uses the customer's daily AI designs.
const EXAMPLE_YARD = { width: 10, length: 8 };
const exampleSurvey = () => ({
  ...emptySurvey(),
  items: [
    { id: newId(), kind: 'entry', x: 5, z: 8, edge: 'front' },
    { id: newId(), kind: 'keep', x: 2, z: 1.5, r: 1.5, label: 'Mango tree' },
  ],
});
const photoSentence = (facts) => (facts.length > 1 ? `${facts.slice(0, -1).join(', ')} and ${facts[facts.length - 1]}` : facts[0]);
const SUN_LABELS = { full: 'Full sun', part: 'Part sun', shade: 'Mostly shade' };
const UPKEEP_LABELS = { low: 'Low upkeep', medium: 'Medium upkeep', high: 'I love gardening' };

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
// Progress for the guided form: numbered steps joined by a line; done steps show a tick. Every step is a
// button (the parent checks the yard size before letting the customer past step 1).
function FormStepper({ step, onStep, phone }) {
  return (
    <ol aria-label="Steps" style={{ listStyle: 'none', margin: '0 0 1.25rem', padding: 0, display: 'flex', alignItems: 'flex-start' }}>
      {FORM_STEPS.map((s, i) => {
        const done = s.n < step, current = s.n === step;
        return (
          <li key={s.n} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            {i > 0 && (
              <span aria-hidden="true" style={{ position: 'absolute', top: 15, right: '50%', width: '100%', height: 2,
                background: s.n <= step ? '#10B981' : '#E2E8F0', transition: 'background 0.25s' }} />
            )}
            <button type="button" onClick={() => onStep(s.n)} aria-current={current ? 'step' : undefined}
              aria-label={`Step ${s.n} of ${FORM_STEPS.length}: ${s.title}${done ? ' (done)' : ''}`}
              style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%',
                padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.25s',
                background: done ? '#10B981' : current ? '#ECFDF5' : '#fff',
                color: done ? '#fff' : current ? '#047857' : '#94A3B8',
                border: `2px solid ${done || current ? '#10B981' : '#E2E8F0'}`,
                boxShadow: current ? '0 0 0 4px rgba(16,185,129,0.15)' : 'none' }}>
                {done ? <Check size={15} aria-hidden="true" /> : s.n}
              </span>
              <span style={{ fontSize: phone ? '0.7rem' : '0.78rem', fontWeight: current ? 800 : 600, lineHeight: 1.25, textAlign: 'center',
                color: current ? '#0F172A' : done ? '#047857' : '#94A3B8', padding: '0 2px' }}>
                {phone ? s.short : s.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// Step 4: the customer's answers, one row each, with "Change" taking them back to that step
function ReviewAnswers({ rows, onEdit }) {
  return (
    <dl style={{ margin: 0, border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
          borderTop: i ? '1px solid #F1F5F9' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <dt style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8' }}>{r.label}</dt>
            <dd style={{ margin: '3px 0 0', fontSize: '0.88rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.45 }}>{r.value}</dd>
            {r.note && <dd style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#B45309', lineHeight: 1.4 }}>{r.note}</dd>}
          </div>
          <button type="button" onClick={() => onEdit(r.step)} aria-label={`Change ${r.label.toLowerCase()}`}
            style={{ flexShrink: 0, minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff',
              color: '#047857', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Change
          </button>
        </div>
      ))}
    </dl>
  );
}

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
    ? design.plant_breakdown.map(r => ({ id: String(r.plant_id), quantity: r.quantity, name: r.name, unit: r.unit }))
    : null;
  if (!rows) {
    const counts = new Map();
    (design.plants || []).filter(p => !p.is_existing).forEach(p => counts.set(String(p.plant_id), (counts.get(String(p.plant_id)) || 0) + 1));
    rows = [...counts].map(([id, quantity]) => ({ id, quantity }));
  }
  return rows.map(r => {
    const detail = find(r.id);
    return { ...r, detail, name: r.name || detail?.name || `Plant #${r.id}`, role: detail?.is_groundcover ? 'Groundcover' : roleOf(detail) };
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
  const { addToCart, addCartNotices } = useCart();
  const [rates, setRates] = useState(null);   // admin rate card
  useEffect(() => { getPricing().then(setRates).catch(() => {}); }, []);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  // A failed load (server restarting, a dropped connection) is retried a few times, then said plainly with a
  // Retry button — never shown as an empty catalog
  const [inventoryError, setInventoryError] = useState(false);
  const [inventoryTry, setInventoryTry] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = (attempt) => getInventoryItems('plant').catch((err) => {
      if (attempt >= 2) throw err;
      return new Promise((r) => setTimeout(r, 1500 * (attempt + 1))).then(() => (alive ? load(attempt + 1) : []));
    });
    load(0)
      .then(data => { if (alive) { setInventory(Array.isArray(data) ? data : []); setInventoryError(false); } })
      .catch(() => { if (alive) setInventoryError(true); })
      .finally(() => { if (alive) setInventoryLoading(false); });
    return () => { alive = false; };
  }, [inventoryTry]);
  const retryInventory = () => { setInventoryLoading(true); setInventoryError(false); setInventoryTry(n => n + 1); };

  // Garden features the designer can place: seating (furniture) and accent rocks (hardscape) with a 3D model
  const [featureItems, setFeatureItems] = useState([]);
  useEffect(() => {
    let alive = true;
    getInventoryItems()
      .then(data => {
        if (!alive) return;
        setFeatureItems((data || []).filter(i => FEATURE_INFO[featureKind(i)] && i.model_file && Number(i.stock_quantity) > 0));
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
  const seatTotal = featureItems.filter(i => featureKind(i) === 'seat')
    .reduce((n, i) => n + (featureQty[String(i.id)] || 0), 0);
  const toggleFeature = (item) => {
    const id = String(item.id);
    setFeatureQty(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = isSmallStone(item) ? Math.min(STONE_FIRST, Number(item.stock_quantity) || 0)
        : Math.min(FEATURE_INFO[featureKind(item)].first, limitOf(item), Number(item.stock_quantity) || 0) || 1;
      return next;
    });
  };
  const changeFeatureQty = (item, delta) => {
    const id = String(item.id);
    setFeatureQty(prev => {
      const stone = isSmallStone(item);
      const max = featureKind(item) === 'seat' ? (prev[id] || 0) + MAX_SEATS - seatTotal : limitOf(item);
      const qty = Math.min(max, Math.min(Number(item.stock_quantity) || 0, (prev[id] || 0) + delta * (stone ? STONE_STEP : 1)));
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
  const [plantQty, setPlantQty] = useState({});   // { plant id: how many } — only for amounts the customer set
  // Groundcover over the beds between plants (backend groundcover.py): on by default, as landscapers plant
  const [groundcoverOn, setGroundcoverOn] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [photoError, setPhotoError] = useState('');   // why the picked file can't be used (not a photo, too big…)
  const [photoOver, setPhotoOver] = useState(false);  // a file is being dragged over the drop zone
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
    // With the engine's short headline for this plant (stage 3): { point, advice, kind }; older notes: the sentence
    (activeNotes || []).forEach(n => (n.uids || []).forEach(u => {
      if (!u) return;
      const short = n.short_by_uid?.[u];
      (out[u] = out[u] || []).push(short ? { point: short, advice: n.advice || n.message, kind: n.kind } : n.message);
    }));
    return out;
  }, [activeNotes]);
  const [growthStage, setGrowthStage] = useState(DEFAULT_GROWTH_STAGE);
  const [sunView, setSunView] = useState(null);   // { hour, season }: the real sun and shadows (SunControl), null = off
  const [mirrorOn, setMirrorOn] = useState(true);   // Symmetrical designs: "Mirror my changes"
  const [mirrorNote, setMirrorNote] = useState('');
  const [activeView, setActiveView] = useState('3d');
  const [showGrid, setShowGrid] = useState(false);   // 1 m grid over the lot in the 3D view
  const [lawnLook, setLawnLook] = useLawnLook();   // how long the lawn's grass is in the 3D view (remembered)
  // 3D view ground: the design's beds and lawn, or their own ground from the yard photo (null = the default:
  // their photo when we plant into the garden as it is, the design otherwise)
  const [groundChoice, setGroundChoice] = useState(null);
  const [photoGroundStatus, setPhotoGroundStatus] = useState(null);
  const phone = useIsPhone();
  const touch = useMediaQuery('(pointer: coarse)');
  // The form is a short guided flow (FORM_STEPS): 1 yard · 2 budget & style · 3 plants & features · 4 review.
  // Only the yard size is required, so "Generate" is offered from step 2 on. Every step stays mounted (just
  // hidden), so the yard survey and the plant picker keep their own state while the customer moves around.
  const [formStep, setFormStep] = useState(1);
  const [lotProblem, setLotProblem] = useState('');
  const cardRef = useRef(null);
  // Bring the top of the main card into view (below the 60 px top bar), only when it is above the screen
  const scrollToCard = () => {
    const el = cardRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 60) window.scrollTo({ top: window.scrollY + top - 72, behavior: 'smooth' });
  };
  const [bookingLoading, setBookingLoading] = useState(false);
  // Photo overlay: four pins on the yard's corners in the photo (null = not placed yet, a guess is used)
  const [photoCorners, setPhotoCorners] = useState(null);   // the 4 pins on the photo ({u, v} each)
  // 'fences' (default): back corners + two pins on each side fence; 'edges' (older designs): one per side fence; (the usual photo: the front corners are out of
  // shot); 'corners': all four corners are visible. photoLens: 35 mm-equivalent focal length from EXIF.
  const [pinMode, setPinMode] = useState('fences');   // six pins: back corners + two on each side fence
  const [photoLens, setPhotoLens] = useState(null);
  // 'points' (a yard that isn't a rectangle): each pin sits on a known spot, pinAnchors [{x, z, label, corner?}]
  const [pinAnchors, setPinAnchors] = useState(null);
  // Where the photo was taken from (photoPose VANTAGES): standing, upstairs window… sets the camera height we expect
  const [photoVantage, setPhotoVantage] = useState('ground');
  // The yard's width at the house side ({ width, lean }), when it differs from the back: six fence pins then measure the taper
  const [photoFront, setPhotoFront] = useState(null);
  const photoSetup = useMemo(() => (photoCorners
    ? { pins: photoCorners, mode: pinMode, focal35: photoLens, vantage: photoVantage, ...(pinMode === 'points' && { anchors: pinAnchors || [] }),
        ...(pinMode === 'fences' && Number(photoFront?.width) > 0 && { frontWidth: Number(photoFront.width), lean: photoFront.lean || 'both' }) }
    : null), [photoCorners, pinMode, photoLens, pinAnchors, photoVantage, photoFront]);
  const [editingCorners, setEditingCorners] = useState(false);
  const [poseStatus, setPoseStatus] = useState(null);
  const [photoTone, setPhotoTone] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authFor, setAuthFor] = useState('book');      // what to carry on with after signing in: 'book' | 'share'
  // Share links: one per version of a design (fingerprint → { designId, url }), so sharing the same
  // design twice gives the same link; after an edit, sharing saves the new version with its own link
  const [shareLinks, setShareLinks] = useState({});
  // Saved copies of each design version (key → Promise<design id>): Share and the PDF proposal both
  // need one, and pressing both (or twice) must not save it twice
  const savedDesignsRef = useRef({});
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareSheet, setShareSheet] = useState(null);  // ShareDesignDialog: { status, url, name, designId, message }
  const gardenCanvasRef = useRef(null);                // the 3D view: .exportGlb() for the download
  const [glbBusy, setGlbBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const toast = useToast();
  const [budgetWarning, setBudgetWarning] = useState('');
  // Keep-clear zones from the photo: suggested by the AI scan, confirmed by the customer
  // Older sessions and links can still carry the 7 coarse zones; new designs use the yard survey instead
  const [keepClear, setKeepClear] = useState([]);
  // Mark your yard (YardSurvey): what's already there, in lot metres — the engine plans around it
  const [survey, setSurvey] = useState(() => (Array.isArray(prefill?.outline) ? { ...emptySurvey(), outline: prefill.outline } : emptySurvey()));
  // The example yard is on screen: { before } = the customer's own yard answers, put back by "Design my own yard"
  const [example, setExample] = useState(null);
  const [detailsEl, setDetailsEl] = useState(null);   // where the 3D view draws the clicked plant's details
  // How many of one kind of rock the yard takes (garden_ai.rock_limits): its own shape's area when it has one
  const rockMax = rockLimits(yardArea(survey, Number(lotWidth), Number(lotLength)));
  const rockLimitOf = (item) => (isSmallStone(item) ? rockMax.stones : rockMax.boulders);
  const featMax = featureLimits(yardArea(survey, Number(lotWidth), Number(lotLength)));
  // Most of one feature for this yard: rocks by size, pots / lights / water features by kind (seats: MAX_SEATS in all)
  const limitOf = (item) => { const k = featureKind(item); return k === 'rock' ? rockLimitOf(item) : featMax[k] ?? MAX_SEATS; };
  // A smaller yard: bring rocks already chosen down to what it takes
  useEffect(() => {
    if (!featureItems.length) return;
    setFeatureQty(prev => {
      let changed = false;
      const next = { ...prev };
      featureItems.forEach(item => {
        const id = String(item.id);
        if (featureKind(item) === 'seat' || !next[id]) return;
        const cap = limitOf(item);
        if (next[id] > cap) { next[id] = cap; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [featureItems, rockMax.stones, rockMax.boulders, featMax.pot, featMax.light, featMax.water]);   // eslint-disable-line react-hooks/exhaustive-deps
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
      if (saved.plantQty && typeof saved.plantQty === 'object') setPlantQty(saved.plantQty);
    }
    if (saved.featureQty && typeof saved.featureQty === 'object') setFeatureQty(saved.featureQty);
    if (typeof saved.install === 'boolean') setInstall(saved.install);
    if (saved.scope) setScope(saved.scope);
    if (saved.lawn) setLawn(saved.lawn);
    if (saved.sun !== undefined) setSun(saved.sun);
    if (saved.maintenance) setMaintenance(saved.maintenance);
    if (Array.isArray(saved.keepClear)) setKeepClear(saved.keepClear);
    if (Array.isArray(saved.survey?.items)) setSurvey({ items: saved.survey.items, sun: saved.survey.sun || null, outline: saved.survey.outline || null,
      ...(saved.survey.photo && { photo: saved.survey.photo }) });
    if (saved.example?.before) setExample(saved.example);
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
    setPlantQty(prev => { if (!(id in prev)) return prev; const next = { ...prev }; delete next[id]; return next; });
  };
  // How many of a picked plant: blank = "let us decide" (the design chooses), else that many (engine: placed first,
  // as many as space, stock and budget allow, with a note when fewer fit)
  const setPlantAmount = (id, value, max) => {
    const n = Math.round(Number(value));
    setPlantQty(prev => {
      const next = { ...prev };
      if (value === '' || !Number.isFinite(n) || n <= 0) delete next[id];
      else next[id] = Math.min(max, n);
      return next;
    });
  };
  // About how many fit: planting beds (the yard less a lawn) over the plant's spacing squared; tall plants keep to
  // the back half. A hint, not a promise — the design works it out exactly and says if fewer fit.
  const roomFor = (plant) => {
    const area = Number(lotWidth) * Number(lotLength);
    if (!(area > 0)) return null;
    const beds = area * 0.55 * (layoutLayer(plant) === 'tall' ? 0.5 : 1);   // designs keep about 45% as open lawn
    const sp = layoutSpacing(plant);
    return Math.max(1, Math.floor(beds / (sp * sp)));
  };


  // Picked or dropped: checked by its bytes first (services/fileCheck.js), so a PDF, a renamed file or an
  // iPhone HEIC gets a plain answer here instead of a broken preview and a wasted AI scan
  const takePhoto = async (file) => {
    if (!file) return;
    const problem = await photoProblem(file, 15);
    setPhotoError(problem || '');
    if (problem) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setPhotoCorners(null);   // a new photo needs its own pins
    setSurvey(sv => ({ ...sv, photo: undefined }));   // and its own line-up before the design uses it
    setPhotoLens(null);
    scanFileRef.current = file;   // the photo now on screen (its lens reading can arrive after a newer photo)
    readFocal35(file).then(mm => { if (scanFileRef.current === file) setPhotoLens(mm); });
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    scanFileRef.current = null;
    setSelectedImage(null);
    setImagePreview(null);
    setPhotoCorners(null);
    setPhotoLens(null);
    setKeepClear([]);
    setSurvey(sv => ({ ...sv, photo: undefined }));
  };

  // over: answers to use instead of the state (the example run sets them and generates in the same click)
  const handleGenerateDesigns = async (e, variationSeed = seed, over = {}) => {
    e?.preventDefault?.();
    const lotW = over.lotWidth ?? lotWidth, lotL = over.lotLength ?? lotLength, yard = over.survey ?? survey;
    const isExample = over.example ?? !!example;
    setLoading(true);
    setNotice('');
    setError('');
    scrollToCard();
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
    formData.append('lot_width', Number(lotW));
    formData.append('lot_length', Number(lotL));
    formData.append('preferred_plant_ids', JSON.stringify(preferredPlants));
    formData.append('groundcover', groundcoverOn ? 'auto' : 'off');
    formData.append('plant_qty', JSON.stringify(Object.entries(plantQty)
      .filter(([id]) => preferredPlants.includes(id)).map(([id, quantity]) => ({ id: Number(id), quantity }))));
    formData.append('features', JSON.stringify(Object.entries(featureQty).map(([id, quantity]) => ({ id: Number(id), quantity }))));
    // The photo stays in the browser for the AR view; only the confirmed zones are sent
    formData.append('keep_clear_zones', JSON.stringify(keepClear));
    formData.append('site_survey', JSON.stringify(yard));
    if (isExample) formData.append('example', '1');
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
          photo_basis: response.data.photo_basis || [],
          plants: (design.plants || []).filter(p =>
            p.is_existing || inventoryIds.has(String(p.plant_id))
          ),
        })), { install, scope: response.data.scope || scope, newLawn: lawn !== 'keep', lot: [Number(lotW), Number(lotL)], keepClear, survey: yard });
        setEditHistory({});
        setGeneratedLayouts(validated);
        // Open the first option in 3D straight away; the option tabs above it switch between them
        setActiveLayout(validated[0] || null);
        setNotice(response.data.notice || '');
        if (response.data.budget_warning) setBudgetWarning(response.data.budget_warning);
        setRestored(null);
        return true;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'An unexpected error occurred.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLayout = (layout) => {
    setActiveLayout(layout);
    setEditPanel(null);
    setTidyPreview(null);
    setMirrorNote('');
    // No scrolling: the option tabs stay pinned above the 3D view, so the customer stays where they are
  };
  // Option tabs: arrow keys move between them (WAI-ARIA tabs pattern)
  const onOptionKey = (e, index) => {
    const n = generatedLayouts.length;
    const next = e.key === 'ArrowRight' ? (index + 1) % n : e.key === 'ArrowLeft' ? (index - 1 + n) % n
      : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    handleSelectLayout(generatedLayouts[next]);
    document.getElementById(`design-option-${next}`)?.focus();
  };

  // ── Guided form ────────────────────────────────────────────────────────────────
  const lotError = () => {
    const w = Number(lotWidth), l = Number(lotLength);
    if (!(w >= 1 && w <= 100) || !(l >= 1 && l <= 100)) return 'Enter the yard\'s width and length in metres (1 to 100 m each).';
    return '';
  };
  // Leaving step 1 needs a usable yard size; every other step is optional
  const goToStep = (n) => {
    if (n > 1) {
      const problem = lotError();
      setLotProblem(problem);
      if (problem) { setFormStep(1); scrollToCard(); return; }
    }
    setFormStep(Math.max(1, Math.min(FORM_STEPS.length, n)));
    scrollToCard();
  };
  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Enter in a field moves on a step; only the Generate buttons (data-generate) make designs
    if (!e.nativeEvent?.submitter?.dataset?.generate) { goToStep(formStep + 1); return; }
    const problem = lotError();
    setLotProblem(problem);
    if (problem) { setFormStep(1); scrollToCard(); return; }
    handleGenerateDesigns(e);
  };

  // "See an example first": fill in the example yard and make its designs straight away
  const tryExample = async () => {
    const yard = exampleSurvey();
    const before = example?.before || { lotWidth, lotLength, survey };
    setExample({ before });
    setLotWidth(EXAMPLE_YARD.width);
    setLotLength(EXAMPLE_YARD.length);
    setSurvey(yard);
    setLotProblem('');
    const ok = await handleGenerateDesigns(null, seed, { lotWidth: EXAMPLE_YARD.width, lotLength: EXAMPLE_YARD.length, survey: yard, example: true });
    if (!ok) {   // no example to show: the customer's own answers come back (the error stays on screen)
      setLotWidth(before.lotWidth); setLotLength(before.lotLength); setSurvey(before.survey);
      setExample(null);
    }
  };
  // Back from the example to the customer's own yard: their answers return, step 1
  const leaveExample = () => {
    const before = example?.before;
    if (before) { setLotWidth(before.lotWidth); setLotLength(before.lotLength); setSurvey(before.survey); }
    setExample(null);
    setGeneratedLayouts([]); setError(''); setActiveLayout(null); setEditHistory({}); setRestored(null);
    setFormStep(1);
    scrollToCard();
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
        dimensions: { width: w, length: l, terrainType: 'flat', outline: survey.outline || null,
          sunFacing: surveyFacing(survey),   // the real sun path in the Studio (data/sunPath.js)
          ...(design.garden_plan?.lawn && { gardenPlan: { ...design.garden_plan, newLawn: lawn !== 'keep' } }) },
        depthData: null,
        originalImageUrl: null,
        terrainHeight: 1.5,
        timeOfDay: DEFAULT_TIME_OF_DAY,
      },
    });
    dispatch({ type: 'SET_DESIGN_META', payload: { isDirty: true } });
    // The Studio orders plants for delivery, and specimens are planted by our crew only: say so
    if ((design.plants || []).some(p => p.size === 'specimen')) {
      toast({ id: 'studio-specimen', type: 'info', title: 'Standard sizes in the Studio',
        message: 'The Studio orders plants for delivery, so the bigger specimen sizes stay with this design’s installed quote.' });
    }
    navigate('/studio');
  };
  // "Change my answers": back to the form (answers kept) on the review step
  const handleReset = () => { setExample(null); setGeneratedLayouts([]); setError(''); setActiveLayout(null); setEditHistory({}); setFormStep(FORM_STEPS.length); scrollToCard(); };

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
      const ctx = layout.price_ctx || defaultCtx();
      // Designer's notes (too close, on the lawn, tall at the front…): suggestions only, never blocking
      axios.post(`${API_ROOT}/layout-review/`, layoutBody(layout, ctx), { timeout: EDIT_TIMEOUT })
        .then(({ data }) => { if (priceSeq.current[id] === seq) patchLayout(id, { notes: data.notes || [] }); })
        .catch(() => { if (priceSeq.current[id] === seq) patchLayout(id, { notes: null }); });
      try {
        const { data: est } = await axios.post(`${API_ROOT}/pricing/estimate/`, estimateBody(layout, ctx), { timeout: EDIT_TIMEOUT });
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

  const defaultCtx = () => ({ install, scope, newLawn: lawn !== 'keep', lot: [Number(lotWidth), Number(lotLength)] });
  const estimateBody = (layout, ctx) => {
    // Counted by plant and size: a specimen-size plant is its own line at its own price (backend pricing.py)
    const counts = {};
    layout.plants.forEach(p => {
      if (p.is_existing) return;
      const key = p.size === 'specimen' ? `${p.plant_id}:specimen` : String(p.plant_id);
      counts[key] = (counts[key] || 0) + 1;
    });
    (layout.groundcover || []).forEach(g => { counts[g.plant_id] = (counts[g.plant_id] || 0) + Math.round(Number(g.area_sqm) || 0); });
    const area = yardArea(ctx.survey, ctx.lot[0], ctx.lot[1]);   // the yard's own shape when it has one
    return {
      items: Object.entries(counts).map(([key, quantity]) => {
        const [pid, size] = key.split(':');
        return { product_id: Number(pid), quantity, ...(size && { size }) };
      }),
      area_sqm: area,
      lawn_sqm: ctx.install ? Math.min(area, Number(layout.garden_plan?.lawn_area) || 0) : 0,
      new_lawn: ctx.newLawn, scope: ctx.scope || 'makeover', install: ctx.install,
    };
  };

  // Plants only → installed by our crew (and back): same design, new terms, priced again by the server.
  // The design then books the site visit; the office adjusts it and the customer approves the final one.
  const installedEstimate = (scopeChoice) => {
    const layout = layoutsRef.current.find(l => l.edit_id === activeLayout?.edit_id);
    if (!layout) return Promise.reject(new Error('No design'));
    const ctx = { ...(layout.price_ctx || defaultCtx()), install: true, scope: scopeChoice };
    return axios.post(`${API_ROOT}/pricing/estimate/`, estimateBody(layout, ctx), { timeout: EDIT_TIMEOUT }).then(r => r.data);
  };
  const switchTerms = (installNow, scopeChoice) => {
    const cur = activeLayout;
    if (!cur) return;
    const base = cur.price_ctx || defaultCtx();
    // Plants only: specimen sizes are planted by our crew, so the plants go back to the standard size
    const sized = !installNow && cur.plants.some(p => p.size);
    patchLayout(cur.edit_id, {
      price_ctx: { ...base, install: installNow, scope: scopeChoice || base.scope || 'makeover' },
      terms_switched: true, pricing: 'pending',
      ...(sized && { plants: cur.plants.map(({ size, ...p }) => p) }),   // eslint-disable-line no-unused-vars
    });
    if (sized) setMirrorNote('Bigger specimen sizes are planted by our crew only, so these plants are back to the standard size.');
    reprice(cur.edit_id);
  };

  const layoutBody = (layout, ctx) => ({
    plants: layout.plants, lot_width: ctx.lot[0], lot_length: ctx.lot[1],
    garden_plan: layout.garden_plan || null, keep_clear_zones: ctx.keepClear || [], site_survey: ctx.survey || null,
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
    const switched = layoutsRef.current.find(l => l.edit_id === id)?.terms_switched;
    patchLayout(id, l => (l.original ? { ...l.original, edited: false, original: null, pricing: switched ? 'pending' : 'ok', notes: [] } : {}));
    if (switched) reprice(id);   // the AI's plants, priced on the terms the customer chose (installed / plants only)
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
    const ctx = cur.price_ctx || { lot: [Number(lotWidth), Number(lotLength)], keepClear, survey };
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
  // "Move apart" in a plant's details: the engine moves just that plant, the shortest distance (one more edit:
  // Undo takes it back); what it did shows in that plant's details
  const [fixNote, setFixNote] = useState(null);   // { uid, text, busy }
  const handleFixOne = async (uid) => {
    const cur = activeLayout;
    if (!cur || fixNote?.busy) return;
    const ctx = cur.price_ctx || { lot: [Number(lotWidth), Number(lotLength)], keepClear, survey };
    setFixNote({ uid, text: 'Finding it a spot with room…', busy: true });
    try {
      const { data } = await axios.post(`${API_ROOT}/layout-review/`, { ...layoutBody(cur, ctx), tidy_uid: uid }, { timeout: EDIT_TIMEOUT });
      const moves = new Map((data.moves || []).filter(m => m.uid).map(m => [m.uid, m]));
      if (moves.size) {
        handlePlantsEdit(cur.plants.map(p => (moves.has(p.uid) ? { ...p, x: moves.get(p.uid).x, z: moves.get(p.uid).z } : p)), { noMirror: true });
      }
      setFixNote({ uid, text: (data.tidy_notes || []).join(' ') || 'Done.', busy: false });
    } catch {
      setFixNote({ uid, text: "Couldn't move it just now. Please try again.", busy: false });
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
    { label: 'Garden features', options: catalog.filter(c => (c.category || 'plant') !== 'plant' && inStock(c)) },
  ] : [];
  const openPanel = (panel) => { setEditPanel(panel); setPanelError(''); };
  const costTerms = { install: activeLayout?.price_ctx?.install ?? install, scope: activeLayout?.price_ctx?.scope || scope };
  // Their own ground needs the photo lined up (its pins); by default it's shown when we plant into the garden as it is
  const canPhotoGround = !!imagePreview && !!photoSetup;
  const groundMode = canPhotoGround ? (groundChoice ?? (costTerms.scope === 'existing' ? 'photo' : 'design')) : 'design';
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
    const ctx = cur.price_ctx || { lot: [Number(lotWidth), Number(lotLength)], keepClear, survey };
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
        layouts: generatedLayouts, activeId, budgetRange, lotWidth, lotLength, featureQty, preferredPlants, plantQty,
        install, scope, lawn, sun, maintenance, keepClear, survey, hadPhoto: !!imagePreview, example,
      };
      if (ownerId) saveAiSession(ownerId, data); else saveGuestDesign(data);
    }, 600);
    return () => clearTimeout(t);
  }, [generatedLayouts, activeId, ownerId, budgetRange, lotWidth, lotLength, featureQty, preferredPlants, plantQty,
    install, scope, lawn, sun, maintenance, keepClear, survey, imagePreview, example]);

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

  // What's saved for a design (booking and share links both save one)
  const designPayloadFor = (layout, referenceImageUrl = '') => ({
    name: layout.design_name,
    placed_items: layout.plants,
    plant_breakdown: layout.plant_breakdown || [],
    // The pins and the beds/lawn plan travel with the design so the office and crew see the same garden
    dimensions: { width: Number(lotWidth), length: Number(lotLength), ...(photoSetup && { photoCorners: photoSetup }),
      ...((layout.price_ctx?.survey?.items?.length || layout.price_ctx?.survey?.sun || layout.price_ctx?.survey?.outline
        || layout.price_ctx?.survey?.photo) && { siteSurvey: layout.price_ctx.survey }),
      ...(layout.garden_plan?.lawn && { gardenPlan: { ...layout.garden_plan, newLawn: lawn !== 'keep' } }),
      ...(layout.groundcover?.length && { groundcover: layout.groundcover }),
      // The customer moved, turned or removed things after the AI designed it
      ...(layout.edited && { editedByCustomer: true, customerEdits: {
        ...editSummary(layout), notes: (layout.notes || []).slice(0, 10).map(n => n.message) } }) },
    total_cost: layout.total_cost,
    cost_estimate: layout.cost_estimate || {},
    reference_image_url: referenceImageUrl,
    status: 'draft',
  });

  // One saved copy per version of a design (no yard photo); edits make a new version
  const designKey = (layout) => JSON.stringify([layout.design_name, layout.plants, layout.total_cost, layout.garden_plan, lotWidth, lotLength]);
  const ensureSaved = (layout) => {
    const key = designKey(layout);
    const saved = savedDesignsRef.current;
    if (!saved[key]) {
      saved[key] = api.post('/designs/', designPayloadFor(layout)).then(r => {
        // The design card's picture (dashboard, My designs), drawn in the background (data/designPreview.js)
        queuePreview(r.data.id, { plants: layout.plants, gardenPlan: layout.garden_plan, groundcover: layout.groundcover,
          survey: layout.price_ctx?.survey || survey, lotWidth: Number(lotWidth), lotLength: Number(lotLength) }, r.data.revision);
        return r.data.id;
      }).catch((e) => { delete saved[key]; throw e; });   // a failed save can be tried again
    }
    return saved[key];
  };

  // Share: save this version of the design to the account (no yard photo), then get its public link
  const handleShare = async () => {
    const layout = activeLayout;
    if (!layout || layout.pricing === 'pending' || layout.pricing === 'error') return;
    if (!user) { setAuthFor('share'); setShowAuthModal(true); return; }
    const key = designKey(layout);
    const known = shareLinks[key];
    if (known) { setShareSheet({ status: 'ready', name: layout.design_name, ...known }); return; }
    setShareSheet({ status: 'working', name: layout.design_name });
    try {
      const designId = await ensureSaved(layout);
      const share = await shareDesign(designId);
      const entry = { designId, url: `${window.location.origin}${share.path}` };
      setShareLinks(links => ({ ...links, [key]: entry }));
      setShareSheet({ status: 'ready', name: layout.design_name, ...entry });
    } catch (e) {
      setShareSheet({ status: 'error', name: layout.design_name,
        message: navigator.onLine === false ? 'No internet connection. Try again when you are back online.' : (e.message || 'Could not make the link.') });
    }
  };

  // Signed in from the share button: share once the signed-in user is here (the modal calls back
  // before React has re-rendered with them, so handleShare would still see a guest)
  const [shareAfterSignIn, setShareAfterSignIn] = useState(false);
  const shareNow = useEffectEvent(() => { setShareAfterSignIn(false); handleShare(); });
  useEffect(() => {
    if (shareAfterSignIn && user) shareNow();
  }, [shareAfterSignIn, user]);

  // Download the design as a .glb 3D file, exactly as the 3D view shows it (incl. growth stage)
  const handleDownloadGlb = async () => {
    const canvas = gardenCanvasRef.current;
    if (!canvas || glbBusy || !activeLayout) return;
    setGlbBusy(true);
    try {
      const blob = await canvas.exportGlb({ title: activeLayout.design_name });
      const name = glbFileName(activeLayout.design_name);
      saveBlob(blob, name);
      toast({ id: 'glb', type: 'success', title: '3D file downloaded',
        message: `${name} · ${fileSize(blob.size)}. Opens in Blender, SketchUp and online 3D viewers.` });
    } catch (e) {
      toast({ id: 'glb', type: 'error', title: "Couldn't make the 3D file", message: e.message || 'Please try again.' });
    } finally {
      setGlbBusy(false);
    }
  };

  // PDF proposal: the design saved (once per version), with the picture of the tab that's open —
  // the 3D overview, or the before & after on the yard photo — made here, the rest by the server
  const handleProposal = async () => {
    const layout = activeLayout;
    const canvas = gardenCanvasRef.current;
    if (!layout || pdfBusy || layout.pricing === 'pending' || layout.pricing === 'error') return;
    setPdfBusy(true);
    try {
      const { canvasToJpeg } = await import('../data/photoPreview');
      const form = new FormData();
      if (canvas && activeView === 'ar' && imagePreview && poseStatus?.ok && !editingCorners) {
        const { before, after } = await canvas.renderPhotoPreview({ maxSide: 1600 });
        form.append('photo_before', await canvasToJpeg(before, 0.88), 'before.jpg');
        form.append('photo_after', await canvasToJpeg(after, 0.88), 'after.jpg');
      } else if (canvas && activeView !== 'ar') {
        form.append('render', await canvasToJpeg(await canvas.renderOverview(), 0.88), 'render.jpg');
      }
      // CC BY models shown in the pictures are credited in the PDF
      const names = new Set((layout.plant_breakdown || []).map(r => String(r.name || '').toLowerCase()));
      const credits = MODEL_CREDITS.filter(c => names.has(c.product.toLowerCase()));
      if (credits.length) form.append('credits', `3D models in the pictures: ${credits.map(c => `"${c.title}" by ${c.author} (${c.license.name})`).join('; ')}.`);
      const designId = await ensureSaved(layout);
      const { blob, fileName } = await downloadDesignProposal(designId, form);
      saveBlob(blob, fileName);
      toast({ id: 'proposal', type: 'success', title: 'PDF proposal downloaded',
        message: `${fileName} · ${fileSize(blob.size)}. It's also saved in your account.` });
    } catch (e) {
      toast({ id: 'proposal', type: 'error', title: "Couldn't make the PDF",
        message: navigator.onLine === false ? 'No internet connection. Try again when you are back online.' : (e.message || 'Please try again.') });
    } finally {
      setPdfBusy(false);
    }
  };

  // Photo overlay: "Before & after" picture (their photo, and the same photo with the garden in it)
  const handlePhotoPreview = async () => {
    const canvas = gardenCanvasRef.current;
    if (!canvas || photoBusy || !activeLayout) return;
    setPhotoBusy(true);
    try {
      const { before, after } = await canvas.renderPhotoPreview();
      const { composeBeforeAfter, canvasToJpeg } = await import('../data/photoPreview');
      const picture = composeBeforeAfter({ before, after, title: activeLayout.design_name,
        stage: growthLabel(growthStage) });
      const blob = await canvasToJpeg(picture);
      const name = designFileName(activeLayout.design_name, 'before-after', 'jpg');
      saveBlob(blob, name);
      // Phones: one more tap puts it straight into Photos / Messenger (sharing needs a fresh tap)
      const file = new File([blob], name, { type: 'image/jpeg' });
      const canShare = touch && navigator.canShare?.({ files: [file] });
      toast({ id: 'photo-preview', type: 'success', title: 'Before & after picture saved', message: `${name} · ${fileSize(blob.size)}`,
        ...(canShare && { action: { label: 'Share', onClick: () => navigator.share({ files: [file], title: activeLayout.design_name }).catch(() => {}) } }) });
    } catch (e) {
      toast({ id: 'photo-preview', type: 'error', title: "Couldn't make the picture", message: e.message || 'Please try again.' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleStopSharing = async () => {
    const designId = shareSheet?.designId;
    if (!designId) return;
    try {
      await stopSharingDesign(designId);
      setShareLinks(links => Object.fromEntries(Object.entries(links).filter(([, v]) => v.designId !== designId)));
      setShareSheet(null);
    } catch (e) {
      setShareSheet(s => s && { ...s, status: 'error', message: e.message });
    }
  };

  const handleBookDesign = async () => {
    if (activeLayout?.pricing === 'pending' || activeLayout?.pricing === 'error') return;   // wait for the edited price
    if (activeLayout && activeLayout.plants && !(activeLayout.price_ctx?.install ?? install)) {
      // Plants only: put this design's plant list in the shop cart
      // Quantities stop at what's in stock; the cart drawer says which ones fell short
      const short = [];
      (activeLayout.plant_breakdown || []).forEach(row => {
        const product = catalog.find(p => String(p.id) === String(row.plant_id));
        if (!product) return;
        const r = addToCart(product, row.quantity);
        if (r.limited) short.push(r.quantity > 0
          ? { kind: 'reduced', name: product.name, quantity: r.quantity }
          : { kind: 'soldout', name: product.name });
      });
      addCartNotices(short);
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
      setAuthFor('book');
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
      const designPayload = designPayloadFor(activeLayout, referenceImageUrl);
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
      // Stay here: booking without the design would leave the crew nothing to build from
      // (this used to carry on to the booking form with no design attached, silently)
      console.error('Failed to save design:', err);
      toast({ id: 'book-design', type: 'error', title: "Couldn't save your design for booking",
        message: err.response?.data?.error || 'Check your connection and try again. Your design is still here.' });
    } finally {
      setBookingLoading(false);
    }
  };

  // Step 4 · Review: the answers in plain words (every row links back to its step)
  const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;
  const featureCount = Object.values(featureQty).filter(q => Number(q) > 0).length;   // kinds picked (stones come by the dozen)
  const pickedNames = selectedPlantObjects.map(p => p.name.split(' (')[0]);
  const reviewRows = [
    { step: 1, label: 'Yard', value: [
      `${Number(lotWidth) || '?'} × ${Number(lotLength) || '?'} m (about ${Math.round(yardArea(survey, Number(lotWidth), Number(lotLength)) || lotAreaNow)} m²)`,
      imagePreview ? 'photo added' : 'no photo',
      hasSurvey(survey) ? 'yard marked' : null,
    ].filter(Boolean).join(' · ') },
    { step: 2, label: 'Budget', value: `${peso(budgetRange.min)} – ${peso(budgetRange.max)} · ${
      !install ? 'plants only (no installation)' : scope === 'existing' ? 'planted into my existing garden' : 'full garden makeover'}` },
    { step: 2, label: 'Style', value: [
      survey.sun ? 'sun worked out from your yard' : sun ? SUN_LABELS[sun] : 'sun: not sure',
      UPKEEP_LABELS[maintenance],
      install && scope === 'makeover' ? (lawn === 'keep' ? 'keep my grass' : 'new grass') : null,
    ].filter(Boolean).join(' · ').replace(/^./, c => c.toUpperCase()) },
    { step: 3, label: 'Plants', value: pickedNames.length
        ? `Only the ${pickedNames.length} you picked: ${pickedNames.slice(0, 3).join(', ')}${pickedNames.length > 3 ? ` and ${pickedNames.length - 3} more` : ''}`
        : 'We choose from our whole catalog',
      note: compatibilityWarnings.length ? `${compatibilityWarnings.length} compatibility note${compatibilityWarnings.length > 1 ? 's' : ''}: the layout keeps those plants apart.` : null },
    { step: 3, label: 'Extras', value: [
      groundcoverOn ? 'groundcover between plants' : 'mulched beds',
      featureCount ? `${featureCount} kind${featureCount > 1 ? 's' : ''} of garden feature` : 'no garden features',
    ].join(' · ').replace(/^./, c => c.toUpperCase()) },
  ];

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
    // ── Guided form ──
    stepTitle: { fontSize: '1.2rem', fontWeight: 800, color: color.ink, margin: 0 },
    stepHint: { fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0', lineHeight: 1.45 },
    fieldHint: { fontSize: '0.72rem', color: '#64748B', lineHeight: 1.4 },
    linkBtn: { background: 'none', border: 'none', padding: 0, color: color.brandDeep, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' },
    // Back / Generate now / Next: pinned to the bottom of the screen while the step is taller than it
    stepBar: {
      position: 'sticky', bottom: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8,
      margin: '1.75rem calc(-1 * clamp(1.25rem, 4vw, 2.25rem)) calc(-1 * clamp(1.25rem, 4vw, 2.25rem))',
      padding: '12px clamp(1.25rem, 4vw, 2.25rem) calc(12px + env(safe-area-inset-bottom, 0px))',
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderTop: `1px solid ${color.border}`,
      borderRadius: `0 0 ${radius.card}px ${radius.card}px`,
    },
    stepBack: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44, minWidth: 44, padding: '0 14px', border: `1px solid ${color.border}`, background: color.white, color: color.text, fontWeight: 700, fontSize: '0.85rem', borderRadius: `${radius.button}px`, cursor: 'pointer', fontFamily: 'inherit' },
    stepGhost: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 14px', border: `1px solid ${color.border}`, background: color.white, color: color.brandDeep, fontWeight: 700, fontSize: '0.85rem', borderRadius: `${radius.button}px`, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
    stepNext: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, padding: '0 20px', border: 'none', background: color.brand, color: color.white, fontWeight: 800, fontSize: '0.9rem', borderRadius: `${radius.button}px`, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(16,185,129,0.2)' },
    // ── Results: option tabs pinned under the top bar, above the 3D view ──
    optionBar: (n) => ({
      position: 'sticky', top: 60, zIndex: 30, display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: phone ? 6 : 10,
      padding: '8px 0', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)',
    }),
    optionTab: (on) => ({
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0, textAlign: 'left',
      padding: phone ? '8px 10px' : '10px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
      border: `2px solid ${on ? color.brand : color.border}`, background: on ? '#ECFDF5' : color.white,
      boxShadow: on ? '0 4px 14px rgba(16,185,129,0.18)' : 'none', transition: 'all 0.18s',
    }),
    optionTop: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' },
    optionName: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: phone ? '0.78rem' : '0.88rem', fontWeight: 700, color: color.ink },
    optionPrice: { fontSize: phone ? '0.85rem' : '1rem', fontWeight: 800, color: color.ink },
    detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1rem', marginTop: '1rem' },
    detailsCard: { background: color.white, border: `1px solid ${color.border}`, borderRadius: 12, padding: '1rem 1.1rem' },
    detailsTitle: { fontSize: '0.9rem', fontWeight: 800, color: color.ink, margin: '0 0 2px' },
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
        .option-tab[aria-selected="false"]:hover { border-color: #6EE7B7 !important; background: #F0FDF4 !important; }
        .option-tab:focus-visible { outline: 3px solid rgba(16,185,129,0.45); outline-offset: 2px; }
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

          {/* Main Card */}
          <div ref={cardRef} style={{ ...styles.card, scrollMarginTop: 72 }}>

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
              <form onSubmit={handleFormSubmit} noValidate>
                {/* One plain line instead of a banner: what this page does and what's required */}
                <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#64748B', lineHeight: 1.45 }}>
                  <b style={{ color: '#0F172A' }}>AI garden designer.</b> Answer 4 short steps and we make 3 designs to compare in 3D.
                  Only your yard size is required.
                </p>
                <FormStepper step={formStep} onStep={goToStep} phone={phone} />
                <div style={{ marginBottom: '1.25rem' }}>
                  <h2 style={styles.stepTitle}>{FORM_STEPS[formStep - 1].title}</h2>
                  <p style={styles.stepHint}>{FORM_STEPS[formStep - 1].hint}</p>
                </div>

                {/* Step 1 · Your yard: the size (required), then an optional photo and "Mark your yard" */}
                <div hidden={formStep !== 1}>
                  {/* For the customer who isn't ready to measure: see real designs for a sample yard first */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '1.25rem',
                    border: '1.5px dashed #A7F3D0', borderRadius: 12, background: '#F0FDF4' }}>
                    <span style={{ flex: '1 1 260px', fontSize: '0.8rem', color: '#065F46', lineHeight: 1.45 }}>
                      <b>Not ready to measure?</b> See 3 designs for a sample {EXAMPLE_YARD.width} × {EXAMPLE_YARD.length} m yard first.
                      It doesn't use your daily AI designs.
                    </span>
                    <button type="button" onClick={tryExample} className="secondary-btn"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px', borderRadius: 10,
                        border: '1.5px solid #10B981', background: '#fff', color: '#047857', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Wand2 size={15} aria-hidden="true" /> See an example
                    </button>
                  </div>
                  {/* The yard size (the budget suggestion in step 2 depends on the area) */}
                  <div style={styles.grid3}>
                    {/* Above the fields, so the step bar pinned to the bottom of a phone screen can't hide it */}
                    {lotProblem && (
                      <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, padding: '8px 12px', borderRadius: 10, background: '#FEF2F2',
                        border: '1px solid #FECACA', fontSize: '0.8rem', fontWeight: 700, color: '#B91C1C' }}>{lotProblem}</p>
                    )}
                    <div style={styles.inputGroup}>
                      <label htmlFor="ai-lot-width" style={styles.sectionLabel}>Yard width (m)</label>
                      <input
                        id="ai-lot-width" type="number" inputMode="decimal" step="0.1" min="1" max="100" value={lotWidth}
                        onChange={e => { setLotWidth(e.target.value); setLotProblem(''); }}
                        aria-describedby="ai-lot-width-hint" aria-invalid={!!lotProblem}
                        className="garden-input"
                        style={styles.input} required
                      />
                      <span id="ai-lot-width-hint" style={styles.fieldHint}>Side to side, as you stand at the house</span>
                    </div>
                    <div style={styles.inputGroup}>
                      <label htmlFor="ai-lot-length" style={styles.sectionLabel}>Yard length (m)</label>
                      <input
                        id="ai-lot-length" type="number" inputMode="decimal" step="0.1" min="1" max="100" value={lotLength}
                        onChange={e => { setLotLength(e.target.value); setLotProblem(''); }}
                        aria-describedby="ai-lot-length-hint" aria-invalid={!!lotProblem}
                        className="garden-input"
                        style={styles.input} required
                      />
                      <span id="ai-lot-length-hint" style={styles.fieldHint}>From the house to the back fence</span>
                    </div>
                    <div style={{ ...styles.inputGroup, justifyContent: 'center' }}>
                      <span style={styles.sectionLabel}>Area</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                        {lotAreaNow > 0 ? `≈ ${Math.round(lotAreaNow)} m²` : '—'}
                      </span>
                      <span style={styles.fieldHint}>Not sure? A rough guess is fine: we measure at the site visit.</span>
                    </div>
                  </div>
                  {/* The yard's shape comes before the photo: a shaped yard changes how the photo is lined up */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <YardShapeStep W={Number(lotWidth) || 0} L={Number(lotLength) || 0} outline={survey.outline}
                      onOutline={(outline) => setSurvey(sv => ({ ...sv, outline }))} />
                  </div>
                  <hr style={styles.divider} />
                  {/* Image Upload */}
                  <div style={{ marginBottom: '1.75rem' }}>
                    <label style={styles.sectionLabel}>Photo of your yard <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional · helps the design fit)</span></label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <label className="upload-zone" style={{ ...styles.uploadZone, flex: 1, ...(photoOver ? { borderColor: '#10B981', background: '#ECFDF5' } : {}) }}
                        onDragOver={(e) => { e.preventDefault(); setPhotoOver(true); }} onDragLeave={() => setPhotoOver(false)}
                        onDrop={(e) => { e.preventDefault(); setPhotoOver(false); takePhoto(e.dataTransfer.files?.[0]); }}>
                        <div style={styles.uploadIcon}>
                          <Upload size={16} color="#10B981" />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
                          Drop a photo of your garden space
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                          JPG, PNG or WebP · max 15 MB
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 8, lineHeight: 1.45, maxWidth: 420, marginInline: 'auto' }}>
                          Best photo: from the house side, phone held level, showing <b>both back corners</b> and the <b>bottom of both side fences</b>.
                          A long yard? Hold the phone sideways. A photo from an upstairs window works too.
                        </div>
                        <input type="file" accept={PHOTO_ACCEPT} style={{ display: 'none' }}
                          onChange={(e) => { takePhoto(e.target.files?.[0]); e.target.value = ''; }} />
                        {photoError && (
                          <div role="alert" style={{ marginTop: 8, fontSize: '0.78rem', fontWeight: 600, color: '#B91C1C' }}>{photoError}</div>
                        )}
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
                    <YardSurvey imageUrl={imagePreview} lotWidth={lotWidth} lotLength={lotLength}
                      pinSetup={photoSetup} pinMode={pinMode} onPinMode={setPinMode} onPins={setPhotoCorners}
                      pinAnchors={pinAnchors} onPinAnchors={setPinAnchors}
                      pinVantage={photoVantage} onPinVantage={setPhotoVantage} pinFront={photoFront} onPinFront={setPhotoFront}
                      onLotSize={(w, l) => { setLotWidth(w); setLotLength(l); }}
                      survey={survey} onSurvey={setSurvey}
                      lawn={lawn} onLawn={setLawn} lawnApplies={install && scope === 'makeover'} />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
                    Rather place every plant yourself?{' '}
                    <button type="button" onClick={handleDesignManually} style={styles.linkBtn}>Design manually in the 3D Studio</button>
                  </p>
                </div>

                {/* Step 2 · Budget & style */}
                <div hidden={formStep !== 2}>
                  {budgetWarning && (
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                      <ShieldAlert size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, lineHeight: 1.35 }}>{budgetWarning}</span>
                    </div>
                  )}
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
                    {survey.sun ? (
                      // Mark your yard → Sun & shade: worked out spot by spot, so the whole-yard answer isn't needed
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                        <b style={{ color: '#0F172A' }}>Sun on the garden:</b> worked out for every spot from which way your yard faces (in Mark your yard below).
                      </p>
                    ) : (
                      <ChoiceChips label="Sun on the garden" value={sun} onChange={setSun} touch={touch} options={[
                        ['full', 'Full sun', '6+ hours of direct sun'], ['part', 'Part sun', '3–6 hours'],
                        ['shade', 'Mostly shade', 'under 3 hours'], [null, 'Not sure', 'we check at the site visit'],
                      ]} />
                    )}
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
                </div>

                {/* Step 3 · Plants & features (all optional) */}
                <div hidden={formStep !== 3}>
                  {/* Plant Picker */}
                  <div>
                    <label style={styles.sectionLabel}>Your Plants <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                    <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45 }}>
                      {selectedPlantObjects.length
                        ? <>Every design uses <strong style={{ color: '#065F46' }}>only the {selectedPlantObjects.length} plant{selectedPlantObjects.length > 1 ? 's' : ''} you picked</strong>, and includes {selectedPlantObjects.length > 1 ? 'each of them' : 'it'} (if one can't fit, the design says why). Clear them all and we choose from the whole catalog.</>
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
                    ) : inventoryError ? (
                      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10,
                        border: '1px solid #FDE68A', background: '#FFFBEB', fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>
                        We couldn't load our plants just now (the connection dropped or the server is restarting).
                        <button type="button" onClick={retryInventory}
                          style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #F59E0B', background: '#fff', color: '#92400E',
                            fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Retry
                        </button>
                      </div>
                    ) : inventory.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>No plants found in inventory.</p>
                    ) : (
                      <div style={styles.plantsGrid}>
                        {inventory.filter(plant => !plant.is_groundcover).map(plant => {
                          const id = String(plant.id);
                          const isSelected = preferredPlants.includes(id);
                          const stock = Math.max(0, Number(plant.stock_quantity) || 0);
                          const max = Math.max(1, Math.min(300, stock));
                          const room = isSelected ? roomFor(plant) : null;
                          const qty = plantQty[id];
                          return (
                            // The card is the frame: the tap area picks the plant, the amount row lives inside it
                            <div key={plant.id} className="plant-card" style={{ ...styles.plantCard(isSelected), cursor: 'default' }}>
                              <button type="button" onClick={() => handleTogglePlant(id)} aria-pressed={isSelected}
                                style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, width: '100%', minWidth: 0, padding: 0,
                                  border: 'none', background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                                <PlantThumb item={plant} style={styles.plantPhoto} />
                                <span style={styles.plantInfo}>
                                  <span style={styles.plantName(isSelected)}>{plant.name}</span>
                                  <span style={styles.plantPrice(isSelected)}>₱{Number(plant.unit_price).toLocaleString()}</span>
                                  <NeedChips plant={plant} />
                                </span>
                              </button>
                              {isSelected && (
                                <span style={styles.plantCheck}>
                                  <Check size={10} color="#fff" />
                                </span>
                              )}
                              {isSelected && (
                                <div style={{ paddingTop: 8, borderTop: '1px solid #D1FAE5', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700, color: '#065F46' }}>
                                    How many
                                    <input type="number" inputMode="numeric" min="1" max={max} step="1" placeholder="Let us decide"
                                      value={qty ?? ''} onChange={e => setPlantAmount(id, e.target.value, max)}
                                      aria-label={`How many ${plant.name} (leave empty and we decide)`}
                                      style={{ flex: 1, minWidth: 0, height: 32, padding: '0 8px', borderRadius: 8, border: '1.5px solid #A7F3D0',
                                        fontSize: '0.78rem', fontWeight: 700, color: '#065F46', background: '#fff', fontFamily: 'inherit' }} />
                                  </label>
                                  <span style={{ fontSize: '0.68rem', color: qty && room && qty > room ? '#B45309' : '#64748B', lineHeight: 1.35 }}>
                                    {qty
                                      ? (room && qty > room ? `More than fits easily (room for about ${room}); we'll fit what we can and tell you.` : `Room for about ${room ?? '?'} in your yard.`)
                                      : `We'll choose. Room for about ${room ?? '?'}${stock < (room || 0) ? ` · ${stock} in stock` : ''}.`}
                                  </span>
                                </div>
                              )}
                            </div>
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
                  {inventory.some(i => i.is_groundcover && Number(i.stock_quantity) > 0) && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <label style={styles.sectionLabel}>Groundcover in the beds</label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                        border: `1.5px solid ${groundcoverOn ? '#6EE7B7' : '#E2E8F0'}`, background: groundcoverOn ? '#ECFDF5' : '#fff' }}>
                        <input type="checkbox" checked={groundcoverOn} onChange={e => setGroundcoverOn(e.target.checked)}
                          style={{ width: 18, height: 18, marginTop: 2, accentColor: '#059669', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.5 }}>
                          <b>Fill the beds between plants with groundcover</b> (recommended). Plants are spaced for their grown size;
                          groundcover such as {inventory.filter(i => i.is_groundcover).slice(0, 2).map(i => i.name.split(' (')[0]).join(' or ')} covers the
                          soil between them within about a year, with a shade-loving one under the trees. Fewer weeds, no bare soil.
                          Priced per m²; switch it off for mulched beds.
                        </span>
                      </label>
                    </div>
                  )}

                  {featureItems.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <label style={styles.sectionLabel}>Garden Features <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                      <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45 }}>
                        A seating spot gets open ground and a path to the house; boulders go in small groups in the planting beds, and small
                        garden stones (by the half dozen) in looser clusters along them. A water feature goes where the eye lands across the
                        lawn, pots frame the way in and the seating, and garden lights line the walkways and the edge of the lawn.
                        They are placed first and paid for from your budget before the plants.
                      </p>
                      <div style={styles.plantsGrid}>
                        {featureItems.map(item => {
                          const id = String(item.id);
                          const qty = featureQty[id] || 0;
                          const kind = featureKind(item);
                          const info = FEATURE_INFO[kind];
                          const isSeat = kind === 'seat';
                          const isStone = isSmallStone(item);
                          const canAdd = (isSeat ? seatTotal < MAX_SEATS : qty < limitOf(item)) && qty < (Number(item.stock_quantity) || 0);
                          const unit = isStone ? ['stone', 'stones'] : info.unit;
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
                                  <span style={styles.plantPrice(qty > 0)}>₱{Number(item.unit_price).toLocaleString()} each{isStone ? ` · ₱${(Number(item.unit_price) * 12).toLocaleString()} a dozen` : ''}</span>
                                  <span style={{ display: 'flex', marginTop: 6 }}>
                                    <span style={chip(info.fg, info.bg)}>{isStone ? 'Garden stones' : info.label}</span>
                                  </span>
                                </span>
                              </button>
                              {qty > 0 && <span style={styles.plantCheck}><Check size={10} color="#fff" /></span>}
                              {qty > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                                  paddingTop: 8, borderTop: '1px solid #D1FAE5' }}>
                                  <button type="button" onClick={() => changeFeatureQty(item, -1)} aria-label={isStone ? `${STONE_STEP} fewer ${item.name}` : `One less ${item.name}`}
                                    style={styles.stepBtn(true)}>−</button>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#065F46', minWidth: 0 }} aria-live="polite">
                                    {qty}<span style={{ fontWeight: 600, color: '#64748B', fontSize: '0.7rem' }}> {qty > 1 ? unit[1] : unit[0]}</span>
                                  </span>
                                  <button type="button" onClick={() => changeFeatureQty(item, 1)} disabled={!canAdd} aria-label={isStone ? `${STONE_STEP} more ${item.name}` : `One more ${item.name}`}
                                    style={styles.stepBtn(canAdd)}>+</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {featureItems.some(i => featureKind(i) === 'rock') && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#64748B' }}>
                          Your yard (about {Math.round(yardArea(survey, Number(lotWidth), Number(lotLength)))} m²) takes up to {rockMax.boulders} of each
                          boulder and {rockMax.stones} of each small stone: more would crowd the beds.
                        </p>
                      )}
                      {featureItems.some(i => ['light', 'water'].includes(featureKind(i)) && featureQty[String(i.id)]) && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#64748B' }}>
                          Garden lights and water features need an outdoor power point within reach; we confirm it at the site visit.
                        </p>
                      )}
                      {seatTotal >= MAX_SEATS && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#64748B' }}>Up to {MAX_SEATS} seats make one seating spot.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 4 · Review: every answer, each with a way back to change it */}
                {formStep === FORM_STEPS.length && <ReviewAnswers rows={reviewRows} onEdit={goToStep} />}

                {/* Step bar: pinned to the bottom of the screen while the form is longer than it */}
                <div style={styles.stepBar}>
                  {formStep > 1 ? (
                    <button type="button" onClick={() => goToStep(formStep - 1)} className="back-btn" style={styles.stepBack} aria-label="Back to the previous step">
                      <ChevronLeft size={16} aria-hidden="true" />{!phone && ' Back'}
                    </button>
                  ) : <span />}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', minWidth: 0 }}>
                    {formStep >= 2 && formStep < FORM_STEPS.length && (
                      <button type="submit" data-generate="1" className="secondary-btn" style={styles.stepGhost}
                        title="Only the yard size is needed: we fill in the rest">
                        <Sparkles size={14} aria-hidden="true" /> {phone ? 'Generate' : 'Generate now'}
                      </button>
                    )}
                    {formStep < FORM_STEPS.length ? (
                      // Separate keys: React must not reuse this button as the submit button below, or the click
                      // that opens step 4 would also submit the form (the type flips to "submit" mid-click)
                      <button key="next" type="button" onClick={() => goToStep(formStep + 1)} className="submit-btn" style={styles.stepNext}>
                        {phone ? 'Next' : `Next: ${FORM_STEPS[formStep].short}`} <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <button key="generate" type="submit" data-generate="1" className="submit-btn" style={styles.stepNext}>
                        <Sparkles size={16} aria-hidden="true" /> Generate 3 designs
                      </button>
                    )}
                  </div>
                </div>
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
                {/* The same shape as the results: three option tabs over the 3D view */}
                <div aria-hidden="true">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: phone ? 6 : 10 }}>
                    {[0.9, 0.75, 0.6].map((op, i) => (
                      <div key={i} style={{ ...styles.optionTab(false), opacity: op, cursor: 'default' }}>
                        <div style={{ height: 8, width: '45%', background: '#E2E8F0', borderRadius: 6, marginBottom: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                        <div style={{ height: 12, width: '80%', background: '#F1F5F9', borderRadius: 6, marginBottom: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                        <div style={{ height: 14, width: '55%', background: '#D1FAE5', borderRadius: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ ...styles.canvasPlaceholder, marginTop: 12, height: phone ? 340 : 450, animation: 'pulse 1.4s ease-in-out infinite' }} />
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
                      Change my answers
                    </button>
                  </div>
                </div>

                {example && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap',
                    padding: '10px 14px', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#78350F', lineHeight: 1.45 }}>
                      <strong>This is an example</strong>: a {EXAMPLE_YARD.width} × {EXAMPLE_YARD.length} m yard with a door from the house and a mango
                      tree that stays. Look around in 3D, then design your own yard.
                    </span>
                    <button type="button" onClick={leaveExample}
                      style={{ minHeight: 38, padding: '0 14px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff',
                        fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      Design my own yard
                    </button>
                  </div>
                )}

                {restored && (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap',
                    padding: '10px 14px', background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#065F46', lineHeight: 1.45 }}>
                      <strong>Welcome back.</strong> We kept your designs{restored.edited ? ' and your changes' : ''} from {timeAgo(restored.at)}.
                      {restored.hadPhoto && !imagePreview && ' Add your yard photo again to use the photo overlay.'}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                      <button type="button" onClick={() => setRestored(null)} style={styles.editBtn(false, touch)}>OK</button>
                      <button type="button" onClick={() => { setRestored(null); handleReset(); setFormStep(1); }} style={styles.editBtn(false, touch)}>Start over</button>
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

                {/* The yard photo's part in the design (backend site_survey.photo_facts), or how to give it one */}
                {activeLayout?.photo_basis?.length > 0 ? (
                  <div role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: '1rem',
                    background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: 12 }}>
                    <Camera size={17} style={{ color: '#047857', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                    <span style={{ fontSize: '0.8rem', color: '#065F46', lineHeight: 1.45 }}>
                      {activeLayout.photo_basis.length < 3
                        ? <><strong>Based on your yard photo,</strong> we {photoSentence(activeLayout.photo_basis)}.</>
                        : <><strong>Based on your yard photo, we:</strong>
                          <ul style={{ margin: '4px 0 0', paddingLeft: 18, listStyle: 'disc' }}>
                            {activeLayout.photo_basis.map(f => <li key={f}>{f}</li>)}
                          </ul></>}
                    </span>
                  </div>
                ) : imagePreview && !example && !(activeLayout?.price_ctx?.survey || survey)?.photo?.lined_up ? (   /* lined up but nothing taken from it: no nudge */
                  <div role="note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap',
                    padding: '10px 14px', marginBottom: '1rem', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 10, fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
                      <Camera size={17} style={{ color: '#64748B', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                      <span>Your photo is only in the Photo Overlay so far. Line it up with your yard in step 1 and the design plans around what it shows.</span>
                    </span>
                    <button type="button" onClick={() => { handleReset(); setFormStep(1); }} style={styles.editBtn(false, touch)}>Line up my photo</button>
                  </div>
                ) : null}

                {/* Option tabs: pinned under the top bar, so switching designs never needs a scroll back up */}
                <p style={{ margin: '0 0 2px', fontSize: '0.8rem', color: '#64748B' }}>
                  Pick an option to see it in 3D. Any changes you make to an option are kept when you switch.
                </p>
                <div role="tablist" aria-label="Your garden designs" style={styles.optionBar(generatedLayouts.length)}>
                  {generatedLayouts.map((design, index) => {
                    const on = activeLayout?.edit_id === design.edit_id;
                    return (
                      <button key={design.edit_id} id={`design-option-${index}`} type="button" role="tab" aria-selected={on}
                        aria-controls="design-preview" tabIndex={on ? 0 : -1}
                        onClick={() => handleSelectLayout(design)} onKeyDown={(e) => onOptionKey(e, index)}
                        className="option-tab" style={styles.optionTab(on)}>
                        <span style={{ ...styles.optionTop, color: on ? '#047857' : '#64748B' }}>
                          Option {index + 1}
                          <span title={design.source === 'ai' ? 'Designed by our AI, then checked by our design engine' : 'Designed by our rule-based design engine'}
                            style={{ display: 'inline-flex' }}>
                            {design.source === 'ai' ? <Sparkles size={11} aria-label="AI design" /> : <Cpu size={11} aria-label="Smart layout" />}
                          </span>
                          {design.edited && <Pencil size={11} aria-label="Edited by you" style={{ color: '#B45309' }} />}
                        </span>
                        <span style={styles.optionName}>{design.design_name}</span>
                        <span style={{ ...styles.optionPrice, opacity: design.pricing === 'pending' ? 0.55 : 1 }}>
                          ₱{Number(design.total_cost).toLocaleString()}
                        </span>
                        {budgetRange?.max > 0 && (() => {
                          const total = Number(design.total_cost) || 0, max = Number(budgetRange.max), min = Number(budgetRange.min) || 0;
                          const over = total - max, pct = Math.min(100, (total / max) * 100);
                          return (
                            <span style={{ display: 'block', width: '100%', marginTop: 4, opacity: design.pricing === 'pending' ? 0.55 : 1 }}>
                              <span role="img" aria-label={`${Math.round((total / max) * 100)}% of your top budget`}
                                style={{ position: 'relative', display: 'block', height: 4, borderRadius: 99, background: color.divider, overflow: 'hidden' }}>
                                <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, borderRadius: 99,
                                  background: over > 0 ? '#F59E0B' : color.brand, transition: 'width 0.3s' }} />
                                {min > 0 && min < max && (
                                  <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${(min / max) * 100}%`, width: 2, background: 'rgba(15,23,42,0.3)' }} />
                                )}
                              </span>
                              <span style={{ display: 'block', marginTop: 3, fontSize: '0.66rem', fontWeight: 700, color: over > 0 ? '#B45309' : '#64748B' }}>
                                {over > 0 ? `₱${Math.round(over).toLocaleString()} over${phone ? '' : ' budget'}` : phone ? 'In budget' : 'Within your budget'}
                              </span>
                            </span>
                          );
                        })()}
                      </button>
                    );
                  })}
                </div>

                {/* 3D / AR Preview */}
                {activeLayout && (
                  <div id="design-preview" role="tabpanel" aria-labelledby={`design-option-${generatedLayouts.indexOf(activeLayout)}`}
                    style={{ ...styles.previewPanel, marginTop: 8 }}>
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
                            ? (pinMode === 'points'
                              ? 'Drag each yellow pin onto the corner or spot it names (you chose them in Mark your yard). The design moves with them.'
                              : pinMode === 'corners'
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
                        <button type="button" onClick={() => handleEditInStudio(activeLayout)} style={styles.editBtn(false, touch)}
                          title="Open this design in the 3D Studio to move, add or swap plants with more tools">
                          <Box size={14} aria-hidden="true" /> Open in 3D Studio
                        </button>
                      </span>
                    </div>

                    {mirrorNote && (
                      <p role="status" style={{ margin: '-4px 0 8px', fontSize: '0.75rem', fontWeight: 600, color: '#065F46', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FlipHorizontal2 size={13} aria-hidden="true" /> {mirrorNote}
                      </p>
                    )}

                    {/* The budget is shown on each option tab; here only what to do when the open one is over it */}
                    {budgetRange?.max > 0 && activeLayout.pricing !== 'pending' && Number(activeLayout.total_cost) > Number(budgetRange.max) && (
                      <p role="status" style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 700, color: '#B45309' }}>
                        ₱{Math.round(Number(activeLayout.total_cost) - Number(budgetRange.max)).toLocaleString()} over your top budget
                        of ₱{Number(budgetRange.max).toLocaleString()}: remove or swap something to bring it back.
                      </p>
                    )}

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

                    {/* View controls: a row ABOVE the picture, so nothing covers the garden (the year slider, the ground,
                        lawn, sun and grid used to float on it and hid plants and their cards) */}
                    <div role="toolbar" aria-label="View" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '10px 12px', flexWrap: 'wrap', margin: '0 0 10px', position: 'relative', zIndex: 6 }}>
                      {!(activeView === 'ar' && editingCorners) && (
                        <GrowthStagePicker value={growthStage} onChange={setGrowthStage} short={phone} inline style={{ flex: '1 1 340px' }} />
                      )}
                      {activeView !== 'ar' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: phone ? 'flex-start' : 'flex-end', marginLeft: phone ? 0 : 'auto' }}>
                          {canPhotoGround && (
                            <div role="radiogroup" aria-label="Ground in the 3D view"
                              style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                              {[['design', phone ? 'Design' : 'Design ground'], ['photo', phone ? 'My photo' : 'My yard photo']].map(([key, label]) => (
                                <button key={key} type="button" role="radio" aria-checked={groundMode === key} onClick={() => setGroundChoice(key)}
                                  title={key === 'photo' ? 'Your yard photo laid on the ground, under the new plants' : 'The new beds, lawn and paths of this design'}
                                  style={{ minHeight: touch ? 38 : 28, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    fontSize: '0.72rem', fontWeight: 800, background: groundMode === key ? color.brand : 'transparent',
                                    color: groundMode === key ? '#fff' : '#334155' }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                          {groundMode === 'design' && activeLayout.garden_plan?.lawn && (
                            <LawnLookSelect value={lawnLook} onChange={setLawnLook} touch={touch} short={phone} />
                          )}
                          <SunControl value={sunView} onChange={setSunView} touch={touch} phone={phone} up={false}
                            facingKnown={surveyFacing(activeLayout.price_ctx?.survey || survey) != null} />
                          <button type="button" onClick={() => setShowGrid(g => !g)} aria-pressed={showGrid}
                            title="A 1 m grid over your lot, to judge distances"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                              minHeight: touch ? 44 : 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800,
                              fontFamily: 'inherit', border: `1.5px solid ${showGrid ? color.brand : 'rgba(255,255,255,0.9)'}`,
                              background: showGrid ? '#ECFDF5' : 'rgba(255,255,255,0.92)', color: showGrid ? '#065F46' : '#334155',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                            <Grid3x3 size={14} aria-hidden="true" /> {phone ? 'Grid' : '1 m grid'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative', height: phone ? 340 : 450 }}>
                      <ThreeGardenCanvas
                        ref={gardenCanvasRef}
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
                        allowSpecimen={!!(activeLayout.price_ctx?.install ?? install)}
                        sun={sunView && activeView !== 'ar' ? { hour: sunView.hour, day: SUN_SEASONS.find(s => s.key === sunView.season)?.day } : null}
                        notesByUid={notesByUid}
                        onSwapRequest={(uid) => openPanel({ mode: 'swap', uid })}
                        previewMoves={tidyPreview?.moves || null}
                        focus={focusReq}
                        showGrid={showGrid}
                        survey={activeLayout.price_ctx?.survey || survey}
                        groundcover={activeLayout.groundcover}
                        photoGround={activeView !== 'ar' && groundMode === 'photo'}
                        onPhotoGround={setPhotoGroundStatus}
                        lawnLook={lawnLook}
                        compactHover
                        detailsTarget={phone ? null : detailsEl}
                        detailsSheet={phone}
                        onFixRequest={handleFixOne}
                        fixNote={fixNote}
                      />

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

                    {/* The clicked plant's details and Turn / Swap / Remove (drawn here by the 3D view; a bottom sheet on phones) */}
                    <div ref={setDetailsEl} />

                    {activeView !== 'ar' && groundMode === 'photo' && photoGroundStatus && photoGroundStatus.state !== 'off' && (
                      <p role="status" style={{ margin: '8px 2px 0', fontSize: '0.75rem', lineHeight: 1.5,
                        color: photoGroundStatus.state === 'failed' ? '#b45309' : color.muted }}>
                        {photoGroundStatus.state === 'working' ? 'Laying your yard photo on the ground…'
                          : photoGroundStatus.state === 'failed'
                            ? (photoGroundStatus.reason === 'pins'
                              ? 'Your photo\'s pins don\'t line up with the yard yet. Open the Photo Overlay Preview and tap "Line up with my yard".'
                              : photoGroundStatus.reason === 'outside'
                                ? 'Your photo doesn\'t show this yard\'s ground. Check the pins in the Photo Overlay Preview.'
                                : 'We couldn\'t read your photo here. The Photo Overlay Preview still shows it.')
                            : <>
                              {costTerms.scope === 'existing'
                                ? 'Your own ground from your photo: we plant into it as it is. '
                                : 'Your ground today, from your photo, with the new plants on it. The dashed line is where the new lawn edge goes. '}
                              Your photo shows {Math.round((photoGroundStatus.coverage || 0) * 100)}% of the lot (the rest is plain ground). Upright things in it, like walls and trunks, look stretched: it's one photo, not a scan.
                            </>}
                      </p>
                    )}

                    {activeView !== 'ar' && hasSurvey(activeLayout.price_ctx?.survey || survey) && (
                      <p style={{ margin: '8px 2px 0', fontSize: '0.75rem', lineHeight: 1.5, color: color.muted }}>
                        {yardSummary(activeLayout.price_ctx?.survey || survey, (activeLayout.plants || []).filter(p => p.is_existing).length)}
                        {' '}Walls and the house turn see-through when they'd hide the garden.
                      </p>
                    )}

                    {activeView === 'ar' && imagePreview && editingCorners && (
                      <div role="radiogroup" aria-label="Front corners of the yard"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: '0.8rem', color: color.muted }}>
                        <span style={{ fontWeight: 600 }}>{pinMode === 'points' ? 'Pins on the spots you chose in Mark your yard · or use' : 'The front corners of my yard are'}</span>
                        {[['fences', 'out of the photo'], ['corners', 'in the photo']].map(([mode, label]) => (
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

                    {activeView === 'ar' && imagePreview && !editingCorners && poseStatus?.ok && (
                      <div style={{ display: 'flex', justifyContent: phone ? 'stretch' : 'flex-start', marginTop: 10 }}>
                        <button type="button" onClick={handlePhotoPreview} disabled={photoBusy} aria-busy={photoBusy}
                          title="Your yard photo next to the same photo with this garden in it"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            width: phone ? '100%' : 'auto', minHeight: touch ? 44 : 38, padding: '8px 16px',
                            background: color.brand, color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                            border: 'none', borderRadius: `${radius.button}px`, cursor: photoBusy ? 'wait' : 'pointer', opacity: photoBusy ? 0.7 : 1,
                          }}>
                          <ImageDown size={15} /> {photoBusy ? 'Making your picture…' : 'Save before & after picture'}
                        </button>
                      </div>
                    )}

                    {activeView === 'ar' && imagePreview && poseStatus && (() => {
                      const note = !poseStatus.ok
                        ? (poseStatus.reason === 'upside_down'
                          ? (poseStatus.mode === 'points'
                            ? 'Those pins put the camera under the ground: check that each pin is on the spot it names.'
                            : poseStatus.mode === 'corners'
                            ? 'The "Back" pins go on the far side of the yard (higher in the photo), the "Front" pins on the near side.'
                            : 'The "Back" pins go on the far corners of the yard (higher in the photo); the side pins nearer you, lower down.')
                          : 'Those pins don\'t outline the yard: check that no two sides cross.')
                        : poseStatus.fitWarn
                          ? (poseStatus.suggestedLength
                            ? `These pins fit a yard about ${lotWidth} × ${poseStatus.suggestedLength} m, but the size above is ${lotWidth} × ${lotLength} m. Fix the size (then generate again), or move a pin.`
                            : `The pins don't match a ${lotWidth} × ${lotLength} m yard. Check the yard size above, or move a pin.`)
                          : poseStatus.heightWarn
                            ? `These pins put the camera about ${poseStatus.cameraHeight.toFixed(1)} m above the ground. If you took the photo ${vantageOf(photoSetup).label.toLowerCase()}, ${poseStatus.mode === 'points' ? 'check that each pin is on the spot it names, and the yard size.' : `check the yard width (${lotWidth} m) or move the "Back" pins onto the far corners.`}`
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

                    {/* What's in this option and what it costs: the details the old option cards carried */}
                    {(() => {
                      const design = activeLayout;
                      const items = design.plants?.filter(p => !p.is_existing) || [];
                      const featureIds = new Set(featureItems.map(f => String(f.id)));
                      const nFeatures = items.filter(p => featureIds.has(String(p.plant_id))).length;
                      const gcM2 = (design.groundcover || []).reduce((n, g) => n + Number(g.area_sqm || 0), 0);
                      const rows = plantingSchedule(design, catalog, featureItems);
                      const open = !!expandedBreakdowns[design.edit_id];
                      return (
                        <div style={styles.detailsGrid}>
                          <section style={styles.detailsCard} aria-labelledby="design-whats-in">
                            <h4 id="design-whats-in" style={styles.detailsTitle}>What's in this design</h4>
                            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#64748B' }}>
                              {items.length - nFeatures} plants{nFeatures ? ` · ${nFeatures} garden feature${nFeatures > 1 ? 's' : ''}` : ''}{gcM2 ? ` · ${gcM2} m² groundcover` : ''}
                            </p>
                            {design.reasoning && (
                              <p style={{ margin: '0 0 10px', padding: '8px 10px', borderRadius: 8, background: '#F8FAFC', fontSize: '0.78rem', color: '#334155', lineHeight: 1.5 }}>
                                <strong style={{ color: '#047857' }}>{design.source === 'ai' ? 'Why this design: ' : 'Design approach: '}</strong>{design.reasoning}
                              </p>
                            )}
                            {rows.map(row => (
                              <div key={row.id} style={styles.plantItem}>
                                <span style={{ ...styles.plantItemName, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <PlantThumb item={row.detail} size={24} rounded={6} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  {row.role && <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B' }}>{row.role}</span>}
                                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', minWidth: 30, textAlign: 'right' }}>{row.unit ? `${row.quantity} ${row.unit}` : `× ${row.quantity}`}</span>
                                </span>
                              </div>
                            ))}
                            {design.adjustments?.length > 0 && (
                              <div style={{ marginTop: '0.75rem', padding: '8px 10px', borderRadius: '8px', background: '#F1F5F9', fontSize: '0.72rem', color: '#475569', lineHeight: 1.45 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                                  <Wrench size={11} /> What we adjusted
                                </div>
                                {design.adjustments.map((note, ni) => <div key={ni}>• {note}</div>)}
                              </div>
                            )}
                          </section>
                          <section style={styles.detailsCard} aria-labelledby="design-cost">
                            <h4 id="design-cost" style={styles.detailsTitle}>Cost estimate</h4>
                            {design.target_budget && (underUsed(design) ? (
                              <div style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 700 }}>
                                Uses ₱{Number(design.total_cost).toLocaleString()} of ₱{Number(design.target_budget).toLocaleString()} · see why below
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                                Designed for your budget of ₱{Number(design.target_budget).toLocaleString()}
                              </div>
                            ))}
                            {design.cost_breakdown ? (
                              <div style={{ marginTop: 10 }}>
                                {(design.cost_breakdown.lines || []).map(line => (
                                  <div key={line.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: line.key === 'plants' ? '#ECFDF5' : '#F8FAFC', marginBottom: '3px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>{line.label}</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', whiteSpace: 'nowrap' }}>₱{Number(line.amount).toLocaleString()}</span>
                                  </div>
                                ))}
                                <div style={{ padding: '10px', borderRadius: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', marginTop: '6px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estimated total</span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                                      ₱{Number(design.cost_breakdown.low).toLocaleString()}–₱{Number(design.cost_breakdown.high).toLocaleString()}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>Final price confirmed after a site inspection.</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 8, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>≈ ₱{Number(design.total_cost).toLocaleString()}</div>
                            )}
                            {design.budget_note && (
                              <div role="note" style={{ marginTop: '0.6rem', padding: '8px 10px', borderRadius: '8px', fontSize: '0.74rem', lineHeight: 1.45,
                                ...(underUsed(design) ? { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#78350F' } : { color: '#64748B' }) }}>
                                <Info size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{design.budget_note}
                              </div>
                            )}
                            {(design.plant_breakdown || []).length > 0 && (
                              <button type="button" onClick={() => toggleBreakdown(design.edit_id)} aria-expanded={open}
                                style={{ background: 'transparent', border: 'none', color: '#059669', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 0 0', fontFamily: 'inherit' }}>
                                {open ? 'Hide itemised prices ▲' : 'Show itemised prices ▼'}
                              </button>
                            )}
                            {open && (
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
                                        <td style={{ padding: '8px 4px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', color: '#64748B' }}>₱{Number(item.unit_price).toLocaleString()}{item.unit ? ` / ${item.unit}` : ''}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>₱{Number(item.subtotal).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {(Number(lotWidth) > LOT_MAX || Number(lotLength) > LOT_MAX) && (
                              <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: '#92400E', lineHeight: 1.4 }}>
                                The 3D Studio handles up to {LOT_MAX} × {LOT_MAX} m: it opens on a {LOT_MAX} m lot and offers to move plants beyond it inside.
                              </p>
                            )}
                          </section>
                        </div>
                      );
                    })()}

                    {activeLayout.pricing === 'error' && (
                      <p role="alert" style={{ margin: '10px 0 0', fontSize: '0.8rem', fontWeight: 600, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        We couldn't update the price after your change.
                        <button type="button" onClick={() => { patchLayout(activeLayout.edit_id, { pricing: 'pending' }); reprice(activeLayout.edit_id); }}
                          style={styles.editBtn(false, touch)}>
                          <RefreshCw size={14} aria-hidden="true" /> Try again
                        </button>
                      </p>
                    )}

                    {!(activeLayout.price_ctx?.install ?? install) && activeLayout.pricing !== 'pending' && (
                      <InstallOffer
                        priceKey={`${activeLayout.edit_id}|${activeLayout.plants.length}|${activeLayout.total_cost}`}
                        plantsOnlyTotal={activeLayout.pricing === 'error' ? 0 : Number(activeLayout.total_cost) || 0}
                        fetchEstimate={installedEstimate}
                        onChoose={(sc) => switchTerms(true, sc)}
                        disabled={bookingLoading}
                      />
                    )}
                    {activeLayout.terms_switched && (activeLayout.price_ctx?.install ?? install) && (
                      <p style={{ margin: '1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        Installed by our crew ({activeLayout.price_ctx?.scope === 'existing' ? 'planted into your yard as it is' : 'full makeover'}).{' '}
                        <button type="button" onClick={() => switchTerms(false)}
                          style={{ background: 'none', border: 'none', padding: 0, color: color.brandDeep, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                          Switch back to plants only
                        </button>
                      </p>
                    )}
                    {/* Share + Book This Design CTA (phones: Book on top, both full width) */}
                    <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: 10, flexDirection: phone ? 'column-reverse' : 'row', justifyContent: phone ? 'stretch' : 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleShare}
                        disabled={activeLayout.pricing === 'pending' || activeLayout.pricing === 'error'}
                        title="Send a link so others can turn this design around in 3D"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          width: phone ? '100%' : 'auto', padding: phone ? '12px 18px' : '10px 20px',
                          background: color.white, color: color.brandDeep, fontWeight: 700, fontSize: '0.85rem',
                          border: `1.5px solid ${color.border}`, borderRadius: `${radius.button}px`, cursor: 'pointer',
                          opacity: activeLayout.pricing === 'pending' || activeLayout.pricing === 'error' ? 0.6 : 1,
                        }}
                      >
                        <Link2 size={15} /> Share this design
                      </button>
                      <button
                        type="button"
                        onClick={handleProposal}
                        disabled={pdfBusy || activeLayout.pricing === 'pending' || activeLayout.pricing === 'error'}
                        aria-busy={pdfBusy}
                        title="A printable proposal: pictures, site plan, plant list, price estimate and care tips"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          width: phone ? '100%' : 'auto', padding: phone ? '12px 18px' : '10px 20px',
                          background: color.white, color: color.brandDeep, fontWeight: 700, fontSize: '0.85rem',
                          border: `1.5px solid ${color.border}`, borderRadius: `${radius.button}px`,
                          cursor: pdfBusy ? 'wait' : 'pointer', opacity: pdfBusy || activeLayout.pricing === 'pending' || activeLayout.pricing === 'error' ? 0.6 : 1,
                        }}
                      >
                        <FileText size={15} /> {pdfBusy ? 'Making your PDF…' : 'PDF proposal'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadGlb}
                        disabled={glbBusy}
                        aria-busy={glbBusy}
                        title="A 3D file of this design (.glb) for Blender, SketchUp or a 3D viewer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          width: phone ? '100%' : 'auto', padding: phone ? '12px 18px' : '10px 20px',
                          background: color.white, color: color.brandDeep, fontWeight: 700, fontSize: '0.85rem',
                          border: `1.5px solid ${color.border}`, borderRadius: `${radius.button}px`,
                          cursor: glbBusy ? 'wait' : 'pointer', opacity: glbBusy ? 0.7 : 1,
                        }}
                      >
                        <Download size={15} /> {glbBusy ? 'Preparing 3D file…' : '3D file (.glb)'}
                      </button>
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
          onAuthSuccess={() => { setShowAuthModal(false); if (authFor === 'share') setShareAfterSignIn(true); else handleBookDesign(); }}
        />
      )}

      <ShareDesignDialog sheet={shareSheet} onClose={() => setShareSheet(null)} onStop={handleStopSharing} onRetry={handleShare} />
    </>
  );
}
