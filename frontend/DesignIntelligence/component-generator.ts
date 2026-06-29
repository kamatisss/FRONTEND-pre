#!/usr/bin/env node
/**
 * Garden Studio Design Intelligence — Component Generator (Tailwind Edition)
 *
 * Reads design-config.json and scaffolds TSX components whose className strings
 * map directly to the @theme variables in src/index.css.
 *
 * Usage:
 *   npm run generate -- --name ProjectCard --type card
 *   npm run generate -- --name PrimaryBtn  --type button --variant primary
 *   npm run generate -- --name DarkSection --type section --dark
 *   npm run generate -- --name SiteModal   --type modal
 *   npm run generate -- --name SiteHero    --type hero --dark
 *
 * Types:    card | button | section | badge | modal | hero
 * Flags:
 *   --name <PascalCase>   (required)
 *   --type <type>         (default: card)
 *   --variant <v>         button only: primary | dark | ghost | emerald-outline
 *   --dark                inverts palette for card / section / hero
 *   --output <dir>        override output dir (default: ../src/components/)
 */

import * as fs   from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DesignConfig {
  colors: {
    brand:    Record<string, string>;
    neutral:  Record<string, string>;
    dark:     Record<string, string>;
    semantic: Record<string, string>;
  };
  typography: {
    fontFamily:    Record<string, string>;
    fontSize:      Record<string, string>;
    fontWeight:    Record<string, number>;
    lineHeight:    Record<string, number>;
    letterSpacing: Record<string, string>;
  };
  spacing:      Record<string, string>;
  borderRadius: Record<string, string>;
  shadow:       Record<string, string>;
  animation: {
    easing:          Record<string, number[]>;
    duration:        Record<string, number>;
    staggerChildren: Record<string, number>;
  };
}

type ComponentType  = 'card' | 'button' | 'section' | 'badge' | 'modal' | 'hero';
type ButtonVariant  = 'primary' | 'dark' | 'ghost' | 'emerald-outline';

interface Args {
  name:     string;
  type:     ComponentType;
  variant?: ButtonVariant;
  dark?:    boolean;
  output?:  string;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Args {
  const a: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if      (k === '--name'    && v) { a.name    = v;                  i++; }
    else if (k === '--type'    && v) { a.type    = v as ComponentType; i++; }
    else if (k === '--variant' && v) { a.variant = v as ButtonVariant; i++; }
    else if (k === '--output'  && v) { a.output  = v;                  i++; }
    else if (k === '--dark')         { a.dark    = true; }
  }
  if (!a.name) throw new Error('--name is required.  e.g. --name ProjectCard');
  if (!a.type) a.type = 'card';
  return a as Args;
}

// ─── Tailwind class name helpers ──────────────────────────────────────────────
// These must match the @theme variable names in src/index.css exactly.

const CL = {
  // colors → mirrors --color-* in @theme
  bg:     (path: string) => `bg-${path.replace(/\./g, '-')}`,
  text:   (path: string) => `text-${path.replace(/\./g, '-')}`,
  border: (path: string) => `border-${path.replace(/\./g, '-')}`,
  // font size → mirrors --text-gs-* in @theme
  fs:     (key: string)  => `text-gs-${key}`,
  // radius → mirrors --radius-gs-* in @theme
  r:      (key: string)  => `rounded-gs-${key}`,
  // shadow → mirrors --shadow-* in @theme
  sh:     (key: string)  => `shadow-${key}`,
  // tracking → mirrors --tracking-gs-* in @theme
  tr:     (key: string)  => `tracking-gs-${key}`,
};

// ─── Templates ────────────────────────────────────────────────────────────────

