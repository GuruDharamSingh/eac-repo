// ============================================================================
// Channel → @elkdonis/content: a Piece from the loaded ChannelModel as the
// library's ContentListItem (brick, row, lightbox). Pure, browser-safe.
// The lightbox in Library.tsx renders from this; so will the Publish card
// and /content when they are wired. Replaced by the server's listContent.
// ============================================================================

import type { ContentListItem, ContentMark, ContentStatus } from "@elkdonis/content/model";
import { fmtDay, MATRIX_COLUMNS, MATRIX_LABELS, type Piece } from "./model";
import { eventOf } from "./content-detail";

function quietLine(p: Piece, tz: string): string {
  const last = p.timeline[p.timeline.length - 1];
  if (p.status === "draft") return "Draft";
  if (!last) return "Not out yet";
  return `Quiet since ${fmtDay(last.at, tz)}`;
}

/** draft; else live / scheduled when a timeline row says so; else published. */
function statusOf(p: Piece): ContentStatus {
  if (p.status === "draft") return "draft";
  if (p.timeline.some((e) => e.state === "live")) return "live";
  if (p.timeline.some((e) => e.state === "scheduled")) return "scheduled";
  return "published";
}

export function channelPieceToListItem(p: Piece, timeZone: string): ContentListItem {
  const marks: ContentMark[] = MATRIX_COLUMNS.map((c) => ({ outlet: c, state: p.row[c].state, label: MATRIX_LABELS[c] }));
  const nextAt = p.eventAt ?? p.timeline.find((e) => e.state === "scheduled" || e.state === "live")?.at ?? null;
  const last = p.timeline[p.timeline.length - 1];
  return {
    key: p.key,
    type: p.kind,
    title: p.title,
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
    note: { text: p.inMotion ? `In motion · ${p.inMotion.reason}` : quietLine(p, timeZone), motion: Boolean(p.inMotion) },
    timeline: p.timeline.map(eventOf),
    links: { public: p.href, studio: p.studioHref },
  };
}
