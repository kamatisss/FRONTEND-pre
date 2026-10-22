import { useEffect, useState } from 'react';
import { Building2, Save, CheckCircle2, MapPin, Phone, Mail, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { setBusiness } from '../services/business';

/*
 * Owner: Business profile — the details customers see in the site header and footer, in emails
 * and on PayMongo payment pages. Saved to GET/PATCH /api/business/ (BACKEND views_office.py);
 * every change is written to the activity log. Empty fields are simply not shown on the site.
 * (This page used to be a "Global Settings" mock that saved nothing.)
 */

const FIELDS = [
  { title: 'Your business', fields: [
    ['name', 'Business name', 'Garden Studio', { required: true, maxLength: 80 }],
    ['tagline', 'One line about you', 'Design your garden in 3D, then let our own crew build it.', { maxLength: 160 }],
    ['founded_year', 'Year you started', 'e.g. 2019', { inputMode: 'numeric', maxLength: 4 }],
    ['service_area', 'Where you work', 'e.g. Quezon Province and nearby areas', { maxLength: 160 }],
  ] },
  { title: 'How customers reach you', fields: [
    ['phone', 'Phone', '+63 912 345 6789', { type: 'tel', maxLength: 30 }],
    ['email', 'Email', 'hello@yourbusiness.ph', { type: 'email' }],
    ['address', 'Address', 'Brgy. …, Lucena City, Quezon', { maxLength: 200 }],
  ] },
  { title: 'Social pages', note: 'Paste the full link to the page. Leave empty to hide the button.', fields: [
    ['facebook', 'Facebook', 'https://www.facebook.com/…', { type: 'url' }],
    ['instagram', 'Instagram', 'https://www.instagram.com/…', { type: 'url' }],
    ['tiktok', 'TikTok', 'https://www.tiktok.com/@…', { type: 'url' }],
  ] },
];

const toForm = (d) => ({
  name: d.name || '', tagline: d.tagline || '', founded_year: d.founded_year ? String(d.founded_year) : '',
  service_area: d.service_area || '', phone: d.phone || '', email: d.email || '', address: d.address || '',
  facebook: d.social?.facebook || '', instagram: d.social?.instagram || '', tiktok: d.social?.tiktok || '',
});

const LABEL = 'block text-xs font-bold text-slate-600 mb-1';
const INPUT = 'w-full h-11 px-3 text-[15px] text-slate-900 border rounded-xl bg-white focus:outline-none focus:border-emerald-500';

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [meta, setMeta] = useState({});
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/business/')
      .then(r => { const f = toForm(r.data); setForm(f); setSaved(f); setMeta(r.data); })
      .catch(() => setNotice({ type: 'error', msg: 'Could not load the business profile. Refresh to try again.' }));
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); setNotice(null); };
  const dirty = form && saved && Object.keys(form).some(k => form[k].trim() !== saved[k]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    try {
      const r = await api.patch('/business/', body);
      const f = toForm(r.data);
      setForm(f); setSaved(f); setMeta(r.data); setErrors({});
      setBusiness(r.data);
      setNotice({ type: 'ok', msg: 'Saved. Your site, emails and payment pages now use these details.' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data && typeof data === 'object') {
        setErrors(data);
        setNotice({ type: 'error', msg: 'Some details need fixing. See the highlighted fields.' });
      } else {
        setNotice({ type: 'error', msg: data?.error || 'Could not save. Check the connection and try again.' });
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex items-start gap-3 mb-6">
        <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Building2 size={22} /></span>
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Business profile</h1>
          <p className="m-0 mt-0.5 text-sm text-slate-500">
            What customers see on your site, in emails and on payment pages.
            {meta.updated_by && <> Last saved by {meta.updated_by} on {new Date(meta.updated_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.</>}
          </p>
        </div>
      </div>

      {!form ? (
        notice ? <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{notice.msg}</p>
          : <div className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      ) : (
        <form onSubmit={save} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start" noValidate>
          <div className="flex flex-col gap-5">
            {FIELDS.map(group => (
              <fieldset key={group.title} className="m-0 bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
                <legend className="sr-only">{group.title}</legend>
                <h2 className="m-0 text-[15px] font-extrabold text-slate-900">{group.title}</h2>
                {group.note && <p className="m-0 mt-0.5 text-sm text-slate-500">{group.note}</p>}
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {group.fields.map(([key, label, placeholder, attrs]) => (
                    <div key={key} className={key === 'tagline' || key === 'address' ? 'sm:col-span-2' : ''}>
                      <label className={LABEL} htmlFor={`bp-${key}`}>{label}{attrs.required ? '' : <span className="font-medium text-slate-400"> · optional</span>}</label>
                      <input id={`bp-${key}`} className={`${INPUT} ${errors[key] ? 'border-red-400' : 'border-slate-300'}`}
                        value={form[key]} placeholder={placeholder} onChange={e => set(key, e.target.value)}
                        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `bp-${key}-err` : undefined} {...attrs} />
                      {errors[key] && <p id={`bp-${key}-err`} className="m-0 mt-1 text-xs font-semibold text-red-700">{errors[key]}</p>}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            <p className="m-0 text-xs text-slate-500">
              Prices and fees live in <Link to="/pricing-settings" className="text-emerald-700 font-semibold">Pricing</Link>.
              Payment (PayMongo), email and AI keys are set on the server by whoever runs it, not here.
            </p>
          </div>

          {/* Preview of the site footer, plus the save button that stays in reach */}
          <aside className="lg:sticky lg:top-24 flex flex-col gap-3">
            <div className="rounded-2xl bg-slate-900 text-slate-300 p-5">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Preview · site footer</p>
              <p className="m-0 flex items-center gap-2 text-white font-extrabold"><Leaf size={18} className="text-emerald-400" /> {form.name || 'Business name'}</p>
              {(form.tagline || form.founded_year) && (
                <p className="m-0 mt-2 text-sm leading-relaxed">{form.tagline}{form.founded_year ? ` Serving gardens since ${form.founded_year}.` : ''}</p>
              )}
              <div className="mt-3 flex flex-col gap-1.5 text-sm">
                {form.address && <span className="flex gap-2"><MapPin size={15} className="shrink-0 mt-0.5" />{form.address}</span>}
                {form.phone && <span className="flex gap-2"><Phone size={15} className="shrink-0 mt-0.5" />{form.phone}</span>}
                {form.email && <span className="flex gap-2"><Mail size={15} className="shrink-0 mt-0.5" />{form.email}</span>}
                {form.service_area && <span className="flex gap-2"><Leaf size={15} className="shrink-0 mt-0.5" />Serving {form.service_area}</span>}
                {!form.address && !form.phone && !form.email && <span className="text-amber-300">Add a phone or email so customers can reach you.</span>}
              </div>
            </div>
            {notice && (
              <p role={notice.type === 'error' ? 'alert' : 'status'}
                className={`m-0 text-sm font-semibold rounded-xl px-4 py-3 flex gap-2 ${notice.type === 'error' ? 'text-red-700 bg-red-50 border border-red-200' : 'text-emerald-800 bg-emerald-50 border border-emerald-200'}`}>
                {notice.type === 'ok' && <CheckCircle2 size={18} className="shrink-0" />}{notice.msg}
              </p>
            )}
            <button type="submit" disabled={busy || !dirty}
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-default text-white font-bold text-[15px] border-none cursor-pointer flex items-center justify-center gap-2">
              <Save size={18} /> {busy ? 'Saving…' : dirty ? 'Save changes' : 'All changes saved'}
            </button>
          </aside>
        </form>
      )}
    </div>
  );
}
