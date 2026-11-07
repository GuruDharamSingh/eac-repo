"use server";
// CONTRACT: stop excerpt + private stop notes "from the event" (editors only). Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { Result, StopNote, StopNoteInput } from "@/lib/catalogue-types";

/**
 * tour_stops.excerpt and tour_stop_notes (migration 239). Notes are private editor
 * knowledge from a run (author, time, optional departure or date); they never reach a
 * public page. Promoting a note copies it (optionally shortened) into the excerpt.
 * The excerpt is written here, column-only; saveTourStops leaves it alone.
 */

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;
const EXCERPT_MAX = 300;
const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/[ \t]+/g, " ").trim();

function mapNote(r: Row): StopNote {
  return {
    id: r.id as string,
    stopId: r.stop_id as string,
    threadId: r.thread_id as string,
    departureId: (r.departure_id as string | null) ?? null,
    departureStartsAt: iso(r.starts_at),
    runDate: r.run_date ? new Date(r.run_date as string).toISOString().slice(0, 10) : null,
    body: r.body as string,
    author: { userId: (r.author_id as string | null) ?? null, name: (r.author_name as string | null) ?? null },
    promotedAt: iso(r.promoted_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const SELECT = db`
  SELECT n.*, d.starts_at, u.display_name AS author_name
  FROM tour_stop_notes n
  LEFT JOIN tour_departures d ON d.id = n.departure_id
  LEFT JOIN users u ON u.id = n.author_id
`;

async function stopRow(stopId: string): Promise<Row | null> {
  if (!UUID.test(stopId)) return null;
  const [r] = (await db`
    SELECT s.id, s.thread_id, t.slug FROM tour_stops s JOIN threads t ON t.id = s.thread_id
    WHERE s.id = ${stopId} AND s.org_id = ${ORG}
  `) as unknown as Row[];
  return r ?? null;
}

function revalidateTour(slug: unknown, threadId: unknown) {
  revalidatePath("/tours");
  if (slug) revalidatePath(`/tours/${slug as string}`);
  if (threadId) revalidatePath(`/manage/tours/${threadId as string}/stops`);
}

async function writeExcerpt(stopId: string, excerpt: string | null): Promise<Result<{ excerpt: string | null }>> {
  const stop = await stopRow(stopId);
  if (!stop) return { ok: false, error: "Save the stop first." };
  const value = excerpt == null ? null : plain(excerpt).slice(0, EXCERPT_MAX) || null;
  await db`UPDATE tour_stops SET excerpt = ${value}, updated_at = NOW() WHERE id = ${stopId} AND org_id = ${ORG}`;
  revalidateTour(stop.slug, stop.thread_id);
  return { ok: true, excerpt: value };
}

/** Set the stop's short public excerpt (one or two lines for the tour popup; max 300 chars, plain text). Null clears it. */
export async function setStopExcerptAction(stopId: string, excerpt: string | null): Promise<Result<{ excerpt: string | null }>> {
  await requireOrgEditor();
  return writeExcerpt(stopId, excerpt);
}

export async function listStopNotesAction(stopId: string): Promise<StopNote[]> {
  await requireOrgEditor();
  if (!UUID.test(stopId)) return [];
  const rows = (await db`${SELECT} WHERE n.stop_id = ${stopId} AND n.org_id = ${ORG} ORDER BY n.created_at DESC`) as unknown as Row[];
  return rows.map(mapNote);
}

/** All notes for a tour, grouped by stop id (for the builder). */
export async function listTourStopNotesAction(threadId: string): Promise<Record<string, StopNote[]>> {
  await requireOrgEditor();
  const rows = (await db`${SELECT} WHERE n.thread_id = ${threadId} AND n.org_id = ${ORG} ORDER BY n.created_at DESC`) as unknown as Row[];
  const out: Record<string, StopNote[]> = {};
  for (const r of rows) (out[r.stop_id as string] ??= []).push(mapNote(r));
  return out;
}

export async function addStopNoteAction(input: StopNoteInput): Promise<Result<{ note: StopNote }>> {
  const viewer = await requireOrgEditor();
  const stop = await stopRow(input?.stopId ?? "");
  if (!stop) return { ok: false, error: "Save the stop first." };
  const body = plain(input.body ?? "").slice(0, 8000);
  if (!body) return { ok: false, error: "Write the note first." };
  let departureId: string | null = null;
  if (input.departureId) {
    const [d] = (await db`
      SELECT id FROM tour_departures WHERE id = ${input.departureId} AND thread_id = ${stop.thread_id as string} AND org_id = ${ORG}
    `) as unknown as Row[];
    if (!d) return { ok: false, error: "That departure is not on this tour." };
    departureId = d.id as string;
  }
  const runDate = input.runDate && /^\d{4}-\d{2}-\d{2}$/.test(input.runDate) ? input.runDate : null;
  const [r] = (await db`
    INSERT INTO tour_stop_notes (org_id, stop_id, thread_id, departure_id, run_date, body, author_id)
    VALUES (${ORG}, ${input.stopId}, ${stop.thread_id as string}, ${departureId}, ${runDate}, ${body}, ${viewer.userId})
    RETURNING id
  `) as unknown as Row[];
  const [full] = (await db`${SELECT} WHERE n.id = ${r!.id as string}`) as unknown as Row[];
  revalidatePath(`/manage/tours/${stop.thread_id as string}/stops`);
  return { ok: true, note: mapNote(full!) };
}

export async function updateStopNoteAction(id: string, body: string): Promise<Result<{ note: StopNote }>> {
  await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  const text = plain(body ?? "").slice(0, 8000);
  if (!text) return { ok: false, error: "Write the note first." };
  const rows = (await db`UPDATE tour_stop_notes SET body = ${text}, updated_at = NOW() WHERE id = ${id} AND org_id = ${ORG} RETURNING id`) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "Not found" };
  const [full] = (await db`${SELECT} WHERE n.id = ${id}`) as unknown as Row[];
  return { ok: true, note: mapNote(full!) };
}

export async function deleteStopNoteAction(id: string): Promise<Result> {
  await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  await db`DELETE FROM tour_stop_notes WHERE id = ${id} AND org_id = ${ORG}`;
  return { ok: true };
}

/** Copy a note (optionally edited/shortened) into the stop's public excerpt and mark it promoted. */
export async function promoteStopNoteAction(id: string, excerpt?: string): Promise<Result<{ excerpt: string }>> {
  await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  const [n] = (await db`SELECT stop_id, body FROM tour_stop_notes WHERE id = ${id} AND org_id = ${ORG}`) as unknown as Row[];
  if (!n) return { ok: false, error: "Not found" };
  const res = await writeExcerpt(n.stop_id as string, excerpt?.trim() ? excerpt : (n.body as string));
  if (!res.ok) return res;
  await db`UPDATE tour_stop_notes SET promoted_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
  return { ok: true, excerpt: res.excerpt ?? "" };
}
