/**
 * Garden Studio Design Intelligence — Theme Helper
 *
 * Provides type-safe token access and Tailwind class builders that
 * mirror the @theme variables defined in src/index.css.
 *
 * Class name rules (must match src/index.css @theme exactly):
 *   --color-brand-emerald   → bg-brand-emerald / text-brand-emerald / border-brand-emerald
 *   --text-gs-md            → text-gs-md
 *   --radius-gs-xl          → rounded-gs-xl
 *   --shadow-emerald-sm     → shadow-emerald-sm
 *   --tracking-gs-tight     → tracking-gs-tight
 *   --font-sans             → font-sans
 *   --animate-gs-blink      → animate-gs-blink
 *
 * Usage:
 *   import { token, tw, bg, text, border } from '../../DesignIntelligence/theme-helper';
 *
 *   const hex = token('colors.brand.emerald');              // '#10b981'
 *   const cls = tw(bg('brand.emerald'), 'rounded-gs-xl');  // 'bg-brand-emerald rounded-gs-xl'
 *   const ref = cssVar('colors.brand.emerald');             // 'var(--color-brand-emerald)'
 */

import designConfig from './design-config.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColorCategory  = keyof typeof designConfig.colors;
export type ShadowKey      = keyof typeof designConfig.shadow;
export type RadiusKey      = keyof typeof designConfig.borderRadius;
export type FontSizeKey    = keyof typeof designConfig.typography.fontSize;
export type FontWeightKey  = keyof typeof designConfig.typography.fontWeight;
export type LetterSpacingKey = keyof typeof designConfig.typography.letterSpacing;

// ─── Raw token access ──────────────────────────────────────────────────────────

/**
 * Retrieve any token value by dot-path.
 * @example token('colors.brand.emerald') → '#10b981'
 * @example token('shadow.emerald-sm')    → '0 4px 14px rgba(16,185,129,0.35)'
 */
