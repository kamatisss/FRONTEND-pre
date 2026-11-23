// Customer home (/user-dashboard). Top to bottom, in the order a customer needs it:
// greeting + 3 shortcuts → what needs you → your projects and deliveries → your designs → recent activity.
// The logic (what needs attention, project phase, activity lines) lives in data/customerDashboard.js.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle, ArrowRight, Calendar, Check, ChevronRight, CreditCard, Layers, Package,
    Plus, RotateCw, ShoppingBag, Sparkles, Star, Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDesign } from '../context/DesignContext';
import api, { listDesigns, loadDesign } from '../services/api';
import { previewIsCurrent, previewScene, queuePreview } from '../data/designPreview';
import { loadDesignForStudio } from '../data/studioDesign';
import {
    ORDER_STEPS, activeProjects, attentionItems, crewToday, fmtDate, greeting, isActiveOrder,
    orderStep, paymentSummary, peso, projectProgress, recentActivity, serviceName,
} from '../data/customerDashboard';
import InstallAppCard from './InstallAppCard';
import ProfileNudge from './ProfileNudge';

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const H2 = 'm-0 text-lg font-extrabold text-slate-900';
const LINK = 'inline-flex items-center gap-1 text-sm font-bold text-emerald-700 no-underline hover:text-emerald-800 hover:underline';
const SOURCES = ['designs', 'bookings', 'orders', 'reviews'];

function Skeleton({ className = '' }) {
    return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;
}

function SectionError({ what, onRetry }) {
    return (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="shrink-0 text-amber-600" />
            <span className="flex-1 min-w-[12rem] font-medium">We couldn't load your {what}.</span>
            <button type="button" onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border-none bg-amber-600 px-3 py-2 text-xs font-bold text-white cursor-pointer hover:bg-amber-700">
                <RotateCw size={13} /> Try again
            </button>
        </div>
    );
}

/* ── Greeting + shortcuts (replaces the old green banner) ─────────────────── */
const SHORTCUTS = [
    { to: '/ai-designer', icon: Sparkles, title: 'Design with AI', text: 'Get 3 garden designs for your yard', primary: true },
    { to: '/book-service', icon: Calendar, title: 'Book a service', text: 'Installation, maintenance or a visit' },
    { to: '/shop', icon: ShoppingBag, title: 'Shop plants', text: 'Plants, stones and garden items' },
];

