import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Source_Serif_4 } from "next/font/google";
import { chromeState } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { FORUM_URL, NETWORK_URL, SITE, SOPHIA_URL } from "@/lib/site";

const title = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-title", display: "swap" });
const read = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-read", display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SOPHIA_URL),
  title: { default: `${SITE.name} — courses from the Elkdonis Arts Collective`, template: `%s · ${SITE.name}` },
  description: SITE.tagline,
  openGraph: { siteName: SITE.name, type: "website" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// The chrome reads the session, and every page is a live read.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await chromeState(connectors);
  return (
    <html lang="en" className={`${title.variable} ${read.variable} ${ui.variable}`}>
      <body>
        <div className="so-root">
          <a className="so-skip" href="#main">Skip to the page</a>
          <header className="so-top">
            <a className="so-top__name" href="/">{SITE.name}</a>
            <nav aria-label="Site">
              <a href="/">Courses</a>
              {me.signedIn && <a href="/journal">Journal{me.unseen > 0 && <><span className="so-dot" aria-hidden /><span className="so-sr"> — your guide has answered</span></>}</a>}
              {me.isGuide && <a href="/guide">Guide desk</a>}
              {me.isGuide && <a href="/studio">Studio</a>}
              {me.signedIn ? <span className="so-meta">{me.name}</span> : <a href="/login">Sign in</a>}
            </nav>
          </header>
          <div id="main" tabIndex={-1} style={{ display: "contents" }}>{children}</div>
          <footer className="so-bottom">
            <a href="/care">Taking care while you practise</a>
            <a href={FORUM_URL}>The Grand Forum</a>
            <a href={NETWORK_URL}>Elkdonis Arts Collective</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
