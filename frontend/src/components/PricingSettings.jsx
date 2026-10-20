import { useEffect, useMemo, useState } from 'react';
import { Calculator, AlertTriangle, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPricing, updatePricing } from '../services/api';
import { fixedCosts, allIn } from '../data/pricing';

/*
 * Office admin: the rate card every estimate is built from (AI Designer, Studio,
 * shop delivery). Starts with SAMPLE rates until an admin saves real ones.
 */

const GROUPS = [
  { title: 'Planting & installation labour', note: 'Per item placed by the crew.', fields: [
    ['planting_tall', 'Trees & palms (2.5 m+)', '₱ / plant'],
    ['planting_mid', 'Shrubs (0.8–2.5 m)', '₱ / plant'],
    ['planting_low', 'Flowers & groundcover', '₱ / plant'],
    ['install_other', 'Stones, furniture & other items', '₱ / item'],
  ] },
  { title: 'Per square metre of garden', note: 'Charged on the whole garden area.', fields: [
    ['site_prep_per_sqm', 'Site preparation (clearing, levelling)', '₱ / m²'],
    ['materials_per_sqm', 'Garden soil, compost & mulch', '₱ / m²'],
  ] },
  { title: 'Per project', note: null, fields: [
    ['mobilization_fee', 'Crew mobilisation & delivery', '₱'],
    ['design_fee_percent', 'Design & project management', '% of subtotal'],
    ['minimum_project', 'Minimum project charge', '₱'],
    ['estimate_range_percent', 'Estimate shown as ±', '%'],
  ] },
  { title: 'Tax & shop', note: null, fields: [
    ['vat_percent', 'VAT rate (only if VAT-registered)', '%'],
    ['shipping_fee', 'Shop delivery fee per order', '₱'],
    ['cod_max_amount', 'Cash on Delivery limit per order (0 = no limit)', '₱'],
  ] },
];

const LABEL = 'block text-xs font-semibold text-slate-600 mb-1';
const INPUT = 'w-full px-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400';

export default function PricingSettings() {
  const { user } = useAuth();
  const [form,   setForm]   = useState(null);
  const [saved,  setSaved]  = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    getPricing().then(r => { setForm(r); setSaved(r); }).catch(e => setNotice({ type: 'error', msg: e.message }));
  }, []);

  // Live example so the admin sees what a typical garden would be quoted
  const example = useMemo(() => {
    if (!form) return null;
    const r = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' && k !== 'service_area' ? Number(v) || 0 : v]));
    const plants = 3 * 500 + 10 * 150 + 20 * 60;   // 3 palms, 10 shrubs, 20 flowers
    const labour = 3 * r.planting_tall + 10 * r.planting_mid + 20 * r.planting_low;
    const pre = allIn(plants + labour + fixedCosts(r, 100), r);
    const total = Math.max(pre, r.minimum_project * (r.vat_registered ? 1 + r.vat_percent / 100 : 1));
    return Math.round(total);
  }, [form]);

  if (user?.staff_role === 'FIELD_CREW') {
    return <div className="p-10 text-center text-slate-500">Pricing is managed by office admins.</div>;
  }
  if (!form) return <div className="p-10 text-slate-400">{notice?.msg || 'Loading rate card…'}</div>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = Object.fromEntries(GROUPS.flatMap(g => g.fields).map(([k]) => [k, form[k]]));
      body.vat_registered = form.vat_registered;
      body.service_area = form.service_area;
      const r = await updatePricing(body);
      setForm(r);
      setSaved(r);
      setNotice({ type: 'ok', msg: 'Rates saved. New estimates use them right away; saved quotes keep the rates they were made with.' });
    } catch (err) {
      const parsed = Object.fromEntries(err.message.split(', ').map(p => p.split(': ')).filter(p => p.length === 2));
      setErrors(parsed);
      setNotice({ type: 'error', msg: 'Some rates are invalid. Check the highlighted fields.' });
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <form onSubmit={save} className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 shadow-sm"><Calculator size={20} className="text-white" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">Pricing</h1>
              <p className="text-slate-500 text-xs md:text-sm m-0">The rate card behind every estimate customers see.</p>
            </div>
          </div>
          <button type="submit" disabled={busy || !dirty}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl border-none cursor-pointer disabled:opacity-40">
            <Save size={15} /> {busy ? 'Saving…' : 'Save rates'}
          </button>
        </div>

        {form.is_sample && (
          <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span><b>These are sample rates, not your business's real prices.</b> Customers already see estimates built from them. Replace them with your actual rates and save.</span>
          </div>
        )}
        {notice && (
          <div className={`flex items-start gap-2 text-sm rounded-xl px-4 py-3 mb-5 ${notice.type === 'ok' ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-red-800 bg-red-50 border border-red-200'}`}>
            {notice.type === 'ok' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
            <span>{notice.msg}</span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {GROUPS.map(group => (
            <section key={group.title} className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="text-sm font-extrabold text-slate-800 m-0">{group.title}</h2>
              {group.note && <p className="text-xs text-slate-400 mt-0.5 mb-0">{group.note}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {group.fields.map(([key, label, unit]) => (
                  <div key={key}>
                    <label className={LABEL} htmlFor={key}>{label} <span className="text-slate-400 font-normal">({unit})</span></label>
                    <input id={key} type="number" min="0" step="0.01" className={`${INPUT} ${errors[key] ? 'border-red-400' : ''}`}
                           value={form[key]} onChange={e => set(key, e.target.value)} />
                    {errors[key] && <p className="text-xs text-red-600 mt-1 mb-0">{errors[key]}</p>}
                  </div>
                ))}
                {group.title === 'Tax & shop' && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer sm:col-span-2">
                    <input type="checkbox" checked={!!form.vat_registered} onChange={e => set('vat_registered', e.target.checked)} />
                    The business is VAT-registered (adds VAT to project estimates)
                  </label>
                )}
                {group.title === 'Per project' && (
                  <div className="sm:col-span-2">
                    <label className={LABEL} htmlFor="service_area">Service area covered by the mobilisation fee</label>
                    <input id="service_area" className={INPUT} maxLength={200} value={form.service_area || ''} onChange={e => set('service_area', e.target.value)} />
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {example !== null && (
          <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl px-5 py-4 mt-4 mb-0">
            <b>Example with these rates:</b> a 10 × 10 m garden with 3 palms, 10 shrubs and 20 flowers (sample plant prices) would be estimated at about <b>₱{example.toLocaleString()}</b>.
          </p>
        )}
      </form>
    </div>
  );
}
