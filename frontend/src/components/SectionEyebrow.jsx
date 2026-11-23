import { motion, useReducedMotion } from 'framer-motion';

/*
 * The small label above each landing-page section heading ("How it works", "Instant estimate"…).
 * One component so every section reads the same: a lucide icon in a soft chip, then the label.
 * Icons only, never emoji. It used to be a bordered green pill on every section, which repeated
 * the hero badge eight times and competed with the headings; this is quieter on purpose.
 *
 * Interactive, not busy: when the section scrolls into view the chip pops in and the icon
 * turns once; hovering the label nudges the icon. Both stay still for reduced motion.
 *
 *   <SectionEyebrow icon={Calculator} label="Instant estimate" />
 *   <SectionEyebrow icon={Leaf} label="Get started today" center />
 */
export default function SectionEyebrow({ icon: Icon, label, center = false, style }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={`gs-eyebrow${center ? ' gs-eyebrow-center' : ''}`}
      style={style}
      initial={still ? false : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      <motion.span
        className="gs-eyebrow-chip"
        aria-hidden="true"
        variants={{
          hidden: { scale: 0.4, rotate: -45, opacity: 0 },
          shown: { scale: 1, rotate: 0, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 18 } },
        }}
      >
        <Icon size={14} strokeWidth={2.4} />
      </motion.span>
      <motion.span
        className="gs-eyebrow-label"
        variants={{
          hidden: { opacity: 0, x: -8 },
          shown: { opacity: 1, x: 0, transition: { duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] } },
        }}
      >
        {label}
      </motion.span>
    </motion.div>
  );
}

// Rendered once by the page that uses the eyebrows (LandingPage), not once per label
export const EYEBROW_CSS = `
  .gs-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; width: fit-content; }
  .gs-eyebrow-center { margin-left: auto; margin-right: auto; }
  .gs-eyebrow-chip {
    width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: #ecfdf5; color: #059669; box-shadow: inset 0 0 0 1px #d1fae5;
    transition: transform .25s cubic-bezier(.22,1,.36,1), background .25s, color .25s;
  }
  .gs-eyebrow:hover .gs-eyebrow-chip { transform: translateY(-2px) rotate(-6deg); background: #10b981; color: #fff; }
  .gs-eyebrow-label { font-size: 12.5px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: #047857; }
  @media (prefers-reduced-motion: reduce) {
    .gs-eyebrow-chip { transition: none; }
    .gs-eyebrow:hover .gs-eyebrow-chip { transform: none; }
  }
`;
