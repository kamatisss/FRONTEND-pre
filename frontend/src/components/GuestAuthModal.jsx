import React, { useState } from 'react';
import { X, Leaf, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearGuestDesign } from '../services/guestSession';
import { API_BASE_URL as API_ROOT } from '../config';

const API_BASE = API_ROOT;

// title / subtitle / cta let other entry points (the free 3D Studio, the AI Designer) reuse
// this modal; onAuthSuccess receives 'signin' or 'register'.
export default function GuestAuthModal({
  onClose,
  onAuthSuccess,
  title = 'Save your design & book your pros',
  subtitle = 'Create a free account to unlock booking, design history, and dedicated landscapers.',
  cta = 'Continue Booking',
}) {
  const { loginUserSilent } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin'); // 'signin' | 'register'

  const [signIn, setSignIn] = useState({ username: '', password: '' });
  const [reg, setReg] = useState({ username: '', first_name: '', last_name: '', email: '', password: '', confirm: '', accept: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUserSilent(signIn.username, signIn.password);
      clearGuestDesign();
      if (localStorage.getItem('pending_booking_context')) {
        onClose();
        navigate('/book-service');
      } else {
        onAuthSuccess('signin');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (reg.password !== reg.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: reg.username,
          first_name: reg.first_name,
          last_name: reg.last_name,
          email: reg.email,
          password: reg.password,
          accept_privacy: reg.accept,
        }),
      });
      const data = await res.json();
      if (res.status === 201) {
        await loginUserSilent(reg.username, reg.password);
        clearGuestDesign();
        if (localStorage.getItem('pending_booking_context')) {
          onClose();
          navigate('/book-service');
        } else {
          onAuthSuccess('register');
        }
      } else {
        const msg = data.username?.[0] || data.email?.[0] || data.password?.[0] || data.accept_privacy?.[0] || data.detail || 'Registration failed.';
        setError(msg);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .gam-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(15,23,42,0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 16px;
          overflow-y: auto; overscroll-behavior: contain;   /* phone keyboard open: the form scrolls */
        }
        .gam-card {
          background: #fff;
          border-radius: 24px;
          width: 100%; max-width: 440px; margin: auto 0;   /* centred when it fits, scrolls when it doesn't */
          box-shadow: 0 24px 64px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08);
          overflow: hidden;
          position: relative;
        }
        .gam-header {
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
          padding: 28px 28px 20px;
          border-bottom: 1px solid #d1fae5;
          text-align: center;
        }
        .gam-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px;
          background: #d1fae5; border: 1px solid #a7f3d0;
          border-radius: 100px;
          font-size: 11px; font-weight: 700; color: #059669;
          letter-spacing: 0.5px; text-transform: uppercase;
          margin-bottom: 12px;
        }
        .gam-headline {
          font-size: 20px; font-weight: 900; color: #0f172a;
          margin: 0 0 6px; letter-spacing: -0.5px; line-height: 1.25;
        }
        .gam-subline {
          font-size: 13.5px; color: #64748b; margin: 0; line-height: 1.5;
        }
        .gam-tabs {
          display: flex; border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .gam-tab {
          flex: 1; padding: 12px; font-size: 13.5px; font-weight: 700;
          border: none; background: none; cursor: pointer;
          color: #94a3b8; transition: color 0.15s;
          border-bottom: 2px solid transparent;
        }
        .gam-tab.active { color: #059669; border-bottom-color: #10b981; background: #fff; }
        .gam-body { padding: 24px 28px 28px; }
        .gam-label {
          display: block; font-size: 12px; font-weight: 700;
          color: #475569; letter-spacing: 0.4px; margin-bottom: 6px;
          text-transform: uppercase;
        }
        .gam-input {
          width: 100%; box-sizing: border-box;
          padding: 10px 14px; border-radius: 10px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          font-size: 14px; color: #0f172a; font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .gam-input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); background: #fff; }
        .gam-field { margin-bottom: 14px; }
        .gam-consent { display: flex; align-items: flex-start; gap: 10px; margin: 2px 0 14px; font-size: 13px; line-height: 1.5; color: #475569; cursor: pointer; }
        .gam-consent input { width: 18px; height: 18px; margin-top: 1px; accent-color: #10b981; flex-shrink: 0; }
        .gam-consent a { color: #059669; font-weight: 600; }
        .gam-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .gam-submit {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: white; border: none; border-radius: 12px;
          font-size: 15px; font-weight: 800; cursor: pointer;
          font-family: inherit; letter-spacing: -0.3px;
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 4px 12px rgba(16,185,129,0.35);
          margin-top: 8px;
        }
        .gam-submit:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .gam-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .gam-error {
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 10px; padding: 10px 14px;
          font-size: 13px; color: #dc2626; margin-bottom: 14px;
        }
        .gam-close {
          position: absolute; top: 14px; right: 14px;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(15,23,42,0.06); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #64748b; transition: background 0.15s, color 0.15s;
        }
        .gam-close:hover { background: #fee2e2; color: #dc2626; }
      `}</style>

      <div className="gam-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="gam-card">
          <button className="gam-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>

          <div className="gam-header">
            <div className="gam-badge"><Leaf size={11} /> Garden Studio</div>
            <h2 className="gam-headline">{title}</h2>
            <p className="gam-subline">{subtitle}</p>
          </div>

          <div className="gam-tabs">
            <button className={`gam-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => { setTab('signin'); setError(''); }}>Sign In</button>
            <button className={`gam-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>Create Account</button>
          </div>

          <div className="gam-body">
            {error && <div className="gam-error">{error}</div>}

            {tab === 'signin' && (
              <form onSubmit={handleSignIn}>
                <div className="gam-field">
                  <label className="gam-label">Username</label>
                  <input className="gam-input" type="text" placeholder="your_username" required autoFocus
                    value={signIn.username} onChange={e => setSignIn(p => ({ ...p, username: e.target.value }))} />
                </div>
                <div className="gam-field">
                  <label className="gam-label">Password</label>
                  <input className="gam-input" type="password" placeholder="••••••••" required
                    value={signIn.password} onChange={e => setSignIn(p => ({ ...p, password: e.target.value }))} />
                </div>
                <button className="gam-submit" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : <><Sparkles size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Sign In &amp; {cta}</>}
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="gam-row">
                  <div>
                    <label className="gam-label">First Name</label>
                    <input className="gam-input" type="text" placeholder="Jane" required autoFocus
                      value={reg.first_name} onChange={e => setReg(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="gam-label">Last Name</label>
                    <input className="gam-input" type="text" placeholder="Smith"
                      value={reg.last_name} onChange={e => setReg(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="gam-field">
                  <label className="gam-label">Username</label>
                  <input className="gam-input" type="text" placeholder="janesmith" required
                    value={reg.username} onChange={e => setReg(p => ({ ...p, username: e.target.value }))} />
                </div>
                <div className="gam-field">
                  <label className="gam-label">Email</label>
                  <input className="gam-input" type="email" placeholder="jane@example.com" required
                    value={reg.email} onChange={e => setReg(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="gam-row">
                  <div>
                    <label className="gam-label">Password</label>
                    <input className="gam-input" type="password" placeholder="••••••••" required
                      value={reg.password} onChange={e => setReg(p => ({ ...p, password: e.target.value }))} />
                  </div>
                  <div>
                    <label className="gam-label">Confirm</label>
                    <input className="gam-input" type="password" placeholder="••••••••" required
                      value={reg.confirm} onChange={e => setReg(p => ({ ...p, confirm: e.target.value }))} />
                  </div>
                </div>
                {/* Data Privacy Act: consent before any account exists (the server records it).
                    The notice opens in a new tab so the guest's design and this form stay as they are. */}
                <label className="gam-consent">
                  <input type="checkbox" required checked={reg.accept} onChange={e => setReg(p => ({ ...p, accept: e.target.checked }))} />
                  <span>I have read the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a> and agree to the collection and use of my information as described there.</span>
                </label>
                <button className="gam-submit" type="submit" disabled={loading}>
                  {loading ? 'Creating account…' : <><Sparkles size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Create Account &amp; Continue</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