export function token(dotPath: string): string {
  const parts = dotPath.split('.');
  let node: unknown = designConfig;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) {
      throw new Error(`[theme-helper] Token not found: "${dotPath}" (missing: "${part}")`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  return String(node);
}

// ─── @theme variable → Tailwind class name builders ───────────────────────────
// Each function produces the exact class name that Tailwind v4 generates from
// the corresponding --color-* / --text-* / --radius-* / etc. in @theme.

/** Convert a color dot-path to the Tailwind key segment.
 *  'colors.brand.emerald'  → 'brand-emerald'
 *  'brand.emerald'         → 'brand-emerald'
 *  'brand.emerald-dark'    → 'brand-emerald-dark'
 */
function colorKey(dotPath: string): string {
  const stripped = dotPath.startsWith('colors.') ? dotPath.slice(7) : dotPath;
  return stripped.replace(/\./g, '-');
}

/** Background color class.  bg('brand.emerald') → 'bg-brand-emerald' */
export function bg(colorPath: string): string {
  return `bg-${colorKey(colorPath)}`;
}

/** Text color class.  text('neutral.ink') → 'text-neutral-ink' */
export function text(colorPath: string): string {
  return `text-${colorKey(colorPath)}`;
}

/** Border color class.  border('dark.border') → 'border-dark-border' */
export function border(colorPath: string): string {
  return `border-${colorKey(colorPath)}`;
}

/** Ring color class.  ring('brand.emerald') → 'ring-brand-emerald' */
export function ring(colorPath: string): string {
  return `ring-${colorKey(colorPath)}`;
}

/** Font size class (gs- prefix).  fontSize('md') → 'text-gs-md' */
export function fontSize(key: FontSizeKey): string {
  return `text-gs-${key}`;
}

/** Border radius class (gs- prefix).  radius('xl') → 'rounded-gs-xl' */
export function radius(key: RadiusKey): string {
  return `rounded-gs-${key}`;
}

/** Shadow class.  shadow('emerald-sm') → 'shadow-emerald-sm' */
export function shadow(key: ShadowKey): string {
  return `shadow-${key}`;
}

/** Letter spacing class (gs- prefix).  tracking('tight') → 'tracking-gs-tight' */
export function tracking(key: LetterSpacingKey): string {
  return `tracking-gs-${key}`;
}

/** CSS custom property reference for inline style use.
 *  cssVar('colors.brand.emerald') → 'var(--color-brand-emerald)'
 */
export function cssVar(dotPath: string): string {
  const key  = colorKey(dotPath);
  return `var(--color-${key})`;
}

/** Raw CSS custom property name (no var() wrapper).
 *  cssVarName('colors.brand.emerald') → '--color-brand-emerald'
 */
export function cssVarName(dotPath: string): string {
  return `--color-${colorKey(dotPath)}`;
}

// ─── Class merging ─────────────────────────────────────────────────────────────

/** Merge Tailwind classes, filtering out falsy values. */
export function tw(...classes: Array<string | false | undefined | null>): string {
  return classes.filter(Boolean).join(' ') as string;
}

/** Conditional class: returns ifTrue when condition, else ifFalse (default ''). */
export function cx(condition: boolean, ifTrue: string, ifFalse = ''): string {
  return condition ? ifTrue : ifFalse;
}

// ─── Pre-built component class sets ───────────────────────────────────────────
// Ready-to-use className strings for common Garden Studio components.
// All classes resolve to the @theme variables in src/index.css.

export const components = {
  badge: {
    /** Light background — green badge with emerald-surface bg */
    emerald:
      'inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-full ' +
      'bg-brand-emerald-surface border border-brand-emerald-muted text-brand-emerald-dark ' +
      'text-gs-xs font-extrabold tracking-gs-wider uppercase',

    /** Dark background — translucent emerald badge */
    darkEmerald:
      'inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-full ' +
      'bg-brand-emerald/[.12] border border-brand-emerald/30 text-brand-emerald-light ' +
      'text-gs-xs font-extrabold tracking-gs-wider uppercase',

    neutral:
      'inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-full ' +
      'bg-neutral-bg border border-neutral-border text-neutral-mid ' +
      'text-gs-xs font-extrabold tracking-gs-wider uppercase',
  },

  button: {
    primary:
      'inline-flex items-center justify-center gap-2 rounded-full font-bold ' +
      'bg-brand-emerald text-white shadow-emerald-sm ' +
      'hover:bg-brand-emerald-dark hover:-translate-y-px ' +
      'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',

    dark:
      'inline-flex items-center justify-center gap-2 rounded-full font-bold ' +
      'bg-neutral-ink text-white shadow-md ' +
      'hover:bg-neutral-ink-light hover:-translate-y-px ' +
      'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',

    ghost:
      'inline-flex items-center justify-center gap-2 rounded-full font-bold ' +
      'bg-transparent text-neutral-ink border border-neutral-border ' +
      'hover:bg-neutral-bg hover:-translate-y-px ' +
      'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',

    emeraldOutline:
      'inline-flex items-center justify-center gap-2 rounded-full font-bold ' +
      'bg-transparent text-brand-emerald border border-brand-emerald ' +
      'hover:bg-brand-emerald-surface hover:-translate-y-px ' +
      'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',

    heroOutline:
      'inline-flex items-center justify-center gap-2 rounded-full font-bold text-white ' +
      'bg-white/10 border border-white/35 backdrop-blur-sm ' +
      'hover:bg-white/[.18] transition-all duration-200',
  },

  buttonSize: {
    sm: 'px-[18px] py-2 text-gs-sm',
    md: 'px-[26px] py-3 text-gs-base',
    lg: 'px-9 py-4 text-gs-lg',
  },

  card: {
    light:
      'bg-neutral-surface border border-neutral-border rounded-gs-xl p-8 ' +
      'shadow-md hover:shadow-lg hover:-translate-y-1 ' +
      'transition-all duration-[250ms] relative overflow-hidden',

    dark:
      'bg-dark-card border border-dark-border rounded-gs-xl p-8 ' +
      'hover:border-brand-emerald ' +
      'transition-all duration-[250ms] relative overflow-hidden',
  },

  section: {
    eyebrow:
      'inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-full mb-5 ' +
      'bg-brand-emerald-surface border border-brand-emerald-muted text-brand-emerald-dark ' +
      'text-gs-xs font-extrabold tracking-gs-wider uppercase',

    eyebrowDark:
      'inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-full mb-5 ' +
      'bg-brand-emerald/[.12] border border-brand-emerald/30 text-brand-emerald-light ' +
      'text-gs-xs font-extrabold tracking-gs-wider uppercase',

    title:
      'text-gs-3xl font-black text-neutral-ink tracking-gs-tight leading-[1.08] mb-4',

    titleDark:
      'text-gs-3xl font-black text-white tracking-gs-tight leading-[1.08] mb-4',

    subtitle:
      'text-gs-md text-neutral-muted leading-[1.75] max-w-[480px] mx-auto',

    subtitleDark:
      'text-gs-md text-white/65 leading-[1.75] max-w-[480px] mx-auto',
  },

  input:
    'w-full px-4 py-3 rounded-gs-md font-sans ' +
    'bg-neutral-bg border border-neutral-border text-neutral-ink text-gs-base ' +
    'placeholder:text-neutral-subtle ' +
    'focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/40 ' +
    'transition-colors duration-200',

  label: 'text-gs-sm font-semibold text-neutral-mid mb-1.5 block',

  modal: {
    backdrop:
      'fixed inset-0 z-[9999] bg-dark-base/[.72] backdrop-blur-[8px] ' +
      'flex items-center justify-center p-6',
    panel:
      'bg-neutral-surface border border-neutral-border rounded-gs-2xl shadow-dark-xl ' +
      'overflow-hidden w-full',
    header:
      'px-8 py-6 border-b border-neutral-border flex items-center justify-between',
    title:
      'text-gs-lg font-black text-neutral-ink tracking-gs-normal',
    body:   'px-8 py-7',
    footer: 'px-8 pb-8 pt-5 border-t border-neutral-border flex gap-3 justify-end',
  },
} as const;

// ─── Re-exports for quick access ───────────────────────────────────────────────

export const colors     = designConfig.colors;
export const typography = designConfig.typography;
export const spacing    = designConfig.spacing;
export const shadows    = designConfig.shadow;
export const radii      = designConfig.borderRadius;
export const config     = designConfig;
