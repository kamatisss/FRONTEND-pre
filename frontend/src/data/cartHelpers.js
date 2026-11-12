// Small cart helpers shared by CartContext and the Shop (kept out of CartContext.jsx so that
// file exports only the provider and its hook, which React Fast Refresh needs).

// How many of a product the cart may hold: its stock, or no limit when stock isn't known
export function stockLimit(product) {
    const n = Number(product?.stock_quantity);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : Infinity;
}

const peso = (n) => `₱${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// One line of text for a change syncCart reported
export function describeCartChange(c) {
    switch (c.kind) {
        case 'gone': return `${c.name} is no longer sold, so we took it out of your cart.`;
        case 'soldout': return `${c.name} just sold out, so we took it out of your cart.`;
        case 'reduced': return `Only ${c.quantity} ${c.name} left, so your cart now has ${c.quantity}.`;
        case 'price': return `${c.name} is now ${peso(c.to)} each (was ${peso(c.from)}).`;
        default: return '';
    }
}
