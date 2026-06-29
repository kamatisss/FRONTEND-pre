import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home,
  Calendar,
  CalendarDays,
  Archive,
  LayoutDashboard,
  CalendarPlus,
  LogOut,
  Leaf,
  User,
  Settings,
  ChevronDown,
  Clock,
  Sparkles,
} from 'lucide-react';

/* ─── Avatar: shows first letter of first name, with green gradient ─── */
function Avatar({ user }) {
  const letter = (user?.first_name || user?.username || '?')[0].toUpperCase();

  // Deterministic hue from username so it's consistent per user
  const hues = [158, 172, 142, 195, 120, 165];
  const hue  = hues[(user?.username?.charCodeAt(0) || 0) % hues.length];

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: `linear-gradient(135deg, hsl(${hue},72%,38%) 0%, hsl(${hue + 20},80%,52%) 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 15,
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

/* ─── Dropdown menu for the profile section ─── */
function ProfileDropdown({ user, logoutUser, onClose }) {
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user?.username;

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 10px)',
      right: 0,
      width: 224,
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
      overflow: 'hidden',
      zIndex: 200,
      animation: 'tn-dropdown-in 0.18s cubic-bezier(0.22,1,0.36,1)',
    }}>
      {/* Profile header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid #f1f5f9',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar user={user} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {displayName}
            </div>
            <div style={{
              fontSize: 12,
              color: '#64748b',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.email || '@' + user?.username}
            </div>
          </div>
        </div>
        {(user?.is_staff || user?.is_superuser) && (
          <div style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 100,
            background: '#dcfce7',
            border: '1px solid #bbf7d0',
            fontSize: 11,
            fontWeight: 700,
            color: '#16a34a',
            letterSpacing: '0.3px',
          }}>
            {user?.is_superuser ? '⚡ Admin' : '🛡 Staff'}
          </div>
        )}
      </div>

      {/* Menu items */}
      <div style={{ padding: '8px 0' }}>
        <DropItem icon={<User size={15} />} label="My Profile" onClick={onClose} />
        <DropItem icon={<Settings size={15} />} label="Settings" onClick={onClose} />
      </div>

      {/* Logout */}
      <div style={{ padding: '0 0 8px', borderTop: '1px solid #f1f5f9' }}>
        <button
          onClick={() => { logoutUser(); onClose(); }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: '#ef4444',
            textAlign: 'left',
            marginTop: 4,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}

function DropItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: '#334155',
        textAlign: 'left',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#10b981'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#334155'; }}
    >
      <span style={{ color: '#94a3b8' }}>{icon}</span>
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN TOPNAVBAR COMPONENT
══════════════════════════════════════════════════════════════ */
const TopNavbar = () => {
  const { user, logoutUser } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

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

  if (!user) return null;

  const isAdminOrStaff = user.is_staff || user.is_superuser;

  const adminLinks = [
    { to: user.is_superuser ? '/admin-dashboard' : '/staff-dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    ...(user.is_superuser ? [{ to: '/manage-users', icon: <User size={16} />, label: 'Manage Users' }] : []),
    { to: '/manage-availability', icon: <CalendarDays size={16} />, label: 'Manage Availability' },
    { to: '/view-bookings',       icon: <Calendar size={16} />,     label: 'View Bookings' },
    { to: '/inventory',           icon: <Archive size={16} />,       label: 'Inventory' },
    { to: user.is_superuser ? '/admin-attendance' : '/staff-attendance', icon: <Clock size={16} />, label: 'Attendance' },
  ];

  const userLinks = [
    { to: '/user-dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { to: '/studio',         icon: <Home size={16} />,             label: 'My 3D Studio' },
    { to: '/ai-designer',    icon: <Sparkles size={16} />,         label: 'AI Designer' },
    { to: '/book-service',   icon: <CalendarPlus size={16} />,     label: 'Book a Service' },
    { to: '/my-bookings',    icon: <Calendar size={16} />,          label: 'My Bookings' },
    { to: '/my-orders',      icon: <Archive size={16} />,           label: 'My Orders' },
  ];

  const links = isAdminOrStaff ? adminLinks : userLinks;

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

        @media (max-width: 900px) {
          .tn-label { display: none !important; }
          .tn-nav-link { padding: 8px 10px; }
          .tn-username { display: none !important; }
        }
        @media (max-width: 600px) {
          .tn-brand-name { display: none !important; }
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
        padding: '0 20px',
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
          <span className="tn-brand-name" style={{
            fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px',
          }}>
            Garden Studio
          </span>
        </Link>

        {/* Center-Right Navigation Links */}
        {!isAdminOrStaff && (
          <div className="flex items-center gap-6 ml-auto mr-8">
            <NavLink 
              to="/user-dashboard" 
              className={({ isActive }) => 
                `text-sm ${isActive ? 'font-semibold text-emerald-600' : 'font-medium text-slate-600'} hover:text-emerald-600 transition-colors duration-150 no-underline`
              }
            >
              Dashboard
            </NavLink>
            <NavLink 
              to="/ai-designer" 
              className={({ isActive }) => 
                `text-sm ${isActive ? 'font-semibold text-emerald-600' : 'font-medium text-slate-600'} hover:text-emerald-600 transition-colors duration-150 no-underline`
              }
            >
              Design with AI
            </NavLink>
            <NavLink 
              to="/shop" 
              className={({ isActive }) => 
                `text-sm ${isActive ? 'font-semibold text-emerald-600' : 'font-medium text-slate-600'} hover:text-emerald-600 transition-colors duration-150 no-underline`
              }
            >
              Shop
            </NavLink>
            <NavLink 
              to="/my-bookings" 
              className={({ isActive }) => 
                `text-sm ${isActive ? 'font-semibold text-emerald-600' : 'font-medium text-slate-600'} hover:text-emerald-600 transition-colors duration-150 no-underline`
              }
            >
              My Bookings
            </NavLink>
            <NavLink 
              to="/my-orders" 
              className={({ isActive }) => 
                `text-sm ${isActive ? 'font-semibold text-emerald-600' : 'font-medium text-slate-600'} hover:text-emerald-600 transition-colors duration-150 no-underline`
              }
            >
              Order History
            </NavLink>
          </div>
        )}

        {/* Far Right Profile Dropdown */}
        <div ref={dropRef} style={{ position: 'relative', marginLeft: !isAdminOrStaff ? '0' : 'auto' }}>
          <button
            onClick={() => setDropOpen(!dropOpen)}
            className="tn-profile-btn"
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
              logoutUser={logoutUser}
              onClose={() => setDropOpen(false)}
            />
          )}
        </div>

      </nav>
    </>
  );
};

export default TopNavbar;
