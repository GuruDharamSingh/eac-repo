"use server";

import { listOrgWriting } from "@elkdonis/services";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { loadPiece } from "./data-writing";

// ============================================================================
// "From what?" for a piece of writing (2026-11-14): the chooser for
// `binds: "piece"` ("Piece (article)", pt-article), in Puck Studio, the canvas
// editor and its popup. The value is the piece's slug, as the field stored it
// before; "" (the cleared choice) still means the piece in the address, else
// the newest (data-writing.ts `loadPiece`).
//
// Lists only what this site shows (listOrgWriting, the same list loadPiece
// reads), so a choice can never name a piece the page would refuse to draw.
// Owners and guides only, as featured-person-actions.ts.
// ============================================================================

const ALL = "all";
const SERIES = "series:";

const dateOf = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: siteConfig.timeZone }) : null;

async function listed() {
  return listOrgWriting(siteConfig.orgId, { limit: 50 }).catch(() => []);
}

/** Step one: every piece shown on this site, then one source per series. */
export async function pieceSourcesAction(): Promise<RecordSourceItem[]> {
  if (!(await getApiEditor())) return [];
  const all = await listed();
  const series = [...new Set(all.map((p) => p.series).filter((s): s is string => Boolean(s && s.trim())))];
  return [
    { ref: ALL, label: "Writing shown on this site", hint: all.length === 1 ? "1 piece" : `${all.length} pieces` },
    ...series.map((s) => {
      const n = all.filter((p) => p.series === s).length;
      return { ref: `${SERIES}${s}`, label: s, hint: n === 1 ? "series, 1 piece" : `series, ${n} pieces` };
    }),
  ];
}

/** Step two: the pieces, newest first, with their date, author and series. */
export async function pieceChoicesAction(source: string): Promise<RecordChoice[]> {
  if (!(await getApiEditor())) return [];
  const all = await listed();
  const rows = source === ALL ? all : source.startsWith(SERIES) ? all.filter((p) => p.series === source.slice(SERIES.length)) : [];
  return rows.map((p) => ({
    value: p.slug,
    label: p.title,
    hint: [dateOf(p.publishedAt), p.author?.name, source === ALL ? p.series : null].filter(Boolean).join(" · ") || undefined,
  }));
}

/** What a chosen slug draws, keyed as pt-article's resolver keys it (`post`). Null when the site does not show it. */
export async function pieceDrawAction(slug: string): Promise<Record<string, unknown> | null> {
  if (!(await getApiEditor()) || !slug) return null;
  const { post } = await loadPiece({ piece: slug }, {});
  return post ? { post } : null;
}
