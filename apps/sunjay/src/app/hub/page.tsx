import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  getOrgChatIdentity,
  getOrgChatRoom,
  getProfile,
  listOrgChatMessages,
  listOrgDocuments,
  listOrgIdeas,
  listOrgMediaLibrary,
  getStandingMeeting,
  getViewerAlerts,
  listOrgEventsInRange,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { ChatCard, ProvisionChat } from "@elkdonis/chat";
import { ForumFace, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import {
  CalendarFace,
  ComposeFace,
  DocumentsFace,
  GalleryFace,
  IdeasFace,
  PipelineFace,
  ProfileFace,
  StandingMeetingFace,
} from "@elkdonis/cms-ui/hub";
import { HubViewToggle, HUB_VIEW_COOKIE } from "@elkdonis/cms-ui/hubsite";
import { HubSiteView } from "./site-view";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { getPipelineBoard } from "@/lib/pipeline";
import { getForumSnapshot } from "@/lib/forum";
import { getAllThreadsForOrg } from "@/lib/data";
import { EmailFace } from "@/components/hub/EmailFace";
// Lifted into the shared package when IFAC wanted the same canvas.
import { WhiteboardFace } from "@elkdonis/cms-ui/whiteboard";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

/** This org's zone. Was a bare literal inside StandingMeetingFace before the
 *  face was shared; it belongs to the site, not to the component. */
const TIME_ZONE = "America/Toronto";

/**
 * The members' hub: a grid of faces, each the tile-sized form of the popup it
 * opens. Every read the tiles need happens here, in parallel, server-side.
 * The popups fetch their own fuller record when opened, so a member who only
 * wanted the next gathering's time pays for nothing else.
 */
export default async function HubPage() {
  const viewer = await requireOrgMember("/hub");

  // Two layouts, one per person, remembered in a cookie the toggle sets.
  // This branch sits BEFORE the Promise.all below on purpose: the page layout
  // reads a different set of things, and doing the card hub's nine queries
  // first and then throwing them away would be paid on every request by
  // everyone who prefers this view.
  if ((await cookies()).get(HUB_VIEW_COOKIE)?.value === "site") {
    return <HubSiteView viewer={viewer} />;
  }

  const calendarFrom = startOfMonth(new Date());
  const [
    profile,
    chatRoom,
    events,
    standing,
    board,
    forum,
    documents,
    ideas,
    media,
    alerts,
    emailThreads,
  ] = await Promise.all([
    getProfile(viewer.userId),
    getOrgChatRoom(siteConfig.orgId),
    // The calendar face draws this month; it fetches later months itself.
    listOrgEventsInRange(siteConfig.orgId, calendarFrom, addMonths(calendarFrom, 1)),
    // Which gathering leads the hub — an editor's flag first, then a weekly
    // series, then whatever is soonest. See getStandingMeeting.
    getStandingMeeting(siteConfig.orgId),
    // Only the fields the tile draws come out of this; the surface loads the
    // full board when it opens. A Deck outage costs the tile, not the hub.
    getPipelineBoard().catch(() => null),
    // The same snapshot /api/hub/forum returns, so the tile and the popup it
    // opens agree. A forum outage costs the tile, not the hub.
    getForumSnapshot().catch(() => null),
    // The documents face draws the current document's first LINES, so one
    // snippet is read back from Nextcloud; the rest of the list is the index
    // in site_config and costs nothing.
    listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }).catch(() => []),
    listOrgIdeas(siteConfig.orgId, { limit: 10 }).catch(() => []),
    // Editors only, matching /api/media/library: listing the library reveals
    // filenames of unpublished material.
    viewer.canEdit
      ? listOrgMediaLibrary(siteConfig.orgId)
          // `filename` → `name`, the same rename `createHubConnectors.listMedia`
          // does on the client, so the face and the surface agree on the shape.
          .then((items) => items.map((i) => ({ url: i.url, name: i.filename })))
          .catch(() => [])
      : [],
    // Unread messages, unread notifications, and gatherings here this person
    // said they are coming to. Stated on the profile face, never linked —
    // no app serves an inbox route yet.
    getViewerAlerts(viewer.userId, siteConfig.orgId),
    // Editors only — the Email card can message any thread's attendees.
    viewer.canEdit
      ? getAllThreadsForOrg(50)
          .then((threads) => threads.filter((t) => t.kind !== "post"))
          .catch(() => [])
      : [],
  ]);

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

  // No `hubCards` here. Of the catalogue's entries, Files, Questionnaires and
  // Help are all unavailable on this site, and Manage is an errand in the last
  // band rather than a tile — a word-and-a-door card sitting among live faces
  // reads as something broken. apps/innergathering dropped them for the same
  // reason; apps/amrit-canada still renders them because its hub is one flat
  // grid with no errands row to put them in.

  return (
    /*
     * Five bands, not one flat grid.
     *
     * The band layout and its stylesheet are shared (@elkdonis/cms-ui/hub.css,
     * imported in globals.css) — this is the same hub IFAC and innergathering
     * draw, wearing this site's tokens. The sheet is token-driven, so nothing
     * here is themed locally beyond --eac-hub-rubric, pinned to the slate ink
     * in globals.css because the bronze accent is decorative and a band
     * heading has to be readable.
     *
     * One arithmetic rule that is easy to get wrong: `--lead` is
     * `1.35fr 1fr 1fr` and wants EXACTLY THREE children, or the right third of
     * the row is simply empty. Hence forum sitting in the week band.
     * `--pair` is auto-fit and stretches a lone card across the whole band, so
     * the single-card bands below use the plain grid instead.
     *
     * The surface provider is mounted once in the root layout.
     */
    <main className="hub">
      <header className="hub-welcome">
        <div>
          <p className="hub-kicker">{siteConfig.orgName}</p>
          <h1>Hub</h1>
          <p className="hub-welcome-sub">
            Everything opens in place. Pick a day to see what&rsquo;s on, or to add something to it.
          </p>
        </div>
        <HubViewToggle current="classic" />
      </header>

      {/* ── this week ───────────────────────────────────────────────────── */}
      <section className="hub-band" id="band-week">
        <div className="hub-band-head">
          <h2>This week</h2>
          <p>What is on, and when.</p>
        </div>
        <SurfaceCardGrid className="hub-band-grid hub-band-grid--lead">
          {/* The standing gathering: what a member opens the hub to check. */}
          <StandingMeetingFace standing={standing} canEdit={viewer.canEdit} timeZone={TIME_ZONE} />
          <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />
          <ForumFace forum={forum} />
        </SurfaceCardGrid>
      </section>

      {/* ── make something ──────────────────────────────────────────────── */}
      <section className="hub-band" id="band-make">
        <div className="hub-band-head">
          <h2>Make something</h2>
          <p>Write, draw, gather material, send word.</p>
        </div>
        <SurfaceCardGrid className="hub-band-grid">
          {viewer.canEdit && <ComposeFace />}

          {/* The face IS the form: type it, press Enter. Opening the tile
              goes to the ideas feed, where they are discussed. */}
          <IdeasFace initialIdeas={ideas} />

          <DocumentsFace documents={documents} />

          {/* Any MEMBER may draw, not just an editor: publishing is an
              organiser's act, sketching is not, and a scratch space most of
              the group can only look at is not one. */}
          <WhiteboardFace />

          <PipelineFace board={board} canEdit={viewer.canEdit} />

          {/* Editors only — the library lists unpublished material, which is
              why /api/media/library is editors-only too. */}
          {viewer.canEdit && <GalleryFace images={media} />}

          {viewer.canEdit && (
            <EmailFace
              threads={emailThreads.map((t) => ({
                id: t.id,
                title: t.title,
                scheduledAt: t.scheduledAt?.toISOString() ?? null,
                reminderMinutesBefore: t.reminderMinutesBefore,
              }))}
            />
          )}
        </SurfaceCardGrid>
      </section>

      {/* ── your place here ─────────────────────────────────────────────── */}
      <section className="hub-band" id="band-you">
        <div className="hub-band-head">
          <h2>Your place here</h2>
          <p>How you appear, and what is waiting for you.</p>
        </div>
        {/* Plain grid, NOT --pair: auto-fit would stretch this single card
            across the entire band. SurfaceCardGrid supplies `eac-face-grid`,
            which is what actually sets `display: grid` — `hub-band-grid` only
            sets the COLUMNS, so a bare <div> renders the band as one stacked
            column with the tracks declared and never used. */}
        <SurfaceCardGrid className="hub-band-grid">
          {/* Your identity, opened in place. The tile this replaces linked out
              to ArtDirect: click your own name on your own org's hub and you
              were on a different site with no way back but the browser's
              button. It is one `users` row and the profile surface already
              reads and writes it. */}
          <ProfileFace
            summary={{
              displayName: profile?.displayName?.trim() || viewer.email,
              avatarUrl: profile?.avatarUrl ?? null,
              headline: profile?.headline ?? null,
              alerts,
            }}
          />
        </SurfaceCardGrid>
      </section>

      {/* ── general chat ────────────────────────────────────────────────── */}
      <section className="hub-band" id="band-chat">
        <div className="hub-band-head">
          <h2>General chat</h2>
          <p>A mirror of the group&rsquo;s Talk room.</p>
        </div>
        {chatRoom ? (
          <ChatCard messages={chatMessages} canPost={viewer.isMember} identity={chatIdentity} />
        ) : (
          <ProvisionChat canProvision={viewer.canEdit} compact />
        )}
      </section>

      {/* ── running things ──────────────────────────────────────────────── */}
      <section className="hub-band hub-band--errands" id="band-errands">
        <div className="hub-band-head">
          <h2>Running things</h2>
          <p>The pages that are a page, not a popup.</p>
        </div>
        <div className="hub-errands">
          {viewer.canEdit && (
            <a className="hub-errand" href="/manage">
              <span className="hub-errand-title">Manage</span>
              <span className="hub-errand-note">Sections, content, people, site copy.</span>
            </a>
          )}
          <a className="hub-errand" href="/forum">
            <span className="hub-errand-title">Forum</span>
            <span className="hub-errand-note">The full board, wiki and dictionary.</span>
          </a>
          <a className="hub-errand" href="/hub/calendar">
            <span className="hub-errand-title">Calendar</span>
            <span className="hub-errand-note">The month at full size.</span>
          </a>
        </div>
      </section>
    </main>
  );
}
