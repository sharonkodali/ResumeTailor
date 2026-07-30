'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/vault', label: 'Master Vault' },
  { href: '/tailor', label: 'AI Tailor' },
] as const;

export default function NavBar() {
  // Reading the current route is what makes this a Client Component; the rest
  // of the tree stays on the server.
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <nav className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="font-bold text-gray-900 tracking-tight shrink-0">
          Resume<span className="text-blue-600">Tailor</span>
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
