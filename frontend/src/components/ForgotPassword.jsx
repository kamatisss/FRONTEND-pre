import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Leaf, AlertCircle, CheckCircle2, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { requestPasswordReset, confirmPasswordReset } from '../services/api';

/*
 * Forgot password, in two steps:
 *   /forgot-password                       enter your email → we email a one-time link
 *   /reset-password?uid=…&token=…          (that link) choose a new password
 * The server never says whether an email has an account, and each link works once.
 * (It used to reset a password for anyone who typed a username + email: removed for security.)
 */

const INPUT = 'w-full h-12 pl-11 pr-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-[15px] focus:outline-none focus:border-emerald-500';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-900 font-extrabold no-underline mb-6">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Leaf size={18} /></span> Garden Studio
        </Link>
        {children}
        <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 no-underline">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </div>
    </div>
  );
}

function Alert({ type, children }) {
  const ok = type === 'ok';
  return (
    <p role={ok ? 'status' : 'alert'} className={`m-0 mb-4 flex gap-2 text-sm font-semibold rounded-xl px-4 py-3 border
      ${ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
      {ok ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}{children}
    </p>
  );
}

function RequestLink() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Enter the email on your account.'); return; }
    setBusy(true);
    try { setSent((await requestPasswordReset(email.trim())).message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Forgot your password?</h1>
      <p className="m-0 mt-1 mb-5 text-sm text-slate-500">Enter the email on your account and we'll send you a link to choose a new one.</p>
      {sent ? <Alert type="ok">{sent}</Alert> : (
        <form onSubmit={submit} noValidate>
          {error && <Alert>{error}</Alert>}
          <label htmlFor="fp-email" className="block text-xs font-bold text-slate-600 mb-1">Email</label>
          <div className="relative mb-4">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="fp-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold border-none cursor-pointer flex items-center justify-center gap-2">
            {busy && <Loader2 size={18} className="animate-spin" />} Send me a reset link
          </button>
        </form>
      )}
      <p className="m-0 mt-4 text-xs text-slate-500">No email on your account, or staff? Ask the owner to set a new password for you.</p>
    </Shell>
  );
}

function ChooseNewPassword({ uid, token }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      const res = await confirmPasswordReset({ uid, token, new_password: password });
      navigate('/login', { replace: true, state: { message: res.message } });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Choose a new password</h1>
      <p className="m-0 mt-1 mb-5 text-sm text-slate-500">At least 8 characters, not all numbers, and not a common password.</p>
      <form onSubmit={submit} noValidate>
        {error && <Alert>{error}{/link/.test(error) && <> <Link to="/forgot-password" className="underline">Get a new link</Link></>}</Alert>}
        {[['fp-new', 'New password', password, setPassword, 'new-password'], ['fp-confirm', 'Type it again', confirm, setConfirm, 'new-password']].map(([id, label, value, set, ac]) => (
          <div key={id} className="mb-4">
            <label htmlFor={id} className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id={id} type={show ? 'text' : 'password'} autoComplete={ac} value={value} onChange={e => set(e.target.value)} className={`${INPUT} pr-11`} />
              {id === 'fp-new' && (
                <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-transparent border-none text-slate-500 cursor-pointer">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="submit" disabled={busy}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold border-none cursor-pointer flex items-center justify-center gap-2">
          {busy && <Loader2 size={18} className="animate-spin" />} Save new password
        </button>
      </form>
    </Shell>
  );
}

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const uid = params.get('uid');
  const token = params.get('token');
  return uid && token ? <ChooseNewPassword uid={uid} token={token} /> : <RequestLink />;
}
