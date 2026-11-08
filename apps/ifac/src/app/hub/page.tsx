import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getMeetingAttendance,
  getOrgChatIdentity,
  getOrgChatRoom,
  getStandingMeeting,
  getViewerAlerts,
  listOrgChatMessages,
  listOrgDocuments,
  listOrgEventsInRange,
  listOrgFiles,
  listOrgIdeas,
  resolveMeetingLight,
} from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { getProfileSummary } from "@/lib/hub-data";
import { getPresentedSeries } from "@/lib/series";
import { getHubViewer } from "@/lib/hub-auth";
import { getForumSnapshot } from "@/lib/forum";
import { getPipelineBoard } from "@/lib/pipeline";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import { HubViewToggle, HUB_VIEW_COOKIE } from "@elkdonis/cms-ui/hubsite";
import "./hub-cards.css";
import { HubSiteView } from "./site-view";
import { HubCardsView } from "./cards-view";
import { HUB_VIEWS, DEFAULT_HUB_VIEW } from "./views";
import {
  CalendarFace,
  DocumentsFace,
  IdeasFace,
  PipelineFace,
  ProfileFace,
  SeriesFace,
  StandingMeetingFace,
} from "@elkdonis/cms-ui/hub";
import { HubDrawer } from "@/components/hub/HubDrawer";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { membersServer } from "@elkdonis/hub/server/members";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { MembersCardMount, ReviewCardMount } from "@/components/hub/hub-card-host";
import { loadReviewQueue } from "@elkdonis/hub/server/review";
import { KindTilesFace } from "@/components/hub/KindTilesFace";
import { HelpErrand } from "@/components/hub/HelpErrand";
import { FilesFace } from "@/components/hub/FilesCard";
import { getHubSkin } from "@/lib/hub-skin-store";

/**
 * The IFAC members' hub.
 *
 * The tiles were all stubs — deliberately, for a layout review. This is the
 * pass that wires them, and the shape it settles on is: every tile arrives
 * carrying real information, and clicking one opens the depth.
 *
 * That split is a load-time budget, not a style. All the reads happen here, in
 * parallel, server-side, and each returns only the handful of fields its tile
 * draws. Nothing fetches on mount. The panels behind the tiles fetch their own
 * fuller data when opened, so eight features cost one page's worth of queries
 * rather than eight — and a member who only wanted to check the meeting time
 * pays for nothing else.
 *
 * Access is members-and-up in the ifac org.
 */
export const dynamic = "force-dynamic";

/** This org's zone, for the faces that render a time. */
const TIME_ZONE = "America/Toronto";

/**
 * Where the Publish card goes: the /hub/compose page, or the compose popup.
 * "page" since 2026-10-10 (owner: pages by default, popups kept).
 */
const PUBLISH_OPENS: "page" | "popup" = "page";

