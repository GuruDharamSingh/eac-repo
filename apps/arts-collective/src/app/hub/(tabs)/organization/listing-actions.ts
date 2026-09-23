"use server";

import { revalidatePath } from "next/cache";
import { decideListingRequest } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Answer an ask to be shown (migration 149). The role check lives in
 * decideListingRequest, against the database — this action only supplies
 * who is asking.
 */
export async function decideListingRequestAction(
  orgId: string,
  requestId: string,
  decision: "approve" | "decline"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (decision !== "approve" && decision !== "decline") return { ok: false, error: "Bad request." };
  const result = await decideListingRequest(user.id, orgId, requestId, decision);
  if (result.ok) revalidatePath("/hub/organization");
  return result;
}
