import {
  getMeetingAttendance,
  getMeetingRota,
  getStandingMeeting,
  isOccurrenceHost,
  listOrgDocuments,
  listOrgEventsInRange,
  resolveMeetingLight,
  RSVP_FLAVOURS,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import type { MeetingBannerData } from "@elkdonis/cms-ui/hubsite";
import { siteConfig } from "@/config/site";
import type { HubViewer } from "@/lib/hub-auth";
import { getProfileSummary } from "@/lib/hub-data";
import { getPipelineBoard } from "@/lib/pipeline";
import { getPresentedSeries } from "@/lib/series";
import { HubCardsBody } from "@/components/hub/HubCardsBody";

const TIME_ZONE = "America/Toronto";
const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

/**
 * "Cards 2" for IFAC (2026-10-10), after innergathering's (2026-10-08): the
 * meeting banner, then cards that are plain links to their own pages, each
 * page leading with a breadcrumb back (components/hub/HubPageShell.tsx).
 * A third choice beside Cards (classic) and Page; neither of those changed
 * shape for it.
 *
 *   main cards   Publish (beside Forum), chat, calendar, the series, files,
 *                whiteboard, My profile (which carries Page sections), Manage
 *   four across  Suggested ideas, Collaborative document, Pipeline, Group
 *                research — 2 + 2 on a tablet, one column on a phone
 *
 * Reads are what the cards print: the banner, this month's events for the
 * calendar line, the series' coming weeks, and counts for the four.
 */
export async function HubCardsView({ viewer }: { viewer: HubViewer }) {
  const from = startOfMonth(new Date());
  const [profile, standing, events, documents, board, series] = await Promise.all([
    getProfileSummary(viewer.userId).catch(() => null),
    getStandingMeeting(siteConfig.orgId).catch(() => null),
    listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1)).catch(() => []),
    listOrgDocuments(siteConfig.orgId).catch(() => []),
    // A Deck outage costs the card's count line, not the hub.
    getPipelineBoard().catch(() => null),
    getPresentedSeries({ count: 6 }).catch(() => null),
  ]);

  const rota = standing
    ? await getMeetingRota(standing.event.id, { from: standing.at, count: 1 }).catch(() => null)
    : null;
  const host = rota?.occurrences[0]?.host ?? null;
  const [hostProfile, answered, light, isEligibleHost] = standing
    ? await Promise.all([
        host?.userId ? getProfileSummary(host.userId).catch(() => null) : null,
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
        kicker: standing.source === "next" ? "Next gathering" : "Next weekly meeting",
        photos: standing.event.coverImageUrl ? [standing.event.coverImageUrl] : [],
        joinUrl:
          standing.event.meetingUrl ||
          (standing.event.talkToken && TALK_BASE ? `${TALK_BASE}/call/${standing.event.talkToken}` : null),
        attendance: standing.event.isRsvpEnabled
          ? {
              endpoint: "/api/hub/meeting/attendance",
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
        planAheadThreadId: standing.event.recurrencePattern ? standing.event.id : null,
      }
    : null;

  const displayName = profile?.displayName?.trim() || viewer.email.split("@")[0];
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const fmt = (d: Date | string, timeZone: string = TIME_ZONE) =>
    new Date(d).toLocaleString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });

  const now = Date.now();
  const nextEvent = events
    .filter((e) => e.scheduledAt && new Date(e.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];
  const nextWeek = series?.sessions.find((s) => s.isNext) ?? null;
  const boardCards = board
    ? board.stacks.reduce((n, s) => n + (s.cards ?? []).filter((c) => !c.archived).length, 0)
    : null;

  return (
    <HubCardsBody
      shortName={siteConfig.shortName}
      firstName={firstName}
      displayName={displayName}
      meeting={meeting}
      timeZone={TIME_ZONE}
      canEdit={viewer.canEdit}
      calendarLine={nextEvent ? `Next: ${nextEvent.title} · ${fmt(nextEvent.scheduledAt!)}` : null}
      series={series ? { plannerHref: `/hub/series/${series.id}` } : null}
      documentsLine={
        documents.length > 0
          ? `${documents.length} document${documents.length === 1 ? "" : "s"} · latest: ${documents[0].title}`
          : null
      }
      boardLine={boardCards !== null ? `${boardCards} card${boardCards === 1 ? "" : "s"} on the board` : null}
    />
  );
}
