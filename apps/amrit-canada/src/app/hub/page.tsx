import type { Metadata } from "next";
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
import { ForumFace, SurfaceCard, SurfaceCardGrid } from "@elkdonis/cms-ui/surface";
import {
  CalendarFace,
  ComposeFace,
  DocumentsFace,
  GalleryFace,
  IdeasFace,
  PipelineFace,
  ProfileFace,
  StandingMeetingFace,
  hubCards,
} from "@elkdonis/cms-ui/hub";
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

  // What this site actually has. The catalogue's words live in cms-ui; which
  // of them are real is a fact about this host. Gallery, compose, profile,
  // documents and ideas are live FACES now rather than catalogue entries, so
  // they are no longer named here — what is left is the tiles that genuinely
  // are a word and a door.
  const cards = hubCards({
    files: false,
    questionnaires: false,
    help: false,
    manageHref: "/manage",
  });

  const visible = cards.filter((c) => !c.adminOnly || viewer.canEdit);
  const main = visible.filter((c) => !c.wide);
  const wide = visible.filter((c) => c.wide);

  return (
    <>
      {/* The surface provider is mounted once in the root layout. */}
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
          {siteConfig.orgName}
        </p>
        <h1 className="mt-1 font-serif text-3xl">Hub</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Everything opens in place. Pick a day to see what&rsquo;s on, or to add something to it.
        </p>

        <div className="mt-8">
          <SurfaceCardGrid>
            {/* The standing gathering: what a member opens the hub to check. */}
            <StandingMeetingFace standing={standing} canEdit={viewer.canEdit} timeZone={TIME_ZONE} />

            <CalendarFace initialEvents={events} canEdit={viewer.canEdit} />

            <PipelineFace board={board} canEdit={viewer.canEdit} />

            <ForumFace forum={forum} />

            {/* Your identity, opened in place. The tile this replaces linked
                out to ArtDirect: click your own name on your own org's hub and
                you were on a different site with no way back but the browser's
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

            {/* The face IS the form: type it, press Enter. Opening the tile
                goes to the ideas feed, where they are discussed. */}
            <IdeasFace initialIdeas={ideas} />

            <DocumentsFace documents={documents} />

            <WhiteboardFace />

            {viewer.canEdit && <ComposeFace />}

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

            {main.map((card) => (
              <SurfaceCard
                key={card.id}
                kind={card.kind}
                glyph={card.glyph}
                kicker={null}
                title={card.title}
                blurb={card.blurb}
                disabled={!card.available}
                surface={card.available ? card.surface : undefined}
                href={card.available ? card.href : undefined}
              />
            ))}

            <div className="w-full">
              {chatRoom ? (
                <ChatCard messages={chatMessages} canPost={viewer.isMember} identity={chatIdentity} />
              ) : (
                <ProvisionChat canProvision={viewer.canEdit} compact />
              )}
            </div>

            {wide.map((card) => (
              <SurfaceCard
                key={card.id}
                wide
                kind={card.kind}
                glyph={card.glyph}
                kicker={null}
                title={card.title}
                blurb={card.blurb}
                disabled={!card.available}
                surface={card.available ? card.surface : undefined}
                href={card.available ? card.href : undefined}
              />
            ))}
          </SurfaceCardGrid>
        </div>
      </div>
    </>
  );
}
