import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, ShoppingBag, CalendarCheck, HardHat, Truck, Wallet, AlertTriangle, Star, Image as ImageIcon, CheckCheck,
} from 'lucide-react';
import api from '../../services/api';

/*
 * The one notification bell for every signed-in role (customer, crew, office, admin), in TopNavbar.
 * It checks the unread count every 45 s while the tab is visible (and on returning to it), loads
 * the list when opened, and tapping a notification marks it read and opens what it is about.
 */

const POLL_MS = 45000;

const KIND_ICON = [
  [/^order|delivery_problem/, ShoppingBag, '#2563eb', '#eff6ff'],
  [/^delivery/, Truck, '#0891b2', '#ecfeff'],
  [/^job|crew_assigned/, HardHat, '#ea580c', '#fff7ed'],
  [/^booking/, CalendarCheck, '#059669', '#ecfdf5'],
  [/payment/, Wallet, '#7c3aed', '#f5f3ff'],
  [/review/, Star, '#ca8a04', '#fefce8'],
  [/portfolio/, ImageIcon, '#db2777', '#fdf2f8'],
];
const iconFor = (kind) => KIND_ICON.find(([re]) => re.test(kind || '')) || [null, AlertTriangle, '#64748b', '#f1f5f9'];

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);    // { results, has_more, page }
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const refreshCount = useCallback(() => {
    api.get('/notifications/unread_count/').then(r => setUnread(r.data.unread)).catch(() => {});
  }, []);

  // Poll only while the page is visible; catch up as soon as the visitor comes back to the tab
  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refreshCount(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshCount(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refreshCount]);

  const load = useCallback((page = 1) => {
    setLoading(true);
    api.get('/notifications/', { params: { page } })
      .then(r => {
        setUnread(r.data.unread);
        setList(prev => ({
          results: page === 1 ? r.data.results : [...(prev?.results || []), ...r.data.results],
          has_more: r.data.has_more, page,
        }));
      })
      .catch(() => setList(prev => prev || { results: [], has_more: false, page: 1, error: true }))
      .finally(() => setLoading(false));
  }, []);

  const toggle = () => {
    if (!open) load(1);
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const markRead = (n) => {
    if (n.is_read) return;
    setList(l => l && { ...l, results: l.results.map(x => (x.id === n.id ? { ...x, is_read: true } : x)) });
    setUnread(u => Math.max(0, u - 1));
    api.patch(`/notifications/${n.id}/mark_read/`).catch(() => {});
  };

  const openItem = (n) => {
    markRead(n);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const markAll = () => {
    setList(l => l && { ...l, results: l.results.map(x => ({ ...x, is_read: true })) });
    setUnread(0);
    api.post('/notifications/mark_all_read/').catch(() => {});
  };

  return (
    <div ref={boxRef} className="nb">
      <style>{`
        .nb { position: relative; }
        .nb-btn { position: relative; width: 40px; height: 40px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; transition: background .18s, border-color .18s; }
        .nb-btn:hover, .nb-btn[aria-expanded="true"] { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
        .nb-badge { position: absolute; top: -5px; right: -5px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 99px;
          background: #ef4444; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff; line-height: 1; }
        .nb-panel { position: absolute; right: 0; top: calc(100% + 8px); width: 380px; max-height: min(560px, calc(100vh - 90px));
          background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; box-shadow: 0 18px 50px rgba(15,23,42,0.18);
          display: flex; flex-direction: column; overflow: hidden; z-index: 120; animation: nb-in .16s ease-out; }
        @keyframes nb-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .nb-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 14px 10px 16px; border-bottom: 1px solid #f1f5f9; }
        .nb-head h3 { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
        .nb-head-actions { display: flex; align-items: center; gap: 4px; }
        .nb-link-btn { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 10px; border-radius: 8px; border: none;
          background: none; color: #047857; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .nb-link-btn:hover { background: #ecfdf5; }
        .nb-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: none; color: #64748b; cursor: pointer;
          display: flex; align-items: center; justify-content: center; }
        .nb-close:hover { background: #f1f5f9; }
        .nb-list { overflow-y: auto; overscroll-behavior: contain; }
        .nb-item { display: flex; gap: 12px; width: 100%; padding: 12px 16px; border: none; border-bottom: 1px solid #f8fafc; background: #fff;
          text-align: left; cursor: pointer; font: inherit; }
        .nb-item:hover { background: #f8fafc; }
        .nb-item.unread { background: #f0fdf4; }
        .nb-item.unread:hover { background: #e7f9ee; }
        .nb-ico { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .nb-msg { margin: 0; font-size: 13px; line-height: 1.45; color: #334155; }
        .nb-item.unread .nb-msg { color: #0f172a; font-weight: 600; }
        .nb-time { margin: 3px 0 0; font-size: 11.5px; color: #94a3b8; font-weight: 600; }
        .nb-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0; margin-top: 6px; }
        .nb-empty { padding: 36px 20px; text-align: center; color: #64748b; font-size: 13.5px; }
        .nb-more { width: 100%; min-height: 44px; border: none; background: #f8fafc; color: #047857; font-weight: 700; font-size: 13px; cursor: pointer; }
        @media (max-width: 640px) {
          /* Phones: a full-width panel under the navbar */
          .nb-panel { position: fixed; left: 8px; right: 8px; top: 64px; width: auto; max-height: calc(100vh - 80px); }
        }
        @media (prefers-reduced-motion: reduce) { .nb-panel { animation: none; } }
      `}</style>

      <button type="button" className="nb-btn" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <Bell size={18} />
        {unread > 0 && <span className="nb-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <div className="nb-head">
            <h3>Notifications</h3>
            <div className="nb-head-actions">
              {unread > 0 && <button type="button" className="nb-link-btn" onClick={markAll}><CheckCheck size={15} /> Mark all read</button>}
              <button type="button" className="nb-close" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
          </div>
          <div className="nb-list">
            {!list ? (
              <p className="nb-empty">Loading…</p>
            ) : list.error && !list.results.length ? (
              <p className="nb-empty">Could not load notifications. Try again in a moment.</p>
            ) : !list.results.length ? (
              <p className="nb-empty">You're all caught up.<br />New orders, jobs and updates will show up here.</p>
            ) : (
              <>
                {list.results.map(n => {
                  const [, Icon, color, bg] = iconFor(n.kind);
                  return (
                    <button key={n.id} type="button" className={`nb-item ${n.is_read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                      <span className="nb-ico" style={{ color, background: bg }}><Icon size={17} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <p className="nb-msg">{n.message}</p>
                        <p className="nb-time">{ago(n.timestamp)}</p>
                      </span>
                      {!n.is_read && <span className="nb-dot" aria-label="Unread" />}
                    </button>
                  );
                })}
                {list.has_more && (
                  <button type="button" className="nb-more" onClick={() => load(list.page + 1)} disabled={loading}>
                    {loading ? 'Loading…' : 'Show older'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
