import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ShareRow } from "@ui/share/ShareRow";
import { getCurrentSessionIdentity } from "@infrastructure/http/sessionCookie";
import "./globals.css";
import { LanguageSelector } from "./LanguageSelector";
import { LogoutButton } from "./LogoutButton";
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

/**
 * What the header shows about the signed-in visitor. Prepared by the layout
 * (a Server Component) so this stays presentational: `name` and `typeLabel`
 * are already translated, `href` points at that role's own area, and
 * `statusLabel` is set ONLY when the profile cannot yet act.
 */
type HeaderIdentity = {
  readonly name: string;
  readonly typeLabel: string;
  readonly href: string | null;
  readonly statusLabel: string | null;
};

function UserMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
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
  logoutLabel,
  loggingOutLabel,
  identity,
}: Record<
  | "eventsLabel"
  | "finderLabel"
  | "aboutLabel"
  | "helpLabel"
  | "loginLabel"
  | "registerLabel"
  | "logoutLabel"
  | "loggingOutLabel",
  string
> & { identity: HeaderIdentity | null }) {
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
        {/* Left: brand + "Quiénes somos" — the about entry belongs beside the
            identity, not in the functional nav (review). */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <Link href="/" className="flex items-center gap-2 px-1 font-semibold tracking-tight">
            <BrandMark />
            <span>Todo el tiempo cuenta</span>
          </Link>
          <Link href="/quienes-somos" className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground">
            {aboutLabel}
          </Link>
        </div>
        {/* Right: PUBLIC actions lead — the vast majority of visitors only
            browse (events, find a centre) and never register. Access for
            centres/artists stays reachable but is deliberately NOT the loud
            primary CTA it used to be; registering is for the small minority
            who onboard, so it reads as a quiet link, not the headline. */}
        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
          {/* "Find your centre" leads the nav and is the one emphasised entry:
              it is the first thing a family needs to do. The emphasis is the
              quiet one previously carried by "Register" — weight and full
              contrast, no pill — and "Register" now reads like "Log in". */}
          <Link
            href="/encuentra-tu-momento"
            className="rounded-full px-3 py-2 font-medium text-foreground transition-colors hover:text-primary"
          >
            {finderLabel}
          </Link>
          <Link href="/events" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
            {eventsLabel}
          </Link>
          <Link href="/ayuda" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
            {helpLabel}
          </Link>
          <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden="true" />
          {/* Signed in: say WHO, in what kind of profile, and offer the way
              out. Before this the header showed "Log in" to an already
              signed-in visitor and offered no way to sign out at all. The
              name links to that role's own area, which is where someone who
              just identified themselves is usually trying to go. */}
          {identity ? (
            <>
              {identity.href ? (
                <Link
                  href={identity.href}
                  className="flex items-center gap-2 rounded-full px-3 py-2 transition-colors hover:text-primary"
                >
                  <UserMark />
                  <span className="font-medium text-foreground">{identity.name}</span>
                  <span className="text-muted" aria-hidden="true">·</span>
                  <span className="text-muted">{identity.typeLabel}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-3 py-2">
                  <UserMark />
                  <span className="font-medium text-foreground">{identity.name}</span>
                  <span className="text-muted" aria-hidden="true">·</span>
                  <span className="text-muted">{identity.typeLabel}</span>
                </span>
              )}
              {identity.statusLabel ? (
                <span className="rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent">
                  {identity.statusLabel}
                </span>
              ) : null}
              <LogoutButton
                label={logoutLabel}
                pendingLabel={loggingOutLabel}
                className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground disabled:opacity-60"
              />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
                {loginLabel}
              </Link>
              <Link href="/register" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-foreground">
                {registerLabel}
              </Link>
            </>
          )}
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

/** Where each role's own workspace lives; `patient` accounts have none. */
const AREA_BY_ROLE: Record<string, string | null> = {
  centre: "/hospital/slots",
  artist: "/artist/slots",
  admin: "/admin/profiles",
  patient: null,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [t, tFinder, tAbout, tShare, tCentreType, locale, messages, session] = await Promise.all([
    getTranslations("Layout"),
    getTranslations("Finder"),
    getTranslations("About"),
    getTranslations("Share"),
    getTranslations("CentreType"),
    getLocale(),
    getMessages(),
    getCurrentSessionIdentity(),
  ]);

  // A centre is identified by its OWN kind (Hospital, Residencia, Centro de
  // día…), not by the generic "centre" role — that is the distinction the
  // header exists to make visible.
  function roleLabel(): string {
    if (!session) return "";
    if (session.role === "centre") {
      return session.centreType ? tCentreType(session.centreType) : t("account.centre");
    }
    if (session.role === "artist") return t("account.artist");
    if (session.role === "admin") return t("account.admin");
    return t("account.patient");
  }

  const identity = session
    ? {
        name: session.name ?? t("account.noName"),
        typeLabel: roleLabel(),
        href: AREA_BY_ROLE[session.role] ?? null,
        // Shown only when the profile cannot act yet, so the visitor learns it
        // from the header instead of from a button that does nothing.
        statusLabel:
          session.status && session.status !== "active"
            ? session.status === "pending"
              ? t("account.pending")
              : t("account.inactive")
            : null,
      }
    : null;

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
            logoutLabel={t("nav.logout")}
            loggingOutLabel={t("nav.loggingOut")}
            identity={identity}
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