function Header({ user }) {
    const name = user?.first_name || user?.username || '';
    return (
        <header className="flex flex-col gap-4">
            <div>
                <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900">{greeting()}{name ? `, ${name}` : ''}</h1>
                <p className="m-0 mt-1 text-sm text-slate-600">Your garden projects, designs and orders in one place.</p>
            </div>
            <nav aria-label="Shortcuts" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SHORTCUTS.map(({ to, icon: Icon, title, text, primary }) => (
                    <Link key={to} to={to}
                        className={`group flex items-center gap-3 rounded-2xl border p-3.5 no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${primary
                            ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50/50'}`}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-white/20' : 'bg-emerald-50 text-emerald-700'}`}>
                            <Icon size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold">{title}</span>
                            <span className={`block text-xs ${primary ? 'text-white/85' : 'text-slate-500'}`}>{text}</span>
                        </span>
                        <ChevronRight size={16} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${primary ? 'text-white/80' : 'text-slate-400'}`} />
                    </Link>
                ))}
            </nav>
        </header>
    );
}

/* ── Needs your attention ──────────────────────────────────────────────────── */
const ATTENTION_ICON = { approve: Layers, pay: CreditCard, rate: Star };

function Attention({ items }) {
    if (!items.length) return null;
    return (
        <section aria-labelledby="attention-title" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <h2 id="attention-title" className="m-0 text-base font-extrabold text-slate-900">
                Needs your attention <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white align-middle">{items.length}</span>
            </h2>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {items.map(it => {
                    const Icon = ATTENTION_ICON[it.kind] || AlertTriangle;
                    return (
                        <li key={it.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-white p-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Icon size={18} /></span>
                            <div className="min-w-[12rem] flex-1">
                                <p className="m-0 text-sm font-extrabold text-slate-900">{it.title}</p>
                                <p className="m-0 mt-0.5 text-xs leading-relaxed text-slate-600">{it.text}</p>
                            </div>
                            <Link to={it.to}
                                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold no-underline ${it.kind === 'rate'
                                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                                {it.action} <ArrowRight size={13} />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/* ── Projects and deliveries ──────────────────────────────────────────────── */
function Stepper({ labels, index, label }) {
    return (
        <div>
        <ol aria-label={label} className="m-0 flex list-none gap-1 p-0">
            {labels.map((l, i) => {
                const state = i < index ? 'done' : i === index ? 'now' : 'next';
                return (
                    <li key={l} className="min-w-0 flex-1" aria-current={state === 'now' ? 'step' : undefined}>
                        <div className={`h-1.5 rounded-full ${state === 'next' ? 'bg-slate-200' : 'bg-emerald-500'} ${state === 'now' ? 'opacity-60' : ''}`} />
                        {/* Phones: the bars only (the card title names the stage); labels stay for screen readers */}
                        <span className={`sr-only sm:not-sr-only sm:mt-1.5 sm:block sm:truncate text-[11px] ${state === 'now' ? 'font-extrabold text-emerald-700' : state === 'done' ? 'font-semibold text-slate-600' : 'text-slate-400'}`}>
                            {state === 'done' && <Check size={10} strokeWidth={3} className="mr-0.5 inline align-[-1px]" />}{l}
                        </span>
                    </li>
                );
            })}
        </ol>
        <p aria-hidden="true" className="m-0 mt-1.5 text-[11px] font-semibold text-slate-500 sm:hidden">Step {index + 1} of {labels.length}</p>
        </div>
    );
}

function ProjectCard({ booking: b }) {
    const { steps, index, stage, help, noEndDate } = projectProgress(b);
    const pay = paymentSummary(b);
    const crew = crewToday(b);
    const end = !noEndDate && b.tracker?.estimated_end_date;
    return (
        <article className={`${CARD} flex flex-col gap-4 p-5`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">{serviceName(b.service_type)}</p>
                    <h3 className="m-0 mt-0.5 text-base font-extrabold text-slate-900">{stage}</h3>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    <Calendar size={12} /> {fmtDate(b.scheduled_date, { month: 'short', day: 'numeric' })}
                </span>
            </div>
            {crew && (
                <p className="m-0 inline-flex items-center gap-2 self-start rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800">
                    <Truck size={14} /> {crew}
                </p>
            )}
            <Stepper labels={steps.map(s => s.label)} index={index} label={`Project progress: ${stage}`} />
            <p className="m-0 text-sm text-slate-600">
                {help}{end && index < steps.length - 1 ? ` Expected to finish around ${fmtDate(end, { month: 'short', day: 'numeric' })}.` : ''}
            </p>
            {pay && (
                <div>
                    <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-600">Paid {peso(pay.paid)} of {peso(pay.total)}</span>
                        <span className={`font-bold ${pay.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {pay.balance > 0 ? `${peso(pay.balance)} left` : 'Fully paid'}
                        </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Paid so far"
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={pay.pct}>
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pay.pct}%` }} />
                    </div>
                </div>
            )}
            <Link to="/my-bookings" className={`${LINK} mt-auto self-start`}>Booking details <ArrowRight size={14} /></Link>
        </article>
    );
}

function OrderCard({ order: o }) {
    const n = o.items?.length || 0;
    return (
        <article className={`${CARD} flex flex-col gap-4 p-5`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">Order #{o.id}</p>
                    <h3 className="m-0 mt-0.5 text-base font-extrabold text-slate-900">{ORDER_STEPS[orderStep(o)]}</h3>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-slate-900">{peso(o.total_price)}</span>
            </div>
            <Stepper labels={ORDER_STEPS} index={orderStep(o)} label={`Delivery progress: ${ORDER_STEPS[orderStep(o)]}`} />
            <p className="m-0 text-sm text-slate-600">
                {n} item{n === 1 ? '' : 's'} · {o.payment_method === 'cod' ? 'Cash on delivery' : o.payment_status === 'Paid' ? 'Paid online' : 'Online payment'}
                {o.delivery_crew_name && o.status === 'Out for Delivery' ? ` · ${o.delivery_crew_name} is bringing it` : ''}
            </p>
            <Link to="/my-orders" className={`${LINK} mt-auto self-start`}>Track order <ArrowRight size={14} /></Link>
        </article>
    );
}

function Projects({ projects, orders }) {
    const empty = !projects.length && !orders.length;
    return (
        <section aria-labelledby="projects-title" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 id="projects-title" className={H2}>Your projects</h2>
                {!empty && <Link to="/my-bookings" className={LINK}>All bookings <ChevronRight size={14} /></Link>}
            </div>
            {empty ? (
                <div className={`${CARD} flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles size={22} /></span>
                    <div className="flex-1">
                        <p className="m-0 text-sm font-extrabold text-slate-900">Nothing in progress right now</p>
                        <p className="m-0 mt-0.5 text-sm text-slate-600">Start with a free AI design of your yard, then book us to build it.</p>
                    </div>
                    <Link to="/ai-designer" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white no-underline hover:bg-emerald-700">
                        Design my yard <ArrowRight size={14} />
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {projects.map(b => <ProjectCard key={`b${b.id}`} booking={b} />)}
                    {orders.map(o => <OrderCard key={`o${o.id}`} order={o} />)}
                </div>
            )}
        </section>
    );
}

