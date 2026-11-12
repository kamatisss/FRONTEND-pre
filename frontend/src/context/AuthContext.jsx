import { createContext, useState, useEffect, useEffectEvent, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { disablePush } from '../services/push';
import { clearCrewOffline } from '../crew/outbox';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL as API_ROOT } from '../config';

const AuthContext = createContext();

// The server ended this login (jwt_session.py): api.js fires this event on a 401 "session_ended"
const SESSION_ENDED_EVENT = 'auth:session-ended';   // same name in services/api.js
const SIGN_IN_NOTICE_KEY = 'sign_in_notice';         // read once by Login.jsx
const SESSION_ENDED = 'You were signed out because your account was signed out on all devices or its password was changed. Please sign in again.';

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() => 
    localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null
  );
  const [user, setUser] = useState(() => 
    localStorage.getItem('authTokens') ? jwtDecode(localStorage.getItem('authTokens')) : null
  );
  // Only wait (render nothing) when there is a saved session to refresh first
  const [loading, setLoading] = useState(() => !!localStorage.getItem('authTokens'));

  const navigate = useNavigate();

  /**
   * loginUser — Authenticates with Django JWT backend.
   * @param {string} username
   * @param {string} password
   * @param {string|null} redirectPath  – The intended destination before being redirected to login.
   *                                      If null, falls back to the role-based dashboard.
   */
  const loginUser = async (username, password, redirectPath = null) => {
    const response = await fetch(`${API_ROOT}/token/`, {
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
      } else if (redirectPath && !decodedUser.is_superuser && !decodedUser.is_staff
                 && redirectPath.startsWith('/') && !redirectPath.startsWith('/login')) {
        // Customers go back to the page that sent them to sign in (e.g. /shop)
        navigate(redirectPath, { replace: true });
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
  const clearSession = () => {
    disablePush().catch(() => {});   // still signed in for this request; then local tokens go
    setAuthTokens(null);
    setUser(null);
    localStorage.removeItem('authTokens');
    clearCrewOffline();   // saved jobs and unsent actions belong to this person only
  };
  const logoutUser = () => {
    clearSession();
    navigate('/', { replace: true });
  };
  // "Sign out everywhere" (or a password change) on another device ended this login: say so on the
  // sign-in page instead of dropping the person on the home page without a word (backend jwt_session.py)
  const endSession = () => {
    // Through sessionStorage: the protected page's own redirect to /login wins the race against this
    // navigate and would drop a navigation-state message (Login.jsx reads and clears it)
    try { sessionStorage.setItem(SIGN_IN_NOTICE_KEY, SESSION_ENDED); } catch { /* the plain sign-in page still shows */ }
    clearSession();
    navigate('/login', { replace: true });
  };
  const onSessionEnded = useEffectEvent(() => { if (authTokens) endSession(); });
  useEffect(() => {
    const listener = () => onSessionEnded();
    window.addEventListener(SESSION_ENDED_EVENT, listener);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, listener);
  }, []);

  /**
   * updateToken — Silently refreshes the access token using the refresh token.
   * Called on mount and every 4 minutes while authenticated.
   */
  const updateToken = async () => {
    if (!authTokens?.refresh) {
      // Nothing to refresh. (Can't be waiting here: loading starts true only with a saved
      // session, and the finish below always clears it.) Still clear it after a tick, never
      // synchronously inside the effect.
      if (loading) Promise.resolve().then(() => setLoading(false));
      return;
    }

    try {
      const response = await fetch(`${API_ROOT}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: authTokens.refresh })
      });

      const data = await response.json();

      if (response.status === 200) {
        setAuthTokens(data);
        setUser(jwtDecode(data.access));
        localStorage.setItem('authTokens', JSON.stringify(data));
      } else if (response.status === 401 && /signed out/i.test(data?.detail || '')) {
        endSession();   // signed out everywhere / password changed elsewhere
      } else {
        // Refresh token is expired or invalid — force logout
        logoutUser();
      }
    } catch {
      logoutUser();
    }

    if (loading) setLoading(false);
  };

  // Effect event: the interval always calls the latest updateToken (fresh tokens) without
  // being reset on every render
  const refreshToken = useEffectEvent(() => updateToken());
  useEffect(() => {
    if (loading) {
      refreshToken();
    }

    // Refresh the access token every 4 minutes (access tokens expire after 1 day per settings,
    // but silent refresh keeps the UX seamless)
    const fourMinutes = 1000 * 60 * 4;
    const interval = setInterval(() => {
      if (authTokens) {
        refreshToken();
      }
    }, fourMinutes);

    return () => clearInterval(interval);
  }, [authTokens, loading]);

  const loginUserSilent = async (username, password) => {
    const response = await fetch(`${API_ROOT}/token/`, {
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

  // My account: a name / email / password change comes back with fresh tokens (the app reads the
  // name and email from the token, so the header updates at once)
  const applyTokens = (data) => {
    if (!data?.access) return;
    setAuthTokens(data);
    setUser(jwtDecode(data.access));
    localStorage.setItem('authTokens', JSON.stringify(data));
  };

  const contextData = {
    user,
    authTokens,
    loginUser,
    loginUserSilent,
    logoutUser,
    applyTokens,
  };

  return (
    <AuthContext.Provider value={contextData}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
};
