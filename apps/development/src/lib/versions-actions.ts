"use server";

import { getNetworkAdmin } from "./gate";
import { countsBySubject, discardDraft, isMissingTable, keepVersion, listHistory, saveDraft, saveVersion, unkeepVersion } from "./versions";
import type { Fail, History, Result, VersionRow } from "./versions-types";

// ============================================================================
// Server actions for the sandbox's versions. Every one starts with
// getNetworkAdmin() (see gate.ts): signed out or not a network admin -> "denied".
// Until migration 281 is applied they answer { reason: "setup" } instead of throwing,
// and the sandbox shows "Versions are not set up yet".
// ============================================================================

const SUBJECT = /^block:[\w.-]{1,60}:[\w.:-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DOC = 1_000_000;

const denied: Fail = { ok: false, reason: "denied", message: "Only network admins can use versions." };
const invalid = (message: string): Fail => ({ ok: false, reason: "invalid", message });

function fail(e: unknown): Fail {
  if (isMissingTable(e)) return { ok: false, reason: "setup", message: "Versions are not set up yet: the database table has not been created." };
  console.error("[development/versions]", e);
  return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Something went wrong." };
}

function docOk(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  try {
    return JSON.stringify(doc).length <= MAX_DOC;
  } catch {
    return false;
  }
}

export async function versionsList(subject: string): Promise<Result<History>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!SUBJECT.test(subject)) return invalid("Unknown subject.");
  try {
    return { ok: true, ...(await listHistory(subject, admin.userId)) };
  } catch (e) {
    return fail(e);
  }
}

/** How many saved versions each subject has: drives the badge on the tiles. */
export async function versionsCounts(): Promise<Result<{ counts: Record<string, number> }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  try {
    return { ok: true, counts: await countsBySubject() };
  } catch (e) {
    return fail(e);
  }
}

export async function versionsSave(input: { subject: string; baseId: string | null; note: string; doc: unknown; theme: string | null; branchName?: string }): Promise<Result<{ saved: VersionRow; newBranch: boolean }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!SUBJECT.test(input.subject)) return invalid("Unknown subject.");
  if (input.baseId !== null && !UUID.test(input.baseId)) return invalid("Unknown version.");
  if (!docOk(input.doc)) return invalid("That edit is empty or too large to save.");
  try {
    const out = await saveVersion({ ...input, theme: input.theme ? String(input.theme).slice(0, 80) : null, note: String(input.note ?? ""), userId: admin.userId });
    if ("needsName" in out) return { ok: false, reason: "needs-name", message: "This starts a new branch: give it a name.", suggested: out.suggested };
    return { ok: true, ...out };
  } catch (e) {
    return fail(e);
  }
}

export async function versionsAutosave(input: { subject: string; baseId: string | null; doc: unknown; theme: string | null }): Promise<Result<{ updatedAt: string }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!SUBJECT.test(input.subject)) return invalid("Unknown subject.");
  if (input.baseId !== null && !UUID.test(input.baseId)) return invalid("Unknown version.");
  if (!docOk(input.doc)) return invalid("Too large to autosave.");
  try {
    return { ok: true, ...(await saveDraft({ ...input, theme: input.theme ? String(input.theme).slice(0, 80) : null, userId: admin.userId })) };
  } catch (e) {
    return fail(e);
  }
}

export async function versionsDiscardDraft(subject: string): Promise<Result<object>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!SUBJECT.test(subject)) return invalid("Unknown subject.");
  try {
    await discardDraft(subject, admin.userId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function versionsKeep(id: string, keep: boolean): Promise<Result<object>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  if (!UUID.test(id)) return invalid("Unknown version.");
  try {
    if (keep) {
      if (!(await keepVersion(id))) return invalid("Unknown version.");
    } else await unkeepVersion(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
