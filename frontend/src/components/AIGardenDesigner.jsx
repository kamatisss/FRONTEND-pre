import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ArrowLeft, Check, Compass, ShieldAlert, Upload, X, CalendarPlus, Info, Cpu, Wrench, RefreshCw, Box, ChevronLeft, ChevronRight } from 'lucide-react';
import ZonePicker from './ZonePicker';
import BudgetPicker from './BudgetPicker';
import PageHero from './ui/PageHero';
import { color, cardStyle, inputStyle, labelStyle, radius } from './ui/tokens';
import { useCart } from '../context/CartContext';
import { lotPlantsToStudioItems } from '../data/sampleGarden';
import { API_BASE_URL as API_ROOT } from '../config';
import { plantBudgetFromAllIn } from '../data/pricing';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import { useDesign } from '../context/DesignContext';
import { getInventoryItems, getPricing } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { saveGuestDesign, loadGuestDesign, loadAiPrefill, clearAiPrefill } from '../services/guestSession';
import GuestAuthModal from './GuestAuthModal';
import { useIsPhone, useMediaQuery } from './ui/useMediaQuery';
import { DEFAULT_TIME_OF_DAY } from '../data/studioLight';
import { defaultCorners } from '../data/photoPose';

const LOADING_PHASES = [
  'Analyzing your garden space…',
  'Composing Symmetrical layout…',
  'Composing Minimalist layout…',
  'Composing Lush / Organic layout…',
  'Balancing flora and budget…',
  'Finalizing your garden options…',
];