/* ── Designs shelf ────────────────────────────────────────────────────────── */
const SHELF = 4;

// Desktop: draw the card picture of a shelf design that has none, or shows an older version
// (designs saved before pictures existed, or changed by the office). Phones don't: they get one on save.
function useShelfPictures(shown) {
    const [made, setMade] = useState({});   // id → picture url made on this visit
    const ids = shown.filter(d => !previewIsCurrent(d)).map(d => d.id).join(',');
    useEffect(() => {
        if (!ids || !window.matchMedia?.('(min-width: 768px)').matches) return;
        let live = true;
        ids.split(',').map(Number).forEach(id => {
            loadDesign(id)
                .then(full => queuePreview(id, previewScene(full), full.revision))
                .then(res => { if (live && res?.preview_url) setMade(m => ({ ...m, [id]: res.preview_url })); })
                .catch(() => { /* the card keeps its placeholder */ });
        });
        return () => { live = false; };
    }, [ids]);
    return made;
}

function Designs({ designs, onOpen, opening }) {
    const shown = designs.slice(0, SHELF);
    const made = useShelfPictures(shown);
    return (
        <section aria-labelledby="designs-title" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 id="designs-title" className={H2}>Your designs</h2>
                {designs.length > 0 && <Link to="/studio" className={LINK}>Open 3D Studio <ChevronRight size={14} /></Link>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map(d => {
                    // The garden itself first; the yard photo only until its picture exists
                    const img = made[d.id] || d.preview_url || d.reference_image_url || d.original_image_url;
                    const dims = d.dimensions || {};
                    return (
                        <article key={d.id} className={`${CARD} flex flex-col overflow-hidden`}>
                            <div className="relative aspect-[8/5] bg-gradient-to-br from-emerald-50 to-emerald-100"
                                style={img ? { background: `url(${img}) center/cover no-repeat` } : undefined}>
                                {!img && <Sparkles size={26} className="absolute inset-0 m-auto text-emerald-600/70" />}
                                {d.locked && (
                                    <span title="A booking uses this design. Our crew builds from it, so changes save as a new design."
                                        className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 shadow-sm">
                                        Booked
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-1 flex-col gap-3 p-4">
                                <div className="min-w-0">
                                    <h3 className="m-0 truncate text-sm font-extrabold text-slate-900" title={d.name}>{d.name || 'Untitled design'}</h3>
                                    <p className="m-0 mt-0.5 text-xs text-slate-500">
                                        {dims.width && dims.length ? `${dims.width} × ${dims.length} m · ` : ''}
                                        {d.total_cost > 0 ? `${peso(d.total_cost)} · ` : ''}
                                        Edited {fmtDate(d.updated_at, { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                <button type="button" onClick={() => onOpen(d.id)} disabled={opening === d.id}
                                    className="mt-auto inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white text-xs font-bold text-emerald-700 cursor-pointer hover:bg-emerald-50 disabled:opacity-60">
                                    {opening === d.id ? 'Opening…' : 'Open in 3D Studio'}
                                </button>
                            </div>
                        </article>
                    );
                })}
                {shown.length < SHELF && (
                    <Link to="/ai-designer"
                        className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-4 text-center no-underline text-slate-600 hover:border-emerald-400 hover:text-emerald-700">
                        <Plus size={24} />
                        <span className="text-sm font-extrabold">{designs.length ? 'New design' : 'Make your first design'}</span>
                        <span className="text-xs text-slate-500">Upload a yard photo and get 3 ideas in 3D</span>
                    </Link>
                )}
            </div>
        </section>
    );
}

/* ── Recent activity ──────────────────────────────────────────────────────── */
const DOT = { slate: 'bg-slate-300', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-400' };

function Activity({ rows }) {
    if (!rows.length) return null;
    return (
        <section aria-labelledby="activity-title" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 id="activity-title" className={H2}>Recent activity</h2>
                <Link to="/my-orders" className={LINK}>Order history <ChevronRight size={14} /></Link>
            </div>
            <ul className={`${CARD} m-0 list-none divide-y divide-slate-100 p-0`}>
                {rows.map((r, i) => (
                    <li key={`${r.at}-${i}`}>
                        <Link to={r.to} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-slate-50">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.tone]}`} />
                            <span className="min-w-0 flex-1 text-sm text-slate-800">{r.text}</span>
                            <time dateTime={r.at} className="shrink-0 text-xs text-slate-500">{fmtDate(r.at, { month: 'short', day: 'numeric' })}</time>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
const UserDashboard = () => {
    const { user, authTokens } = useAuth();
    const { dispatch } = useDesign();
    const navigate = useNavigate();

    // Each source loads on its own: a failed one shows its own error, the rest still show
    const [data, setData] = useState({ designs: null, bookings: null, orders: null, reviews: null });
    const [failed, setFailed] = useState({});
    const [reloadKey, setReloadKey] = useState(0);
    const [opening, setOpening] = useState(null);

    useEffect(() => {
        if (!authTokens) return;
        let live = true;
        const loaders = {
            designs: () => listDesigns(),
            bookings: () => api.get('/bookings/').then(r => r.data),
            orders: () => api.get('/orders/').then(r => r.data),
            reviews: () => api.get('/reviews/').then(r => r.data),
        };
        const want = reloadKey === 0 ? SOURCES : SOURCES.filter(k => failed[k]);
        setFailed(f => Object.fromEntries(Object.entries(f).filter(([k]) => !want.includes(k))));
        want.forEach(k => {
            loaders[k]()
                .then(v => { if (live) setData(d => ({ ...d, [k]: Array.isArray(v) ? v : (v?.results || []) })); })
                .catch(err => {
                    console.error(`Dashboard: ${k} failed`, err);
                    if (live) setFailed(f => ({ ...f, [k]: true }));
                });
        });
        return () => { live = false; };
        // `failed` is read only to pick what to retry; re-running on it would loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authTokens, reloadKey]);

    const retry = () => setReloadKey(k => k + 1);

    const handleOpenDesign = async (id) => {
        setOpening(id);
        try {
            // Both design formats (AI Designer and Studio), extra items kept (data/studioDesign.js)
            const { payload, products } = await loadDesignForStudio(id, []);
            if (products) dispatch({ type: 'SET_PRODUCTS', payload: products });
            dispatch({ type: 'LOAD_DESIGN', payload });
            navigate('/studio');
        } catch (err) {
            console.error('Failed to load design:', err);
            alert('Could not open the design. Please try again.');
            setOpening(null);
        }
    };

    const { designs, bookings, orders, reviews } = data;
    const reviewedIds = reviews ? new Set(reviews.map(r => r.booking)) : null;
    // Either list alone still gives its own items (a failed bookings load keeps the order ratings)
    const attention = (bookings || orders) ? attentionItems({ bookings: bookings || [], orders: orders || [], reviewedBookingIds: reviewedIds }) : [];
    const loadingWork = (bookings === null && !failed.bookings) || (orders === null && !failed.orders);

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-0 py-2 sm:px-2 md:py-4">
            <Header user={user} />

            {(failed.bookings || failed.orders) && <SectionError what={failed.bookings && failed.orders ? 'bookings and orders' : failed.bookings ? 'bookings' : 'orders'} onRetry={retry} />}
            <Attention items={attention} />
            <ProfileNudge />

            {loadingWork ? (
                <section aria-busy="true" aria-label="Loading your projects" className="flex flex-col gap-3">
                    <Skeleton className="h-6 w-40" />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
                </section>
            ) : (
                <Projects projects={activeProjects(bookings || [])} orders={(orders || []).filter(isActiveOrder)} />
            )}

            {/* A brand-new customer already gets "Design my yard" under Your projects: no second empty card */}
            {failed.designs ? <SectionError what="designs" onRetry={retry} />
                : designs?.length === 0 && !loadingWork && !activeProjects(bookings || []).length
                    && !(orders || []).some(isActiveOrder) ? null
                : designs === null ? (
                    <section aria-busy="true" aria-label="Loading your designs" className="flex flex-col gap-3">
                        <Skeleton className="h-6 w-36" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-48" /><Skeleton className="hidden h-48 sm:block" /></div>
                    </section>
                ) : <Designs designs={designs} onOpen={handleOpenDesign} opening={opening} />}

            {!loadingWork && <Activity rows={recentActivity({ bookings: bookings || [], orders: orders || [] })} />}

            <InstallAppCard reason="Follow your project and bookings from your home screen, like an app." />
        </div>
    );
};

export default UserDashboard;
