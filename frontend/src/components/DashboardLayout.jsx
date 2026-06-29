import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Paintbrush, 
  Calendar, 
  Package, 
  Clock, 
  Layers, 
  Users, 
  Settings, 
  LogOut 
} from 'lucide-react';

function Avatar({ user }) {
  const letter = (user?.first_name || user?.username || '?')[0].toUpperCase();
  const hues = [158, 172, 142, 195, 120, 165];
  const hue  = hues[(user?.username?.charCodeAt(0) || 0) % hues.length];
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: `linear-gradient(135deg, hsl(${hue},72%,38%) 0%, hsl(${hue + 20},80%,52%) 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 13, color: 'white', flexShrink: 0,
      boxShadow: `0 0 0 2px white, 0 0 0 3px hsl(${hue},72%,48%)`,
      letterSpacing: '-0.5px', userSelect: 'none',
    }}>
      {letter}
    </div>
  );
}

const DashboardLayout = ({ children }) => {
    const { user, logoutUser } = useAuth();
    const location = useLocation();
    
    // Check if the current user is admin (is_superuser) or staff (is_staff)
    const isAdmin = user?.is_superuser;
    const isStaff = user?.is_staff;
    const isOperational = isAdmin || isStaff;
    
    const isAIDesignerRoute = location.pathname === '/ai-designer';

    // Define the operational routes where the sidebar should be rendered
    const operationalRoutes = [
        '/admin-dashboard',
        '/staff-dashboard',
        '/inventory',
        '/manage-users',
        '/manage-availability',
        '/admin-settings',
        '/view-bookings',
        '/staff-attendance',
        '/admin-attendance'
    ];
    const isOperationalRoute = operationalRoutes.some(route => location.pathname.startsWith(route));

    // Construct sidebar links based on location parameters & active states
    const queryParams = new URLSearchParams(location.search);
    const activeTab = queryParams.get('tab') || 'overview';

    const links = [
        {
            name: 'Overview / Dashboard',
            icon: <LayoutDashboard size={18} />,
            to: isAdmin ? '/admin-dashboard' : '/staff-dashboard?tab=overview',
            active: location.pathname === '/admin-dashboard' || (location.pathname === '/staff-dashboard' && activeTab === 'overview')
        },
        {
            name: 'Design Queue',
            icon: <Paintbrush size={18} />,
            to: '/staff-dashboard?tab=designs',
            active: location.pathname === '/staff-dashboard' && activeTab === 'designs'
        },
        {
            name: 'Appointments',
            icon: <Calendar size={18} />,
            to: '/staff-dashboard?tab=bookings',
            active: location.pathname === '/staff-dashboard' && activeTab === 'bookings'
        },
        {
            name: 'Order Fulfillment',
            icon: <Package size={18} />,
            to: '/staff-dashboard?tab=orders',
            active: location.pathname === '/staff-dashboard' && activeTab === 'orders'
        },
        {
            name: 'Attendance Tracking',
            icon: <Clock size={18} />,
            to: isAdmin ? '/admin-attendance' : '/staff-attendance',
            active: location.pathname === '/admin-attendance' || location.pathname === '/staff-attendance'
        },
        {
            name: 'Inventory Management',
            icon: <Layers size={18} />,
            to: '/inventory',
            active: location.pathname === '/inventory'
        },
        // Admin-only links
        ...(isAdmin ? [
            {
                name: 'User Accounts',
                icon: <Users size={18} />,
                to: '/manage-users',
                active: location.pathname === '/manage-users'
            },
            {
                name: 'Global Settings',
                icon: <Settings size={18} />,
                to: '/admin-settings',
                active: location.pathname === '/admin-settings'
            }
        ] : [])
    ];

    return (
        <div style={isAIDesignerRoute
            ? { display: 'flex', flexDirection: 'column', minHeight: '100vh' }
            : { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }
        }>
            <TopNavbar />
            <div className={isAIDesignerRoute ? 'flex flex-1 bg-slate-50' : 'flex flex-1 overflow-hidden bg-slate-50'}>
                {isOperational && isOperationalRoute && (
                    <aside className="w-16 md:w-64 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col justify-between h-[calc(100vh-56px)] sticky top-14 overflow-y-auto">
                        {/* TOP SECTION */}
                        <div className="flex flex-col gap-2 p-3 md:p-6 overflow-y-auto flex-1">
                            <div className="pb-4 border-b border-slate-100 mb-4 shrink-0 flex items-center justify-center md:justify-start">
                                <span className="hidden md:inline text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                                    {isAdmin ? 'Admin Control Tower' : 'Staff Control Center'}
                                </span>
                                <span className="inline md:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    {isAdmin ? 'ADM' : 'STF'}
                                </span>
                            </div>
                            
                            <nav className="flex flex-col gap-y-2">
                                {links.map((link) => (
                                    <Link 
                                        key={link.name}
                                        to={link.to} 
                                        className={link.active
                                            ? 'bg-emerald-50 text-emerald-700 font-semibold rounded-xl px-4 py-3 flex items-center justify-center md:justify-start gap-3 w-full transition-all duration-200 no-underline'
                                            : 'text-slate-600 font-medium rounded-xl px-4 py-3 flex items-center justify-center md:justify-start gap-3 w-full hover:bg-slate-50 hover:translate-x-1 hover:text-slate-900 transition-all duration-200 ease-in-out no-underline'
                                        }
                                    >
                                        <span className={link.active ? 'text-emerald-700 shrink-0' : 'text-slate-400 shrink-0'}>
                                            {link.icon}
                                        </span>
                                        <span className="hidden md:inline text-sm truncate">{link.name}</span>
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        {/* BOTTOM PROFILE FOOTER SECTION */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 w-full shrink-0">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        <Avatar user={user} />
                                        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                                    </div>
                                    <div className="hidden md:flex flex-col min-w-0 justify-center">
                                        <span className="text-sm font-semibold text-slate-800 truncate">
                                            {isAdmin ? 'Admin' : 'Staff'} {user?.first_name || user?.username || 'Member'}
                                        </span>
                                        <span className="text-xs text-slate-500 max-w-[140px] truncate">
                                            {user?.email || '@' + user?.username}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={logoutUser}
                                    title="Log Out"
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer shrink-0 flex items-center justify-center"
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>
                    </aside>
                )}
                
                <main className={isAIDesignerRoute
                    ? 'flex-1 min-w-0 bg-slate-50'
                    : 'flex-1 min-w-0 h-[calc(100vh-56px)] overflow-y-auto p-6 bg-slate-50'
                }>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
