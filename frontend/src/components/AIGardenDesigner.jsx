import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ArrowLeft, Check, Compass, ShieldAlert, Upload, X, CalendarPlus, Info } from 'lucide-react';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import { useDesign } from '../context/DesignContext';
import { getInventoryItems } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { saveGuestDesign, loadGuestDesign, clearGuestDesign } from '../services/guestSession';
import GuestAuthModal from './GuestAuthModal';

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

  const [budget, setBudget] = useState(5000);
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
  const [lotWidth, setLotWidth] = useState(10.0);
  const [lotLength, setLotLength] = useState(10.0);
  const [preferredPlants, setPreferredPlants] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedLayouts, setGeneratedLayouts] = useState([]);
  const [activeLayout, setActiveLayout] = useState(null);
  const [activeView, setActiveView] = useState('3d');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [horizonY, setHorizonY] = useState(0.5);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [photoTone, setPhotoTone] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [budgetWarning, setBudgetWarning] = useState('');

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
        if (saved.budget) setBudget(saved.budget);
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

  // Pre-flight budget guard: warn if 45% plant allocation is too low for the lot
  useEffect(() => {
    const plantBudget = Number(budget) * 0.45;
    const lotArea = Number(lotWidth) * Number(lotLength);
    if (!budget || !lotWidth || !lotLength || isNaN(lotArea) || lotArea <= 0) return;
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
  }, [budget, lotWidth, lotLength, inventory]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleGenerateDesigns = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const headers = {};
    const storedAuth = localStorage.getItem('authTokens');
    if (storedAuth) {
      try {
        const tokens = JSON.parse(storedAuth);
        if (tokens?.access) headers['Authorization'] = `Bearer ${tokens.access}`;
      } catch (err) { console.error(err); }
    }
    const formData = new FormData();
    formData.append('budget', Number(budget));
    formData.append('lot_width', Number(lotWidth));
    formData.append('lot_length', Number(lotLength));
    formData.append('preferred_plant_ids', JSON.stringify(preferredPlants));
    if (selectedImage) formData.append('image', selectedImage);
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
        if (response.data.budget_warning) setBudgetWarning(response.data.budget_warning);
        if (!user) {
          saveGuestDesign({ layouts: validated, budget, lotWidth, lotLength });
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

  const handleSelectLayout = (layout) => setActiveLayout(layout);
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

  // Exit calibration mode when switching away from AR view
  useEffect(() => {
    if (activeView !== 'ar') setCalibrationMode(false);
  }, [activeView]);

  // Move the horizon line to wherever the user clicked inside the canvas wrapper
  const handleHorizonClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHorizonY(Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height)));
  };

  const handleBookDesign = async () => {
    if (!user) {
      const context = {
        selectedProfile: activeLayout?.design_name || '',
        estimatedPricing: activeLayout?.total_cost || 0,
        lotWidth: lotWidth,
        lotLength: lotLength,
        budget: budget,
        imagePreview: imagePreview || '/login-hero-bg.png',
      };
      localStorage.setItem('pending_booking_context', JSON.stringify(context));
      setShowAuthModal(true);
      return;
    }
    setBookingLoading(true);
    const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api';
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
        dimensions: { width: Number(lotWidth), length: Number(lotLength), horizonY },
        total_cost: activeLayout.total_cost,
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
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #F7F3EC 0%, #EAF0E4 60%, #F0EBE0 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '2rem 1rem',
    },
    container: {
      maxWidth: '900px',
      margin: '0 auto',
    },
    hero: {
      position: 'relative',
      background: 'linear-gradient(135deg, #1A2E1A 0%, #2D4A2D 60%, #1E3A1E 100%)',
      borderRadius: '24px 24px 0 0',
      padding: '3rem 2.5rem 5rem',
      overflow: 'hidden',
      marginBottom: '-2.5rem',
    },
    heroTag: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(201,136,58,0.18)',
      border: '1px solid rgba(201,136,58,0.35)',
      color: '#C9883A',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '5px 14px',
      borderRadius: '100px',
      marginBottom: '1.25rem',
    },
    heroTitle: {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: 'clamp(2rem, 5vw, 3rem)',
      fontWeight: 800,
      color: '#F7F3EC',
      lineHeight: 1.15,
      margin: '0 0 0.75rem',
      letterSpacing: '-0.02em',
    },
    heroTitleAccent: {
      color: '#8FAF7E',
      fontStyle: 'italic',
    },
    heroSub: {
      color: 'rgba(247,243,236,0.6)',
      fontSize: '0.9rem',
      maxWidth: '440px',
      lineHeight: 1.6,
      margin: 0,
    },
    card: {
      background: '#FFFFFF',
      borderRadius: '0 0 24px 24px',
      padding: '3.5rem 2.5rem 2.5rem',
      boxShadow: '0 20px 60px rgba(26,46,26,0.1), 0 4px 16px rgba(26,46,26,0.06)',
    },
    sectionLabel: {
      display: 'block',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#8FAF7E',
      marginBottom: '8px',
    },
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
      color: '#8FAF7E',
      fontWeight: 700,
      fontSize: '0.95rem',
      pointerEvents: 'none',
      zIndex: 1,
    },
    input: {
      width: '100%',
      background: '#F7F3EC',
      border: '1.5px solid #E8E1D4',
      borderRadius: '12px',
      padding: '13px 16px',
      fontSize: '0.95rem',
      fontWeight: 600,
      color: '#1A2E1A',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxSizing: 'border-box',
    },
    inputWithPrefix: {
      paddingLeft: '28px',
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1.25rem',
      marginBottom: '1.75rem',
    },
    divider: {
      border: 'none',
      borderTop: '1.5px solid #EDE8DF',
      margin: '1.75rem 0',
    },
    uploadZone: {
      border: '2px dashed #D4CAB8',
      borderRadius: '14px',
      padding: '2rem',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#FDFAF6',
      display: 'block',
    },
    uploadIcon: {
      width: '36px',
      height: '36px',
      background: 'linear-gradient(135deg, #2D4A2D, #4A7A3A)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 12px',
    },
    plantsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '10px',
    },
    plantCard: (isSelected) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: '12px',
      border: isSelected ? '2px solid #4A7A3A' : '1.5px solid #E8E1D4',
      background: isSelected ? 'linear-gradient(135deg, #F0F7ED, #EAF4E4)' : '#FDFAF6',
      cursor: 'pointer',
      transition: 'all 0.18s',
      boxShadow: isSelected ? '0 4px 16px rgba(74,122,58,0.15)' : 'none',
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
      color: isSelected ? '#2D4A2D' : '#3A3A3A',
      display: 'block',
    }),
    plantPrice: (isSelected) => ({
      fontSize: '0.72rem',
      color: isSelected ? '#4A7A3A' : '#9A9080',
      fontWeight: 600,
      marginTop: '2px',
      display: 'block',
    }),
    plantCheck: {
      width: '18px',
      height: '18px',
      background: '#4A7A3A',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    submitBtn: {
      width: '100%',
      padding: '15px 24px',
      background: 'linear-gradient(135deg, #2D4A2D 0%, #4A7A3A 100%)',
      color: '#F7F3EC',
      fontWeight: 700,
      fontSize: '0.95rem',
      border: 'none',
      borderRadius: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      boxShadow: '0 8px 24px rgba(45,74,45,0.25)',
      transition: 'all 0.2s',
      marginTop: '1.75rem',
      letterSpacing: '0.01em',
    },
    secondaryBtn: {
      width: '100%',
      padding: '15px 24px',
      background: 'transparent',
      color: '#2D4A2D',
      fontWeight: 700,
      fontSize: '0.95rem',
      border: '2px solid #2D4A2D',
      borderRadius: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      transition: 'all 0.2s',
      marginTop: '1rem',
      letterSpacing: '0.01em',
    },
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
      border: '4px solid #EAF0E4',
      borderTop: '4px solid #4A7A3A',
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
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '1.5rem',
      fontWeight: 800,
      color: '#1A2E1A',
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
      color: '#8FAF7E',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 14px',
      borderRadius: '8px',
      transition: 'all 0.15s',
    },
    layoutsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: '1.25rem',
    },
    layoutCard: {
      background: '#FFFFFF',
      border: '1.5px solid #E8E1D4',
      borderRadius: '18px',
      overflow: 'hidden',
      transition: 'all 0.25s',
      boxShadow: '0 2px 12px rgba(26,46,26,0.06)',
    },
    layoutCardTop: {
      background: 'linear-gradient(135deg, #1A2E1A 0%, #2D4A2D 100%)',
      padding: '1.5rem',
    },
    layoutBadge: {
      fontSize: '9px',
      fontWeight: 800,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#8FAF7E',
      background: 'rgba(143,175,126,0.15)',
      border: '1px solid rgba(143,175,126,0.25)',
      borderRadius: '100px',
      padding: '3px 10px',
      display: 'inline-block',
      marginBottom: '10px',
    },
    layoutName: {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '1.15rem',
      fontWeight: 800,
      color: '#F7F3EC',
      margin: '0 0 8px',
    },
    layoutCost: {
      fontSize: '1.6rem',
      fontWeight: 800,
      color: '#C9883A',
      fontFamily: "'Playfair Display', Georgia, serif",
    },
    layoutBody: {
      padding: '1.25rem 1.5rem 1.5rem',
    },
    plantListLabel: {
      fontSize: '9px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#9A9080',
      marginBottom: '10px',
      display: 'block',
    },
    plantItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #F0EBE0',
    },
    plantItemName: {
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#2D2D2D',
    },
    plantItemCoord: {
      fontSize: '0.68rem',
      fontWeight: 600,
      color: '#9A9080',
      background: '#F5F0E8',
      padding: '2px 8px',
      borderRadius: '6px',
      fontFamily: 'monospace',
    },
    selectBtn: {
      width: '100%',
      padding: '11px 20px',
      background: 'linear-gradient(135deg, #2D4A2D 0%, #4A7A3A 100%)',
      color: '#F7F3EC',
      fontWeight: 700,
      fontSize: '0.83rem',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      marginTop: '1.25rem',
      letterSpacing: '0.02em',
      transition: 'all 0.18s',
    },
    previewPanel: {
      marginTop: '2rem',
      background: '#F7F3EC',
      border: '1.5px solid #E8E1D4',
      borderRadius: '18px',
      padding: '1.75rem',
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
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: '1.2rem',
      fontWeight: 800,
      color: '#1A2E1A',
      margin: '0 0 4px',
    },
    previewSub: {
      fontSize: '0.75rem',
      color: '#8A7E6E',
      margin: 0,
    },
    previewCostBadge: {
      background: 'linear-gradient(135deg, #C9883A, #D4A860)',
      color: '#FFFFFF',
      fontWeight: 800,
      fontSize: '0.85rem',
      padding: '8px 18px',
      borderRadius: '100px',
      whiteSpace: 'nowrap',
    },
    canvasPlaceholder: {
      background: '#EAF0E4',
      borderRadius: '12px',
      height: '300px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6B9E5A',
      fontWeight: 600,
      fontSize: '0.9rem',
    },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .garden-input:focus { border-color: #4A7A3A !important; box-shadow: 0 0 0 3px rgba(74,122,58,0.12) !important; }
        .upload-zone:hover { border-color: #8FAF7E !important; background: #F5FAF0 !important; }
        .plant-card:hover { transform: translateY(-1px); }
        .layout-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(26,46,26,0.14) !important; }
        .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(45,74,45,0.35) !important; }
        .secondary-btn:hover { background: #EAF0E4 !important; }
        .back-btn:hover { background: #EAF0E4 !important; color: #2D4A2D !important; }
        .select-btn:hover { opacity: 0.88; }
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
          background-color: #1A2E1A;
          color: #F7F3EC;
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
          border: 1px solid rgba(143,175,126,0.2);
        }
        .tooltip-text::after {
          content: "";
          position: absolute;
          top: 100%;
          right: 14px;
          border-width: 6px;
          border-style: solid;
          border-color: #1A2E1A transparent transparent transparent;
        }
        .tooltip-container:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
          transform: translateY(-4px);
        }
      `}</style>

      <div className="w-full min-h-screen flex flex-col items-center justify-start bg-[#f6f6f4] py-6 px-4 md:px-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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
          <div style={styles.hero}>
            <BotanicalSVG />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={styles.heroTag}>
                <Compass size={11} />
                AI-Powered · 3D Visualization
              </div>
              <h1 style={styles.heroTitle}>
                Design your <span style={styles.heroTitleAccent}>dream garden</span><br />
                in three dimensions.
              </h1>
              <p style={styles.heroSub}>
                Set your budget, define the lot, pick your flora — and let the AI compose a garden layout tailored to your space.
              </p>
            </div>
          </div>

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

                {/* Budget + Dimensions */}
                <div style={styles.grid3}>
                  <div style={styles.inputGroup}>
                    <label style={styles.sectionLabel}>Budget (₱)</label>
                    <div style={styles.inputWrapper}>
                      <span style={styles.inputPrefix}>₱</span>
                      <input
                        type="number" min="500" value={budget}
                        onChange={e => setBudget(e.target.value)}
                        className="garden-input"
                        style={{ ...styles.input, paddingLeft: '26px' }}
                        required
                      />
                    </div>
                    {budgetWarning && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                        <ShieldAlert size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600, lineHeight: 1.35 }}>{budgetWarning}</span>
                      </div>
                    )}
                    <div style={{ marginTop: '6px', fontSize: '0.68rem', color: '#8A7E6E', fontWeight: 600 }}>
                      Plant allocation: ₱{Math.round(Number(budget) * 0.45).toLocaleString()} (45% of budget)
                    </div>
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

                <hr style={styles.divider} />

                {/* Image Upload */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <label style={styles.sectionLabel}>Reference Photo <span style={{ color: '#B0A89A', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <label className="upload-zone" style={{ ...styles.uploadZone, flex: 1 }}>
                      <div style={styles.uploadIcon}>
                        <Upload size={16} color="#8FAF7E" />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#3A3A3A', marginBottom: '4px' }}>
                        Drop a photo of your garden space
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9A9080' }}>
                        PNG, JPG or WEBP · max 5MB
                      </div>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                    </label>

                    {imagePreview && (
                      <div style={{ position: 'relative', width: '88px', height: '88px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '1.5px solid #E8E1D4' }} className="group">
                        <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button" onClick={handleRemoveImage}
                          style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 700, border: 'none', cursor: 'pointer', gap: '4px' }}
                        >
                          <X size={14} /><span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <hr style={styles.divider} />

                {/* Plant Picker */}
                <div>
                  <label style={styles.sectionLabel}>Preferred Plants <span style={{ color: '#B0A89A', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  {inventoryLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ height: '60px', borderRadius: '12px', background: '#F0EBE0', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      ))}
                    </div>
                  ) : inventory.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#9A9080', fontStyle: 'italic' }}>No plants found in inventory.</p>
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
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 800, fontSize: '1.15rem', color: '#1A2E1A' }}>
                      Composing your garden…
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#8A7E6E', marginTop: '3px', minHeight: '1.1em', transition: 'opacity 0.4s' }}>
                      {LOADING_PHASES[loadingPhase]}
                    </div>
                  </div>
                </div>
                <div style={styles.layoutsGrid}>
                  {[0.7, 0.8, 0.9].map((op, i) => (
                    <div key={i} style={{ ...styles.layoutCard, opacity: op }}>
                      <div style={{ ...styles.layoutCardTop, background: 'linear-gradient(135deg, #1A2E1A 0%, #2D4A2D 100%)' }}>
                        <div style={{ height: '10px', width: '60px', background: 'rgba(255,255,255,0.13)', borderRadius: '8px', marginBottom: '12px' }} />
                        <div style={{ height: '18px', width: '75%', background: 'rgba(255,255,255,0.10)', borderRadius: '8px', marginBottom: '10px' }} />
                        <div style={{ height: '28px', width: '45%', background: 'rgba(201,136,58,0.22)', borderRadius: '8px' }} />
                      </div>
                      <div style={styles.layoutBody}>
                        {[1, 0.8, 0.65, 0.5, 0.35].map((lineOp, j) => (
                          <div key={j} style={{ height: '12px', background: '#EDE8DF', borderRadius: '6px', marginBottom: '10px', opacity: lineOp }} />
                        ))}
                        <div style={{ height: '36px', background: '#EDE8DF', borderRadius: '10px', marginTop: '1.25rem', opacity: 0.5 }} />
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
                    <Sparkles size={20} color="#4A7A3A" />
                    Your Garden Options
                  </h2>
                  <button onClick={handleReset} className="back-btn" style={styles.backBtn}>
                    <ArrowLeft size={14} />
                    Adjust parameters
                  </button>
                </div>

                {budgetWarning && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <ShieldAlert size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e' }}>Budget Note</div>
                      <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '2px', lineHeight: 1.4 }}>{budgetWarning}</div>
                    </div>
                  </div>
                )}

                <div style={styles.layoutsGrid}>
                  {generatedLayouts.map((design, index) => (
                    <div key={index} className="layout-card" style={styles.layoutCard}>
                      <div style={{ ...styles.layoutCardTop, position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ ...styles.layoutBadge, marginBottom: 0 }}>Option {index + 1}</span>
                          {design.reasoning && (
                            <div className="tooltip-container">
                              <Info size={16} className="text-[#8FAF7E] hover:text-[#C9883A] transition-colors" />
                              <div className="tooltip-text">
                                <div className="font-bold mb-1 pb-1 border-b border-white/10 text-[#8FAF7E] text-[0.8rem]">AI Design Reasoning</div>
                                {design.reasoning}
                              </div>
                            </div>
                          )}
                        </div>
                        <h3 style={styles.layoutName}>{design.design_name}</h3>
                        <div style={styles.layoutCost}>₱{design.total_cost.toLocaleString()}</div>
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
                            <div style={{ textAlign: 'center', padding: '10px 0 2px', fontSize: '0.78rem', color: '#8A7E6E', fontWeight: 600 }}>
                              + {design.plants.filter(p => !p.is_existing).length - 5} more plants
                            </div>
                          )}
                        </div>
                        {/* Cost Breakdown — always visible */}
                        {design.cost_breakdown && (
                          <div style={{ marginTop: '1rem', borderTop: '1px solid #EDE8DF', paddingTop: '1rem' }}>
                            <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9080', marginBottom: '8px' }}>
                              Cost Breakdown
                            </div>
                            {[
                              { label: 'Plants & Materials', pct: '45%', amount: design.cost_breakdown.plants, color: '#4A7A3A', bg: '#F0F7ED' },
                              { label: 'Labor & Site Mobilization', pct: '35%', amount: design.cost_breakdown.labor, color: '#8A7E6E', bg: '#F5F0E8' },
                              { label: 'Service Fee & Design Markup', pct: '20%', amount: design.cost_breakdown.service, color: '#C9883A', bg: '#FDF7EE' },
                            ].map((row, ri) => (
                              <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '8px', background: row.bg, marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#3A3A3A' }}>
                                  {row.label} <span style={{ color: '#9A9080', fontWeight: 500 }}>({row.pct})</span>
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: row.color, whiteSpace: 'nowrap' }}>
                                  ₱{Number(row.amount).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 8px', borderRadius: '8px', background: '#1A2E1A', marginTop: '6px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#F7F3EC', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Total Estimated Cost
                              </span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#C9883A' }}>
                                ₱{Number(design.cost_breakdown.total).toLocaleString()}
                              </span>
                            </div>

                            {/* Plant BOM — still togglable */}
                            <button
                              type="button"
                              onClick={() => toggleBreakdown(index)}
                              style={{ background: 'transparent', border: 'none', color: '#4A7A3A', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 0 0', outline: 'none' }}
                            >
                              {expandedBreakdowns[index] ? 'Hide Plant List ▲' : 'View Plant List ▼'}
                            </button>
                            {expandedBreakdowns[index] && (
                              <div style={{ marginTop: '8px', overflowX: 'auto' }} className="fade-in">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1.5px solid #EDE8DF' }}>
                                      <th style={{ padding: '6px 4px', color: '#9A9080', fontWeight: 700 }}>Plant</th>
                                      <th style={{ padding: '6px 4px', color: '#9A9080', fontWeight: 700, textAlign: 'center' }}>Qty</th>
                                      <th style={{ padding: '6px 4px', color: '#9A9080', fontWeight: 700, textAlign: 'right' }}>Unit</th>
                                      <th style={{ padding: '6px 4px', color: '#9A9080', fontWeight: 700, textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(design.plant_breakdown || []).map((item, itemIdx) => (
                                      <tr key={itemIdx} style={{ borderBottom: '1px solid #F0EBE0' }}>
                                        <td style={{ padding: '8px 4px', fontWeight: 600, color: '#2D2D2D' }}>{getPlantEmoji(item.name)} {item.name}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'center', color: '#4A7A3A', fontWeight: 700 }}>{item.quantity}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', color: '#8A7E6E' }}>₱{Number(item.unit_price).toLocaleString()}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: '#1A2E1A' }}>₱{Number(item.subtotal).toLocaleString()}</td>
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
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3D / AR Preview */}
                {activeLayout && (
                  <div style={styles.previewPanel} className="fade-in">
                    <div style={styles.previewHeader}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <h3 style={{ ...styles.previewTitle, margin: 0 }}>{activeLayout.design_name}</h3>
                          {/* View Segment Controller */}
                          <div style={{
                            display: 'inline-flex',
                            background: '#EDE8DF',
                            borderRadius: '10px',
                            padding: '3px',
                            gap: '2px',
                          }}>
                            {[
                              { key: '3d', label: 'Interactive 3D Canvas' },
                              { key: 'ar', label: 'Photo Overlay Preview' },
                            ].map(tab => (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveView(tab.key)}
                                style={{
                                  padding: '5px 13px',
                                  borderRadius: '7px',
                                  border: activeView === tab.key
                                    ? '1.5px solid #4A7A3A'
                                    : '1.5px solid transparent',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  transition: 'all 0.2s',
                                  background: activeView === tab.key ? '#2D4A2D' : 'transparent',
                                  color: activeView === tab.key ? '#F7F3EC' : '#9A9080',
                                  letterSpacing: '0.01em',
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
                          {calibrationMode
                            ? 'Click anywhere on the canvas to set the horizon line'
                            : activeView === 'ar'
                              ? 'Camera locked to photo perspective · Scroll to zoom'
                              : 'Left click + drag to rotate · Scroll to zoom · Right drag to pan'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {activeView === 'ar' && imagePreview && (
                          <button
                            type="button"
                            onClick={() => setCalibrationMode(v => !v)}
                            style={{
                              padding: '7px 14px',
                              background: calibrationMode ? 'rgba(251,191,36,0.15)' : 'transparent',
                              border: `1.5px solid ${calibrationMode ? '#d97706' : '#D4CAB8'}`,
                              color: calibrationMode ? '#b45309' : '#8A7E6E',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.18s',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {calibrationMode ? '✓ Done' : '⊕ Calibrate Horizon'}
                          </button>
                        )}
                        <div style={styles.previewCostBadge}>₱{activeLayout.total_cost.toLocaleString()}</div>
                      </div>
                    </div>

                    <div style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative', height: '450px' }}>
                      <ThreeGardenCanvas
                        plants={activeLayout.plants}
                        lotWidth={Number(lotWidth)}
                        lotLength={Number(lotLength)}
                        backgroundImageUrl={imagePreview}
                        arMode={activeView === 'ar'}
                        arGrid={activeView === 'ar'}
                        horizonY={horizonY}
                        photoTone={activeView === 'ar' ? photoTone : null}
                      />

                      {/* Horizon calibration overlay */}
                      {activeView === 'ar' && calibrationMode && (
                        <div
                          style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'crosshair' }}
                          onClick={handleHorizonClick}
                        >
                          {/* Instruction badge */}
                          <div style={{
                            position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.72)', color: '#fff', padding: '6px 16px',
                            borderRadius: '100px', fontSize: '0.71rem', fontWeight: 600,
                            pointerEvents: 'none', whiteSpace: 'nowrap',
                          }}>
                            Click to align the horizon line with your photo
                          </div>
                          {/* Draggable horizon line */}
                          <div style={{
                            position: 'absolute', left: 0, right: 0,
                            top: `${horizonY * 100}%`, transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                          }}>
                            <div style={{ height: '2px', background: 'rgba(251,191,36,0.85)', position: 'relative' }}>
                              <div style={{
                                position: 'absolute', left: '50%', top: '-9px',
                                transform: 'translateX(-50%)',
                                background: 'rgba(251,191,36,0.95)', color: '#1a1a1a',
                                fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em',
                                padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
                              }}>
                                HORIZON
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeView === 'ar' && !imagePreview && (
                        <div style={{
                          position: 'absolute',
                          bottom: '16px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(45,74,45,0.85)',
                          color: '#F7F3EC',
                          padding: '8px 20px',
                          borderRadius: '100px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backdropFilter: 'blur(8px)',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                        }}>
                          Upload a garden photo above to enable the overlay effect
                        </div>
                      )}
                    </div>

                    {/* Book This Design CTA */}
                    <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleBookDesign}
                        disabled={bookingLoading}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '11px 22px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: bookingLoading ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                          letterSpacing: '0.01em',
                          transition: 'all 0.18s',
                          opacity: bookingLoading ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!bookingLoading) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = bookingLoading ? '0.7' : '1'; e.currentTarget.style.transform = 'none'; }}
                      >
                         <CalendarPlus size={15} />
                         {bookingLoading ? 'Saving Design…' : 'Book Final Site Inspection & Consultation'}
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
