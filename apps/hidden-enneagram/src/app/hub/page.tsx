import { HubCardGrid, HubLinkCard } from "@elkdonis/cms-ui/hubsite";

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { canViewFeed, listOrgFeeds } from "@elkdonis/services";
import { applyManifestBindings } from "@elkdonis/cms-bindings";
import { getOrgBySlug, renderSilexHtmlWithEmbeds } from "@elkdonis/silex-render";
import { sanitizeSilexHtml } from "@elkdonis/utils";
import { hubTemplateHtml, hubTemplateSections } from "@/lib/hub-template";
import { listOrdersForCustomer } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import { PublishCard } from "@/components/publish/publish-door";
import { Badge } from "@/components/ui/badge";
import { getThreadsForFeed } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { getForumSnapshot } from "@/lib/forum";
import { courseUrl, siteConfig } from "@/config/site";

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
 *
 * The top of the page is the Silex HUB TEMPLATE
 * (packages/silex-nextcloud-connector/src/templates/hub), rendered through the
 * same pipeline a published org site goes through: bind the declared traits,
 * sanitize, then swap <eac-embed> markers for live React. So the masthead, the
 * tile grid and the two live slots are all editable in Silex by whoever owns
 * this org, and what they see in the editor is what this page renders.
 *
 * Everything below the template — the member-only feeds and this person's
 * bookings — stays in React, because neither can be expressed as a static
 * template: one is gated per feed role, the other is per-viewer.
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
  const hub = await renderHubTemplate(viewer.email);

  return (
    <>
      {/* The template's stylesheet: tokens, the spotlight-grid pen, then the
          hub's own layout — one file, the same one the Silex editor loads. */}
      <link rel="stylesheet" href="/api/silex/templates/hub.css" />
      {hub}
      <main className="mx-auto w-[min(1040px,calc(100%-48px))] pt-2 pb-16 font-sans">
        {/* One grid (round 4 tidy, 2026-11-07): Publish (editors), the forum, readings and
            bookings, then the rooms. Members see the forum, readings, Center and the course. */}
        <HubCardGrid label="What to do here">
          {viewer.canEdit ? <PublishCard /> : null}
          <ForumFace forum={forum} />
          <HubLinkCard
            href={myOrders.length > 0 ? "#bookings" : "/readings"}
            glyph="◇"
            title="Readings & bookings"
            blurb={
              myOrders.length > 0
                ? `${myOrders.length} booked. Yours are listed below.`
                : "Book a reading or a counselling session."
            }
          />
          <HubLinkCard href="/center" glyph="◌" title="Center" blurb="Your home on the network: who you follow, what is coming up." />
          {viewer.canEdit ? <HubLinkCard href="/channel" glyph="◉" title="Channel" blurb="Post writing and sessions to Facebook, Instagram and Threads, and see where each went." /> : null}
          {viewer.canEdit ? <HubLinkCard href="/manage" glyph="◧" title="Manage" blurb="Content, orders, contacts, the newsletter, pages and the site's look." /> : null}
          {viewer.canEdit ? <HubLinkCard href="/studio" glyph="▦" title="Page editor" blurb="Arrange blocks to build the home page, The Figure and new pages." /> : null}
          <HubLinkCard href={courseUrl()} glyph="Ⅶ" title="Enneagram Foundations" blurb="The free course on Sophia: seven modules, short steps, private reflections." />
        </HubCardGrid>

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

        <section id="bookings" className="mt-16 scroll-mt-24 border-t border-border pt-12">
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

/**
 * The hub template, rendered with its live slots resolved.
 *
 * Fails soft to null: a hub that arrives without its masthead is worse than
 * one without its tiles, and everything below this in the page is independent
 * of it. The template is bound BEFORE it is sanitized, which is the order the
 * rest of the pipeline uses — a binding writes real values into the document,
 * so those values have to pass through DOMPurify too.
 */
async function renderHubTemplate(email: string) {
  const html = hubTemplateHtml();
  if (!html) return null;

  const org = await getOrgBySlug(siteConfig.orgId).catch(() => null);
  if (!org) return null;

  try {
    const bound = applyManifestBindings(html, hubTemplateSections(), {
      hub: {
        org_name: siteConfig.orgName,
        whoami: `Signed in as ${email}`,
        all_url: "/",
      },
    });
    return await renderSilexHtmlWithEmbeds(sanitizeSilexHtml(bound), org);
  } catch (error) {
    console.error("[hidden-enneagram] hub template render:", error);
    return null;
  }
}
