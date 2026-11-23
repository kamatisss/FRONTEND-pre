import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import FeatureCarousel from './FeatureCarousel';
import ReviewCarousel from './ReviewCarousel';
import ScrollStory from './ScrollStory';
import { SiteHeader, SiteFooter } from './SiteChrome';
import EstimateTeaser from './EstimateTeaser';
import ProofShowcase from './ProofShowcase';
import HeroGarden from './HeroGarden';
import SectionEyebrow, { EYEBROW_CSS } from './SectionEyebrow';
import { prefetchStudio } from '../services/prefetch';
import { useAuth } from '../context/AuthContext';
import { BUSINESS } from '../data/business';
import { ProjectCard } from './ProjectHub';
import { getPublicProjects, getTrackRecord, getInventoryItems } from '../services/api';
import { productImage } from '../data/productImage';
import {
  Leaf,
  ArrowRight,
  Sparkles,
  Star,
  Shovel,
  Images,
  Sprout,
  Box,
  Ruler,
  Fence,
  Scissors,
  Check,
  Lock,
} from 'lucide-react';

/* ─── Animation Variants ──────────────────────────────────── */
const FADE_UP = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const STAGGER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const STAGGER_SLOW = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ─── Data ────────────────────────────────────────────────── */
// What the business really does: two free online tools, and the four services customers can book
// (ServiceBooking.SERVICE_CHOICES). Each card leads somewhere: a tool opens, a service opens the
// booking form with that service already chosen. Only claims the app itself shows are made here.
// ("Outdoor Lighting" was removed: there are no lights in the catalog to sell or install yet.)
const SERVICES = [
  { title: 'AI garden design', Icon: Sparkles, tag: 'Free online', to: '/ai-designer', action: 'Let AI design it',
    desc: 'Enter your lot size and budget. The AI lays out a complete garden with plants we stock, priced from our real catalog.' },
  { title: '3D garden studio', Icon: Box, tag: 'Free online', to: '/try-studio', action: 'Open the Studio', studio: true,
    desc: 'Place plants, stones and benches on your yard in real 3D, check the sun through the day, and watch the cost as you go.' },
  { title: 'Consultation & site visit', Icon: Ruler, tag: 'Book a visit', service: 'consultation', action: 'Book a consultation',
    desc: 'We visit, measure your yard and talk through your plans and budget, so the quote matches the real site.' },
  { title: 'Planting', Icon: Sprout, tag: 'Our crew', service: 'Softscape', action: 'Book planting',
    desc: 'Our crew prepares the soil, plants and mulches your beds, posts progress photos, and you sign off when it is done.' },
  { title: 'Hardscaping', Icon: Fence, tag: 'Our crew', service: 'hardscaping', action: 'Book hardscaping',
    desc: 'Stone paths, borders, rock features and garden furniture, set in place by the same crew that plants your garden.' },
  { title: 'Garden maintenance', Icon: Scissors, tag: 'Our crew', service: 'maintenance', action: 'Book maintenance',
    desc: 'Lawn care, trimming, weeding and replanting on the dates you choose, so the garden stays the way it was built.' },
];

// The free Studio vs a free account (this used to be its own "Try it now" section, which repeated the hero)
const FREE_NOW = ['Design on a sample yard in real 3D', 'Place, move and rotate plants, stones and furniture',
  'Morning-to-evening sunlight preview', 'Live cost estimate as you design'];
const WITH_ACCOUNT = ['AI designs complete layouts for your budget', 'Turn a photo of your own yard into 3D terrain',
  'Save designs and book our crew'];

const catalogImage = productImage;
const CATEGORY_LABEL = { plant: 'Plant', hardscape: 'Hardscape', furniture: 'Furniture' };

