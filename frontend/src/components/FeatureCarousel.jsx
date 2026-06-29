import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { featureSteps } from '../data/feature-steps';

const INTERVAL_MS = 3800;

export default function FeatureCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const advance = useCallback(() => {
    setCurrent(i => (i + 1) % featureSteps.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, advance]);

  const step = featureSteps[current];

  return (
    <>
      <style>{`
        .gs-fc-root {
          display: flex;
          flex-direction: column;
          gap: 0;
          width: 100%;
        }
        .gs-fc-img-frame {
          position: relative;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          border: 1px solid rgba(52,211,153,0.15);
          border-bottom: none;
          background: #0f172a;
        }
        .gs-fc-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top;
          display: block;
        }
        .gs-fc-step-pill {
          position: absolute;
          top: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          background: rgba(2,6,23,0.80);
          border: 1px solid rgba(52,211,153,0.22);
          border-radius: 100px;
          backdrop-filter: blur(12px);
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
          pointer-events: none;
          z-index: 10;
        }
        .gs-fc-step-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          flex-shrink: 0;
          animation: gs-pulse 2s ease-in-out infinite;
        }
        .gs-fc-caption {
          padding: 20px 24px 22px;
          background: rgba(15,23,42,0.90);
          border: 1px solid rgba(52,211,153,0.15);
          border-top: 1px solid rgba(52,211,153,0.1);
          border-radius: 0 0 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          backdrop-filter: blur(8px);
        }
        .gs-fc-caption-body {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-height: 52px;
        }
        .gs-fc-num {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
          color: #10b981;
          padding-top: 2px;
          flex-shrink: 0;
          font-family: 'JetBrains Mono', monospace;
        }
        .gs-fc-title {
          font-size: 15px;
          font-weight: 800;
          color: rgba(255,255,255,0.95);
          margin: 0 0 4px;
          letter-spacing: -0.3px;
        }
        .gs-fc-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.52);
          margin: 0;
          line-height: 1.65;
        }
        .gs-fc-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gs-fc-dot-btn {
          background: none;
          border: none;
          padding: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gs-fc-dot {
          width: 20px;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.18);
          transition: background 0.25s, width 0.25s;
        }
        .gs-fc-dot.active {
          background: #10b981;
          width: 32px;
        }
        .gs-fc-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, #10b981, #34d399);
          border-radius: 0 0 0 20px;
          z-index: 10;
        }
      `}</style>

      <div
        className="gs-fc-root"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* ── Image ── */}
        <div className="gs-fc-img-frame">
          <AnimatePresence mode="wait">
            <motion.img
              key={current}
              src={step.image}
              alt={step.title}
              className="gs-fc-img"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>

          {/* Step pill */}
          <div className="gs-fc-step-pill">
            <span className="gs-fc-step-pill-dot" />
            Step {current + 1} of {featureSteps.length}
          </div>

          {/* Auto-play progress bar */}
          {!paused && (
            <motion.div
              key={current}
              className="gs-fc-progress"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: INTERVAL_MS / 1000, ease: 'linear' }}
            />
          )}
        </div>

        {/* ── Caption ── */}
        <div className="gs-fc-caption">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              className="gs-fc-caption-body"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="gs-fc-num">0{current + 1}</span>
              <div>
                <p className="gs-fc-title">{step.title}</p>
                <p className="gs-fc-desc">{step.description}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="gs-fc-dots">
            {featureSteps.map((_, i) => (
              <button
                key={i}
                className="gs-fc-dot-btn"
                onClick={() => setCurrent(i)}
                aria-label={`Go to step ${i + 1}`}
              >
                <span className={`gs-fc-dot ${i === current ? 'active' : ''}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
