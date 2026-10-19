// Shared UI tokens for inline-styled screens. Mirrors the design system in index.css
// (@theme, from DesignIntelligence/design-config.json). Reference screens: the customer
// Dashboard welcome banner and the Book a Service form.

export const color = {
  brand: '#10b981',
  brandDark: '#059669',
  brandDeep: '#047857',
  brandSurface: '#ecfdf5',
  brandBorder: '#a7f3d0',
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  subtle: '#94a3b8',
  border: '#e2e8f0',
  divider: '#f1f5f9',
  bg: '#f8fafc',
  white: '#ffffff',
  warning: '#d97706',
  danger: '#dc2626',
};

export const font = "'Inter', system-ui, -apple-system, sans-serif";

export const heroGradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
export const heroShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.15)';

export const radius = { hero: 20, card: 16, control: 10, button: 8 };

// Form controls — same as Book a Service
export const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: color.text,
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

export const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: `${radius.control}px`,
  border: `1px solid ${color.border}`,
  background: color.bg,
  color: color.text,
  fontSize: '0.95rem',
  fontWeight: 500,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

export const cardStyle = {
  background: color.white,
  border: `1px solid ${color.border}`,
  borderRadius: `${radius.card}px`,
};
