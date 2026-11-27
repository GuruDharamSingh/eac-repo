"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { ActionResult } from "@/lib/tour-actions";
import { fixturesOn, PREVIEW_REFUSAL } from "@/lib/tour-slot-fixtures";
import { listOverlaps, pairOf, type Overlap } from "@/lib/slot-overlaps";

/**
 * Overlap notices (lib/slot-overlaps.ts): list them and dismiss them. A guide sees and dismisses their own; owners
 * all. A dismissal hides the notice for everyone on the site; the schedule keeps flagging the overlap itself.
 */

const ORG = siteConfig.orgId;

async function scope() {
  const viewer = await requireOrgEditor();
  return { viewer, guideUserId: viewer.role === "owner" ? undefined : viewer.userId };
}

function revalidate() {
  revalidatePath("/hub");
  revalidatePath("/manage");
  revalidatePath("/manage/overlaps");
}

export async function listOverlapsAction(): Promise<ActionResult<{ overlaps: Overlap[] }>> {
  const { guideUserId } = await scope();
  try {
    return { ok: true, overlaps: await listOverlaps({ guideUserId }) };
  } catch (err) {
    console.error("[elktours] listOverlapsAction:", err);
    return { ok: false, error: "Could not load the overlaps." };
  }
}

async function insertDismissals(pairs: Array<[string, string]>, userId: string): Promise<void> {
  for (const [a, b] of pairs) {
    await db`
      INSERT INTO booking_clash_dismissals (slot_a, slot_b, org_id, dismissed_by)
      VALUES (${a}, ${b}, ${ORG}, ${userId})
      ON CONFLICT (slot_a, slot_b) DO NOTHING
    `;
  }
}

function refusal(err: unknown): string {
  return (err as { code?: string }).code === "42P01" ? "Dismissing needs migration 291 to be applied." : "Could not dismiss it.";
}

/** Dismiss one overlap notice (the pair of slots, in either order). */
export async function dismissOverlap(slotA: string, slotB: string): Promise<ActionResult> {
  const { viewer, guideUserId } = await scope();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  try {
    const [a, b] = pairOf(slotA, slotB);
    // Only a pair the viewer may see: it must be a current overlap of their own (owners: any).
    const mine = (await listOverlaps({ guideUserId })).some((o) => o.key === `${a}:${b}`);
    if (!mine) return { ok: false, error: "That overlap is no longer there." };
    await insertDismissals([[a, b]], viewer.userId);
    revalidate();
    return { ok: true };
  } catch (err) {
    console.error("[elktours] dismissOverlap:", err);
    return { ok: false, error: refusal(err) };
  }
}

/** Dismiss every overlap notice the viewer can see. */
export async function dismissAllOverlaps(): Promise<ActionResult<{ dismissed: number }>> {
  const { viewer, guideUserId } = await scope();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  try {
    const all = await listOverlaps({ guideUserId });
    await insertDismissals(all.map((o) => pairOf(o.a.slotId, o.b.slotId)), viewer.userId);
    revalidate();
    return { ok: true, dismissed: all.length };
  } catch (err) {
    console.error("[elktours] dismissAllOverlaps:", err);
    return { ok: false, error: refusal(err) };
  }
}
