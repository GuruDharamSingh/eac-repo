"use server";

import { getNetworkAdmin } from "@/lib/gate";
import { answerNote, createNote, isMissingTable, listThreads, replyTo, setStatus } from "./store";
import { NOTE_STATUSES, PERSON_KINDS, type Fail, type Note, type NoteKind, type NoteStatus, type Result, type Thread } from "./types";

// Server actions for the desk. Every one starts with getNetworkAdmin(); signed out or not an admin -> "denied".
// Until migration 302 is applied they answer { reason: "setup" } and the screens say "Notes are not switched on yet".

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied: Fail = { ok: false, reason: "denied", message: "Only network admins can use notes." };
const invalid = (message: string): Fail => ({ ok: false, reason: "invalid", message });

function fail(e: unknown): Fail {
  if (isMissingTable(e)) return { ok: false, reason: "setup", message: "Notes are not switched on yet." };
  console.error("[development/desk]", e);
  return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Something went wrong." };
}
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Notes (with replies) for one page, for the pins and the side panel. */
export async function notesForPage(path: string): Promise<Result<{ threads: Thread[] }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const p = str(path, 300);
  if (!p.startsWith("/")) return invalid("Unknown page.");
  try {
    return { ok: true, threads: await listThreads({ path: p, limit: 100 }) };
  } catch (e) {
    return fail(e);
  }
}

/** Everything the Desk page shows. */
export async function allThreads(): Promise<Result<{ threads: Thread[] }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  try {
    return { ok: true, threads: await listThreads({ limit: 300 }) };
  } catch (e) {
    return fail(e);
  }
}

export async function leaveNote(input: { path: string; anchor: string | null; anchorText: string | null; kind: string; body: string }): Promise<Result<{ note: Note }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const kind = PERSON_KINDS.find((k) => k.kind === input.kind)?.kind as NoteKind | undefined;
  if (!kind) return invalid("Pick what kind of note this is.");
  const path = str(input.path, 300);
  if (!path.startsWith("/")) return invalid("Unknown page.");
  if (!str(input.body, 4000).trim()) return invalid("Write something first.");
  try {
    const note = await createNote({ path, anchor: str(input.anchor, 300), anchorText: str(input.anchorText, 300), kind, body: input.body, authorKind: "person", authorId: admin.userId });
    return { ok: true, note };
  } catch (e) {
    return fail(e);
  }
}

export async function replyNote(threadId: string, body: string, status?: string): Promise<Result<{ note: Note }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!UUID.test(threadId)) return invalid("Unknown note.");
  if (!str(body, 4000).trim()) return invalid("Write something first.");
  const st = NOTE_STATUSES.includes(status as NoteStatus) ? (status as NoteStatus) : undefined;
  try {
    return { ok: true, note: await replyTo(threadId, { body, authorKind: "person", authorId: admin.userId, status: st }) };
  } catch (e) {
    return fail(e);
  }
}

export async function markNote(id: string, status: string): Promise<Result<{ done: true }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!UUID.test(id) || !NOTE_STATUSES.includes(status as NoteStatus)) return invalid("Unknown note.");
  try {
    return (await setStatus(id, status as NoteStatus)) ? { ok: true, done: true } : invalid("That note no longer exists.");
  } catch (e) {
    return fail(e);
  }
}

export async function answerQuestion(id: string, answer: string): Promise<Result<{ done: true }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!UUID.test(id)) return invalid("Unknown question.");
  if (!str(answer, 4000).trim()) return invalid("Pick an option or write an answer.");
  try {
    return (await answerNote(id, answer)) ? { ok: true, done: true } : invalid("That question no longer exists.");
  } catch (e) {
    return fail(e);
  }
}
