import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Vivetutiempo — live moments for hospital stays",
  description:
    "A non-profit platform that helps hospitals and artists bring live performances to patients and their families during long stays.",
};

/** Small brand mark — two overlapping arcs suggesting a shared moment. Inline SVG (no icon dependency, no emoji). */
function BrandMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      className="text-primary"
    >
      <path
        d="M13 22.5C7 18.8 3.5 15.3 3.5 10.6 3.5 7.4 6 5 9 5c1.8 0 3.2.9 4 2.2C13.8 5.9 15.2 5 17 5c3 0 5.5 2.4 5.5 5.6 0 4.7-3.5 8.2-9.5 11.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <BrandMark />
          <span>Vivetutiempo</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/events"
            className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground"
          >
            Events
          </Link>
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition-all hover:bg-primary-hover active:translate-y-px"
          >
            Register
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm text-muted sm:px-6">
        <p className="font-medium text-foreground">Vivetutiempo</p>
        <p>
          A non-profit initiative bringing live performances to patients during
          hospital stays. Free for hospitals, artists, and families.
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
