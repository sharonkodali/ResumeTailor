'use client';

import { animate, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Plain-English reading of the score, so the number is not the only signal. */
function band(score: number) {
  if (score >= 75) return { label: 'Strong match', tone: 'text-ash-50' };
  if (score >= 50) return { label: 'Partial match', tone: 'text-ash-100' };
  return { label: 'Weak match', tone: 'text-ash-200' };
}

export default function ScoreRing({ score }: { score: number }) {
  const [display, setDisplay] = useState(0);
  const { label, tone } = band(score);

  // Counts the number up alongside the arc rather than snapping to the result.
  useEffect(() => {
    const controls = animate(0, score, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setDisplay(Math.round(value)),
    });
    return () => controls.stop();
  }, [score]);

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-ash-300)" />
              <stop offset="100%" stopColor="var(--color-ash-50)" />
            </linearGradient>
          </defs>

          <circle
            cx="56"
            cy="56"
            r={RADIUS}
            fill="none"
            strokeWidth="9"
            className="stroke-ash-600"
          />
          <motion.circle
            cx="56"
            cy="56"
            r={RADIUS}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            stroke="url(#score-gradient)"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{
              strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(score, 100) / 100),
            }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-2xl font-semibold tabular-nums text-ash-50">
            {display}
            <span className="text-base text-ash-300">%</span>
          </span>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-ash-200">
          ATS Match Score
        </div>
        <div className={`mt-1 font-display text-lg font-semibold ${tone}`}>
          {label}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ash-200">
          How well your Vault lines up with this posting&rsquo;s keywords.
        </p>
      </div>
    </div>
  );
}
