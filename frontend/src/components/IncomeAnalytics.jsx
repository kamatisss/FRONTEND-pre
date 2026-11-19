import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, AlertTriangle, Star, Table2, BarChart3, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL as API_ROOT } from '../config';

const API_BASE_URL = API_ROOT;

/* ═══════════════════════════════════════════════════════════════════════
   INCOME ANALYTICS — Landscape services vs E-commerce
   ─────────────────────────────────────────────────────────────────────
   Series colors are validated categorical slots 1 + 2 (blue / orange) on
   the white card surface: CVD ΔE 24.7, normal-vision ΔE 33.6, both ≥ 3:1.
   Every Landscape mark is blue and every E-commerce mark is orange, on
   every chart, so identity never changes between views.
   ═══════════════════════════════════════════════════════════════════════ */

// partial: the same hue at 55% on white, for a period the range only partly covers (first / last bar)
const SERIES = {
  landscape: { key: 'landscape', label: 'Landscape services', color: '#2a78d6', track: '#cde2fb', partial: '#8ab5e8' },
  ecommerce: { key: 'ecommerce', label: 'E-commerce', color: '#eb6834', track: '#fbdccf', partial: '#f4ac8f' },
};

const RANGES = [
  { key: '30d', label: 'Last 30 days', compare: 'vs previous 30 days' },
  { key: '90d', label: 'Last 90 days', compare: 'vs previous 90 days' },
  { key: '12m', label: 'Last 12 months', compare: 'vs previous 12 months' },
  { key: 'all', label: 'All time', compare: null },
];

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const pesoCompact = (v) => {
  const n = Number(v || 0);
  const fmt = (x, s) => `₱${x.toFixed(1).replace(/\.0$/, '')}${s}`;
  if (Math.abs(n) >= 1e6) return fmt(n / 1e6, 'M');
  if (Math.abs(n) >= 1e3) return fmt(n / 1e3, 'K');
  return `₱${Math.round(n)}`;
};
const parseDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const shortDay = (iso) => parseDay(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
// "partial: Nov 1–19" for a bucket the range only partly covers (the API says which days it holds)
const partialNote = (d) => (d.partial ? `partial: ${shortDay(d.from)}–${shortDay(d.to)}` : '');
// withYear: the axis marks the first tick and each January so a 12-month span
// that repeats a month name (Oct '25 … Oct '26) stays unambiguous
const periodLabel = (iso, granularity, long = false, withYear = false) => {
  const d = parseDay(iso);
  if (granularity === 'week') {
    const s = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return long ? `Week of ${s}, ${d.getFullYear()}` : s;
  }
  if (long) return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return withYear ? `${month} '${String(d.getFullYear()).slice(2)}` : month;
};

// integer: counts (requests, orders) get whole-number ticks, never 2.5
function niceScale(max, tickCount = 4, integer = false) {
  if (!max) return integer ? { max: 4, ticks: [0, 1, 2, 3, 4] } : { max: 1000, ticks: [0, 250, 500, 750, 1000] };
  const raw = max / tickCount;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const steps = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const step = Math.max(integer ? 1 : 0, steps.map((m) => m * pow).find((s) => s >= raw));
  const top = Math.ceil(max / step) * step;
  return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* ── Shared hover tooltip (fixed to the viewport, follows pointer/focus) ── */
function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    if (e.clientX !== undefined && e.type !== 'focus') {
      setTip({ x: e.clientX, y: e.clientY, content });
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, content });
    }
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div className="ia-tooltip" role="status"
      style={{ left: Math.min(tip.x + 14, window.innerWidth - 250), top: Math.min(tip.y + 14, window.innerHeight - 110) }}>
      {tip.content}
    </div>
  );
  return { show, hide, node };
}

function TooltipRows({ title, rows }) {
  return (
    <>
      <div className="ia-tt-title">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="ia-tt-row">
          {r.color && <span className="ia-tt-key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span className="ia-tt-label">{r.label}</span>
        </div>
      ))}
    </>
  );
}

