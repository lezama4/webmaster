import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ShareRow } from "@ui/share/ShareRow";
import "./globals.css";
import { LanguageSelector } from "./LanguageSelector";
import { absoluteUrl, buildPageMetadata, metadataBase, SITE_NAME } from "./metadata";

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

/**
 * Home has no single title/description string of its own (the H1 is split
 * across `Home.title.firstLine`/`secondLine`) — everything else composes
 * `Metadata` from its own page's already-translated `title`/`description`
 * via `buildPageMetadata` (see `src/app/metadata.ts`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return {
    metadataBase,
    ...(await buildPageMetadata({
      pageTitle: `${t("title.firstLine")} ${t("title.secondLine")}`,
      description: t("what.description"),
      path: "/",
      imageAlt: t("hero.imageAlt"),
    })),
  };
}

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
  aboutLabel,
  helpLabel,
  loginLabel,
  registerLabel,
}: Record<"eventsLabel" | "finderLabel" | "aboutLabel" | "helpLabel" | "loginLabel" | "registerLabel", string>) {
  // Pinned only once the nav fits on one line. Wrapped across two or three
  // rows the header stands about 120px tall, and permanently reserving that
  // much of a phone screen costs more than a pinned header is worth — so on
  // small viewports it scrolls away like any other content.
  return (
    <header className="z-40 border-b border-border bg-background/85 backdrop-blur sm:sticky sm:top-0">
      {/* The row wraps instead of holding a fixed height. Six links plus the
          language selector overflow a phone-width viewport, and an unwrapped
          flex row does not clip — it widens the document, so the ENTIRE page
          scrolls sideways. Wrapping keeps every destination reachable and
          keyboard-navigable at any width; the header simply grows taller. */}
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <BrandMark />
          <span>Todo el tiempo cuenta</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
          <Link href="/events" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
            {eventsLabel}
          </Link>
          <Link
            href="/encuentra-tu-momento"
            className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground"
          >
            {finderLabel}
          </Link>
          <Link
            href="/quienes-somos"
            className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground"
          >
            {aboutLabel}
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

function SiteFooter({
  description,
  helpLabel,
  shareHeading,
  shareUrl,
}: {
  description: string;
  helpLabel: string;
  shareHeading: string;
  shareUrl: string;
}) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:px-6">
        <p className="font-medium text-foreground">Todo el tiempo cuenta</p>
        <p>{description}</p>
        <Link href="/ayuda" className="w-fit underline underline-offset-4 transition-colors hover:text-foreground">
          {helpLabel}
        </Link>
        {/* One quiet line sharing the SITE itself — deliberately separate
            from the page-level rows on /events and /encuentra-tu-momento
            (product decision, task brief). Reuses the mission statement
            already shown above as the share message: single source of
            copy, nothing new to author or audit. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
          <span>{shareHeading}</span>
          <ShareRow url={shareUrl} title={SITE_NAME} text={description} compact />
        </div>
      </div>
    </footer>
  );
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [t, tFinder, tAbout, tShare, locale, messages] = await Promise.all([
    getTranslations("Layout"),
    getTranslations("Finder"),
    getTranslations("About"),
    getTranslations("Share"),
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
            aboutLabel={tAbout("nav")}
            helpLabel={t("nav.help")}
            loginLabel={t("nav.login")}
            registerLabel={t("nav.register")}
          />
          <main className="flex-1">{children}</main>
          <SiteFooter
            description={t("footer.description")}
            helpLabel={t("footer.help")}
            shareHeading={tShare("footerLabel")}
            shareUrl={absoluteUrl("/")}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
