import Link from "next/link";
import { Lock } from "lucide-react";
import type { OrgFeed } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { getThreadsForFeed } from "@/lib/data";
import { siteConfig } from "@/config/site";

/**
 * A section of the site, rendered from org_feeds + its threads.
 *
 * Access has already been decided by the caller (the [page] dispatcher calls
 * canViewFeed before rendering this); this only draws. The member-aware read
 * still runs, so an ORGANIZATION-visibility post inside an otherwise public
 * feed stays hidden from signed-out visitors.
 */
export async function FeedListing({
  feed,
  isMember,
}: {
  feed: OrgFeed;
  isMember: boolean;
}) {
  const threads = await getThreadsForFeed(feed.slug, { isMember });

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[880px] px-6 py-16 font-sans">
        {feed.minRole && (
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Members only
          </p>
        )}

        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          {feed.tagline ?? siteConfig.orgName}
        </p>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-[1.05]">{feed.name}</h1>
        {feed.description && (
          <p className="mt-4 max-w-[560px] text-lg text-muted-foreground">{feed.description}</p>
        )}

        {threads.length === 0 ? (
          <p className="mt-16 text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/${feed.slug}/${thread.slug}`}
                className="group flex flex-col rounded-xl border border-border bg-card p-6 no-underline transition-colors hover:border-primary/60"
              >
                {thread.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thread.coverImageUrl}
                    alt=""
                    loading="lazy"
                    className="mb-5 aspect-[16/9] w-full rounded-lg object-cover"
                  />
                )}
                {thread.visibility === "ORGANIZATION" && (
                  <Badge variant="secondary" className="mb-2 w-fit gap-1">
                    <Lock className="size-3" aria-hidden />
                    Members
                  </Badge>
                )}
                <h2 className="font-serif text-2xl font-medium">{thread.title}</h2>
                {thread.excerpt && (
                  <p className="mt-2 text-sm text-muted-foreground">{thread.excerpt}</p>
                )}
                <span className="mt-auto pt-6 text-xs uppercase tracking-[0.2em] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Read →
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
