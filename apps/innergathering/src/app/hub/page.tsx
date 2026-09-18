import type { Metadata } from "next";
import {
  getOrgChatIdentity,
  getOrgChatRoom,
  getProfile,
  listOrgChatMessages,
  listOrgDocuments,
  listOrgMediaLibrary,
  getStandingMeeting,
  getViewerAlerts,
  listOrgEventsInRange,
  getMeetingRota,
  getOrgChatNextcloudUrl,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { ChatCard, ProvisionChat } from "@elkdonis/chat";
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import {
  CalendarFace,
  DocumentsFace,
  GalleryFace,
  PipelineFace,
  ProfileFace,
  StandingMeetingFace,
  KindTilesFace,
} from "@elkdonis/cms-ui/hub";
import { EmailFace } from "@elkdonis/cms-ui/email";
import { WhiteboardFace } from "@elkdonis/cms-ui/whiteboard";
import { requireOrgMember } from "@/lib/auth";
import { loadEmailSuite } from "@/lib/email-suite";
import { siteConfig } from "@/config/site";
import { getPipelineBoard } from "@/lib/pipeline";
import { getForumSnapshot } from "@/lib/forum";

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

  const calendarFrom = startOfMonth(new Date());
  const [profile, chatRoom, events, standing, board, documents, media, alerts, email, forum] =
    await Promise.all([
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
    // The documents face draws the current document's first LINES, so one
    // snippet is read back from Nextcloud; the rest of the list is the index
    // in site_config and costs nothing.
    listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }).catch(() => []),
    // Editors only, matching /api/media/library: listing the library reveals
    // filenames of unpublished material.
    viewer.canEdit
      ? listOrgMediaLibrary(siteConfig.orgId)
          .then((items) => items.map((i) => ({ url: i.url, name: i.filename })))
          .catch(() => [])
      : [],
    // Unread messages, unread notifications, and gatherings here this person
    // said they are coming to. Stated on the profile face, never linked —
    // no app serves an inbox route yet.
    getViewerAlerts(viewer.userId, siteConfig.orgId),
    // The email face draws real correspondence, so it needs the suite's data.
    // Editors only — the face's own controls send in the org's name, and a
    // member seeing a tile that refuses them is worse than seeing no tile.
    // A failure costs the tile, not the hub.
    viewer.canEdit ? loadEmailSuite().catch(() => null) : null,
    // The board, as one snapshot. Counts are per viewer, because visibility
    // is. A forum outage costs the tile, not the hub.
    getForumSnapshot().catch(() => null),
  ]);

  // Who is hosting the occurrence the card will show. Read AFTER `standing`
  // because it is the standing meeting's own next occurrence we need the host
  // for — a second query, but a tiny one keyed on a thread id, and the
  // alternative is a face that fetches on mount.
  const rota = standing
    ? await getMeetingRota(standing.event.id, { from: standing.at, count: 1 }).catch(() => null)
    : null;
  const nextHost = rota?.occurrences[0]?.host ?? null;

  // The door to the real room. The card's transcript is a mirror read over the
  // service account; voice, video and files only exist in Talk itself.
  const chatRoomUrl = chatRoom
    ? await getOrgChatNextcloudUrl(siteConfig.orgId).catch(() => null)
    : null;

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

  // What this site actually has. The catalogue's words live in cms-ui; which
  // of them are real is a fact about this host. Gallery, compose, profile and
  // documents are live FACES now rather than catalogue entries, so they are no
  // longer named here.
  //
  // No ideas face: this app serves no /forum route, and the ideas tile's whole
  // navigation target is the ideas feed on the board. A face that posts into a
  // feed nobody can open is worse than no face.
  const firstName =
    (profile?.displayName?.trim() || viewer.email).split(/[\s@]/)[0] || "there";

  return (
    <main className="hub">
      {/* The surface provider is mounted once in the root layout. */}
      <div className="hub-welcome">
        <div>
          <p className="hub-kicker">{siteConfig.orgName}</p>
          {/* Greet the person, not the category. */}
          <h1>Welcome back, {firstName}.</h1>
          <p className="hub-welcome-sub">
            Here is what the group has on, and what you can add to it.
          </p>
        </div>
      </div>

      {/*
        Three bands, not one grid of equals — the same arrangement IFAC's hub
        settled on, from the same stylesheet.

        One auto-fill grid gave a member arriving no reading order: the
        gathering that is the point of the group sat the same size as the
        pipeline board. The bands give one — what is happening, what you can
        make, and your own place in it — with the chat and the errands under
        them. This is an arrangement, not a second component: each band is
        still the shared face grid.
      */}
      <section className="hub-band" aria-labelledby="band-week">
        <div className="hub-band-head">
          <h2 id="band-week">This week</h2>
          <p>What the group has on, and when it is next together.</p>
        </div>
        {/* The gathering leads and the other two share the rest, which is what
            makes it read as the lead rather than the first of three equals.
            Three children, not two: the lead grid is 1.35fr + 1fr + 1fr, so a
            band of two left the right third of the row empty. The board earns
            the third slot — what is in progress is as much "this week" as what
            is scheduled. */}
        <SurfaceCardGrid className="hub-band-grid hub-band-grid--lead">
          {/* `rota` is opt-in on this face: it adds "Hosted by …" to the card
              and a "Plan ahead" tool that opens the whole run. Passing it is
              what turns one repeated event into a rota five people share. */}
          <StandingMeetingFace
            standing={standing}
            canEdit={viewer.canEdit}
            timeZone={TIME_ZONE}
            rota={{
              host: nextHost?.displayName
                ? { name: nextHost.displayName, userId: nextHost.userId }
                : null,
              canPlan: viewer.canEdit,
            }}
          />
          <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />
          {/* Where it is being discussed. Sections open INSIDE the popup as a
              pushed layer, so the back control is the masthead's own. */}
          {forum ? (
            <ForumFace forum={forum} />
          ) : (
            <PipelineFace board={board} canEdit={viewer.canEdit} />
          )}
        </SurfaceCardGrid>
      </section>

      <section className="hub-band" aria-labelledby="band-make">
        <div className="hub-band-head">
          <h2 id="band-make">Make something</h2>
          <p>
            Everything here belongs to the group and shows on the site. Dated
            items also reach the calendar.
          </p>
        </div>
        <SurfaceCardGrid className="hub-band-grid">
          {/* Publish — a plain face over the catalogue.

              Not the tile-bearing ComposeFace: a grid of kinds inside a tile
              is the picker drawn twice, and the popup already draws it
              properly, at a readable size, with each kind's accent. The
              face's job is to be the door. What each kind does once chosen is
              per-kind — short things stay in the popup, long ones open
              /hub/compose — and that lives in the catalogue, not here. */}
          {viewer.canEdit && (
            <SurfaceCard
              kind="compose"
              glyph="✚"
              kicker={null}
              title="Publish"
              blurb="Writing, gatherings, questions for the group — everything this site puts out."
              surface={{ type: "compose" }}
              ariaLabel="Choose what to publish"
            />
          )}
          {forum && <PipelineFace board={board} canEdit={viewer.canEdit} />}
          <DocumentsFace documents={documents} />
          {viewer.canEdit && <GalleryFace images={media} />}
          {/* The shared canvas. Any member may draw — see the route. It opens
              at full width; a toolbar down one side gives nothing back at
              tile-and-a-half. */}
          <WhiteboardFace blurb="A shared canvas. Sketch a plan, a diagram, an idea." />

          {/* Group research. Three doors, two of them real — the third is
              declared rather than hidden, because "what can we ask the group"
              is easier to understand whole, and a gap you can see beats a door
              that opens onto nothing. Both live ones open the PAGE: a set of
              questions is a long form, and a backdrop click should not cost
              you ten of them. */}
          {viewer.canEdit && (
            <KindTilesFace
              kind="questionnaire"
              title="Group research"
              blurb="Put something to the group, and read what comes back."
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
                  kind: "meeting",
                  glyph: "◷",
                  label: "Arrange a time",
                  note: "Find when everyone is free",
                },
              ]}
            />
          )}
          {/* Email, as a LIVE face rather than a door: what went out, what came
              back, and what is waiting for an answer. Editors only — the face's
              own controls send in the org's name. */}
          {viewer.canEdit && email && <EmailFace data={email} canEdit={viewer.canEdit} />}
        </SurfaceCardGrid>
      </section>

      <section className="hub-band" aria-labelledby="band-you">
        <div className="hub-band-head">
          <h2 id="band-you">Your place here</h2>
          <p>How you appear to the rest of the group.</p>
        </div>
        <SurfaceCardGrid className="hub-band-grid">
          {/* Identity, opened in place. The tile this replaces linked out to
              ArtDirect: click your own name on your own org's hub and you were
              on a different site with no way back but the browser's button. */}
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

      {/* General chat, under the bands rather than above them: a chat nobody
          asked for sitting between the welcome and every tile pushes the tiles
          below the fold. Members post under their OWN names without holding
          Nextcloud accounts — each gets a Talk guest session. */}
      <section className="hub-band hub-band--chat" aria-labelledby="band-chat">
        <div className="hub-band-head">
          <h2 id="band-chat">General chat</h2>
          <p>Everyone here. Say hello, ask the room, share what you found.</p>
        </div>
        {/* Deliberately short. At 30rem this was the largest thing on the page
            and mostly empty transcript; the hub is not a chat client. Two ways
            out of it: expand to the full page, or open the real room in Talk,
            where the voice, video and files actually are. */}
        {chatRoom ? (
          <ChatCard
            messages={chatMessages}
            canPost={viewer.isMember}
            identity={chatIdentity}
            title="General Chat"
            expandedHref="/hub/chat"
            nextcloudUrl={chatRoomUrl}
            heightClass="h-[19rem]"
          />
        ) : (
          <div className="hub-talk-frame">
            <ProvisionChat canProvision={viewer.canEdit} />
          </div>
        )}
      </section>

      {/* The quiet end of the page. Running the site was a full-width tile as
          large as the gathering, carrying one line. It is an errand, not a
          feature: it belongs after the work, at the size of a link. */}
      <section className="hub-band hub-band--errands" aria-labelledby="band-errands">
        <div className="hub-band-head">
          <h2 id="band-errands">Running things</h2>
        </div>
        <div className="hub-errands">
          {viewer.canEdit && (
            <a className="hub-errand" href="/manage">
              <span className="hub-errand-glyph" aria-hidden>
                &#9672;
              </span>
              <span>
                <strong>Manage the site</strong>
                <em>People &amp; access &middot; content &middot; site copy</em>
              </span>
            </a>
          )}
          <a className="hub-errand" href="/forum">
            <span className="hub-errand-glyph" aria-hidden>
              &#9776;
            </span>
            <span>
              <strong>The forum</strong>
              <em>Every board, in full</em>
            </span>
          </a>
          <a className="hub-errand" href="/hub/calendar">
            <span className="hub-errand-glyph" aria-hidden>
              &#9635;
            </span>
            <span>
              <strong>The calendar, in full</strong>
              <em>Every gathering, month by month</em>
            </span>
          </a>
          {viewer.canEdit && (
            <a className="hub-errand" href="/hub/email">
              <span className="hub-errand-glyph" aria-hidden>
                &#9993;
              </span>
              <span>
                <strong>Email &amp; newsletter</strong>
                <em>Letters, addresses and what has been sent</em>
              </span>
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
