'use client';

import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { ArrowRight, Sparkles, Vault } from 'lucide-react';
import Link from 'next/link';

const ICONS = { vault: Vault, sparkles: Sparkles } as const;

export default function StepCard({
  href,
  eyebrow,
  title,
  description,
  cta,
  icon,
  accent,
  delay = 0,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  icon: keyof typeof ICONS;
  /** Which half of the palette this step belongs to. */
  accent: 'brown' | 'blue';
  delay?: number;
}) {
  const Icon = ICONS[icon];

  // Pointer position drives a soft highlight that follows the cursor across
  // the card. Motion values are used so this never triggers a React render.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glow = useMotionTemplate`radial-gradient(340px circle at ${x}px ${y}px, var(--glow-color), transparent 70%)`;

  const tone =
    accent === 'brown'
      ? {
          ring: 'hover:border-brown-300',
          chip: 'bg-brown-100 text-brown-700',
          badge: 'from-brown-500 to-brown-700',
          link: 'text-brown-700',
          glow: 'rgb(141 98 64 / 0.10)',
        }
      : {
          ring: 'hover:border-blue-300',
          chip: 'bg-blue-100 text-blue-700',
          badge: 'from-blue-500 to-blue-700',
          link: 'text-blue-700',
          glow: 'rgb(52 94 151 / 0.10)',
        };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - bounds.left);
        y.set(event.clientY - bounds.top);
      }}
      style={{ '--glow-color': tone.glow } as React.CSSProperties}
      className="group relative"
    >
      <Link
        href={href}
        className={`relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-brown-200/80 bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-lift ${tone.ring}`}
      >
        <motion.span
          aria-hidden
          style={{ background: glow }}
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        <div className="relative flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${tone.chip}`}
          >
            {eyebrow}
          </span>
          <span
            className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-card ${tone.badge}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <h2 className="relative font-display text-xl font-semibold text-brown-950">
          {title}
        </h2>
        <p className="relative flex-1 text-sm leading-relaxed text-stone-600">
          {description}
        </p>

        <span
          className={`relative inline-flex items-center gap-1.5 text-sm font-semibold ${tone.link}`}
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  );
}
