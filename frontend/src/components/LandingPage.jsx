import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import FeatureCarousel from './FeatureCarousel';
import ReviewCarousel from './ReviewCarousel';
import LandingStudioTeaser from './LandingStudioTeaser';
import ScrollStory from './ScrollStory';
import { SiteHeader, SiteFooter } from './SiteChrome';
import EstimateTeaser from './EstimateTeaser';
import ProofShowcase from './ProofShowcase';
import HeroGarden from './HeroGarden';
import { prefetchStudio } from '../services/prefetch';
import { ProjectCard } from './ProjectHub';
import { getPublicProjects, getTrackRecord, getInventoryItems } from '../services/api';
import { productImage } from '../data/productImage';
import {
  Leaf,
  ArrowRight,
  ShieldCheck,
  Image as ImageIcon,
  Trees,
  Sun,
  Wrench,
  Sparkles,
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
const SERVICES = [
  { title: 'Garden Design',          icon: <Leaf size={24} />,        desc: 'Bespoke botanical layouts tailored to your local climate and personal aesthetic.' },
  { title: '3D Virtual Landscaping', icon: <ImageIcon size={24} />,   desc: 'Immersive 3D previews of your future garden using our state-of-the-art studio.' },
  { title: 'Plant Recommendations',  icon: <Trees size={24} />,       desc: 'Expert curation of flora to ensure year-round vibrancy and sustainability.' },
  { title: 'Hardscape Installation', icon: <ShieldCheck size={24} />, desc: 'Premium stonework, paving, and structural elements built to last generations.' },
  { title: 'Outdoor Lighting',       icon: <Sun size={24} />,         desc: 'Architectural and mood lighting to bring your garden to life after dark.' },
  { title: 'Lawn Maintenance',       icon: <Wrench size={24} />,      desc: 'Comprehensive care plans to keep your outdoor sanctuary in pristine condition.' },
];

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
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 100px;
          background: #ecfdf5; border: 1px solid #a7f3d0;
          color: #059669; font-size: 13px; font-weight: 700;
          letter-spacing: 0.5px; text-transform: uppercase;
          margin-bottom: 28px;
        }
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

        .gs-section-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 100px;
          background: #ecfdf5; border: 1px solid #a7f3d0;
          color: #059669; font-size: 12px; font-weight: 800;
          letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px;
        }
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
          padding: 36px 32px;
          border-radius: 20px;
          background: white;
          border: 1px solid #e2e8f0;
          transition: box-shadow 0.25s, transform 0.25s, border-color 0.25s;
          position: relative; overflow: hidden;
        }
        .gs-service-card::before {
          content: '';
          position: absolute; top: 0; right: 0;
          width: 80px; height: 80px;
          background: #ecfdf5;
          border-radius: 0 20px 0 100%;
          transition: transform 0.3s;
          z-index: 0;
        }
        .gs-service-card:hover {
          box-shadow: 0 20px 50px rgba(16,185,129,0.08), 0 4px 16px rgba(0,0,0,0.04);
          transform: translateY(-4px);
          border-color: #a7f3d0;
        }
        .gs-service-card:hover::before { transform: scale(1.3); }
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
              <motion.div variants={FADE_UP} className="gs-hero-badge">
                <Sparkles size={13} />
                Free 3D Garden Studio · No sign-up
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
                      <span><strong>{record.average_rating}★</strong> from {record.review_count.toLocaleString()} reviews</span>
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
              <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>Our Expertise</div>
              <h2 className="gs-section-title">Premium Services</h2>
              <p style={{ fontSize: 17, color: '#64748b', maxWidth: 480, margin: '12px auto 0', lineHeight: 1.65 }}>
                From concept to completion — everything you need to transform your outdoor space.
              </p>
            </motion.div>
          </div>
          <motion.div className="gs-services-grid"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER_SLOW}>
            {SERVICES.map((service, i) => (
              <motion.div key={i} variants={FADE_UP} className="gs-service-card">
                <div className="gs-service-icon">{service.icon}</div>
                <h3 className="gs-service-title">{service.title}</h3>
                <p className="gs-service-desc">{service.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══ HOW IT WORKS — scroll story: photo → terrain → plants → light → estimate → crew ══ */}
      <ScrollStory />

      {/* ══ INSTANT ESTIMATE — yard size → price range, hands off to the AI Designer or Studio ══ */}
      <EstimateTeaser />

      {/* ══ TRY THE STUDIO — free 3D design, AI with an account ══ */}
      <LandingStudioTeaser />

      {/* ══ REAL RESULTS — before/after and 3D design vs built, from published projects ══ */}
      <ProofShowcase />

      {/* ══ FEATURED PROJECTS (Project Hub) — only once real projects are published ══ */}
      {projects.length > 0 && (
        <section id="projects" className="gs-gallery">
          <div className="gs-container">
            <div className="gs-gallery-header">
              <div>
                <div className="gs-section-eyebrow" style={{ marginBottom: 14 }}>Project Hub</div>
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
                <div className="gs-section-eyebrow" style={{ marginBottom: 14 }}>From our catalog</div>
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
              <div className="gs-section-eyebrow" style={{ marginBottom: 24, marginLeft: 'auto', marginRight: 'auto', display: 'table' }}>
                Get Started Today
              </div>
            </motion.div>
            <motion.h2 variants={FADE_UP} className="gs-cta-h2">
              Ready to build your<br />dream garden?
            </motion.h2>
            <motion.p variants={FADE_UP} className="gs-cta-sub">
              Create an account to access the 3D studio, save your designs, and connect with our expert landscaping team.
            </motion.p>
            <motion.div variants={FADE_UP} className="gs-cta-btns">
              <Link to="/register" className="gs-btn-cta-primary">Create Free Account</Link>
              <Link to="/try-studio" className="gs-btn-cta-outline">Try the 3D Studio Free</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />

    </div>
  );
}
