import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";

import NavBar from "./_components/NavBar";
import ScrollProgress from "./_components/ScrollProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display face for headings — the warm counterpart to the brown palette.
// Wired to Tailwind's `font-display` utility via --font-display in globals.css.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResumeTailor",
  description:
    "Store every role, project, and bullet point in one Master Vault, then tailor them to any job posting with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <NavBar />
        <ScrollProgress />
        <main className="flex-1">{children}</main>

        <footer className="mt-20 border-t border-brown-200/70 bg-brown-50/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>
              <span className="font-display text-sm font-semibold text-brown-900">
                Resume<span className="text-blue-600">Tailor</span>
              </span>{" "}
              — one vault, every resume.
            </p>
            <p>
              Next.js frontend on <code className="font-mono">:3000</code>,
              FastAPI backend on <code className="font-mono">:8000</code>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
