import "@elkdonis/cms-ui/hubsite.css";
import {
  getMeetingAttendance,
  getMeetingRota,
  getProfile,
  getStandingMeeting,
  getViewerCloud,
  isOccurrenceHost,
  listOrgDocuments,
  listOrgEventsInRange,
  resolveMeetingLight,
  RSVP_FLAVOURS,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import {
  HubCardGrid,
  HubLinkCard,
  HubViewToggle,
  MeetingBanner,
  type MeetingBannerData,
} from "@elkdonis/cms-ui/hubsite";
import { siteConfig } from "@/config/site";
import type { Viewer } from "@/lib/auth";
import { NEXTCLOUD_URL } from "@/lib/hub-links";
import { HUB_VIEWS } from "./views";

/**
 * "Cards 2" (owner, 2026-10-08): the hub as a short grid of cards, each a
 * plain link to its own page with a breadcrumb back — Publish, Chat,
 * Documents, Files, Organization. A third choice beside Cards and Page; the
 * other two are unchanged. No suggested-ideas door and no gallery here.
 *
 * Reads are kept to what the cards print: the meeting banner, this month's
 * events for the calendar line, the document index (no snippets), and the
 * viewer's Nextcloud link state.
 */
export async function HubCardsView({ viewer }: { viewer: Viewer }) {
  const from = startOfMonth(new Date());
  const [profile, standing, events, documents, cloud] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    getStandingMeeting(siteConfig.orgId).catch(() => null),
    listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1)).catch(() => []),
    listOrgDocuments(siteConfig.orgId).catch(() => []),
    getViewerCloud(viewer.userId, siteConfig.orgId).catch(() => null),
  ]);

  const rota = standing
    ? await getMeetingRota(standing.event.id, { from: standing.at, count: 1 }).catch(() => null)
    : null;
  const host = rota?.occurrences[0]?.host ?? null;
  const [hostProfile, answered, light, isEligibleHost] = standing
    ? await Promise.all([
        host?.userId ? getProfile(host.userId).catch(() => null) : null,
        getMeetingAttendance(standing.event.id, viewer.userId).catch(() => null),
        resolveMeetingLight(standing.event.id, { occurrence: standing.at }).catch(() => null),
        isOccurrenceHost(standing.event.id, standing.at, viewer.userId).catch(() => false),
      ])
    : [null, null, null, false];

  // The banner as the Page layout builds it (site-view.tsx), minus the
  // gallery photos this layout does not load.
  const meeting: MeetingBannerData | null = standing
    ? {
        id: standing.event.id,
        title: standing.event.title,
        at: standing.at.toISOString(),
        location: standing.event.location,
        kicker: standing.source === "next" ? "Next gathering" : "Next meeting",
        photos: standing.event.coverImageUrl ? [standing.event.coverImageUrl] : [],
        joinUrl:
          standing.event.meetingUrl ||
          (standing.event.talkToken && NEXTCLOUD_URL ? `${NEXTCLOUD_URL}/call/${standing.event.talkToken}` : null),
        attendance: standing.event.isRsvpEnabled
          ? {
              endpoint: "/api/hub/meeting/attendance",
              options: RSVP_FLAVOURS.map((f) => ({ key: f.key, label: f.label, status: f.status === "no" ? "no" : "yes" })),
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
        planAheadThreadId: standing.source !== "next" ? standing.event.id : null,
      }
    : null;

  const name = profile?.displayName?.trim() || viewer.email;
  const now = Date.now();
  const nextEvent = events
    .filter((e) => e.scheduledAt && new Date(e.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: siteConfig.timeZone,
    });

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
          <HubViewToggle current="cards2" views={HUB_VIEWS} />
        </div>

        <MeetingBanner meeting={meeting} timeZone={siteConfig.timeZone} />

        <HubCardGrid label="Hub">
          <HubLinkCard
            lead
            href="/hub/publish"
            glyph="✚"
            title="Publish"
            blurb="Writing in the Studio, or a gathering for the calendar."
          />
          <HubLinkCard
            href="/hub/chat"
            glyph="☏"
            title="General chat"
            blurb="The group's Talk room — messages, calls and files."
          />
          <HubLinkCard
            href="/hub/calendar"
            glyph="▦"
            title="Calendar"
            blurb="Every gathering, month by month."
            meta={nextEvent ? `Next: ${nextEvent.title} · ${fmt(nextEvent.scheduledAt!)}` : undefined}
          />
          <HubLinkCard
            href="/hub/documents"
            glyph="▭"
            title="Documents"
            blurb="Write together. Every member can edit."
            meta={
              documents.length > 0
                ? `${documents.length} document${documents.length === 1 ? "" : "s"} · latest: ${documents[0].title}`
                : undefined
            }
          />
          <HubLinkCard
            href="/hub/files"
            glyph="▤"
            title="Files"
            blurb="The group's folder and your own."
          />
          <HubLinkCard
            href="/hub/whiteboard"
            glyph="✎"
            title="Whiteboard"
            blurb="A shared canvas. Sketch a plan, a diagram, an idea."
          />
          <HubLinkCard href="/forum" glyph="☰" title="Forum" blurb="What is being discussed, every board in full." />
          <HubLinkCard href="/center" glyph="◉" title="Your page" blurb="How you appear to the group and the network." />
          <HubLinkCard
            href="/hub/organization"
            glyph="◈"
            title="Organization"
            blurb="Nextcloud, payments, and running the site."
            meta={cloud ? (cloud.linked ? "Nextcloud: connected" : "Nextcloud: not set up yet") : undefined}
          />
        </HubCardGrid>
      </div>
    </main>
  );
}
