"use server";

import { getStandingMeeting } from "@elkdonis/services";
import type { RecordChoice, RecordSourceItem } from "@elkdonis/direct-edit/puck";
import { getApiEditor } from "@/lib/auth";
import { standingForViewer } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { pickStanding, upcomingGatherings } from "./data-standing";

// ============================================================================
// "From what?" for "Next gathering" (2026-11-14): the chooser for `binds: "gathering"` (pt-standing, home-standing),
// in Puck Studio, the canvas editor and its popup. Owners and guides only, as featured-person-actions.ts.
// Step one: choices that follow the calendar, or this site's gatherings. Values: data-standing.ts `whichOf`.
// ============================================================================

const FOLLOWS = "follows";
const LIST = "gatherings";

const when = (d: Date) =>
  d.toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: siteConfig.timeZone });

export async function gatheringSourcesAction(): Promise<RecordSourceItem[]> {
  const editor = await getApiEditor();
  if (!editor) return [];
  const ids = new Set((await upcomingGatherings(editor)).map((o) => o.item.id));
  return [
    { ref: FOLLOWS, label: "Follows the calendar", hint: "the standing meeting, or whatever is next" },
    { ref: LIST, label: "This site's gatherings", hint: ids.size === 1 ? "1 coming up" : `${ids.size} coming up` },
  ];
}

export async function gatheringChoicesAction(source: string): Promise<RecordChoice[]> {
  const editor = await getApiEditor();
  if (!editor) return [];
  const upcoming = await upcomingGatherings(editor);
  if (source === FOLLOWS) {
    const standing = await getStandingMeeting(siteConfig.orgId, editor).catch(() => null);
    const next = upcoming[0];
    return [
      { value: "standing", label: "The standing meeting", follows: true, hint: standing ? `Now: ${standing.event.title}, ${when(standing.at)}` : "Nothing scheduled now" },
      { value: "next", label: "The next upcoming gathering", follows: true, hint: next ? `Now: ${next.item.title}, ${when(next.at)}` : "Nothing scheduled now" },
    ];
  }
  if (source !== LIST) return [];
  // One row per gathering, at its next occurrence.
  const seen = new Set<string>();
  const rows: RecordChoice[] = [];
  for (const o of upcoming) {
    if (seen.has(o.item.id)) continue;
    seen.add(o.item.id);
    rows.push({ value: `thread:${o.item.id}`, label: o.item.title, hint: `next ${when(o.at)}${o.item.recurrencePattern && o.item.recurrencePattern !== "NONE" ? ` · ${o.item.recurrencePattern.toLowerCase()}` : ""}` });
  }
  return rows;
}

/** What a value draws, keyed as pt-standing's resolver keys it (`standing`, `canEdit`). Plain JSON, as block-data.ts sends it. */
export async function gatheringDrawAction(value: string): Promise<Record<string, unknown> | null> {
  const editor = await getApiEditor();
  if (!editor) return null;
  const standing = standingForViewer(await pickStanding(value, editor).catch(() => null), true);
  return JSON.parse(JSON.stringify({ standing, canEdit: Boolean(editor.canEdit) })) as Record<string, unknown>;
}
