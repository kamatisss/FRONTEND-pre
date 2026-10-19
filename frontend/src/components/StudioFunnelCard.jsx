import { useEffect, useState } from 'react';
import { Box } from 'lucide-react';
import { getFunnelSummary } from '../services/api';

/* Admin analytics: how many visitors try the free 3D Studio, and how many sign up from it. */

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];

export default function StudioFunnelCard() {
  const [days,  setDays]  = useState(30);
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getFunnelSummary(days).then(setData).catch(e => setError(e.message));
  }, [days]);

  const max = Math.max(1, ...(data?.steps || []).map(s => s.count));

  return (
    <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Box size={18} color="#10b981" /> Free 3D Studio funnel
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Visitors who tried the Studio without an account, and what they did next. Each step counts once per visit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
          {RANGES.map(([d, label]) => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: days === d ? '#10b981' : 'transparent', color: days === d ? '#fff' : '#475569',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {error ? <p style={{ color: '#ef4444', margin: 0 }}>{error}</p> : !data ? <p style={{ color: '#94a3b8', margin: 0 }}>Loading…</p> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.steps.map(step => (
              <div key={step.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 260px) 1fr 90px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>{step.label}</span>
                <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${(step.count / max) * 100}%`, height: '100%', background: '#10b981', borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                  {step.count.toLocaleString()}
                  {step.rate !== null && step.name !== 'studio_opened' && (
                    <span style={{ color: '#64748b', fontWeight: 600 }}> · {step.rate}%</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 14, color: '#334155' }}>
            {data.conversion_rate === null
              ? 'No Studio visits recorded in this period yet.'
              : <>Studio → account conversion: <b style={{ color: '#047857' }}>{data.conversion_rate}%</b> of visitors signed up or signed in.</>}
          </p>
        </>
      )}
    </div>
  );
}