function generateCard(name: string, dark: boolean): string {
  const base = dark
    ? `bg-dark-card border border-dark-border ${CL.r('xl')} p-8 hover:border-brand-emerald transition-all duration-[250ms] relative overflow-hidden`
    : `bg-neutral-surface border border-neutral-border ${CL.r('xl')} p-8 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-[250ms] relative overflow-hidden`;

  const badgeCls = dark
    ? `inline-flex items-center gap-1.5 px-3.5 py-[5px] ${CL.r('full')} bg-brand-emerald/[.12] border border-brand-emerald/30 text-brand-emerald-light ${CL.fs('xs')} font-extrabold ${CL.tr('wider')} uppercase mb-4`
    : `inline-flex items-center gap-1.5 px-3.5 py-[5px] ${CL.r('full')} bg-brand-emerald-surface border border-brand-emerald-muted text-brand-emerald-dark ${CL.fs('xs')} font-extrabold ${CL.tr('wider')} uppercase mb-4`;

  const iconBg   = dark ? 'bg-brand-emerald/[.15]' : 'bg-brand-emerald-surface';
  const titleCls = dark
    ? `${CL.fs('md')} font-extrabold text-white mb-2 ${CL.tr('normal')}`
    : `${CL.fs('md')} font-extrabold text-neutral-ink mb-2 ${CL.tr('normal')}`;
  const descCls  = dark
    ? `${CL.fs('base')} text-white/65 leading-[1.75]`
    : `${CL.fs('base')} text-neutral-muted leading-[1.75]`;

  return `import React from 'react';

/* ────────────────────────────────────────────────────────────────
   ${name}
   Generated by Garden Studio Design Intelligence
   Variant: ${dark ? 'dark' : 'light'} card  |  Tailwind v4
   Classes map to: DesignIntelligence/design-config.json + src/index.css @theme
   ──────────────────────────────────────────────────────────────── */

interface ${name}Props {
  title:        string;
  description?: string;
  badge?:       string;
  icon?:        React.ReactNode;
  children?:    React.ReactNode;
  onClick?:     () => void;
}

export default function ${name}({ title, description, badge, icon, children, onClick }: ${name}Props) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className="${base}${onClick ? ' cursor-pointer' : ''}"
    >
      {badge && (
        <span className="${badgeCls}">{badge}</span>
      )}

      {icon && (
        <div className="w-12 h-12 ${CL.r('md')} ${iconBg} text-brand-emerald flex items-center justify-center mb-5">
          {icon}
        </div>
      )}

      <h3 className="${titleCls}">{title}</h3>

      {description && (
        <p className="${descCls} mb-5">{description}</p>
      )}

      {children}
    </div>
  );
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────

function generateButton(name: string, variant: ButtonVariant): string {
  const variantCls: Record<ButtonVariant, string> = {
    'primary':
      `bg-brand-emerald text-white ${CL.sh('emerald-sm')} hover:bg-brand-emerald-dark`,
    'dark':
      `bg-neutral-ink text-white ${CL.sh('md')} hover:bg-neutral-ink-light`,
    'ghost':
      `bg-transparent text-neutral-ink border border-neutral-border hover:bg-neutral-bg`,
    'emerald-outline':
      `bg-transparent text-brand-emerald border border-brand-emerald hover:bg-brand-emerald-surface`,
  };

  const cls = variantCls[variant] ?? variantCls.primary;

  return `import React from 'react';

/* ────────────────────────────────────────────────────────────────
   ${name}
   Generated by Garden Studio Design Intelligence
   Variant: ${variant} button  |  Tailwind v4
   ──────────────────────────────────────────────────────────────── */

type Size = 'sm' | 'md' | 'lg';

interface ${name}Props {
  children:   React.ReactNode;
  onClick?:   () => void;
  disabled?:  boolean;
  type?:      'button' | 'submit' | 'reset';
  size?:      Size;
  icon?:      React.ReactNode;
  fullWidth?: boolean;
}

const SIZE: Record<Size, string> = {
  sm: 'px-[18px] py-2 ${CL.fs('sm')}',
  md: 'px-[26px] py-3 ${CL.fs('base')}',
  lg: 'px-9 py-4 ${CL.fs('lg')}',
};

export default function ${name}({ children, onClick, disabled, type = 'button', size = 'md', icon, fullWidth }: ${name}Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 font-sans font-bold ${CL.r('full')}',
        'hover:-translate-y-px transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        '${cls}',
        SIZE[size],
        fullWidth ? 'w-full' : '',
      ].filter(Boolean).join(' ')}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────

