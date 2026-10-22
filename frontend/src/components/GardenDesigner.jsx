import { useRef, useMemo, useEffect, Suspense, useCallback, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Html, Preload } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {
  Upload, AlertTriangle, Mountain, Sun, X, Pencil, Lock, CloudOff, Save, Sprout, BrickWall, Armchair
} from 'lucide-react';

import { useDesign } from '../context/DesignContext';
import { generateDepthMap, getInventoryItems, loadDesign } from '../services/api';
import GardenBackground from './GardenBackground';
import PlacedObject from './PlacedObject';
import AssetLibrarySidebar from './AssetLibrarySidebar';
import StudioItemTray from './StudioItemTray';
import ProjectSummaryPanel from './ProjectSummaryPanel';
import SaveLoadPanel from './SaveLoadPanel';
import PlacementPreview from './PlacementPreview';
import PlacementControls from './PlacementControls';
import ObjectTransformPanel from './ObjectTransformPanel';
import ErrorBoundary from './ErrorBoundary';
import StudioAITeaser from './StudioAITeaser';
import { useIsPhone } from './ui/useMediaQuery';
import { saveStudioDraft, loadStudioDraft, clearStudioDraft, trackFunnel } from '../services/guestSession';
import { DEFAULT_TIME_OF_DAY, TIME_PRESETS } from '../data/studioLight';
import { MEDIA_BASE_URL as MEDIA_ROOT } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// SKY COLOR LOOKUP TABLE
// ─────────────────────────────────────────────────────────────────────────────
// [hour, sky overhead, horizon, haze (fog), ambient, ground bounce, sun intensity]
// Daytime haze is a soft blue-grey, never white: it is what the eye sees around the lot.
const SKY_KEYFRAMES = [
  [  0,   '#050b1f', '#0c1430', '#0a1226', '#1a2040', '#050810', 0.12 ],
  [  5,   '#101a33', '#1d2a45', '#1a2438', '#1e3050', '#0a1020', 0.25 ],
  [  6,   '#3c5f8a', '#e0a878', '#8f8c8c', '#7088a8', '#2a2a24', 0.8  ],
  [  7,   '#4f86bf', '#d9c7a8', '#9eacb4', '#94a8c0', '#3a4030', 1.3  ],
  [  8,   '#4f93cf', '#a9cbe3', '#9cb4c4', '#a8bcd2', '#3f5534', 1.7  ],
  [ 10,   '#4a90d0', '#a3c8e2', '#98b2c2', '#aec0d4', '#46603a', 1.95 ],
  [ 12,   '#4689cc', '#9fc4e0', '#96b0c0', '#b0c2d6', '#4a643c', 2.05 ],
  [ 15,   '#4d8dcc', '#a8c8de', '#9cb2c0', '#b4c2d2', '#48603a', 1.95 ],
  [ 16,   '#5a8fc8', '#c6c6b6', '#a2aca8', '#c4bca8', '#4a5434', 1.8  ],
  [ 16.5, '#6290c4', '#d0c6ae', '#a6aaa2', '#ccb898', '#4a5032', 1.7  ],
  [ 17,   '#6a8cbc', '#dcbc98', '#aaa49a', '#d0ac88', '#46482e', 1.5  ],
  [ 18,   '#4a5f8e', '#d9906a', '#7c7280', '#a08890', '#2e2a24', 0.85 ],
  [ 19,   '#24284e', '#5a4060', '#2c2c46', '#4a4a6e', '#141220', 0.4  ],
  [ 20,   '#0d1030', '#1a1a44', '#121430', '#2a2e52', '#080a14', 0.2  ],
  [ 24,   '#050b1f', '#0c1430', '#0a1226', '#1a2040', '#050810', 0.12 ],
];

function hexToColor(hex) {
  return new THREE.Color(hex);
}

function lerpColor(hexA, hexB, t) {
  const cA = new THREE.Color(hexA);
  const cB = new THREE.Color(hexB);
  return new THREE.Color().lerpColors(cA, cB, t);
}

function getSkyColors(t) {
  const time = Number(t);
  const clampedTime = Math.max(SKY_KEYFRAMES[0][0], Math.min(SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1][0], time));
  let lo = SKY_KEYFRAMES[0];
  let hi = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (clampedTime >= SKY_KEYFRAMES[i][0] && clampedTime <= SKY_KEYFRAMES[i + 1][0]) {
      lo = SKY_KEYFRAMES[i];
      hi = SKY_KEYFRAMES[i + 1];
      break;
    }
  }
  const alpha = lo[0] === hi[0] ? 0 : (clampedTime - lo[0]) / (hi[0] - lo[0]);
  return {
    sky:          lerpColor(lo[1], hi[1], alpha),
    horizon:      lerpColor(lo[2], hi[2], alpha),
    fog:          lerpColor(lo[3], hi[3], alpha),
    ambient:      lerpColor(lo[4], hi[4], alpha),
    hemiGnd:      lerpColor(lo[5], hi[5], alpha),
    sunIntensity: lo[6] + (hi[6] - lo[6]) * alpha,
  };
}

