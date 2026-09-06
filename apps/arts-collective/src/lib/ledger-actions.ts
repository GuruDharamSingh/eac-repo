"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@elkdonis/auth-server";
import { releaseHold } from "@elkdonis/commerce/ledger";
import { requireUser } from "@/lib/session";

/**
 * Releasing held money is a network-admin action, not an org-owner one.
 *
 * An org is not allowed to free its own held balance: the money sits with the
 * collective, and letting the party owed it decide when it becomes payable
 * would make the hold meaningless. Owners see their balance on the agreements
 * page; only the collective releases.
 */
export async function releaseHoldAction(
  entryId: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) {
    return { ok: false, error: "Only the collective can release held funds." };
  }
  const res = await releaseHold({
    entryId,
    releasedBy: user.id,
    note: note?.trim() || undefined,
  });
  revalidatePath("/hub/admin/ledger");
  return res;
}
