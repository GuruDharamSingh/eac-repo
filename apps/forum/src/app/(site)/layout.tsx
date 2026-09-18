import { NotificationsBell, SearchBox } from "@elkdonis/forum-ui";
import { countUnreadNotifications, listNotifications } from "@elkdonis/services";
import { getViewer } from "@/lib/viewer";
import { hrefs, SITE, ACTION_BASE } from "@/lib/site";

const ROOT = hrefs.root().replace(/\/$/, "");

/**
 * The masthead: the name, the line under it, search, the bell, and who you
 * are. Navigation is not here — it is the rail the package renders inside
 * every page, so it is the same on the network host and on an org's site.
 * The "☰" only shows on a phone, where it opens that rail.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  // Mark-all-read from the bell returns to the home; the layout doesn't know the page.
  const back = hrefs.root();

  const [bellItems, bellCount] = viewer.userId
    ? await Promise.all([
        listNotifications(viewer.userId, 12).catch(() => []),
        countUnreadNotifications(viewer.userId).catch(() => 0),
      ])
    : [[], 0];

  return (
    <>
      <header className="gf-masthead">
        <div className="gf-masthead-inner">
          <div className="gf-masthead-top">
            <div className="gf-masthead-brand">
              <a className="gf-menu-link gf-tool" href="#menu" aria-label="Open the menu">☰</a>
              <a className="gf-brand" href={hrefs.root()}>{SITE.name}</a>
              <p className="gf-tagline">{SITE.tagline}</p>
            </div>
            <div className="gf-masthead-right">
              <SearchBox href={`${ROOT}/search`} compact />
              {viewer.userId ? (
                <>
                  <NotificationsBell items={bellItems} unread={bellCount} hrefs={hrefs} actionBase={ACTION_BASE} back={back} />
                  <span className="gf-masthead-me"><span className="gf-person">{viewer.name}</span></span>
                </>
              ) : hrefs.signIn ? (
                <a href={hrefs.signIn}>Sign in · Join</a>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="gf-page">{children}</main>
    </>
  );
}
