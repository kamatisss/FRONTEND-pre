import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { getAIDesignerHealth } from '../services/api';

/* Admin analytics: how often the AI Designer used Gemini vs the smart layout engine. */

const COLORS = { ok: '#10b981', cached: '#94a3b8' };

export default function AIDesignerHealthCard() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAIDesignerHealth(30).then(setData).catch(e => setError(e.message));
  }, []);

  return (
    <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Cpu size={18} color="#10b981" /> AI Designer health · last 30 days
      </h3>
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#64748b' }}>
        Every request returns three designs. When Gemini can't help, the smart layout engine covers for it.
      </p>
      {error ? <p style={{ color: '#ef4444', margin: 0 }}>{error}</p> : !data ? <p style={{ color: '#94a3b8', margin: 0 }}>Loading…</p> : (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              ['Design requests', data.total.toLocaleString()],
              ['Included an AI design', data.ai_share === null ? '—' : `${data.ai_share}%`],
              ['Average response', data.avg_ms ? `${(data.avg_ms / 1000).toFixed(1)} s` : '—'],
              ['Mode', data.mode === 'engine_only' ? 'Engine only' : 'AI + engine'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
              </div>
            ))}
          </div>
          {data.paused && (
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px' }}>
              Gemini is paused right now ({data.paused === 'quota' ? 'daily limit reached; resumes after the quota resets' : 'recent failures; retrying in a few minutes'}). Customers are getting smart layouts.
            </p>
          )}
          {data.statuses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>No AI Designer requests yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.statuses.map(s => (
                <div key={s.status} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 320px) 1fr 50px', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>{s.label}</span>
                  <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${(s.count / data.total) * 100}%`, height: '100%', borderRadius: 99, background: COLORS[s.status] || '#f59e0b' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
