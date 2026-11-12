// Mirrors backend/apps/library/pricing.py — keep the two in sync.

// Installed by our crew: a full garden makeover (site prep, bed soil, a lawn) or planting into the
// customer's existing garden (compost per planting hole, no ground work).
export const MAKEOVER = 'makeover';
export const EXISTING = 'existing';

// (prepared m², bed m², new-turf m²): beds get soil & mulch, a new lawn gets turf, keeping the
// existing grass leaves the lawn untouched. No lawn (the default): the whole area is beds.
export function groundAreas(areaSqm, lawnSqm = 0, newLawn = true) {
  const area = Math.max(0, Number(areaSqm) || 0);
  const lawn = Math.min(area, Math.max(0, Number(lawnSqm) || 0));
  const beds = area - lawn;
  return [newLawn ? area : beds, beds, newLawn ? lawn : 0];
}

// Costs that don't depend on what is planted: site prep, soil & mulch, a new lawn, plus mobilisation.
// Planting into an existing garden: mobilisation only (its compost is per planting hole).
export function fixedCosts(rates, areaSqm, lawnSqm = 0, newLawn = true, scope = MAKEOVER) {
  if (scope === EXISTING) return Number(rates.mobilization_fee);
  const [prepared, beds, turf] = groundAreas(areaSqm, lawnSqm, newLawn);
  return Number(rates.site_prep_per_sqm) * prepared + Number(rates.materials_per_sqm) * beds
    + Number(rates.turf_per_sqm || 0) * turf + Number(rates.mobilization_fee);
}

// How much of an all-in budget is left for plants *including planting labour*
// (after VAT if registered, the design fee, and the fixed costs).
export function plantBudgetFromAllIn(budget, areaSqm, rates, lawnSqm = 0, newLawn = true, scope = MAKEOVER) {
  let b = Number(budget);
  if (rates.vat_registered) b /= 1 + Number(rates.vat_percent) / 100;
  b /= 1 + Number(rates.design_fee_percent) / 100;
  return Math.max(0, Math.floor(b - fixedCosts(rates, areaSqm, lawnSqm, newLawn, scope)));
}

// Pre-fee, pre-VAT amount → what the customer pays.
export function allIn(amount, rates) {
  const withFee = amount * (1 + Number(rates.design_fee_percent) / 100);
  return rates.vat_registered ? withFee * (1 + Number(rates.vat_percent) / 100) : withFee;
}

// Labour size class (pricing.layer_of): plants by their ESTABLISHED height (real_world_size), not the
// fully grown height the layout engine uses for spacing; anything that isn't a plant is 'other'.
// pricing.SMALL_STONE / STONE_LABOUR_SHARE: hardscape under 35 cm is a small garden stone, placed for a fifth of
// the labour of setting a boulder
export const SMALL_STONE = 0.35;
const STONE_LABOUR_SHARE = 0.2;
// garden_ai.rock_limits: most of one kind of rock for a yard of this area (m²): an accent boulder per ~12 m² (3–30),
// a small garden stone per m² (24–300)
export function rockLimits(areaSqm) {
  const a = Math.max(0, Number(areaSqm) || 0);
  return { boulders: Math.max(3, Math.min(30, Math.round(a / 12))), stones: Math.max(24, Math.min(300, Math.round(a))) };
}
export const isSmallStone = (item) => item?.category === 'hardscape' && (Number(item.real_world_size) || 1) < SMALL_STONE;

export function labourLayer(item) {
  if (item?.is_groundcover) return 'low';   // pricing.layer_of 'groundcover': planting_low per m²
  if (isSmallStone(item)) return 'stone';
  if ((item.category || 'plant') !== 'plant') return 'other';
  const h = Number(item.real_world_size) || 1;
  return h >= 2.5 ? 'tall' : h >= 0.8 ? 'mid' : 'low';
}

// pricing.installed_price: catalog price + planting labour (+ planting-hole compost in an existing garden)
export function installedPrice(rates, item, scope = MAKEOVER) {
  const layer = labourLayer(item);
  const labour = layer === 'stone' ? Math.round(Number(rates.install_other || 0) * STONE_LABOUR_SHARE * 100) / 100
    : { tall: rates.planting_tall, mid: rates.planting_mid, low: rates.planting_low }[layer] ?? rates.install_other;
  const compost = scope === EXISTING && (item.category || 'plant') === 'plant' ? Number(rates.compost_per_plant || 0) : 0;
  return Math.round(Number(item.unit_price) + Number(labour) + compost);
}

// What one more of this item adds to the customer's total: installed (with the design fee and VAT) or,
// plants only, its catalog price. Approximate near the minimum project charge, which absorbs small additions.
export function itemCostToCustomer(rates, item, { install = true, scope = MAKEOVER } = {}) {
  if (!install || !rates) return Math.round(Number(item.unit_price));
  return Math.round(allIn(installedPrice(rates, item, scope), rates));
}


// ─── How the AI Designer treats an item (mirrors layout_engine.py; keep in sync) ─────────────
// Layer by FULLY GROWN height (PlantSpec.layer): tall = back of the beds, low = front border.
// Pricing's labourLayer above uses the established height instead — the two can differ on purpose.
export const LAYOUT_MIN_SPACING = 0.3;
export const LAYOUT_MAX_SPACING = 4.0;
export function grownHeight(item) {
  return Math.max(Number(item.real_world_size) || 1, Number(item.mature_height) || 0);
}
export function layoutLayer(item) {
  const g = grownHeight(item);
  return g >= 2.5 ? 'tall' : g >= 0.8 ? 'mid' : 'low';
}
// layout_engine.spacing_for: centre-to-centre metres, explicit spacing_cm wins
export function layoutSpacing(item) {
  const cm = Number(item.spacing_cm);
  const clamp = (m) => Math.max(LAYOUT_MIN_SPACING, Math.min(LAYOUT_MAX_SPACING, m));
  if (cm) return clamp(Math.abs(cm) / 100);
  // toFixed rounds the exact binary value, like Python's round() (1.575 → 1.57, not 1.58)
  return Number(clamp(0.55 * grownHeight(item) + 0.2).toFixed(2));
}
