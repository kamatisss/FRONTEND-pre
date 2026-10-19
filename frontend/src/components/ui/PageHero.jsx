import { color, font, heroGradient, heroShadow, radius } from './tokens';

/*
 * The page header banner used across the customer side (same as the Dashboard's
 * welcome banner): emerald gradient, white text. `decoration` renders behind the
 * content (e.g. a faint illustration); `children` go below the title.
 */
export default function PageHero({ icon, eyebrow, title, subtitle, decoration, children, style }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', background: heroGradient, borderRadius: radius.hero,
      padding: '36px', color: color.white, boxShadow: heroShadow, fontFamily: font, ...style,
    }}>
      {decoration && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{decoration}</div>}
      <div style={{ position: 'relative' }}>
        {eyebrow && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px',
            background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)',
            fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px',
          }}>
            {eyebrow}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {icon && (
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {icon}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{title}</h1>
            {subtitle && <p style={{ margin: '4px 0 0', opacity: 0.88, fontSize: '14px', lineHeight: 1.5, maxWidth: 640 }}>{subtitle}</p>}
          </div>
        </div>
        {children && <div style={{ marginTop: '24px' }}>{children}</div>}
      </div>
    </div>
  );
}
