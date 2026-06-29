import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import FeatureCarousel from './FeatureCarousel';
import {
  Leaf,
  MapPin,
  Phone,
  Mail,
  Star,
  Quote,
  ArrowRight,
  ShieldCheck,
  Image as ImageIcon,
  Trees,
  Sun,
  Wrench,
  Menu,
  X,
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

const STEPS = [
  { step: '01', title: 'Upload Photo',  desc: 'Take a photo of your current outdoor space and upload it to our platform.' },
  { step: '02', title: 'Generate 3D',  desc: 'Our AI engine maps the depth and terrain of your space automatically.' },
  { step: '03', title: 'Design',       desc: 'Drag & drop premium plants, furniture, and materials into the scene.' },
  { step: '04', title: 'Build',        desc: 'Save your design or book our pros to bring it to life.' },
];

const REVIEWS = [
  { text: 'Being able to see the 3D design before spending any money gave me so much confidence. The installation team executed it perfectly.', name: 'Sarah M.', role: 'Homeowner', rating: 5 },
  { text: 'The app is incredibly fun to use, and the final garden looks exactly like the 3D render. Absolutely worth every penny.', name: 'David L.', role: 'Property Developer', rating: 5 },
  { text: 'They transformed my boring backyard into a tropical resort. The plant recommendations were spot on for our climate.', name: 'Elena R.', role: 'Homeowner', rating: 5 },
];

const GALLERY = [
  { src: 'https://images.unsplash.com/photo-1598902108854-10e335adac99?q=80&w=800&auto=format&fit=crop', label: 'Monstera Deliciosa',      category: 'Tropical Plant' },
  { src: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?q=80&w=800&auto=format&fit=crop', label: 'Natural Stone Pavers',    category: 'Hardscape' },
  { src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop', label: 'Outdoor Lounge Timber',   category: 'Lifestyle' },
  { src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=800&auto=format&fit=crop', label: 'Tropical Palm Grove',     category: 'Botanical' },
];

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [liveReviews,  setLiveReviews]  = useState(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    fetch(`${apiBase}/reviews/public/`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.length) setLiveReviews(data); })
      .catch(() => {});
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
    body.style.overflow = 'auto';
    body.style.height = 'auto';

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Services',     id: 'services' },
    { label: 'How it Works', id: 'how-it-works' },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a', background: '#f8fafc', minHeight: '100vh' }}>

      {/* ══ GLOBAL STYLES ══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }

        html, body {
          overflow-x: hidden;
          overflow-y: auto !important;
          height: auto !important;
          min-height: 100%;
        }

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

        /* ── Navbar ── */
        .gs-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 32px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(226,232,240,0.8);
          transition: background 0.3s, box-shadow 0.3s, padding 0.3s;
        }
        .gs-nav.scrolled {
          background: rgba(255,255,255,0.97);
          box-shadow: 0 1px 0 rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
          padding: 14px 32px;
        }
        .gs-nav-logo {
          display: flex; align-items: center; gap: 8px;
          font-weight: 900; font-size: 20px; letter-spacing: -0.5px;
          text-decoration: none; color: inherit;
        }
        .gs-nav-links {
          display: flex; gap: 32px;
          list-style: none; margin: 0; padding: 0;
        }
        .gs-nav-links button {
          background: none; border: none; cursor: pointer;
          font-size: 15px; font-weight: 600; letter-spacing: -0.1px;
          padding: 0; transition: color 0.2s;
        }
        .gs-nav-cta {
          display: flex; align-items: center; gap: 12px;
        }
        .gs-btn-ghost {
          font-size: 15px; font-weight: 700; padding: 8px 16px;
          background: none; border: none; cursor: pointer;
          text-decoration: none; transition: color 0.2s;
          border-radius: 8px;
        }
        .gs-btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 22px; border-radius: 100px;
          font-size: 14px; font-weight: 700; text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
          border: none; cursor: pointer;
          background: #10b981; color: white;
          box-shadow: 0 4px 14px rgba(16,185,129,0.35);
        }
        .gs-btn-primary:hover { background: #059669; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.4); }
        .gs-btn-primary:active { transform: scale(0.97); }

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

        /* ── How It Works ── */
        .gs-hiw {
          padding: 100px 0;
          background: white;
        }
        .gs-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
          position: relative;
        }
        .gs-steps-line {
          position: absolute;
          top: 40px; left: 12%; right: 12%; height: 2px;
          background: linear-gradient(90deg, #e2e8f0 0%, #a7f3d0 50%, #e2e8f0 100%);
          z-index: 0;
        }
        .gs-step-item {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; position: relative; z-index: 1;
        }
        .gs-step-num {
          width: 80px; height: 80px; border-radius: 50%;
          background: white; border: 3px solid #e2e8f0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 900; color: #10b981;
          margin-bottom: 24px; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .gs-step-item:hover .gs-step-num {
          border-color: #10b981;
          box-shadow: 0 0 0 6px rgba(16,185,129,0.12);
        }
        .gs-step-title { font-size: 17px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
        .gs-step-desc  { font-size: 14px; color: #64748b; line-height: 1.65; margin: 0; padding: 0 8px; }

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
        .gs-reviews-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .gs-review-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px; padding: 36px 32px;
          position: relative;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .gs-review-card:hover {
          background: #ecfdf5;
          border-color: #a7f3d0;
          box-shadow: 0 8px 30px rgba(16,185,129,0.08);
        }
        .gs-quote-icon {
          position: absolute; top: 24px; right: 28px;
          color: #d1fae5;
        }
        .gs-stars { display: flex; gap: 4px; margin-bottom: 20px; }
        .gs-review-text {
          font-size: 15px; line-height: 1.75;
          color: #475569; margin: 0 0 28px;
          font-weight: 400;
        }
        .gs-reviewer-name  { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
        .gs-reviewer-role  { font-size: 13px; color: #059669; margin: 0; }

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

        /* ── Footer ── */
        .gs-footer {
          background: #ffffff;
          color: #64748b;
          padding-top: 72px;
          border-top: 1px solid #e2e8f0;
        }
        .gs-footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1.2fr 1.3fr;
          gap: 48px;
          padding-bottom: 60px;
          border-bottom: 1px solid #e2e8f0;
        }
        .gs-footer-brand { display: flex; align-items: center; gap: 8px; color: #0f172a; margin-bottom: 16px; text-decoration: none; }
        .gs-footer-brand-name { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
        .gs-footer-about { font-size: 14px; line-height: 1.75; margin: 0 0 24px; }
        .gs-footer-socials { display: flex; gap: 10px; }
        .gs-social-btn {
          width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid #e2e8f0; background: transparent;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #475569; cursor: pointer;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .gs-social-btn:hover { border-color: #10b981; color: #10b981; background: rgba(16,185,129,0.06); }
        .gs-footer-heading { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 20px; letter-spacing: 0.3px; }
        .gs-footer-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .gs-footer-links a,
        .gs-footer-links button {
          font-size: 14px; color: #64748b; text-decoration: none;
          background: none; border: none; cursor: pointer; padding: 0;
          transition: color 0.2s; text-align: left;
        }
        .gs-footer-links a:hover,
        .gs-footer-links button:hover { color: #059669; }
        .gs-contact-item {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 14px; line-height: 1.6; margin-bottom: 14px;
        }
        .gs-contact-item svg { color: #10b981; flex-shrink: 0; margin-top: 2px; }
        .gs-newsletter-text { font-size: 14px; line-height: 1.7; margin: 0 0 16px; }
        .gs-newsletter-form { display: flex; }
        .gs-newsletter-input {
          flex: 1; padding: 11px 16px;
          background: #f8fafc; border: 1px solid #e2e8f0; border-right: none;
          border-radius: 10px 0 0 10px; font-size: 14px; color: #0f172a;
          outline: none; transition: border-color 0.2s;
        }
        .gs-newsletter-input::placeholder { color: #94a3b8; }
        .gs-newsletter-input:focus { border-color: #10b981; }
        .gs-newsletter-btn {
          padding: 11px 16px; background: #10b981; border: none; cursor: pointer;
          border-radius: 0 10px 10px 0; color: white;
          transition: background 0.2s;
        }
        .gs-newsletter-btn:hover { background: #059669; }
        .gs-footer-bottom {
          padding: 24px 0;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 13px; flex-wrap: wrap; gap: 12px;
        }
        .gs-footer-legal { display: flex; gap: 24px; }
        .gs-footer-legal a { color: #64748b; text-decoration: none; transition: color 0.2s; }
        .gs-footer-legal a:hover { color: #059669; }

        /* ── Mobile Menu ── */
        .gs-mobile-menu {
          position: fixed; top: 64px; left: 0; right: 0; z-index: 40;
          background: white; border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          padding: 24px; display: flex; flex-direction: column; gap: 4px;
        }
        .gs-mobile-link {
          font-size: 17px; font-weight: 700; padding: 12px 0;
          color: #0f172a; background: none; border: none; cursor: pointer;
          text-align: left; border-bottom: 1px solid #f1f5f9; text-decoration: none;
          transition: color 0.2s;
        }
        .gs-mobile-link:hover { color: #10b981; }
        .gs-mobile-cta {
          margin-top: 12px; padding: 14px;
          background: #10b981; color: white; border-radius: 100px;
          font-size: 16px; font-weight: 800; text-align: center; text-decoration: none;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .gs-services-grid { grid-template-columns: repeat(2, 1fr); }
          .gs-steps-grid { grid-template-columns: repeat(2, 1fr); }
          .gs-steps-line { display: none; }
          .gs-footer-grid { grid-template-columns: 1fr 1fr; gap: 36px; }
          .gs-gallery-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .gs-nav { padding: 16px 20px; }
          .gs-nav.scrolled { padding: 12px 20px; }
          .gs-nav-links, .gs-nav-cta { display: none; }
          .gs-services-grid { grid-template-columns: 1fr; }
          .gs-steps-grid { grid-template-columns: 1fr; }
          .gs-reviews-grid { grid-template-columns: 1fr; }
          .gs-footer-grid { grid-template-columns: 1fr; gap: 32px; }
          .gs-gallery-grid { grid-template-columns: repeat(2, 1fr); }
          .gs-gallery-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .gs-footer-bottom { flex-direction: column; text-align: center; }
          .gs-hero-split { grid-template-columns: 1fr; gap: 40px; }
          .gs-hero-copy .gs-hero-h1   { text-align: center; }
          .gs-hero-copy .gs-hero-sub  { text-align: center; }
          .gs-hero-copy .gs-hero-actions { justify-content: center; }
          .gs-hero-proofrow { justify-content: center; }
          .gs-hero-visual { display: none; }
        }
        .gs-mobile-ham { display: none; }
        @media (max-width: 768px) { .gs-mobile-ham { display: block; } }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav className={`gs-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="#" className="gs-nav-logo" style={{ color: '#0f172a' }}>
          <Leaf size={22} color="#10b981" />
          <span>Garden Studio</span>
        </a>
        <ul className="gs-nav-links">
          {navLinks.map(({ label, id }) => (
            <li key={id}>
              <button
                onClick={() => scrollTo(id)}
                style={{ color: '#475569' }}
                onMouseEnter={e => e.target.style.color = '#10b981'}
                onMouseLeave={e => e.target.style.color = '#475569'}
              >{label}</button>
            </li>
          ))}
        </ul>
        <div className="gs-nav-cta">
          <Link to="/login" className="gs-btn-ghost" style={{ color: '#475569' }}>
            Log In
          </Link>
          <Link to="/register" className="gs-btn-primary">
            Sign Up Free
          </Link>
        </div>
        <button className="gs-mobile-ham"
          onClick={() => setMobileOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 4 }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div className="gs-mobile-menu"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {navLinks.map(({ label, id }) => (
            <button key={id} className="gs-mobile-link" onClick={() => { scrollTo(id); setMobileOpen(false); }}>
              {label}
            </button>
          ))}
          <Link to="/login" className="gs-mobile-link" style={{ color: '#475569' }}>Log In</Link>
          <Link to="/register" className="gs-mobile-cta">Sign Up Free</Link>
        </motion.div>
      )}

      {/* ══ HERO ══ */}
      <section className="gs-hero">
        <div className="gs-container" style={{ position: 'relative', zIndex: 10, width: '100%' }}>
          <div className="gs-hero-split">

            {/* Left — copy */}
            <motion.div initial="hidden" animate="visible" variants={STAGGER} className="gs-hero-copy">
              <motion.div variants={FADE_UP} className="gs-hero-badge">
                <Sparkles size={13} />
                AI Garden Design · Free to Try
              </motion.div>

              <motion.h1 variants={FADE_UP} className="gs-hero-h1">
                Your dream garden,<br />
                <span>designed in minutes.</span>
              </motion.h1>

              <motion.p variants={FADE_UP} className="gs-hero-sub">
                Upload a site photo, visualize 1,200+ plants and materials in real 3D,
                then book your crew — all before the first shovel hits the ground.
              </motion.p>

              <motion.div variants={FADE_UP} className="gs-hero-actions">
                <Link to="/ai-designer" className="gs-btn-hero-primary">
                  Start Designing Free <ArrowRight size={18} />
                </Link>
                <button className="gs-btn-hero-outline" onClick={() => scrollTo('services')}>
                  Explore Services
                </button>
              </motion.div>

              <motion.div variants={FADE_UP} className="gs-hero-proofrow">
                <span><strong>500+</strong> Projects</span>
                <span className="gs-hero-proof-dot" />
                <span><strong>98%</strong> Client Satisfaction</span>
                <span className="gs-hero-proof-dot" />
                <span><strong>1,200+</strong> Plants Available</span>
              </motion.div>
            </motion.div>

            {/* Right — feature journey carousel */}
            <motion.div
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="gs-hero-visual"
            >
              <FeatureCarousel />
            </motion.div>

          </div>
        </div>

        <div className="gs-scroll-indicator" onClick={() => scrollTo('showcase')}>
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

      {/* ══ HOW IT WORKS ══ */}
      <section id="how-it-works" className="gs-hiw">
        <div className="gs-container">
          <div className="gs-section-header">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
              <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>Process</div>
              <h2 className="gs-section-title">4 Steps to Your Paradise</h2>
              <p style={{ fontSize: 17, color: '#64748b', maxWidth: 440, margin: '12px auto 0', lineHeight: 1.65 }}>
                From photo to finished garden — our streamlined process makes it effortless.
              </p>
            </motion.div>
          </div>
          <div className="gs-steps-grid">
            <div className="gs-steps-line" />
            {STEPS.map((item, i) => (
              <motion.div key={i} className="gs-step-item"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}
                transition={{ delay: i * 0.08 }}>
                <div className="gs-step-num">{item.step}</div>
                <h3 className="gs-step-title">{item.title}</h3>
                <p className="gs-step-desc">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MATERIAL PALETTE ══ */}
      <section className="gs-gallery">
        <div className="gs-container">
          <div className="gs-gallery-header">
            <div>
              <div className="gs-section-eyebrow" style={{ marginBottom: 14 }}>Material Palette</div>
              <h2 className="gs-section-title" style={{ margin: 0 }}>Premium Materials</h2>
            </div>
            <Link to="/ai-designer" className="gs-gallery-link">
              View full catalog <ArrowRight size={16} />
            </Link>
          </div>
          <motion.div className="gs-gallery-grid"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}>
            {GALLERY.map((item, i) => (
              <motion.div key={i} className="gs-gallery-item" variants={FADE_UP}>
                <img src={item.src} alt={item.label} />
                <div className="gs-gallery-overlay" />
                <div className="gs-gallery-caption">
                  <p className="gs-gallery-category">{item.category}</p>
                  <p className="gs-gallery-label">{item.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className="gs-testimonials">
        <div className="gs-container">
          <div className="gs-section-header" style={{ marginBottom: 56 }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
              <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>
                Reviews
              </div>
              <h2 className="gs-section-title">Loved by Homeowners</h2>
              <p style={{ fontSize: 17, color: '#64748b', maxWidth: 440, margin: '12px auto 0', lineHeight: 1.65 }}>
                Real results from real customers who transformed their spaces.
              </p>
            </motion.div>
          </div>
          <motion.div className="gs-reviews-grid"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}>
            {(liveReviews
              ? liveReviews.map(r => ({
                  text: r.comment || 'Great service overall.',
                  name: r.reviewer_name,
                  role: r.service_type || 'Homeowner',
                  rating: r.rating,
                  verified: true,
                }))
              : REVIEWS
            ).map((review, i) => (
              <motion.div key={i} className="gs-review-card" variants={FADE_UP}>
                <Quote size={36} className="gs-quote-icon" />
                <div className="gs-stars">
                  {[...Array(review.rating)].map((_, j) => (
                    <Star key={j} size={14} fill="#10b981" color="#10b981" />
                  ))}
                </div>
                <p className="gs-review-text">"{review.text}"</p>
                <div>
                  <p className="gs-reviewer-name">{review.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p className="gs-reviewer-role" style={{ margin: 0 }}>{review.role}</p>
                    {review.verified && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 700, color: '#059669',
                        background: '#ecfdf5', padding: '2px 7px',
                        borderRadius: 9999, border: '1px solid #a7f3d0',
                      }}>
                        <ShieldCheck size={10} /> Verified Customer
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

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
              <Link to="/ai-designer" className="gs-btn-cta-outline">Try Studio as Guest</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="gs-footer">
        <div className="gs-container">
          <div className="gs-footer-grid">
            {/* Brand */}
            <div>
              <a href="#" className="gs-footer-brand">
                <Leaf size={20} color="#10b981" />
                <span className="gs-footer-brand-name">Garden Studio</span>
              </a>
              <p className="gs-footer-about">
                Elevating outdoor living spaces with AI technology and premium landscaping craftsmanship since 2009.
              </p>
              <div className="gs-footer-socials">
                {['FB', 'IG', 'TW'].map(s => (
                  <button key={s} className="gs-social-btn">{s}</button>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="gs-footer-heading">Quick Links</h4>
              <ul className="gs-footer-links">
                <li><Link to="/ai-designer">AI Designer</Link></li>
                <li><button onClick={() => scrollTo('services')}>Services</button></li>
                <li><button onClick={() => scrollTo('how-it-works')}>How it Works</button></li>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/register">Sign Up</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="gs-footer-heading">Contact Us</h4>
              <div className="gs-contact-item">
                <MapPin size={16} />
                <span>123 Botanical Way, Green District<br />Pagbilao, Philippines 1000</span>
              </div>
              <div className="gs-contact-item">
                <Phone size={16} />
                <span>+63 912 345 6789</span>
              </div>
              <div className="gs-contact-item">
                <Mail size={16} />
                <span>hello@gardenstudio.com</span>
              </div>
            </div>

            {/* Newsletter */}
            <div>
              <h4 className="gs-footer-heading">Newsletter</h4>
              <p className="gs-newsletter-text">Get seasonal gardening tips and design inspiration straight to your inbox.</p>
              <div className="gs-newsletter-form">
                <input type="email" placeholder="Your email address" className="gs-newsletter-input" />
                <button className="gs-newsletter-btn">
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="gs-footer-bottom">
            <p style={{ margin: 0 }}>© {new Date().getFullYear()} Garden Studio. All rights reserved.</p>
            <div className="gs-footer-legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );s
}