/* ── Stat tile ──────────────────────────────────────────────────────── */
function StatTile({ label, value, delta, compare, sub, swatch, hero = false, link = null }) {
  const hasDelta = delta !== null && delta !== undefined;
  const up = hasDelta && delta >= 0;
  return (
    <div className={`ia-card ia-tile${hero ? ' ia-tile-hero' : ''}`}>
      <div className="ia-tile-label">
        {swatch && <span className="ia-swatch" style={{ background: swatch }} />}
        {label}
      </div>
      <div className="ia-tile-value">{value}</div>
      {hasDelta && compare && (
        <div className={`ia-delta ${up ? 'ia-up' : 'ia-down'}`}>
          {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {up ? '+' : ''}{delta}% <span className="ia-muted">{compare}</span>
        </div>
      )}
      {sub && <div className="ia-tile-sub">{sub}</div>}
      {link && <Link to={link.to} className="ia-tile-link">{link.label}</Link>}
    </div>
  );
}

/* ── Revenue share: one 100% bar, two segments with a 2px surface gap ─ */
function ShareBar({ landscape, ecommerce, tooltip, title = 'Share of earned income' }) {
  const total = landscape + ecommerce;
  const parts = [
    { ...SERIES.landscape, value: landscape },
    { ...SERIES.ecommerce, value: ecommerce },
  ];
  return (
    <div>
      <div className="ia-share" role="img"
        aria-label={`Landscape ${peso(landscape)}, E-commerce ${peso(ecommerce)}`}>
        {total === 0 ? <div className="ia-share-empty" /> : parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.key} className="ia-share-seg" tabIndex={0}
            style={{ flexGrow: p.value, background: p.color }}
            onPointerMove={(e) => tooltip.show(e, <TooltipRows title={title}
              rows={[{ label: p.label, value: `${peso(p.value)} · ${((p.value / total) * 100).toFixed(1)}%`, color: p.color }]} />)}
            onFocus={(e) => tooltip.show(e, <TooltipRows title={title}
              rows={[{ label: p.label, value: `${peso(p.value)} · ${((p.value / total) * 100).toFixed(1)}%`, color: p.color }]} />)}
            onPointerLeave={tooltip.hide} onBlur={tooltip.hide} />
        ))}
      </div>
      <div className="ia-legend ia-legend-share">
        {parts.map((p) => (
          <div key={p.key} className="ia-legend-item">
            <span className="ia-swatch" style={{ background: p.color }} />
            <span>{p.label}</span>
            <strong>{total ? `${((p.value / total) * 100).toFixed(1)}%` : '—'}</strong>
            <span className="ia-muted">{peso(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Trend: grouped columns per period, one shared y-axis ─────────────
   series: two { key, label, color, partial } (key = the field on each period row). Used for earned
   income, collected money and demand counts; the colors always follow the stream (blue = landscape,
   orange = shop). legend: name the series under the chart when no share bar above does it. */
const INCOME_SERIES = [SERIES.landscape, SERIES.ecommerce];

function TrendChart({ data, granularity, tooltip, series = INCOME_SERIES, fmt = peso, fmtAxis = pesoCompact,
  integer = false, label = 'Earned income per period by service', legend = false }) {
  const [ref, width] = useWidth();
  const [hovered, setHovered] = useState(null);
  const [a, b] = series;
  const height = 280;
  const m = { top: 12, right: 8, bottom: 30, left: 52 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const { max, ticks } = niceScale(Math.max(0, ...data.flatMap((d) => [d[a.key], d[b.key]])), 4, integer);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, (band * 0.7 - 2) / 2));
  const y = (v) => m.top + plotH - (v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(band, 1)));

  // Column with a 4px rounded data-end and a square baseline
  const column = (x, v) => {
    const top = y(v);
    const h = m.top + plotH - top;
    if (h <= 0) return null;
    const r = Math.min(4, h, barW / 2);
    return `M${x},${m.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${m.top + plotH} Z`;
  };

  const hasPartial = data.some((d) => d.partial);
  const tipFor = (d) => (
    <TooltipRows title={`${periodLabel(d.period, granularity, true)}${d.partial ? ` · ${partialNote(d)}` : ''}`} rows={[
      { label: a.label, value: fmt(d[a.key]), color: a.color },
      { label: b.label, value: fmt(d[b.key]), color: b.color },
    ]} />
  );

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)}
                stroke={t === 0 ? 'var(--ia-axis)' : 'var(--ia-grid)'} strokeWidth="1" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="ia-axis-text">{fmtAxis(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = m.left + i * band;
            const x1 = gx + band / 2 - barW - 1;
            const x2 = gx + band / 2 + 1;
            return (
              <g key={d.period}>
                {hovered === i && <rect x={gx} y={m.top} width={band} height={plotH} fill="var(--ia-hover)" />}
                {/* A period the range only partly covers is drawn lighter: it isn't a slump, it's fewer days */}
                {d[a.key] > 0 && <path d={column(x1, d[a.key])} fill={d.partial ? a.partial : a.color} />}
                {d[b.key] > 0 && <path d={column(x2, d[b.key])} fill={d.partial ? b.partial : b.color} />}
                {i % labelEvery === 0 && (
                  <text x={gx + band / 2} y={height - 10} textAnchor="middle" className="ia-axis-text">
                    {periodLabel(d.period, granularity, false, i === 0 || parseDay(d.period).getMonth() === 0)}
                  </text>
                )}
                {/* Hit target: the whole period band, not just the painted columns */}
                <rect x={gx} y={m.top} width={band} height={plotH} fill="transparent" tabIndex={0}
                  aria-label={`${periodLabel(d.period, granularity, true)}${d.partial ? ` (${partialNote(d)})` : ''}: ${a.label} ${fmt(d[a.key])}, ${b.label} ${fmt(d[b.key])}`}
                  onPointerMove={(e) => { setHovered(i); tooltip.show(e, tipFor(d)); }}
                  onFocus={(e) => { setHovered(i); tooltip.show(e, tipFor(d)); }}
                  onPointerLeave={() => { setHovered(null); tooltip.hide(); }}
                  onBlur={() => { setHovered(null); tooltip.hide(); }} />
              </g>
            );
          })}
        </svg>
      )}
      {(legend || hasPartial) && (
        <div className="ia-legend">
          {legend && series.map((s) => (
            <span key={s.key} className="ia-legend-item"><span className="ia-swatch" style={{ background: s.color }} />{s.label}</span>
          ))}
          {/* Explains the lighter bars */}
          {hasPartial && (
            <span className="ia-legend-item ia-muted">
              <span className="ia-swatch" style={{ background: a.partial }} />
              <span className="ia-swatch" style={{ background: b.partial, marginLeft: -4 }} />
              Lighter bars: only part of that {granularity} is in the range (fewer days, not a drop)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── CSV export: summary, comparison table and every breakdown, as
      titled sections in one file (same numbers as the dashboard) ───── */
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function exportAnalyticsCsv(analytics) {
  const { trend, granularity, range, start, end, landscape: L, ecommerce: E, collected: C, owed: O, demand: D } = analytics;
  const money = (v) => Number(v).toFixed(2);  // plain numbers so spreadsheets can sum them
  const pct = (v) => (v === null || v === undefined ? '' : v);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range;
  const lines = [];
  const section = (title, header, rows) => {
    if (lines.length) lines.push([]);
    lines.push([title], header, ...rows);
  };

  lines.push(['Income analytics report'], ['Range', rangeLabel], ['From', start], ['To', end],
    ['Generated', new Date().toISOString().slice(0, 10)]);

  section('Summary', ['Metric', 'Landscape services', 'E-commerce'], [
    ['Earned income (PHP), counted in full on sign-off / payment', money(L.earned), money(E.earned)],
    ['Collected (PHP), money received net of refunds', money(C.landscape.amount), money(C.ecommerce.amount)],
    ['Collected change vs previous period (%)', pct(C.landscape.change_pct), pct(C.ecommerce.change_pct)],
    ['Change vs previous period (%)', pct(L.earned_change_pct), pct(E.earned_change_pct)],
    ['Completed projects / paid orders', L.earned_count, E.earned_count],
    ['Average value (PHP)', money(L.avg_value), money(E.avg_value)],
    ['Pending pipeline, open now (PHP)', money(L.pipeline), money(E.pipeline)],
    ['Open now, any date', L.pipeline_count, E.pipeline_count],
    ['Open and due in the range', L.open_due_count, E.open_due_count],
    ['Cancelled', L.cancelled_count, E.cancelled_count],
    ['Completion rate (%): done / (done + cancelled + open and due)', pct(L.completion_rate), pct(E.completion_rate)],
    ['Unpriced bookings (counted as 0)', L.unpriced_count, ''],
    ['Owed on finished jobs, now (PHP)', money(O.finished), ''],
    ['Unpaid on open projects, not due yet (PHP)', money(O.open), ''],
  ]);

  const sum = (key) => trend.reduce((acc, d) => acc + d[key], 0);
  section('Income comparison',
    ['Period', 'Days from', 'Days to', 'Partial period', 'Earned: landscape (PHP)', 'Earned: e-commerce (PHP)', 'Earned: total (PHP)',
      'Collected: landscape (PHP)', 'Collected: e-commerce (PHP)', 'Collected: total (PHP)'], [
      ...trend.map((d) => [
        periodLabel(d.period, granularity, true), d.from, d.to, d.partial ? 'yes' : 'no',
        money(d.landscape), money(d.ecommerce), money(d.landscape + d.ecommerce),
        money(d.landscape_collected), money(d.ecommerce_collected), money(d.landscape_collected + d.ecommerce_collected),
      ]),
      ['Total', '', '', '', money(sum('landscape')), money(sum('ecommerce')), money(sum('landscape') + sum('ecommerce')),
        money(sum('landscape_collected')), money(sum('ecommerce_collected')), money(sum('landscape_collected') + sum('ecommerce_collected'))],
    ]);

  section('Demand (by the day each request or order was made)', ['Period', 'Booking requests', 'Shop orders (not cancelled)'], [
    ...trend.map((d) => [periodLabel(d.period, granularity, true), d.requests, d.orders]),
    ['Total', D.requests, D.orders],
  ]);
  section('Booking requests made in the range: status today', ['Outcome', 'Requests', 'Share (%)'], [
    ['Confirmed', D.confirmed, pct(D.confirmed_pct)],
    ['Still waiting', D.waiting, pct(D.waiting_pct)],
    ['Cancelled', D.cancelled, pct(D.cancelled_pct)],
  ]);

  section('Landscape income by service (completed projects)', ['Service', 'Income (PHP)', 'Projects'],
    analytics.landscape_by_service.map((r) => [r.label, money(r.value), r.count]));
  section('Shop sales by category (item sales, excl. shipping)', ['Category', 'Sales (PHP)'],
    analytics.ecommerce_by_category.map((r) => [r.label, money(r.value)]));
  section('Top-selling products (item sales, excl. shipping)', ['Product', 'Sales (PHP)', 'Units sold'],
    analytics.top_products.map((r) => [r.label, money(r.value), r.count]));
  section('Shop payment methods (earned income)', ['Payment method', 'Income (PHP)', 'Orders'],
    analytics.payment_methods.map((r) => [r.label, money(r.value), r.count]));
  section('Customer satisfaction (all time)', ['Service', 'Average rating (1-5)', 'Reviews'], [
    ['Landscape services', analytics.satisfaction.landscape.avg ?? '', analytics.satisfaction.landscape.count],
    ['E-commerce', analytics.satisfaction.ecommerce.avg ?? '', analytics.satisfaction.ecommerce.count],
  ]);

  const csv = lines.map((r) => r.map(csvCell).join(',')).join('\r\n');
  // BOM so Excel opens the file as UTF-8
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `income-analytics_${range}_${start}_to_${end}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function TrendTable({ data, granularity, series = INCOME_SERIES, fmt = peso, total = true }) {
  const [a, b] = series;
  return (
    <div className="ia-table-wrap">
      <table className="ia-table">
        <thead>
          <tr><th>Period</th><th>{a.label}</th><th>{b.label}</th>{total && <th>Total</th>}</tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.period}>
              <td>{periodLabel(d.period, granularity, true)}{d.partial && <span className="ia-muted"> ({partialNote(d)})</span>}</td>
              <td>{fmt(d[a.key])}</td>
              <td>{fmt(d[b.key])}</td>
              {total && <td><strong>{fmt(d[a.key] + d[b.key])}</strong></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Horizontal ranked bars (single series → single color) ─────────── */
function RankedBars({ rows, series, countLabel, tooltip, empty }) {
  if (!rows.length) return <p className="ia-empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div className="ia-ranked">
      {rows.map((r) => {
        const tip = (
          <TooltipRows title={r.label} rows={[
            { label: series.label, value: peso(r.value), color: series.color },
            ...(r.count !== undefined ? [{ label: countLabel, value: r.count }] : []),
          ]} />
        );
        return (
          <div key={r.label} className="ia-ranked-row" tabIndex={0}
            onPointerMove={(e) => tooltip.show(e, tip)} onFocus={(e) => tooltip.show(e, tip)}
            onPointerLeave={tooltip.hide} onBlur={tooltip.hide}>
            <span className="ia-ranked-label" title={r.label}>{r.label}</span>
            <span className="ia-ranked-track">
              <span className="ia-ranked-bar" style={{ width: `${(r.value / max) * 100}%`, background: series.color }} />
              <span className="ia-ranked-value">{pesoCompact(r.value)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Fulfilment + satisfaction per service ─────────────────────────── */
function ServiceHealth({ series, stats, rating, doneLabel, openLabel }) {
  const rate = stats.completion_rate;
  return (
    <div className="ia-health">
      <div className="ia-health-head">
        <span className="ia-swatch" style={{ background: series.color }} />
        <strong>{series.label}</strong>
      </div>
      <div className="ia-health-metric">
        <span className="ia-muted">Completion rate</span>
        <strong>{rate === null ? '—' : `${rate}%`}</strong>
      </div>
      <div className="ia-meter" style={{ background: series.track }}
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate ?? 0}
        aria-label={`${series.label} completion rate`}>
        <div style={{ width: `${rate ?? 0}%`, background: series.color }} />
      </div>
      {/* The three counts the rate is made of (they add up to its denominator) */}
      <div className="ia-health-counts">
        <span><strong>{stats.earned_count}</strong> {doneLabel}</span>
        <span><strong>{stats.open_due_count}</strong> {openLabel}</span>
        <span><strong>{stats.cancelled_count}</strong> cancelled</span>
      </div>
      <div className="ia-health-metric ia-health-rating">
        <span className="ia-muted">Customer rating</span>
        {rating.avg ? (
          <span className="ia-stars" aria-label={`${rating.avg} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={14} fill={n <= Math.round(rating.avg) ? '#eda100' : 'none'}
                color={n <= Math.round(rating.avg) ? '#eda100' : '#c3c2b7'} />
            ))}
            <strong>{rating.avg.toFixed(1)}</strong>
            <span className="ia-muted">({rating.count})</span>
          </span>
        ) : <span className="ia-muted">No reviews yet</span>}
      </div>
    </div>
  );
}

