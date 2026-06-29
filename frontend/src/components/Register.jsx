import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Mail, AlertCircle, CheckCircle2, UserCircle } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.status === 201) {
        // Registration successful! Redirect to login page
        navigate('/login', { state: { message: 'Registration successful! Please sign in.' } });
      } else {
        // Server returned validation errors
        const errorMsg = data.username ? `Username: ${data.username[0]}` :
                         data.email ? `Email: ${data.email[0]}` :
                         data.password ? `Password: ${data.password[0]}` :
                         'Registration failed. Please try again.';
        throw new Error(errorMsg);
      }
    } catch (err) {
      setError(err.message);
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
            <h1 style={{ color: '#1e293b', fontSize: '32px', fontWeight: '800', margin: '0 0 8px 0' }}>Create Account</h1>
            <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>Join Garden Design Studio today</p>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Username Input */}
            <div style={{ position: 'relative' }}>
              <User size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* First Name & Last Name (side by side) */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <UserCircle size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div style={{ position: 'relative', flex: 1 }}>
                <UserCircle size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            {/* Email Input */}
            <div style={{ position: 'relative' }}>
              <Mail size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Password Input */}
            <div style={{ position: 'relative' }}>
              <Lock size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Confirm Password Input */}
            <div style={{ position: 'relative' }}>
              <CheckCircle2 size={20} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', color: '#1e293b', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '8px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#10b981', textDecoration: 'none', fontWeight: '600' }} onMouseEnter={(e) => e.target.style.textDecoration = 'underline'} onMouseLeave={(e) => e.target.style.textDecoration = 'none'}>Sign in here</Link>
            </p>
          </div>

        </div>
      </div>

      {/* Right Side: Hero Image */}
      <div style={{ flex: 1, backgroundImage: 'url(/hero-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#f1f5f9', display: window.innerWidth > 768 ? 'block' : 'none' }}>
      </div>

    </div>
  );
}
