import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Defaults review a service booking; pass `endpoint` + `payload` (and copy props)
// to reuse the same modal for other reviews, e.g. delivered shop products.
export default function ServiceRatingModal({
  bookingId,
  onClose,
  onSuccess,
  endpoint = '/reviews/',
  payload,
  title = 'How was your experience?',
  subtitle = 'Your feedback helps us improve and helps other homeowners choose confidently.',
  commentLabel = 'Service Comments',
  placeholder = 'Tell us about your experience — what went well, what could improve…',
}) {
  const { authTokens } = useAuth();
  const [rating, setRating]   = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [keepPrivate, setKeepPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authTokens.access}`,
        },
        body: JSON.stringify({ ...(payload || { booking: bookingId }), rating, comment, is_public: !keepPrivate }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
      } else {
        const msg = data?.booking?.[0] || data?.order_item?.[0] || data?.rating?.[0] || data?.detail || 'Submission failed.';
        setError(msg);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const active = hovered || rating;

  return (
    <>
      <style>{`
        .srm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}
        .srm-card{background:#fff;border-radius:20px;padding:32px 28px;width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,.18);position:relative}
        .srm-close{position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:#64748b;padding:4px;border-radius:8px;display:flex;align-items:center}
        .srm-close:hover{background:#f1f5f9;color:#0f172a}
        .srm-title{font-size:1.25rem;font-weight:800;color:#0f172a;margin:0 0 4px}
        .srm-sub{font-size:.85rem;color:#64748b;margin:0 0 24px}
        .srm-stars{display:flex;gap:6px;margin-bottom:20px}
        .srm-star{background:none;border:none;cursor:pointer;padding:2px;transition:transform .12s}
        .srm-star:hover{transform:scale(1.15)}
        .srm-label{font-size:.75rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px}
        .srm-textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:.9rem;color:#0f172a;resize:vertical;min-height:90px;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color .15s}
        .srm-textarea:focus{border-color:#10b981}
        .srm-error{font-size:.8rem;color:#dc2626;margin:8px 0 0;font-weight:600}
        .srm-submit{margin-top:20px;width:100%;padding:13px;background:#10b981;color:#fff;font-size:.95rem;font-weight:700;border:none;border-radius:12px;cursor:pointer;transition:background .15s}
        .srm-submit:hover:not(:disabled){background:#059669}
        .srm-submit:disabled{opacity:.6;cursor:not-allowed}
        .srm-privacy{margin-top:14px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px}
        .srm-privacy-text{font-size:.75rem;color:#64748b;line-height:1.5;margin:0 0 6px}
        .srm-privacy-check{display:flex;align-items:center;gap:6px;font-size:.8rem;font-weight:600;color:#334155;cursor:pointer}
        .srm-rating-label{font-size:.85rem;font-weight:600;color:#10b981;margin-left:8px;min-width:80px}
      `}</style>

      <div className="srm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="srm-card">
          <button className="srm-close" onClick={onClose}><X size={18} /></button>
          <p className="srm-title">{title}</p>
          <p className="srm-sub">{subtitle}</p>

          <form onSubmit={handleSubmit}>
            <span className="srm-label">Your Rating</span>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <div className="srm-stars">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className="srm-star"
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(n)}
                  >
                    <Star
                      size={32}
                      fill={n <= active ? '#10b981' : 'none'}
                      color={n <= active ? '#10b981' : '#cbd5e1'}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
              <span className="srm-rating-label">
                {active === 1 && 'Poor'}
                {active === 2 && 'Fair'}
                {active === 3 && 'Good'}
                {active === 4 && 'Great'}
                {active === 5 && 'Excellent!'}
              </span>
            </div>

            <span className="srm-label">{commentLabel}</span>
            <textarea
              className="srm-textarea"
              placeholder={placeholder}
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={1000}
            />

            {/* Data Privacy Act: tell customers exactly how a review is shown, and let them opt out */}
            <div className="srm-privacy">
              <p className="srm-privacy-text">
                {keepPrivate
                  ? 'Only the Garden Studio team will see this review.'
                  : 'Reviews appear on our website with your first name and last initial (and your city for garden projects). Never your full name, address or contact details.'}
              </p>
              <label className="srm-privacy-check">
                <input type="checkbox" checked={keepPrivate} onChange={e => setKeepPrivate(e.target.checked)} />
                Keep my review private
              </label>
            </div>

            {error && <p className="srm-error">{error}</p>}

            <button className="srm-submit" type="submit" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
