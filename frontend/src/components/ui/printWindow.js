/* Printable sheets (pick lists, packing slips, crew run sheets).
   They open in their own window: the app shell clips page scrolling, so printing the
   dashboard itself would cut multi-page sheets off after the first page. */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const BASE_CSS = `
  body{font-family:Inter,system-ui,sans-serif;color:#0f172a;margin:24px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:16px;margin:0 0 6px} .muted{color:#64748b;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:10px 0} th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{font-size:11px;text-transform:uppercase;color:#64748b} .num{text-align:right;width:60px;font-weight:700}
  .box{width:18px} .box::before{content:'';display:inline-block;width:12px;height:12px;border:1.5px solid #475569;border-radius:2px}
  thead .box::before{display:none} .page{page-break-before:always;padding-top:4px}
  .tag{font-size:12px;border:1px solid #cbd5e1;border-radius:99px;padding:2px 8px;margin-left:6px} .sign{margin-top:18px;color:#475569}
`;

// Returns false when the browser blocked the pop-up
export function openPrintWindow(title, bodyHtml, extraCss = '') {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}${extraCss}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

export const printedAt = () => new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
