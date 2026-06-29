import { useState } from 'react';
import { useDesign } from '../context/DesignContext';
import { Wallet, ShoppingCart, X, CreditCard, Loader2 } from 'lucide-react';
import { submitOrder, createCheckoutSession } from '../services/api';

export default function CostEstimatePanel() {
  const { totalCost, costBreakdown, state, dispatch } = useDesign();
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', address: '' });
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (state.placedItems.length === 0) return;

    setLoading(true);
    try {
      const items = costBreakdown.map(item => {
        const product = state.products.find(p => p.name === item.name);
        return {
          id: product ? product.id : null,
          quantity: item.quantity
        };
      }).filter(item => item.id !== null);

      // Step 1: Save the order and get the order_id
      const orderResult = await submitOrder({
        customer_name:    formData.name,
        customer_email:   formData.email,
        customer_address: formData.address,
        total_price:      totalCost,
        items:            items
      });

      const orderId = orderResult.order_id;

      // Step 2: Create a Stripe Checkout Session and redirect
      const sessionData = await createCheckoutSession(orderId);
      dispatch({ type: 'CLEAR_DESIGN' });

      // Redirect browser to Stripe's hosted payment page
      window.location.href = sessionData.checkout_url;

    } catch (error) {
      alert(`Checkout failed: ${error.message}`);
      setLoading(false); // Only reset on error; success redirects away
    }
  };

  if (state.placedItems.length === 0) {
    return (
      <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 mt-4 font-sans">
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center mb-3">
          <Wallet size={20} className="mr-2 text-emerald-600" />
          Cost Estimate
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
          Place items to see cost breakdown
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 mt-4 font-sans flex flex-col">
      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center mb-5">
        <Wallet size={20} className="mr-2 text-emerald-600" />
        Cost Estimate
      </h3>

      <div className="space-y-2 mb-5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
        {costBreakdown.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate pr-2 max-w-[120px]">{item.name}</span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">×{item.quantity}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">₱{item.subtotal.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700 w-full mb-4" />

      <div className="flex justify-between items-center mb-5 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800">
        <span className="font-extrabold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider text-sm">Total Estimated Cost</span>
        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₱{totalCost.toLocaleString()}</span>
      </div>

      <button 
        onClick={() => setShowCheckout(true)}
        className="w-full mt-auto py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[15px] font-extrabold flex items-center justify-center transition-all shadow-xl shadow-emerald-600/30 active:scale-95 hover:-translate-y-0.5"
      >
        <ShoppingCart size={18} className="mr-2" />
        Checkout Items
      </button>

      <p className="text-[10px] text-slate-400 text-center mt-3">* Prices in Philippine Peso (₱) and are subject to change.</p>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center">
                <ShoppingCart size={18} className="mr-2 text-emerald-500" />
                Checkout
              </h3>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCheckout} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Delivery Address</label>
                <textarea required rows="2" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="123 Garden St..." />
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 flex justify-between items-center mt-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total to Pay</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">₱{totalCost.toLocaleString()}</span>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-indigo-600 disabled:bg-slate-300 hover:bg-indigo-700 text-white rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Pay with Stripe
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
