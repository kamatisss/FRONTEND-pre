import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { customerLinks, useStaffLinks } from './navLinks';
import StaffNav from './StaffNav';
import NotificationBell from './ui/NotificationBell';
import {
  LogOut, Leaf, ChevronDown, Menu, X, Download, LayoutDashboard, ShoppingCart, UserRound, ShieldCheck, Briefcase, HardHat, Globe,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useInstall } from '../pwa/useInstall';
import InstallAppSheet from './ui/InstallAppSheet';
import { dashboardPath } from '../data/roleHome';

/* ─── Avatar: shows first letter of first name, with green gradient ─── */
function Avatar({ user, size = 36 }) {
  const letter = (user?.first_name || user?.username || '?')[0].toUpperCase();

  // Deterministic hue from username so it's consistent per user
  const hues = [158, 172, 142, 195, 120, 165];
  const hue  = hues[(user?.username?.charCodeAt(0) || 0) % hues.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, hsl(${hue},72%,38%) 0%, hsl(${hue + 20},80%,52%) 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        color: 'white',
        flexShrink: 0,
        boxShadow: `0 0 0 2px white, 0 0 0 3.5px hsl(${hue},72%,48%)`,
        letterSpacing: '-0.5px',
        userSelect: 'none',
      }}
    >
      {letter}
    </div>
  );
}

/* ─── Profile menu (the one account place for every role: the sidebar has none) ───
 * Who you are (name, email, your exact role), then where to go, then sign out. A real menu: announced as
 * one, Escape closes it and puts focus back on the button, every item shows keyboard focus. On phones it
 * spans the width under the bar instead of hanging off the avatar. */
