import type { PieceSummaryView } from "@elkdonis/content/summary";
import type { ContentListItem, ContentStatus } from "@elkdonis/content/model";
import { MATRIX_COLUMNS, MATRIX_LABELS, fmtDay, fmtLong, kindLabel, type ChannelModel, type Piece } from "../model";
import { outletLabel } from "../labels";
import { wentWhere, type MarkState } from "./view";

/**
 * One piece as the shared PieceSummary draws it (@elkdonis/content/summary), from the Channel model
 * (2026-11-15; lifted out of tabs.tsx so a site's /channel pop-up and the hub's Channel card share
 * one mapping). Pure. The host adds its own buttons (nextRows, actions, edit) around it.
 */

/** The Board's marks as the summary's states (published is drawn "out"). */
export const SUMMARY_STATE: Record<MarkState, string> = { out: "published", scheduled: "scheduled", planned: "planned", draft: "draft" };

export function buildPieceSummaryView(p: Piece, model: ChannelModel, opts: { planHref?: string | null } = {}): PieceSummaryView {
  const tz = model.timeZone;
  const artwork = p.kind === "artwork" || p.kind === "product";
  const facts: Array<{ label: string; value: string }> = [];
  if (p.eventAt) facts.push({ label: "When", value: fmtLong(p.eventAt, tz) });
  if (p.meta && p.meta !== kindLabel(p.kind)) facts.push({ label: artwork ? "About" : "Details", value: p.meta });
  facts.push({ label: "Status", value: p.status });
  return {
    key: p.key,
    type: p.kind,
    typeLabel: kindLabel(p.kind),
    byline: p.siteName,
    title: p.title,
    excerpt: p.excerpt || null,
    meta: null,
    pictures: p.imageUrl ? [p.imageUrl] : [],
    pictureCount: p.imageUrl ? 1 : 0,
    facts,
    status: { label: p.status, at: null },
    out: wentWhere(p)
      .slice(0, 10)
      .map((e) => ({ id: e.id, label: outletLabel(e.outlet), sub: e.label, at: e.at, state: SUMMARY_STATE[e.mark], href: e.href })),
    next: [],
    links: { view: p.href, channel: null, plan: opts.planHref ?? null },
    marks: MATRIX_COLUMNS.map((c) => ({ outlet: c, state: p.row[c].state, label: MATRIX_LABELS[c] })) as PieceSummaryView["marks"],
  };
}

/**
 * A Channel piece as the content library's list item (@elkdonis/content's ContentListItem), for its rows
 * (PieceRow) on the one Channel page and the hub card. As arts-collective's channelPieceToListItem, without
 * the timeline (rows do not draw it).
 */
export function pieceToListItem(p: Piece, timeZone: string): ContentListItem {
  const status: ContentStatus =
    p.status === "draft" ? "draft" : p.timeline.some((e) => e.state === "live") ? "live" : p.timeline.some((e) => e.state === "scheduled") ? "scheduled" : "published";
  const nextAt = p.eventAt ?? p.timeline.find((e) => e.state === "scheduled" || e.state === "live")?.at ?? null;
  const last = p.timeline[p.timeline.length - 1];
  const quiet = p.status === "draft" ? "Draft" : last ? `Quiet since ${fmtDay(last.at, timeZone)}` : "Not out yet";
  return {
    key: p.key,
    type: p.kind as ContentListItem["type"],
    title: p.title,
    meta: p.meta,
    excerpt: p.excerpt,
    cover: p.imageUrl,
    status,
    siteIdentityId: p.siteIdentityId,
    siteName: p.siteName,
    siteHost: p.siteHost,
    ownerIdentityId: p.ownerIdentityId,
    series: null,
    createdAt: p.createdAt,
    date: nextAt ?? last?.at ?? p.createdAt,
    marks: MATRIX_COLUMNS.map((c) => ({ outlet: c, state: p.row[c].state, label: MATRIX_LABELS[c] })) as ContentListItem["marks"],
    note: { text: p.inMotion ? `In motion · ${p.inMotion.reason}` : quiet, motion: Boolean(p.inMotion) },
    timeline: [],
    links: { public: p.href, studio: p.studioHref },
  };
}