export default async function HubPage({
  searchParams,
}: {
  searchParams?: Promise<{ payouts?: string }>;
}) {
  const viewer = await getHubViewer();
  if (!viewer) {
    // Two different failures, two different destinations: not signed in at all
    // versus signed in but not an IFAC member.
    const { getServerSession } = await import("@elkdonis/auth-server");
    const session = await getServerSession();
    redirect(session.user ? "/?notice=members-only" : "/login?next=/hub");
  }

  // Stripe returns a seller here with ?payouts=done. Asking Stripe then and
  // there is what stamps them payable; the account.updated webhook says the
  // same, but nobody who has just finished the form should have to wait for
  // it. Before the Connect endpoint existed (2026-09-20) it never arrived at
  // all, and two payable accounts sat unstamped for two days.
  if ((await searchParams)?.payouts === "done") {
    const { refreshStripeAccountStatus } = await import("@elkdonis/checkout/stripe");
    await refreshStripeAccountStatus(viewer.userId).catch(() => null);
  }

  // The page layout, read before the batch below so the card hub's dozen
  // reads never happen for someone who won't see them. Cards 2 is the default
  // (developer, 2026-10-18; "Cards" was the default from 2026-10-10 and Page
  // before that); a browser that pressed "Cards" or "Page" keeps its choice.
  const chosenView = (await cookies()).get(HUB_VIEW_COOKIE)?.value ?? DEFAULT_HUB_VIEW;
  // "Cards 2" (2026-10-10, after innergathering's): cards that open pages.
  if (chosenView === "cards2") {
    const siteContent = await getSiteContent();
    return (
      <div className="site-shell">
        <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
        <SiteHeader />
        <HubCardsView viewer={viewer} />
        <SiteFooter content={siteContent.footer} />
      </div>
    );
  }
  if (chosenView === "site") {
    const siteContent = await getSiteContent();
    return (
      <div className="site-shell">
        <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
        <SiteHeader />
        <main className="hub">
          <HubSiteView viewer={viewer} />
        </main>
        <SiteFooter content={siteContent.footer} />
      </div>
    );
  }

  const content = await getSiteContent();

  // Everything the tiles draw, in one parallel batch. Sequential awaits here
  // would make the hub as slow as the sum of its tiles.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1
  );

  const [
    standing,
    events,
    ideas,
    documents,
    files,
    profile,
    forum,
    board,
    alerts,
    chatRoom,
    journey,
  ] = await Promise.all([
    // The shared resolver, replacing this app's own getWeeklyMeeting: an
    // editor's flag first, then a weekly series, then whatever is soonest —
    // and it reports WHICH, so the tile only says "Weekly meeting" when that
    // is true. IFAC's query could only ever guess from the section name.
    getStandingMeeting(siteConfig.orgId, viewer).catch(() => null),
    // The shared query, not this app's own copy of it — see the note in
    // api/hub/calendar/route.ts.
    listOrgEventsInRange(siteConfig.orgId, monthStart, monthEnd, 200, viewer),
    listOrgIdeas(siteConfig.orgId, { limit: 12 }),
    // One snippet read back from Nextcloud, for the face's snapshot of the
    // current document. Entries created before the move carry no path and so
    // get no snippet — the title still shows.
    listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }),
    listOrgFiles(siteConfig.orgId, "Media").catch(() => []),
    getProfileSummary(viewer.userId),
    // A forum outage costs the tile, not the hub.
    getForumSnapshot().catch(() => null),
    // Likewise a Deck outage.
    getPipelineBoard().catch(() => null),
    // Unread messages, unread notifications, upcoming RSVPs — the same
    // subqueries getProfileSummary ran inline until this consolidated onto
    // the shared query every other host already uses. Never throws on its
    // own (reports zeroes on a failed read), so no .catch needed here.
    getViewerAlerts(viewer.userId, siteConfig.orgId),
    // Whether IFAC has a Talk room at all. Null is the ordinary first state,
    // not a failure — the announcements panel then offers to create one.
    getOrgChatRoom(siteConfig.orgId).catch(() => null),
    // The auction journey, for the card below (Center redesign, 2026-10-18).
    import("@elkdonis/commerce/server").then((m) => m.loadAuctionJourney(viewer.userId)).catch(() => null),
  ]);

  // Is it happening, and what has this member already said?
  //
  // These cannot join the batch above: both are keyed on `standing.event.id`,
  // which that batch is what produces. Two indexed single-row lookups, and
  // only paid for when there is a gathering to say anything about.
  // The series IFAC presents to the public (site_config `presented_series`):
  // its coming weeks for the Series face.
  const series = await getPresentedSeries({ count: 6 });

  // Owners and guides get the Members card; it decides everything else from `can`.
  const cardViewer = viewer.canEdit ? await getHubCardViewer() : null;
  const reviewFace = cardViewer ? await loadReviewQueue(hubSite, cardViewer, { storePanels: true }).catch((err) => {
    console.error("[hub] review card:", err);
    return null;
  }) : null;
  const membersFace = cardViewer ? await membersServer.load(hubSite, cardViewer).catch((err) => {
    console.error("[hub] members card:", err);
    return null;
  }) : null;

  const [meetingLight, meetingAnswer] = standing
    ? await Promise.all([
        resolveMeetingLight(standing.event.id, { occurrence: standing.at }),
        getMeetingAttendance(standing.event.id, viewer.userId),
      ])
    : [null, null];

  // The transcript, only once we know there is a room to read. Two awaits
  // rather than one because both of these need its token.
  const [chatMessages, chatIdentity] = chatRoom
    ? await Promise.all([
        listOrgChatMessages(siteConfig.orgId, viewer.userId, { limit: 20 }),
        getOrgChatIdentity(
          siteConfig.orgId,
          viewer.userId,
          profile?.displayName?.trim() || viewer.email
        ),
      ])
    : [[], undefined];

  // The layout reads this too, for the `data-hub-skin` attribute. Read again
  // rather than threaded through `children`, which a layout cannot do: one
  // indexed single-row lookup against a value the page has to show anyway.
  const skin = await getHubSkin(siteConfig.orgId);


  // The last thing a person said in the room (not Talk's join/leave notices),
  // for the General chat card.
  const lastSaid = [...chatMessages].reverse().find((m) => !m.isSystem) ?? null;

  const displayName = profile?.displayName ?? viewer.email.split("@")[0];
  // Just the given name for the greeting. A display name may be a full name,
  // a studio name or an email stub; the first word of it is the friendliest
  // thing that is true in all three cases.
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;

  return (
    <div className="site-shell">
      {/* Site defaults, then this page's overrides, then the viewer's own. */}
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      {/* No banner here. The hub is a working page, not a front page, and the
          hero image pushed every tile below the fold — the same reason about,
          artists and gallery pass nothing. Restore it by handing SiteHeader
          `banner={{ imageUrl: content.hero.imageUrl, className: "hub-hero" }}`
          again; .hub-hero is still in globals.css. */}
      <SiteHeader />

      <main className="hub">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            {/* The member's own name, not "Welcome IFAC Members to the Main
                Hub". A hub for a collective of artists and dealers should
                greet a person; the old line greeted a category, and then
                spent its second sentence listing the tiles directly beneath
                it — which the bands now name for themselves. */}
            <h1>Welcome back, {firstName}.</h1>
            <p className="hub-welcome-sub">
              Here is what the collective has on, and what you can add to it.
            </p>
          </div>
          <div className="hub-welcome-tools">
            <HubViewToggle current="classic" views={HUB_VIEWS} />
            <HubDrawer displayName={displayName} profileHref="/center" />
          </div>
        </div>

        {/*
          Three bands, not one grid of thirteen.

          Every tile used to carry the same weight in one auto-fill grid, so
          the gathering that is the point of the group sat the same size as
          "Help & notes from the developer", and a member arriving had no
          reading order to follow. The bands give one: what is happening, what
          you can make, and your own place in it. Each is still the same face
          grid — this is an arrangement, not a second component.

          Every tile arrives carrying real information and clicking one opens
          the depth. That split is a load-time budget, not a style: all the
          reads happen above, in parallel, and each returns only the handful of
          fields its tile draws.
        */}

        {/*
          The cards layout, arranged (developer, 2026-10-18):

            row 1   Publish · My profile · Series
            row 2   Calendar · Manage the site · Whiteboard · General chat
            row 3   Files · Forum
            then    Working together (documents, the board, group research;
                    Suggested ideas is left out for now)
            then    the standing meeting and the auction, which the list did
                    not place, kept here rather than dropped

          Every tile still arrives carrying real information and clicking one
          opens the depth; all the reads happen above, in parallel.
        */}

        <section className="hub-band" aria-label="Your hub">
          <SurfaceCardGrid className="hub-band-grid ifac-three-grid">
            <SurfaceCard
              kind="compose"
              glyph="✚"
              kicker={null}
              title="Publish"
              blurb="Writing, gatherings, work for sale — everything the group puts out."
              {...(PUBLISH_OPENS === "page"
                ? { href: "/hub/compose" }
                : { surface: { type: "compose" as const } })}
              ariaLabel="Choose what to publish"
            />
            <ProfileFace
              centerHref="/center"
              summary={{
                displayName: displayName,
                avatarUrl: profile?.avatarUrl ?? null,
                headline: profile?.roleTitle ?? profile?.headline ?? null,
                alerts,
              }}
            />
            <SeriesFace
              series={
                series
                  ? {
                      id: series.id,
                      slug: series.slug,
                      title: series.title,
                      href: `/series/${series.slug}`,
                      weeks: series.sessions.map((s) => ({
                        at: s.at,
                        number: s.number,
                        title: s.title,
                        hostName: s.host?.displayName ?? null,
                        rsvpCount: s.rsvpCount,
                        isNext: s.isNext,
                      })),
                    }
                  : null
              }
              canPlan={viewer.canEdit}
              timeZone={series?.timeZone ?? TIME_ZONE}
              plannerHref={series ? `/hub/series/${series.id}` : null}
            />
          </SurfaceCardGrid>

          <SurfaceCardGrid className="hub-band-grid ifac-four-grid">
            <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />
            {/* The shared Members hub card (pilot, docs/open/hub-cards-handoff/PLAN.md). */}
            {membersFace && <MembersCardMount data={membersFace} />}
            {reviewFace && <ReviewCardMount data={reviewFace} />}
            {/* Running the site is an editor's errand; the card is theirs only. */}
            {viewer.canEdit && (
              <SurfaceCard
                kind="neutral"
                glyph="◈"
                title="Manage the site"
                blurb="Artists & dealers · people & access · site copy"
                href="/manage"
              />
            )}
            <SurfaceCard
              kind="neutral"
              glyph="✎"
              title="Whiteboard"
              blurb="A shared canvas. Sketch a hang, a floor plan, an idea."
              href="/hub/whiteboard"
            />
            {/* The room, as a card: the last thing said, and a door to the
                whole conversation (it was a full-width transcript at the
                foot of the page). */}
            <SurfaceCard
              kind="post"
              glyph="☰"
              kicker={null}
              title="General chat"
              blurb={
                chatRoom && lastSaid
                  ? `${lastSaid.authorName}: ${lastSaid.message.slice(0, 90)}`
                  : chatRoom
                    ? "Everyone in IFAC. Say hello."
                    : viewer.canEdit
                      ? "Start the room for everyone in IFAC."
                      : "Everyone in IFAC."
              }
              href="/hub/chat"
              ariaLabel="Open the general chat"
            />
          </SurfaceCardGrid>

          <SurfaceCardGrid className="hub-band-grid hub-band-grid--pair ifac-row-gap">
            <FilesFace initialFiles={files} canEdit={viewer.canEdit} />
            <ForumFace forum={forum} />
          </SurfaceCardGrid>
        </section>

        <section className="hub-band" aria-labelledby="band-together">
          <div className="hub-band-head">
            <h2 id="band-together">Working together</h2>
          </div>
          <SurfaceCardGrid className="hub-band-grid ifac-three-grid">
            <DocumentsFace documents={documents} />
            <PipelineFace board={board} canEdit={viewer.canEdit} />
            <KindTilesFace
              kind="questionnaire"
              title="Group research"
              blurb="Put something to the membership, and read what comes back."
              cardHref="/hub/research"
              tiles={[
                {
                  kind: "questionnaire",
                  glyph: "▤",
                  label: "Questionnaire",
                  href: "/hub/compose?kind=questionnaire",
                  note: "A set of questions",
                },
                {
                  kind: "poll",
                  glyph: "▥",
                  label: "Poll",
                  href: "/hub/compose?kind=poll",
                  note: "One question, a result bar",
                },
                {
                  // Declared but not built. Shown so the set reads as a whole
                  // — "what can we ask the group" has three answers, and one
                  // of them is coming.
                  kind: "meeting",
                  glyph: "◷",
                  label: "Arrange a time",
                  note: "Find when everyone is free",
                },
              ]}
            />
          </SurfaceCardGrid>
        </section>

        <section className="hub-band" aria-labelledby="band-also">
          <div className="hub-band-head">
            <h2 id="band-also">Also here</h2>
          </div>
          <SurfaceCardGrid className="hub-band-grid hub-band-grid--pair">
            <StandingMeetingFace
              standing={standing}
              canEdit={viewer.canEdit}
              timeZone={TIME_ZONE}
              // Plan ahead — who hosts each coming week, and what it covers.
              // IFAC never passed this, so its card had no way into the rota.
              // Only for a gathering that repeats: a one-off has nothing ahead.
              rota={
                standing?.event.recurrencePattern
                  ? { host: null, canPlan: viewer.canEdit }
                  : undefined
              }
              attendance={{ answered: meetingAnswer }}
              light={meetingLight ?? undefined}
              history={{}}
            />
            <SurfaceCard
              kind="product"
              kicker="Art Auction · November"
              title="Sell your work in the Art Auction"
              blurb="Three steps: publish, show your store, set up payout."
              surface={{ type: "journey", id: "auction" }}
              href="/center?journey=auction"
              className="eac-auction-face"
              preview={(() => {
                const done = journey
                  ? [journey.artworks.published > 0, journey.store.state === "active", journey.payouts.state === "ready"]
                  : [false, false, false];
                const n = done.filter(Boolean).length;
                return (
                  <div className="eac-auction-face-progress">
                    <span className="eac-auction-face-bar" aria-label={`${n} of 3 steps done`}>
                      {done.map((d, i) => (
                        <span key={i} data-done={d || undefined} />
                      ))}
                    </span>
                    <span>{n} of 3</span>
                    <span className="eac-auction-face-go">Take part →</span>
                  </div>
                );
              })()}
            />
          </SurfaceCardGrid>
          <div className="hub-errands">
            <HelpErrand />
          </div>
        </section>

      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}
