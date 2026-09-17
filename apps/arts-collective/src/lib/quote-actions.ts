"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@elkdonis/auth-server";
import {
  deleteQuote,
  setQuoteStatus,
  submitQuote,
  type QuoteStatus,
} from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { getEditableOrgsForUser } from "@/lib/org";

// ============================================================================
// The quote desk's writes.
//
// Two scopes, two authorisations. An organisation's lines are the business of
// its owners and guides — the same people `getEditableOrgsForUser` already
// hands back. The collective's own lines (org null) belong to a platform
// admin, because they show on EVERY org's center and no single org should be
// able to put words on another's page.
//
// Anyone signed in may still add a line from the band on their own center;
// this desk is where those land and where they are let through.
// ============================================================================

const PATH = "/hub/quotes";

/** Null means the collective's own scope. Throws rather than silently no-op. */
async function authorise(userId: string, orgId: string | null): Promise<void> {
  if (orgId === null) {
    if (!(await isAdmin(userId))) {
      throw new Error("Only a platform admin edits the collective's own lines.");
    }
    return;
  }
  const editable = await getEditableOrgsForUser(userId);
  if (!editable.some((o) => o.id === orgId)) {
    throw new Error("You do not guide that organisation.");
  }
}

export async function addQuoteAction(form: FormData): Promise<void> {
  const user = await requireUser(`/login?next=${PATH}`);
  const raw = String(form.get("orgId") ?? "");
  const orgId = raw === "" || raw === "network" ? null : raw;
  await authorise(user.id, orgId);

  await submitQuote({
    orgId,
    body: String(form.get("body") ?? ""),
    attribution: String(form.get("attribution") ?? "") || null,
    source: String(form.get("source") ?? "") || null,
    submittedBy: user.id,
    // Entered from the desk by someone who may publish, so it goes up.
    status: "published",
  });
  revalidatePath(PATH);
}

export async function setQuoteStatusAction(
  id: string,
  orgId: string | null,
  status: QuoteStatus
): Promise<void> {
  const user = await requireUser(`/login?next=${PATH}`);
  await authorise(user.id, orgId);
  await setQuoteStatus(id, status);
  revalidatePath(PATH);
}

export async function setQuoteWeightAction(
  id: string,
  orgId: string | null,
  weight: number
): Promise<void> {
  const user = await requireUser(`/login?next=${PATH}`);
  await authorise(user.id, orgId);
  // Weight only sorts; the status it is already in is the status it keeps.
  await setQuoteStatus(id, "published", { weight });
  revalidatePath(PATH);
}

export async function deleteQuoteAction(id: string, orgId: string | null): Promise<void> {
  const user = await requireUser(`/login?next=${PATH}`);
  await authorise(user.id, orgId);
  await deleteQuote(id);
  revalidatePath(PATH);
}
