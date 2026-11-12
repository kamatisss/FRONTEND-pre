// My account (/account, every signed-in role; backend account.py). Tabs in the URL (?tab=):
//   profile    name and mobile number (fills in checkout and bookings), email and username shown
//   addresses  the address book (customers): the default one is picked at checkout and bookings
//   security   change password, change email (both need the current password)
//   privacy    consent on record, download my data, close the account (account_privacy.py)
// Saving hands the fresh tokens to AuthContext, so the header shows the new name at once.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, EyeOff, FileLock2, KeyRound, Loader2, LogOut, Mail, MapPin, ShieldCheck, UserRound, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ui/Toast';
import { getMe, updateMe, changePassword, changeEmail, getPrivacy, acceptPrivacyNotice, downloadMyData, closeAccount, signOutEverywhere } from '../services/api';
import { normalizePhMobile } from '../services/checkout';
import MyAddresses from './MyAddresses';

import { setCachedMe } from '../services/me';
const input = 'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 disabled:bg-slate-50 disabled:text-slate-500';
const label = 'block text-sm font-semibold text-slate-700 mb-1.5';
const card = 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm';
const primary = 'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const ROLE_TEXT = { customer: 'Customer', crew: 'Field crew', office: 'Office', owner: 'Owner' };
// What the details are for, by role: customers get them filled in for them; staff are reached by them
const PROFILE_TEXT = {
  customer: { intro: 'We fill these in for you at checkout and when you book a service.',
    phone: 'Our crew and riders call this number about your bookings and deliveries.' },
  crew: { intro: 'The office and your customers see your name on the jobs and deliveries you handle.',
    phone: 'The office calls this number about your jobs and deliveries.' },
  office: { intro: 'Your name shows to the team, and in the activity log for the changes you make.',
    phone: 'So the owner and the crew can reach you.' },
  owner: { intro: 'Your name shows to the team, and in the activity log for the changes you make.',
    phone: 'So your office and crew can reach you.' },
};

