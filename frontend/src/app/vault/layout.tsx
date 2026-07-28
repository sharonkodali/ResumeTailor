import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ResumeTailor - AI Resume Optimization",
  description: "Store your raw experiences and generate tailored resume bullets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 min-h-screen text-gray-900`}>
        {/* Navigation Bar */}
        <nav className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Resume<span className="text-gray-900">Tailor</span>
            </Link>
            <div className="flex gap-6 text-sm font-medium">
              <Link href="/vault" className="text-gray-600 hover:text-blue-600 transition">
                🗄️ Master Vault
              </Link>
              <Link href="/tailor" className="text-gray-600 hover:text-blue-600 transition">
                ✨ AI Tailor
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main>{children}</main>
      </body>
    </html>
  );
}