/* ── Earned vs collected: the same chart, two measures ──────────────── */
const MEASURES = {
  earned: {
    label: 'Earned', series: INCOME_SERIES, share: 'Share of earned income',
    chartLabel: 'Earned income per period by service',
    note: 'Earned counts a project in full on the day it is signed off and a shop order when it is paid or delivered, whether or not the money is in yet.',
  },
  collected: {
    label: 'Collected',
    series: [{ ...SERIES.landscape, key: 'landscape_collected' }, { ...SERIES.ecommerce, key: 'ecommerce_collected' }],
    share: 'Share of money collected', chartLabel: 'Money collected per period by service',
    note: 'Collected is money actually received, net of refunds: project payments, shop orders paid online and cash on delivery. Same figures as Reports → Money in.',
  },
};

/* ── Demand: requests and orders by the day they were made ─────────── */
// Requests are landscape demand (blue), orders are shop demand (orange): identity follows the stream
const DEMAND_SERIES = [
  { ...SERIES.landscape, key: 'requests', label: 'Booking requests' },
  { ...SERIES.ecommerce, key: 'orders', label: 'Shop orders' },
];
// What became of the requests: one hue, ordinal (validated --ordinal), cancelled in neutral gray
const OUTCOMES = [
  { key: 'confirmed', label: 'Confirmed', color: '#1c5cab' },
  { key: 'waiting', label: 'Still waiting', color: '#86b6ef' },
  { key: 'cancelled', label: 'Cancelled', color: '#898781' },
];
const count = (v) => Number(v || 0).toLocaleString('en-PH');

