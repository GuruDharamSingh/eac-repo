import "./globals.css";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, UnifrakturCook } from "next/font/google";
import { cookies } from "next/headers";
import { SITE } from "@/lib/site";

const title = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-title",
  display: "swap",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = UnifrakturCook({ subsets: ["latin"], weight: "700", variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.tagline,
};

// Everything is per request: the masthead reads the session and every page
// is a live read of the boards.
export const dynamic = "force-dynamic";

/**
 * The document only. The masthead lives in (site)/layout.tsx so that /embed
 * can serve the same forum with no chrome at all.
 *
 * The reader's light/dark choice (cookie `forum_mode`, set by the footer
 * toggle) is mirrored onto <html data-theme> so the masthead — which sits
 * outside the forum's own .gf-root — changes ground with the board.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = (await cookies()).get("forum_mode")?.value;
  const theme = mode === "dark" || mode === "light" ? mode : undefined;
  return (
    <html lang="en" suppressHydrationWarning className={`${title.variable} ${body.variable} ${display.variable}`} data-theme={theme}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
