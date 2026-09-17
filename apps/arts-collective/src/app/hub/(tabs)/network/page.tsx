import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getCommunityFeed } from "@/lib/community-feed";
import { getMemberRoster } from "@/lib/network";
import { getEditableOrgsForUser } from "@/lib/org";
import { getOrgRows } from "@/lib/network-admin";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { Button } from "@/components/ui/button";
import { CreateContentDialog } from "@/components/cms/create-content-dialog";
import { TierBadge } from "@/components/hub/TierBadge";
import { FilesCard } from "@elkdonis/cms-ui/files";

/**
 * Reads the session cookie, so it can never be a static page. Declared
 * rather than left to Next's automatic bailout: without it the export
 * step tries to prerender the page and dies inside a client boundary.
 */
export const dynamic = "force-dynamic";

const TIER_ORDER: Record<string, number> = { partner: 0, supported: 1, free: 2 };

export default async function NetworkTabPage() {
  const user = await requireUser();

  const [feed, roster, editableOrgs, orgRows, homes] = await Promise.all([
    getCommunityFeed(10),
    getMemberRoster(24),
    getEditableOrgsForUser(user.id),
    getOrgRows(),
    orgHomeUrlMap(),
  ]);

  const hasOrg = editableOrgs.length > 0;

  // Every confirmed org in the network — the one place a member can see who
  // else is here. Unconfirmed orgs are still in intake and stay off this list.
  const orgs = orgRows
    .filter((o) => o.subdomain_confirmed)
    .sort(
      (a, b) =>
        (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) ||
        a.name.localeCompare(b.name)
    );

  return (
    <div className="w-full py-10">
      {/* A person's own cloud storage. Everyone has a folder at
          EAC_Network/users/<slug>/ whether or not they have a Nextcloud
          login, so this is the only way most members can reach it. */}
      <FilesCard />

      <header className="mb-10 space-y-2 border-b border-border pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Community
        </p>
        <h1 className="font-serif text-4xl leading-tight text-foreground">
          What&apos;s happening across the collective.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          You don&apos;t need your own org to be part of this. Browse what
          member sites are publishing, meet other artists, and take part.
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg text-foreground">
            Contribute news
          </h2>
          <p className="text-sm text-muted-foreground">
            Publish an update, event, or article to share with the network.
          </p>
          {hasOrg ? (
            <CreateContentDialog
              orgSlug={editableOrgs[0].slug}
              triggerLabel="Contribute →"
              triggerVariant="outline"
            />
          ) : (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/hub/organization">Start an org to publish →</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg text-foreground">
            Shout out an artist
          </h2>
          <p className="text-sm text-muted-foreground">
            Browse the directory and reach out directly — public shout-outs
            are coming soon.
          </p>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/artists">Browse artists →</Link>
          </Button>
        </div>
      </section>

      <section className="mb-12 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">Organizations</h2>
          <span className="text-xs text-muted-foreground">
            {orgs.length} in the network
          </span>
        </div>
        {orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((o) => {
              const url = orgHomeUrl(homes, o.slug);
              return (
                <li
                  key={o.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-serif text-xl leading-tight text-foreground">
                        {o.name}
                      </h3>
                      <TierBadge tier={o.tier} />
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {url.replace(/^https?:\/\//, "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.member_count} {o.member_count === 1 ? "member" : "members"}
                      {o.published_count > 0 && ` · ${o.published_count} published`}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <a href={url} target="_blank" rel="noopener">
                      Visit →
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-12 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">
            Ongoing artist efforts
          </h2>
          <Link
            href="/artists"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Browse all artists →
          </Link>
        </div>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The community feed is quiet right now. As artists publish posts,
            meetings, and workshops, they&apos;ll appear here.
          </p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6 pb-4">
            <div className="flex gap-4">
              {feed.map((item) => (
                <article
                  key={item.id}
                  className="flex h-full min-h-[160px] w-[280px] shrink-0 flex-col justify-between rounded-lg border border-border bg-card p-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <span>{item.kind}</span>
                      <span>·</span>
                      <a
                        href={orgHomeUrl(homes, item.orgSlug)}
                        target="_blank"
                        rel="noopener"
                        className="text-foreground hover:underline"
                      >
                        {item.orgName}
                      </a>
                    </div>
                    <h3 className="font-serif text-base leading-snug">
                      {item.title}
                    </h3>
                    {item.excerpt && (
                      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {item.excerpt}
                      </p>
                    )}
                  </div>
                  {(item.scheduledAt || item.publishedAt) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {new Date(
                        item.scheduledAt ?? item.publishedAt ?? ""
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-foreground">
            The network, at a glance
          </h2>
          <span className="text-xs text-muted-foreground">
            {roster.length} members
          </span>
        </div>
        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members listed yet.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((m) => (
              <li
                key={m.user_id}
                className="flex flex-col rounded-lg border border-border bg-card p-5"
              >
                <h3 className="font-serif text-xl leading-tight">
                  {m.display_name}
                </h3>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {m.city}
                </p>
                {m.bio && (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {m.bio}
                  </p>
                )}
                <div className="mt-4 pt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={orgHomeUrl(homes, m.slug)}>Visit site</a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
