import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CannibalScan",
  description: "Auditor de canibalização e análise competitiva de SEO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-5xl flex items-center gap-6 px-8 py-3">
            <span className="font-bold text-gray-900">CannibalScan</span>
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Um site
            </Link>
            <Link
              href="/compare"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Comparar 2 sites
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
