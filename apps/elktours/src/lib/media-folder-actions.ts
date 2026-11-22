"use server";
// Editor actions over lib/media-folders.ts (2026-11-20): Scan a tour's or place's folder, make missing folders,
// and the reviewed registering of the old Stops/ folders (in place, no move). Owners and guides only (requireOrgEditor).

import { revalidatePath } from "next/cache";
import { requireOrgEditor } from "@/lib/auth";
import {
  allowedChoices,
  backfillFolders,
  moveItemKey,
  planStopsMove,
  registerInPlace,
  scanFolder,
  type BackfillResult,
  type MoveChoice,
  type ScanResult,
  type RegisterResult,
} from "@/lib/media-folders";
import type { Result } from "@/lib/catalogue-types";

const fail = (err: unknown, fallback: string): { ok: false; error: string } => {
  console.error("[elktours] media folder action:", err);
  return { ok: false, error: err instanceof Error ? err.message : fallback };
};

/** Register new pictures in the folder as hidden rows. */
export async function scanFolderAction(scope: { threadId: string } | { placeId: string }): Promise<Result<{ scan: ScanResult }>> {
  const viewer = await requireOrgEditor();
  try {
    const scan = await scanFolder("threadId" in scope ? { threadId: String(scope.threadId) } : { placeId: String(scope.placeId) }, viewer.userId);
    if ("threadId" in scope) revalidatePath(`/manage/tours/${scope.threadId}/assets`);
    else revalidatePath(`/manage/places/${scope.placeId}`);
    return { ok: true, scan };
  } catch (err) {
    return fail(err, "Could not scan the folder.");
  }
}

/** Folders for every tour and place that has none. */
export async function backfillFoldersAction(): Promise<Result<{ result: BackfillResult }>> {
  await requireOrgEditor();
  try {
    const result = await backfillFolders();
    revalidatePath("/manage/media-folders");
    return { ok: true, result };
  } catch (err) {
    return fail(err, "Could not make the folders.");
  }
}

/** Record what each Stops/ picture is of, where it sits. The plan is recomputed here, not taken from the browser. Nothing is moved or copied. */
export async function registerStopsAction(expectedCount: number, choices: Record<string, MoveChoice>): Promise<Result<{ result: RegisterResult }>> {
  const viewer = await requireOrgEditor();
  try {
    const plan = await planStopsMove();
    if (plan.items.length !== expectedCount) {
      return { ok: false, error: "The folders changed since this page was opened. Reload and check the list again." };
    }
    // The reviewer's per-file choices, each checked against what the file allows.
    const items = plan.items.map((it) => {
      const want = choices?.[moveItemKey(it)];
      if (want === undefined) return it;
      if (!allowedChoices(it).includes(want)) throw new Error(`${it.file}: that choice does not fit this file.`);
      return { ...it, choice: want };
    });
    const result = await registerInPlace(items, viewer.userId);
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (err) {
    return fail(err, "Could not register the pictures.");
  }
}
