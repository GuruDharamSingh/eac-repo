import Link from "next/link";
import { Lock } from "lucide-react";
import { canViewFeed, listOrgFeeds } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The React chrome for the database-driven pages.
 *
 * Mirrors the Silex template's eac-enn-nav — sticky translucent dark bar,
 * centred enneagram glyph, uppercase letterspaced links — so moving between a
 * published Silex page and a React one doesn't feel like two sites. The
 * markup is ours; only the look is borrowed, because the Silex stylesheet
 * isn't loaded on these routes.
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

  const visible = feeds.filter((feed) => canViewFeed(feed, viewer?.role ?? null));

  return (
    <header className="sticky top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border/70 bg-background/85 px-7 py-4 backdrop-blur">
      <nav className="flex flex-wrap items-center gap-5 justify-self-start">
        {visible.map((feed) => (
          <Link
            key={feed.slug}
            href={`/${feed.slug}`}
            className="inline-flex items-center gap-1 text-[13px] uppercase tracking-[0.12em] text-muted-foreground no-underline transition-colors hover:text-primary"
          >
            {feed.name}
            {feed.minRole && <Lock className="size-3" aria-label="Members only" />}
          </Link>
        ))}
        <Link
          href="/about"
          className="text-[13px] uppercase tracking-[0.12em] text-muted-foreground no-underline transition-colors hover:text-primary"
        >
          About
        </Link>
      </nav>

      <Link href="/" aria-label="Home" className="justify-self-center text-foreground">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          aria-hidden
          className="block size-[30px] opacity-90"
        >
          <circle cx="50" cy="50" r="42" />
          <path d="M84.6 70 L15.4 70 L50 8 Z" />
          <path d="M75.7 19.4 L63.7 87.6 L89.4 43.1 L24.3 19.4 L36.3 87.6 L10.6 43.1 Z" />
        </svg>
      </Link>

      <nav className="flex items-center gap-5 justify-self-end">
        {viewer?.canEdit && (
          <Link
            href="/manage"
            className="text-[13px] uppercase tracking-[0.12em] text-muted-foreground no-underline transition-colors hover:text-primary"
          >
            Manage
          </Link>
        )}
        {viewer ? (
          <Link
            href="/hub"
            className="text-[13px] uppercase tracking-[0.12em] text-foreground no-underline transition-colors hover:text-primary"
          >
            Members
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-[13px] uppercase tracking-[0.12em] text-foreground no-underline transition-colors hover:text-primary"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
