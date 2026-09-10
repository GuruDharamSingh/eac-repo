import { canViewFeed, listOrgFeeds } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { SiteNavBar, type NavLink } from "@/components/site-nav-bar";

/**
 * The React chrome for every page on this site, published Silex ones included.
 *
 * This is the data half: it reads the feeds and the viewer server-side and
 * hands SiteNavBar a plain list of links. The bar itself is a client component
 * because a menu has to open, and the published artifact cannot carry script.
 *
 * Links come from org_feeds, so adding a section to the site is a row rather
 * than an edit here. Member-only feeds are filtered by canViewFeed and shown
 * with a lock to the members who can open them.
 */
export async function SiteNav() {
  const [feeds, viewer] = await Promise.all([
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    getViewer().catch(() => null),
  ]);

  const primary: NavLink[] = feeds
    .filter((feed) => canViewFeed(feed, viewer?.role ?? null))
    .map((feed) => ({
      href: `/${feed.slug}`,
      label: feed.name,
      locked: Boolean(feed.minRole),
    }));

  primary.push({ href: "/forum", label: "Forum" }, { href: "/about", label: "About" });

  const secondary: NavLink[] = [];
  if (viewer?.canEdit) secondary.push({ href: "/manage", label: "Manage" });
  secondary.push(
    viewer
      ? { href: "/hub", label: "Members", strong: true }
      : { href: "/login", label: "Sign in", strong: true }
  );

  return <SiteNavBar primary={primary} secondary={secondary} />;
}
