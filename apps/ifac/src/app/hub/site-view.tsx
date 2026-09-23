import "@elkdonis/cms-ui/hubsite.css";
import "@elkdonis/cms-ui/center.css";
import "./hub-site.css";
import { ChatCard } from "@elkdonis/chat";
import { ProfileFlipCard } from "@elkdonis/cms-ui/center";
import {
  ActivityFeed,
  CrossPostCycler,
  FileBrowser,
  GalleryHero,
  HubCalendar,
  HubDoors,
  HubViewToggle,
  MeetingBanner,
  WhiteboardPanel,
  type MeetingBannerData,
} from "@elkdonis/cms-ui/hubsite";
import {
  getDeckIdentity,
  getMeetingAttendance,
  getMeetingRota,
  getOrgChatIdentity,
  getOrgChatNextcloudUrl,
  getOrgChatRoom,
  getStandingMeeting,
  isOccurrenceHost,
  listNetworkActivity,
  listOrgActivity,
  listOrgChatMessages,
  listOrgEventsInRange,
  listOrgHomes,
  listOrgMediaLibrary,
  listUserMemberships,
  resolveMeetingLight,
  RSVP_FLAVOURS,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { getProfileSummary } from "@/lib/hub-data";
import { getPipelineBoard, listPipelineAssignees } from "@/lib/pipeline";
import { siteConfig } from "@/config/site";
import type { HubViewer } from "@/lib/hub-auth";
import { PublishBanner } from "@/components/hub/site/PublishBanner";
import { ResearchPanel } from "@/components/hub/site/ResearchPanel";
import { PipelinePanel } from "@/components/hub/site/PipelinePanel";

const TIME_ZONE = "America/Toronto";
const IMAGE = /\.(jpe?g|png|gif|webp|avif)$/i;
const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

/**
 * IFAC's hub as a PAGE rather than a grid of cards — the second run at the
 * layout innergathering got first (owner's spec, 2026-09-19), and an
 * alternative to the card hub rather than a replacement: the toggle picks one
 * per person, cards stay the default.
 *
 * Top to bottom, and this order is the spec:
 *
 *   the next weekly meeting, full width      (card hub: StandingMeetingFace)
 *   your card | the month                    (ProfileFace | CalendarFace)
 *   publish something                        (the Publish card)
 *   the group's latest                       (ForumFace, as a feed)
 *   what the rest of the collective is at    (new here)
 *   files | whiteboard                       (FilesFace | WhiteboardFace)
 *   three doors: ideas, forum, documents     (IdeasFace, ForumFace, DocumentsFace)
 *   chat | group research                    (General Chat | KindTilesFace)
 *   the gallery                              (the media library)
 *   the pipeline, with its draggable cards   (PipelineFace)
 *
 * No welcome line and no org kicker at the top: the meeting is the first
 * thing, and the toggle sits at the foot rather than pushing it down.
 *
 * Three cards from the grid are deliberately absent. Email and Appearance
 * belong in /manage, not on a member's hub; Page sections belongs to the
 * profile popup; and the Cloud card is hidden for now — all four decided
 * 2026-09-19. Everything else opens the same surfaces the cards open, through
 * the provider in the hub layout.
 */
export async function HubSiteView({ viewer }: { viewer: HubViewer }) {
  const calendarFrom = startOfMonth(new Date());
  const [profile, standing, events, activity, library, chatRoom, memberships, homes, board] =
    await Promise.all([
      getProfileSummary(viewer.userId),
      getStandingMeeting(siteConfig.orgId).catch(() => null),
      listOrgEventsInRange(siteConfig.orgId, calendarFrom, addMonths(calendarFrom, 1)),
      listOrgActivity(siteConfig.orgId, viewer.userId, { affiliated: true, limit: 8 }).catch(() => []),
      // Editors only, as everywhere else: the library lists unpublished files.
      viewer.canEdit
        ? listOrgMediaLibrary(siteConfig.orgId)
            .then((items) =>
              items.filter((i) => IMAGE.test(i.filename)).map((i) => ({ url: i.url, name: i.filename }))
            )
            .catch(() => [])
        : Promise.resolve([] as Array<{ url: string; name: string }>),
      getOrgChatRoom(siteConfig.orgId).catch(() => null),
      listUserMemberships(viewer.userId).catch(() => []),
      listOrgHomes().catch(() => []),
      getPipelineBoard().catch(() => null),
    ]);

  const name = profile?.displayName?.trim() || viewer.email.split("@")[0];

  // Keyed on things the batch above produces, so they cannot join it.
  const [chatMessages, chatIdentity, chatRoomUrl] = chatRoom
    ? await Promise.all([
        listOrgChatMessages(siteConfig.orgId, viewer.userId, { limit: 20 }).catch(() => []),
        getOrgChatIdentity(siteConfig.orgId, viewer.userId, name).catch(() => undefined),
        getOrgChatNextcloudUrl(siteConfig.orgId).catch(() => null),
      ])
    : [[], undefined, null];

  // Who hosts this occurrence, what this member already said, is it
  // happening, and whether this member is the occurrence's host — the last is
  // what lets "Is it happening" widen past owners and guides, as it does on
  // innergathering (brought across 2026-09-23).
  const [rota, answered, light, isEligibleHost] = standing
    ? await Promise.all([
        getMeetingRota(standing.event.id, { from: standing.at, count: 1 }).catch(() => null),
        getMeetingAttendance(standing.event.id, viewer.userId).catch(() => null),
        resolveMeetingLight(standing.event.id, { occurrence: standing.at }).catch(() => null),
        isOccurrenceHost(standing.event.id, standing.at, viewer.userId).catch(() => false),
      ])
    : [null, null, null, false];
  const host = rota?.occurrences[0]?.host ?? null;
  const hostProfile = host?.userId ? await getProfileSummary(host.userId).catch(() => null) : null;

  // The board's own people, only once we know there is a board.
  const [assignees, viewerUid] = board
    ? await Promise.all([
        listPipelineAssignees().catch(() => []),
        getDeckIdentity(viewer.userId).catch(() => null),
      ])
    : [[], null];

  // Across the collective: only an org with a verified domain gets a link out.
  const verified = new Map(homes.filter((h) => h.primaryDomain).map((h) => [h.orgSlug, h.primaryDomain as string]));
  const network = await listNetworkActivity(siteConfig.orgId, viewer.userId, {
    memberOrgIds: memberships.map((m) => m.orgId),
    limit: 8,
  }).catch(() => []);

  // Pictures: the library for editors; for everyone else what the group has
  // already published — never an unpublished file.
  const published = [
    ...activity.map((t) => t.coverImageUrl),
    ...events.map((e) => e.coverImageUrl),
  ].filter((u): u is string => Boolean(u));
  const gallery =
    viewer.canEdit && library.length > 0
      ? library.slice(0, 24)
      : [...new Set(published)].map((url) => ({ url, name: null }));

  const meeting: MeetingBannerData | null = standing
    ? {
        id: standing.event.id,
        title: standing.event.title,
        at: standing.at.toISOString(),
        location: standing.event.location,
        kicker: standing.source === "next" ? "Next gathering" : "Next weekly meeting",
        photos: [
          ...new Set(
            [standing.event.coverImageUrl, ...gallery.map((g) => g.url)].filter((u): u is string => Boolean(u))
          ),
        ].slice(0, 4),
        joinUrl:
          standing.event.meetingUrl ||
          (standing.event.talkToken && TALK_BASE ? `${TALK_BASE}/call/${standing.event.talkToken}` : null),
        attendance: standing.event.isRsvpEnabled
          ? {
              // IFAC's own answer-in-words route — the one innergathering copied.
              endpoint: "/api/hub/meeting/attendance",
              // One line per option, no note: the explanatory second line was
              // removed from RSVP_FLAVOURS itself (see the comment there);
              // this reuses the same labels rather than reintroducing one.
              options: RSVP_FLAVOURS.map((f) => ({ key: f.key, label: f.label, status: f.status })),
              answered: answered?.flavour ?? null,
              promiseNext: answered?.promiseNext ?? false,
            }
          : null,
        host: host?.displayName ? { name: host.displayName, avatarUrl: hostProfile?.avatarUrl ?? null } : null,
        light: light
          ? {
              state: light.state,
              reason: light.reason,
              source: light.source,
              canSet: viewer.canEdit || isEligibleHost,
              endpoint: "/api/hub/meeting/light",
            }
          : null,
        // The way into the rota, for a gathering that repeats.
        planAheadThreadId: standing.event.recurrencePattern ? standing.event.id : null,
      }
    : null;

  return (
    <div className="eac-hs ifac-hs">
      <MeetingBanner meeting={meeting} timeZone={TIME_ZONE} />

      <div className="eac-hs-two eac-hs-two--portrait">
        {/* The turning card from /center, not hubsite's flat portrait: the
            owner asked for the one that flips, and its back is where a member
            edits their own name, line and page without leaving the hub. */}
        <section className="ifac-hs-person" aria-label="Your card">
            <ProfileFlipCard
            image={profile?.avatarUrl ?? null}
            glyph={name.trim().charAt(0).toUpperCase() || "·"}
            name={name}
            subtitle={profile?.roleTitle ?? profile?.headline ?? null}
            note={null}
            links={[]}
            backKicker="Your profile"
            actions={[
              { id: "profile", label: "Edit your profile", note: "Name, picture, the line under it", surface: true, surfaceTab: "profile" },
              { id: "show", label: "What shows on your page", note: "Sections and galleries", surface: true, surfaceTab: "show" },
              ...(profile?.slug
                ? [{ id: "page", label: "Your public page", note: `ifacgroup.com/artists/${profile.slug}`, href: `/artists/${profile.slug}` }]
                : []),
            ]}
          />
        </section>
        <HubCalendar initialEvents={events} />
      </div>

      {/* Publish first, then what the group has been making. */}
      <PublishBanner />

      <ActivityFeed
        items={activity.map((t) => ({
          id: t.id,
          title: t.title,
          kind: t.kind,
          excerpt: t.excerpt,
          coverImageUrl: t.coverImageUrl,
          authorName: t.authorName,
          authorAvatar: t.authorAvatar,
          at: t.publishedAt ?? t.scheduledAt,
          pinned: t.pinned,
        }))}
        moreHref="/forum"
      />

      <CrossPostCycler
        items={network.map((t) => ({
          id: t.id,
          title: t.title,
          orgName: t.orgName,
          kind: t.kind,
          excerpt: t.excerpt,
          coverImageUrl: t.coverImageUrl,
          href: verified.get(t.orgSlug) ? `https://${verified.get(t.orgSlug)}/${t.slug}` : null,
        }))}
      />

      <div className="eac-hs-two">
        <FileBrowser
          sources={[
            { id: "org", label: siteConfig.shortName, endpoint: "/api/hub/files" },
            { id: "mine", label: "My files", endpoint: "/api/hub/files", params: { scope: "mine" } },
          ]}
        />
        <WhiteboardPanel blurb="A shared canvas. Sketch a hang, a floor plan, an idea." />
      </div>

      <HubDoors forumHref="/forum" />

      {/* The chat keeps its square on the left; research takes the other half. */}
      <div className="eac-hs-two ifac-hs-two--chat">
        {chatRoom ? (
          <section className="eac-hs-chat ifac-hs-chat" aria-label="Chat">
            <ChatCard
              messages={chatMessages}
              canPost
              identity={chatIdentity}
              title="General Chat"
              expandedHref="/hub/chat"
              nextcloudUrl={chatRoomUrl}
              heightClass="ifac-chat-fill"
            />
          </section>
        ) : (
          <div aria-hidden />
        )}
        <ResearchPanel />
      </div>

      <GalleryHero images={gallery} />

      <PipelinePanel
        board={board}
        assignees={assignees}
        viewerUid={viewerUid}
        canWrite
        canManage={viewer.canEdit}
        readable
      />

      {/* The way back to the cards. At the foot on purpose: the top of this
          page belongs to the meeting, not to a control. */}
      <div className="ifac-hs-foot">
        <HubViewToggle current="site" />
      </div>
    </div>
  );
}
