import { useRef, useMemo, useEffect, Suspense, useCallback, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Html, Preload, Sky } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  Upload, AlertTriangle, Mountain, Sun, X, Pencil
} from 'lucide-react';

import { useDesign } from '../context/DesignContext';
import { generateDepthMap, getInventoryItems, loadDesign } from '../services/api';
import GardenBackground from './GardenBackground';
import PlacedObject from './PlacedObject';
import AssetLibrarySidebar from './AssetLibrarySidebar';
import ProjectSummaryPanel from './ProjectSummaryPanel';
import SaveLoadPanel from './SaveLoadPanel';
import PlacementPreview from './PlacementPreview';
import PlacementControls from './PlacementControls';
import ObjectTransformPanel from './ObjectTransformPanel';
import ErrorBoundary from './ErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// SKY COLOR LOOKUP TABLE
// ─────────────────────────────────────────────────────────────────────────────
const SKY_KEYFRAMES = [
  [  0, '#020818', '#0a0f2e', '#05091a', '#1a2040', '#050810',  0.15 ],
  [  5, '#0f172a', '#1e293b', '#101827', '#1e3050', '#0a1020',  0.3  ],
  [  6, '#1e3a5f', '#c97b3b', '#c97b3b', '#3b6090', '#1a2030',  0.9  ],
  [  7, '#4a7fb5', '#f4a460', '#f4c080', '#6090c0', '#2a3a20',  1.6  ],
  [  8, '#5fa8d3', '#b0d4f0', '#c8e4f8', '#80b8e8', '#3a5a30',  2.2  ],
  [ 10, '#87ceeb', '#c8e8ff', '#d8eeff', '#a0c8f0', '#4a6a40',  2.6  ],
  [ 12, '#6ab4e8', '#b8dcf8', '#cce8ff', '#90c0ee', '#506840',  2.8  ],
  [ 15, '#5ba0d8', '#a8d0f0', '#bce0ff', '#88b8ec', '#4a6038',  2.5  ],
  [ 16, '#e8923a', '#f4c060', '#f4c870', '#d08840', '#503020',  2.0  ],
  [ 17, '#d4601a', '#e88030', '#e89040', '#c07030', '#402010',  1.6  ],
  [ 18, '#8b2252', '#c04828', '#a83830', '#702040', '#281008',  0.9  ],
  [ 19, '#2d1b4e', '#5b2040', '#3d1828', '#2a1838', '#180810',  0.5  ],
  [ 20, '#0d0b2a', '#1a1040', '#100820', '#14103a', '#080510',  0.2  ],
  [ 24, '#020818', '#080e28', '#05091a', '#0f1830', '#040408',  0.15 ],
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
// SUN LIGHT
// ─────────────────────────────────────────────────────────────────────────────
function SunLight({ timeOfDay = 14 }) {
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
  imgPreview: {
    width: '50%', height: 96, objectFit: 'cover', borderRadius: 8,
    border: '1px solid #F3F4F6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
};

// Hardscape icon SVG path
const HardscapeIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

// Furniture icon SVG path
const FurnitureIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);

// Plant/leaf icon
const PlantIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M12 19V6M5 12c0-4 3-7 7-7s7 3 7 7" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M7.5 7.5C9 4 12 2 12 2s3 2 4.5 5.5" />
  </svg>
);

// ── Main Component ────────────────────────────────────────────
export default function GardenDesigner() {
  const { state, dispatch } = useDesign();
  const [openDrawer, setOpenDrawer] = useState(null);

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
                timeOfDay: design.time_of_day || 14
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

  const getMediaUrl = (path) => path ? `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path}` : null;

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
  };

  const drawerTitle = openDrawer === 'environment'
    ? 'Environment Settings'
    : openDrawer ? `${openDrawer.charAt(0).toUpperCase() + openDrawer.slice(1)} Library` : '';

  return (
    <div style={S.root}>

      {/* ── SLIM LEFT SIDEBAR ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarTop}>
          <button onClick={() => toggleDrawer('plant')} style={S.sidebarBtn(openDrawer === 'plant')} title="Plants">
            <PlantIcon />
          </button>
          <button onClick={() => toggleDrawer('hardscape')} style={S.sidebarBtn(openDrawer === 'hardscape')} title="Hardscape">
            <HardscapeIcon />
          </button>
          <button onClick={() => toggleDrawer('furniture')} style={S.sidebarBtn(openDrawer === 'furniture')} title="Furniture">
            <FurnitureIcon />
          </button>
        </div>
        <button onClick={() => toggleDrawer('environment')} style={S.sidebarBtn(openDrawer === 'environment')} title="Environment Settings">
          <Sun size={24} />
        </button>
      </div>

      {/* ── SLIDE-OUT DRAWER ── */}
      <div style={S.drawer(!!openDrawer)}>
        <div style={S.drawerInner}>
          <div style={S.drawerHeader}>
            <h3 style={S.drawerTitle}>{drawerTitle}</h3>
            <button onClick={() => setOpenDrawer(null)} style={S.drawerCloseBtn}>
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
                    style={S.sliderInput} />
                </div>
              </div>
            ) : openDrawer ? (
              <AssetLibrarySidebar category={openDrawer} />
            ) : null}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={S.mainArea}>

        {/* ── TOP TOOLBAR ── */}
        <div style={S.toolbar}>
          <div style={S.toolbarLeft}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={S.projectBadge}>Project</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <input
                  type="text"
                  value={state.designName || ''}
                  onChange={e => dispatch({ type: 'SET_DESIGN_META', payload: { designName: e.target.value } })}
                  placeholder="Untitled Design"
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#1f2937', fontWeight: 700, fontSize: '0.9rem',
                    padding: '4px 8px', borderRadius: 6, width: 180,
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                  onFocus={e => { e.target.style.boxShadow = '0 0 0 2px #10b981'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.background = 'transparent'; }}
                />
                <Pencil size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
              </div>
            </div>
            <label style={S.uploadBtn}>
              <Upload size={16} />
              Upload Photo
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload} disabled={state.loading} hidden />
            </label>
          </div>
          <div style={S.toolbarRight}>
            <SaveLoadPanel toolbarVariant />
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
              {/* Dynamic Sky */}
              <Sky sunPosition={getSunPosition(state.timeOfDay)} turbidity={2.5} rayleigh={1.5} mieCoefficient={0.005} mieDirectionalG={0.8} />

              <fog attach="fog" args={[getSkyColors(state.timeOfDay).fog, 18, 55]} />

              <DynamicAmbience timeOfDay={state.timeOfDay} />
              <SunLight timeOfDay={state.timeOfDay} />
              {/* Removed the secondary static directionalLight to let SunLight and Environment control lighting */}
              <Environment preset="park" background={false} />

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

              <EffectComposer disableNormalPass multisampling={4}>
                <SSAO radius={12} intensity={1.8} luminanceInfluence={0.7} samples={12} />
                <Bloom luminanceThreshold={0.75} intensity={0.3} mipmapBlur levels={6} />
                <Vignette eskil={false} offset={0.12} darkness={0.5} />
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
          {isPlacing && <PlacementControls />}

          {/* Loading overlay */}
          {state.loading && (
            <div style={S.loadingOverlay}>
              <div style={S.spinner} />
              <p style={S.loadingText}>Creating your 3D garden...</p>
            </div>
          )}

          {/* FAB for Project Summary */}
          <div style={S.fabWrap}>
            <ProjectSummaryPanel />
          </div>

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