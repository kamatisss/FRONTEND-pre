import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useAuth();

    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    let userRole = 'user';
    if (user.is_superuser) {
        userRole = 'admin';
    } else if (user.is_staff) {
        userRole = 'staff';
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        if (userRole === 'admin') return <Navigate to="/admin-dashboard" replace />;
        if (userRole === 'staff') return <Navigate to="/staff-dashboard" replace />;
        return <Navigate to="/user-dashboard" replace />;
    }

    return children;
};

export default RoleProtectedRoute;