const ROLE_CHIP = {
  admin: { text: 'Admin', Icon: ShieldCheck, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  OFFICE_ADMIN: { text: 'Office admin', Icon: Briefcase, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  FIELD_CREW: { text: 'Field crew', Icon: HardHat, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  staff: { text: 'Staff', Icon: Briefcase, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
};
function roleChip(user) {
  if (user?.is_superuser) return ROLE_CHIP.admin;
  if (user?.is_staff) return ROLE_CHIP[user?.staff_role] || ROLE_CHIP.staff;
  return null;   // customers: no badge
}

function ProfileDropdown({ user, logoutUser, onClose, onInstall, canInstall }) {
  const navigate = useNavigate();
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user?.username;
  // Second line: the email, or nothing when it would only repeat the name
  const secondLine = user?.email || (displayName !== user?.username ? `@${user?.username}` : '');
  const chip = roleChip(user);
  const go = (to) => { onClose(); navigate(to); };

  return (
    <div id="tn-profile-menu" role="menu" aria-label="Account"
      className="fixed left-3 right-3 top-[64px] sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-72 z-[200] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      style={{ animation: 'tn-dropdown-in 0.18s cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 12px 40px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)' }}>
      {/* Who */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
        <Avatar user={user} size={44} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] font-extrabold text-slate-900 truncate leading-tight">{displayName}</p>
          {secondLine && <p className="m-0 mt-0.5 text-xs text-slate-500 truncate">{secondLine}</p>}
          {chip && (
            <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${chip.cls}`}>
              <chip.Icon size={12} /> {chip.text}
            </span>
          )}
        </div>
      </div>

      {/* Where */}
      <div className="border-t border-slate-100 p-1.5">
        <DropItem icon={LayoutDashboard} label="My dashboard" hint="Your home screen" onClick={() => go(dashboardPath(user))} />
        <DropItem icon={UserRound} label="My account" hint="Details, password and privacy" onClick={() => go('/account')} />
        {/* Staff check what customers see; customers get back to the main site */}
        <DropItem icon={Globe} label="View website" hint={user?.is_staff || user?.is_superuser ? 'See what customers see' : 'Our projects and services'} onClick={() => go('/')} />
        {canInstall && <DropItem icon={Download} label="Install app" hint="Open it from your home screen" onClick={() => { onClose(); onInstall(); }} />}
      </div>

      {/* Leave */}
      <div className="border-t border-slate-100 p-1.5">
        <button type="button" role="menuitem" onClick={() => { onClose(); logoutUser(); }}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-none bg-transparent cursor-pointer text-left text-sm font-bold text-red-600 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
          <span className="w-8 h-8 rounded-lg bg-red-50 inline-flex items-center justify-center shrink-0"><LogOut size={16} /></span>
          Sign out
        </button>
      </div>
    </div>
  );
}

function DropItem({ icon: Icon, label, hint, onClick }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className="group w-full flex items-center gap-3 rounded-xl px-3 py-2 border-none bg-transparent cursor-pointer text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
      <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700 inline-flex items-center justify-center shrink-0 transition-colors">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800 leading-tight">{label}</span>
        {hint && <span className="block text-xs text-slate-500 leading-snug truncate">{hint}</span>}
      </span>
    </button>
  );
}

/* ─── Cart button (customers): count badge that pops when something is added ─── */
function CartButton() {
  const { cartCount } = useCart();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/shop?cart=open')}
      aria-label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart, empty'}
      className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer shrink-0 transition-colors"
    >
      <ShoppingCart size={18} />
      {cartCount > 0 && (
        <motion.span
          key={cartCount}
          initial={{ scale: 1.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white"
        >
          {cartCount > 9 ? '9+' : cartCount}
        </motion.span>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN TOPNAVBAR COMPONENT
══════════════════════════════════════════════════════════════ */
const TopNavbar = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [dropOpen, setDropOpen] = useState(false);
  // "Install app": the browser's own prompt (Android / desktop), or the steps on iPhone
  const { available: canInstall, install } = useInstall();
  const [installSteps, setInstallSteps] = useState(false);
  const startInstall = async () => { if (await install() === 'steps') setInstallSteps(true); };
  const [menu, setMenu] = useState({ open: false, path: location.pathname });
  const dropRef = useRef(null);
  const profileBtn = useRef(null);
  const staffLinks = useStaffLinks(user);

  // The phone menu closes itself on navigation (it remembers the page it opened on).
  const menuOpen = menu.open && menu.path === location.pathname + location.search;
  const toggleMenu = () => setMenu({ open: !menuOpen, path: location.pathname + location.search });
  const closeMenu = () => setMenu(m => ({ ...m, open: false }));

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Escape closes the profile menu and puts focus back on its button
  useEffect(() => {
    if (!dropOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setDropOpen(false); profileBtn.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dropOpen]);

  // No page scroll behind the open menu; Escape closes it
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  if (!user) return null;

  const isAdminOrStaff = user.is_staff || user.is_superuser;
  // Customers: menu button below lg (5 links don't fit a tablet). Staff: below md,
  // where the sidebar is hidden.
  const menuBp = isAdminOrStaff ? 'md' : 'lg';
  const menuLinks = isAdminOrStaff
    ? staffLinks
    : customerLinks.map(l => ({ ...l, active: location.pathname === l.to }));

  return (
    <>
      <style>{`
        @keyframes tn-dropdown-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        .tn-nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          color: #475569;
          text-decoration: none;
          transition: background 0.18s, color 0.18s;
          white-space: nowrap;
          letter-spacing: -0.1px;
          border: 1px solid transparent;
        }
        .tn-nav-link:hover {
          background: #f1f5f9;
          color: #10b981;
        }
        .tn-nav-link.active {
          background: #ecfdf5;
          color: #059669;
          border-color: #a7f3d0;
          font-weight: 700;
        }
        .tn-nav-link .tn-dot {
          display: none;
        }
        .tn-nav-link.active .tn-dot {
          display: block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #10b981;
          flex-shrink: 0;
        }

        .tn-profile-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 100px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
          font-family: inherit;
        }
        .tn-profile-btn:hover {
          background: #f1f5f9;
          border-color: #a7f3d0;
          box-shadow: 0 2px 8px rgba(16,185,129,0.1);
        }
        .tn-profile-btn[aria-expanded="true"] {
          background: #ecfdf5;
          border-color: #6ee7b7;
        }

        .tn-divider {
          width: 1px;
          height: 20px;
          background: #e2e8f0;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .tn-username { display: none !important; }
        }
        @media (max-width: 340px) {
          .tn-brand-name { display: none !important; }
        }
        /* Customers also have the cart button: the logo alone carries the brand on small phones */
        @media (max-width: 419px) {
          .tn-brand-name.tn-has-cart { display: none !important; }
        }
        .tn-menu-link {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 12px;
          font-size: 15px; font-weight: 600; color: #334155; text-decoration: none;
        }
        .tn-menu-link:hover { background: #f8fafc; color: #059669; }
        .tn-menu-link.active { background: #ecfdf5; color: #047857; }
        @keyframes tn-menu-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        height: 60,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: 12,
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>

        {/* ── LEFT: Brand ── */}
        <Link to={isAdminOrStaff ? (user.is_superuser ? '/admin-dashboard' : '/staff-dashboard') : '/user-dashboard'} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
          }}>
            <Leaf size={16} color="white" />
          </div>
          <span className={`tn-brand-name${isAdminOrStaff ? '' : ' tn-has-cart'}`} style={{
            fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px',
          }}>
            Garden Studio
          </span>
        </Link>

        {/* Center-Right Navigation Links (desktop) */}
        {!isAdminOrStaff && (
          <div className="hidden lg:flex items-center gap-6 ml-auto mr-8">
            {customerLinks.filter(l => l.primary).map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'font-semibold text-emerald-600' : 'font-medium text-slate-600'} hover:text-emerald-600 transition-colors duration-150 no-underline whitespace-nowrap`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Far right: notifications + profile dropdown */}
        <div className={isAdminOrStaff ? 'ml-auto' : 'ml-auto lg:ml-0'} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isAdminOrStaff && <CartButton />}
        <NotificationBell />
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button
            ref={profileBtn}
            type="button"
            onClick={() => setDropOpen(!dropOpen)}
            className="tn-profile-btn"
            aria-label={`Account menu for ${user?.first_name || user?.username}`}
            aria-haspopup="menu"
            aria-controls="tn-profile-menu"
            aria-expanded={dropOpen}
          >
            <Avatar user={user} />
            <span className="tn-username" style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              {user?.first_name || user?.username}
            </span>
            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
          </button>

          {dropOpen && (
            <ProfileDropdown
              user={user}
              logoutUser={signOut}
              onClose={() => setDropOpen(false)}
              canInstall={canInstall}
              onInstall={startInstall}
            />
          )}
        </div>
        </div>

        {/* Menu button (phones / tablets) */}
        <button
          type="button"
          onClick={toggleMenu}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="tn-mobile-menu"
          className={`${menuBp === 'lg' ? 'lg:hidden' : 'md:hidden'} flex items-center justify-center w-10 h-10 -mr-1 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer shrink-0`}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {menuOpen && (
        <div className={menuBp === 'lg' ? 'lg:hidden' : 'md:hidden'}>
          <div onClick={closeMenu} style={{ position: 'fixed', inset: '60px 0 0 0', background: 'rgba(15,23,42,0.35)', zIndex: 98 }} />
          <nav
            id="tn-mobile-menu"
            aria-label="Main menu"
            style={{
              position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99, background: 'white',
              borderBottom: '1px solid #e2e8f0', boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
              padding: '10px 12px 14px', maxHeight: 'calc(100dvh - 60px)', overflowY: 'auto',
              fontFamily: "'Inter', system-ui, sans-serif", animation: 'tn-menu-in 0.18s ease-out',
            }}
          >
            {/* Staff: the same groups as the desktop sidebar. Customers: their short flat list */}
            {isAdminOrStaff ? <StaffNav links={staffLinks} variant="drawer" onNavigate={closeMenu} />
              : menuLinks.map(({ to, label, icon, active }) => { const Icon = icon; return (
              <Link key={label} to={to} onClick={closeMenu} className={`tn-menu-link${active ? ' active' : ''}`}>
                <Icon size={18} style={{ color: active ? '#059669' : '#94a3b8', flexShrink: 0 }} />
                {label}
              </Link>
            ); })}
            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 8 }}>
              {canInstall && (
                <button type="button" onClick={() => { closeMenu(); startInstall(); }} className="tn-menu-link"
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#047857', fontFamily: 'inherit' }}>
                  <Download size={18} style={{ flexShrink: 0 }} />
                  Install app
                </button>
              )}
              <button
                type="button"
                onClick={() => { closeMenu(); signOut(); }}
                className="tn-menu-link"
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit' }}
              >
                <LogOut size={18} style={{ flexShrink: 0 }} />
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}
      {installSteps && <InstallAppSheet onClose={() => setInstallSteps(false)} />}
    </>
  );
};

export default TopNavbar;
