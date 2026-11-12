import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/*
 * App-wide toasts: const toast = useToast(); toast({ title, message, image, action, type }).
 *  - A plain string works too: toast('Saved.').
 *  - Pass an `id` to update a toast in place instead of stacking another (e.g. tapping
 *    "Add" five times shows one "Added to cart · ×5", and its timer restarts).
 *  - `action: { label, onClick }` adds a button (View cart, Undo); the toast closes after it.
 *  - Hovering or focusing a toast pauses its timer.
 * Placement matches the staff toasts: top of the screen on phones (never over bottom bars or
 * a sheet's buttons), bottom left from tablets up (the cart drawer and other panels open on the right). Screen readers hear each one.
 */

const ToastContext = createContext(null);
const MAX_VISIBLE = 3;
let nextId = 1;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const startTimer = useCallback((id, duration) => {
        clearTimeout(timers.current.get(id));
        if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }, [dismiss]);

    const show = useCallback((opts) => {
        const t = typeof opts === 'string' ? { message: opts } : { ...opts };
        const id = t.id ?? `t${nextId++}`;
        const duration = t.duration ?? (t.action ? 5500 : 3500);
        const toast = { type: 'success', ...t, id, duration, version: Date.now() };
        setToasts(prev => {
            // An updated toast keeps its place in the stack; past MAX_VISIBLE the oldest go
            const next = prev.some(x => x.id === id) ? prev.map(x => (x.id === id ? toast : x)) : [...prev, toast];
            const dropped = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
            dropped.forEach(x => { clearTimeout(timers.current.get(x.id)); timers.current.delete(x.id); });
            return next.slice(dropped.length);
        });
        startTimer(id, duration);
        return id;
    }, [startTimer]);

    useEffect(() => {
        const all = timers.current;
        return () => all.forEach(clearTimeout);
    }, []);

    return (
        <ToastContext.Provider value={show}>
            {children}
            <ToastStack toasts={toasts} dismiss={dismiss} pause={id => clearTimeout(timers.current.get(id))} resume={startTimer} />
        </ToastContext.Provider>
    );
}

// Outside the provider (tests, a stray render) toasts quietly do nothing
const noop = () => null;
export const useToast = () => useContext(ToastContext) ?? noop;

const TONES = {
    success: { icon: CheckCircle2, iconClass: 'text-emerald-600', ring: 'border-slate-200' },
    error: { icon: AlertTriangle, iconClass: 'text-red-500', ring: 'border-red-200' },
    warning: { icon: AlertTriangle, iconClass: 'text-amber-500', ring: 'border-amber-200' },
    info: { icon: Info, iconClass: 'text-slate-500', ring: 'border-slate-200' },
};

function ToastStack({ toasts, dismiss, pause, resume }) {
    const reduce = useReducedMotion();
    return (
        <div
            role="region"
            aria-label="Alerts"
            className="fixed top-[72px] left-4 right-4 sm:top-auto sm:right-auto sm:bottom-6 sm:left-6 sm:w-[360px] z-[10050] flex flex-col gap-2 pointer-events-none"
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
            {/* Always mounted, so screen readers announce toasts as they arrive */}
            <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                    {toasts.map(t => (
                        <ToastCard key={t.id} toast={t} reduce={reduce}
                            onClose={() => dismiss(t.id)} onPause={() => pause(t.id)} onResume={() => resume(t.id, t.duration)} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

function ToastCard({ toast, reduce, onClose, onPause, onResume }) {
    const tone = TONES[toast.type] || TONES.success;
    const Icon = tone.icon;
    return (
        <motion.div
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            role={toast.type === 'error' ? 'alert' : 'status'}
            onMouseEnter={onPause}
            onMouseLeave={onResume}
            onFocus={onPause}
            onBlur={onResume}
            className={`pointer-events-auto flex items-center gap-3 p-3 pr-2 bg-white rounded-2xl border ${tone.ring} shadow-[0_10px_30px_-8px_rgba(15,23,42,0.25)]`}
        >
            {toast.image ? (
                <img src={toast.image} alt="" className="w-11 h-11 rounded-xl object-cover bg-slate-100 shrink-0" />
            ) : (
                <Icon size={20} className={`shrink-0 ml-1 ${tone.iconClass}`} />
            )}
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <p className="m-0 text-[13px] font-extrabold text-slate-900 leading-snug flex items-center gap-1.5">
                        {toast.image && <Icon size={14} className={`shrink-0 ${tone.iconClass}`} />}
                        <span className="truncate">{toast.title}</span>
                    </p>
                )}
                {toast.message && (
                    <p className={`m-0 text-xs leading-snug ${toast.title ? 'text-slate-500 font-medium line-clamp-2' : 'text-slate-800 font-semibold'}`}>
                        {toast.message}
                    </p>
                )}
            </div>
            {toast.action && (
                <button
                    type="button"
                    onClick={() => { toast.action.onClick?.(); onClose(); }}
                    className="shrink-0 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border-none cursor-pointer whitespace-nowrap"
                >
                    {toast.action.label}
                </button>
            )}
            <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 bg-transparent border-none cursor-pointer"
            >
                <X size={15} />
            </button>
        </motion.div>
    );
}
