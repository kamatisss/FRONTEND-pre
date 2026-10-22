import React, { useState } from 'react';
import { Truck, Phone, Navigation, Banknote, CheckCircle2, AlertTriangle, RefreshCw, Package, Wallet } from 'lucide-react';
import ProblemSheet from './ui/ProblemSheet';
import { sendAction } from '../crew/outbox';

/* Field crew delivery run (our own crew deliver shop orders).
   Shipped → "Start delivery" (Out for Delivery) → "Delivered". Marking a Cash on Delivery
   order delivered records that this crew member collected the cash; the day's total is
   shown so it can be handed in. Problems are reported to the office, who decide what's next. */

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isCod = (o) => o.payment_method === 'cod';
const itemsText = (o) => (o.items || []).map(i => `${i.quantity}× ${i.item_name || 'Item'}`).join(', ') || 'No items';
const directions = (address) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`;

const STAGE = {
  Pending:            { label: 'Being packed', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  Paid:               { label: 'Being packed', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  Shipped:            { label: 'Ready to go',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Out for Delivery': { label: 'On the way',   cls: 'bg-sky-50 text-sky-700 border-sky-200' },   // as in the office order queue
};

const PROBLEMS = ['Customer not home', 'Wrong or unclear address', 'Customer refused the order', 'Item damaged', 'Other'];

export default function CrewDeliveries({ api, authHeaders, toast, run, loading, reload }) {
  const [busy, setBusy] = useState(null);       // order id being updated
  const [problemFor, setProblemFor] = useState(null);

  const setStatus = async (order, status) => {
    if (status === 'Delivered') {
      const ask = isCod(order)
        ? `Did you hand over order #${order.id} and collect ${peso(order.total_price)} cash from ${order.customer_name}?`
        : `Did you hand over order #${order.id} to ${order.customer_name}?`;
      if (!window.confirm(ask)) return;
    }
    setBusy(order.id);
    try {
      const res = await sendAction({
        label: status === 'Delivered' ? `Delivered order #${order.id}` : `On the way with order #${order.id}`,
        path: `/orders/${order.id}/update_status/`, method: 'PATCH', body: { status }, kind: 'order_status', ref: { orderId: order.id },
      });
      if (res.queued) {
        toast(`No signal: saved with the time you tapped. It will be sent when you have signal.`);
      } else {
        toast(status === 'Delivered'
          ? (isCod(order) ? `Order #${order.id} delivered. ${peso(order.total_price)} added to your cash for today.` : `Order #${order.id} delivered.`)
          : `On the way to ${order.customer_name}.`);
        reload();
      }
    } catch (e) {
      toast(e.message || 'Could not update the delivery.', 'error');
    }
    setBusy(null);
  };

  const active = run?.active || [];
  const done = run?.delivered_today || [];
  const toGo = active.filter(o => ['Shipped', 'Out for Delivery'].includes(o.status));
  const packing = active.filter(o => !['Shipped', 'Out for Delivery'].includes(o.status));

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Today's run */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-emerald-50 text-xs font-bold uppercase tracking-wider">Today's deliveries</p>
            <p className="text-3xl font-extrabold leading-tight mt-1">{toGo.length} <span className="text-base font-semibold text-emerald-50">to deliver</span></p>
            <p className="text-emerald-50 text-sm mt-0.5">{done.length} delivered today{packing.length ? ` · ${packing.length} being packed` : ''}</p>
          </div>
          <button onClick={reload} aria-label="Refresh deliveries" className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border-none cursor-pointer">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3">
          <Wallet size={20} className="shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-emerald-50 font-semibold">Cash to hand in to the office</p>
            <p className="text-xl font-extrabold">{peso(run?.cash_to_hand_in ?? run?.cash_today)}</p>
            {Number(run?.cash_to_hand_in) > Number(run?.cash_today) && (
              <p className="text-xs text-emerald-50 font-semibold">Includes cash from earlier days. Hand it in today.</p>
            )}
          </div>
        </div>
      </div>

      {!run ? (
        <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-44 bg-white border border-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : toGo.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 text-center">
          <Truck size={34} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-700">No deliveries waiting</p>
          <p className="text-sm text-slate-400 mt-1">When the office ships an order to you, it shows up here.</p>
        </div>
      ) : (
        <section>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">To deliver ({toGo.length})</h3>
          <ul className="space-y-3">
            {toGo.map(o => (
              <li key={o.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Money first: the thing that must not go wrong at the door */}
                <div className={`flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold ${isCod(o) ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>
                  {isCod(o) ? <Banknote size={18} /> : <CheckCircle2 size={18} />}
                  {isCod(o) ? `Collect ${peso(o.total_price)} cash` : 'Paid online. Collect nothing.'}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{o.customer_name} <span className="text-slate-400 font-semibold">#{o.id}</span></p>
                      <p className="text-sm text-slate-600 mt-0.5">{o.customer_address || 'No address on file'}</p>
                    </div>
                    <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${STAGE[o.status]?.cls}`}>{STAGE[o.status]?.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5"><Package size={13} className="shrink-0 mt-px" />{itemsText(o)}</p>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <a href={directions(o.customer_address)} target="_blank" rel="noreferrer"
                      className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold inline-flex items-center justify-center gap-2 no-underline">
                      <Navigation size={16} /> Navigate
                    </a>
                    {o.customer_phone ? (
                      <a href={`tel:${o.customer_phone}`}
                        className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold inline-flex items-center justify-center gap-2 no-underline">
                        <Phone size={16} /> Call
                      </a>
                    ) : <span className="h-11 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold inline-flex items-center justify-center">No phone</span>}
                  </div>

                  <div className="flex gap-2 mt-2">
                    {o.status === 'Shipped' && (
                      <button onClick={() => setStatus(o, 'Out for Delivery')} disabled={busy === o.id}
                        className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
                        <Truck size={16} /> Start delivery
                      </button>
                    )}
                    <button onClick={() => setStatus(o, 'Delivered')} disabled={busy === o.id}
                      className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} /> {isCod(o) ? 'Delivered & paid' : 'Delivered'}
                    </button>
                  </div>
                  <button onClick={() => setProblemFor(o)}
                    className="mt-2 w-full h-9 text-xs font-bold text-red-600 bg-transparent border-none cursor-pointer inline-flex items-center justify-center gap-1.5">
                    <AlertTriangle size={13} /> Can't deliver? Report a problem
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {packing.length > 0 && (
        <section>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Coming up ({packing.length})</h3>
          <ul className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100">
            {packing.map(o => (
              <li key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">#{o.id} · {o.customer_name}</p>
                  <p className="text-xs text-slate-400 truncate">{o.customer_address}</p>
                </div>
                <span className="text-xs text-slate-500 shrink-0">Office is packing it</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Delivered today ({done.length})</h3>
          <ul className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100">
            {done.map(o => (
              <li key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">#{o.id} · {o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.delivered_at && new Date(o.delivered_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}{o.pending && <span className="text-amber-700 font-semibold"> · waiting for signal to send</span>}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${isCod(o) ? 'text-amber-700' : 'text-emerald-700'}`}>{isCod(o) ? `${peso(o.total_price)} cash` : 'Paid online'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {problemFor && (
        <ProblemSheet subtitle={`Order #${problemFor.id} · ${problemFor.customer_name}`} reasons={PROBLEMS}
          url={`${api}/orders/${problemFor.id}/report_problem/`} authHeaders={authHeaders} toast={toast}
          successMessage="The office has been told. Keep the order with you until they reply." onClose={() => setProblemFor(null)} />
      )}
    </div>
  );
}
