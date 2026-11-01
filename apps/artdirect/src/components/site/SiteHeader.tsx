import { getProfile } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { NavLink } from "./NavLink";

/**
 * The site header on every ArtDirect page (app/layout.tsx): the wordmark,
 * the directory, and the viewer's own items. The viewer comes from the
 * session (getCurrentUser → getServerSession), never from the request.
 * Styles: app/artdirect.css `.oad-site-*`.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  const ownPage = profile ? `/${profile.slug ?? profile.userId}` : null;

  return (
    <header className="oad-site-header">
      <div className="oad-site-header-inner">
        <a className="oad-wordmark" href="/">
          ArtDirect
        </a>
        <nav className="oad-site-nav" aria-label="Site">
          <NavLink href="/">Directory</NavLink>
          {user ? (
            <>
              {ownPage ? <NavLink href={ownPage}>Your page</NavLink> : null}
              <NavLink href="/new">Open a file</NavLink>
              <a href="/api/auth/logout">Sign out</a>
            </>
          ) : (
            <>
              <NavLink href="/login">Sign in</NavLink>
              <NavLink href="/new" className="oad-site-nav-accent">
                Open a file
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
