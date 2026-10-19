import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, BookOpen } from 'lucide-react';
import { answerPortfolioConsent } from '../services/api';

/**
 * "Can we feature your garden?" — the customer's portfolio permission for one
 * finished booking (Data Privacy Act, RA 10173). Shown inside My Bookings.
 */
export default function PortfolioConsentCard({ entry, onUpdated }) {
  const consent = entry.consent || { status: 'pending' };
  const [editing, setEditing] = useState(consent.status === 'pending');
  const [choice,  setChoice]  = useState({
    name_display: consent.name_display || 'initials',
    show_house: consent.status === 'granted' ? consent.show_house : true,
    include_review: consent.status === 'granted' ? consent.include_review : true,
  });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);

  const answer = async (decision) => {
    if (decision === 'withdraw' && !window.confirm('Remove your garden from our portfolio? It will be taken down right away.')) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await answerPortfolioConsent(entry.id, decision === 'grant' ? { decision, ...choice } : { decision });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const box = { marginTop: '16px', padding: '18px 20px', borderRadius: '14px', border: '1.5px solid #CBD5E1', background: '#FFFFFF' };
  const label = { display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: '#1E293B', cursor: 'pointer', lineHeight: 1.45 };
  const btn = (primary) => ({
    padding: '9px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
    border: primary ? 'none' : '1.5px solid #CBD5E1', background: primary ? '#059669' : 'transparent',
    color: primary ? '#FFFFFF' : '#475569', opacity: busy ? 0.6 : 1,
  });
  const storyLink = (
    <Link to={`/projects/${entry.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
      <BookOpen size={14} /> {entry.status === 'published' ? 'View your project page' : 'View your private garden story'}
    </Link>
  );

  if (!editing) {
    const granted = consent.status === 'granted';
    return (
      <div style={box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <ShieldCheck size={16} style={{ color: granted ? '#059669' : '#64748B' }} />
          <strong style={{ fontSize: '0.92rem', color: '#0F172A' }}>
            {granted
              ? (entry.status === 'published' ? 'Your garden is featured in our Project Hub' : 'Thanks! Our team is preparing your project page')
              : 'You chose not to be featured'}
          </strong>
        </div>
        {granted && (
          <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5 }}>
            Shown as {consent.name_display === 'initials' ? 'your first name and last initial' : 'an anonymous client'}
            {' · '}{consent.show_house ? 'house may be visible' : 'no photos of your house'}
            {' · '}{consent.include_review ? 'with your review' : 'without your review'}.
            Your street address and contact details are never shown.
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
          {storyLink}
          {granted ? (
            <>
              <button style={{ ...btn(false), padding: '6px 12px' }} disabled={busy} onClick={() => setEditing(true)}>Change options</button>
              <button style={{ ...btn(false), padding: '6px 12px', color: '#991B1B', borderColor: '#FECACA' }} disabled={busy} onClick={() => answer('withdraw')}>
                Withdraw permission
              </button>
            </>
          ) : (
            <button style={{ ...btn(false), padding: '6px 12px' }} disabled={busy} onClick={() => setEditing(true)}>Changed your mind?</button>
          )}
        </div>
        {error && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 600 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ ...box, borderColor: '#6EE7B7', background: '#F0FDF4' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Sparkles size={16} style={{ color: '#059669' }} />
        <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>Can we feature your garden?</strong>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
        We'd love to show your finished project in our public portfolio. We only ever show your city, never your
        street address, phone number or full name. You can change your mind at any time.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {[['initials', 'Show my first name and last initial'], ['anonymous', 'Keep me anonymous']].map(([value, text]) => (
            <label key={value} style={label}>
              <input type="radio" name={`name-${entry.id}`} checked={choice.name_display === value}
                     onChange={() => setChoice(c => ({ ...c, name_display: value }))} style={{ accentColor: '#059669', marginTop: 2 }} />
              {text}
            </label>
          ))}
        </div>
        <label style={label}>
          <input type="checkbox" checked={choice.show_house} onChange={e => setChoice(c => ({ ...c, show_house: e.target.checked }))}
                 style={{ accentColor: '#059669', marginTop: 2 }} />
          Photos where my house is visible may be shown
        </label>
        <label style={label}>
          <input type="checkbox" checked={choice.include_review} onChange={e => setChoice(c => ({ ...c, include_review: e.target.checked }))}
                 style={{ accentColor: '#059669', marginTop: 2 }} />
          Include my rating and review
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <button style={btn(true)} disabled={busy} onClick={() => answer('grant')}>
          {consent.status === 'granted' ? 'Save my choices' : 'Yes, feature my garden'}
        </button>
        {consent.status === 'pending' ? (
          <button style={btn(false)} disabled={busy} onClick={() => answer('decline')}>No, thanks</button>
        ) : (
          <button style={btn(false)} disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
        )}
        <span style={{ marginLeft: 'auto' }}>{storyLink}</span>
      </div>
      {error && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 600 }}>{error}</p>}
    </div>
  );
}
