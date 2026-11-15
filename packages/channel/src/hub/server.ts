import type { ContentListItem, ContentMark, ContentStatus } from "@elkdonis/content/model";
import { parsePlan } from "@elkdonis/services/channel-plan-md";
import { MATRIX_COLUMNS, MATRIX_LABELS, kindLabel, type ChannelModel, type Outlet, type Piece } from "../model";
import { channelNextMoves } from "../next";
import { boardGrid, weekGrid, routineRows, type RowLinks } from "../site/grid-data";
import { buildPieceSummaryView } from "../site/summary-view";
import { BOARD_COLUMNS, SITE_NEXT_RUNS, boardMark, studioKindOf } from "../site/view";
import { makeIntoFor } from "@elkdonis/content/summary";
import type { ChannelHubData, ChannelHubMatrix, ChannelHubPiece, HubDot } from "./data";

/**
 * The reducer for the Channel hub card (server-safe, no React): a ChannelModel in, plain ChannelHubData out. It
 * reuses the site Channel's builders (boardGrid, weekGrid, buildPieceSummaryView, channelNextMoves) rather than
 * re-deriving. `links` says where a piece's links go; the hub keeps them on the site's own /channel.
 */

export const HUB_PIECE_CAP = 24;
export const HUB_FACE_ROWS = 6;

export interface HubLinks {
  /** The site's Channel page, default "/channel". */
  channel?: string;
  /** The site page's own Studio link (handed off, carrying the way back), as ChannelSitePage builds it. */
  studio?: (o?: { kind?: string | null; id?: string | null }) => string;
  /** The site page's Make into link, as ChannelSitePage builds it. */
  makeInto?: (pieceKey: string, to: string) => string;
  /** Piece kinds the site edits in place (its editHere.kinds): Edit opens the quick form at /channel?piece=&edit=1. */
  quickKinds?: string[];
}

const dotOf = (p: Piece, outlets: readonly Outlet[]): HubDot => {
  if (p.timeline.some((e) => e.state === "failed" && outlets.includes(e.outlet))) return "failed";
  return boardMark(p, outlets)?.state ?? "none";
};

function statusOf(p: Piece): ContentStatus {
  if (p.status === "draft") return "draft";
  if (p.timeline.some((e) => e.state === "live")) return "live";
  if (p.timeline.some((e) => e.state === "scheduled")) return "scheduled";
  return "published";
}

function listItem(p: Piece): ContentListItem {
  const marks: ContentMark[] = MATRIX_COLUMNS.map((c) => ({ outlet: c, state: p.row[c].state, label: MATRIX_LABELS[c] }));
  const nextAt = p.eventAt ?? p.timeline.find((e) => e.state === "scheduled" || e.state === "live")?.at ?? null;
  const last = p.timeline[p.timeline.length - 1];
  return {
    key: p.key,
    type: p.kind,
    title: p.title || "Untitled",
    meta: p.meta,
    excerpt: p.excerpt,
    cover: p.imageUrl,
    status: statusOf(p),
    siteIdentityId: p.siteIdentityId,
    siteName: p.siteName,
    siteHost: p.siteHost,
    ownerIdentityId: p.ownerIdentityId,
    series: null,
    createdAt: p.createdAt,
    date: nextAt ?? last?.at ?? p.createdAt,
    marks,
    note: null,
    timeline: [],
    links: { public: p.href, studio: null },
  };
}

export function channelHubData(model: ChannelModel, links: HubLinks = {}, orgName?: string): ChannelHubData {
  const channel = links.channel ?? "/channel";
  const pieces = model.pieces.slice(0, HUB_PIECE_CAP);
  const pieceHref = (p: { key: string }) => `${channel}?piece=${encodeURIComponent(p.key)}&tab=plan`;
  const rowLinks: RowLinks = {
    // A piece's name opens the pop-up's own piece view (the panel catches "#piece=" clicks).
    manageHref: (p) => `#piece=${encodeURIComponent(p.key)}`,
    editHref: (p) => pieceHref(p),
    makeIntoHref: (p) => pieceHref(p),
    networkHref: () => `${channel}?tab=out`,
  };
  const board = boardGrid(model, pieces, rowLinks);
  const week = weekGrid(model, pieces, rowLinks);

  const matrix: ChannelHubMatrix = {
    cols: BOARD_COLUMNS.map((c) => ({ id: c.id, label: c.label, title: c.title, outlet: c.outlets[0] })),
    rows: pieces.slice(0, HUB_FACE_ROWS).map((p) => ({ key: p.key, title: p.title || "Untitled", cells: BOARD_COLUMNS.map((c) => dotOf(p, c.outlets)) })),
  };

  const hubPieces: ChannelHubPiece[] = pieces.map((p) => {
    const parsed = p.plan ? parsePlan(p.plan.bodyMd) : null;
    return {
      key: p.key,
      title: p.title || "Untitled",
      kind: p.kind,
      kindLabel: kindLabel(p.kind),
      status: p.status,
      thumb: p.imageUrl,
      marks: BOARD_COLUMNS.map((c) => ({ id: c.id, label: c.label, state: dotOf(p, c.outlets) })),
      item: listItem(p),
      view: buildPieceSummaryView(p, model, { planHref: pieceHref(p) }),
      identityId: p.ownerIdentityId,
      suggestions: p.suggestions,
      moves: channelNextMoves(model, { pieceKey: p.key, limit: 4 }).map((m) => ({
        id: m.id,
        kicker: m.kicker,
        title: m.title,
        reason: m.reason,
        run: m.run && SITE_NEXT_RUNS.includes(m.run.id) ? m.run : null,
      })),
      plan: { started: Boolean(p.plan), goal: parsed?.goal?.trim() || null, steps: (parsed?.steps ?? []).map((s) => ({ index: s.index, text: s.text, done: s.done, on: s.on ?? null })) },
      editHref: links.quickKinds?.includes(p.kind) ? `${channel}?piece=${encodeURIComponent(p.key)}&edit=1` : links.studio ? links.studio({ kind: studioKindOf(p.kind), id: p.subject.id }) : pieceHref(p),
      studioHref: links.studio ? links.studio(studioKindOf(p.kind) ? { kind: studioKindOf(p.kind), id: p.subject.id } : {}) : null,
      makeInto: links.makeInto ? makeIntoFor(p.kind).map((t) => ({ to: t.to, label: t.label, href: links.makeInto!(p.key, t.to) })) : [],
      channelHref: pieceHref(p),
    };
  });

  const failed = model.pieces.reduce((n, p) => n + p.timeline.filter((e) => e.state === "failed").length, 0);
  return {
    orgName: orgName ?? (model.scope.kind === "org" ? model.scope.name : "Channel"),
    timeZone: model.timeZone,
    matrix,
    counts: { waiting: model.pieces.reduce((n, p) => n + p.suggestions.length, 0), failed, pieces: model.pieces.length },
    board,
    week: { ...week, routineNames: routineRows(model).map((r) => r.name), label: model.week.label },
    pieceRefs: model.pieces.map((p) => ({ key: p.key, title: p.title || "Untitled", identityId: p.ownerIdentityId })),
    pieces: hubPieces,
  };
}
