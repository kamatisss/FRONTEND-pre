import { useState } from 'react';
import { color, font, radius } from './tokens';

/*
 * Shared button. primary = solid emerald (the Dashboard's "Start 3D Design"),
 * secondary = white outlined, ghost = text-only emerald.
 */
const VARIANTS = {
  primary: {
    base: { background: color.brand, color: color.white, border: 'none', boxShadow: '0 4px 14px rgba(16,185,129,0.2)' },
    hover: { background: color.brandDark },
  },
  secondary: {
    base: { background: color.white, color: color.text, border: `1px solid ${color.border}` },
    hover: { borderColor: color.brand, color: color.brandDark },
  },
  ghost: {
    base: { background: 'transparent', color: color.brandDark, border: 'none' },
    hover: { background: color.brandSurface },
  },
};

const SIZES = {
  sm: { padding: '7px 14px', fontSize: '13px' },
  md: { padding: '10px 20px', fontSize: '14px' },
  lg: { padding: '14px 24px', fontSize: '15px' },
};

export default function Button({ variant = 'primary', size = 'md', block = false, style, disabled, children, ...props }) {
  const [hover, setHover] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: block ? '100%' : undefined, borderRadius: radius.button, fontFamily: font, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        ...SIZES[size], ...v.base, ...(hover && !disabled ? v.hover : null), ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