// A mix across categories, preferring items that can be placed in 3D
function pickPalette(items, n = 8) {
  const withImage = items.filter(i => catalogImage(i)).sort((a, b) => Number(!!b.model_file) - Number(!!a.model_file));
  const byCat = {};
  withImage.forEach(i => { (byCat[i.category] = byCat[i.category] || []).push(i); });
  const picked = [];
  for (let round = 0; picked.length < n && round < n; round++) {
    Object.values(byCat).forEach(list => { if (list[round] && picked.length < n) picked.push(list[round]); });
  }
  return picked;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects,     setProjects]     = useState([]);
  const [record,       setRecord]       = useState(null);
  const [palette,      setPalette]      = useState([]);

  useEffect(() => {
    // Featured portfolio projects, falling back to the most recent published ones
    getPublicProjects({ featured: 1, limit: 3 })
      .then(d => d.results.length ? d.results : getPublicProjects({ limit: 3 }).then(r => r.results))
      .then(setProjects)
      .catch(() => {});
    getTrackRecord().then(d => setRecord(d.stats)).catch(() => {});
    getInventoryItems().then(items => setPalette(pickPalette(items))).catch(() => {});
  }, []);

  useEffect(() => {
    // Force scrolling to work regardless of parent layout constraints
    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };

    html.style.overflow = 'auto';
    html.style.height = 'auto';
    body.style.overflow = 'visible';
    body.style.height = 'auto';

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
    };
  }, []);

  // A service card opens the booking form with that service chosen (the same handoff as "Book a similar
  // project" in the Project Hub); signed-out visitors log in first and land on the form.
  const bookService = (serviceType) => {
    localStorage.setItem('pending_booking_context', JSON.stringify({ serviceType }));
    navigate(user ? '/book-service' : '/login');
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a', background: '#f8fafc', minHeight: '100vh' }}>

      {/* ══ GLOBAL STYLES ══ */}
      <style>{`

        * { box-sizing: border-box; }

        html, body {
          height: auto !important;
          min-height: 100%;
        }
        /* The page scrolls on html (the viewport). Body must not become a scroll box itself,
           or position: sticky (the scroll story's pinned picture) stops working: clip, not hidden. */
        html { overflow-x: hidden; overflow-y: auto !important; }
        body { overflow-x: hidden; overflow-x: clip !important; overflow-y: visible !important; }

        /* Remove any overflow:hidden that wrapper layouts might inject */
        #root, #app, [data-reactroot] {
          overflow: visible !important;
          height: auto !important;
          min-height: 100%;
        }

        .gs-container {
          width: 100%;
          max-width: 1200px;
          margin-left: auto;
          margin-right: auto;
          padding-left: 24px;
          padding-right: 24px;
        }

        /* ── Hero ── */
        .gs-hero {
          position: relative; min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 100px 24px 100px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
        }
        .gs-hero-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 72px;
          align-items: center;
          width: 100%;
        }
        .gs-hero-copy { display: flex; flex-direction: column; }
        .gs-hero-copy .gs-hero-h1   { text-align: left; }
        .gs-hero-copy .gs-hero-sub  { text-align: left; margin: 0 0 36px; max-width: none; }
        .gs-hero-copy .gs-hero-actions { justify-content: flex-start; }
        .gs-hero-visual { position: relative; }
        .gs-hero-proofrow {
          display: flex; align-items: center; gap: 16px;
          margin-top: 32px; flex-wrap: wrap;
          font-size: 13px; color: #94a3b8; font-weight: 500;
        }
        .gs-hero-proofrow strong { color: #0f172a; font-weight: 800; }
        .gs-hero-proof-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: #a7f3d0; flex-shrink: 0;
        }
        .gs-hero-content {
          position: relative; z-index: 10;
          max-width: 860px; margin: 0 auto;
          display: flex; flex-direction: column; align-items: center;
        }
        .gs-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 12px 5px 5px; border-radius: 100px;
          background: #ecfdf5; border: 1px solid #a7f3d0;
          color: #047857; font-size: 13px; font-weight: 700;
          letter-spacing: 0.3px; text-decoration: none;
          transition: background .2s, border-color .2s, box-shadow .2s;
        }
        /* align-self: the hero column is a flex column, which stretched the pill to its full width */
        .gs-hero-badge-wrap { align-self: flex-start; margin-bottom: 28px; max-width: 100%; }
        .gs-hero-badge { white-space: nowrap; }
        @media (max-width: 420px) { .gs-hero-badge { font-size: 12px; letter-spacing: 0; gap: 6px; } }
        .gs-hero-badge:hover { background: #d1fae5; border-color: #6ee7b7; box-shadow: 0 4px 14px rgba(16,185,129,.15); }
        .gs-hero-badge:focus-visible { outline: 2px solid #10b981; outline-offset: 3px; }
        .gs-hero-badge-icon {
          width: 24px; height: 24px; border-radius: 99px; background: #10b981; color: #fff;
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .gs-hero-badge-arrow { transition: transform .2s; }
        .gs-hero-badge:hover .gs-hero-badge-arrow { transform: translateX(3px); }
        .gs-hero-proofrow .gs-star { display: inline-block; color: #10b981; fill: #10b981; vertical-align: -1px; margin-left: 2px; }
        .gs-hero-h1 {
          font-size: clamp(40px, 7vw, 76px);
          font-weight: 900; line-height: 1.05;
          letter-spacing: -2px; color: #0f172a;
          margin: 0 0 24px;
        }
        .gs-hero-h1 span {
          background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gs-hero-sub {
          font-size: clamp(16px, 2.2vw, 20px);
          color: #64748b;
          font-weight: 400; line-height: 1.65;
          margin: 0 0 44px; max-width: 580px;
        }
        .gs-hero-actions {
          display: flex; gap: 14px; flex-wrap: wrap; justify-content: center;
        }
        .gs-btn-hero-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 16px 32px; border-radius: 100px;
          font-size: 16px; font-weight: 800; text-decoration: none; color: white;
          background: #10b981; transition: all 0.2s;
          box-shadow: 0 8px 30px rgba(16,185,129,0.4);
        }
        .gs-btn-hero-primary:hover { background: #059669; transform: translateY(-2px); }
        .gs-btn-hero-outline {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 16px 32px; border-radius: 100px;
          font-size: 16px; font-weight: 700; text-decoration: none; color: #0f172a;
          background: transparent; border: 1.5px solid #d1d5db;
          transition: all 0.2s; cursor: pointer;
        }
        .gs-btn-hero-outline:hover { background: #f8fafc; border-color: #94a3b8; }

        .gs-scroll-indicator {
          position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
          z-index: 10; cursor: pointer; opacity: 0.7;
          animation: bounce 2s infinite;
        }
        .gs-scroll-track {
          width: 30px; height: 46px; border: 2px solid rgba(15,23,42,0.2);
          border-radius: 15px; display: flex; justify-content: center; padding-top: 8px;
        }
        .gs-scroll-dot {
          width: 4px; height: 10px; background: #10b981; border-radius: 2px;
        }
        @keyframes bounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }

        /* Section labels: SectionEyebrow.jsx (icon chip + label) */
        ${EYEBROW_CSS}
        .gs-section-title {
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 900; line-height: 1.1;
          letter-spacing: -1.5px; color: #0f172a;
          margin: 0 0 20px;
        }
        .gs-section-body {
          font-size: 17px; color: #475569;
          line-height: 1.75; margin: 0 0 32px;
        }

        /* ── Services ── */
        .gs-services {
          padding: 100px 0;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }
        .gs-section-header {
          text-align: center;
          margin-bottom: 60px;
        }
        .gs-services-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .gs-service-card {
          padding: 32px 30px 28px;
          border-radius: 20px;
          background: white;
          border: 1px solid #e2e8f0;
          transition: box-shadow 0.25s, transform 0.25s, border-color 0.25s;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; height: 100%; width: 100%;
          text-align: left; font: inherit; color: inherit; text-decoration: none; cursor: pointer;
        }
        .gs-service-card:focus-visible { outline: 2px solid #10b981; outline-offset: 3px; }
        .gs-service-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; position: relative; z-index: 1; }
        .gs-service-tag {
          font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase;
          padding: 4px 9px; border-radius: 99px; white-space: nowrap;
          background: #f1f5f9; color: #475569;
        }
        .gs-service-tag.free { background: #ecfdf5; color: #047857; }
        .gs-service-action {
          margin-top: auto; padding-top: 20px; position: relative; z-index: 1;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 14px; font-weight: 800; color: #059669;
        }
        .gs-service-action svg { transition: transform .2s; }
        .gs-service-card:hover .gs-service-action svg, .gs-service-card:focus-visible .gs-service-action svg { transform: translateX(4px); }
        .gs-service-card:hover {
          box-shadow: 0 20px 50px rgba(16,185,129,0.08), 0 4px 16px rgba(0,0,0,0.04);
          transform: translateY(-4px);
          border-color: #a7f3d0;
        }
        .gs-service-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: #ecfdf5; color: #10b981;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 24px; position: relative; z-index: 1;
        }
        .gs-service-title {
          font-size: 17px; font-weight: 800; color: #0f172a;
          margin: 0 0 10px; position: relative; z-index: 1;
        }
        .gs-service-desc {
          font-size: 14px; color: #64748b; line-height: 1.7;
          margin: 0; position: relative; z-index: 1;
        }
        .gs-service-card:hover .gs-service-icon { background: #10b981; color: #fff; }
        .gs-service-icon { transition: background .25s, color .25s; }

        /* ── Gallery / Material Palette ── */
        .gs-gallery {
          padding: 80px 0;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
        }
        .gs-gallery-header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 40px;
        }
        .gs-gallery-link {
          font-size: 14px; font-weight: 700; color: #10b981;
          text-decoration: none; display: flex; align-items: center; gap: 4px;
          transition: gap 0.2s;
        }
        .gs-gallery-link:hover { gap: 8px; }
        .gs-gallery-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .gs-gallery-item {
          border-radius: 16px; overflow: hidden;
          border: 1px solid #e2e8f0;
          position: relative; cursor: pointer;
          background: #f8fafc;
          transition: box-shadow 0.25s, transform 0.25s;
        }
        .gs-gallery-item:hover {
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
          transform: translateY(-3px);
        }
        .gs-gallery-item img {
          width: 100%; height: 220px; object-fit: cover; display: block;
          transition: transform 0.6s cubic-bezier(0.22,1,0.36,1);
        }
        .gs-gallery-item:hover img { transform: scale(1.05); }
        .gs-gallery-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 56px;
          background: linear-gradient(to top, rgba(5,30,20,0.5) 0%, transparent 60%);
          pointer-events: none;
        }
        .gs-gallery-caption {
          padding: 12px 16px;
          background: #ffffff;
          border-top: 1px solid #f1f5f9;
        }
        .gs-gallery-category {
          font-size: 11px; font-weight: 800; letter-spacing: 1px;
          text-transform: uppercase; color: #059669; margin: 0 0 2px;
        }
        .gs-gallery-label {
          font-size: 14px; font-weight: 700; color: #0f172a; margin: 0;
        }

        /* ── Testimonials ── */
        .gs-testimonials {
          padding: 100px 0;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        /* ── CTA ── */
        .gs-cta {
          padding: 120px 0;
          background: #f0fdf4;
          border-top: 1px solid #a7f3d0;
          text-align: center; color: #0f172a; position: relative; overflow: hidden;
        }
        .gs-cta-pattern {
          position: absolute; inset: 0; opacity: 0.45;
          background-image: radial-gradient(circle, #a7f3d0 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .gs-cta-content { position: relative; z-index: 1; }
        .gs-cta-h2 {
          font-size: clamp(36px, 5.5vw, 60px);
          font-weight: 900; line-height: 1.08;
          letter-spacing: -2px; margin: 0 0 20px; color: #0f172a;
        }
        .gs-cta-sub {
          font-size: 18px; color: #475569;
          margin: 0 0 48px; max-width: 520px; margin-left: auto; margin-right: auto;
          line-height: 1.65;
        }
        .gs-cta-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .gs-cta-plans {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
          max-width: 760px; margin: 0 auto 40px; text-align: left;
        }
        .gs-cta-plan { background: #fff; border: 1px solid #d1fae5; border-radius: 18px; padding: 22px 24px; }
        .gs-cta-plan.account { border-color: #e2e8f0; }
        .gs-cta-plan h3 { margin: 0 0 14px; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #047857; }
        .gs-cta-plan.account h3 { color: #475569; }
        .gs-cta-plan ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .gs-cta-plan li { display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; color: #334155; line-height: 1.5; }
        .gs-cta-plan .ico { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; background: #d1fae5; color: #047857; }
        .gs-cta-plan.account .ico { background: #f1f5f9; color: #64748b; }
        @media (max-width: 640px) { .gs-cta-plans { grid-template-columns: 1fr; } }
        .gs-btn-cta-primary {
          padding: 16px 36px; border-radius: 100px;
          font-size: 16px; font-weight: 800; text-decoration: none;
          background: #10b981; color: white;
          box-shadow: 0 8px 30px rgba(16,185,129,0.35);
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .gs-btn-cta-primary:hover { background: #059669; transform: translateY(-2px); box-shadow: 0 12px 40px rgba(16,185,129,0.4); }
        .gs-btn-cta-outline {
          padding: 16px 36px; border-radius: 100px;
          font-size: 16px; font-weight: 700; text-decoration: none; color: #0f172a;
          background: transparent; border: 1.5px solid #cbd5e1;
          transition: background 0.2s, border-color 0.2s;
        }
        .gs-btn-cta-outline:hover { background: white; border-color: #94a3b8; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .gs-services-grid { grid-template-columns: repeat(2, 1fr); }
          .gs-gallery-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .gs-services-grid { grid-template-columns: 1fr; }
          .gs-gallery-grid { grid-template-columns: repeat(2, 1fr); }
          .gs-gallery-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .gs-hero-split { grid-template-columns: 1fr; gap: 40px; }
          .gs-hero-copy .gs-hero-h1   { text-align: center; }
          .gs-hero-copy .gs-hero-sub  { text-align: center; }
          .gs-hero-copy .gs-hero-actions { justify-content: center; }
          .gs-hero-proofrow { justify-content: center; }
          .gs-hero-badge-wrap { align-self: center; }
          .gs-scroll-indicator { display: none; }
        }
      `}</style>

      <SiteHeader overlay />

      {/* ══ HERO ══ */}
      <section className="gs-hero">
        <div className="gs-container" style={{ position: 'relative', zIndex: 10, width: '100%' }}>
          <div className="gs-hero-split">

            {/* Left — copy */}
            <motion.div initial="hidden" animate="visible" variants={STAGGER} className="gs-hero-copy">
              {/* The wrapper animates (an animated router Link stayed invisible); it sizes to the pill */}
              <motion.div variants={FADE_UP} className="gs-hero-badge-wrap">
                <Link to="/try-studio" className="gs-hero-badge"
                  onPointerEnter={prefetchStudio} onFocus={prefetchStudio}>
                  <span className="gs-hero-badge-icon" aria-hidden="true"><Sparkles size={13} /></span>
                  Free 3D Garden Studio · No sign-up
                  <ArrowRight size={14} className="gs-hero-badge-arrow" aria-hidden="true" />
                </Link>
              </motion.div>

              <motion.h1 variants={FADE_UP} className="gs-hero-h1">
                Your dream garden,<br />
                <span>designed in minutes.</span>
              </motion.h1>

              <motion.p variants={FADE_UP} className="gs-hero-sub">
                Design your garden in real 3D right in your browser, free. Let our AI
                finish it for you, then book our crew — all before the first shovel hits the ground.
              </motion.p>

              <motion.div variants={FADE_UP} className="gs-hero-actions">
                <Link to="/try-studio" className="gs-btn-hero-primary"
                  onPointerEnter={prefetchStudio} onFocus={prefetchStudio} onTouchStart={prefetchStudio}>
                  Start Designing Free <ArrowRight size={18} />
                </Link>
                <Link to="/ai-designer" className="gs-btn-hero-outline">
                  <Sparkles size={16} /> Let AI design it
                </Link>
              </motion.div>

              {/* Live numbers from the Project Hub track record — no hard-coded claims */}
              {record && record.projects_completed > 0 && (
                <motion.div variants={FADE_UP} className="gs-hero-proofrow">
                  <span><strong>{record.projects_completed.toLocaleString()}</strong> Projects completed</span>
                  {record.average_rating && (
                    <>
                      <span className="gs-hero-proof-dot" />
                      <span><strong>{record.average_rating}<Star size={13} className="gs-star" aria-label="stars" /></strong> from {record.review_count.toLocaleString()} reviews</span>
                    </>
                  )}
                  <span className="gs-hero-proof-dot" />
                  <Link to="/track-record" style={{ color: 'inherit' }}>See our track record</Link>
                </motion.div>
              )}
            </motion.div>

            {/* Right — feature journey carousel */}
            <motion.div
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="gs-hero-visual"
            >
              {/* Live 3D garden on any device with a real GPU; the image carousel everywhere else */}
              <HeroGarden fallback={<FeatureCarousel />} />
            </motion.div>

          </div>
        </div>

        <div className="gs-scroll-indicator" onClick={() => scrollTo('services')} role="button" aria-label="Scroll to services">
          <div className="gs-scroll-track">
            <div className="gs-scroll-dot" />
          </div>
        </div>
      </section>

      {/* ══ SERVICES ══ */}
      <section id="services" className="gs-services">
        <div className="gs-container">
          <div className="gs-section-header">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
              <SectionEyebrow icon={Shovel} label="Our services" center />
              <h2 className="gs-section-title">Plan it free online. Our crew builds it.</h2>
              <p style={{ fontSize: 17, color: '#64748b', maxWidth: 560, margin: '12px auto 0', lineHeight: 1.65 }}>
                Design with our free tools, then book the same local team to plant, build and care for your garden
                across {BUSINESS.serviceArea}.
              </p>
            </motion.div>
          </div>
          <motion.div className="gs-services-grid"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER_SLOW}>
            {SERVICES.map((service) => {
              const body = (
                <>
                  <div className="gs-service-top">
                    <div className="gs-service-icon"><service.Icon size={24} /></div>
                    <span className={`gs-service-tag${service.tag === 'Free online' ? ' free' : ''}`}>{service.tag}</span>
                  </div>
                  <h3 className="gs-service-title">{service.title}</h3>
                  <p className="gs-service-desc">{service.desc}</p>
                  <span className="gs-service-action">{service.action} <ArrowRight size={15} /></span>
                </>
              );
              return (
                <motion.div key={service.title} variants={FADE_UP}>
                  {service.to ? (
                    <Link to={service.to} className="gs-service-card"
                      {...(service.studio ? { onPointerEnter: prefetchStudio, onFocus: prefetchStudio } : {})}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" className="gs-service-card" onClick={() => bookService(service.service)}>
                      {body}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ══ HOW IT WORKS — scroll story: photo → terrain → plants → light → estimate → crew ══ */}
      <ScrollStory />

      {/* ══ INSTANT ESTIMATE — yard size → price range, hands off to the AI Designer or Studio ══ */}
      <EstimateTeaser />

      {/* ══ REAL RESULTS — before/after and 3D design vs built, from published projects ══ */}
      <ProofShowcase />

      {/* ══ FEATURED PROJECTS (Project Hub) — only once real projects are published ══ */}
      {projects.length > 0 && (
        <section id="projects" className="gs-gallery">
          <div className="gs-container">
            <div className="gs-gallery-header">
              <div>
                <SectionEyebrow icon={Images} label="Project Hub" />
                <h2 className="gs-section-title" style={{ margin: 0 }}>Gardens We've Built</h2>
              </div>
              <Link to="/projects" className="gs-gallery-link">
                See all projects <ArrowRight size={16} />
              </Link>
            </div>
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}>
              {projects.map(p => (
                <motion.div key={p.slug} variants={FADE_UP}><ProjectCard project={p} /></motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ══ MATERIAL PALETTE — real catalog items, placeable in the 3D Studio ══ */}
      {/* Only once there are enough product photos to fill a row (most items have no photo yet) */}
      {palette.length >= 4 && (
        <section className="gs-gallery">
          <div className="gs-container">
            <div className="gs-gallery-header">
              <div>
                <SectionEyebrow icon={Sprout} label="From our catalog" />
                <h2 className="gs-section-title" style={{ margin: 0 }}>Plants &amp; materials you can place in 3D</h2>
              </div>
              <Link to="/try-studio" className="gs-gallery-link" onPointerEnter={prefetchStudio}>
                Try them in 3D <ArrowRight size={16} />
              </Link>
            </div>
            <motion.div className="gs-gallery-grid"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}>
              {palette.map(item => (
                <motion.div key={item.id} variants={FADE_UP}>
                  <Link to="/try-studio" className="gs-gallery-item" style={{ display: 'block', textDecoration: 'none' }}
                    onPointerEnter={prefetchStudio} aria-label={`Try ${item.name} in the 3D Studio`}>
                    <img src={catalogImage(item)} alt={item.name} loading="lazy"
                      onError={e => { e.currentTarget.closest('.gs-gallery-item').style.display = 'none'; }} />
                    <div className="gs-gallery-overlay" />
                    <div className="gs-gallery-caption">
                      <p className="gs-gallery-category">{CATEGORY_LABEL[item.category] || item.category}{item.model_file ? ' · 3D' : ''}</p>
                      <p className="gs-gallery-label">{item.name.replace(/_/g, ' ')}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ══ TESTIMONIALS — real reviews from projects and orders ══ */}
      <ReviewCarousel />

      {/* ══ CTA ══ */}
      <section className="gs-cta">
        <div className="gs-cta-pattern" />
        <div className="gs-container gs-cta-content">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}>
            <motion.div variants={FADE_UP}>
              <SectionEyebrow icon={Leaf} label="Get started today" center style={{ marginBottom: 24 }} />
            </motion.div>
            <motion.h2 variants={FADE_UP} className="gs-cta-h2">
              Ready to build your<br />dream garden?
            </motion.h2>
            <motion.p variants={FADE_UP} className="gs-cta-sub">
              Start designing in the free 3D Studio now, no sign-up. Create a free account when you want the AI,
              your own yard in 3D, or our crew.
            </motion.p>
            <motion.div variants={FADE_UP} className="gs-cta-plans">
              <div className="gs-cta-plan">
                <h3>Free, right now</h3>
                <ul>
                  {FREE_NOW.map(t => <li key={t}><span className="ico"><Check size={12} strokeWidth={3} /></span>{t}</li>)}
                </ul>
              </div>
              <div className="gs-cta-plan account">
                <h3>With a free account</h3>
                <ul>
                  {WITH_ACCOUNT.map(t => <li key={t}><span className="ico"><Lock size={11} /></span>{t}</li>)}
                </ul>
              </div>
            </motion.div>
            <motion.div variants={FADE_UP} className="gs-cta-btns">
              <Link to="/try-studio" className="gs-btn-cta-primary" onPointerEnter={prefetchStudio} onFocus={prefetchStudio}>
                Start designing free
              </Link>
              <Link to="/register" className="gs-btn-cta-outline">Create free account</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />

    </div>
  );
}
