import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

import NavBar from "./_components/NavBar";
import ScrollProgress from "./_components/ScrollProgress";

// One family carries the whole interface — headings, body and labels alike.
// Wired to `font-sans` / `font-display` via --font-outfit in globals.css.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <NavBar />
        <ScrollProgress />
        <main className="flex-1">{children}</main>

        <footer className="mt-20 border-t border-ash-600 bg-ash-950">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-ash-200 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>
              <span className="text-sm font-semibold text-ash-50">
                Resume<span className="text-ash-200">Tailor</span>
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
