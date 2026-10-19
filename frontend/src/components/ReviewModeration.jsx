import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageSquare, Star, Pin, EyeOff, Eye, Lock, Search, ChevronLeft, ChevronRight, Reply, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listReviewsForModeration, moderateReview } from '../services/api';

/*
 * Office admin: every service and product review in one place. Feature reviews on
 * the landing page carousel, hide spam or abuse, and reply publicly.
 * A review the customer kept private can't be featured.
 */

const SOURCES = [['all', 'All'], ['service', 'Garden projects'], ['product', 'Products']];
const STATUSES = [
  ['', 'All'], ['needs_reply', 'Needs reply'], ['live', 'Live'], ['featured', 'Featured'], ['hidden', 'Hidden'], ['private', 'Private'],
];

function Stars({ rating }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={13} fill={n <= rating ? '#f59e0b' : 'none'} color={n <= rating ? '#f59e0b' : '#cbd5e1'} />)}
    </span>
  );
}

export default function ReviewModeration() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ source: 'all', status: '', rating: '', q: '', page: 1 });
  const [search,  setSearch]  = useState('');
  const [data,    setData]    = useState(null);
  const [notice,  setNotice]  = useState(null);

  const flash = useCallback((msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(n => (n?.msg === msg ? null : n)), 4000);
  }, []);

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== 'all'));
    listReviewsForModeration(params).then(setData).catch(e => flash(e.message, 'error'));
  }, [filters, flash]);

  if (user?.staff_role === 'FIELD_CREW') {
    return <div className="p-10 text-center text-slate-500">Customer reviews are managed by office admins.</div>;
  }

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));
  const replace = (row) => setData(d => ({ ...d, results: d.results.map(r => (r.source === row.source && r.id === row.id ? row : r)) }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 shadow-sm"><MessageSquare size={20} className="text-white" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">Customer Reviews</h1>
              <p className="text-slate-500 text-xs md:text-sm m-0">Feature the best on the homepage, hide spam, and reply to customers.</p>
            </div>
          </div>
          <a href="/#reviews" target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl no-underline hover:bg-slate-50">
            <ExternalLink size={14} /> View homepage
          </a>
        </div>

        {data?.needs_reply > 0 && filters.status !== 'needs_reply' && (
          <button onClick={() => setFilter('status', 'needs_reply')}
                  className="w-full flex items-center gap-2 text-left text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 cursor-pointer">
            <AlertTriangle size={16} /> {data.needs_reply} review{data.needs_reply > 1 ? 's' : ''} rated 3★ or lower still {data.needs_reply > 1 ? 'have' : 'has'} no reply. A short, helpful reply shows future customers you care.
          </button>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {SOURCES.map(([k, l]) => (
              <button key={k} onClick={() => setFilter('source', k)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${filters.source === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                {l}
              </button>
            ))}
            <span className="w-px h-5 bg-slate-200 mx-1" />
            {STATUSES.map(([k, l]) => (
              <button key={k || 'all'} onClick={() => setFilter('status', k)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${filters.status === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filters.rating} onChange={e => setFilter('rating', e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Any rating</option>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}★</option>)}
            </select>
            <form className="flex-1 flex gap-2 min-w-[200px]" onSubmit={e => { e.preventDefault(); setFilter('q', search.trim()); }}>
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search comment, customer, product, booking #"
                       className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
              <button className="px-3 py-2 text-sm font-bold text-white bg-slate-900 rounded-lg border-none cursor-pointer">Search</button>
            </form>
          </div>
        </div>

        {!data ? (
          <p className="text-slate-400 text-sm">Loading reviews…</p>
        ) : data.results.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl py-14 text-center text-slate-500">No reviews match these filters.</div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-2">{data.count.toLocaleString()} review{data.count === 1 ? '' : 's'}</p>
            <div className="flex flex-col gap-3">
              {data.results.map(r => <ReviewRow key={`${r.source}-${r.id}`} review={r} onChange={replace} flash={flash} />)}
            </div>
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button disabled={data.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                        className="p-2 rounded-lg bg-white border border-slate-200 cursor-pointer disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-sm text-slate-600 font-semibold">Page {data.page} of {data.pages}</span>
                <button disabled={data.page >= data.pages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                        className="p-2 rounded-lg bg-white border border-slate-200 cursor-pointer disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </div>

      {notice && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${notice.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {notice.msg}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ review: r, onChange, flash }) {
  const [busy,     setBusy]     = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft,    setDraft]    = useState(r.reply);

  const update = async (body, okMsg) => {
    setBusy(true);
    try {
      const row = await moderateReview(r.source, r.id, body);
      onChange(row);
      if (okMsg) flash(okMsg);
      return true;
    } catch (e) {
      flash(e.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveReply = async () => {
    if (await update({ reply: draft }, draft.trim() ? 'Reply posted — the customer was notified.' : 'Reply removed.')) setReplying(false);
  };

  const live = r.is_public && !r.is_hidden;
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm ${r.is_hidden ? 'border-slate-200 opacity-70' : r.is_featured ? 'border-amber-300' : 'border-slate-100'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Stars rating={r.rating} />
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${r.source === 'service' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
          {r.source === 'service' ? 'Project' : 'Product'}
        </span>
        <span className="text-xs text-slate-500 font-semibold">{r.subject}</span>
        <span className="text-xs text-slate-400 ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
      </div>

      <p className="text-sm text-slate-800 leading-relaxed m-0 mb-2">{r.comment || <i className="text-slate-400">No comment</i>}</p>

      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
        <span className="text-slate-500">{r.customer} · shown as <b>{r.public_name}</b></span>
        {r.is_featured && <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2"><Pin size={10} /> Featured</span>}
        {!r.is_public && <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 rounded-full px-2"><Lock size={10} /> Private (customer's choice)</span>}
        {r.is_hidden && <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2"><EyeOff size={10} /> Hidden</span>}
        {live && !r.showcase_quality && !r.is_featured && <span className="font-semibold text-slate-400">Too short for the automatic carousel</span>}
      </div>

      {r.reply && !replying && (
        <div className="bg-slate-50 border-l-2 border-emerald-400 rounded-r-lg px-3 py-2 mb-3">
          <p className="text-[11px] font-bold text-emerald-700 m-0">Your reply · {new Date(r.replied_at).toLocaleDateString()}</p>
          <p className="text-sm text-slate-700 m-0">{r.reply}</p>
        </div>
      )}

      {replying && (
        <div className="mb-3">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000} rows={3} autoFocus
                    placeholder="Thank the customer, or acknowledge the problem and say what you did about it."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400" />
          <p className="text-[11px] text-slate-400 m-0 mb-2">
            {r.is_public ? 'Shown publicly under the review.' : 'The review is private, so only the customer will see this.'} The customer gets a notification.
          </p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={saveReply} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg border-none cursor-pointer disabled:opacity-50">
              {busy ? 'Saving…' : 'Post reply'}
            </button>
            <button onClick={() => { setReplying(false); setDraft(r.reply); }} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!replying && (
          <button onClick={() => setReplying(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border-none cursor-pointer">
            <Reply size={12} /> {r.reply ? 'Edit reply' : 'Reply'}
          </button>
        )}
        <button disabled={busy || !live} onClick={() => update({ is_featured: !r.is_featured }, r.is_featured ? 'Removed from the homepage.' : 'Featured on the homepage carousel.')}
                title={!r.is_public ? 'The customer kept this review private' : r.is_hidden ? 'Unhide it first' : ''}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  ${r.is_featured ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>
          <Pin size={12} /> {r.is_featured ? 'Unfeature' : 'Feature'}
        </button>
        {r.is_public && (
          <button disabled={busy} onClick={() => {
                    if (!r.is_hidden && !window.confirm('Hide this review from the website? Use this for spam, abuse or personal details — not to remove honest criticism. It still counts in the average rating.')) return;
                    update({ is_hidden: !r.is_hidden }, r.is_hidden ? 'Review is visible again.' : 'Review hidden from the website.');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 disabled:opacity-50">
            {r.is_hidden ? <><Eye size={12} /> Unhide</> : <><EyeOff size={12} /> Hide</>}
          </button>
        )}
      </div>
    </div>
  );
}
