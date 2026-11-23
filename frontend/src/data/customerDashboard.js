// Customer dashboard (components/UserDashboard.jsx): what needs the customer, where each project is,
// and what happened lately. Plain functions over the /bookings/, /orders/ and /reviews/ responses.

const DONE_BOOKING = ['Finished', 'Completed', 'Cancelled'];
const CLOSED_ORDER = ['Delivered', 'Cancelled'];
const DAY = 86400000;
// A finished job or a delivery is asked about for this long; after that the prompt would feel stale
const ASK_REVIEW_DAYS = 30;

export const isActiveBooking = (b) => !DONE_BOOKING.includes(b.status);
export const isActiveOrder = (o) => !CLOSED_ORDER.includes(o.status);

const time = (v) => (v ? new Date(v).getTime() : NaN);
const recent = (v, now, days) => {
  const t = time(v);
  return Number.isFinite(t) && now - t <= days * DAY;
};

// ServiceBooking.service_type as customers know it (the stored values mix cases and trade words)
const SERVICE_NAMES = { softscape: 'Planting', hardscaping: 'Hardscape', consultation: 'Consultation', maintenance: 'Maintenance' };
export const serviceName = (type) => {
  const t = String(type || 'Service').trim();
  return SERVICE_NAMES[t.toLowerCase()] || t.charAt(0).toUpperCase() + t.slice(1);
};

export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export const fmtDate = (v, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  const t = time(v);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-PH', opts) : '';
};

/*
 * Things only the customer can move forward, most urgent first:
 * approve the final design, pay what the office asked for, rate a finished job or a delivery.
 */
export function attentionItems({ bookings = [], orders = [], reviewedBookingIds = null, now = Date.now() }) {
  const items = [];
  for (const b of bookings) {
    if (b.status === 'Cancelled') continue;
    const name = serviceName(b.service_type);
    if (b.design_review?.state === 'sent' && b.design_details) {
      items.push({
        key: `approve-${b.id}`, kind: 'approve', rank: 0,
        title: 'Approve your final design',
        text: `${name}: we adjusted your design to your yard. Look at it in 3D and approve it, or ask for changes. Work starts after you approve.`,
        action: 'Review design', to: `/my-bookings?review=${b.id}`,
      });
    }
    for (const p of b.tracker?.pending_payments || []) {
      items.push({
        key: `pay-${p.id}`, kind: 'pay', rank: 1,
        title: `Payment requested: ${peso(p.amount)}`,
        text: `${p.label || 'Payment'} for your ${name.toLowerCase()} project.`,
        action: 'Pay now', to: `/pay/${p.token}`,
      });
    }
    // Only when the reviews loaded: otherwise a customer who already rated would be asked again
    if (reviewedBookingIds && ['Finished', 'Completed'].includes(b.status) && !reviewedBookingIds.has(b.id)
      && recent(b.finished_at || b.scheduled_date, now, ASK_REVIEW_DAYS)) {
      items.push({
        key: `rate-${b.id}`, kind: 'rate', rank: 2,
        title: 'How did we do?',
        text: `Your ${name.toLowerCase()} job is finished. A short review helps other homeowners in Quezon.`,
        action: 'Leave a review', to: `/my-bookings?rate=${b.id}`,
      });
    }
  }
  for (const o of orders) {
    if (o.status !== 'Delivered' || !recent(o.delivered_at || o.created_at, now, ASK_REVIEW_DAYS)) continue;
    const unrated = (o.items || []).filter(i => i.item && !i.review);
    if (!unrated.length) continue;
    items.push({
      key: `rate-order-${o.id}`, kind: 'rate', rank: 3,
      title: `Rate your order #${o.id}`,
      text: unrated.length === 1 ? `How is your ${unrated[0].item_name}?` : `${unrated.length} items are waiting for your rating.`,
      action: 'Rate items', to: '/my-orders',
    });
  }
  return items.sort((a, b) => a.rank - b.rank);
}

/*
 * One honest progress line per project. The office moves the project tracker; the crew moves the booking
 * status (Installing when they start, For Review when they hand over). Whichever is further wins, so the
 * customer never sees "Planning" while the crew is planting in their yard.
 * The Design step only shows for jobs with a design (a maintenance visit has none).
 */
const PHASES = [
  { key: 'plan', label: 'Planning', help: 'We are checking your yard and preparing the quotation.' },
  { key: 'design', label: 'Design', help: 'We are finalising the design you will approve before work starts.' },
  { key: 'ready', label: 'Getting ready', help: 'Your date is set and we are preparing the plants and materials.' },
  { key: 'site', label: 'Work on site', help: 'Our crew is working in your yard.' },
  { key: 'check', label: 'Final check', help: 'The work is done. We are doing a last check before we hand it over.' },
  { key: 'done', label: 'Done', help: 'Your project is finished.' },
];
const TRACKER_PHASE = {
  PENDING: 'plan', CONSULTATION_SCHEDULED: 'plan', SITE_INSPECTION: 'plan', QUOTATION_APPROVED: 'plan',
  DESIGN_PREPARATION: 'design', DESIGN_APPROVED: 'design',
  PROJECT_SCHEDULED: 'ready', MATERIALS_PREPARATION: 'ready',
  PROJECT_STARTED: 'site', SITE_PREPARATION: 'site', PLANTING: 'site', HARDSCAPE_INSTALLATION: 'site',
  LIGHTING_INSTALLATION: 'site', DECORATION: 'site',
  FINAL_INSPECTION: 'check', COMPLETED: 'done', CUSTOMER_FEEDBACK: 'done',
};
const BOOKING_PHASE = {
  Pending: 'plan', Preparing: 'ready', Installing: 'site', 'For Review': 'check', Finished: 'done', Completed: 'done',
};
const ORDER = PHASES.map(p => p.key);

