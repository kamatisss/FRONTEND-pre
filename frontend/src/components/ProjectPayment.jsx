import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, Leaf, CreditCard, Loader2, Shield } from 'lucide-react';
import { getProjectPayment, startProjectPayment } from '../services/api';

const POLL_MS = 3000;
const MAX_POLLS = 10; // ~30s for the e-wallet/bank confirmation to reach us

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Header look per state; the payment state always comes from the server, never the URL
const HEADERS = {
  pending:   { Icon: CreditCard,  bg: 'from-emerald-600 to-emerald-500', title: 'Project Payment' },
  checking:  { Icon: Clock,       bg: 'from-sky-600 to-sky-500',         title: 'Confirming Payment…' },
  paid:      { Icon: CheckCircle, bg: 'from-emerald-600 to-emerald-500', title: 'Payment Received!' },
  cancelled: { Icon: XCircle,     bg: 'from-slate-600 to-slate-500',     title: 'Payment Request Cancelled' },
};

/**
 * /pay/:token — the link staff send for a project downpayment or installment.
 * Works without logging in; each "Pay" opens a fresh PayMongo checkout.
 */
export default function ProjectPayment() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const returned = searchParams.get('done') === '1';
  const navigate = useNavigate();

  const [req, setReq]         = useState(null);
  const [error, setError]     = useState('');
  const [polls, setPolls]     = useState(0);
  const [paying, setPaying]   = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    getProjectPayment(token).then(setReq).catch(e => setError(e.message));
  }, [token]);

  // Back from PayMongo: the payment can land a moment after the redirect
  const waiting = req && req.status === 'PENDING' && returned && polls < MAX_POLLS;
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => {
      getProjectPayment(token).then(setReq).catch(() => {}).finally(() => setPolls(p => p + 1));
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [waiting, polls, token]);

  const handlePay = async () => {
    setPaying(true);
    setPayError('');
    try {
      const { checkout_url } = await startProjectPayment(token);
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
          <h1 className="text-xl font-black text-slate-800 mb-2">Payment link not found</h1>
          <p className="text-sm text-slate-500 mb-6">{error} Please ask us for a new link.</p>
          <button onClick={() => navigate('/')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold border-none cursor-pointer">
            Go to Garden Studio
          </button>
        </div>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  const state = req.status === 'PAID' ? 'paid'
    : req.status === 'CANCELLED' ? 'cancelled'
    : waiting ? 'checking'
    : 'pending';
  const { Icon, bg, title } = HEADERS[state];
  const sub = {
    pending: `Hi ${req.customer_first_name}! Here's the payment for your ${req.service.toLowerCase()} project.`,
    checking: 'Waiting for confirmation from your e-wallet or bank. This takes a few seconds.',
    paid: `Thank you, ${req.customer_first_name}! We've recorded your payment on your project.`,
    cancelled: 'This payment request is no longer active. Please contact us if you have questions.',
  }[state];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden">

        <div className={`bg-gradient-to-r ${bg} px-6 sm:px-8 py-9 text-white text-center`}>
          <div className="flex justify-center mb-3">
            <Icon size={56} strokeWidth={1.5} className={`drop-shadow-lg ${state === 'checking' ? 'animate-pulse' : ''}`} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1">{title}</h1>
          <p className="text-white/85 text-sm m-0">{sub}</p>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <div className="flex items-center justify-center gap-2 mb-5">
            <Leaf size={20} className="text-emerald-600" />
            <span className="text-lg font-extrabold text-slate-800 tracking-tight">Garden Studio</span>
          </div>

          <div className="border border-dashed border-slate-200 rounded-2xl p-5 mb-5 space-y-3 bg-slate-50/50 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 font-medium">For</span>
              <span className="font-bold text-slate-900 text-right">{req.label}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 font-medium">Project</span>
              <span className="font-bold text-slate-900 text-right">{req.service} · Booking #{req.booking_id}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 font-medium">Project price</span>
              <span className="font-bold text-slate-900">{peso(req.project_total)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 font-medium">Balance {state === 'paid' ? 'now' : 'before this payment'}</span>
              <span className="font-bold text-slate-900">{peso(req.project_balance)}</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex justify-between items-center mb-5">
            <span className="text-emerald-800 font-extrabold text-sm uppercase tracking-wider">
              {state === 'paid' ? 'Amount Paid' : 'Amount Due'}
            </span>
            <span className="text-2xl font-black text-emerald-600">{peso(req.amount)}</span>
          </div>

          {state === 'pending' && returned && polls >= MAX_POLLS && (
            <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
              We haven't received the confirmation yet. If you already paid, it will update shortly; there's no need to pay twice.
            </p>
          )}
          {payError && <p className="text-xs text-red-600 text-center mb-4">{payError}</p>}

          {state === 'pending' && (
            <>
              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-2xl font-bold transition-all shadow-md active:scale-95 border-none cursor-pointer"
              >
                {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                Pay {peso(req.amount)}
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2 mb-0">QR Ph · GCash · Maya · Card</p>
            </>
          )}
          {state === 'paid' && (
            <button onClick={() => navigate('/my-bookings')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold border-none cursor-pointer">
              View My Bookings
            </button>
          )}

          <div className="flex gap-2.5 items-start mt-6 pt-4 border-t border-slate-100">
            <Shield size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-normal m-0">
              You pay on PayMongo's secure page. We never see your card or e-wallet details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