const getPlantEmoji = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('palm')) return '🌴';
  if (n.includes('pine') || n.includes('fir') || n.includes('spruce')) return '🌲';
  if (n.includes('oak') || n.includes('maple') || n.includes('tree')) return '🌳';
  if (n.includes('rose')) return '🌹';
  if (n.includes('lavender') || n.includes('violet')) return '💜';
  if (n.includes('sunflower')) return '🌻';
  if (n.includes('flower') || n.includes('bloom') || n.includes('blossom')) return '🌸';
  if (n.includes('banana') || n.includes('tropical')) return '🍌';
  if (n.includes('bamboo')) return '🎋';
  if (n.includes('cactus') || n.includes('succulent')) return '🌵';
  if (n.includes('fern') || n.includes('grass')) return '🌿';
  if (n.includes('shrub') || n.includes('boxwood') || n.includes('hedge')) return '🫧';
  return '🪴';
};

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

  // Budget as a range; three designs spread across it. "install" = all-in with our crew,
  // otherwise plants only (the customer plants them).
  const [budgetRange, setBudgetRange] = useState({ min: 50000, max: 100000 });
  const [install, setInstall] = useState(true);
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
  const [activeLayout, setActiveLayout] = useState(null);
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
  const [photoCorners, setPhotoCorners] = useState(null);
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

  // Restore guest session on mount (guests only)
  useEffect(() => {
    if (!user) {
      const saved = loadGuestDesign();
      if (saved?.layouts?.length) {
        setGeneratedLayouts(saved.layouts);
        setActiveLayout(saved.layouts[0]);
        if (saved.budgetRange) setBudgetRange(saved.budgetRange);
        else if (saved.budget) setBudgetRange({ min: saved.budget, max: saved.budget });
        if (saved.lotWidth) setLotWidth(saved.lotWidth);
        if (saved.lotLength) setLotLength(saved.lotLength);
      }
    }
  }, []);

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
      scanZones(file);
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    scanFileRef.current = null;
    setSelectedImage(null);
    setImagePreview(null);
    setPhotoCorners(null);
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
    // The photo stays in the browser for the AR view; only the confirmed zones are sent
    formData.append('keep_clear_zones', JSON.stringify(keepClear));
    formData.append('seed', variationSeed);
    try {
      const response = await axios.post(`${API_BASE_URL}/generate-layouts/`, formData, { headers });
      if (response.data?.designs) {
        const inventoryIds = new Set(inventory.map(item => String(item.id)));
        const validated = response.data.designs.map(design => ({
          ...design,
          plants: (design.plants || []).filter(p =>
            p.is_existing || inventoryIds.has(String(p.plant_id))
          ),
        }));
        setGeneratedLayouts(validated);
        setSlide(0);
        setActiveLayout(null);
        setNotice(response.data.notice || '');
        if (response.data.budget_warning) setBudgetWarning(response.data.budget_warning);
        if (!user) {
          saveGuestDesign({ layouts: validated, budgetRange, lotWidth, lotLength });
        }
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
        placedItems: lotPlantsToStudioItems(design.plants || [], inventory, w, l),
        dimensions: { width: w, length: l, terrainType: 'flat' },
        depthData: null,
        originalImageUrl: null,
        terrainHeight: 1.5,
        timeOfDay: DEFAULT_TIME_OF_DAY,
      },
    });
    dispatch({ type: 'SET_DESIGN_META', payload: { isDirty: true } });
    navigate('/studio');
  };
  const handleReset = () => { setGeneratedLayouts([]); setError(''); setActiveLayout(null); };

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
    if (activeLayout && activeLayout.plants && !install) {
      // Plants only: put this design's plant list in the shop cart
      (activeLayout.plant_breakdown || []).forEach(row => {
        const product = inventory.find(p => String(p.id) === String(row.plant_id));
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
        // The pins travel with the design so the office and crew see the same overlay
        dimensions: { width: Number(lotWidth), length: Number(lotLength), ...(photoCorners && { photoCorners }) },
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '10px',
    },
    plantCard: (isSelected) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: '12px',
      border: isSelected ? '2px solid #059669' : '1.5px solid #E2E8F0',
      background: isSelected ? color.brandSurface : color.white,
      cursor: 'pointer',
      transition: 'all 0.18s',
      boxShadow: isSelected ? '0 4px 16px rgba(5,150,105,0.15)' : 'none',
    }),
    plantEmoji: {
      fontSize: '1.5rem',
      lineHeight: 1,
    },
    plantInfo: {
      flex: 1,
    },
    plantName: (isSelected) => ({
      fontWeight: 700,
      fontSize: '0.8rem',
      color: isSelected ? '#1E293B' : '#334155',
      display: 'block',
    }),
    plantPrice: (isSelected) => ({
      fontSize: '0.72rem',
      color: isSelected ? '#059669' : '#94A3B8',
      fontWeight: 600,
      marginTop: '2px',
      display: 'block',
    }),
    plantCheck: {
      width: '18px',
      height: '18px',
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
                    install={install}
                    onInstallChange={setInstall}
                    range={budgetRange}
                    onRangeChange={setBudgetRange}
                    rates={rates}
                  />
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
                  <label style={styles.sectionLabel}>Preferred Plants <span style={{ color: '#94A3B8', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
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
                        const emoji = getPlantEmoji(plant.name);
                        return (
                          <button
                            key={plant.id} type="button"
                            onClick={() => handleTogglePlant(String(plant.id))}
                            className="plant-card"
                            style={styles.plantCard(isSelected)}
                          >
                            <span style={styles.plantEmoji}>{emoji}</span>
                            <span style={styles.plantInfo}>
                              <span style={styles.plantName(isSelected)}>{plant.name}</span>
                              <span style={styles.plantPrice(isSelected)}>₱{Number(plant.unit_price).toLocaleString()}</span>
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
                </div>

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
                        {design.target_budget && (
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '4px', fontWeight: 600 }}>
                            Designed for ₱{Number(design.target_budget).toLocaleString()} · {
                              { Minimalist: 'low end', Symmetrical: 'middle', 'Lush / Organic': 'top' }[design.design_name] || 'within'
                            } of your range
                          </div>
                        )}
                      </div>
                      <div style={styles.layoutBody}>
                        {(() => {
                          const newPlants = design.plants?.filter(p => !p.is_existing) || [];
                          return <span style={styles.plantListLabel}>Flora Arrangement · {newPlants.length} plants</span>;
                        })()}
                        <div>
                          {design.plants?.filter(p => !p.is_existing).slice(0, 5).map((plant, pIdx) => {
                            const detail = inventory.find(item => String(item.id) === String(plant.plant_id));
                            const emoji = detail ? getPlantEmoji(detail.name) : '🪴';
                            const displayName = detail ? detail.name : `Plant #${plant.plant_id}`;
                            return (
                              <div key={pIdx} style={styles.plantItem}>
                                <span style={styles.plantItemName}>{emoji} {displayName}</span>
                                <span style={styles.plantItemCoord}>{Number(plant.x).toFixed(1)}, {Number(plant.z).toFixed(1)}</span>
                              </div>
                            );
                          })}
                          {(design.plants?.filter(p => !p.is_existing)?.length || 0) > 5 && (
                            <div style={{ textAlign: 'center', padding: '10px 0 2px', fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                              + {design.plants.filter(p => !p.is_existing).length - 5} more plants
                            </div>
                          )}
                        </div>
                        {design.adjustments?.length > 0 && (
                          <div style={{ marginTop: '0.75rem', padding: '8px 10px', borderRadius: '8px', background: '#F1F5F9', fontSize: '0.72rem', color: '#475569', lineHeight: 1.45 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                              <Wrench size={11} /> What we adjusted
                            </div>
                            {design.adjustments.map((note, ni) => <div key={ni}>• {note}</div>)}
                          </div>
                        )}
                        {design.budget_note && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#64748B', lineHeight: 1.45 }}>
                            <Info size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />{design.budget_note}
                          </div>
                        )}
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
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700 }}>Plant</th>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700, textAlign: 'center' }}>Qty</th>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700, textAlign: 'right' }}>Unit</th>
                                      <th style={{ padding: '6px 4px', color: '#94A3B8', fontWeight: 700, textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(design.plant_breakdown || []).map((item, itemIdx) => (
                                      <tr key={itemIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '8px 4px', fontWeight: 600, color: '#1E293B' }}>{getPlantEmoji(item.name)} {item.name}</td>
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
                            ? 'Drag the 4 yellow pins onto the corners of your yard. The design moves with them.'
                            : activeView === 'ar'
                              ? 'Seen from where you took the photo'
                              : touch
                                ? 'Drag to rotate · Pinch to zoom · Two-finger drag to pan'
                                : 'Left click + drag to rotate · Scroll to zoom · Right drag to pan'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {activeView === 'ar' && imagePreview && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!editingCorners && !photoCorners) setPhotoCorners(defaultCorners());
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
                        <div style={styles.previewCostBadge}>₱{activeLayout.total_cost.toLocaleString()}</div>
                      </div>
                    </div>

                    <div style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative', height: phone ? 340 : 450 }}>
                      <ThreeGardenCanvas
                        height={phone ? 340 : 450}
                        plants={activeLayout.plants}
                        lotWidth={Number(lotWidth)}
                        lotLength={Number(lotLength)}
                        backgroundImageUrl={imagePreview}
                        arMode={activeView === 'ar'}
                        arGrid={activeView === 'ar' && editingCorners}
                        photoCorners={photoCorners}
                        editCorners={activeView === 'ar' && editingCorners}
                        onCornersChange={setPhotoCorners}
                        onPoseStatus={setPoseStatus}
                        photoTone={activeView === 'ar' ? photoTone : null}
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

                    {activeView === 'ar' && imagePreview && poseStatus && (() => {
                      const note = !poseStatus.ok
                        ? (poseStatus.reason === 'upside_down'
                          ? 'The "Back" pins go on the far side of the yard (higher in the photo), the "Front" pins on the near side.'
                          : 'Those pins don\'t outline the yard: check that no two sides cross.')
                        : poseStatus.fitWarn
                          ? (poseStatus.suggestedLength
                            ? `These pins fit a yard about ${lotWidth} × ${poseStatus.suggestedLength} m, but the size above is ${lotWidth} × ${lotLength} m. Fix the size (then generate again), or move a pin.`
                            : `The pins don't match a ${lotWidth} × ${lotLength} m yard. Check the yard size above, or move a pin.`)
                          : poseStatus.guessed && !editingCorners
                            ? 'This is a rough placement. Tap "Line up with my yard" and drag the pins onto its corners for an exact match.'
                            : null;
                      return note && (
                        <p role="status" style={{ margin: '10px 0 0', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.5,
                          color: poseStatus.ok && poseStatus.guessed ? color.muted : '#b45309' }}>{note}</p>
                      );
                    })()}

                    {/* Book This Design CTA */}
                    <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: phone ? 'stretch' : 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleBookDesign}
                        disabled={bookingLoading}
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
                         {bookingLoading ? 'Saving Design…' : install ? 'Book Final Site Inspection & Consultation' : 'Add these plants to my cart'}
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
