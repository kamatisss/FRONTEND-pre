import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, ChevronLeft, ChevronRight, Quote, MessageCircle, ArrowRight, Pin } from 'lucide-react';
import { getReviewHighlights } from '../services/api';

/*
 * Landing page "Customer stories" — real reviews from signed-off projects and
 * delivered orders (GET /api/review-highlights/). Hidden entirely when there are none.
 */

const TABS = [
  ['all', 'All reviews'],
  ['service', 'Garden projects'],
  ['product', 'Plants & products'],
];
const AUTOPLAY_MS = 6000;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Touch screens: people swipe themselves, and a card sliding away mid-sentence is
// annoying (and fails WCAG 2.2.2), so no autoplay there
const isTouchScreen = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const MAX_DOTS = 10;

function Stars({ rating, size = 14 }) {
  return (
    <span className="gs-rc-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} fill={n <= Math.round(rating) ? '#10b981' : 'none'} color={n <= Math.round(rating) ? '#10b981' : '#cbd5e1'} />
      ))}
    </span>
  );
}

function Summary({ label, data }) {
  if (!data?.count) return null;
  const max = Math.max(...Object.values(data.distribution), 1);
  return (
    <div className="gs-rc-summary">
      <div className="gs-rc-summary-head">
        <span className="gs-rc-avg">{data.average}</span>
        <div>
          <Stars rating={data.average} size={13} />
          <p className="gs-rc-summary-label">{label} · {data.count.toLocaleString()} reviews</p>
        </div>
      </div>
      <div className="gs-rc-bars" aria-label={`${label} rating distribution`}>
        {Object.entries(data.distribution).map(([star, count]) => (
          <div key={star} className="gs-rc-bar-row" title={`${count} × ${star}★`}>
            <span>{star}★</span>
            <div className="gs-rc-bar"><div style={{ width: `${(count / max) * 100}%` }} /></div>
            <span className="gs-rc-bar-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }) {
  const ctx = review.context;
  const isProject = review.source === 'service';
  const when = new Date(`${review.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return (
    <article className="gs-rc-card">
      <div className="gs-rc-card-top">
        <Stars rating={review.rating} />
        <span className={`gs-rc-badge ${isProject ? 'project' : 'purchase'}`}>
          <ShieldCheck size={11} /> {isProject ? 'Verified project' : 'Verified purchase'}
        </span>
      </div>
      {review.is_featured && <span className="gs-rc-pinned"><Pin size={10} /> Staff pick</span>}
      <Quote size={30} className="gs-rc-quote" aria-hidden="true" />
      <p className="gs-rc-text">"{review.comment}"</p>

      {review.reply && (
        <div className="gs-rc-reply">
          <p className="gs-rc-reply-label"><MessageCircle size={11} /> Response from Garden Studio</p>
          <p className="gs-rc-reply-text">{review.reply}</p>
        </div>
      )}

      <div className="gs-rc-footer">
        <div className="gs-rc-avatar" aria-hidden="true">{review.name[0]}</div>
        <div className="gs-rc-who">
          <p className="gs-rc-name">{review.name}</p>
          <p className="gs-rc-context">
            {isProject ? ctx.label : `Bought ${ctx.label}`}{ctx.city ? ` · ${ctx.city}` : ''} · {when}
          </p>
        </div>
        {ctx.image_url && <img src={ctx.image_url} alt="" className="gs-rc-thumb" loading="lazy" />}
      </div>
      {ctx.link && (
        <Link to={ctx.link} className="gs-rc-link">
          {isProject ? 'See this project' : 'View in shop'} <ArrowRight size={13} />
        </Link>
      )}
    </article>
  );
}

export default function ReviewCarousel() {
  const [source,  setSource]  = useState('all');
  const [cache,   setCache]   = useState({});   // source → { summary, results }
  const [index,   setIndex]   = useState(0);    // first fully visible card
  const [stops,   setStops]   = useState(1);    // scroll positions available
  const [paused,  setPaused]  = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    if (cache[source]) return;
    getReviewHighlights(source)
      .then(d => setCache(c => ({ ...c, [source]: d })))
      .catch(() => setCache(c => ({ ...c, [source]: { summary: null, results: [] } })));
  }, [source, cache]);

  const data = cache[source];
  const results = data?.results || [];
  const summary = (cache.all || data)?.summary;

  // Card width + gap = one scroll step
  const step = useCallback(() => {
    const track = trackRef.current;
    const card = track?.firstElementChild;
    if (!card) return 1;
    return card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '0');
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const s = step();
    const visible = Math.max(1, Math.round(track.clientWidth / s));
    setStops(Math.max(1, results.length - visible + 1));
    setIndex(Math.round(track.scrollLeft / s));
  }, [results.length, step]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const goTo = useCallback((i) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * step(), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [step]);

  // New tab → back to the first card
  useEffect(() => { trackRef.current?.scrollTo({ left: 0 }); }, [source]);

  // Autoplay — paused on hover, focus or touch, and off for reduced motion
  useEffect(() => {
    if (paused || stops <= 1 || prefersReducedMotion() || isTouchScreen()) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') goTo(index + 1 >= stops ? 0 : index + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, stops, index, goTo]);

  // Nothing real to show yet → no section (never fall back to invented testimonials)
  if (cache.all && !cache.all.results.length && !cache.all.summary?.service?.count && !cache.all.summary?.product?.count) return null;

  return (
    <section id="reviews" className="gs-testimonials" aria-roledescription="carousel" aria-label="Customer reviews">
      <style>{`
        .gs-rc-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; flex-wrap: wrap; margin-bottom: 28px; }
        .gs-rc-summaries { display: flex; gap: 16px; flex-wrap: wrap; }
        .gs-rc-summary { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 16px; min-width: 230px; }
        .gs-rc-summary-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .gs-rc-avg { font-size: 32px; font-weight: 900; color: #0f172a; letter-spacing: -1px; line-height: 1; }
        .gs-rc-summary-label { font-size: 12px; color: #64748b; margin: 2px 0 0; font-weight: 600; }
        .gs-rc-bars { display: flex; flex-direction: column; gap: 3px; }
        .gs-rc-bar-row { display: grid; grid-template-columns: 22px 1fr 34px; align-items: center; gap: 6px; font-size: 11px; color: #64748b; font-weight: 600; }
        .gs-rc-bar { height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
        .gs-rc-bar > div { height: 100%; background: #10b981; border-radius: 99px; }
        .gs-rc-bar-count { text-align: right; }
        .gs-rc-stars { display: inline-flex; gap: 2px; }
        .gs-rc-tabs { display: inline-flex; gap: 4px; padding: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 100px; margin-bottom: 24px; flex-wrap: wrap; }
        .gs-rc-tab { padding: 8px 16px; border-radius: 100px; border: none; background: transparent; font-size: 13px; font-weight: 700; color: #475569; cursor: pointer; transition: background .2s, color .2s; }
        .gs-rc-tab[aria-selected="true"] { background: #10b981; color: #fff; }
        .gs-rc-viewport { position: relative; }
        .gs-rc-track {
          display: flex; column-gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory;
          scrollbar-width: none; padding: 4px 2px 16px; overscroll-behavior-x: contain;
        }
        .gs-rc-track::-webkit-scrollbar { display: none; }
        .gs-rc-slide { flex: 0 0 calc((100% - 40px) / 3); min-width: 0; scroll-snap-align: start; display: flex; }
        .gs-rc-card {
          flex: 1; min-width: 0; position: relative;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 26px 24px 22px;
          display: flex; flex-direction: column; transition: border-color .2s, box-shadow .2s;
        }
        .gs-rc-card:hover { border-color: #a7f3d0; box-shadow: 0 8px 30px rgba(16,185,129,0.08); }
        .gs-rc-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 14px; }
        .gs-rc-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 99px; white-space: nowrap; }
        .gs-rc-badge.project { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; }
        .gs-rc-badge.purchase { color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; }
        .gs-rc-pinned { display: inline-flex; align-items: center; gap: 3px; align-self: flex-start; font-size: 10px; font-weight: 800; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 99px; margin-bottom: 10px; }
        .gs-rc-quote { position: absolute; top: 56px; right: 22px; color: #d1fae5; z-index: 0; } /* decorative: sits behind the text */
        .gs-rc-text {
          position: relative; z-index: 1;
          font-size: 15px; line-height: 1.7; color: #334155; margin: 0 0 18px; flex: 1;
          display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden;
        }
        .gs-rc-reply { background: #f8fafc; border-left: 3px solid #10b981; border-radius: 0 10px 10px 0; padding: 10px 12px; margin-bottom: 16px; }
        .gs-rc-reply-label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; color: #047857; margin: 0 0 3px; }
        .gs-rc-reply-text { font-size: 13px; line-height: 1.55; color: #475569; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .gs-rc-footer { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
        .gs-rc-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #059669, #34d399); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .gs-rc-who { flex: 1; min-width: 0; }
        .gs-rc-name { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0; }
        .gs-rc-context { font-size: 12px; color: #64748b; margin: 1px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gs-rc-thumb { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0; }
        .gs-rc-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; font-size: 13px; font-weight: 700; color: #059669; text-decoration: none; align-self: flex-start; }
        .gs-rc-link:hover { gap: 7px; }
        .gs-rc-arrow {
          position: absolute; top: calc(50% - 30px); width: 42px; height: 42px; border-radius: 50%;
          background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 6px 20px rgba(15,23,42,0.1);
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #0f172a; z-index: 2;
          transition: opacity .2s, transform .2s;
        }
        .gs-rc-arrow:hover:not(:disabled) { transform: scale(1.06); }
        .gs-rc-arrow:disabled { opacity: 0; pointer-events: none; }
        .gs-rc-arrow.prev { left: -20px; } .gs-rc-arrow.next { right: -20px; }
        .gs-rc-dots { display: flex; justify-content: center; gap: 6px; margin-top: 6px; }
        .gs-rc-dot { width: 8px; height: 8px; border-radius: 99px; border: none; background: #cbd5e1; cursor: pointer; padding: 0; transition: width .25s, background .25s; position: relative; }
        .gs-rc-dot::after { content: ''; position: absolute; inset: -10px -4px; } /* finger-sized hit area */
        .gs-rc-dot[aria-current="true"] { width: 24px; background: #10b981; }
        .gs-rc-hint { display: none; text-align: center; font-size: 12px; font-weight: 600; color: #64748b; margin: 10px 0 0; }
        .gs-rc-note { text-align: center; font-size: 12px; color: #94a3b8; margin: 18px 0 0; }
        .gs-rc-skeleton { flex: 0 0 calc((100% - 40px) / 3); height: 260px; border-radius: 20px; background: #fff; border: 1px solid #e2e8f0; animation: gs-rc-pulse 1.4s ease-in-out infinite; }
        @keyframes gs-rc-pulse { 50% { opacity: .5; } }
        @media (max-width: 1024px) { .gs-rc-slide, .gs-rc-skeleton { flex-basis: calc((100% - 20px) / 2); } }
        @media (max-width: 640px) {
          .gs-rc-slide, .gs-rc-skeleton { flex-basis: 84%; }
          .gs-rc-track { column-gap: 12px; scroll-padding-left: 2px; }
          .gs-rc-card { padding: 20px 18px 18px; border-radius: 18px; }
          .gs-rc-quote { display: none; }
          .gs-rc-arrow { display: none; }
          .gs-rc-summary { min-width: 0; flex: 1 1 100%; padding: 12px 14px; }
          /* Score + count is enough on a phone; the bar charts pushed the reviews a full screen down */
          .gs-rc-bars { display: none; }
          .gs-rc-summary-head { margin-bottom: 0; }
          .gs-rc-avg { font-size: 26px; }
          .gs-rc-head { gap: 20px; margin-bottom: 20px; }
          .gs-rc-summaries { gap: 10px; width: 100%; }
          .gs-rc-tabs { display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: 100%; border-radius: 14px; }
          .gs-rc-tabs::-webkit-scrollbar { display: none; }
          .gs-rc-tab { flex-shrink: 0; white-space: nowrap; padding: 8px 14px; border-radius: 10px; }
          .gs-rc-hint { display: block; }
        }
        @media (prefers-reduced-motion: reduce) { .gs-rc-skeleton { animation: none; } }
      `}</style>

      <div className="gs-container">
        <div className="gs-rc-head">
          <div>
            <div className="gs-section-eyebrow" style={{ marginBottom: 16 }}>Customer stories</div>
            <h2 className="gs-section-title" style={{ margin: 0 }}>Loved by homeowners</h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 460, margin: '12px 0 0', lineHeight: 1.65 }}>
              Real reviews from finished garden projects and delivered shop orders.
            </p>
          </div>
          {summary && (
            <div className="gs-rc-summaries">
              {source !== 'product' && <Summary label="Garden projects" data={summary.service} />}
              {source !== 'service' && <Summary label="Plants & products" data={summary.product} />}
            </div>
          )}
        </div>

        <div className="gs-rc-tabs" role="tablist" aria-label="Review type">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={source === key} className="gs-rc-tab" onClick={() => setSource(key)}>
              {label}
            </button>
          ))}
        </div>

        <div
          className="gs-rc-viewport"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
        >
          <button className="gs-rc-arrow prev" aria-label="Previous reviews" disabled={index <= 0} onClick={() => goTo(index - 1)}>
            <ChevronLeft size={20} />
          </button>
          <div className="gs-rc-track" ref={trackRef} onScroll={measure} aria-live={paused ? 'polite' : 'off'}>
            {!data
              ? [0, 1, 2].map(i => <div key={i} className="gs-rc-skeleton" />)
              : results.length === 0
                ? <p style={{ color: '#64748b', margin: '24px 0' }}>No reviews of this type yet.</p>
                : results.map((r, i) => (
                    <div key={`${r.source}-${r.id}`} className="gs-rc-slide"
                         role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${results.length}`}>
                      <ReviewCard review={r} />
                    </div>
                  ))}
          </div>
          <button className="gs-rc-arrow next" aria-label="Next reviews" disabled={index >= stops - 1} onClick={() => goTo(index + 1)}>
            <ChevronRight size={20} />
          </button>
        </div>

        {stops > 1 && stops <= MAX_DOTS && (
          <div className="gs-rc-dots">
            {Array.from({ length: stops }, (_, i) => (
              <button key={i} className="gs-rc-dot" aria-label={`Go to review ${i + 1}`} aria-current={i === index} onClick={() => goTo(i)} />
            ))}
          </div>
        )}

        {stops > 1 && (
          <p className="gs-rc-hint" aria-hidden="true">
            {Math.min(index + 1, results.length)} of {results.length} · swipe to read more
          </p>
        )}

        <p className="gs-rc-note">
          Every review comes from a signed-off project or a delivered order. Ratings include all public reviews, good and bad.
        </p>
      </div>
    </section>
  );
}
