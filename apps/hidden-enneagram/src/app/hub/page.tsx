import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { canViewFeed, listOrgFeeds } from "@elkdonis/services";
import { listOrdersForCustomer } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { getThreadsForFeed } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { getForumSnapshot } from "@/lib/forum";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Members",
  // A members area has no business in search results.
  robots: { index: false, follow: false },
};

/**
 * The members area — this org's equivalent of arts-collective's /hub.
 *
 * Signed-out visitors are sent to login with a return path rather than 404'd:
 * unlike a locked feed, the existence of a members area is not itself a
 * secret, and bouncing someone to a dead end when the fix is "sign in" is
 * hostile.
 *
 * Everyone who signs up here is made a member of this org by the signup route,
 * so membership is self-serve today. If that ever needs to be an invitation,
 * the gate is org role and this page needs no change.
 */
export default async function HubPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/hub")}`);

  const feeds = await listOrgFeeds(siteConfig.orgId).catch(() => []);
  const memberFeeds = feeds.filter(
    (feed) => feed.minRole && canViewFeed(feed, viewer.role)
  );

  const [feedContents, orders, forum] = await Promise.all([
    Promise.all(
      memberFeeds.map(async (feed) => ({
        feed,
        threads: await getThreadsForFeed(feed.slug, { isMember: true, limit: 6 }),
      }))
    ),
    listOrdersForCustomer(viewer.userId, { limit: 20 }).catch(() => []),
    // The same snapshot /api/hub/forum returns, so the tile and the popup it
    // opens agree. A forum outage costs the tile, not the page.
    getForumSnapshot().catch(() => null),
  ]);

  const myOrders = orders.filter((o) => o.metadata?.orgId === siteConfig.orgId);

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[880px] px-6 py-16 font-sans">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Signed in as {viewer.email}
        </p>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-[1.05]">Members</h1>
        <p className="mt-4 max-w-[560px] text-lg text-muted-foreground">
          Working material, and the sessions you&rsquo;ve booked.
        </p>

        {/* Editors compose from here rather than going to /manage: the same
            surface a card opens, in compose mode. Omitted entirely for
            members — a door onto a form they cannot submit is worse than no
            door, which is the "Soon" card pattern the catalogue replaced. */}
        <SurfaceCardGrid className="mt-10">
          {viewer.canEdit && (
            <SurfaceCard
              title="Write something"
              blurb="A piece of writing, or an offering people can book."
              glyph="✎"
              kicker="Compose"
              surface={{ type: "compose" }}
            />
          )}
          <ForumFace forum={forum} />
        </SurfaceCardGrid>

        {memberFeeds.length === 0 ? (
          <p className="mt-14 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nothing has been shared with members yet.
          </p>
        ) : (
          feedContents.map(({ feed, threads }) => (
            <section key={feed.slug} className="mt-14">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 font-serif text-2xl font-medium">
                  <Lock className="size-4 text-muted-foreground" aria-hidden />
                  {feed.name}
                </h2>
                <Link
                  href={`/${feed.slug}`}
                  className="text-xs uppercase tracking-[0.2em] text-primary no-underline"
                >
                  All →
                </Link>
              </div>
              {feed.tagline && (
                <p className="mt-1 text-sm text-muted-foreground">{feed.tagline}</p>
              )}

              {threads.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <SurfaceCardGrid className="mt-6">
                  {threads.map((thread) => (
                    <SurfaceCard
                      key={thread.id}
                      title={thread.title}
                      blurb={thread.excerpt ?? undefined}
                      kind={thread.kind}
                      kicker={new Date(
                        thread.publishedAt ?? thread.createdAt
                      ).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                      // The card carries what it already knows, so the surface
                      // paints before its fetch returns.
                      surface={{
                        type: "thread",
                        id: thread.id,
                        preview: {
                          title: thread.title,
                          kind: thread.kind,
                          coverImageUrl: thread.coverImageUrl,
                          feedName: feed.name,
                        },
                      }}
                    />
                  ))}
                </SurfaceCardGrid>
              )}
            </section>
          ))
        )}

        <section className="mt-16 border-t border-border pt-12">
          <h2 className="font-serif text-2xl font-medium">Your bookings</h2>
          {myOrders.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You haven&rsquo;t booked anything yet.{" "}
              <Link href="/services" className="text-primary underline underline-offset-4">
                See what&rsquo;s offered
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-6 grid gap-3">
              {myOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/services/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-4 no-underline transition-colors hover:border-primary/60"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {order.number}
                    </span>
                    <span>{formatMoney(order.totalMinor, order.currency)}</span>
                    <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                      {order.status === "paid" ? "paid" : "awaiting payment"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
