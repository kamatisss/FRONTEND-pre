import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, Leaf, ShoppingBag, ClipboardList, CreditCard, Loader2 } from 'lucide-react';
import { getOrderReceipt, createCheckoutSession } from '../services/api';
import { usePageScroll } from './ui/usePageScroll';

const POLL_MS = 3000;
const MAX_POLLS = 10; // ~30s for the GCash/Maya confirmation to reach us

// Header look per state; the payment state always comes from the server, never the URL
const HEADERS = {
  paid:      { Icon: CheckCircle, bg: 'from-emerald-600 to-emerald-500', title: 'Payment Received!', sub: 'Thank you! Your order is paid and will be prepared for delivery.' },
  cod:       { Icon: CheckCircle, bg: 'from-emerald-600 to-emerald-500', title: 'Order Confirmed!', sub: 'Your garden order has been placed and is awaiting processing.' },
  checking:  { Icon: Clock,       bg: 'from-sky-600 to-sky-500',         title: 'Confirming Payment…', sub: 'Waiting for confirmation from your e-wallet or bank. This takes a few seconds.' },
  unpaid:    { Icon: Clock,       bg: 'from-amber-500 to-amber-400',     title: 'Payment Not Completed', sub: 'Your order is saved. Finish paying to confirm it.' },
  expired:   { Icon: XCircle,     bg: 'from-slate-600 to-slate-500',     title: 'Order Expired', sub: 'This order was not paid in time and has been cancelled.' },
};

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId   = searchParams.get('order_id');
  const token     = searchParams.get('token');
  const cancelled = searchParams.get('cancelled') === '1';

  const [order, setOrder]     = useState(null);
  const [error, setError]     = useState('');
  const [polls, setPolls]     = useState(0);
  const [paying, setPaying]   = useState(false);
  const [payError, setPayError] = useState('');
  usePageScroll();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!orderId) { setError('No order to show.'); return; }
    getOrderReceipt(orderId, token).then(setOrder).catch(e => setError(e.message));
  }, [orderId, token]);

  // Coming back from PayMongo, the payment can land a moment after the redirect
  const waiting = order && order.payment_method === 'online' && order.payment_status === 'Pending'
    && order.status !== 'Cancelled' && !cancelled && polls < MAX_POLLS;
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => {
      getOrderReceipt(orderId, token).then(setOrder).catch(() => {}).finally(() => setPolls(p => p + 1));
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [waiting, polls, orderId, token]);

  const handlePayNow = async () => {
    setPaying(true);
    setPayError('');
    try {
      const { checkout_url } = await createCheckoutSession(order.id);
      window.location.href = checkout_url;
    } catch (e) {
      setPayError(e.message);
      setPaying(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md p-8 text-center">
          <XCircle size={48} className="mx-auto text-slate-400 mb-3" />
          <h1 className="text-xl font-black text-slate-800 mb-2">Order not found</h1>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button onClick={() => navigate('/my-orders')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold border-none cursor-pointer">
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  const isCod = order.payment_method === 'cod';
  const state = order.payment_status === 'Paid' ? 'paid'
    : order.status === 'Cancelled' ? 'expired'
    : isCod ? 'cod'
    : waiting ? 'checking'
    : 'unpaid';
  const { Icon, bg, title, sub } = HEADERS[state];
  const placed = new Date(order.created_at);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center p-6">
        <div className="print-container bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden">

          {/* ── Header ── */}
          <div className={`bg-gradient-to-r ${bg} px-8 py-10 text-white text-center`}>
            <div className="flex justify-center mb-4">
              <Icon size={64} strokeWidth={1.5} className={`drop-shadow-lg ${state === 'checking' ? 'animate-pulse' : ''}`} />
            </div>
            <h1 className="text-3xl font-black mb-1">{title}</h1>
            <p className="text-white/80 text-sm">{sub}</p>
          </div>

          {/* ── Receipt Body ── */}
          <div className="px-8 py-6">

            {/* Brand */}
            <div className="flex items-center justify-center gap-2 mb-5">
              <Leaf size={20} className="text-emerald-600" />
              <span className="text-lg font-extrabold text-slate-800 tracking-tight">Garden Studio</span>
            </div>

            {/* Section label: Order Details */}
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
              Order Details
            </div>

            {/* Order Meta */}
            <div className="border border-dashed border-slate-200 rounded-2xl p-5 mb-6 space-y-3 bg-slate-50/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Order Number</span>
                <span className="font-bold text-slate-900">#{order.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Customer</span>
                <span className="font-bold text-slate-900">{order.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Placed</span>
                <span className="font-bold text-slate-900">
                  {placed.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}{' '}
                  {placed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Payment Method</span>
                <span className="font-bold text-slate-900">
                  {isCod ? 'Cash on Delivery (COD)' : 'Online (QR Ph / GCash / Maya / Card)'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Payment Status</span>
                <span className={`font-bold ${order.payment_status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {order.payment_status}
                </span>
              </div>
              {order.items.length > 0 && (
                <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                  {order.items.map((it, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{it.name}</span><span className="font-bold">×{it.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col gap-1.5 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 font-extrabold text-sm uppercase tracking-wider">
                  {state === 'paid' ? 'Total Paid' : 'Total Payable'}
                </span>
                <span className="text-2xl font-black text-emerald-600">
                  ₱{Number(order.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {state === 'cod' && (
                <div className="text-[10px] text-emerald-800/80 font-semibold border-t border-emerald-200 pt-1.5 mt-0.5 leading-normal">
                  * Please prepare the exact amount to be paid to the delivery driver upon arrival.
                </div>
              )}
            </div>

            {state === 'unpaid' && (
              <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
                {polls >= MAX_POLLS
                  ? "We haven't received the confirmation yet. If you already paid, it will update shortly; there's no need to pay twice."
                  : 'Unpaid online orders are cancelled after a while and the items go back on sale.'}
              </p>
            )}
            {payError && <p className="text-xs text-red-600 text-center mb-4">{payError}</p>}

            {/* ── Actions ── */}
            <div className="no-print flex flex-col gap-3">
              {state === 'unpaid' && (
                <button
                  onClick={handlePayNow}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-2xl font-bold transition-all shadow-md active:scale-95 border-none cursor-pointer"
                >
                  {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                  Pay Now with QR Ph / GCash / Maya / Card
                </button>
              )}
              <button
                onClick={() => navigate('/my-orders')}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer ${
                  state === 'unpaid'
                    ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border-none'
                }`}
              >
                <ClipboardList size={18} />
                View Orders
              </button>
              <button
                onClick={() => navigate('/shop')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer"
              >
                <ShoppingBag size={18} />
                Back to Shop
              </button>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 text-center">
            <p className="text-xs text-slate-400">
              Thank you for choosing <span className="font-bold text-emerald-600">Garden Studio</span>. Happy gardening! 🌿
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
