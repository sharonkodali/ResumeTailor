'use client';

import { motion } from 'framer-motion';

/**
 * Fade-and-rise wrapper for content entering the viewport.
 *
 * Exists so Server Components can opt individual sections into motion without
 * the whole page having to become a Client Component.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  /** Distance travelled on the way in; 0 fades in place. */
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // `once` keeps content from re-animating every time it scrolls past.
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
