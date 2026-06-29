import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Calendar, CalendarDays, Archive, LayoutDashboard, CalendarPlus, LogOut, Clock, ShoppingBag } from 'lucide-react';

const NavigationBar = () => {
    const { user, logoutUser } = useAuth();

    if (!user) return null;

    const isAdminOrStaff = user.is_staff || user.is_superuser;

    // Helper for active link styles
    const navLinkClass = ({ isActive }) =>
      `flex items-center px-4 py-3 mb-2 rounded-xl text-sm font-medium transition-all duration-300 ${
        isActive
          ? 'bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
          : 'text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-1'
      }`;

    return (
        <nav className="w-64 h-screen bg-slate-900/80 backdrop-blur-md border-r border-white/10 p-6 flex flex-col font-sans relative z-50">
            <div className="mb-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
                    <span className="text-emerald-400">🌻</span> Garden Studio
                </h2>
                <p className="text-xs text-slate-400 font-medium">Logged in as <span className="text-emerald-300">{user.username}</span></p>
            </div>

            <ul className="flex-1 space-y-1">
                {isAdminOrStaff ? (
                    <>
                        <li>
                            <NavLink to={user.is_superuser ? "/admin-dashboard" : "/staff-dashboard"} className={navLinkClass}>
                                <LayoutDashboard size={18} className="mr-3" />
                                Dashboard
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/manage-availability" className={navLinkClass}>
                                <CalendarDays size={18} className="mr-3" />
                                Manage Availability
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/view-bookings" className={navLinkClass}>
                                <Calendar size={18} className="mr-3" />
                                View Bookings
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/inventory" className={navLinkClass}>
                                <Archive size={18} className="mr-3" />
                                Inventory
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to={user.is_superuser ? "/admin-attendance" : "/staff-attendance"} className={navLinkClass}>
                                <Clock size={18} className="mr-3" />
                                Attendance
                            </NavLink>
                        </li>
                    </>
                ) : (
                    <>
                        <li>
                            <NavLink to="/user-dashboard" className={navLinkClass}>
                                <LayoutDashboard size={18} className="mr-3" />
                                Dashboard
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/studio" className={navLinkClass}>
                                <Home size={18} className="mr-3" />
                                My 3D Studio
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/shop" className={navLinkClass}>
                                <ShoppingBag size={18} className="mr-3" />
                                Shop
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/my-bookings" className={navLinkClass}>
                                <Calendar size={18} className="mr-3" />
                                My Bookings
                            </NavLink>
                        </li>
                    </>
                )}
            </ul>

            <button
                onClick={logoutUser}
                className="mt-auto flex items-center justify-center w-full px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl text-sm font-bold transition-all duration-300 border border-red-500/20 shadow-sm"
            >
                <LogOut size={16} className="mr-2" />
                Logout
            </button>
        </nav>
    );
};

export default NavigationBar;
