import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AuthProvider } from "./context/AuthContext";
import { DesignProvider } from "./context/DesignContext";
import Login from "./components/Login";
import Register from "./components/Register";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import LandingPage from "./components/LandingPage";
import ForgotPassword from "./components/ForgotPassword";
import ScrollManager from "./components/ui/ScrollManager";
import { CartProvider } from "./context/CartContext";
import "./App.css";

// Pages load on demand: the landing page stays light, and three.js / the dashboards
// only download when someone opens them.
const GardenDesigner = lazy(() => import("./components/GardenDesigner"));
const AIGardenDesigner = lazy(() => import("./components/AIGardenDesigner"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const ManageUsers = lazy(() => import("./components/ManageUsers"));
const InventoryDashboard = lazy(() => import("./components/InventoryDashboard"));
const StaffDashboard = lazy(() => import("./components/StaffDashboard"));
const ManageAvailability = lazy(() => import("./components/ManageAvailability"));
const BookService = lazy(() => import("./components/BookService"));
const MyBookings = lazy(() => import("./components/MyBookings"));
const UserOrders = lazy(() => import("./components/UserOrders"));
const OrderSuccess = lazy(() => import("./components/OrderSuccess"));
const ProjectPayment = lazy(() => import("./components/ProjectPayment"));
const StaffAttendance = lazy(() => import("./components/StaffAttendance"));
const AdminAttendance = lazy(() => import("./components/AdminAttendance"));
const UserDashboard = lazy(() => import("./components/UserDashboard"));
const AdminSettings = lazy(() => import("./components/AdminSettings"));
const ActivityLog = lazy(() => import("./components/ActivityLog"));
const Reports = lazy(() => import("./components/Reports"));
const Shop = lazy(() => import("./components/Shop"));
const PortfolioManager = lazy(() => import("./components/PortfolioManager"));
const ReviewModeration = lazy(() => import("./components/ReviewModeration"));
const PricingSettings = lazy(() => import("./components/PricingSettings"));
const TrackRecord = lazy(() => import("./components/TrackRecord"));
const TryStudio = lazy(() => import("./components/TryStudio"));
const AIDesignerGate = lazy(() => import("./components/AIDesignerGate"));
const ProjectGallery = lazy(() => import("./components/ProjectHub").then(m => ({ default: m.ProjectGallery })));
const ProjectDetail = lazy(() => import("./components/ProjectHub").then(m => ({ default: m.ProjectDetail })));

function PageLoading() {
  return (
    // Light, full-screen: App.css paints the body dark navy, which flashes between light pages
    <div style={{ position: "fixed", inset: 0, zIndex: 1, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "4px solid #10b981", borderTopColor: "transparent", borderRadius: "50%", animation: "app-spin 0.9s linear infinite" }} />
      <style>{`@keyframes app-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// The AI runs on a paid Gemini quota, so it needs an account; visitors get an
// explainer page (and the free 3D Studio) instead.
function AIDesignerRoute() {
  const { user } = useAuth();
  if (user) {
    return (
      <DashboardLayout>
        <AIGardenDesigner />
      </DashboardLayout>
    );
  }
  return <AIDesignerGate />;
}

function App() {
  return (
    <Router>
      <ScrollManager />
      <AuthProvider>
        <CartProvider>
          <DesignProvider>
            <div className="app-root">
            <Suspense fallback={<PageLoading />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/pay/:token" element={<ProjectPayment />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              {/* The emailed reset link: /reset-password?uid=…&token=… */}
              <Route path="/reset-password" element={<ForgotPassword />} />

              {/* Project Hub — public portfolio of finished gardens */}
              <Route path="/projects" element={<ProjectGallery />} />
              <Route path="/projects/:slug" element={<ProjectDetail />} />
              <Route path="/track-record" element={<TrackRecord />} />

              {/* User Dashboard / Studio */}
              <Route
                path="/user-dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['user']}>
                    <DashboardLayout>
                      <UserDashboard />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={<Navigate to="/user-dashboard" replace />}
              />
              <Route
                path="/client-dashboard"
                element={<Navigate to="/user-dashboard" replace />}
              />

              {/* My 3D Studio */}
              <Route
                path="/studio"
                element={
                  <RoleProtectedRoute allowedRoles={['user', 'admin', 'staff']}>
                    <DashboardLayout>
                      <GardenDesigner />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* AI Designer — sign-in required (explainer page for visitors) */}
              <Route path="/ai-designer" element={<AIDesignerRoute />} />

              {/* Free 3D Studio — no account needed */}
              <Route path="/try-studio" element={<TryStudio />} />

              {/* Shop (User) */}
              <Route
                path="/shop"
                element={
                  <RoleProtectedRoute allowedRoles={['user']}>
                    <DashboardLayout>
                      <Shop />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Book Service (User) */}
              <Route
                path="/book-service"
                element={
                  <RoleProtectedRoute allowedRoles={['user']}>
                    <DashboardLayout>
                      <BookService />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* My Bookings (User) */}
              <Route
                path="/my-bookings"
                element={
                  <RoleProtectedRoute allowedRoles={['user']}>
                    <DashboardLayout>
                      <MyBookings />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* My Orders (User) */}
              <Route
                path="/my-orders"
                element={
                  <RoleProtectedRoute allowedRoles={['user']}>
                    <DashboardLayout>
                      <UserOrders />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Staff Dashboard */}
              <Route
                path="/staff-dashboard"
                element={
                  // The owner (admin) works the same Orders / Bookings / Designs queues as the office
                  <RoleProtectedRoute allowedRoles={['staff', 'admin']}>
                    <DashboardLayout>
                      <StaffDashboard />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Staff Attendance */}
              <Route
                path="/staff-attendance"
                element={
                  <RoleProtectedRoute allowedRoles={['staff']}>
                    <DashboardLayout>
                      <StaffAttendance />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Admin Attendance */}
              <Route
                path="/admin-attendance"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <DashboardLayout>
                      <AdminAttendance />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Manage Availability (Admin/Staff) */}
              <Route
                path="/manage-availability"
                element={
                  <RoleProtectedRoute allowedRoles={['admin', 'staff']}>
                    <DashboardLayout>
                      <ManageAvailability />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Admin Dashboard */}
              <Route
                path="/admin-dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <DashboardLayout>
                      <AdminDashboard />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Owner: money in, balances owed, crew output */}
              <Route
                path="/admin-reports"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <DashboardLayout>
                      <Reports />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Owner: who changed prices, money, roles and settings */}
              <Route
                path="/admin-activity"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <DashboardLayout>
                      <ActivityLog />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Owner: Business profile (name, contact details, socials) */}
              <Route
                path="/admin-settings"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <DashboardLayout>
                      <AdminSettings />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Manage Users (Admin) */}
              <Route
                path="/manage-users"
                element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <DashboardLayout>
                      <ManageUsers />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Old bookings table: merged into the staff Bookings tab (queues + week calendar) */}
              <Route path="/view-bookings" element={<Navigate to="/staff-dashboard?tab=bookings" replace />} />

              {/* Project Portfolio curation (Office Admin / Admin) */}
              <Route
                path="/portfolio-manager"
                element={
                  <RoleProtectedRoute allowedRoles={['admin', 'staff']}>
                    <DashboardLayout>
                      <PortfolioManager />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Rate card (Office Admin / Admin) */}
              <Route
                path="/pricing-settings"
                element={
                  <RoleProtectedRoute allowedRoles={['admin', 'staff']}>
                    <DashboardLayout>
                      <PricingSettings />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Customer review moderation (Office Admin / Admin) */}
              <Route
                path="/review-moderation"
                element={
                  <RoleProtectedRoute allowedRoles={['admin', 'staff']}>
                    <DashboardLayout>
                      <ReviewModeration />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Inventory Management (Admin/Staff) */}
              <Route
                path="/inventory"
                element={
                  <RoleProtectedRoute allowedRoles={['admin', 'staff']}>
                    <DashboardLayout>
                      <InventoryDashboard />
                    </DashboardLayout>
                  </RoleProtectedRoute>
                }
              />

              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />
            </Routes>
            </Suspense>
            </div>
          </DesignProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;