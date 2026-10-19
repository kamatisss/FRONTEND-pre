import { labelStyle } from './tokens';

// Form/section label — same as Book a Service ("SERVICE TYPE").
export default function SectionLabel({ children, htmlFor, hint, style }) {
  return (
    <label htmlFor={htmlFor} style={{ ...labelStyle, ...style }}>
      {children}
      {hint && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#94a3b8' }}> {hint}</span>}
    </label>
  );
}
