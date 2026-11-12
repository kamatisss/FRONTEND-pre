import { evaluatePlantCompatibility } from './plantCompatibility';

/*
 * "Goes well with" in the cart: a few in-stock products that suit the plants already in it.
 *
 * Built on the same rules as the AI Designer's compatibility warnings (plantCompatibility.js),
 * so a suggestion never starts a watering, sun or shade conflict there:
 *  - plants that would show up in a water / sunlight / canopy warning with the cart's plants are
 *    never suggested, and aggressive spreaders (bamboo) never are either; a cart that already has
 *    a spreader gets no plant suggestions (its roots crowd out neighbours without a barrier);
 *  - a plant that adds a missing height layer (tall at the back, middle, low at the front) ranks
 *    first; then same watering, then same sun; ratings break ties;
 *  - weak matches are left out rather than padded in;
 *  - one hardscape item rounds the list off when the cart has plants but no hardscape.
 * Each suggestion comes with the true reason it was picked.
 */

// Same thresholds as the canopy rule in plantCompatibility.js
const TALL = 3.0;
const LOW = 0.6;

const heightOf = (p) => Number(p.mature_height) || Number(p.real_world_size) || 1.0;
const layerOf = (p) => {
    const h = heightOf(p);
    return h >= TALL ? 'tall' : h <= LOW ? 'low' : 'mid';
};
const water = (p) => p.water_need || 'moderate';
const sun = (p) => p.sunlight || 'full_sun';
const isPlant = (p) => (p.category || 'plant') === 'plant';
const inStock = (p) => Number(p.stock_quantity) > 0 && p.is_active !== false;

const LAYER_REASON = {
    tall: 'Adds height at the back of your bed',
    mid: 'Fills the middle layer between your plants',
    low: 'Adds a low layer in front of your taller plants',
};

/**
 * @param cart     the cart lines ({ product, quantity })
 * @param catalog  the live shop list (/inventory/)
 * @returns up to `limit` of { product, reason }
 */
export function suggestForCart(cart, catalog, { limit = 3 } = {}) {
    if (!Array.isArray(cart) || !Array.isArray(catalog)) return [];
    const inCart = new Set(cart.map(l => String(l.product.id)));
    const cartPlants = cart.map(l => l.product).filter(isPlant);
    if (!cartPlants.length) return [];

    const layers = new Set(cartPlants.map(layerOf));
    const candidates = catalog.filter(p => !inCart.has(String(p.id)) && inStock(p));

    const plants = [];
    const hasSpreader = cartPlants.some(p => p.is_invasive);
    for (const p of hasSpreader ? [] : candidates.filter(isPlant)) {
        if (p.is_invasive) continue;
        const clashes = evaluatePlantCompatibility([...cartPlants, p])
            .some(w => w.affectedPlants.includes(p.name || 'Plant'));
        if (clashes) continue;

        // Must share watering with something in the cart (one hose, one schedule), and either add a
        // height layer the bed lacks or match a cart plant's sun and water exactly
        if (!cartPlants.some(c => water(c) === water(p))) continue;
        const twin = cartPlants.find(c => water(c) === water(p) && sun(c) === sun(p));
        const newLayer = !layers.has(layerOf(p));
        if (!newLayer && !twin) continue;

        const score = (newLayer ? 3 : 0) + (twin ? 1 : 0) + (Number(p.avg_rating) || 0) * 0.2;
        const reason = newLayer ? LAYER_REASON[layerOf(p)] : `Same sun and watering as your ${twin.name}`;
        plants.push({ product: p, reason, score });
    }
    plants.sort((a, b) => b.score - a.score);

    const hasHardscape = cart.some(l => l.product.category === 'hardscape');
    const hardscape = hasHardscape ? null : candidates
        .filter(p => p.category === 'hardscape')
        .sort((a, b) => (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0))[0];

    const picks = plants.slice(0, hardscape ? limit - 1 : limit).map(({ product, reason }) => ({ product, reason }));
    if (hardscape) picks.push({ product: hardscape, reason: 'Decorative stone to finish the bed around your plants' });
    return picks;
}
