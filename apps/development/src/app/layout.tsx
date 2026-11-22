import "./globals.css";
import "@/theme/test-theme.css";
import { fontsHref } from "@/theme/fonts";
import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = {
  title: { default: "Development", template: "%s · Development" },
  robots: { index: false, follow: false },
};

const FONTS = fontsHref();

/** Rendered per request: the gate reads the session. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The gate runs here AND in every page (a layout is not re-run on client navigation,
  // and a page can be requested on its own), so no page ever renders without a check.
  const admin = await requireNetworkAdmin("/");
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {FONTS ? <link rel="stylesheet" href={FONTS} /> : null}
      </head>
      <body suppressHydrationWarning>
        <div className="dev-app">
          <TopBar email={admin.email} />
          <main className="dev-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