function OutcomeBar({ demand, tooltip }) {
  const parts = OUTCOMES.map((o) => ({ ...o, value: demand[o.key], pct: demand[`${o.key}_pct`] }));
  const tip = (p) => <TooltipRows title="Booking requests made in this range"
    rows={[{ label: p.label, value: `${count(p.value)} · ${p.pct ?? 0}%`, color: p.color }]} />;
  return (
    <div>
      <div className="ia-share" role="img"
        aria-label={parts.map((p) => `${p.label} ${p.value} (${p.pct ?? 0}%)`).join(', ')}>
        {!demand.requests ? <div className="ia-share-empty" /> : parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.key} className="ia-share-seg" tabIndex={0} style={{ flexGrow: p.value, background: p.color }}
            onPointerMove={(e) => tooltip.show(e, tip(p))} onFocus={(e) => tooltip.show(e, tip(p))}
            onPointerLeave={tooltip.hide} onBlur={tooltip.hide} />
        ))}
      </div>
      <div className="ia-legend ia-legend-share">
        {parts.map((p) => (
          <div key={p.key} className="ia-legend-item">
            <span className="ia-swatch" style={{ background: p.color }} />
            <span>{p.label}</span>
            <strong>{p.pct === null || p.pct === undefined ? '—' : `${p.pct}%`}</strong>
            <span className="ia-muted">{count(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemandCard({ data, compare, tooltip }) {
  const [showTable, setShowTable] = useState(false);
  const d = data.demand;
  return (
    <div className="ia-card ia-section">
      <div className="ia-section-head">
        <div>
          <h3>Demand</h3>
          <p className="ia-muted">New booking requests and shop orders, by the day they were made, per {data.granularity}. An early sign of the income to come.</p>
        </div>
        <div className="ia-actions">
          <button className="ia-ghost-btn" onClick={() => setShowTable((v) => !v)}>
            {showTable ? <><BarChart3 size={14} /> View chart</> : <><Table2 size={14} /> View table</>}
          </button>
        </div>
      </div>

      <div className="ia-tiles ia-tiles-compact">
        <StatTile label="Booking requests" swatch={SERIES.landscape.color} value={count(d.requests)}
          delta={d.requests_change_pct} compare={compare} />
        <StatTile label="Confirmed" value={d.confirmed_pct === null ? '—' : `${d.confirmed_pct}%`}
          sub={`${count(d.confirmed)} of ${count(d.requests)} requests`} />
        <StatTile label="Cancelled" value={d.cancelled_pct === null ? '—' : `${d.cancelled_pct}%`}
          sub={`${count(d.cancelled)} of ${count(d.requests)} requests`} />
        <StatTile label="Shop orders" swatch={SERIES.ecommerce.color} value={count(d.orders)}
          delta={d.orders_change_pct} compare={compare} sub="Not cancelled" />
      </div>

      <h4 className="ia-subhead">What became of the requests</h4>
      <OutcomeBar demand={d} tooltip={tooltip} />
      <p className="ia-muted ia-footnote">Each request&apos;s status today: recent ones may simply not be confirmed yet.</p>

      <div style={{ marginTop: 20 }}>
        {showTable
          ? <TrendTable data={data.trend} granularity={data.granularity} series={DEMAND_SERIES} fmt={count} total={false} />
          : <TrendChart data={data.trend} granularity={data.granularity} tooltip={tooltip} series={DEMAND_SERIES}
              fmt={count} fmtAxis={count} integer legend label="Booking requests and shop orders per period" />}
      </div>
    </div>
  );
}

/* ═══ Main component ═══════════════════════════════════════════════════ */
export default function IncomeAnalytics() {
  const { authTokens } = useAuth();
  const [range, setRange] = useState('12m');
  const [data, setData] = useState(null);
  const [loadedRange, setLoadedRange] = useState(null); // range the shown data/error is for
  const refetching = !!authTokens && loadedRange !== range;
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [measure, setMeasure] = useState('earned');
  const tooltip = useTooltip();

  useEffect(() => {
    if (!authTokens) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/analytics/income/?range=${range}`, {
      headers: { Authorization: `Bearer ${authTokens.access}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then((json) => { if (!cancelled) { setData(json); setError(''); } })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load analytics.'); })
      .finally(() => { if (!cancelled) setLoadedRange(range); });
    return () => { cancelled = true; };
  }, [authTokens, range]);

  const rangeMeta = RANGES.find((r) => r.key === range);

  return (
    <div className="ia-root">
      <style>{IA_STYLES}</style>

      {/* Filter row — scopes every number below it */}
      <div className="ia-filters">
        <div className="ia-segmented" role="tablist" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.key} role="tab" aria-selected={range === r.key}
              className={range === r.key ? 'ia-seg-active' : ''} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        {data && (
          <span className="ia-muted ia-range-note">
            {parseDay(data.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' – '}
            {parseDay(data.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>

      {error && !data && <p className="ia-error">{error}</p>}
      {!data && !error && <p className="ia-muted">Loading income analytics…</p>}

      {data && (
        <div style={{ opacity: refetching ? 0.55 : 1, transition: 'opacity .2s' }}>
          {error && <p className="ia-error">Showing previous data — {error}</p>}

          {/* KPI tiles */}
          <div className="ia-tiles">
            <StatTile hero label="Earned"
              value={peso(data.landscape.earned + data.ecommerce.earned)}
              sub={`${data.landscape.earned_count + data.ecommerce.earned_count} signed-off jobs & paid orders, counted in full whether paid or not`} />
            <StatTile hero label="Collected"
              value={peso(data.collected.total)} delta={data.collected.total_change_pct} compare={rangeMeta.compare}
              sub={`Money actually received, net of refunds · ${peso(data.collected.landscape.amount)} projects · ${peso(data.collected.ecommerce.amount)} shop`} />
            <StatTile label="Owed on finished jobs · now"
              value={peso(data.owed.finished)}
              sub={`${data.owed.finished_count} finished project${data.owed.finished_count === 1 ? '' : 's'} not fully paid · ${peso(data.owed.open)} more on ${data.owed.open_count} open projects, not due yet`}
              link={data.owed.finished_count ? { to: '/manage-projects?scope=finished&owing=1', label: 'See who owes →' } : null} />
            <StatTile label="Pending pipeline · now"
              value={peso(data.landscape.pipeline + data.ecommerce.pipeline)}
              sub={`${peso(data.landscape.pipeline)} in ${data.landscape.pipeline_count} open projects · ${peso(data.ecommerce.pipeline)} in ${data.ecommerce.pipeline_count} unpaid orders (any date; the range doesn't change it)`} />
            <StatTile label="Earned · Landscape services" swatch={SERIES.landscape.color}
              value={peso(data.landscape.earned)} delta={data.landscape.earned_change_pct}
              compare={rangeMeta.compare}
              sub={`${data.landscape.earned_count} completed · avg ${peso(data.landscape.avg_value)} per project`} />
            <StatTile label="Earned · E-commerce" swatch={SERIES.ecommerce.color}
              value={peso(data.ecommerce.earned)} delta={data.ecommerce.earned_change_pct}
              compare={rangeMeta.compare}
              sub={`${data.ecommerce.earned_count} paid orders · avg ${peso(data.ecommerce.avg_value)} per order`} />
          </div>

          {data.landscape.unpriced_count > 0 && (
            <div className="ia-notice">
              <AlertTriangle size={16} />
              <span>
                <strong>{data.landscape.unpriced_count} landscape booking{data.landscape.unpriced_count > 1 ? 's have' : ' has'} no price</strong>
                {' '}(no project tracker price and no linked design cost) and {data.landscape.unpriced_count > 1 ? 'are' : 'is'} counted as ₱0.
                Set a total price on the project tracker to include {data.landscape.unpriced_count > 1 ? 'them' : 'it'}.
              </span>
            </div>
          )}

          {data.landscape.finish_date_estimated_count > 0 && (
            <div className="ia-notice">
              <AlertTriangle size={16} />
              <span>
                <strong>{data.landscape.finish_date_estimated_count} finished project{data.landscape.finish_date_estimated_count > 1 ? 's are' : ' is'} dated by the scheduled start</strong>
                {' '}because {data.landscape.finish_date_estimated_count > 1 ? 'they were' : 'it was'} finished before sign-off dates were recorded.
                Projects signed off from now on count on the day they&apos;re signed off.
              </span>
            </div>
          )}

          {/* Share + trend */}
          <div className="ia-card ia-section">
            <div className="ia-section-head">
              <div>
                <h3>Income comparison</h3>
                <p className="ia-muted">{MEASURES[measure].label} {measure === 'earned' ? 'income' : 'money'} by service, per {data.granularity}</p>
              </div>
              <div className="ia-actions">
                <div className="ia-segmented ia-segmented-sm" role="tablist" aria-label="Measure">
                  {Object.entries(MEASURES).map(([k, mm]) => (
                    <button key={k} role="tab" aria-selected={measure === k}
                      className={measure === k ? 'ia-seg-active' : ''} onClick={() => setMeasure(k)}>{mm.label}</button>
                  ))}
                </div>
                <button className="ia-ghost-btn" onClick={() => setShowTable((v) => !v)}>
                  {showTable ? <><BarChart3 size={14} /> View chart</> : <><Table2 size={14} /> View table</>}
                </button>
                <button className="ia-ghost-btn" onClick={() => exportAnalyticsCsv(data)} disabled={refetching}
                  title="Download the summary, comparison table and breakdowns as CSV">
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            <p className="ia-muted ia-footnote ia-measure-note">{MEASURES[measure].note}</p>

            <ShareBar tooltip={tooltip} title={MEASURES[measure].share}
              landscape={measure === 'earned' ? data.landscape.earned : data.collected.landscape.amount}
              ecommerce={measure === 'earned' ? data.ecommerce.earned : data.collected.ecommerce.amount} />

            <div style={{ marginTop: 24 }}>
              {showTable
                ? <TrendTable data={data.trend} granularity={data.granularity} series={MEASURES[measure].series} />
                : <TrendChart data={data.trend} granularity={data.granularity} tooltip={tooltip}
                    series={MEASURES[measure].series} label={MEASURES[measure].chartLabel} />}
            </div>
          </div>

          <DemandCard data={data} compare={rangeMeta.compare} tooltip={tooltip} />

          {/* Breakdowns */}
          <div className="ia-grid-3">
            <div className="ia-card ia-section">
              <h3>Landscape income by service</h3>
              <p className="ia-muted">Completed projects</p>
              <RankedBars rows={data.landscape_by_service} series={SERIES.landscape}
                countLabel="projects" tooltip={tooltip} empty="No completed projects in this period." />
            </div>
            <div className="ia-card ia-section">
              <h3>Shop sales by category</h3>
              <p className="ia-muted">Item sales, excl. shipping</p>
              <RankedBars rows={data.ecommerce_by_category} series={SERIES.ecommerce}
                tooltip={tooltip} empty="No paid orders in this period." />
            </div>
            <div className="ia-card ia-section">
              <h3>Top-selling products</h3>
              <p className="ia-muted">Item sales, excl. shipping</p>
              <RankedBars rows={data.top_products} series={SERIES.ecommerce}
                countLabel="units sold" tooltip={tooltip} empty="No paid orders in this period." />
            </div>
          </div>

          <div className="ia-grid-2">
            <div className="ia-card ia-section">
              <h3>Fulfilment & satisfaction</h3>
              <p className="ia-muted">Of the work dated in this period up to today: how much is done. Work booked for later isn&apos;t due yet and isn&apos;t counted. Ratings are all-time.</p>
              <div className="ia-health-grid">
                <ServiceHealth series={SERIES.landscape} stats={data.landscape}
                  rating={data.satisfaction.landscape} doneLabel="completed" openLabel="still open" />
                <ServiceHealth series={SERIES.ecommerce} stats={data.ecommerce}
                  rating={data.satisfaction.ecommerce} doneLabel="paid" openLabel="still unpaid" />
              </div>
            </div>
            <div className="ia-card ia-section">
              <h3>Shop payment methods</h3>
              <p className="ia-muted">Earned e-commerce income by how customers paid</p>
              <RankedBars rows={data.payment_methods} series={SERIES.ecommerce}
                countLabel="orders" tooltip={tooltip} empty="No paid orders in this period." />
            </div>
          </div>
        </div>
      )}

      {tooltip.node}
    </div>
  );
}

const IA_STYLES = `
.ia-root {
  --ia-surface: #ffffff;
  --ia-text: #0b0b0b;
  --ia-text-2: #52514e;
  --ia-muted: #898781;
  --ia-grid: #e1e0d9;
  --ia-axis: #c3c2b7;
  --ia-hover: rgba(11,11,11,0.04);
  --ia-border: rgba(11,11,11,0.10);
  --ia-good: #006300;
  --ia-bad: #d03b3b;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--ia-text);
}
.ia-muted { color: var(--ia-muted); }
.ia-error { color: var(--ia-bad); font-weight: 600; }
.ia-card { background: var(--ia-surface); border: 1px solid var(--ia-border); border-radius: 12px; }
.ia-section { padding: 20px 22px; margin-bottom: 20px; min-width: 0; }
.ia-section h3 { margin: 0; font-size: 15px; font-weight: 700; }
.ia-section p { margin: 2px 0 16px; font-size: 13px; }
.ia-section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }

.ia-filters { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
.ia-segmented { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; flex-wrap: wrap; }
.ia-segmented button { border: none; background: transparent; padding: 7px 14px; border-radius: 8px;
  font-size: 13px; font-weight: 600; color: var(--ia-text-2); cursor: pointer; }
.ia-segmented button:hover { background: rgba(255,255,255,0.6); }
.ia-segmented .ia-seg-active { background: #fff; color: var(--ia-text); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.ia-range-note { font-size: 13px; }

.ia-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 20px; }
.ia-tile { padding: 18px 20px; }
.ia-tile-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ia-text-2); font-weight: 600; }
.ia-tile-value { font-size: 26px; font-weight: 650; margin: 6px 0 4px; letter-spacing: -0.01em; }
.ia-tile-hero .ia-tile-value { font-size: 34px; }
.ia-tile-sub { font-size: 12px; color: var(--ia-muted); line-height: 1.45; }
.ia-tile-link { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 700; color: #047857; text-decoration: none; }
.ia-tile-link:hover { text-decoration: underline; }
.ia-tiles-compact { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.ia-tiles-compact .ia-tile { padding: 12px 14px; border-color: var(--ia-grid); }
.ia-tiles-compact .ia-tile-value { font-size: 22px; }
.ia-subhead { margin: 4px 0 10px; font-size: 13px; font-weight: 700; color: var(--ia-text-2); }
.ia-section p.ia-footnote { margin: 8px 0 0; font-size: 12px; }
.ia-section p.ia-measure-note { margin: 0 0 14px; }
.ia-segmented-sm button { padding: 5px 12px; font-size: 12px; }
.ia-delta { display: flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.ia-delta .ia-muted { font-weight: 500; margin-left: 4px; }
.ia-up { color: var(--ia-good); }
.ia-down { color: var(--ia-bad); }
.ia-swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex-shrink: 0; }

.ia-notice { display: flex; gap: 10px; align-items: flex-start; background: #fffbeb; border: 1px solid #fde68a;
  color: #78350f; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; line-height: 1.5; }
.ia-notice svg { flex-shrink: 0; margin-top: 2px; color: #b45309; }

.ia-share { display: flex; gap: 2px; height: 16px; border-radius: 4px; overflow: hidden; }
.ia-share-seg { min-width: 4px; cursor: default; outline-offset: 2px; }
.ia-share-seg:hover, .ia-share-seg:focus-visible { filter: brightness(1.08); }
.ia-share-empty { flex: 1; background: var(--ia-grid); }
.ia-legend { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 12px; font-size: 13px; }
.ia-legend-item { display: flex; align-items: center; gap: 7px; color: var(--ia-text-2); }
.ia-legend-item strong { color: var(--ia-text); }

.ia-axis-text { font-size: 11px; fill: var(--ia-muted); font-variant-numeric: tabular-nums; }
.ia-ghost-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ia-border);
  background: #fff; color: var(--ia-text-2); font-size: 12px; font-weight: 600; padding: 6px 12px;
  border-radius: 8px; cursor: pointer; }
.ia-ghost-btn:hover { background: #f8fafc; color: var(--ia-text); }
.ia-ghost-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ia-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.ia-table-wrap { overflow-x: auto; }
.ia-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.ia-table th { text-align: left; color: var(--ia-text-2); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--ia-grid); }
.ia-table td { padding: 8px 10px; border-bottom: 1px solid var(--ia-grid); }
.ia-table th:not(:first-child), .ia-table td:not(:first-child) { text-align: right; }

.ia-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 20px; }
.ia-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 20px; }
.ia-grid-3 > .ia-section, .ia-grid-2 > .ia-section { margin-bottom: 0; }
.ia-grid-3 { margin-bottom: 20px; }

.ia-ranked { display: flex; flex-direction: column; gap: 4px; }
.ia-ranked-row { display: grid; grid-template-columns: minmax(80px, 38%) 1fr; align-items: center; gap: 10px;
  padding: 6px 4px; border-radius: 6px; font-size: 13px; outline-offset: 1px; }
.ia-ranked-row:hover, .ia-ranked-row:focus-visible { background: var(--ia-hover); }
.ia-ranked-label { color: var(--ia-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ia-ranked-track { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ia-ranked-bar { height: 12px; border-radius: 0 4px 4px 0; min-width: 2px; flex-shrink: 1; max-width: calc(100% - 56px); }
.ia-ranked-value { font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ia-empty { color: var(--ia-muted); font-size: 13px; margin: 8px 0 0 !important; }

.ia-health-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; }
.ia-health { border: 1px solid var(--ia-grid); border-radius: 10px; padding: 14px 16px; }
.ia-health-head { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 12px; }
.ia-health-metric { display: flex; justify-content: space-between; align-items: center; font-size: 13px; gap: 8px; }
.ia-health-metric strong { font-size: 18px; }
.ia-meter { height: 8px; border-radius: 4px; margin: 8px 0 10px; overflow: hidden; }
.ia-meter > div { height: 100%; border-radius: 4px; }
.ia-health-counts { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--ia-text-2); margin-bottom: 12px; }
.ia-health-rating { border-top: 1px solid var(--ia-grid); padding-top: 10px; flex-wrap: wrap; }
.ia-health-rating > .ia-muted { white-space: nowrap; }
.ia-stars { display: inline-flex; align-items: center; gap: 2px; }
.ia-stars strong { font-size: 13px !important; margin-left: 4px; }

.ia-tooltip { position: fixed; z-index: 10000; pointer-events: none; background: #fff; border: 1px solid var(--ia-border);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12); border-radius: 8px; padding: 8px 12px; font-size: 12px; min-width: 160px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ia-text); }
.ia-tt-title { color: var(--ia-text-2); font-weight: 600; margin-bottom: 6px; }
.ia-tt-row { display: flex; align-items: center; gap: 8px; line-height: 1.7; }
.ia-tt-row strong { font-variant-numeric: tabular-nums; }
.ia-tt-key { width: 12px; height: 2px; border-radius: 1px; flex-shrink: 0; }
.ia-tt-label { color: var(--ia-text-2); }
`;
