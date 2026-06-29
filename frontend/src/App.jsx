import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AuthProvider } from "./context/AuthContext";
import { DesignProvider } from "./context/DesignContext";
import GardenDesigner from "./components/GardenDesigner";
import AIGardenDesigner from "./components/AIGardenDesigner";
import Login from "./components/Login";
import Register from "./components/Register";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import AdminDashboard from "./components/AdminDashboard";
import ManageUsers from "./components/ManageUsers";
import InventoryDashboard from "./components/InventoryDashboard";
import StaffDashboard from "./components/StaffDashboard";
import BookingManagement from "./components/BookingManagement";
import DashboardLayout from "./components/DashboardLayout";
import ManageAvailability from "./components/ManageAvailability";
import BookService from "./components/BookService";
import MyBookings from "./components/MyBookings";
import UserOrders from "./components/UserOrders";
import OrderSuccess from "./components/OrderSuccess";
import LandingPage from "./components/LandingPage";
import ForgotPassword from "./components/ForgotPassword";
import StaffAttendance from "./components/StaffAttendance";
import AdminAttendance from "./components/AdminAttendance";
import UserDashboard from "./components/UserDashboard";
import AdminSettings from "./components/AdminSettings";
import { CartProvider } from "./context/CartContext";
import Shop from "./components/Shop";
import "./App.css";

function AIDesignerRoute() {
  const { user } = useAuth();
  if (user) {
    return (
      <DashboardLayout>
        <AIGardenDesigner />
      </DashboardLayout>
    );
  }
  return <AIGardenDesigner />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <DesignProvider>
            <div className="app-root">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

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

              {/* AI Designer — public, guest-accessible */}
              <Route path="/ai-designer" element={<AIDesignerRoute />} />

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
                  <RoleProtectedRoute allowedRoles={['staff']}>
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

              {/* Admin Settings */}
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

              {/* View Bookings (Admin/Staff) */}
              <Route
                path="/view-bookings"
                element={
                  <RoleProtectedRoute allowedRoles={['admin', 'staff']}>
                    <DashboardLayout>
                      <BookingManagement />
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
            </div>
          </DesignProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;