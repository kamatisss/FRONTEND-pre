import { useEffect, useState } from 'react';
import { Hammer, ShoppingBag, Sparkles, AlertTriangle } from 'lucide-react';
import { getBudgetSuggestion } from '../services/api';
import { plantBudgetFromAllIn, fixedCosts, allIn } from '../data/pricing';

/*
 * Budget as a range (e.g. ₱50K – ₱100K), in the same bands as the Project Hub's prices,
 * plus a "typical for your yard" suggestion from the rate card. Two modes:
 * installed by our crew (all-in) or plants only (the customer plants them).
 */

const peso = (n) => `₱${Number(n).toLocaleString()}`;

export default function BudgetPicker({ areaSqm, install, onInstallChange, range, onRangeChange, rates }) {
  const [data, setData] = useState(null); // { bands, suggested } for the current mode and area
  const mode = install ? 'install' : 'plants';

  useEffect(() => {
    if (!(areaSqm > 0)) return undefined;
    const t = setTimeout(() => {
      getBudgetSuggestion(areaSqm, mode).then(setData).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [areaSqm, mode]);

  const bands = data?.bands || [];
  const suggested = data?.suggested;
  const isSel = (b) => Number(range.min) === b.min && Number(range.max) === b.max;
  const invalid = Number(range.min) > Number(range.max);

  // What the top of the range actually buys
  let explain = null;
  if (rates && areaSqm > 0 && !invalid) {
    if (install) {
      const basics = Math.round(allIn(fixedCosts(rates, areaSqm), rates));
      const forPlants = plantBudgetFromAllIn(range.max, areaSqm, rates);
      explain = forPlants > 0
        ? { ok: true, text: `All-in. Site prep, soil and delivery are about ${peso(basics)}; up to ${peso(forPlants)} goes to plants & planting.` }
        : { ok: false, text: `Too small for this yard: site prep, soil and delivery alone are about ${peso(basics)}.` };
    } else {
      explain = { ok: true, text: `Plants delivered to your door (${peso(rates.shipping_fee)} delivery). You plant them yourself.` };
    }
  }

  const switchMode = (nextInstall) => {
    if (nextInstall === install) return;
    onInstallChange(nextInstall);
    // Sensible starting range for each mode; the suggestion chip refines it
    onRangeChange(nextInstall ? { min: 50000, max: 100000 } : { min: 5000, max: 10000 });
  };

  const chip = (selected) =>
    `px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
      selected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`;

  return (
    <div className="text-slate-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {[[true, Hammer, 'Installed by our crew', 'Plants, planting, site prep & delivery'],
          [false, ShoppingBag, "Plants only, I'll plant them", 'Plants delivered to your door']].map(([value, Icon, title, sub]) => (
          <button key={title} type="button" onClick={() => switchMode(value)}
            className={`flex items-start gap-3 text-left p-3 rounded-xl border cursor-pointer transition-colors ${
              install === value ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
            <Icon size={18} className={install === value ? 'text-emerald-600 mt-0.5' : 'text-slate-400 mt-0.5'} />
            <span>
              <span className="block text-sm font-bold text-slate-800">{title}</span>
              <span className="block text-xs text-slate-500">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {suggested && (
          <button type="button" onClick={() => onRangeChange({ min: suggested.low, max: suggested.high })}
            className={`${chip(Number(range.min) === suggested.low && Number(range.max) === suggested.high)} inline-flex items-center gap-1`}>
            <Sparkles size={12} /> Typical for your yard: {peso(suggested.low)} – {peso(suggested.high)}
          </button>
        )}
        {bands.map(b => (
          <button key={b.label} type="button" onClick={() => onRangeChange({ min: b.min, max: b.max })} className={chip(isSel(b))}>
            {b.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-500" htmlFor="budget-min">From</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₱</span>
          <input id="budget-min" type="number" min="1000" step="1000" required value={range.min}
            onChange={e => onRangeChange({ ...range, min: e.target.value })}
            className="w-32 pl-6 pr-2 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400" />
        </div>
        <label className="text-xs font-semibold text-slate-500" htmlFor="budget-max">to</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₱</span>
          <input id="budget-max" type="number" min="1000" step="1000" required value={range.max}
            onChange={e => onRangeChange({ ...range, max: e.target.value })}
            className="w-32 pl-6 pr-2 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400" />
        </div>
      </div>

      {invalid ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mt-2 mb-0"><AlertTriangle size={13} /> The first amount must be lower than the second.</p>
      ) : explain && (
        <p className={`text-xs font-medium mt-2 mb-0 leading-relaxed ${explain.ok ? 'text-slate-500' : 'text-red-600'}`}>{explain.text}</p>
      )}
      <p className="text-xs text-slate-400 mt-1 mb-0">
        You'll get three designs across your range: Minimalist near the low end, Symmetrical in the middle, Lush at the top.
      </p>
    </div>
  );
}
