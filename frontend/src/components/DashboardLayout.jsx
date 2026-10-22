import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import { useAuth } from '../context/AuthContext';
import { useStaffLinks } from './navLinks';
import { LogOut } from 'lucide-react';

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
    // The 3D Studio runs edge-to-edge on phones
    const isStudioRoute = location.pathname === '/studio';

    // Define the operational routes where the sidebar should be rendered
    const operationalRoutes = [
        '/admin-dashboard',
        '/staff-dashboard',
        '/inventory',
        '/manage-users',
        '/manage-availability',
        '/admin-settings',
        '/admin-activity',
        '/admin-reports',
        '/view-bookings',
        '/staff-attendance',
        '/admin-attendance',
        '/portfolio-manager',
        '/review-moderation',
        '/pricing-settings'
    ];
    const isOperationalRoute = operationalRoutes.some(route => location.pathname.startsWith(route));

    const links = useStaffLinks(user);

    // Phones: no sidebar (the top bar's menu button opens the same links in a drawer).
    // Tablets: an icon rail. Desktop: the full sidebar.
    return (
        <div className="flex flex-col" style={isAIDesignerRoute
            ? { minHeight: '100dvh' }
            : { height: '100dvh', overflow: 'hidden' }
        }>
            <TopNavbar />
            <div className={isAIDesignerRoute ? 'flex flex-1 bg-slate-50' : 'flex flex-1 min-h-0 overflow-hidden bg-slate-50'}>
                {isOperational && isOperationalRoute && (
                    <aside className="hidden md:flex md:w-20 lg:w-64 flex-shrink-0 bg-white border-r border-slate-100 flex-col justify-between overflow-y-auto">
                        {/* TOP SECTION */}
                        <div className="flex flex-col gap-2 p-3 lg:p-6 overflow-y-auto flex-1">
                            <div className="pb-4 border-b border-slate-100 mb-4 shrink-0 flex items-center justify-center lg:justify-start">
                                <span className="hidden lg:inline text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                                    {isAdmin ? 'Admin Control Tower' : 'Staff Control Center'}
                                </span>
                                <span className="inline lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    {isAdmin ? 'ADM' : 'STF'}
                                </span>
                            </div>

                            <nav className="flex flex-col gap-y-2">
                                {links.map(({ label, icon, to, active }) => { const Icon = icon; return (
                                    <Link
                                        key={label}
                                        to={to}
                                        title={label}
                                        className={active
                                            ? 'bg-emerald-50 text-emerald-700 font-semibold rounded-xl px-4 py-3 flex items-center justify-center lg:justify-start gap-3 w-full transition-all duration-200 no-underline'
                                            : 'text-slate-600 font-medium rounded-xl px-4 py-3 flex items-center justify-center lg:justify-start gap-3 w-full hover:bg-slate-50 lg:hover:translate-x-1 hover:text-slate-900 transition-all duration-200 ease-in-out no-underline'
                                        }
                                    >
                                        <span className={active ? 'text-emerald-700 shrink-0' : 'text-slate-400 shrink-0'}>
                                            <Icon size={18} />
                                        </span>
                                        <span className="hidden lg:inline text-sm truncate">{label}</span>
                                    </Link>
                                ); })}
                            </nav>
                        </div>

                        {/* BOTTOM PROFILE FOOTER SECTION */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 w-full shrink-0">
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 w-full">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        <Avatar user={user} />
                                        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                                    </div>
                                    <div className="hidden lg:flex flex-col min-w-0 justify-center">
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
                    : `flex-1 min-w-0 overflow-y-auto ${isStudioRoute ? 'p-0 md:p-6' : 'p-4 md:p-6'} bg-slate-50`
                }>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
