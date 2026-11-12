import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE_URL as API_ROOT } from '../config';
import { stockLimit } from '../data/cartHelpers';

/*
 * The shop cart, saved in this browser per account (garden_studio_cart:<user id>), so people
 * sharing a phone never see each other's carts; signing out empties it on screen and the
 * next sign-in brings that person's own cart back. Other tabs stay in step.
 *
 * Each line keeps a copy of the product as it was when added. syncCart(products) refreshes
 * those copies from the live catalog and reports what changed (price, sold out, no longer
 * sold, fewer left), which the cart drawer shows as notices. Quantities never go past the
 * stock on hand; the server still checks stock and prices at checkout.
 *
 * Customers' carts are also saved on the server (/api/cart/, backend cart.py), so a cart filled on
 * the phone is there on the laptop. The browser copy shows at once and works offline; `dirty`
 * marks changes the shopper made here that the server hasn't stored yet. On sign-in: unsaved
 * changes here win (they're pushed up), otherwise the server's cart replaces the copy here.
 * Changes are pushed about a second after the last tap, and once more if the page is closed.
 * Catalog corrections (syncCart) never count as changes: every device makes the same ones.
 */

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const LEGACY_KEY = 'garden_studio_cart';   // one shared cart from before carts were per account
const keyFor = (user) => (user ? `garden_studio_cart:${user.user_id ?? user.username}` : null);
const sameId = (a, b) => String(a) === String(b);

function cleanItems(data) {
    if (!Array.isArray(data)) return [];
    return data
        .filter(i => i && i.product && i.product.id != null && Number(i.quantity) > 0)
        .map(i => ({ product: i.product, quantity: Math.floor(Number(i.quantity)) }));
}

// A damaged or blocked saved cart must never stop the app from loading.
// Saved as { items, dirty }; older saves were a bare array (never sent to the server, so dirty).
function readCart(key) {
    if (!key) return { items: [], dirty: false };
    try {
        const raw = localStorage.getItem(key) ?? localStorage.getItem(LEGACY_KEY);
        const data = raw ? JSON.parse(raw) : null;
        if (Array.isArray(data)) {
            const items = cleanItems(data);
            return { items, dirty: items.length > 0 };
        }
        return { items: cleanItems(data?.items), dirty: Boolean(data?.dirty) };
    } catch {
        return { items: [], dirty: false };
    }
}

function writeCart(key, items, dirty) {
    try {
        localStorage.setItem(key, JSON.stringify({ items, dirty }));
        localStorage.removeItem(LEGACY_KEY);   // now saved under this account
    } catch { /* storage full or blocked: the cart still works for this visit */ }
}

const toServer = (items) => items.map(i => ({ id: i.product.id, quantity: i.quantity }));

// The server's lines carry live product data; keep them within stock like every other change
function fromServer(lines) {
    return cleanItems(lines)
        .map(l => ({ ...l, quantity: Math.min(l.quantity, stockLimit(l.product)) }))
        .filter(l => l.quantity > 0);
}

