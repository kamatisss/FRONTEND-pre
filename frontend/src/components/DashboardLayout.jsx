import React from 'react';
import { useLocation } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import { useAuth } from '../context/AuthContext';
import { useStaffLinks } from './navLinks';
import StaffNav from './StaffNav';

const DashboardLayout = ({ children }) => {
    const { user } = useAuth();
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
        '/pricing-settings',
        '/manage-projects',
        '/account',   // My account: staff keep their sidebar (customers never get one)
    ];
    const isOperationalRoute = operationalRoutes.some(route => location.pathname.startsWith(route));

    const links = useStaffLinks(user);

    // Phones: no sidebar (the top bar's menu button opens the same links in a drawer).
    // Tablets: an icon rail. Desktop: the full sidebar.
    return (
        // Phones scroll the page itself: natural momentum, the address bar hides, the keyboard can't
        // trap a field, and the top bar stays pinned (sticky). From tablets up the sidebar stays put and
        // only <main> scrolls. The 3D Studio is always a fixed full screen.
        <div className={isAIDesignerRoute ? 'flex flex-col min-h-dvh'
            : isStudioRoute ? 'flex flex-col h-dvh overflow-hidden'
            : 'flex flex-col min-h-dvh md:h-dvh md:overflow-hidden'}>
            <TopNavbar />
            <div className={isAIDesignerRoute ? 'flex flex-1 bg-slate-50'
                : isStudioRoute ? 'flex flex-1 min-h-0 overflow-hidden bg-slate-50'
                : 'flex flex-1 bg-slate-50 md:min-h-0 md:overflow-hidden'}>
                {isOperational && isOperationalRoute && (
                    // Navigation only: the account (name, My account, Log out) lives in the top bar's profile
                    // menu, the one place every user, on every screen size, finds it.
                    <aside className="hidden md:flex md:w-20 lg:w-64 flex-shrink-0 bg-white border-r border-slate-100 flex-col overflow-y-auto">
                        <div className="px-3 lg:px-4 pt-5 pb-6">
                            <p className="m-0 mb-3 px-3 hidden lg:block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                                {isAdmin ? 'Admin workspace' : 'Staff workspace'}
                            </p>
                            {/* Desktop: grouped, folding sections. Tablet: every icon, groups split by lines */}
                            <div className="hidden lg:block"><StaffNav links={links} variant="sidebar" /></div>
                            <div className="lg:hidden"><StaffNav links={links} variant="rail" /></div>
                        </div>
                    </aside>
                )}

                <main className={isAIDesignerRoute
                    ? 'flex-1 min-w-0 bg-slate-50'
                    : isStudioRoute ? 'flex-1 min-w-0 overflow-y-auto p-0 md:p-6 bg-slate-50'
                    : 'flex-1 min-w-0 md:overflow-y-auto p-4 md:p-6 bg-slate-50'
                }>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
