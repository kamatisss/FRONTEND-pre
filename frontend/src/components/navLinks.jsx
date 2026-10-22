import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Paintbrush, Calendar, Package, Clock, Layers, Users, Banknote, ScrollText, Building2, BarChart3,
  Image as ImageIcon, MessageSquare, Calculator, Sparkles, ShoppingBag, Archive, Home, CalendarPlus, Truck, Sun, Briefcase, UserRound,
} from 'lucide-react';

// Customer navigation. `primary` links sit in the top bar on desktop; all of them
// appear in the phone menu.
export const customerLinks = [
  { to: '/user-dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { to: '/ai-designer', label: 'Design with AI', icon: Sparkles, primary: true },
  { to: '/studio', label: 'My 3D Studio', icon: Home },
  { to: '/shop', label: 'Shop', icon: ShoppingBag, primary: true },
  { to: '/book-service', label: 'Book a Service', icon: CalendarPlus },
  { to: '/my-bookings', label: 'My Bookings', icon: Calendar, primary: true },
  { to: '/my-orders', label: 'Order History', icon: Archive, primary: true },
];

// Operational (admin / staff) navigation: the sidebar on desktop, the drawer on phones.
export function useStaffLinks(user) {
  const location = useLocation();
  const isAdmin = user?.is_superuser;
  const tab = new URLSearchParams(location.search).get('tab') || 'overview';
  const on = (path) => location.pathname === path;
  const staffTab = (t) => on('/staff-dashboard') && tab === t;

  // Field crew only see their own screens (same tabs as the crew bottom bar)
  if (user?.staff_role === 'FIELD_CREW') {
    const crewTab = (t) => on('/staff-dashboard') && (new URLSearchParams(location.search).get('tab') || 'home') === t;
    return [
      { label: 'Today', icon: Sun, to: '/staff-dashboard?tab=home', active: crewTab('home') },
      { label: 'Jobs', icon: Briefcase, to: '/staff-dashboard?tab=projects', active: crewTab('projects') },
      { label: 'Deliveries', icon: Truck, to: '/staff-dashboard?tab=deliveries', active: crewTab('deliveries') },
      { label: 'Me', icon: UserRound, to: '/staff-dashboard?tab=me', active: crewTab('me') || on('/staff-attendance') },
    ];
  }

  return [
    { label: isAdmin ? 'Business overview' : 'Overview / Dashboard', icon: LayoutDashboard, to: isAdmin ? '/admin-dashboard' : '/staff-dashboard?tab=overview',
      active: on('/admin-dashboard') || staffTab('overview') },
    { label: 'Design Queue', icon: Paintbrush, to: '/staff-dashboard?tab=designs', active: staffTab('designs') },
    { label: 'Appointments', icon: Calendar, to: '/staff-dashboard?tab=bookings', active: staffTab('bookings') },
    { label: 'Order Fulfillment', icon: Package, to: '/staff-dashboard?tab=orders', active: staffTab('orders') },
    ...(user?.staff_role !== 'FIELD_CREW' ? [
      { label: 'Cash from Crew', icon: Banknote, to: '/staff-dashboard?tab=cash', active: staffTab('cash') },
    ] : []),
    { label: 'Attendance Tracking', icon: Clock, to: isAdmin ? '/admin-attendance' : '/staff-attendance',
      active: on('/admin-attendance') || on('/staff-attendance') },
    { label: 'Inventory Management', icon: Layers, to: '/inventory', active: on('/inventory') },
    // Office admins & admins curate the public Project Hub
    ...(user?.staff_role !== 'FIELD_CREW' ? [
      { label: 'Project Portfolio', icon: ImageIcon, to: '/portfolio-manager', active: on('/portfolio-manager') },
      { label: 'Customer Reviews', icon: MessageSquare, to: '/review-moderation', active: on('/review-moderation') },
      { label: 'Pricing', icon: Calculator, to: '/pricing-settings', active: on('/pricing-settings') },
    ] : []),
    ...(isAdmin ? [
      { label: 'User Accounts', icon: Users, to: '/manage-users', active: on('/manage-users') },
      { label: 'Reports', icon: BarChart3, to: '/admin-reports', active: on('/admin-reports') },
      { label: 'Activity Log', icon: ScrollText, to: '/admin-activity', active: on('/admin-activity') },
      { label: 'Business Profile', icon: Building2, to: '/admin-settings', active: on('/admin-settings') },
    ] : []),
  ];
}
