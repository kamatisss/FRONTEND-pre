import { useState, useRef, useEffect, useCallback } from 'react';
import { useDesign } from '../context/DesignContext';
import {
  ShoppingCart, X, CreditCard, Loader2, Truck,
  Pencil, Trash2, Leaf, GripVertical, Minus,
  ChevronUp, ChevronDown, Package,
} from 'lucide-react';
import { submitOrder, createCheckoutSession } from '../services/api';

/* ─────────────────────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────────────────────── */
const STYLE_ID = 'psp-global-styles-v2';
if (typeof document !== 'undefined') {
  let s = document.getElementById(STYLE_ID);
  if (!s) {
    s = document.createElement('style');
    s.id = STYLE_ID;
    document.head.appendChild(s);
  }
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    @keyframes psp-panelIn {
      from { opacity: 0; transform: scale(0.97) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes psp-modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes psp-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes psp-rowIn {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes psp-pillFloat {
      0%, 100% { transform: translateY(0px); box-shadow: 0 8px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(16,185,129,0.2); }
      50%       { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(15,23,42,0.12), 0 0 0 1px rgba(16,185,129,0.35); }
    }
    @keyframes psp-badgePop {
      0%   { transform: scale(0.6); opacity: 0; }
      70%  { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes psp-shimmer {
      from { background-position: -200% center; }
      to   { background-position: 200% center; }
    }

    .psp-root * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }

    /* Scrollbar */
    .psp-scroll::-webkit-scrollbar { width: 3px; }
    .psp-scroll::-webkit-scrollbar-track { background: transparent; }
    .psp-scroll::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.25); border-radius: 99px; }
    .psp-scroll::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.5); }

    /* Row */
    .psp-item-row {
      animation: psp-rowIn 0.24s cubic-bezier(.22,1,.36,1) both;
      transition: background 0.15s;
    }
    .psp-item-row:hover { background: #f8fafc !important; }

    /* Icon buttons */
    .psp-icon-btn {
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s cubic-bezier(.22,1,.36,1);
      position: relative;
    }
    .psp-icon-btn:hover { transform: scale(1.1); }
    .psp-icon-btn:active { transform: scale(0.93); }

    /* Tooltip */
    .psp-tooltip {
      position: absolute;
      bottom: calc(100% + 7px);
      left: 50%; transform: translateX(-50%);
      background: rgba(15,23,42,0.95);
      color: #fff; font-size: 10px; font-weight: 600;
      padding: 4px 9px; border-radius: 6px;
      white-space: nowrap; pointer-events: none;
      opacity: 0; transition: opacity 0.15s;
      z-index: 300;
      letter-spacing: 0.03em;
    }
    .psp-icon-btn:hover .psp-tooltip { opacity: 1; }

    /* Pill trigger */
    .psp-pill {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 10px 10px 16px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px) saturate(1.5);
      -webkit-backdrop-filter: blur(20px) saturate(1.5);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 99px;
      cursor: pointer;
      animation: psp-pillFloat 3s ease-in-out infinite;
      user-select: none;
    }
    .psp-pill:hover {
      animation: none;
      transform: scale(1.02);
      border-color: rgba(16,185,129,0.5);
      box-shadow: 0 12px 40px rgba(15,23,42,0.12), 0 0 0 1px rgba(16,185,129,0.35);
    }
    .psp-pill:active { transform: scale(0.98); }

    /* Checkout button */
    .psp-checkout-btn {
      width: 100%; padding: 13px 20px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #fff; border: none; border-radius: 12px;
      font-weight: 800; font-size: 0.78rem; letter-spacing: 0.07em; text-transform: uppercase;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 9px;
      box-shadow: 0 4px 20px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.2);
      transition: all 0.2s cubic-bezier(.34,1.56,.64,1);
      position: relative; overflow: hidden;
    }
    .psp-checkout-btn::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
      opacity: 0; transition: opacity 0.2s;
    }
    .psp-checkout-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
    .psp-checkout-btn:hover::after { opacity: 1; }
    .psp-checkout-btn:active { transform: translateY(0); }
    .psp-checkout-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* Submit button */
    .psp-submit-btn {
      width: 100%; padding: 14px 20px; border: none; border-radius: 12px;
      font-weight: 800; font-size: 0.78rem; letter-spacing: 0.07em; text-transform: uppercase;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
      transition: all 0.2s cubic-bezier(.34,1.56,.64,1);
      position: relative; overflow: hidden;
    }
    .psp-submit-btn::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
      opacity: 0; transition: opacity 0.2s;
    }
    .psp-submit-btn:hover { transform: translateY(-2px); }
    .psp-submit-btn:hover::after { opacity: 1; }
    .psp-submit-btn:active { transform: translateY(0); }
    .psp-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* Input fields */
    .psp-field {
      width: 100%; padding: 11px 14px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px; color: #0f172a;
      font-size: 0.85rem; font-weight: 500; outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .psp-field::placeholder { color: #94a3b8; }
    .psp-field:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
      background: #ffffff;
    }

    /* Payment card */
    .psp-pay-card {
      flex: 1; padding: 14px 10px; border-radius: 12px; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      transition: all 0.2s cubic-bezier(.22,1,.36,1);
    }
    .psp-pay-card:hover { transform: translateY(-1px); }
  `;
}

/* ─────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS — kept in sync with system palette
───────────────────────────────────────────────────────────────────────── */
const C = {
  // Surfaces
  panel:       'rgba(255, 255, 255, 0.98)',
  panelBorder: '#cbd5e1',
  header:      '#f8fafc',
  surface:     '#f1f5f9',
  surfaceHov:  '#e2e8f0',
  // Brand green
  green:       '#10b981',
  greenDark:   '#059669',
  greenDeep:   '#047857',
  greenDim:    '#ecfdf5',
  greenDimBdr: '#a7f3d0',
  greenGlow:   'rgba(16, 185, 129, 0.15)',
  // Text
  text:        '#0f172a',
  textMid:     '#475569',
  textDim:     '#64748b',
  // Danger
  red:         '#ef4444',
  redDim:      '#fef2f2',
  // Borders
  border:      '#e2e8f0',
  borderMid:   '#cbd5e1',
  // Mono font
  mono:        '"Courier New", ui-monospace, monospace',
};

/* ─────────────────────────────────────────────────────────────────────────
   SMALL SHARED ATOMS
───────────────────────────────────────────────────────────────────────── */
const Label = ({ children, style }) => (
  <span style={{
    fontSize: 9.5, fontWeight: 700, color: C.textDim,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    ...style,
  }}>{children}</span>
);

const IconBtn = ({ onClick, bg, color, tooltip, size = 28, radius = 8, children }) => (
  <button
    className="psp-icon-btn"
    onClick={onClick}
    style={{ width: size, height: size, borderRadius: radius, background: bg, color }}
  >
    {children}
    {tooltip && <span className="psp-tooltip">{tooltip}</span>}
  </button>
);

/* color dot for items — cycles through nature-ish hues */
const hues = [142, 160, 120, 175, 100, 195, 80];
const Dot = ({ i }) => (
  <span style={{
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
    background: `hsl(${hues[i % hues.length]}, 60%, 52%)`,
  }} />
);

/* ─────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────── */
export default function ProjectSummaryPanel() {
  const { totalCost, costBreakdown, state, dispatch } = useDesign();
  const { placedItems } = state;

  /* ── UI state ── */
  const [minimized, setMinimized]       = useState(false);
  const [collapsed, setCollapsed]       = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData]         = useState({ name: '', email: '', phone: '', address: '' });
  const [payMethod, setPayMethod]       = useState('stripe');
  const [loading, setLoading]           = useState(false);

  /* ── Drag ── */
  const panelRef  = useRef(null);
  const drag      = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current.active) return;
      setPos({
        x: drag.current.ox + (e.clientX - drag.current.sx),
        y: drag.current.oy + (e.clientY - drag.current.sy),
      });
    };
    const onUp = () => { drag.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  /* ── Handlers ── */
  const handleEdit = (itemId) => dispatch({ type: 'START_EDITING', payload: itemId });

  const handleRemoveAll = (itemName) =>
    placedItems.filter(p => p.name === itemName).forEach(p =>
      dispatch({ type: 'REMOVE_ITEM', payload: p.id })
    );

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!placedItems.length) return;
    setLoading(true);
    try {
      const items = costBreakdown.map(item => {
        const product = state.products?.find(p => p.name === item.name);
        return { id: product?.id ?? null, quantity: item.quantity };
      }).filter(i => i.id !== null);

      const orderPayload = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        customer_address: formData.address,
        payment_method: payMethod,
        total_price: totalCost,
        items,
      };

      const orderResult = await submitOrder(orderPayload);

      if (payMethod === 'stripe') {
        const sessionData = await createCheckoutSession(orderResult.order_id);
        dispatch({ type: 'CLEAR_DESIGN' });
        window.location.href = sessionData.checkout_url;
      } else {
        dispatch({ type: 'CLEAR_DESIGN' });
        setShowCheckout(false);
        setMinimized(false);
        setFormData({ name: '', email: '', phone: '', address: '' });
        alert('🌿 Order confirmed! Your garden will be delivered. Pay on arrival.');
        setLoading(false);
      }
    } catch (err) {
      alert(`Checkout failed: ${err.message}`);
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PILL (collapsed) STATE
  ═══════════════════════════════════════════════════════════ */
  if (collapsed) {
    return (
      <div
        className="psp-root"
        style={{
          position: 'absolute', bottom: 0, right: 0,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          userSelect: 'none',
        }}
      >
        <div className="psp-pill" onClick={() => setCollapsed(false)}>
          {/* Brand icon */}
          <span style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
          }}>
            <Leaf size={15} color="#fff" />
          </span>

          {/* Cost + count */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
              ₱{totalCost.toLocaleString()}
            </span>
            <span style={{ fontSize: 9.5, color: C.textDim, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>
              {placedItems.length} {placedItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* CTA chip */}
          <span style={{
            background: 'linear-gradient(135deg, #059669, #10b981)',
            color: '#fff', fontSize: 10, fontWeight: 800,
            borderRadius: 99, padding: '5px 12px',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
            whiteSpace: 'nowrap',
          }}>
            View
          </span>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     FULL PANEL
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="psp-root">
      {/* ── PANEL ── */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute', bottom: 0, right: 0,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          width: 358,
          background: C.panel,
          backdropFilter: 'blur(24px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 18,
          boxShadow: `0 20px 60px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.6)`,
          overflow: 'hidden',
          animation: 'psp-panelIn 0.3s cubic-bezier(.22,1,.36,1) both',
          userSelect: 'none',
        }}
      >
        {/* ── HEADER ── */}
        <div
          onMouseDown={onDragStart}
          style={{
            padding: '13px 14px 13px 12px',
            background: C.header,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 9,
            cursor: 'grab',
          }}
        >
          {/* Drag grip */}
          <span style={{ color: C.textDim, display: 'flex', padding: '0 2px', opacity: 0.5 }}>
            <GripVertical size={14} />
          </span>

          {/* Icon */}
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
          }}>
            <Package size={14} color="#fff" />
          </div>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Project Summary
            </p>
            <p style={{ margin: 0, marginTop: 2, fontSize: 9.5, color: C.textDim, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {placedItems.length} {placedItems.length === 1 ? 'item' : 'items'} selected
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 5 }}>
            <IconBtn
              onClick={() => setMinimized(m => !m)}
              bg={C.surface} color={C.textMid}
              tooltip={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <ChevronDown size={13} /> : <Minus size={13} />}
            </IconBtn>
            <IconBtn
              onClick={() => setCollapsed(true)}
              bg={C.surface} color={C.textMid}
              tooltip="Compact view"
            >
              <ChevronUp size={13} />
            </IconBtn>
          </div>
        </div>

        {/* ── BODY (collapses on minimize) ── */}
        <div style={{
          maxHeight: minimized ? 0 : 560,
          overflow: 'hidden',
          transition: 'max-height 0.38s cubic-bezier(.22,1,.36,1)',
        }}>

          {/* Item list */}
          <div className="psp-scroll" style={{ maxHeight: 272, overflowY: 'auto' }}>
            {placedItems.length === 0 ? (
              /* Empty state */
              <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: C.greenDim, border: `1px solid ${C.greenDimBdr}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Leaf size={24} color={C.green} style={{ opacity: 0.65 }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: C.textMid }}>
                  Your garden is empty
                </p>
                <p style={{ margin: '5px 0 0', fontSize: '0.73rem', color: C.textDim, fontStyle: 'italic', lineHeight: 1.5 }}>
                  Place plants from the library to start designing
                </p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 44px 76px',
                  padding: '7px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  {[['Item', 'left'], ['Qty', 'center'], ['Total', 'right']].map(([h, align]) => (
                    <Label key={h} style={{ textAlign: align }}>{h}</Label>
                  ))}
                </div>

                {/* Rows */}
                {costBreakdown.map((item, i) => (
                  <div
                    key={item.name + i}
                    className="psp-item-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 44px 76px',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: `1px solid ${C.border}`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  >
                    {/* Name + actions */}
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                        <Dot i={i} />
                        <span style={{
                          fontSize: '0.8rem', fontWeight: 700, color: C.text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          letterSpacing: '-0.015em',
                        }}>
                          {item.name}
                        </span>
                      </div>
                      {/* Action row */}
                      <div style={{ display: 'flex', gap: 5, paddingLeft: 14 }}>
                        <IconBtn
                          onClick={() => {
                            const found = placedItems.find(p => p.name === item.name);
                            if (found) handleEdit(found.id);
                          }}
                          bg={C.greenDim} color={C.green}
                          size={26} radius={7}
                          tooltip="Edit placement"
                        >
                          <Pencil size={10} />
                        </IconBtn>
                        <IconBtn
                          onClick={() => handleRemoveAll(item.name)}
                          bg={C.redDim} color={C.red}
                          size={26} radius={7}
                          tooltip="Remove all"
                        >
                          <Trash2 size={10} />
                        </IconBtn>
                      </div>
                    </div>

                    {/* Qty */}
                    <div style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: 8,
                        background: C.greenDim, border: `1px solid ${C.greenDimBdr}`,
                        fontSize: '0.75rem', fontWeight: 800, color: C.green,
                      }}>
                        {item.quantity}
                      </span>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.8rem', fontWeight: 800,
                        color: C.green, fontFamily: C.mono,
                        letterSpacing: '-0.02em',
                      }}>
                        ₱{item.subtotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── FOOTER ── */}
          {placedItems.length > 0 && (
            <div style={{ padding: '14px 14px 16px', borderTop: `1px solid ${C.border}` }}>

              {/* Total row */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 14px',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                border: `1px solid ${C.greenDimBdr}`,
                borderRadius: 12,
                marginBottom: 11,
              }}>
                <div>
                  <Label style={{ color: C.greenDark }}>Total Estimate</Label>
                  <p style={{ margin: '3px 0 0', fontSize: 9.5, color: C.textDim, fontWeight: 500 }}>
                    {costBreakdown.length} line{costBreakdown.length !== 1 ? 's' : ''} · incl. VAT
                  </p>
                </div>
                <span style={{
                  fontSize: '1.5rem', fontWeight: 900,
                  color: C.greenDark, fontFamily: C.mono,
                  letterSpacing: '-0.04em', lineHeight: 1,
                }}>
                  ₱{totalCost.toLocaleString()}
                </span>
              </div>

              {/* Checkout CTA */}
              <button
                className="psp-checkout-btn"
                onClick={() => setShowCheckout(true)}
              >
                <ShoppingCart size={15} strokeWidth={2.5} />
                Checkout &amp; Order
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CHECKOUT MODAL
      ═══════════════════════════════════════════════════════════ */}
      {showCheckout && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(15,23,42,0.4)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCheckout(false); }}
        >
          <div style={{
            background: '#ffffff',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${C.panelBorder}`,
            borderRadius: 22,
            width: '100%', maxWidth: 440,
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 32px 80px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
            overflow: 'hidden',
            animation: 'psp-modalIn 0.28s cubic-bezier(.22,1,.36,1) both',
          }}>

            {/* Modal header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.25)',
                }}>
                  <ShoppingCart size={18} color="#fff" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: C.text, letterSpacing: '-0.025em' }}>
                    Complete Order
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 9.5, color: C.textDim, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Garden Studio
                  </p>
                </div>
              </div>

              <IconBtn
                onClick={() => setShowCheckout(false)}
                bg={C.surface} color={C.textMid}
                size={34} radius={10}
                tooltip="Close"
              >
                <X size={15} />
              </IconBtn>
            </div>

            {/* Scrollable form body */}
            <form
              onSubmit={handleCheckout}
              className="psp-scroll"
              style={{ padding: '20px 20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {/* Section label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: -4,
              }}>
                <Label>Delivery details</Label>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>

              {/* Full name */}
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  <Label>Full Name</Label>
                </label>
                <input
                  required type="text" className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
                  value={formData.name} placeholder="Juan dela Cruz"
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Email + Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6 }}><Label>Email</Label></label>
                  <input
                    required type="email" className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
                    value={formData.email} placeholder="juan@email.com"
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6 }}><Label>Phone</Label></label>
                  <input
                    required type="tel" className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
                    value={formData.phone} placeholder="09XX XXX XXXX"
                    onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}><Label>Delivery Address</Label></label>
                <textarea
                  required rows={2} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
                  value={formData.address} placeholder="123 Garden St, Brgy. Halaman…"
                  onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Label>Payment Method</Label>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>

              {/* Payment cards */}
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  {
                    id: 'stripe',
                    icon: <CreditCard size={20} />,
                    label: 'Online Payment',
                    sub: 'Visa · GCash · Maya',
                  },
                  {
                    id: 'cod',
                    icon: <Truck size={20} />,
                    label: 'Cash on Delivery',
                    sub: 'Pay upon arrival',
                  },
                ].map(({ id, icon, label, sub }) => {
                  const active = payMethod === id;
                  return (
                    <div
                      key={id}
                      className="psp-pay-card"
                      onClick={() => setPayMethod(id)}
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
                          : C.surface,
                        border: `1.5px solid ${active ? C.greenDimBdr : C.border}`,
                        boxShadow: active ? `0 0 0 1px ${C.green}18, 0 4px 16px rgba(16,185,129,0.08)` : 'none',
                      }}
                    >
                      {/* Radio dot */}
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: active ? `4px solid ${C.green}` : `1.5px solid ${C.borderMid}`,
                        transition: 'all 0.18s',
                      }} />
                      {/* Icon */}
                      <div style={{
                        width: 38, height: 38, borderRadius: 11,
                        background: active
                          ? 'linear-gradient(135deg, #059669, #10b981)'
                          : C.surface,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: active ? '#fff' : C.textDim,
                        transition: 'all 0.2s',
                        boxShadow: active ? '0 3px 10px rgba(16,185,129,0.25)' : 'none',
                      }}>
                        {icon}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: active ? C.text : C.textMid, lineHeight: 1.2 }}>
                          {label}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 9.5, color: C.textDim, fontWeight: 500 }}>
                          {sub}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Amount due box */}
              <div style={{
                padding: '14px 18px',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                border: `1px solid ${C.greenDimBdr}`,
                borderRadius: 13,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 6px 24px rgba(16,185,129,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}>
                <div>
                  <Label style={{ color: C.greenDark }}>Amount Due</Label>
                  <p style={{ margin: '3px 0 0', fontSize: 9.5, color: C.textMid, fontWeight: 500 }}>
                    {placedItems.length} items · {payMethod === 'cod' ? 'Pay on delivery' : 'Pay now'}
                  </p>
                </div>
                <span style={{
                  fontSize: '1.45rem', fontWeight: 900,
                  color: C.greenDark, fontFamily: C.mono,
                  letterSpacing: '-0.04em', lineHeight: 1,
                }}>
                  ₱{totalCost.toLocaleString()}
                </span>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="psp-submit-btn"
                style={{
                  background: payMethod === 'cod'
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                  color: '#fff',
                  boxShadow: payMethod === 'cod'
                    ? '0 6px 20px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.12)'
                    : '0 6px 20px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.12)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={17} style={{ animation: 'psp-spin 0.8s linear infinite' }} />
                    Processing…
                  </>
                ) : payMethod === 'stripe' ? (
                  <><CreditCard size={16} strokeWidth={2.5} /> Pay Securely Online</>
                ) : (
                  <><Truck size={16} strokeWidth={2.5} /> Confirm — Pay on Delivery</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}