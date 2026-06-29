import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { loginUser } = useAuth();
  const location      = useLocation();

  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const successMessage = location.state?.message || '';
  const from           = location.state?.from?.pathname || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginUser(username, password, from);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Left Side: Form Area */}
      <div style={{ flex: 1, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          
          <div style={{ marginBottom: '32px', textAlign: 'left' }}>
            <h1 style={{ color: '#1e293b', fontSize: '32px', fontWeight: '800', margin: '0 0 8px 0' }}>Welcome Back</h1>
            <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>Sign in to your Garden Design Studio</p>
            {from && (
              <p style={{ fontSize: '13px', color: '#10b981', marginTop: '8px', fontWeight: 600 }}>
                🔒 You'll be redirected after login
              </p>
            )}
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && !error && (
            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #34d399', color: '#047857', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
              <CheckCircle2 size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Username Input */}
            <div style={{ position: 'relative' }}>
              <User size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Password Input */}
            <div style={{ position: 'relative' }}>
              <Lock size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ width: '100%', padding: '14px 48px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Row: Remember Me + Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', marginTop: '-4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#64748b' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Remember me
              </label>
              <Link to="/forgot-password" style={{ fontSize: '14px', color: '#10b981', textDecoration: 'none', fontWeight: '500' }} onMouseEnter={(e) => e.target.style.textDecoration = 'underline'} onMouseLeave={(e) => e.target.style.textDecoration = 'none'}>
                Forgot password?
              </Link>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '8px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#10b981', textDecoration: 'none', fontWeight: '600' }} onMouseEnter={(e) => e.target.style.textDecoration = 'underline'} onMouseLeave={(e) => e.target.style.textDecoration = 'none'}>Sign up here</Link>
            </p>
          </div>

        </div>
      </div>

      {/* Right Side: Hero Image */}
      <div style={{ flex: 1, backgroundImage: 'url(/login-hero-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#f1f5f9', display: window.innerWidth > 768 ? 'block' : 'none' }}>
      </div>

    </div>
  );
}
