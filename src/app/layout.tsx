import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { LanguageSelector } from "./LanguageSelector";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
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

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="text-primary">
      <path
        d="M13 22.5C7 18.8 3.5 15.3 3.5 10.6 3.5 7.4 6 5 9 5c1.8 0 3.2.9 4 2.2C13.8 5.9 15.2 5 17 5c3 0 5.5 2.4 5.5 5.6 0 4.7-3.5 8.2-9.5 11.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SiteHeader({
  eventsLabel,
  finderLabel,
  helpLabel,
  loginLabel,
  registerLabel,
}: Record<"eventsLabel" | "finderLabel" | "helpLabel" | "loginLabel" | "registerLabel", string>) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <BrandMark />
          <span>Vivetutiempo</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/events" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
            {eventsLabel}
          </Link>
          <Link
            href="/encuentra-tu-momento"
            className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground"
          >
            {finderLabel}
          </Link>
          <Link href="/ayuda" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
            {helpLabel}
          </Link>
          <Link href="/login" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
            {loginLabel}
          </Link>
          <Link href="/register" className="rounded-[13px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:translate-y-px">
            {registerLabel}
          </Link>
          <LanguageSelector />
        </nav>
      </div>
    </header>
  );
}

function SiteFooter({ description, helpLabel }: { description: string; helpLabel: string }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:px-6">
        <p className="font-medium text-foreground">Vivetutiempo</p>
        <p>{description}</p>
        <Link href="/ayuda" className="w-fit underline underline-offset-4 transition-colors hover:text-foreground">
          {helpLabel}
        </Link>
      </div>
    </footer>
  );
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [t, tFinder, locale, messages] = await Promise.all([
    getTranslations("Layout"),
    getTranslations("Finder"),
    getLocale(),
    getMessages(),
  ]);

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader
            eventsLabel={t("nav.events")}
            finderLabel={tFinder("nav")}
            helpLabel={t("nav.help")}
            loginLabel={t("nav.login")}
            registerLabel={t("nav.register")}
          />
          <main className="flex-1">{children}</main>
          <SiteFooter description={t("footer.description")} helpLabel={t("footer.help")} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
