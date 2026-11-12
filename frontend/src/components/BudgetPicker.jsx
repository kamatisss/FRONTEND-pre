import { createElement, useEffect, useState } from 'react';
import { Hammer, ShoppingBag, Sparkles, AlertTriangle, Shovel, Sprout } from 'lucide-react';
import { getBudgetSuggestion } from '../services/api';
import { plantBudgetFromAllIn, fixedCosts, allIn, MAKEOVER, EXISTING } from '../data/pricing';

/*
 * Budget as a range (e.g. ₱50K – ₱100K), in the same bands as the Project Hub's prices,
 * plus a "typical for your yard" suggestion from the rate card. Two modes:
 * installed by our crew (all-in) or plants only (the customer plants them). Installed has two scopes:
 * a full garden makeover (site prep, soil, a lawn) or planting into the customer's existing garden.
 * With the yard's size, the server also says what its beds can hold (GET /pricing/suggest/ capacity):
 * a budget far above that can't be spent on plants, so the customer is told before generating.
 */

const peso = (n) => `₱${Number(n).toLocaleString()}`;
const OVER = 1.15;   // range top this far above what the beds hold: say so

export default function BudgetPicker({ areaSqm, lotWidth, lotLength, install, onInstallChange, scope = MAKEOVER, onScopeChange,
  lawn = 'new', range, onRangeChange, rates }) {
  const [data, setData] = useState(null); // { bands, suggested, capacity } for the current mode, scope and yard
  const mode = install ? 'install' : 'plants';
  const width = Number(lotWidth) || 0, length = Number(lotLength) || 0;

  useEffect(() => {
    if (!(areaSqm > 0)) return undefined;
    const t = setTimeout(() => {
      const yard = width > 0 && length > 0 ? { width, length, scope, lawn } : {};
      getBudgetSuggestion(areaSqm, mode, yard).then(setData).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [areaSqm, mode, width, length, scope, lawn]);

  const bands = data?.bands || [];
  const suggested = data?.suggested;
  const capacity = data?.capacity;
  const isSel = (b) => Number(range.min) === b.min && Number(range.max) === b.max;
  const invalid = Number(range.min) > Number(range.max);

  // What the top of the range actually buys
  let explain = null;
  if (rates && areaSqm > 0 && !invalid) {
    if (install) {
      const basics = Math.round(allIn(fixedCosts(rates, areaSqm, 0, true, scope), rates));
      const forPlants = plantBudgetFromAllIn(range.max, areaSqm, rates, 0, true, scope);
      const what = scope === EXISTING ? 'Crew mobilisation' : 'Site prep, soil and delivery';
      explain = forPlants > 0
        ? { ok: true, text: `All-in. ${what} ${scope === EXISTING ? 'is' : 'are'} about ${peso(basics)}; up to ${peso(forPlants)} goes to plants & planting.` }
        : { ok: false, text: `Too small for this yard: ${what.toLowerCase()} alone ${scope === EXISTING ? 'is' : 'are'} about ${peso(basics)}.` };
    } else {
      explain = { ok: true, text: `Plants delivered to your door (${peso(rates.shipping_fee)} delivery). You plant them yourself.` };
    }
  }

  // More budget than the beds can take: designs stop when the beds are full
  const over = capacity && !invalid && Number(range.max) > capacity.total * OVER;
  const fitRange = capacity && {
    min: Math.min(Math.max(1000, Math.round(capacity.total * 0.6 / 1000) * 1000), Math.ceil(capacity.total / 1000) * 1000),
    max: Math.ceil(capacity.total / 1000) * 1000,
  };

  const switchMode = (nextInstall) => {
    if (nextInstall === install) return;
    onInstallChange(nextInstall);
    // Sensible starting range for each mode; the suggestion chip refines it
    onRangeChange(nextInstall ? { min: 50000, max: 100000 } : { min: 5000, max: 10000 });
  };

  const chip = (selected) =>
    `px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
      selected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`;
  const card = (on) => `flex items-start gap-3 text-left p-3 rounded-xl border cursor-pointer transition-colors ${
    on ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300'}`;

  return (
    <div className="text-slate-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {[[true, Hammer, 'Installed by our crew', 'Plants, planting & delivery by our crew'],
          [false, ShoppingBag, "Plants only, I'll plant them", 'Plants delivered to your door']].map(([value, Icon, title, sub]) => (
          <button key={title} type="button" onClick={() => switchMode(value)} aria-pressed={install === value} className={card(install === value)}>
            {createElement(Icon, { size: 18, className: install === value ? 'text-emerald-600 mt-0.5' : 'text-slate-400 mt-0.5' })}
            <span>
              <span className="block text-sm font-bold text-slate-800">{title}</span>
              <span className="block text-xs text-slate-500">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* What the crew does: the whole garden, or planting into a garden that's already there */}
      {install && onScopeChange && (
        <div role="radiogroup" aria-label="What our crew does" className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {[[MAKEOVER, Shovel, 'Full garden makeover', 'Clear & level, new soil, new lawn, then planting'],
            [EXISTING, Sprout, 'Plant into my existing garden', 'Planting with compost for each plant; no ground work']].map(([value, Icon, title, sub]) => (
            <button key={value} type="button" role="radio" aria-checked={scope === value} onClick={() => onScopeChange(value)} className={card(scope === value)}>
              {createElement(Icon, { size: 17, className: scope === value ? 'text-emerald-600 mt-0.5' : 'text-slate-400 mt-0.5' })}
              <span>
                <span className="block text-sm font-bold text-slate-800">{title}</span>
                <span className="block text-xs text-slate-500">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}

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
      {over && (
        <div role="note" className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <p className="m-0 flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>
              A {width} × {length} m garden's planting beds hold about <b>{capacity.plants} plants</b> at healthy spacing (the middle stays open as lawn):
              about <b>{peso(capacity.total)}</b> {install ? 'all-in for this job' : 'in plants with delivery'}. A bigger budget can't be spent on plants;
              the designs stop when the beds are full.
            </span>
          </p>
          <button type="button" onClick={() => onRangeChange(fitRange)}
            className="mt-2 min-h-[36px] px-3 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold cursor-pointer">
            Use {peso(fitRange.min)} – {peso(fitRange.max)}
          </button>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-1 mb-0">
        You'll get three styles for your budget (up to the top of your range). Each spends it its own way, and every
        plant and feature you pick is in all three.
      </p>
    </div>
  );
}
