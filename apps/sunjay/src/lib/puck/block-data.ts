import {
  getProfile,
  getProfileBySlug,
  getStandingMeeting,
  listOrgEventsInRange,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import {
  getGuideBySlug,
  getThreadsByAuthor,
  getThreadsForFeed,
  listMyRsvps,
} from "@/lib/data";
import { getForumSnapshot } from "@/lib/forum";
import { listGalleryImages, listWritingShelf } from "@/lib/landing";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { loadEvent } from "./data-event";
import { loadBooking, loadService, loadServices } from "./data-service";
import { loadJournal, loadPiece, loadSeries } from "./data-writing";

// ============================================================================
// What each data block shows, read from the database.
//
// One function per block id. Three callers share it, so the editor's canvas
// and the published page cannot disagree about what a block contains:
//
//   config.server.ts          resolvers, on the published page (direct call)
//   /api/blocks/[id]          the editor's canvas, over HTTP (editors only)
//
// Server-only: this imports @elkdonis/db through the services. Nothing a
// client component imports may reach this file.
//
// The shapes carry Dates (a thread's `scheduledAt`, the standing meeting's
// `at`). They cross JSON on the editor path and arrive as strings, so each
// client view revives its own dates (blocks/views.client.tsx).
// ============================================================================

type Props = Record<string, unknown>;

const num = (v: unknown, fallback: number, min = 1, max = 50) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.trunc(v), min), max) : fallback;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** The guide and the links row beside them, as the landing page built them. */
async function loadProfile() {
  const guide = await getGuideBySlug(siteConfig.guideSlug).catch(() => null);
  if (!guide) return { guide: null, links: [] };

  // The network profile is the source for the links row: someone who wrote
  // their links on ArtDirect or any other EAC surface arrives here complete.
  const person = await getProfileBySlug(guide.slug).catch(() => null);
  const collectiveHost = hostOf(siteConfig.collectiveUrl);

  const links = [
    ...(person?.socialLinks ?? [])
      .filter((l) => l.url && (!collectiveHost || hostOf(l.url) !== collectiveHost))
      .map((l) => ({
        // A row entered as a bare URL has no label; the host says where the
        // link goes without inventing a name.
        label: l.label?.trim() || hostOf(l.url) || l.url,
        url: l.url,
      })),
    // Elkdonis is not one of his profiles, so it is marked `emphasis`.
    { label: "Elkdonis Arts", url: siteConfig.collectiveUrl, emphasis: true },
  ];
  return { guide, links };
}

async function loadMember() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return { me: null, orgName: siteConfig.orgName };
  const [profile, rsvps] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    listMyRsvps(viewer.userId, 4).catch(() => []),
  ]);
  return {
    orgName: siteConfig.orgName,
    me: {
      name: profile?.displayName?.trim() || viewer.email,
      headline: profile?.headline ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      role: viewer.role,
      isMember: viewer.isMember,
      rsvps: rsvps.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        section: r.section,
        scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      })),
    },
  };
}

export const BLOCK_DATA_IDS = [
  "pt-standing",
  "pt-calendar",
  "pt-profile",
  "pt-threads",
  "pt-member",
  "pt-forum",
  "pt-writing",
  "pt-gallery",
  // The event detail template (data-event.ts): one `event` for all five.
  "pt-event-header",
  "pt-event-about",
  "pt-talk-room",
  "pt-event-rsvp",
  "pt-event-materials",
  "pt-offering-card",
  // Services (data-service.ts) and writing (data-writing.ts).
  "pt-services",
  "pt-service",
  "pt-booking",
  "pt-journal",
  "pt-article",
  "pt-series-nav",
] as const;

/**
 * Data for one block. `member` is excluded from the editor route by the
 * caller: it is about the signed-in viewer, which is nothing to put on a canvas.
 */
export async function loadBlockData(id: string, props: Props, ctx: Props = {}): Promise<Props> {
  return toWire(await read(id, props, ctx));
}

/**
 * Plain JSON, dates as ISO strings. Puck deep-copies what a resolver returns
 * and turns a Date into an empty object (a standing meeting arrived with
 * `at: {}` and drew "Nothing scheduled"), so every value is made JSON-safe
 * here, once, for the published page and the editor's HTTP path alike. The
 * views revive the dates they need.
 */
function toWire(value: Props): Props {
  return JSON.parse(JSON.stringify(value)) as Props;
}

async function read(id: string, props: Props, ctx: Props): Promise<Props> {
  switch (id) {
    case "pt-standing": {
      const [standing, viewer] = await Promise.all([
        getStandingMeeting(siteConfig.orgId).catch((err) => {
          console.error("[sunjay] pt-standing:", err);
          return null;
        }),
        getViewer().catch(() => null),
      ]);
      return { standing, canEdit: Boolean(viewer?.canEdit) };
    }
    case "pt-calendar": {
      const from = startOfMonth(new Date());
      const events = await listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1)).catch(() => []);
      return { events };
    }
    case "pt-profile":
      return loadProfile();
    case "pt-threads": {
      const limit = num(props.limit, 4);
      if (props.source === "author") {
        const guide = await getGuideBySlug(siteConfig.guideSlug).catch(() => null);
        return { threads: guide ? await getThreadsByAuthor(guide.userId, limit).catch(() => []) : [] };
      }
      const feed = typeof props.feed === "string" && props.feed ? props.feed : "materials";
      return { threads: await getThreadsForFeed(feed, limit).catch(() => []) };
    }
    case "pt-member":
      return loadMember();
    case "pt-forum":
      return { forum: await getForumSnapshot().catch(() => null) };
    case "pt-writing":
      return { items: await listWritingShelf(num(props.limit, 6, 1, 24)) };
    case "pt-gallery":
      return { images: await listGalleryImages(num(props.limit, 12, 1, 48)) };
    case "pt-event-header":
    case "pt-event-about":
    case "pt-talk-room":
    case "pt-event-rsvp":
    case "pt-event-materials":
    case "pt-offering-card":
      return loadEvent(ctx, props);
    case "pt-services":
      return loadServices(props);
    case "pt-service":
      return loadService(props, ctx);
    case "pt-booking":
      return loadBooking(props, ctx);
    case "pt-journal":
      return loadJournal(props);
    case "pt-article":
      return loadPiece(props, ctx);
    case "pt-series-nav":
      return loadSeries(props, ctx);
    default:
      return {};
  }
}
