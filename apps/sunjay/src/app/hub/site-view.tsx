import "@elkdonis/cms-ui/hubsite.css";
import { ChatCard } from "@elkdonis/chat";
import {
  getMeetingAttendance,
  getMeetingRota,
  getOrgChatIdentity,
  getOrgChatNextcloudUrl,
  getOrgChatRoom,
  listNetworkActivity,
  listOrgChatMessages,
  listOrgHomes,
  listUserMemberships,
  RSVP_FLAVOURS,
  getProfile,
  getStandingMeeting,
  listOrgActivity,
  listOrgEventsInRange,
  listOrgFeeds,
  listOrgMediaLibrary,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import {
  ActivityFeed,
  CrossPostCycler,
  FileBrowser,
  GalleryHero,
  HubCalendar,
  HubDoors,
  HubPortrait,
  HubViewToggle,
  InlineCompose,
  MeetingBanner,
  WhiteboardPanel,
  type MeetingBannerData,
} from "@elkdonis/cms-ui/hubsite";
import { siteConfig } from "@/config/site";
import type { Viewer } from "@/lib/auth";

const TIME_ZONE = "America/Toronto";
const IMAGE = /\.(jpe?g|png|gif|webp|avif)$/i;
/** A line under each of the service's answers (RSVP_FLAVOURS keys). */
const FLAVOUR_NOTE: Record<string, string> = {
  certain: "Count on me.",
  early: "It's the intention — early days yet.",
  hesitant: "Planning on it, but it could slip.",
  maybe: "Not sure yet.",
  next_time: "Not this one — keep me on the list.",
  wont: "Can't make this one.",
};
const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

/**
 * The hub laid out as a page — an ALTERNATIVE to the card hub, chosen per
 * person with the toggle and remembered in the `hub_view` cookie. Ported from
 * apps/innergathering, which is the layout the owner asked this site to wear
 * (2026-09-19). Top to bottom:
 *
 *   the next weekly meeting, full width and short
 *   your picture  |  the calendar
 *   the group's latest, full width
 *   a one-line compose that unfolds, full width
 *   files  |  whiteboard, then three small doors
 *   the gallery as a hero carousel
 *
 * Every piece opens the same surfaces the card hub does; the SurfaceProvider
 * is the root layout's. The card hub (page.tsx) is unchanged apart from the
 * branch that renders this.
 *
 * Two host obligations this file carries, both now met: `/api/center/files`
 * (the FileBrowser's two sources) and `/api/center/attendance` (the meeting
 * banner's "will you make it?"). Neither existed in the amrit-canada shape
 * this app was copied from; both were ported alongside this view.
 *
 * One deliberate gap: this site does not enable the `postTo` connector, which
 * has no `/api/center/post` route here. The effect is that HubDoors drops its
 * "Suggest an idea" door and InlineCompose renders only for editors. That is
 * accurate rather than broken — a door that 404s would be worse.
 */
export async function HubSiteView({ viewer }: { viewer: Viewer }) {
  const calendarFrom = startOfMonth(new Date());
  const [profile, standing, events, activity, feeds, library, chatRoom, memberships, homes] = await Promise.all([
    getProfile(viewer.userId),
    getStandingMeeting(siteConfig.orgId),
    listOrgEventsInRange(siteConfig.orgId, calendarFrom, addMonths(calendarFrom, 1)),
    listOrgActivity(siteConfig.orgId, viewer.userId, { affiliated: true, limit: 8 }).catch(() => []),
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    // Editors only, as on the card hub: the library lists unpublished files.
    viewer.canEdit
      ? listOrgMediaLibrary(siteConfig.orgId)
          .then((items) => items.filter((i) => IMAGE.test(i.filename)).map((i) => ({ url: i.url, name: i.filename })))
          .catch(() => [])
      : Promise.resolve([] as Array<{ url: string; name: string }>),
    getOrgChatRoom(siteConfig.orgId).catch(() => null),
    listUserMemberships(viewer.userId).catch(() => []),
    listOrgHomes().catch(() => []),
  ]);

  // The chat, as the card hub loads it.
  const name = profile?.displayName?.trim() || viewer.email;
  const [chatMessages, chatIdentity, chatRoomUrl] = chatRoom
    ? await Promise.all([
        listOrgChatMessages(siteConfig.orgId, viewer.userId, { limit: 20 }).catch(() => []),
        getOrgChatIdentity(siteConfig.orgId, viewer.userId, name).catch(() => undefined),
        getOrgChatNextcloudUrl(siteConfig.orgId).catch(() => null),
      ])
    : [[], undefined, null];

  // Across the collective: other orgs' threads carried here or shared. A card
  // links out only to an org with a verified domain of its own.
  const verified = new Map(homes.filter((h) => h.primaryDomain).map((h) => [h.orgSlug, h.primaryDomain as string]));
  const network = await listNetworkActivity(siteConfig.orgId, viewer.userId, {
    memberOrgIds: memberships.map((m) => m.orgId),
    limit: 8,
  }).catch(() => []);

  // Who hosts the occurrence the banner shows, with their picture.
  const rota = standing
    ? await getMeetingRota(standing.event.id, { from: standing.at, count: 1 }).catch(() => null)
    : null;
  const host = rota?.occurrences[0]?.host ?? null;
  const hostProfile = host?.userId ? await getProfile(host.userId).catch(() => null) : null;
  const answered = standing ? await getMeetingAttendance(standing.event.id, viewer.userId).catch(() => null) : null;

  // Pictures: the library for editors; for members, what the group has
  // already published (thread covers) — never an unpublished file.
  const published = [
    ...activity.map((t) => t.coverImageUrl),
    ...events.map((e) => e.coverImageUrl),
  ].filter((u): u is string => Boolean(u));
  const gallery = viewer.canEdit && library.length > 0
    ? library.slice(0, 24)
    : [...new Set(published)].map((url) => ({ url, name: null }));

  const meeting: MeetingBannerData | null = standing
    ? {
        id: standing.event.id,
        title: standing.event.title,
        at: standing.at.toISOString(),
        location: standing.event.location,
        kicker: standing.source === "next" ? "Next gathering" : "Next weekly meeting",
        // One shown at a time; a few to cross-fade through.
        photos: [...new Set([standing.event.coverImageUrl, ...gallery.map((g) => g.url)].filter((u): u is string => Boolean(u)))].slice(0, 4),
        joinUrl:
          standing.event.meetingUrl ||
          (standing.event.talkToken && TALK_BASE ? `${TALK_BASE}/call/${standing.event.talkToken}` : null),
        attendance: standing.event.isRsvpEnabled
          ? {
              endpoint: "/api/center/attendance",
              options: RSVP_FLAVOURS.map((f) => ({ key: f.key, label: f.label, note: FLAVOUR_NOTE[f.key] ?? null, status: f.status })),
              answered: answered?.flavour ?? null,
            }
          : null,
        host: host?.displayName
          ? { name: host.displayName, avatarUrl: hostProfile?.avatarUrl ?? null }
          : null,
      }
    : null;


  return (
    <main className="hub">
      <div className="eac-hs">
        <div className="eac-hs-row-head" style={{ marginBottom: 0 }}>
          <div>
            <p className="eac-hs-kicker" style={{ margin: 0 }}>{siteConfig.orgName}</p>
            <h1 className="eac-hs-h" style={{ fontSize: "2rem" }}>
              Welcome back, {name.split(/[\s@]/)[0]}.
            </h1>
          </div>
          <HubViewToggle current="site" />
        </div>

        <MeetingBanner meeting={meeting} timeZone={TIME_ZONE} />

        <div className="eac-hs-two eac-hs-two--portrait">
          <HubPortrait name={name} avatarUrl={profile?.avatarUrl ?? null} centerHref="/center" />
          <HubCalendar initialEvents={events} />
        </div>

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

        {(chatRoom || network.length > 0) && (
          // Two columns only when both halves have something; the chat alone
          // takes the row rather than leaving half of it blank.
          <div className={chatRoom && network.length > 0 ? "eac-hs-two" : undefined}>
            {chatRoom ? (
              <section className="eac-hs-chat" aria-label="Chat">
                <ChatCard
                  messages={chatMessages}
                  canPost={viewer.isMember}
                  identity={chatIdentity}
                  title="General Chat"
                  expandedHref="/hub/chat"
                  nextcloudUrl={chatRoomUrl}
                  heightClass="h-[22rem]"
                />
              </section>
            ) : null}
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
          </div>
        )}

        <InlineCompose name={name} avatarUrl={profile?.avatarUrl ?? null} feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))} />

        <div className="grid gap-4">
          <div className="eac-hs-two">
            <FileBrowser
              sources={[
                { id: "org", label: siteConfig.orgName, endpoint: "/api/center/files" },
                { id: "mine", label: "My files", endpoint: "/api/center/files", params: { scope: "mine" } },
              ]}
            />
            <WhiteboardPanel />
          </div>
          <HubDoors forumHref="/forum" />
        </div>

        <GalleryHero images={gallery} />
      </div>
    </main>
  );
}
