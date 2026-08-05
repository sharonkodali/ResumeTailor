'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Hairline reading-progress bar pinned under the nav.
 *
 * Spring-smoothed rather than bound straight to scrollYProgress, which
 * otherwise tracks trackpad momentum closely enough to look jittery.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 24,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed top-16 left-0 right-0 z-40 h-0.5 origin-left bg-gradient-to-r from-ash-500 via-ash-200 to-ash-50"
    />
  );
}