function getSunPosition(timeOfDay) {
  // 12:00 -> elevation 90 (straight up)
  // 06:00 -> elevation 0 (horizon)
  // 18:00 -> elevation 0 (horizon)
  // 20:00 -> elevation -30 (below horizon)
  const elevation = 90 - Math.abs(timeOfDay - 12) * 15;
  const azimuth = (timeOfDay - 12) * 15; // moves from east to west

  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);

  const r = 100;
  const x = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.cos(theta);

  return [x, y, z];
}

// ─────────────────────────────────────────────────────────────────────────────
// SKY DOME — overhead → horizon gradient from SKY_KEYFRAMES, with a soft sun glow
// ─────────────────────────────────────────────────────────────────────────────
const SKY_VERTEX = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SKY_FRAGMENT = `
  uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; uniform float sunGlow;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    vec3 col = mix(horizon, top, pow(smoothstep(-0.02, 0.32, d.y), 0.7));
    col = mix(horizon * 0.8, col, smoothstep(-0.25, 0.0, d.y));   // below the horizon: a little darker
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += sunColor * (pow(s, 400.0) * 0.9 + pow(s, 10.0) * 0.18) * sunGlow;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

function SkyDome({ timeOfDay }) {
  const materialRef = useRef();
  const [uniforms] = useState(() => ({
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunGlow: { value: 0 },
  }));
  useEffect(() => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    const { sky, horizon } = getSkyColors(timeOfDay);
    const [x, y, z] = getSunPosition(timeOfDay);
    u.top.value.copy(sky);
    u.horizon.value.copy(horizon);
    u.sunDir.value.set(x, y, z).normalize();
    const elevation = y / 100;
    u.sunGlow.value = THREE.MathUtils.clamp((elevation + 0.05) * 6, 0, 1);
    u.sunColor.value.set(elevation > 0.35 ? '#fff4e0' : '#ffc890');
  }, [timeOfDay]);
  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
      <shaderMaterial ref={materialRef} vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} uniforms={uniforms}
        side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUN LIGHT
// ─────────────────────────────────────────────────────────────────────────────
function SunLight({ timeOfDay = DEFAULT_TIME_OF_DAY }) {
  const lightRef = useRef();
  useFrame(() => {
    if (!lightRef.current) return;
    const { sunIntensity, ambient } = getSkyColors(timeOfDay);
    // At night, don't emit negative light
    lightRef.current.intensity = Math.max(0, sunIntensity);
    lightRef.current.color.copy(ambient).lerp(new THREE.Color('#fffaf0'), 0.7);
  });
  const position = useMemo(() => getSunPosition(timeOfDay), [timeOfDay]);
  const { sunIntensity } = useMemo(() => getSkyColors(timeOfDay), [timeOfDay]);
  return (
    <directionalLight
      ref={lightRef} position={position} intensity={Math.max(0, sunIntensity)} color="#fffaf0" castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001}
      shadow-camera-far={150} shadow-camera-left={-30}
      shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT + HEMISPHERE LIGHT UPDATER
// ─────────────────────────────────────────────────────────────────────────────
function DynamicAmbience({ timeOfDay }) {
  const ambientRef = useRef();
  const hemiRef    = useRef();
  useFrame(() => {
    const { ambient, hemiGnd, sky } = getSkyColors(timeOfDay);
    if (ambientRef.current) {
      ambientRef.current.color.copy(ambient);
      ambientRef.current.intensity = 0.3 + getSkyColors(timeOfDay).sunIntensity * 0.15;
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(sky);
      hemiRef.current.groundColor.copy(hemiGnd);
    }
  });
  const init = useMemo(() => getSkyColors(timeOfDay), []);
  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.45} color={`#${init.ambient.getHexString()}`} />
      <hemisphereLight
        ref={hemiRef}
        args={[`#${init.sky.getHexString()}`, `#${init.hemiGnd.getHexString()}`, 0.5]}
        position={[0, 50, 0]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE STYLE OBJECTS — bypass Tailwind JIT issues
   ═══════════════════════════════════════════════════════════════════════════ */
const S = {
  root: {
    position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
    background: '#F9FAFB', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    display: 'flex',
  },
  /* ── Slim sidebar ── */
  sidebar: {
    width: 60, flexShrink: 0, background: '#fff', borderRight: '1px solid #E5E7EB',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 0', zIndex: 30, boxShadow: '1px 0 4px rgba(0,0,0,0.04)',
  },
  sidebarTop: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  sidebarBtn: (active) => ({
    width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
    background: active ? '#059669' : 'transparent',
    color: active ? '#fff' : '#9CA3AF',
  }),
  /* ── Drawer ── */
  drawer: (open) => ({
    position: 'absolute', top: 0, left: 60, height: '100%', width: 300,
    background: '#fff', borderRight: '1px solid #E5E7EB', zIndex: 20,
    boxShadow: open ? '4px 0 24px rgba(0,0,0,0.08)' : 'none',
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s ease-in-out',
    display: 'flex', flexDirection: 'column',
  }),
  drawerInner: { height: '100%', display: 'flex', flexDirection: 'column', padding: 24 },
  drawerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24,
  },
  drawerTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#1f2937', margin: 0 },
  drawerCloseBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
    background: '#F3F4F6', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  drawerContent: { flex: 1, overflowY: 'auto', paddingRight: 4 },
  /* ── Environment drawer sliders ── */
  sliderGroup: { marginBottom: 28 },
  sliderHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 12,
  },
  sliderLabel: { display: 'flex', alignItems: 'center', gap: 8 },
  sliderValue: { color: '#059669', fontWeight: 700 },
  sliderInput: {
    width: '100%', height: 6, borderRadius: 4, appearance: 'none', cursor: 'pointer',
    background: '#E5E7EB', accentColor: '#10b981', outline: 'none',
  },
  /* ── Top toolbar ── */
  toolbar: {
    height: 52, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #E5E7EB', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 10, flexShrink: 0,
  },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  projectBadge: {
    background: '#F3F4F6', padding: '2px 8px', borderRadius: 4,
    fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
  },
  projectName: { color: '#1f2937', fontWeight: 700, fontSize: '0.9rem' },
  uploadBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0',
    borderRadius: 8, cursor: 'pointer', color: '#059669',
    fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
  },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 8 },
  /* ── Main content area ── */
  mainArea: { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' },
  canvasWrap: { flex: 1, position: 'relative' },
  /* ── Overlays ── */
  loadingOverlay: {
    position: 'absolute', inset: 0, zIndex: 50,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)',
  },
  spinner: {
    width: 48, height: 48, border: '4px solid #10b981', borderTopColor: 'transparent',
    borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16,
  },
  loadingText: { color: '#1f2937', fontWeight: 700, fontSize: '1.1rem' },
  fabWrap: {
    position: 'absolute', bottom: 24, right: 24, zIndex: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16,
    pointerEvents: 'auto',
  },
  transformWrap: { position: 'absolute', top: 16, right: 16, zIndex: 10, pointerEvents: 'auto' },
  errorBar: {
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
    background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C',
    padding: '8px 16px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem', fontWeight: 600,
  },
  analysisBar: {
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
    background: '#fff', border: '1px solid #BBF7D0', color: '#065F46',
    padding: '16px 24px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
  },
  analysisTitle: { fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', fontSize: '1.05rem' },
  analysisBody: { color: '#4B5563', fontSize: '0.9rem' },
  analysisWarn: { color: '#D97706', fontSize: '0.8rem', fontWeight: 500, marginTop: 4 },
  imgPreviewWrap: { display: 'flex', gap: 8 },
  /* ── Phones: tools in a bottom tab bar, libraries in a bottom sheet ── */
  phoneRoot: { flexDirection: 'column' },
  phoneSidebar: {
    order: 2, width: '100%', height: 64, flexDirection: 'row', justifyContent: 'space-around',
    padding: '0 8px', borderRight: 'none', borderTop: '1px solid #E5E7EB', boxShadow: '0 -1px 4px rgba(0,0,0,0.04)',
  },
  phoneSidebarTop: { flexDirection: 'row', flex: 'none', gap: 0, justifyContent: 'space-around', width: '75%' },
  tabBtn: (active) => ({
    minWidth: 64, height: 54, borderRadius: 12, border: 'none', cursor: 'pointer', padding: '4px 6px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    background: active ? '#ECFDF5' : 'transparent', color: active ? '#047857' : '#6B7280',
  }),
  tabLabel: { fontSize: 11, fontWeight: 700, lineHeight: 1 },
  phoneDrawer: (open, fit) => ({
    top: 'auto', left: 0, right: 0, bottom: 64, width: '100%', height: fit ? 'auto' : '62%', maxHeight: '62%',
    borderRight: 'none', borderTop: '1px solid #E5E7EB', borderRadius: '20px 20px 0 0',
    boxShadow: open ? '0 -8px 32px rgba(0,0,0,0.12)' : 'none',
    transform: open ? 'translateY(0)' : 'translateY(110%)',
  }),
  phoneToolbar: { padding: '0 10px', gap: 8 },
  imgPreview: {
    width: '50%', height: 96, objectFit: 'cover', borderRadius: 8,
    border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
};

// Catalog tools in the sidebar (bottom bar on phones, with labels there)
const LIBRARY_TOOLS = [
  { key: 'plant',     label: 'Plants',    Icon: Sprout },
  { key: 'hardscape', label: 'Hardscape', Icon: BrickWall },
  { key: 'furniture', label: 'Furniture', Icon: Armchair },
];

// ── Main Component ────────────────────────────────────────────
// guest: the free Studio on /try-studio. Everything that needs an account
// (photo terrain, saving, checkout, AI) calls onGate(intent) instead, and the
// work-in-progress is kept on this device until the visitor signs in.
export default function GardenDesigner({ guest = false, onGate = () => {} }) {
  const { state, dispatch } = useDesign();
  const [openDrawer, setOpenDrawer] = useState(null);
  // Phones: catalogs open as a one-row tray over the garden; "See all" opens the full library sheet
  const [fullLibrary, setFullLibrary] = useState(false);
  const phone = useIsPhone();

  // A guest draft is restored on /try-studio, or moved into the account on /studio.
  // (After an in-app sign-in the items are often still in memory, so only load when empty.)
  const [guestDraft] = useState(() => {
    if (new URLSearchParams(window.location.search).get('design_id')) return null;
    const draft = loadStudioDraft();
    // sizeOnly: the landing estimate passed just the visitor's yard size, no items yet
    return draft?.placedItems.length || draft?.sizeOnly ? draft : null;
  });
  // Guests always get their own draft; a signed-in user's in-memory work wins over it
  const [draftToRestore] = useState(() => (guestDraft && (guest || !state.placedItems.length) ? guestDraft : null));
  const [showImportBanner, setShowImportBanner] = useState(!guest && !!guestDraft?.placedItems.length);

  useEffect(() => {
    if (!guest && guestDraft) clearStudioDraft();
    // Guest with no draft: anything still in memory belongs to whoever used this
    // browser before (logout doesn't clear the Studio), so start clean
    if (guest && !guestDraft && (state.placedItems.length || state.designId)) dispatch({ type: 'RESET' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  useEffect(() => {
    if (!draftToRestore) return;
    dispatch({
      type: 'LOAD_DESIGN',
      payload: {
        designId: null,
        designName: draftToRestore.designName || 'My Garden',
        placedItems: draftToRestore.placedItems,
        dimensions: draftToRestore.dimensions || { width: 10, length: 15, terrainType: 'flat' },
        terrainHeight: draftToRestore.terrainHeight ?? 1.5,
        timeOfDay: draftToRestore.timeOfDay ?? DEFAULT_TIME_OF_DAY,
        depthData: null,
        originalImageUrl: null,
      },
    });
    // Now it lives in the signed-in Studio; mark unsaved so the save button nags
    if (!guest) dispatch({ type: 'SET_DESIGN_META', payload: { isDirty: true } });
  }, [draftToRestore, guest, dispatch]);

  // Guests: keep the draft on this device as they work
  useEffect(() => {
    if (!guest) return;
    const draft = {
      designName: state.designName, placedItems: state.placedItems, dimensions: state.dimensions,
      terrainHeight: state.terrainHeight, timeOfDay: state.timeOfDay,
    };
    const t = setTimeout(() => saveStudioDraft(draft), 400);
    return () => clearTimeout(t);
  }, [guest, state.placedItems, state.designName, state.dimensions, state.terrainHeight, state.timeOfDay]);

  // Funnel: a guest placing an item. A restore or reset on mount changes the item
  // count too, so ignore changes until the count settles at the expected value.
  const settleAtRef = useRef(
    draftToRestore ? draftToRestore.placedItems.length
      : guest && !guestDraft && (state.placedItems.length || state.designId) ? 0 : null,
  );
  const itemCountRef = useRef(state.placedItems.length);
  useEffect(() => {
    const count = state.placedItems.length;
    if (settleAtRef.current !== null) {
      if (count === settleAtRef.current) settleAtRef.current = null;
    } else if (guest && count > itemCountRef.current) {
      trackFunnel('first_item_placed');
    }
    itemCountRef.current = count;
  }, [guest, state.placedItems.length]);

  // Fetch live inventory items/products so placed objects can lookup model paths
  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await getInventoryItems();
        dispatch({ type: 'SET_PRODUCTS', payload: data });
      } catch (err) {
        console.error('Failed to load inventory items:', err);
      }
    }
    if (state.products.length === 0) {
      fetchProducts();
    }
  }, [state.products.length, dispatch]);

  // Load design from query parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const designIdParam = params.get('design_id');
    if (designIdParam) {
      const designId = parseInt(designIdParam, 10);
      if (designId && designId !== state.designId) {
        const autoLoadDesign = async () => {
          try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const design = await loadDesign(designId);
            dispatch({
              type: 'LOAD_DESIGN',
              payload: {
                designId: design.id,
                designName: design.name,
                depthData: design.depth_data,
                originalImageUrl: design.original_image_url || '',
                placedItems: (design.placed_items || []).map((item, idx) => ({
                  id: Date.now() + idx,
                  productId: item.product_id,
                  name: item.name,
                  modelType: item.model_type || item.modelType,
                  price: item.price,
                  position: item.position || { x: 0, y: 0, z: 0 },
                  rotation: item.rotation || { x: 0, y: 0, z: 0 },
                  scale: item.scale || { x: 1, y: 1, z: 1 }
                })),
                dimensions: design.dimensions || { width: 10, length: 15, terrainType: 'flat' },
                terrainHeight: design.terrain_height || 1.5,
                timeOfDay: design.time_of_day ?? DEFAULT_TIME_OF_DAY
              }
            });
          } catch (err) {
            console.error('Auto-load design failed:', err);
            dispatch({ type: 'SET_ERROR', payload: 'Failed to auto-load design: ' + err.message });
          } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        };
        autoLoadDesign();
      }
    }
  }, [state.designId, dispatch]);

  const formattedTime = useMemo(() => {
    const hours = Math.floor(state.timeOfDay);
    const minutes = Math.round((state.timeOfDay - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }, [state.timeOfDay]);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [terrainDepth, setTerrainDepth] = useState(3.0);
  const fileInputRef = useRef(null);
  const canvasRef = useRef();
  const terrainRef = useRef();
  const orbitRef = useRef();

  const isPlacing = state.placementMode !== 'idle';

  const getMediaUrl = (path) => path ? `${MEDIA_ROOT}${path}` : null;

  // ── Image Upload ──────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      dispatch({ type: 'SET_ERROR', payload: 'Please upload a JPG, PNG, or WebP image.' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      dispatch({ type: 'SET_ERROR', payload: 'File must be under 15MB.' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: '' });
    dispatch({ type: 'SET_IMAGE', payload: URL.createObjectURL(file) });

    try {
      const result = await generateDepthMap(file);
      if (!result.depth_map_url) throw new Error('Missing depth map');
      dispatch({
        type: 'SET_DEPTH_DATA',
        payload: {
          depth_map_url: result.depth_map_url,
          normal_map_url: result.normal_map_url || result.depth_map_url,
          rock_mask_url: result.rock_mask_url || result.depth_map_url,
          grass_mask_url: result.grass_mask_url || result.depth_map_url,
        },
      });

      if (result.detected_objects && result.detected_objects.length > 0) {
        const validObjects = [];
        let ignoredCount = 0;
        result.detected_objects.forEach(obj => {
          const matchedProduct = state.products.find(p => {
            const objName = (obj.model_type || obj.name || '').toLowerCase();
            const pPath = (p.model_path || '').toLowerCase();
            const pName = (p.name || '').toLowerCase();
            return (pPath === objName || objName.includes(pName) || pName.includes(objName)) && p.model_path;
          });
          if (matchedProduct) {
            validObjects.push({ ...obj, matchedProduct });
          } else {
            ignoredCount++;
          }
        });

        const TERRAIN_SIZE = 24;
        const TERRAIN_Y_OFFSET = 0;
        validObjects.forEach((obj, idx) => {
          const worldX = obj.position.norm_x * (TERRAIN_SIZE / 2);
          const worldZ = obj.position.norm_z * (TERRAIN_SIZE / 2);
          const yNorm = (obj.position.norm_z + 1) / 2;
          const groundHeight = 0.1 + 0.05 * Math.sin(yNorm * Math.PI * 0.5);
          const worldY = TERRAIN_Y_OFFSET + (groundHeight + 0.015) * (state.terrainHeight * 5);
          dispatch({
            type: 'ADD_ITEM',
            payload: {
              id: Date.now() + idx + Math.random(),
              productId: obj.matchedProduct.id,
              name: obj.matchedProduct.name,
              modelType: obj.matchedProduct.model_path,
              price: Number(obj.matchedProduct.unit_price || 0),
              position: { x: worldX, y: worldY, z: worldZ },
              rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
              scale: { x: obj.scale, y: obj.scale, z: obj.scale },
              autoDetected: true,
            },
          });
        });
        setAnalysisResult({ added: validObjects.length, ignored: ignoredCount });
        setTimeout(() => setAnalysisResult(null), 8000);
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message || 'Failed to generate terrain.' });
      dispatch({ type: 'SET_DEPTH_DATA', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleTerrainClick = useCallback((e) => {
    if (isPlacing && state.previewValid) {
      dispatch({ type: 'CONFIRM_PLACEMENT' });
    }
  }, [isPlacing, state.previewValid, dispatch]);

  useEffect(() => {
    const handleKey = (e) => {
      if (isPlacing) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedItemId) dispatch({ type: 'REMOVE_ITEM', payload: state.selectedItemId });
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'DESELECT_ALL' });
        dispatch({ type: 'SELECT_PRODUCT', payload: null });
        setOpenDrawer(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state.selectedItemId, dispatch, isPlacing]);

  const toggleDrawer = (category) => {
    setOpenDrawer(openDrawer === category ? null : category);
    setFullLibrary(false);
  };
  const trayOpen = phone && !!openDrawer && openDrawer !== 'environment' && !fullLibrary;
  const sheetOpen = !!openDrawer && !trayOpen;

  const drawerTitle = openDrawer === 'environment'
    ? 'Environment Settings'
    : openDrawer ? `${openDrawer.charAt(0).toUpperCase() + openDrawer.slice(1)} Library` : '';

  return (
    <div style={phone ? { ...S.root, ...S.phoneRoot } : S.root}>

      {/* ── SLIM LEFT SIDEBAR (bottom tab bar on phones) ── */}
      <div style={phone ? { ...S.sidebar, ...S.phoneSidebar } : S.sidebar}>
        <div style={phone ? { ...S.sidebarTop, ...S.phoneSidebarTop } : S.sidebarTop}>
          {LIBRARY_TOOLS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => toggleDrawer(key)} style={phone ? S.tabBtn(openDrawer === key) : S.sidebarBtn(openDrawer === key)}
              title={label} aria-label={label} aria-pressed={openDrawer === key}>
              <Icon size={phone ? 21 : 24} />{phone && <span style={S.tabLabel}>{label}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => toggleDrawer('environment')} style={phone ? S.tabBtn(openDrawer === 'environment') : S.sidebarBtn(openDrawer === 'environment')}
          title="Light and terrain" aria-label="Light and terrain" aria-pressed={openDrawer === 'environment'}>
          <Sun size={phone ? 21 : 24} />{phone && <span style={S.tabLabel}>Light</span>}
        </button>
      </div>

      {/* ── SLIDE-OUT DRAWER ── */}
      <div style={phone ? { ...S.drawer(sheetOpen), ...S.phoneDrawer(sheetOpen, openDrawer === 'environment') } : S.drawer(!!openDrawer)}>
        <div style={phone ? { ...S.drawerInner, padding: '16px 16px 8px' } : S.drawerInner}>
          <div style={S.drawerHeader}>
            <h3 style={S.drawerTitle}>{drawerTitle}</h3>
            <button onClick={() => { setOpenDrawer(null); setFullLibrary(false); }} style={S.drawerCloseBtn} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div style={S.drawerContent}>
            {openDrawer === 'environment' ? (
              <div>
                {/* Reference image previews */}
                {state.originalImageUrl && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Reference Images
                    </p>
                    <div style={S.imgPreviewWrap}>
                      <img src={state.originalImageUrl} alt="Original" style={S.imgPreview} />
                      {state.depthData?.depth_map_url && (
                        <img src={getMediaUrl(state.depthData.depth_map_url)} alt="Depth"
                          style={{ ...S.imgPreview, filter: 'grayscale(100%)' }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Terrain Depth */}
                <div style={S.sliderGroup}>
                  <div style={S.sliderHeader}>
                    <span style={S.sliderLabel}>
                      <Mountain size={14} style={{ color: '#10b981' }} /> Terrain Depth
                    </span>
                    <span style={S.sliderValue}>{terrainDepth.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="10" step="0.1" value={terrainDepth}
                    onChange={e => setTerrainDepth(+e.target.value)} style={S.sliderInput} />
                </div>

                {/* Terrain Height */}
                <div style={S.sliderGroup}>
                  <div style={S.sliderHeader}>
                    <span style={S.sliderLabel}>
                      <Mountain size={14} style={{ color: '#10b981' }} /> Terrain Height
                    </span>
                    <span style={S.sliderValue}>{state.terrainHeight.toFixed(1)}m</span>
                  </div>
                  <input type="range" min="0.5" max="5" step="0.1" value={state.terrainHeight}
                    onChange={e => dispatch({ type: 'SET_TERRAIN_HEIGHT', payload: +e.target.value })}
                    style={S.sliderInput} />
                </div>

                {/* Time of Day */}
                <div style={S.sliderGroup}>
                  <div style={S.sliderHeader}>
                    <span style={S.sliderLabel}>
                      <Sun size={14} style={{ color: '#10b981' }} /> Time of Day
                    </span>
                    <span style={S.sliderValue}>{formattedTime}</span>
                  </div>
                  <input type="range" min="6" max="20" step="0.1" value={state.timeOfDay}
                    onChange={e => dispatch({ type: 'SET_TIME_OF_DAY', payload: +e.target.value })}
                    style={S.sliderInput} aria-label="Time of day" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 10 }}>
                    {TIME_PRESETS.map(p => {
                      const on = Math.abs(state.timeOfDay - p.hour) < 0.2;
                      return (
                        <button key={p.label} type="button" aria-pressed={on}
                          onClick={() => dispatch({ type: 'SET_TIME_OF_DAY', payload: p.hour })}
                          style={{ minHeight: 36, borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                            border: on ? '1.5px solid #6ee7b7' : '1px solid #E5E7EB', background: on ? '#ECFDF5' : '#fff',
                            color: on ? '#065F46' : '#4B5563' }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : openDrawer ? (
              <AssetLibrarySidebar category={openDrawer} onPick={phone ? () => setFullLibrary(false) : undefined} />
            ) : null}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{ ...S.mainArea, minWidth: 0, minHeight: 0 }}>

        {/* ── TOP TOOLBAR ── */}
        <div style={phone ? { ...S.toolbar, ...S.phoneToolbar } : S.toolbar}>
          <div style={{ ...S.toolbarLeft, gap: phone ? 8 : 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {!phone && <span style={S.projectBadge}>Project</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', minWidth: 0 }}>
                <input
                  type="text"
                  value={state.designName || ''}
                  onChange={e => dispatch({ type: 'SET_DESIGN_META', payload: { designName: e.target.value } })}
                  placeholder="Untitled Design"
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#1f2937', fontWeight: 700, fontSize: '0.9rem',
                    padding: '4px 8px', borderRadius: 6, width: phone ? '100%' : 180, minWidth: 0,
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                  onFocus={e => { e.target.style.boxShadow = '0 0 0 2px #10b981'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.background = 'transparent'; }}
                />
                {!phone && <Pencil size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />}
              </div>
            </div>
            {guest ? (
              <button style={{ ...S.uploadBtn, flexShrink: 0 }} onClick={() => onGate('photo')} title="Turn a photo of your own yard into 3D terrain (free account needed)"
                aria-label="Use my yard photo">
                <Lock size={14} />
                {phone ? 'Photo' : 'Use my yard photo'}
              </button>
            ) : (
              <label style={{ ...S.uploadBtn, flexShrink: 0 }} title="Upload Photo" aria-label="Upload Photo">
                <Upload size={16} />
                {!phone && 'Upload Photo'}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload} disabled={state.loading} hidden />
              </label>
            )}
          </div>
          <div style={{ ...S.toolbarRight, flexShrink: 0 }}>
            {guest ? (
              <>
                {!phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', fontWeight: 600 }}
                        title="Your design is kept in this browser until you save it to an account">
                    <CloudOff size={14} /> Draft on this device
                  </span>
                )}
                <button onClick={() => onGate('save')} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none',
                  background: '#059669', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  <Save size={14} /> {phone ? 'Save' : 'Save to my account'}
                </button>
              </>
            ) : (
              <SaveLoadPanel toolbarVariant />
            )}
          </div>
        </div>

        {/* ── 3D CANVAS ── */}
        <div style={S.canvasWrap} id="canvas-container">
          <ErrorBoundary onReset={() => window.location.reload()}>
            <Canvas
              ref={canvasRef} shadows dpr={[1, 2]}
              camera={{ position: [0, 12, 22], fov: 50, near: 0.1, far: 1000 }}
              gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9,
                    antialias: true, powerPreference: 'high-performance' }}
              onPointerMissed={() => {
                if (!isPlacing) dispatch({ type: 'DESELECT_ALL' });
              }}
            >
              <SkyDome timeOfDay={state.timeOfDay} />

              <fog attach="fog" args={[getSkyColors(state.timeOfDay).fog, 18, 55]} />

              <DynamicAmbience timeOfDay={state.timeOfDay} />
              <SunLight timeOfDay={state.timeOfDay} />
              {/* Removed the secondary static directionalLight to let SunLight and Environment control lighting */}
              {/* Reflections only: at full strength the "park" map washed the whole garden out */}
              <Environment preset="park" background={false}
                environmentIntensity={0.12 + 0.33 * Math.min(1, getSkyColors(state.timeOfDay).sunIntensity / 2)} />

              <Suspense fallback={null}>
                <GardenBackground
                  ref={terrainRef}
                  originalImageUrl={state.originalImageUrl}
                  depthMapUrl={state.depthData ? getMediaUrl(state.depthData.depth_map_url) : null}
                  normalMapUrl={state.depthData ? getMediaUrl(state.depthData.normal_map_url) : null}
                  rockMaskUrl={state.depthData ? getMediaUrl(state.depthData.rock_mask_url) : null}
                  grassMaskUrl={state.depthData ? getMediaUrl(state.depthData.grass_mask_url) : null}
                  displacementScale={terrainDepth}
                  onTerrainClick={handleTerrainClick}
                />
                {state.placedItems.map(item => (
                  item.id === state.editingItemId ? null : (
                    <PlacedObject key={item.id} item={item} orbitControlsRef={orbitRef} />
                  )
                ))}
                {isPlacing && <PlacementPreview terrainRef={terrainRef} />}
              </Suspense>

              {/* The composer turns the renderer's own tone mapping off, so it is applied here (last).
                  NEUTRAL keeps plant and stone colours true; ACES/none blew daylight out to white. */}
              <EffectComposer multisampling={phone ? 0 : 4}>
                {!phone ? <N8AO aoRadius={1.2} intensity={2.2} distanceFalloff={0.8} halfRes /> : <></>}
                <Bloom luminanceThreshold={0.9} intensity={0.25} mipmapBlur levels={6} />
                <Vignette eskil={false} offset={0.12} darkness={0.45} />
                <ToneMapping mode={ToneMappingMode.NEUTRAL} />
              </EffectComposer>

              <OrbitControls ref={orbitRef} makeDefault enablePan={!isPlacing} enableZoom enableRotate
                panSpeed={0.5} zoomSpeed={0.6} rotateSpeed={0.4}
                minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 2.1}
                minDistance={5} maxDistance={50}
                enableDamping dampingFactor={0.1}
              />
              <Preload all />
            </Canvas>
          </ErrorBoundary>

          {/* Placement controls overlay */}
          {isPlacing && !(trayOpen && state.placementMode === 'placing') && <PlacementControls />}

          {trayOpen && (
            <StudioItemTray category={openDrawer} onCategory={setOpenDrawer}
              onClose={() => setOpenDrawer(null)} onSeeAll={() => setFullLibrary(true)} />
          )}

          {/* Loading overlay */}
          {state.loading && (
            <div style={S.loadingOverlay}>
              <div style={S.spinner} />
              <p style={S.loadingText}>Creating your 3D garden...</p>
            </div>
          )}

          {/* FAB for Project Summary */}
          <div style={phone ? { ...S.fabWrap, bottom: trayOpen ? (isPlacing ? 74 : 204) : 12, right: 12 } : S.fabWrap}>
            <ProjectSummaryPanel onCheckout={guest ? () => onGate('checkout') : undefined} compact={phone} />
          </div>

          {/* Let AI design this yard: carries lot size + chosen plants to the AI Designer */}
          {!isPlacing && <StudioAITeaser guest={guest} onGate={onGate} />}

          {/* Signed in after starting as a guest: the draft was moved in */}
          {showImportBanner && (
            <div style={{ ...S.analysisBar, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: '0.9rem', color: '#065F46', fontWeight: 600 }}>
                We brought over the design you started. Click <b>Save</b> to keep it in your account.
              </span>
              <button onClick={() => setShowImportBanner(false)} aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Object Transform (floating top-right) */}
          {/* <div style={S.transformWrap}>
            <ObjectTransformPanel />
          </div> */}

          {/* Error messages */}
          {state.error && (
            <div style={S.errorBar}>
              <AlertTriangle size={16} />
              <span>{state.error}</span>
              <button onClick={() => dispatch({ type: 'SET_ERROR', payload: '' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Analysis feedback */}
          {analysisResult && (
            <div style={S.analysisBar}>
              <p style={S.analysisTitle}>
                <svg style={{ width: 20, height: 20, marginRight: 8, color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Terrain Analysis Complete
              </p>
              <p style={S.analysisBody}>Added <strong>{analysisResult.added}</strong> matching plants from inventory.</p>
              {analysisResult.ignored > 0 && (
                <p style={S.analysisWarn}>Ignored {analysisResult.ignored} unrecognized items.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyframe animation for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}