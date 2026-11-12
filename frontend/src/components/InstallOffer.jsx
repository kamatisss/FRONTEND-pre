// "Want our crew to plant it?" — shown on a plants-only AI design, so choosing a design isn't only
// a shopping list. Prices the same design installed both ways (server rate card, /pricing/estimate/):
//   existing  plant into the yard as it is (crew mobilisation)
//   makeover  site prep and soil first
// Choosing one switches this design to installed; its button then books the site visit, and the
// booked design goes through the office's check and the customer's approval (design_review.py).
import { useEffect, useEffectEvent, useState } from 'react';
import { Hammer, Loader } from 'lucide-react';
import { peso } from '../data/projectHub';

const OPTIONS = [
  { scope: 'existing', title: 'Plant into my yard as it is', sub: 'Delivery, planting and clean-up' },
  { scope: 'makeover', title: 'Full makeover', sub: 'Site prep and new soil, then planting' },
];

export default function InstallOffer({ priceKey, plantsOnlyTotal, fetchEstimate, onChoose, disabled }) {
  // { key, values: scope → total | 'error' }; prices for an older version of the design count as loading
  const [priced, setPriced] = useState({ key: null, values: {} });
  const prices = priced.key === priceKey ? priced.values : {};
  const load = useEffectEvent(async (key, cancelled) => {
    const out = {};
    await Promise.all(OPTIONS.map(async ({ scope }) => {
      try { out[scope] = (await fetchEstimate(scope)).total; } catch { out[scope] = 'error'; }
    }));
    if (!cancelled()) setPriced({ key, values: out });
  });
  useEffect(() => {
    let off = false;
    load(priceKey, () => off);
    return () => { off = true; };
  }, [priceKey]);

  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" aria-labelledby="install-offer-title">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
          <Hammer size={18} className="text-emerald-700" />
        </span>
        <div className="min-w-0">
          <h4 id="install-offer-title" className="m-0 text-sm font-extrabold text-slate-900">Want our crew to plant it?</h4>
          <p className="m-0 mt-0.5 text-xs text-slate-600 leading-relaxed">
            We check your yard first, adjust the design to it, and you approve the final version before any work starts.
            Our crew then plants it exactly as approved.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        {OPTIONS.map(({ scope, title, sub }) => {
          const price = prices[scope];
          return (
            <button key={scope} type="button" disabled={disabled || price === undefined || price === 'error'}
              onClick={() => onChoose(scope)}
              className="text-left rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]">
              <span className="block text-sm font-bold text-slate-900">{title}</span>
              <span className="block text-xs text-slate-500">{sub}</span>
              <span className="block mt-1 text-sm font-extrabold text-emerald-700">
                {price === undefined ? <span className="inline-flex items-center gap-1 text-slate-400 font-semibold"><Loader size={12} className="animate-spin" /> Pricing…</span>
                  : price === 'error' ? <span className="text-slate-400 font-semibold">Price not available</span>
                    : <>about {peso(price)} installed</>}
              </span>
            </button>
          );
        })}
      </div>
      {plantsOnlyTotal > 0 && (
        <p className="m-0 mt-2 text-[11px] text-slate-500">Plants only (you plant them): {peso(plantsOnlyTotal)}. You can switch back any time.</p>
      )}
    </section>
  );
}