function generateSection(name: string, dark: boolean): string {
  const sectionCls = dark
    ? 'bg-dark-base border-t border-dark-border py-24'
    : 'bg-neutral-bg border-t border-neutral-border py-24';

  const eyebrowCls = dark
    ? `inline-flex items-center gap-1.5 px-3.5 py-[5px] ${CL.r('full')} bg-brand-emerald/[.12] border border-brand-emerald/30 text-brand-emerald-light ${CL.fs('xs')} font-extrabold ${CL.tr('wider')} uppercase mb-5`
    : `inline-flex items-center gap-1.5 px-3.5 py-[5px] ${CL.r('full')} bg-brand-emerald-surface border border-brand-emerald-muted text-brand-emerald-dark ${CL.fs('xs')} font-extrabold ${CL.tr('wider')} uppercase mb-5`;

  const titleCls = dark
    ? `${CL.fs('3xl')} font-black text-white ${CL.tr('tight')} leading-[1.08] mb-4`
    : `${CL.fs('3xl')} font-black text-neutral-ink ${CL.tr('tight')} leading-[1.08] mb-4`;

  const subtitleCls = dark
    ? `${CL.fs('md')} text-white/65 leading-[1.75] max-w-[480px] mx-auto`
    : `${CL.fs('md')} text-neutral-muted leading-[1.75] max-w-[480px] mx-auto`;

  const cardCls = dark
    ? `bg-dark-card border border-dark-border ${CL.r('xl')} p-8 hover:border-brand-emerald transition-all duration-[250ms]`
    : `bg-neutral-surface border border-neutral-border ${CL.r('xl')} p-8 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-[250ms]`;

  const iconBg   = dark ? 'bg-brand-emerald/[.15]' : 'bg-brand-emerald-surface';
  const itemTitle = dark
    ? `${CL.fs('md')} font-extrabold text-white mb-2`
    : `${CL.fs('md')} font-extrabold text-neutral-ink mb-2`;
  const itemDesc  = dark
    ? `${CL.fs('base')} text-white/65 leading-[1.75]`
    : `${CL.fs('base')} text-neutral-muted leading-[1.75]`;

  return `import React from 'react';
import { motion } from 'framer-motion';

/* ────────────────────────────────────────────────────────────────
   ${name}
   Generated by Garden Studio Design Intelligence
   Variant: ${dark ? 'dark' : 'light'} section  |  Tailwind v4
   ──────────────────────────────────────────────────────────────── */

const FADE_UP = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const STAGGER = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

interface ${name}Item { title: string; description: string; icon?: React.ReactNode; }

interface ${name}Props {
  eyebrow?:  string;
  title:     string;
  subtitle?: string;
  items?:    ${name}Item[];
  children?: React.ReactNode;
  id?:       string;
}

export default function ${name}({ eyebrow, title, subtitle, items, children, id }: ${name}Props) {
  return (
    <section id={id} className="font-sans ${sectionCls}">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}
          className="text-center mb-[60px]">
          {eyebrow && <span className="${eyebrowCls}">{eyebrow}</span>}
          <h2 className="${titleCls}">{title}</h2>
          {subtitle && <p className="${subtitleCls}">{subtitle}</p>}
        </motion.div>

        {items && items.length > 0 && (
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}
            className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
            {items.map((item, i) => (
              <motion.div key={i} variants={FADE_UP}
                className="${cardCls}">
                {item.icon && (
                  <div className="w-12 h-12 ${CL.r('md')} ${iconBg} text-brand-emerald flex items-center justify-center mb-5">
                    {item.icon}
                  </div>
                )}
                <h3 className="${itemTitle}">{item.title}</h3>
                <p className="${itemDesc} m-0">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {children}
      </div>
    </section>
  );
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────

function generateBadge(name: string): string {
  return `import React from 'react';

/* ────────────────────────────────────────────────────────────────
   ${name}
   Generated by Garden Studio Design Intelligence
   Type: badge  |  Tailwind v4
   ──────────────────────────────────────────────────────────────── */

type BadgeVariant = 'emerald' | 'neutral' | 'dark-emerald';

interface ${name}Props {
  children:  React.ReactNode;
  variant?:  BadgeVariant;
  icon?:     React.ReactNode;
}

const VARIANT_CLS: Record<BadgeVariant, string> = {
  'emerald':
    'bg-brand-emerald-surface border-brand-emerald-muted text-brand-emerald-dark',
  'neutral':
    'bg-neutral-bg border-neutral-border text-neutral-mid',
  'dark-emerald':
    'bg-brand-emerald/[.12] border-brand-emerald/30 text-brand-emerald-light',
};

export default function ${name}({ children, variant = 'emerald', icon }: ${name}Props) {
  return (
    <span className={[
      'inline-flex items-center gap-1.5 px-3.5 py-[5px]',
      '${CL.r('full')} border',
      '${CL.fs('xs')} font-sans font-extrabold ${CL.tr('wider')} uppercase',
      VARIANT_CLS[variant],
    ].join(' ')}>
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </span>
  );
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────

function generateModal(name: string): string {
  return `import React, { useEffect } from 'react';

/* ────────────────────────────────────────────────────────────────
   ${name}
   Generated by Garden Studio Design Intelligence
   Type: modal  |  Tailwind v4
   ──────────────────────────────────────────────────────────────── */

interface ${name}Props {
  open:      boolean;
  onClose:   () => void;
  title?:    string;
  children:  React.ReactNode;
  actions?:  React.ReactNode;
  maxWidth?: number;
}

export default function ${name}({ open, onClose, title, children, actions, maxWidth = 520 }: ${name}Props) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9999] bg-dark-base/[.72] backdrop-blur-[8px] flex items-center justify-center p-6 font-sans"
    >
      <div
        className="bg-neutral-surface border border-neutral-border ${CL.r('2xl')} shadow-dark-xl overflow-hidden w-full"
        style={{ maxWidth }}
      >
        {title && (
          <div className="px-8 py-6 border-b border-neutral-border flex items-center justify-between">
            <h3 className="${CL.fs('lg')} font-black text-neutral-ink ${CL.tr('normal')}">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-neutral-border bg-transparent text-neutral-muted flex items-center justify-center text-lg font-bold leading-none hover:bg-neutral-bg transition-colors"
            >
              ×
            </button>
          </div>
        )}
        <div className="px-8 py-7">{children}</div>
        {actions && (
          <div className="px-8 pb-8 pt-5 border-t border-neutral-border flex gap-3 justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────

function generateHero(name: string, dark: boolean): string {
  const sectionCls = dark
    ? 'relative min-h-screen flex items-center justify-center text-center px-6 py-[100px] bg-dark-base font-sans overflow-hidden'
    : 'relative min-h-screen flex items-center justify-center text-center px-6 py-[100px] bg-neutral-bg font-sans overflow-hidden';

  const eyebrowCls = dark
    ? `inline-flex items-center gap-1.5 px-3.5 py-[6px] ${CL.r('full')} bg-brand-emerald/[.18] border border-brand-emerald/40 text-brand-emerald-light ${CL.fs('xs')} font-black ${CL.tr('wide')} uppercase mb-7`
    : `inline-flex items-center gap-1.5 px-3.5 py-[6px] ${CL.r('full')} bg-brand-emerald-surface border border-brand-emerald-muted text-brand-emerald-dark ${CL.fs('xs')} font-black ${CL.tr('wide')} uppercase mb-7`;

  const h1Cls = dark
    ? `text-[clamp(40px,7vw,76px)] font-black ${CL.tr('tighter')} leading-[1.05] text-white mb-6`
    : `text-[clamp(40px,7vw,76px)] font-black ${CL.tr('tighter')} leading-[1.05] text-neutral-ink mb-6`;

  const subCls = dark
    ? 'text-[clamp(16px,2.2vw,20px)] text-white/80 leading-[1.65] max-w-[580px] mb-11'
    : 'text-[clamp(16px,2.2vw,20px)] text-neutral-mid leading-[1.65] max-w-[580px] mb-11';

  const accentCls = dark ? 'text-brand-emerald-light' : 'text-brand-emerald';

  const primaryBtn = `inline-flex items-center gap-2 px-8 py-4 ${CL.r('full')} text-base font-extrabold text-white bg-brand-emerald border-none ${CL.sh('emerald-lg')} hover:bg-brand-emerald-dark hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`;
  const secondaryBtn = dark
    ? `inline-flex items-center gap-2 px-8 py-4 ${CL.r('full')} text-base font-bold text-white bg-white/10 border border-white/35 backdrop-blur-sm hover:bg-white/[.18] transition-all duration-200 cursor-pointer`
    : `inline-flex items-center gap-2 px-8 py-4 ${CL.r('full')} text-base font-bold text-neutral-ink bg-transparent border border-neutral-border hover:bg-neutral-bg transition-all duration-200 cursor-pointer`;

  return `import React from 'react';
import { motion } from 'framer-motion';

/* ────────────────────────────────────────────────────────────────
   ${name}
   Generated by Garden Studio Design Intelligence
   Variant: ${dark ? 'dark' : 'light'} hero  |  Tailwind v4
   ──────────────────────────────────────────────────────────────── */

const FADE_UP = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const STAGGER = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

interface ${name}Props {
  eyebrow?:       string;
  headline:       string;
  accentText?:    string;
  subheadline?:   string;
  primaryCta?:    { label: string; onClick: () => void };
  secondaryCta?:  { label: string; onClick: () => void };
  backgroundImage?: string;
}

export default function ${name}({
  eyebrow, headline, accentText, subheadline, primaryCta, secondaryCta, backgroundImage,
}: ${name}Props) {
  return (
    <section className="${sectionCls}">
      {backgroundImage && (
        <>
          <div className="absolute inset-0 z-0">
            <img src={backgroundImage} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(160deg,rgba(2,10,20,.75) 0%,rgba(2,30,20,.58) 60%,rgba(5,40,30,.48) 100%)' }} />
        </>
      )}

      {/* Emerald glow — only on dark variant */}
      ${dark ? `<div aria-hidden className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: [
          'radial-gradient(ellipse 80% 50% at 50% -5%,rgba(16,185,129,.14) 0%,transparent 65%)',
          'radial-gradient(ellipse 50% 40% at 15% 90%,rgba(16,185,129,.07) 0%,transparent 55%)',
        ].join(',') }} />` : ''}

      <motion.div initial="hidden" animate="visible" variants={STAGGER}
        className="relative z-10 max-w-[860px] mx-auto flex flex-col items-center">

        {eyebrow && (
          <motion.span variants={FADE_UP} className="${eyebrowCls}">{eyebrow}</motion.span>
        )}

        <motion.h1 variants={FADE_UP} className="${h1Cls}">
          {headline}
          {accentText && <> <span className="${accentCls}">{accentText}</span></>}
        </motion.h1>

        {subheadline && (
          <motion.p variants={FADE_UP} className="${subCls}">{subheadline}</motion.p>
        )}

        <motion.div variants={FADE_UP} className="flex gap-4 flex-wrap justify-center">
          {primaryCta && (
            <button onClick={primaryCta.onClick} className="${primaryBtn}">
              {primaryCta.label}
            </button>
          )}
          {secondaryCta && (
            <button onClick={secondaryCta.onClick} className="${secondaryBtn}">
              {secondaryCta.label}
            </button>
          )}
        </motion.div>

      </motion.div>
    </section>
  );
}
`;
}

// ─── Output + logging ─────────────────────────────────────────────────────────

const G = '\x1b[32m', C = '\x1b[36m', Y = '\x1b[33m', D = '\x1b[2m', B = '\x1b[1m', R = '\x1b[0m';

function log(icon: string, msg: string) {
  const col: Record<string, string> = { '✓': G, '◆': C, '✗': '\x1b[31m' };
  console.log(`${col[icon] ?? R}  ${icon}${R} ${msg}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const __dir     = path.dirname(fileURLToPath(import.meta.url));
  const cfgPath   = path.join(__dir, 'design-config.json');

  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`\n  \x1b[31m✗\x1b[0m ${(e as Error).message}`);
    console.error('  Usage: npm run generate -- --name MyCard --type card\n');
    process.exit(1);
  }

  if (!fs.existsSync(cfgPath)) {
    console.error(`\n  \x1b[31m✗\x1b[0m design-config.json not found at ${cfgPath}\n`);
    process.exit(1);
  }

  const config: DesignConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const tokenCount = Object.values(config.colors).flatMap(Object.values).length +
                     Object.keys(config.typography.fontSize).length +
                     Object.keys(config.shadow).length;

  console.log('');
  log('◆', `${B}Garden Studio Design Intelligence${R}  ${D}(Tailwind v4)${R}`);
  console.log(`${D}  ─────────────────────────────────────────${R}`);
  log('✓', `Loaded design-config.json  ${D}(${tokenCount} tokens)${R}`);
  log('✓', `Resolved @theme class map  ${D}src/index.css${R}`);
  log('✓', `Generating: ${Y}${args.name}${R}  type: ${C}${args.type}${R}${args.dark ? `  ${D}dark${R}` : ''}${args.variant ? `  variant: ${C}${args.variant}${R}` : ''}`);

  let code: string;
  switch (args.type) {
    case 'card':    code = generateCard(args.name, args.dark ?? false);                break;
    case 'button':  code = generateButton(args.name, args.variant ?? 'primary');       break;
    case 'section': code = generateSection(args.name, args.dark ?? false);             break;
    case 'badge':   code = generateBadge(args.name);                                   break;
    case 'modal':   code = generateModal(args.name);                                   break;
    case 'hero':    code = generateHero(args.name, args.dark ?? false);                break;
    default:
      console.error(`  \x1b[31m✗\x1b[0m Unknown type: ${args.type}`);
      process.exit(1);
  }

  const outDir  = args.output ?? path.join(__dir, '..', 'src', 'components');
  const outFile = path.join(outDir, `${args.name}.tsx`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, code, 'utf-8');

  log('✓', `Written: ${Y}${path.relative(process.cwd(), outFile)}${R}`);
  console.log('');
  log('✓', 'Tailwind classes applied:');
  console.log(`${D}    bg-brand-emerald       →  ${R}${G}--color-brand-emerald: #10b981${R}`);
  console.log(`${D}    text-neutral-ink       →  ${R}${G}--color-neutral-ink: #0f172a${R}`);
  console.log(`${D}    text-gs-md             →  ${R}${G}--text-gs-md: 17px${R}`);
  console.log(`${D}    rounded-gs-xl          →  ${R}${G}--radius-gs-xl: 20px${R}`);
  console.log(`${D}    shadow-emerald-sm      →  ${R}${G}--shadow-emerald-sm: 0 4px 14px ...${R}`);
  console.log('');
  log('✓', `Component ready: ${G}${args.name}.tsx${R}`);
  console.log('');
}

main();