function Field({ id, text, hint, error, required, children }) {
  return (
    <div>
      <label className={label} htmlFor={id}>{text}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="m-0 mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-err`} className="m-0 mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
const describe = (id, hint, error) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

function PasswordInput({ id, value, onChange, autoComplete, error, hint }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={shown ? 'text' : 'password'} className={`${input} pr-12 ${error ? 'border-red-400' : ''}`} value={value}
        onChange={onChange} autoComplete={autoComplete} required aria-invalid={!!error || undefined} aria-describedby={describe(id, hint, error)} />
      <button type="button" onClick={() => setShown(s => !s)} aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg border-none bg-transparent text-slate-400 hover:text-slate-700 cursor-pointer inline-flex items-center justify-center">
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/* ── Profile: name and mobile ── */
function ProfileTab({ me, onSaved }) {
  const [form, setForm] = useState({ first_name: me.first_name, last_name: me.last_name, phone: me.phone });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const dirty = ['first_name', 'last_name', 'phone'].some(k => (form[k] || '') !== (me[k] || ''));
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(({ [k]: _gone, ...rest }) => rest); };

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Enter your first name.';
    if (form.phone.trim() && !normalizePhMobile(form.phone)) errs.phone = 'Enter a PH mobile number, e.g. 09171234567.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    try {
      onSaved(await updateMe({ first_name: form.first_name, last_name: form.last_name, phone: form.phone }), 'Your details are saved.');
    } catch (err) {
      setErrors(err.fields || { _: err.message });
    }
    setBusy(false);
  };

  return (
    <form onSubmit={save} className={`${card} flex flex-col gap-4`} noValidate>
      <div>
        <h2 className="m-0 text-lg font-extrabold text-slate-900">Your details</h2>
        <p className="m-0 mt-0.5 text-sm text-slate-500">{(PROFILE_TEXT[me.role] || PROFILE_TEXT.customer).intro}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="me-first" text="First name" required error={errors.first_name}>
          <input id="me-first" className={`${input} ${errors.first_name ? 'border-red-400' : ''}`} value={form.first_name} onChange={set('first_name')}
            maxLength={150} autoComplete="given-name" aria-invalid={!!errors.first_name || undefined} aria-describedby={describe('me-first', null, errors.first_name)} />
        </Field>
        <Field id="me-last" text="Last name" error={errors.last_name}>
          <input id="me-last" className={input} value={form.last_name} onChange={set('last_name')} maxLength={150} autoComplete="family-name" />
        </Field>
      </div>
      <Field id="me-phone" text="Mobile number" error={errors.phone}
        hint={(PROFILE_TEXT[me.role] || PROFILE_TEXT.customer).phone}>
        <input id="me-phone" type="tel" inputMode="tel" className={`${input} sm:max-w-xs ${errors.phone ? 'border-red-400' : ''}`} value={form.phone}
          onChange={set('phone')} placeholder="09171234567" maxLength={20} autoComplete="tel"
          aria-invalid={!!errors.phone || undefined} aria-describedby={describe('me-phone', 'x', errors.phone)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="me-email" text="Email" hint="Change it under Security.">
          <input id="me-email" className={input} value={me.email || 'No email yet'} disabled aria-describedby="me-email-hint" />
        </Field>
        <Field id="me-username" text="Username" hint="You sign in with this. It can’t be changed.">
          <input id="me-username" className={input} value={me.username} disabled aria-describedby="me-username-hint" />
        </Field>
      </div>
      {errors._ && <p className="m-0 text-sm font-semibold text-red-700" role="alert">{errors._}</p>}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        {dirty && !busy && <span className="mr-auto text-xs text-slate-400">Unsaved changes</span>}
        <button type="submit" className={primary} disabled={!dirty || busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

/* ── Security: password and email ── */
function PasswordCard({ onDone }) {
  const blank = { current: '', next: '', again: '' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors({}); };
  const submit = async (e) => {
    e.preventDefault();
    if (form.next !== form.again) { setErrors({ again: 'The two new passwords don’t match.' }); return; }
    setBusy(true);
    try {
      const res = await changePassword(form.current, form.next);
      setForm(blank);
      onDone(res, 'Your password is changed. Any other device signed in to your account was signed out.');
    } catch (err) {
      const f = err.fields || {};
      setErrors({ current: f.current_password, next: f.new_password, _: !f.current_password && !f.new_password ? err.message : '' });
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-4`} noValidate>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0"><KeyRound size={18} /></span>
        <div>
          <h2 className="m-0 text-lg font-extrabold text-slate-900">Change password</h2>
          <p className="m-0 mt-0.5 text-sm text-slate-500">At least 8 characters, not only numbers, and not a common password.</p>
        </div>
      </div>
      <Field id="pw-current" text="Current password" required error={errors.current}>
        <PasswordInput id="pw-current" value={form.current} onChange={set('current')} autoComplete="current-password" error={errors.current} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="pw-next" text="New password" required error={errors.next}>
          <PasswordInput id="pw-next" value={form.next} onChange={set('next')} autoComplete="new-password" error={errors.next} />
        </Field>
        <Field id="pw-again" text="New password again" required error={errors.again}>
          <PasswordInput id="pw-again" value={form.again} onChange={set('again')} autoComplete="new-password" error={errors.again} />
        </Field>
      </div>
      {errors._ && <p className="m-0 text-sm font-semibold text-red-700" role="alert">{errors._}</p>}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="submit" className={primary} disabled={busy || !form.current || !form.next || !form.again}>
          {busy && <Loader2 size={16} className="animate-spin" />} {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

/* ── Every other device signed out at once (backend jwt_session.py / signout.py) ── */
function SessionsCard({ me, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (!window.confirm('Sign out of your account on every other phone, tablet and computer? You stay signed in here.')) return;
    setBusy(true); setError('');
    try {
      const res = await signOutEverywhere();
      onDone({ ...me, tokens: res.tokens, signed_out_everywhere_at: res.signed_out_everywhere_at },
        'Signed out on every other device. You are still signed in here.');
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const last = me.signed_out_everywhere_at
    ? new Date(me.signed_out_everywhere_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  return (
    <section className={`${card} flex flex-col gap-4`} aria-labelledby="se-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0"><LogOut size={18} /></span>
        <div className="min-w-0">
          <h2 id="se-title" className="m-0 text-lg font-extrabold text-slate-900">Signed-in devices</h2>
          <p className="m-0 mt-0.5 text-sm text-slate-500">
            Lost a phone, or signed in on a shared computer? Sign out everywhere else at once. You stay signed in here.
            {last && <span className="block mt-1 text-xs text-slate-400">Last done {last}.</span>}
          </p>
        </div>
      </div>
      {error && <p className="m-0 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="button" onClick={run} disabled={busy}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold cursor-pointer hover:bg-slate-50 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Sign out everywhere else
        </button>
      </div>
    </section>
  );
}

function EmailCard({ me, onDone }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors({}); };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await changeEmail(form.email.trim(), form.password);
      setForm({ email: '', password: '' });
      onDone(res, `Your email is now ${res.email}.`);
    } catch (err) {
      const f = err.fields || {};
      setErrors({ email: f.email, password: f.current_password, _: !f.email && !f.current_password ? err.message : '' });
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-4`} noValidate>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0"><Mail size={18} /></span>
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-extrabold text-slate-900">Change email</h2>
          <p className="m-0 mt-0.5 text-sm text-slate-500 break-words">
            Now: <b className="text-slate-700">{me.email || 'none'}</b>. Receipts and password-reset links go to this address.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="em-new" text="New email" required error={errors.email}>
          <input id="em-new" type="email" className={`${input} ${errors.email ? 'border-red-400' : ''}`} value={form.email} onChange={set('email')}
            autoComplete="email" inputMode="email" aria-invalid={!!errors.email || undefined} aria-describedby={describe('em-new', null, errors.email)} />
        </Field>
        <Field id="em-pw" text="Your password" required error={errors.password}>
          <PasswordInput id="em-pw" value={form.password} onChange={set('password')} autoComplete="current-password" error={errors.password} />
        </Field>
      </div>
      {errors._ && <p className="m-0 text-sm font-semibold text-red-700" role="alert">{errors._}</p>}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="submit" className={primary} disabled={busy || !form.email.trim() || !form.password}>
          {busy && <Loader2 size={16} className="animate-spin" />} {busy ? 'Saving…' : 'Change email'}
        </button>
      </div>
    </form>
  );
}

/* ── Privacy (RA 10173): consent on record, a copy of your data, closing the account ── */
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

function PrivacyTab({ me }) {
  const { logoutUser } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState('');            // 'accept' | 'export' | 'close'
  const [closing, setClosing] = useState(false);   // the close form is open
  const [form, setForm] = useState({ password: '', word: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => { getPrivacy().then(setInfo).catch(e => setFailed(e.message)); }, []);

  const accept = async () => {
    setBusy('accept');
    try { setInfo(await acceptPrivacyNotice()); toast({ type: 'success', title: 'Thanks: noted that you read the updated notice.' }); }
    catch (e) { toast({ type: 'error', title: e.message }); }
    setBusy('');
  };
  const download = async () => {
    setBusy('export');
    try { const name = await downloadMyData(); toast({ type: 'success', title: 'Your data is downloaded', message: name }); }
    catch (e) { toast({ type: 'error', title: 'Couldn’t prepare your data', message: e.message }); }
    setBusy('');
  };
  const close = async (e) => {
    e.preventDefault();
    setBusy('close'); setErrors({});
    try {
      await closeAccount(form.password, form.word);
      // This device's own leftovers for the account (saved AI session, dismissed hints…)
      try { Object.keys(localStorage).filter(k => k.endsWith(`_${me.id}`)).forEach(k => localStorage.removeItem(k)); } catch { /* fine */ }
      toast({ type: 'success', title: 'Your account is closed', message: 'Your personal details have been erased. Thank you for gardening with us.' });
      logoutUser();
      return;
    } catch (err) {
      const f = err.fields || {};
      if (f.blockers) setInfo(i => ({ ...i, can_close: false, blockers: f.blockers }));
      setErrors({ password: f.current_password, word: f.confirm, _: !f.current_password && !f.confirm && !f.blockers ? err.message : '' });
    }
    setBusy('');
  };

  if (failed) return <p className={`${card} m-0 text-slate-600`} role="alert">{failed}.</p>;
  if (!info) return <div className="py-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  const word = info.confirm_word;

  return (
    <>
      <section className={`${card} flex flex-col gap-3`} aria-labelledby="pv-consent">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0"><ShieldCheck size={18} /></span>
          <div className="min-w-0">
            <h2 id="pv-consent" className="m-0 text-lg font-extrabold text-slate-900">Your consent</h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600">
              {info.consent
                ? <>You agreed to our <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700">Privacy Notice</a> on {fmtDate(info.consent.accepted_at)}.</>
                : <>We have no record of you agreeing to our <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700">Privacy Notice</a>.</>}
            </p>
          </div>
        </div>
        {!info.up_to_date && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex flex-wrap items-center gap-3">
            <span className="flex-1 min-w-[14rem]">{info.consent ? 'We’ve updated the notice since then.' : 'Please read it.'} It explains what we keep, why, and for how long.</span>
            <button type="button" onClick={accept} disabled={!!busy}
              className="h-10 px-4 rounded-lg border-none bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2">
              {busy === 'accept' && <Loader2 size={14} className="animate-spin" />} I’ve read it
            </button>
          </div>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`} aria-labelledby="pv-export">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0"><Download size={18} /></span>
          <div className="min-w-0">
            <h2 id="pv-export" className="m-0 text-lg font-extrabold text-slate-900">Download your data</h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600">
              A file with everything we hold about you: your details, addresses, bookings, orders, designs, reviews and consents.
            </p>
          </div>
        </div>
        <div>
          <button type="button" onClick={download} disabled={!!busy}
            className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold cursor-pointer hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-2">
            {busy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download (.json)
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-4 sm:p-6 shadow-sm flex flex-col gap-3" aria-labelledby="pv-close">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 inline-flex items-center justify-center shrink-0"><UserX size={18} /></span>
          <div className="min-w-0">
            <h2 id="pv-close" className="m-0 text-lg font-extrabold text-slate-900">Close your account</h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600">This can’t be undone. You can download your data first.</p>
          </div>
        </div>
        {!info.can_close ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="m-0 text-sm font-bold text-slate-800">Not yet: please settle these first</p>
            <ul className="m-0 mt-1.5 pl-5 text-sm text-slate-600 flex flex-col gap-1">{info.blockers.map(b => <li key={b}>{b}</li>)}</ul>
          </div>
        ) : (
          <>
            <ul className="m-0 pl-5 text-sm text-slate-600 flex flex-col gap-1">
              <li>We erase your name, email, mobile number, saved addresses, cart, alerts and designs you never booked.</li>
              <li>If your garden is featured in our portfolio, it’s taken down.</li>
              <li>Your reviews stay, shown as “Verified customer”.</li>
              <li>Receipts, orders, bookings and payments stay as business records we’re required to keep, without your phone number or map pin.</li>
            </ul>
            {!closing ? (
              <div>
                <button type="button" onClick={() => setClosing(true)}
                  className="h-11 px-5 rounded-xl border border-red-300 bg-white text-red-700 font-bold cursor-pointer hover:bg-red-50">
                  Close my account…
                </button>
              </div>
            ) : (
              <form onSubmit={close} className="flex flex-col gap-3 pt-2 border-t border-red-100" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="cl-pw" text="Your password" required error={errors.password}>
                    <PasswordInput id="cl-pw" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      autoComplete="current-password" error={errors.password} />
                  </Field>
                  <Field id="cl-word" text={`Type ${word} to confirm`} required error={errors.word}>
                    <input id="cl-word" className={`${input} ${errors.word ? 'border-red-400' : ''}`} value={form.word} autoComplete="off"
                      onChange={e => setForm(f => ({ ...f, word: e.target.value }))} aria-invalid={!!errors.word || undefined} />
                  </Field>
                </div>
                {errors._ && <p className="m-0 text-sm font-semibold text-red-700" role="alert">{errors._}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => { setClosing(false); setForm({ password: '', word: '' }); setErrors({}); }}
                    className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer">Keep my account</button>
                  <button type="submit" disabled={!!busy || !form.password || form.word.trim().toUpperCase() !== word}
                    className="h-11 px-5 rounded-xl border-none bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                    {busy === 'close' && <Loader2 size={16} className="animate-spin" />} Close my account
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default function MyAccount() {
  const { applyTokens } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState(null);
  const [failed, setFailed] = useState('');

  useEffect(() => { getMe().then(setMe).catch(e => setFailed(e.message)); }, []);

  const isCustomer = me?.role === 'customer';
  const tabs = [
    { key: 'profile', label: 'Profile', Icon: UserRound },
    ...(isCustomer ? [{ key: 'addresses', label: 'Addresses', Icon: MapPin }] : []),
    { key: 'security', label: 'Security', Icon: KeyRound },
    { key: 'privacy', label: 'Privacy', Icon: FileLock2 },
  ];
  const asked = params.get('tab');
  const tab = tabs.some(t => t.key === asked) ? asked : 'profile';
  const go = (key) => setParams(key === 'profile' ? {} : { tab: key }, { replace: false });

  const saved = (res, message) => {
    const { tokens, ...rest } = res || {};
    applyTokens(tokens);
    if (rest.id) { setMe(rest); setCachedMe(rest); }   // forms already open elsewhere get the new details too
    toast({ type: 'success', title: message });
  };

  if (failed) return <p className="max-w-3xl mx-auto px-4 py-10 text-center text-slate-600" role="alert">{failed}. Please refresh the page.</p>;
  if (!me) return <div className="py-16 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  const fullName = `${me.first_name} ${me.last_name}`.trim() || me.username;
  const initials = (me.first_name?.[0] || me.username[0] || '?').toUpperCase() + (me.last_name?.[0] || '').toUpperCase();
  const since = new Date(me.date_joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-5">
      <header className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-emerald-600 text-white text-lg font-extrabold inline-flex items-center justify-center shrink-0" aria-hidden="true">{initials}</span>
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-extrabold text-slate-900 truncate">{fullName}</h1>
          <p className="m-0 text-sm text-slate-500">{ROLE_TEXT[me.role]} · member since {since}</p>
        </div>
      </header>

      {isCustomer && !me.phone && tab !== 'profile' && (
        <p className="m-0 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Add your mobile number under <button type="button" onClick={() => go('profile')} className="font-bold underline bg-transparent border-none p-0 cursor-pointer text-amber-900">Profile</button> so our crew can reach you.
        </p>
      )}

      <nav className="flex gap-1 p-1 bg-slate-100 rounded-xl" aria-label="Account sections">
        {tabs.map(({ key, label: text, Icon }) => (
          <button key={key} type="button" onClick={() => go(key)} aria-current={tab === key ? 'page' : undefined}
            className={`flex-1 min-h-[44px] rounded-lg border-none text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 ${tab === key
              ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon size={16} /> {text}
          </button>
        ))}
      </nav>

      {tab === 'profile' && <ProfileTab key={me.phone + me.first_name + me.last_name} me={me} onSaved={saved} />}
      {tab === 'addresses' && <div className={card}><MyAddresses embedded /></div>}
      {tab === 'privacy' && <PrivacyTab me={me} />}
      {tab === 'security' && (
        <>
          <PasswordCard onDone={saved} />
          <EmailCard me={me} onDone={saved} />
          <SessionsCard me={me} onDone={saved} />
        </>
      )}
    </div>
  );
}
