"use server";

import { getNetworkAdmin } from "@/lib/gate";
import { discardDraft, isMissingTable, keepVersion, listHistory, saveDraft, saveVersion, unkeepVersion } from "@/lib/versions";
import type { Fail, History, Result, VersionRow } from "@/lib/versions-types";
import { courseById } from "./data";
import type { RailDoc, RailStep, Weight } from "./types";
import { railSubject } from "./types";

// ============================================================================
// Server actions for editing a trail. Every one starts with getNetworkAdmin().
// They only ever touch dev_versions rows whose subject is `rail:<course id>`:
// nothing here writes to the atlas or to the live courses.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEIGHTS = new Set<Weight>(["essential", "optional", "later"]);

const denied: Fail = { ok: false, reason: "denied", message: "Only network admins can edit trails." };
const invalid = (message: string): Fail => ({ ok: false, reason: "invalid", message });

function fail(e: unknown): Fail {
  if (isMissingTable(e)) return { ok: false, reason: "setup", message: "Saving is not set up yet: the database table has not been created." };
  console.error("[development/rails]", e);
  return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Something went wrong." };
}

/** Accepts only the shape we store; anything else is refused. Text is plain and length-capped. */
function cleanDoc(input: unknown): RailDoc | null {
  if (!input || typeof input !== "object") return null;
  const d = input as { steps?: unknown; note?: unknown };
  if (!Array.isArray(d.steps) || d.steps.length > 300) return null;
  const steps: RailStep[] = [];
  for (const s of d.steps) {
    if (!s || typeof s !== "object") return null;
    const r = s as { cap?: unknown; gap?: unknown; weight?: unknown; note?: unknown };
    const cap = typeof r.cap === "string" ? r.cap.slice(0, 120) : undefined;
    const gap = typeof r.gap === "string" ? r.gap.slice(0, 300) : undefined;
    if (!cap && !gap) return null;
    const weight = WEIGHTS.has(r.weight as Weight) ? (r.weight as Weight) : "essential";
    steps.push({ ...(cap ? { cap } : { gap }), weight, note: typeof r.note === "string" ? r.note.slice(0, 600) : "" });
  }
  return { steps, note: typeof d.note === "string" ? d.note.slice(0, 600) : "" };
}

function subjectFor(course: string): string | null {
  return courseById.has(course) ? railSubject(course) : null;
}

export async function railsList(course: string): Promise<Result<History>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const subject = subjectFor(course);
  if (!subject) return invalid("Unknown course.");
  try {
    return { ok: true, ...(await listHistory(subject, admin.userId)) };
  } catch (e) {
    return fail(e);
  }
}

export async function railsAutosave(input: { course: string; baseId: string | null; doc: unknown }): Promise<Result<{ updatedAt: string }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const subject = subjectFor(input.course);
  if (!subject) return invalid("Unknown course.");
  if (input.baseId !== null && !UUID.test(input.baseId)) return invalid("Unknown version.");
  const doc = cleanDoc(input.doc);
  if (!doc) return invalid("That edit is not in a shape that can be saved.");
  try {
    return { ok: true, ...(await saveDraft({ subject, baseId: input.baseId, doc, theme: null, userId: admin.userId })) };
  } catch (e) {
    return fail(e);
  }
}

export async function railsSave(input: { course: string; baseId: string | null; note: string; doc: unknown; branchName?: string }): Promise<Result<{ saved: VersionRow; newBranch: boolean }>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const subject = subjectFor(input.course);
  if (!subject) return invalid("Unknown course.");
  if (input.baseId !== null && !UUID.test(input.baseId)) return invalid("Unknown version.");
  const doc = cleanDoc(input.doc);
  if (!doc) return invalid("That edit is not in a shape that can be saved.");
  try {
    const out = await saveVersion({ subject, baseId: input.baseId, note: String(input.note ?? "").slice(0, 280), doc, theme: null, branchName: input.branchName, userId: admin.userId });
    if ("needsName" in out) return { ok: false, reason: "needs-name", message: "This starts a new branch: give it a name.", suggested: out.suggested };
    return { ok: true, ...out };
  } catch (e) {
    return fail(e);
  }
}

export async function railsDiscard(course: string): Promise<Result<object>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const subject = subjectFor(course);
  if (!subject) return invalid("Unknown course.");
  try {
    await discardDraft(subject, admin.userId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function railsKeep(course: string, id: string, keep: boolean): Promise<Result<object>> {
  const admin = await getNetworkAdmin();
  if (!admin) return denied;
  const subject = subjectFor(course);
  if (!subject) return invalid("Unknown course.");
  if (!UUID.test(id)) return invalid("Unknown version.");
  try {
    // Only versions of this course's own trail may be kept from here.
    const h = await listHistory(subject, admin.userId);
    if (!h.versions.some((v) => v.id === id)) return invalid("Unknown version.");
    if (keep) await keepVersion(id);
    else await unkeepVersion(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
