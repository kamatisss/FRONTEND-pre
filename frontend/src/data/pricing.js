// Mirrors backend/apps/library/pricing.py — keep the two in sync.

// Costs that don't depend on what is planted: site prep + materials per m², plus mobilisation.
export const fixedCosts = (rates, areaSqm) =>
  (Number(rates.site_prep_per_sqm) + Number(rates.materials_per_sqm)) * Math.max(0, areaSqm) + Number(rates.mobilization_fee);

// How much of an all-in budget is left for plants *including planting labour*
// (after VAT if registered, the design fee, and the fixed costs).
export function plantBudgetFromAllIn(budget, areaSqm, rates) {
  let b = Number(budget);
  if (rates.vat_registered) b /= 1 + Number(rates.vat_percent) / 100;
  b /= 1 + Number(rates.design_fee_percent) / 100;
  return Math.max(0, Math.floor(b - fixedCosts(rates, areaSqm)));
}

// Pre-fee, pre-VAT amount → what the customer pays.
export function allIn(amount, rates) {
  const withFee = amount * (1 + Number(rates.design_fee_percent) / 100);
  return rates.vat_registered ? withFee * (1 + Number(rates.vat_percent) / 100) : withFee;
}
