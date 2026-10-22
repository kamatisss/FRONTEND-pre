import { useEffect } from 'react';

// body is overflow:hidden app-wide (App.css) because dashboards scroll inside <main>.
// Full-page screens (public pages, receipts, payment links) call this to scroll the window.
export function usePageScroll() {
  useEffect(() => {
    const { html, body } = { html: document.documentElement, body: document.body };
    const prev = [html.style.overflow, html.style.height, body.style.overflow, body.style.height];
    html.style.overflow = 'auto'; html.style.height = 'auto';
    body.style.overflow = 'auto'; body.style.height = 'auto';
    return () => {
      [html.style.overflow, html.style.height, body.style.overflow, body.style.height] = prev;
    };
  }, []);
}
