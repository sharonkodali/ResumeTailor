'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Menu, Sparkles, Vault, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/', label: 'Home', icon: Layers },
  { href: '/vault', label: 'Master Vault', icon: Vault },
  { href: '/tailor', label: 'AI Tailor', icon: Sparkles },
] as const;

export default function NavBar() {
  // Reading the current route is what makes this a Client Component; the rest
  // of the tree stays on the server.
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // The bar sits flush with the page at rest and lifts once you scroll, so the
  // hero reads as one surface instead of being cut by a border immediately.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A route change should never leave the mobile sheet hanging open.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-brown-200/70 bg-canvas/85 backdrop-blur-md'
          : 'border-b border-transparent bg-canvas/60 backdrop-blur-sm'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6 sm:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-tight text-brown-900"
        >
          <motion.span
            whileHover={{ rotate: -12, scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14 }}
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brown-600 to-brown-800 text-brown-50 shadow-card"
          >
            <Vault className="h-4 w-4" />
          </motion.span>
          Resume<span className="text-blue-600">Tailor</span>
        </Link>

        {/* Desktop nav — the active pill is a single element that slides
            between items via layoutId rather than fading in and out. */}
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'text-brown-900'
                    : 'text-stone-500 hover:text-brown-800'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-brown-100 ring-1 ring-brown-200/80"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      active ? 'text-blue-600' : 'text-stone-400'
                    }`}
                  />
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="grid h-9 w-9 place-items-center rounded-lg border border-brown-200 text-brown-800 transition hover:bg-brown-50 sm:hidden"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-brown-200/70 bg-canvas sm:hidden"
          >
            <div className="space-y-1 px-6 py-3">
              {LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-brown-100 text-brown-900 ring-1 ring-brown-200'
                        : 'text-stone-600 hover:bg-brown-50'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active ? 'text-blue-600' : 'text-stone-400'
                      }`}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
