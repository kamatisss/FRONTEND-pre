import { Children, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { color } from './tokens';

/*
 * Swipe carousel for phones: native scroll-snap (smooth on real touch screens),
 * the next card peeks in, plus arrows, dots and an "n of total" caption.
 * Cards keep their own height (no stretching to the tallest one).
 *
 *   <SwipeCarousel label="Bookings in progress" caption={i => bookings[i].service_type}>
 *     {bookings.map(b => <BookingCard key={b.id} … />)}
 *   </SwipeCarousel>
 */
export default function SwipeCarousel({ label, caption, slideWidth = '88%', gap = 12, children }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const slides = Children.toArray(children);
  const count = slides.length;

  const onScroll = () => {
    const el = ref.current;
    if (!el?.children.length) return;
    const cards = [...el.children];
    // At the end the last card counts as shown even if it can't reach the centre
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) { setIndex(cards.length - 1); return; }
    const mid = el.scrollLeft + el.clientWidth / 2;
    const dist = cards.map(c => Math.abs(c.offsetLeft - el.offsetLeft + c.offsetWidth / 2 - mid));
    setIndex(dist.indexOf(Math.min(...dist)));
  };

  const goTo = (i) => {
    const el = ref.current;
    const card = el?.children[i];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  };

  const arrow = (disabled) => ({
    width: 36, height: 36, borderRadius: '50%', border: `1px solid ${color.border}`, background: color.white,
    color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, padding: 0,
  });

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="swipe-carousel"
        style={{
          display: 'flex', gap, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch', alignItems: 'flex-start', padding: '2px 2px 6px',
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.key ?? i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            style={{ flex: `0 0 ${count === 1 ? '100%' : slideWidth}`, minWidth: 0, scrollSnapAlign: 'center' }}
          >
            {slide}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 }}>
            <button type="button" aria-label="Previous" onClick={() => goTo(index - 1)} disabled={index === 0} style={arrow(index === 0)}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {slides.map((_, i) => (
                <button key={i} type="button" aria-label={`Go to ${i + 1} of ${count}`} aria-current={index === i} onClick={() => goTo(i)}
                  style={{ width: index === i ? 22 : 8, height: 8, borderRadius: 99, border: 'none', padding: 0, cursor: 'pointer',
                           background: index === i ? color.brand : '#CBD5E1', transition: 'all 0.25s' }} />
              ))}
            </div>
            <button type="button" aria-label="Next" onClick={() => goTo(index + 1)} disabled={index === count - 1} style={arrow(index === count - 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: color.muted, margin: '6px 0 0', fontWeight: 600 }}>
            {index + 1} of {count}{caption ? ` · ${caption(index)}` : ''} · swipe to see more
          </p>
        </>
      )}
      <style>{'.swipe-carousel::-webkit-scrollbar { display: none; }'}</style>
    </div>
  );
}
