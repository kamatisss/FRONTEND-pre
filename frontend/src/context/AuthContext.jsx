import { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { disablePush } from '../services/push';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() => 
    localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null
  );
  const [user, setUser] = useState(() => 
    localStorage.getItem('authTokens') ? jwtDecode(localStorage.getItem('authTokens')) : null
  );
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  /**
   * loginUser — Authenticates with Django JWT backend.
   * @param {string} username
   * @param {string} password
   * @param {string|null} redirectPath  – The intended destination before being redirected to login.
   *                                      If null, falls back to the role-based dashboard.
   */
  const loginUser = async (username, password, redirectPath = null) => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.status === 200) {
      setAuthTokens(data);
      const decodedUser = jwtDecode(data.access);
      setUser(decodedUser);
      localStorage.setItem('authTokens', JSON.stringify(data));

      // Redirect strictly based on role to prevent Admins from getting stuck on client pages
      if (localStorage.getItem('pending_booking_context')) {
        navigate('/book-service', { replace: true });
      } else if (decodedUser.is_superuser) {
        navigate('/admin-dashboard', { replace: true });
      } else if (decodedUser.is_staff) {
        navigate('/staff-dashboard', { replace: true });
      } else {
        navigate('/user-dashboard', { replace: true });
      }
    } else {
      throw new Error(data.detail || 'Invalid credentials. Please try again.');
    }
  };

  /**
   * logoutUser — Clears all auth state and redirects to the landing page.
   * Using `replace: true` removes the protected page from history,
   * preventing the user from using the back button to return to it.
   */
  const logoutUser = () => {
    disablePush().catch(() => {});   // still signed in for this request; then local tokens go
    setAuthTokens(null);
    setUser(null);
    localStorage.removeItem('authTokens');
    navigate('/', { replace: true });
  };

  /**
   * updateToken — Silently refreshes the access token using the refresh token.
   * Called on mount and every 4 minutes while authenticated.
   */
  const updateToken = async () => {
    if (!authTokens?.refresh) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: authTokens.refresh })
      });

      const data = await response.json();

      if (response.status === 200) {
        setAuthTokens(data);
        setUser(jwtDecode(data.access));
        localStorage.setItem('authTokens', JSON.stringify(data));
      } else {
        // Refresh token is expired or invalid — force logout
        logoutUser();
      }
    } catch {
      logoutUser();
    }

    if (loading) setLoading(false);
  };

  useEffect(() => {
    if (loading) {
      updateToken();
    }

    // Refresh the access token every 4 minutes (access tokens expire after 1 day per settings,
    // but silent refresh keeps the UX seamless)
    const fourMinutes = 1000 * 60 * 4;
    const interval = setInterval(() => {
      if (authTokens) {
        updateToken();
      }
    }, fourMinutes);

    return () => clearInterval(interval);
  }, [authTokens, loading]);

  const loginUserSilent = async (username, password) => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (response.status === 200) {
      setAuthTokens(data);
      const decodedUser = jwtDecode(data.access);
      setUser(decodedUser);
      localStorage.setItem('authTokens', JSON.stringify(data));
      return decodedUser;
    } else {
      throw new Error(data.detail || 'Invalid credentials. Please try again.');
    }
  };

  const contextData = {
    user,
    authTokens,
    loginUser,
    loginUserSilent,
    logoutUser,
  };

  return (
    <AuthContext.Provider value={contextData}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
};
