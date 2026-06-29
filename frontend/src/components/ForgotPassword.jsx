import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, User, Lock, Leaf, AlertCircle, CheckCircle2, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '../services/api';

export default function ForgotPassword() {
  const [step, setStep]               = useState(1); // 1 = identify, 2 = new password
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState('');

  // Step 1: Verify identity (username + email)
  const handleVerify = (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !email.trim()) {
      setError('Please enter both your username and email.');
      return;
    }
    setStep(2);
  };

  // Step 2: Submit new password
  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPwd) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ username, email, new_password: newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Background blobs */}
      <div className="auth-bg-blob auth-bg-blob--top" />
      <div className="auth-bg-blob auth-bg-blob--bottom" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="auth-card-container"
      >
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo-section">
            <div className="auth-logo-icon">
              <Leaf size={32} className="auth-logo-leaf" />
            </div>
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">
              {step === 1
                ? "Enter your username and email to verify your account."
                : "Choose a new password for your account."}
            </p>
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="auth-error-banner"
              >
                <AlertCircle size={18} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success State */}
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="auth-success-block"
            >
              <div className="auth-success-icon-wrap">
                <CheckCircle2 size={36} className="auth-success-icon" />
              </div>
              <h2 className="auth-success-title">Password updated!</h2>
              <p className="auth-success-body">
                Your password has been reset successfully. You can now log in with your new password.
              </p>
              <Link to="/login" className="auth-btn auth-btn--primary auth-btn--full">
                <ArrowLeft size={16} /> Go to Login
              </Link>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ── Step 1: Identity Verification ── */}
              {step === 1 && (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleVerify}
                  className="auth-form"
                >
                  {/* Username */}
                  <div className="auth-field">
                    <label className="auth-label">Username</label>
                    <div className="auth-input-wrap">
                      <User size={18} className="auth-input-icon" />
                      <input
                        id="fp-username"
                        type="text"
                        placeholder="Your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                        className="auth-input auth-input--icon"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="auth-field">
                    <label className="auth-label">Email Address</label>
                    <div className="auth-input-wrap">
                      <Mail size={18} className="auth-input-icon" />
                      <input
                        id="fp-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="auth-input auth-input--icon"
                      />
                    </div>
                  </div>

                  <button type="submit" className="auth-btn auth-btn--primary auth-btn--full">
                    Verify Account →
                  </button>

                  <p className="auth-footer-text">
                    Remember your password?{' '}
                    <Link to="/login" className="auth-link">Sign in →</Link>
                  </p>
                </motion.form>
              )}

              {/* ── Step 2: New Password ── */}
              {step === 2 && (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleReset}
                  className="auth-form"
                >
                  {/* Step indicator */}
                  <div className="fp-step-info">
                    <button
                      type="button"
                      onClick={() => { setStep(1); setError(''); }}
                      className="fp-back-btn"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <span className="fp-step-label">Resetting for <strong>{username}</strong></span>
                  </div>

                  {/* New Password */}
                  <div className="auth-field">
                    <label className="auth-label">New Password</label>
                    <div className="auth-input-wrap">
                      <Lock size={18} className="auth-input-icon" />
                      <input
                        id="fp-new-password"
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="auth-input auth-input--icon auth-input--icon-right"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(p => !p)}
                        className="auth-toggle-pwd"
                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                      >
                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="auth-field">
                    <label className="auth-label">Confirm New Password</label>
                    <div className="auth-input-wrap">
                      <Lock size={18} className="auth-input-icon" />
                      <input
                        id="fp-confirm-password"
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Repeat your new password"
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="auth-input auth-input--icon"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="auth-btn auth-btn--primary auth-btn--full"
                  >
                    {loading ? (
                      <><Loader2 size={18} className="auth-spinner" /> Resetting...</>
                    ) : 'Reset Password'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Back to Landing */}
        <p className="auth-back-link">
          <Link to="/">← Back to Garden Studio</Link>
        </p>
      </motion.div>
    </div>
  );
}
