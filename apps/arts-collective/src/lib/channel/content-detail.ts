// ============================================================================
// Channel → @elkdonis/content: turns a Piece from the already-loaded
// ChannelModel into the shared ContentDetailModel, so the piece pop-up renders
// through <ContentDetail> with no change in what it shows (pass 1 of
// docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md). Pure, browser-safe.
// Pass 2 replaces this with the per-item server loader.
// ============================================================================

import type {
  ContentCoveragePanel,
  ContentDetailModel,
  ContentEvent,
  ContentEventSource,
  ContentIdentity,
  ContentLane,
  ContentState,
  ContentSuggestion,
} from "@elkdonis/content/model";
import { COVERAGE_COLUMNS, pieceHref, type ChannelIdentity, type ChannelModel, type CoverageColumn, type Outlet, type Piece, type Suggestion, type TimelineEntry } from "./model";

const COVERAGE_LABEL: Record<CoverageColumn, string> = { site: "Page or site", instagram: "Instagram", facebook: "Facebook", market: "Market", newsletter: "Letter" };

const LANE: Record<Outlet, ContentLane> = {
  site: "site",
  page: "site",
  market: "market",
  instagram: "social",
  facebook: "social",
  threads: "social",
  youtube: "video",
  video: "video",
  writing: "writing",
  live: "live",
  newsletter: "email",
};

function identityOf(i: ChannelIdentity): ContentIdentity {
  return { id: i.id, kind: i.kind, name: i.name, shortName: i.shortName, initials: i.initials, avatarUrl: i.avatarUrl };
}

export function suggestionToContent(s: Suggestion): ContentSuggestion {
  return { id: s.id, outlet: s.outlet, identityId: s.identityId, chip: s.chip, text: s.text, reason: s.reason, at: s.at };
}

/** Where a timeline row came from, read off the ids load.ts gives them. */
function sourceOf(e: TimelineEntry): ContentEventSource {
  if (e.deliveryId || e.id.startsWith("delivery:")) return "delivery";
  if (e.id.includes(":fail:")) return "publish_job";
  if (e.id.endsWith(":letter")) return "email";
  if (e.id.includes(":share:")) return "share";
  return "thread";
}

export function eventOf(e: TimelineEntry): ContentEvent {
  // Channel timelines never carry "empty"; keep the type total anyway.
  const state: ContentState = e.state === "empty" ? "info" : e.state;
  return {
    id: e.id,
    at: e.at,
    lane: LANE[e.outlet] ?? "site",
    source: sourceOf(e),
    verb: state,
    outlet: e.outlet,
    label: e.label,
    sub: e.sub,
    state,
    identityId: e.identityId,
    href: e.href,
    refs: e.deliveryId ? { deliveryId: e.deliveryId } : undefined,
  };
}

export interface ChannelDetailLinks {
  /** ChannelFrame's scoped href (keeps ?org=). */
  href: (path: string, params?: Record<string, string | null | undefined>) => string;
  /** CHANNEL_BASE ("/channel"), passed in so this file imports nothing from a "use client" module. */
  base: string;
}

export function channelPieceToDetail(piece: Piece, model: ChannelModel, links: ChannelDetailLinks): ContentDetailModel {
  const byId = new Map(model.identities.map((i) => [i.id, i]));
  const owner = byId.get(piece.ownerIdentityId);
  const presenter = piece.presentedById ? byId.get(piece.presentedById) : undefined;
  const siteIdentity = byId.get(piece.siteIdentityId);

  const coverage: ContentCoveragePanel = {
    columns: COVERAGE_COLUMNS.map((c) => ({ id: c, outlet: c, label: COVERAGE_LABEL[c] })),
    rows: model.identities
      .filter((i) => piece.coverage[i.id])
      .map((i) => ({
        identityId: i.id,
        cells: Object.fromEntries(
          COVERAGE_COLUMNS.map((c) => {
            const cell = piece.coverage[i.id]![c];
            return [c, { state: cell.state, at: cell.at, suggestion: cell.suggestion ? suggestionToContent(cell.suggestion) : null }];
          })
        ),
      })),
  };

  const firstPublished = piece.timeline.filter((e) => e.state === "published").map((e) => e.at).sort()[0] ?? null;

  return {
    ref: { store: piece.subject.kind, id: piece.subject.id },
    key: piece.key,
    type: piece.kind,
    title: piece.title,
    meta: piece.meta,
    excerpt: piece.excerpt,
    media: { cover: piece.imageUrl },
    status: { value: piece.status, label: piece.status },
    owner: owner ? identityOf(owner) : null,
    presentedBy: presenter ? identityOf(presenter) : null,
    site: { name: piece.siteName, host: piece.siteHost, url: siteIdentity?.siteUrl ?? null },
    dates: { created: piece.createdAt, updated: null, published: firstPublished, next: piece.eventAt },
    links: {
      public: piece.href,
      studio: piece.studioHref,
      board: links.href(pieceHref(links.base, piece)),
      manage: null,
      compose: links.href(`${links.base}/new`, { about: piece.key }),
    },
    // Channel lists only pieces the viewer may plan; the server decides can.* from pass 2 on.
    can: { edit: Boolean(piece.studioHref), plan: model.ready, deliver: model.ready, publish: false, archive: false },
    timeline: piece.timeline.map(eventOf),
    panels: [
      { id: "coverage", data: coverage },
      { id: "plan", data: { ready: model.ready, plan: piece.plan, suggestions: piece.suggestions.map(suggestionToContent) } },
    ],
    identities: model.identities.map(identityOf),
    missing: model.ready ? [] : ["channel_plans"],
    timeZone: model.timeZone,
    now: model.now,
  };
}
