import "./globals.css";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, UnifrakturCook } from "next/font/google";
import { NotificationsBell, SearchBox } from "@elkdonis/forum-ui";
import { countUnreadNotifications, listNotifications, listTopics } from "@elkdonis/services";
import { getViewer } from "@/lib/viewer";
import { hrefs, SITE, ACTION_BASE } from "@/lib/site";

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

const ROOT = hrefs.root().replace(/\/$/, "");
const NAV: Array<{ label: string; href: string }> = [
  { label: "Boards", href: hrefs.root() },
  { label: "Latest", href: hrefs.latest() },
  { label: "Happening", href: hrefs.happening() },
  { label: "Topics", href: `${ROOT}/topics` },
  { label: "Orgs", href: `${ROOT}/orgs` },
  { label: "Members", href: `${ROOT}/members` },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const root = hrefs.root().replace(/\/$/, "");
  // Mark-all-read from the bell returns to the boards; the layout doesn't know the page.
  const back = hrefs.root();

  // Signed-in furniture: unread count, watching, the bell.
  const [unreadTopics, bellItems, bellCount] = viewer.userId
    ? await Promise.all([
        listTopics({ kind: "unread", scope: { kind: "network" } }, viewer, { limit: 1 }).then((p) => p.total).catch(() => 0),
        listNotifications(viewer.userId, 12).catch(() => []),
        countUnreadNotifications(viewer.userId).catch(() => 0),
      ])
    : [0, [], 0];

  return (
    <html lang="en" suppressHydrationWarning className={`${title.variable} ${body.variable} ${display.variable}`}>
      <body suppressHydrationWarning>
        <header className="gf-masthead">
          <div className="gf-masthead-inner">
            <div className="gf-masthead-top">
              <div>
                <a className="gf-brand" href={hrefs.root()}>{SITE.name}</a>
                <p className="gf-tagline">{SITE.tagline}</p>
              </div>
              <div className="gf-masthead-right">
                <SearchBox href={`${ROOT}/search`} compact />
                {viewer.userId ? (
                  <>
                    <NotificationsBell items={bellItems} unread={bellCount} hrefs={hrefs} actionBase={ACTION_BASE} back={back} />
                    <span className="gf-nav-me">{viewer.name}</span>
                  </>
                ) : hrefs.signIn ? (
                  <a href={hrefs.signIn}>Sign in · Join</a>
                ) : null}
              </div>
            </div>
            <nav className="gf-nav" aria-label="Primary">
              {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
              <span className="gf-nav-spacer" />
              {viewer.userId && (
                <>
                  <a href={`${root}/unread`}>Unread{unreadTopics ? ` ${unreadTopics}` : ""}</a>
                  <a href={`${root}/watching`}>Watching</a>
                  <a href={`${root}/bookmarks`} title="Bookmarks">⚑</a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="gf-page">{children}</main>
        <footer className="gf-footer">{SITE.name} · every thread on the network, in one place.</footer>
      </body>
    </html>
  );
}
