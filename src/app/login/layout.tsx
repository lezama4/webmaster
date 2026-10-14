import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { buildPageMetadata } from "@/app/metadata";

// The page is a Client Component and cannot export `generateMetadata`, so its
// own title lives in this layout instead of inheriting the home title.
export async function generateMetadata(): Promise<Metadata> {
  const [tLayout, t, tHome] = await Promise.all([
    getTranslations("Layout"),
    getTranslations("Login"),
    getTranslations("Home"),
  ]);
  return buildPageMetadata({
    pageTitle: tLayout("nav.login"),
    description: t("description"),
    path: "/login",
    imageAlt: tHome("hero.imageAlt"),
  });
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
