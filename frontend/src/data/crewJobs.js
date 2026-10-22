// Crew job helpers shared by the crew screens (Today, Jobs, job page). Rules mirror
// BACKEND apps/library/field_work.py.

export const SERVICE = {
  maintenance: 'Maintenance', consultation: 'Consultation', hardscaping: 'Full hardscaping', Softscape: 'Softscape / planting',
};
export const TIME = { anytime: 'Any time', morning: 'Morning (8AM–12PM)', afternoon: 'Afternoon (1PM–5PM)' };
export const TIME_SHORT = { anytime: 'Any time', morning: 'Morning', afternoon: 'Afternoon' };

// Status colours match the office booking queue (BookingQueue STATUS_STYLES): the brand stays emerald,
// these only say where a job is.
export const STATUS = {
  Installing:   { label: 'In progress',       bar: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  Preparing:    { label: 'Confirmed',         bar: 'bg-blue-600',    chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  Pending:      { label: 'Awaiting office',   bar: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  'For Review': { label: 'Awaiting sign-off', bar: 'bg-violet-600',  chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  Finished:     { label: 'Finished',          bar: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Cancelled:    { label: 'Cancelled',         bar: 'bg-slate-500',   chip: 'bg-slate-100 text-slate-600 border-slate-200' },
};
export const statusOf = (s) => STATUS[s] || { label: s, bar: 'bg-slate-500', chip: 'bg-slate-100 text-slate-600 border-slate-200' };

export const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = () => isoDay(new Date());

export function dayLabel(iso, today) {
  if (!iso) return 'No date';
  const t = new Date(`${today}T00:00:00`);
  const rel = { [today]: 'Today' };
  rel[isoDay(new Date(t.getTime() + 864e5))] = 'Tomorrow';
  rel[isoDay(new Date(t.getTime() - 864e5))] = 'Yesterday';
  return rel[iso] || new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}
export const clockTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');

const DONE = ['For Review', 'Finished', 'Cancelled'];
const TIME_ORDER = { morning: 0, afternoon: 1, anytime: 2 };

/*
 * Split the crew member's jobs for the Today and Jobs screens:
 *  today    — work for today: jobs in progress (any start date; multi-day jobs) and confirmed or
 *             awaiting jobs dated today. The one they're clocked in to comes first, then in-progress
 *             work, then confirmed jobs by time of day, then ones still awaiting the office.
 *  upcoming — later dates, soonest first. review / finished — after the work.
 */
export function groupJobs(bookings, today, clockedJobId) {
  const rank = (b) => (b.id === clockedJobId ? 0 : b.status === 'Installing' ? 1 : b.status === 'Preparing' ? 2 : 3);
  const todays = bookings
    .filter(b => !DONE.includes(b.status) && (b.status === 'Installing' || b.scheduled_date <= today))
    .sort((a, b) => rank(a) - rank(b) || (TIME_ORDER[a.preferred_time] ?? 3) - (TIME_ORDER[b.preferred_time] ?? 3) || a.id - b.id);
  const ids = new Set(todays.map(b => b.id));
  const byDate = (a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || '') || a.id - b.id;
  return {
    today: todays,
    upcoming: bookings.filter(b => !ids.has(b.id) && !DONE.includes(b.status)).sort(byDate),
    review: bookings.filter(b => b.status === 'For Review').sort(byDate),
    finished: bookings.filter(b => b.status === 'Finished').sort((a, b) => byDate(b, a)).slice(0, 10),
  };
}

export const navUrl = (b) => {
  const where = b.site_lat != null ? `${b.site_lat},${b.site_lng}` : b.service_address;
  return where ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}` : null;
};
export const telOf = (b) => (b.contact_number || '').replace(/[^\d+]/g, '');
