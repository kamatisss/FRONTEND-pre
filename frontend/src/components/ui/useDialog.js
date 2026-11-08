import { useEffect, useRef } from 'react';

// A modal dialog's behaviour, for a dialog rendered into document.body (createPortal), so it sits above
// every part of the page and nothing behind it can be used while it is open:
//   • focus moves into the dialog (its first field or button), and back to what opened it on close
//   • Tab / Shift+Tab stay inside the dialog
//   • Escape closes it (not while `busy`, e.g. while an order is being placed)
//   • the page behind is inert (no clicks, no focus, hidden from screen readers) and doesn't scroll
// Usage: const ref = useDialog(open, onClose, { busy }); <div ref={ref} role="dialog" aria-modal="true" …>

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useDialog(open, onClose, { busy = false } = {}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const app = document.getElementById('root');
    const wasInert = app?.inert;
    if (app) app.inert = true;   // the dialog lives in document.body, outside #root
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const items = () => [...(ref.current?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.offsetParent !== null);
    // First field if there is one (the form), else the first button; the dialog itself as a fallback
    const first = ref.current?.querySelector('input:not([disabled]):not([type="hidden"]), select, textarea') || items()[0];
    (first || ref.current)?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (!busyRef.current) { e.stopPropagation(); closeRef.current?.(); }
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const [a, z] = [list[0], list[list.length - 1]];
      if (e.shiftKey && (document.activeElement === a || !ref.current.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !ref.current.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (app) app.inert = !!wasInert;
      document.body.style.overflow = overflow;
      if (opener && document.contains(opener)) opener.focus?.({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
