"use server";
// Private notes on a place, one row per author (place_notes, migration 279; developer, 2026-11-19): every owner
// and guide reads them, each credited to its author; the author edits or deletes their own, an owner any.
// Never public.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

export interface PlaceNote {
  id: string;
  placeId: string;
  body: string;
  author: { userId: string | null; name: string | null };
  createdAt: string;
  updatedAt: string;
  /** The viewer may edit or delete it (its author, or an owner). */
  mine: boolean;
}

type Out<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const iso = (v: unknown) => new Date(v as string).toISOString();

function map(r: Row, viewerId: string, isOwner: boolean): PlaceNote {
  const author = (r.author_id as string | null) ?? null;
  return {
    id: r.id as string,
    placeId: r.place_id as string,
    body: r.body as string,
    author: { userId: author, name: (r.author_name as string | null) ?? null },
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    mine: isOwner || author === viewerId,
  };
}

async function placeOnSite(placeId: string): Promise<boolean> {
  if (!UUID.test(placeId)) return false;
  const [p] = (await db`SELECT id FROM places WHERE id = ${placeId} AND org_id = ${ORG}`) as unknown as Row[];
  return Boolean(p);
}

export async function listPlaceNotesAction(placeId: string): Promise<PlaceNote[]> {
  const viewer = await requireOrgEditor();
  if (!(await placeOnSite(placeId))) return [];
  const rows = (await db`
    SELECT n.*, u.display_name AS author_name
    FROM place_notes n LEFT JOIN users u ON u.id = n.author_id
    WHERE n.place_id = ${placeId} AND n.org_id = ${ORG}
    ORDER BY n.created_at
  `) as unknown as Row[];
  return rows.map((r) => map(r, viewer.userId, viewer.role === "owner"));
}

export async function addPlaceNoteAction(placeId: string, body: string): Promise<Out<{ note: PlaceNote }>> {
  const viewer = await requireOrgEditor();
  if (!(await placeOnSite(placeId))) return { ok: false, error: "That place is not on this site." };
  const clean = sanitizeRichText(body ?? "").trim();
  if (!clean.replace(/<[^>]*>/g, "").trim()) return { ok: false, error: "Write the note first." };
  if (clean.length > 50_000) return { ok: false, error: "That note is too long." };
  const [r] = (await db`
    INSERT INTO place_notes (org_id, place_id, author_id, body)
    VALUES (${ORG}, ${placeId}, ${viewer.userId}, ${clean})
    RETURNING *, (SELECT display_name FROM users WHERE id = ${viewer.userId}) AS author_name
  `) as unknown as Row[];
  revalidatePath(`/manage/places/${placeId}`);
  return { ok: true, note: map(r!, viewer.userId, viewer.role === "owner") };
}

export async function updatePlaceNoteAction(id: string, body: string): Promise<Out<{ note: PlaceNote }>> {
  const viewer = await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found." };
  const clean = sanitizeRichText(body ?? "").trim();
  if (!clean.replace(/<[^>]*>/g, "").trim()) return { ok: false, error: "A note cannot be empty; delete it instead." };
  const isOwner = viewer.role === "owner";
  const [r] = (await db`
    UPDATE place_notes SET body = ${clean}, updated_at = NOW()
    WHERE id = ${id} AND org_id = ${ORG} ${isOwner ? db`` : db`AND author_id = ${viewer.userId}`}
    RETURNING *, (SELECT display_name FROM users WHERE id = place_notes.author_id) AS author_name
  `) as unknown as Row[];
  if (!r) return { ok: false, error: "Only its author or an owner can change this note." };
  return { ok: true, note: map(r, viewer.userId, isOwner) };
}

export async function deletePlaceNoteAction(id: string): Promise<Out> {
  const viewer = await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found." };
  const isOwner = viewer.role === "owner";
  const rows = (await db`
    DELETE FROM place_notes WHERE id = ${id} AND org_id = ${ORG} ${isOwner ? db`` : db`AND author_id = ${viewer.userId}`}
    RETURNING id
  `) as unknown as Row[];
  if (rows.length === 0) return { ok: false, error: "Only its author or an owner can delete this note." };
  return { ok: true };
}
