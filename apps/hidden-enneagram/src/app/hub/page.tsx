import "@elkdonis/cms-ui/hubsite.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { HubCardGrid, HubLinkCard } from "@elkdonis/cms-ui/hubsite";
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import {
  canViewFeed,
  getOrgDeckBoardId,
  getProfile,
  listOrgDocuments,
  listOrgEventsInRange,
  listOrgFeeds,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { listOrdersForCustomer } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { PublishCard } from "@/components/publish/publish-door";
import { getThreadsForFeed } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { getForumSnapshot } from "@/lib/forum";
import { courseUrl, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Hub",
  // A members area has no business in search results.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The hub (round 5, 2026-11-07): innergathering's "Cards 2" shape — a quiet
 * header and one grid of cards, each a door to its own page with a breadcrumb
 * back (or, for Publish and the forum, a popup).
 *
 * Who sees what:
 *   signed in (anyone, a follower included): Readings & bookings, the forum,
 *     Your page, the course;
 *   members (owner, guide, member — `viewer.isMember`): the group's tools,
 *     Chat, Calendar, Documents, Files, Whiteboard, Pipeline. Their pages and
 *     APIs gate on the same rule (requireOrgMember / getApiMember);
 *   editors (owner, guide): Publish, Channel, Manage, the page editor.
 *
 * Signed-out visitors go to login with a return path: the existence of a hub
 * is not a secret, and a dead end where the fix is "sign in" is hostile.
 *
 * Under the grid, two quiet sections rather than cards: the members' feeds
 * (Inner Work) and this person's bookings. They are content, not tools — what
 * is new and what you have booked — and neither has a page of its own to send
 * a card to, so a card would only be a link to a list that lives here anyway.
 * Each section is left out entirely when it has nothing in it.
 */
export default async function HubPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/hub")}`);

  const from = startOfMonth(new Date());
  const [profile, feeds, orders, forum, events, documents, boardId] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    listOrdersForCustomer(viewer.userId, { limit: 20 }).catch(() => []),
    // The same snapshot /api/hub/forum returns, so the card and the popup it
    // opens agree. A forum outage costs the card, not the page.
    getForumSnapshot().catch(() => null),
    // The tools' card lines. Members only, so a follower's hub reads nothing
    // it will not show.
    viewer.isMember
      ? listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1), 200, viewer).catch(() => [])
      : [],
    viewer.isMember ? listOrgDocuments(siteConfig.orgId).catch(() => []) : [],
    viewer.isMember ? getOrgDeckBoardId(siteConfig.orgId).catch(() => null) : null,
  ]);

  const memberFeeds = feeds.filter((feed) => feed.minRole && canViewFeed(feed, viewer.role));
  const feedContents = (
    await Promise.all(
      memberFeeds.map(async (feed) => ({
        feed,
        threads: await getThreadsForFeed(feed.slug, { isMember: true, limit: 3 }).catch(() => []),
      }))
    )
  ).filter(({ threads }) => threads.length > 0);
  const myOrders = orders.filter((o) => o.metadata?.orgId === siteConfig.orgId);

  const name = profile?.displayName?.trim() || viewer.email;
  const now = Date.now();
  const nextEvent = events
    .filter((e) => e.scheduledAt && new Date(e.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];
  const when = (d: Date | string) =>
    new Date(d).toLocaleString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: siteConfig.timeZone,
    });
  const notSetUp = viewer.canEdit ? "Not set up yet: open it to set it up." : "Not set up yet.";

  return (
    <main className="eac-hp he-hub">
      <header className="eac-hp-head">
        <div>
          <p className="eac-hs-kicker">{siteConfig.orgName}</p>
          <h1 className="eac-hp-title">Hub</h1>
          <p className="eac-hp-intro">Signed in as {name}.</p>
        </div>
      </header>

      <HubCardGrid label="Hub">
        {viewer.canEdit ? <PublishCard /> : null}
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
        <ForumFace forum={forum} />
        {viewer.isMember ? (
          <HubLinkCard href="/hub/chat" glyph="☏" title="Chat" blurb="The group's room: messages, in Nextcloud Talk." />
        ) : null}
        {viewer.isMember ? (
          <HubLinkCard
            href="/hub/calendar"
            glyph="▦"
            title="Calendar"
            blurb="Everything scheduled, month by month."
            meta={nextEvent ? `Next: ${nextEvent.title} · ${when(nextEvent.scheduledAt!)}` : undefined}
          />
        ) : null}
        {viewer.isMember ? (
          <HubLinkCard
            href="/hub/documents"
            glyph="▭"
            title="Documents"
            blurb="Write together in shared documents."
            meta={
              documents.length > 0
                ? `${documents.length} document${documents.length === 1 ? "" : "s"} · latest: ${documents[0].title}`
                : undefined
            }
          />
        ) : null}
        {viewer.isMember ? (
          <HubLinkCard href="/hub/files" glyph="▤" title="Files" blurb="The site's folder and your own." />
        ) : null}
        {viewer.isMember ? (
          <HubLinkCard href="/hub/whiteboard" glyph="✎" title="Whiteboard" blurb="A shared canvas. Sketch a plan, a diagram, an idea." />
        ) : null}
        {viewer.isMember ? (
          <HubLinkCard
            href="/hub/pipeline"
            glyph="▥"
            title="Pipeline"
            blurb="What is being worked on, as a board."
            meta={boardId === null ? notSetUp : undefined}
          />
        ) : null}
        <HubLinkCard href="/center" glyph="◌" title="Your page" blurb="Your home on the network: who you follow, what is coming up." />
        {viewer.canEdit ? (
          <HubLinkCard href="/channel" glyph="◉" title="Channel" blurb="Post writing and sessions to Facebook, Instagram and Threads." />
        ) : null}
        {viewer.canEdit ? (
          <HubLinkCard href="/manage" glyph="◧" title="Manage" blurb="Content, orders, contacts, the newsletter, pages and the site's look." />
        ) : null}
        {viewer.canEdit ? (
          <HubLinkCard href="/studio" glyph="▣" title="Page editor" blurb="Arrange blocks to build the home page, The Enneagram and new pages." />
        ) : null}
        <HubLinkCard href={courseUrl()} glyph="Ⅶ" title="Enneagram Foundations" blurb="The free course on Sophia." />
      </HubCardGrid>

      {feedContents.map(({ feed, threads }) => (
        <section key={feed.slug} className="eac-hp-section he-hub-section" aria-labelledby={`feed-${feed.slug}`}>
          <div className="he-hub-section-head">
            <h2 id={`feed-${feed.slug}`} className="eac-hp-section-title">
              {feed.name}
            </h2>
            <Link href={`/${feed.slug}`} className="he-hub-all">
              All →
            </Link>
          </div>
          {feed.tagline ? <p className="he-hub-note">{feed.tagline}</p> : null}
          <SurfaceCardGrid className="mt-5">
            {threads.map((thread) => (
              <SurfaceCard
                key={thread.id}
                title={thread.title}
                blurb={thread.excerpt ?? undefined}
                kind={thread.kind}
                kicker={new Date(thread.publishedAt ?? thread.createdAt).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                })}
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
        </section>
      ))}

      {myOrders.length > 0 ? (
        <section id="bookings" className="eac-hp-section he-hub-section" aria-labelledby="bookings-title">
          <h2 id="bookings-title" className="eac-hp-section-title">
            Your bookings
          </h2>
          <ul className="he-hub-orders">
            {myOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/services/orders/${order.id}`} className="he-hub-order">
                  <span className="he-hub-order-no">{order.number}</span>
                  <span>{formatMoney(order.totalMinor, order.currency)}</span>
                  <span className={`he-hub-order-state${order.status === "paid" ? " is-paid" : ""}`}>
                    {order.status === "paid" ? "paid" : "awaiting payment"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