export function projectProgress(b) {
  const hasDesign = !!(b.design || b.design_details);
  const fromTracker = TRACKER_PHASE[b.tracker?.status];
  const fromBooking = BOOKING_PHASE[b.status] || 'plan';
  const at = [fromTracker, fromBooking].filter(Boolean)
    .reduce((a, c) => (ORDER.indexOf(c) > ORDER.indexOf(a) ? c : a), 'plan');
  if (String(b.service_type).toLowerCase() === 'consultation') return consultationProgress(b, at);
  const steps = PHASES.filter(p => p.key !== 'design' || hasDesign || at === 'design');
  const index = Math.max(0, steps.findIndex(p => p.key === at));
  const phase = steps[index];
  // The office's own stage name is more precise inside its phase ("Planting" rather than "Work on site"),
  // unless it only repeats the service name (a Planting job at the Planting stage)
  const own = fromTracker === at ? b.tracker?.status_display : '';
  const stage = own && own !== serviceName(b.service_type) ? own : phase.label;
  let help = phase.help;
  if (at === 'design' && b.design_review?.state === 'sent') help = 'Your final design is waiting for your approval.';
  if (at === 'plan' && b.status === 'Pending' && !b.tracker) help = 'We received your request and will confirm your date soon.';
  return { steps, index, phase, stage, help };
}

// A consultation is one visit: requested → visit → done (no design, materials or crew work)
const CONSULT = [
  { key: 'plan', label: 'Requested', help: 'We received your request and will confirm the visit.' },
  { key: 'visit', label: 'Visit', help: 'We will visit your yard on the date shown and talk through your ideas.' },
  { key: 'done', label: 'Done', help: 'Your consultation is done.' },
];
function consultationProgress(b, at) {
  const scheduled = ['CONSULTATION_SCHEDULED', 'SITE_INSPECTION'].includes(b.tracker?.status) || b.status !== 'Pending';
  const index = at === 'done' ? 2 : scheduled ? 1 : 0;
  const phase = CONSULT[index];
  return { steps: CONSULT, index, phase, stage: index === 1 ? 'Visit scheduled' : phase.label, help: phase.help, noEndDate: true };
}

// "Crew on the way" / "Crew arrived" for today only (the crew app stamps these)
export function crewToday(b, now = Date.now()) {
  const sameDay = (v) => Number.isFinite(time(v)) && new Date(time(v)).toDateString() === new Date(now).toDateString();
  if (sameDay(b.crew_arrived_at)) return 'Our crew has arrived';
  if (sameDay(b.crew_on_way_at)) return 'Our crew is on the way';
  return null;
}

export function paymentSummary(b) {
  const t = b.tracker;
  if (!t || !(t.total_price > 0)) return null;
  const paid = Math.max(0, Math.min(t.total_price, t.amount_paid || 0));
  return { total: t.total_price, paid, balance: Math.max(0, t.remaining_balance || 0), pct: Math.round((paid / t.total_price) * 100) };
}

// Bookings that are still open, soonest date first
export function activeProjects(bookings = []) {
  return bookings.filter(isActiveBooking)
    .sort((a, b) => (time(a.scheduled_date) || Infinity) - (time(b.scheduled_date) || Infinity));
}

/* What happened lately, newest first: one line each, with where to see it. */
export function recentActivity({ bookings = [], orders = [], limit = 6 }) {
  const rows = [];
  const add = (at, text, to, tone = 'slate') => { if (Number.isFinite(time(at))) rows.push({ at, text, to, tone }); };
  for (const b of bookings) {
    const name = serviceName(b.service_type);
    add(b.created_at, `You booked ${name.toLowerCase()} for ${fmtDate(b.scheduled_date, { month: 'short', day: 'numeric' })}`, '/my-bookings');
    if (['Finished', 'Completed'].includes(b.status)) add(b.finished_at, `${name} job finished`, '/my-bookings', 'emerald');
    for (const s of b.design_review?.steps || []) {
      if (s.kind === 'sent') add(s.at, `Final design for ${name.toLowerCase()} is ready for you`, `/my-bookings?review=${b.id}`, 'amber');
      else if (s.kind === 'approved' || s.kind === 'approved_in_person') add(s.at, `You approved the final design for ${name.toLowerCase()}`, '/my-bookings', 'emerald');
    }
  }
  for (const o of orders) {
    const n = o.items?.length || 0;
    if (o.status === 'Cancelled') { add(o.created_at, `Order #${o.id} was cancelled`, '/my-orders', 'red'); continue; }
    add(o.created_at, `Order #${o.id} placed: ${n} item${n === 1 ? '' : 's'}, ${peso(o.total_price)}`, '/my-orders');
    if (o.status === 'Delivered') add(o.delivered_at, `Order #${o.id} delivered`, '/my-orders', 'emerald');
  }
  return rows.sort((a, b) => time(b.at) - time(a.at)).slice(0, limit);
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Order delivery line for the active order card
const ORDER_STATUS = ['Pending', 'Paid', 'Shipped', 'Out for Delivery', 'Delivered'];
export const ORDER_STEPS = ['Ordered', 'Confirmed', 'Shipped', 'On the way', 'Delivered'];
export const orderStep = (o) => Math.max(0, ORDER_STATUS.indexOf(o.status));
