import "./globals.css";
import type { Metadata, Viewport } from "next";
import { EB_Garamond } from "next/font/google";
import { chromeState } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { FORUM_URL, NETWORK_URL, SITE, SOPHIA_URL } from "@/lib/site";

// The newsroom face of arts-collective.com; labels and controls are Arial, as there.
const serif = EB_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

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
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" });
  return (
    <html lang="en" className={serif.variable}>
      <body>
        <div className="so-root">
          <a className="so-skip" href="#main">Skip to the page</a>
          <header className="so-top">
            <div className="so-mast">
              <div className="so-mast__line"><span>{today}</span><a href={NETWORK_URL}>Elkdonis Arts Collective</a></div>
              <a className="so-top__name" href="/">{SITE.name}</a>
              <p className="so-mast__tag">Courses &bull; Practice &bull; Together</p>
            </div>
            <nav className="so-nav" aria-label="Site">
              <a href="/inner">Inner</a>
              <a href="/outer">Outer</a>
              <a href="/workshops">Workshops</a>
              <a href="/schedule">Schedule</a>
              <a href="/guides">Guides</a>
              <a href="/traditions">Traditions</a>
              {me.signedIn && (
                <a href="/journal">
                  Journal
                  {me.waiting > 0 && <><span className="so-count" aria-hidden>{me.waiting}</span><span className="so-sr"> — {me.waiting} waiting on you</span></>}
                  {me.unseen > 0 && <><span className="so-dot" aria-hidden /><span className="so-sr"> — your guide has answered</span></>}
                </a>
              )}
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