export const CartProvider = ({ children }) => {
    const { user, authTokens } = useAuth();
    const key = keyFor(user);
    // Only customers shop; staff accounts never call the cart API
    const syncsWithServer = !!user && !user.is_staff && !user.is_superuser;

    const [state, setState] = useState(() => ({ key, ...readCart(key) }));
    const [notices, setNotices] = useState([]);
    let items = state.items;
    if (state.key !== key) {
        // Signed in, out, or as someone else: show that account's cart
        const next = { key, ...readCart(key) };
        setState(next);
        setNotices([]);
        items = next.items;
    }

    // Several adds in one handler (the AI Designer's plant list) must build on each other
    const itemsRef = useRef(items);
    useLayoutEffect(() => { itemsRef.current = items; }, [items]);
    // byShopper: a change the shopper made (to save on the server); false for catalog corrections
    const commit = useCallback((next, byShopper = true) => {
        itemsRef.current = next;
        setState(s => ({ ...s, items: next, dirty: s.dirty || byShopper }));
    }, []);

    useEffect(() => {
        if (state.key) writeCart(state.key, state.items, state.dirty);
    }, [state]);

    // Another tab changed this account's cart
    useEffect(() => {
        if (!key) return undefined;
        const onStorage = (e) => { if (e.key === key) setState({ key, ...readCart(key) }); };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [key]);

    /* ── Server copy ── */
    const tokenRef = useRef(authTokens?.access);
    useEffect(() => { tokenRef.current = authTokens?.access; }, [authTokens]);
    const stateRef = useRef(state);
    useLayoutEffect(() => { stateRef.current = state; }, [state]);
    const [loadedKey, setLoadedKey] = useState(null);   // the account whose server cart has been fetched
    const [retry, setRetry] = useState(0);

    const cartRequest = useCallback((method, body, extra = {}) => fetch(`${API_ROOT}/cart/`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: body ? JSON.stringify(body) : undefined,
        ...extra,
    }), []);

    // On sign-in: take the server's cart, unless this browser holds changes it hasn't stored yet
    useEffect(() => {
        if (!syncsWithServer || !key) return undefined;
        let cancelled = false;
        cartRequest('GET')
            .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
            .then(data => {
                if (cancelled) return;
                setState(s => {
                    if (s.key !== key || s.dirty) return s;   // unsaved changes here: they get pushed
                    const next = fromServer(data.items);
                    itemsRef.current = next;
                    return { ...s, items: next, dirty: false };
                });
            })
            .catch(() => { /* offline or signed out: keep the copy here */ })
            .finally(() => { if (!cancelled) setLoadedKey(key); });
        return () => { cancelled = true; };
    }, [key, syncsWithServer, cartRequest]);

    // Push the shopper's changes about a second after the last one
    useEffect(() => {
        if (!syncsWithServer || !state.dirty || loadedKey !== state.key) return undefined;
        const sent = state.items;
        const timer = setTimeout(() => {
            cartRequest('PUT', { items: toServer(sent) })
                .then(res => {
                    if (!res.ok) return;
                    // Saved, unless the shopper changed something meanwhile (that change pushes next)
                    setState(s => (s.items === sent ? { ...s, dirty: false } : s));
                })
                .catch(() => { /* offline: stays dirty, sent when back online or next visit */ });
        }, 900);
        return () => clearTimeout(timer);
    }, [state, loadedKey, syncsWithServer, cartRequest, retry]);

    // Back online: try again. Closing the page: send what hasn't been saved yet.
    useEffect(() => {
        if (!syncsWithServer) return undefined;
        const onOnline = () => setRetry(n => n + 1);
        const onHide = () => {
            const s = stateRef.current;
            if (s.dirty && s.key && tokenRef.current) {
                cartRequest('PUT', { items: toServer(s.items) }, { keepalive: true }).catch(() => {});
            }
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('pagehide', onHide);
        return () => { window.removeEventListener('online', onOnline); window.removeEventListener('pagehide', onHide); };
    }, [syncsWithServer, cartRequest]);

    /** Adds up to `quantity`, never past stock. Returns { added, quantity (now in cart), limited, available }. */
    const addToCart = useCallback((product, quantity = 1) => {
        const cur = itemsRef.current;
        const available = stockLimit(product);
        const existing = cur.find(i => sameId(i.product.id, product.id));
        const had = existing?.quantity || 0;
        const wanted = had + quantity;
        const finalQty = Math.min(wanted, available);
        const added = Math.max(0, finalQty - had);
        if (added > 0) {
            commit(existing
                ? cur.map(i => (i === existing ? { product, quantity: finalQty } : i))
                : [...cur, { product, quantity: finalQty }]);
        }
        return { added, quantity: Math.max(finalQty, had), limited: finalQty < wanted, available };
    }, [commit]);

    /** Removes a line. Returns what restoreItem needs to put it back (for "Undo"). */
    const removeFromCart = useCallback((productId) => {
        const cur = itemsRef.current;
        const index = cur.findIndex(i => sameId(i.product.id, productId));
        if (index < 0) return null;
        commit(cur.filter((_, i) => i !== index));
        return { item: cur[index], index };
    }, [commit]);

    const restoreItem = useCallback((removed) => {
        if (!removed?.item) return;
        const cur = itemsRef.current;
        if (cur.some(i => sameId(i.product.id, removed.item.product.id))) return;   // added again meanwhile
        const next = [...cur];
        next.splice(Math.min(removed.index, next.length), 0, removed.item);
        commit(next);
    }, [commit]);

    /** Sets a line's quantity (0 removes it), never past stock. Returns { quantity, limited, available }. */
    const updateQuantity = useCallback((productId, quantity) => {
        const cur = itemsRef.current;
        const line = cur.find(i => sameId(i.product.id, productId));
        if (!line) return { quantity: 0, limited: false, available: 0 };
        if (quantity <= 0) {
            commit(cur.filter(i => i !== line));
            return { quantity: 0, limited: false, available: stockLimit(line.product) };
        }
        const available = stockLimit(line.product);
        const finalQty = Math.min(quantity, available);
        if (finalQty !== line.quantity) commit(cur.map(i => (i === line ? { ...i, quantity: finalQty } : i)));
        return { quantity: finalQty, limited: finalQty < quantity, available };
    }, [commit]);

    const clearCart = useCallback(() => {
        commit([]);
        setNotices([]);
    }, [commit]);

    /** Shows changes at the top of the cart drawer until the shopper dismisses them. */
    const addCartNotices = useCallback((changes) => {
        if (changes?.length) setNotices(prev => [...prev, ...changes].slice(-6));
    }, []);
    const dismissCartNotices = useCallback(() => setNotices([]), []);

    /** Refreshes every line from the live catalog (active items only). Returns the changes. */
    const syncCart = useCallback((products) => {
        if (!Array.isArray(products)) return [];
        const byId = new Map(products.map(p => [String(p.id), p]));
        const changes = [];
        const next = [];
        for (const line of itemsRef.current) {
            const fresh = byId.get(String(line.product.id));
            const name = fresh?.name || line.product.name;
            if (!fresh) { changes.push({ kind: 'gone', name }); continue; }
            const available = stockLimit(fresh);
            if (available <= 0) { changes.push({ kind: 'soldout', name }); continue; }
            let quantity = line.quantity;
            if (quantity > available) { changes.push({ kind: 'reduced', name, quantity: available }); quantity = available; }
            const from = Number(line.product.unit_price);
            const to = Number(fresh.unit_price);
            if (Number.isFinite(from) && Number.isFinite(to) && Math.abs(from - to) >= 0.01) {
                changes.push({ kind: 'price', name, from, to });
            }
            next.push({ product: fresh, quantity });
        }
        commit(next, false);
        if (changes.length) addCartNotices(changes);
        return changes;
    }, [commit, addCartNotices]);

    const quantityInCart = useCallback(
        (productId) => items.find(i => sameId(i.product.id, productId))?.quantity || 0,
        [items],
    );

    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const cartSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.product.unit_price) || 0) * item.quantity, 0);

    const value = useMemo(() => ({
        cart: items,
        addToCart,
        removeFromCart,
        restoreItem,
        updateQuantity,
        clearCart,
        syncCart,
        quantityInCart,
        cartNotices: notices,
        addCartNotices,
        dismissCartNotices,
        cartCount,
        cartSubtotal,
    }), [items, notices, addToCart, removeFromCart, restoreItem, updateQuantity, clearCart, syncCart, quantityInCart, addCartNotices, dismissCartNotices, cartCount, cartSubtotal]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
