"use server";

import { revalidatePath } from "next/cache";
import {
  draftAgreement,
  updateDraftAgreement,
  publishAgreement,
  retireAgreement,
  acceptAgreement,
  revokeAcceptance,
  getAgreement,
} from "@elkdonis/services/agreements";
import { hasOrgRole } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { requireUser } from "@/lib/session";

// ============================================================================
// Server actions for the agreements console.
//
// Every authoring action is gated on being an OWNER of the org in question,
// re-checked here rather than trusted from the page that rendered the form —
// these decide what percentage of someone's sale another party takes, so the
// org id arrives from the client and must be verified against the caller on
// every call.
//
// Accepting is the mirror image: a person acts only for themselves, so those
// actions take no org id at all and use the session user.
// ============================================================================

type Result = { ok: boolean; error?: string; id?: string };

async function requireOwner(orgId: string): Promise<{ userId: string } | { error: string }> {
  const user = await requireUser();
  if (!(await hasOrgRole(user.id, orgId, ["owner"]))) {
    return { error: "Only an owner of this organisation can change its agreements." };
  }
  return { userId: user.id };
}

/** Owner of `agreementId`'s org, looked up from the agreement itself. */
async function requireOwnerOfAgreement(
  agreementId: string
): Promise<{ userId: string; orgId: string } | { error: string }> {
  const agreement = await getAgreement(agreementId);
  if (!agreement) return { error: "Agreement not found." };
  const gate = await requireOwner(agreement.orgId);
  if ("error" in gate) return gate;
  return { userId: gate.userId, orgId: agreement.orgId };
}

function slugKey(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "agreement"
  );
}

export async function createAgreementAction(input: {
  orgId: string;
  key?: string;
  title: string;
  summary?: string;
  bodyHtml?: string;
  revenueSharePercent: number;
  requiresAcceptance?: boolean;
}): Promise<Result> {
  const gate = await requireOwner(input.orgId);
  if ("error" in gate) return { ok: false, error: gate.error };

  if (!input.title?.trim()) return { ok: false, error: "A title is required." };
  const share = Number(input.revenueSharePercent);
  if (!Number.isFinite(share) || share < 0 || share > 100) {
    return { ok: false, error: "The share must be a number between 0 and 100." };
  }

  try {
    const agreement = await draftAgreement({
      orgId: input.orgId,
      // A stable key groups versions of the same agreement. Derived from the
      // title on first draft; reusing an existing key starts a new version of
      // that agreement rather than a separate one.
      key: input.key?.trim() || slugKey(input.title),
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      bodyHtml: input.bodyHtml ? sanitizeRichText(input.bodyHtml) : null,
      revenueSharePercent: share,
      requiresAcceptance: input.requiresAcceptance ?? true,
      createdBy: gate.userId,
    });
    revalidatePath("/hub/agreements");
    return { ok: true, id: agreement.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateAgreementAction(
  agreementId: string,
  patch: { title?: string; summary?: string; bodyHtml?: string; revenueSharePercent?: number }
): Promise<Result> {
  const gate = await requireOwnerOfAgreement(agreementId);
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    await updateDraftAgreement(agreementId, {
      ...patch,
      bodyHtml: patch.bodyHtml ? sanitizeRichText(patch.bodyHtml) : patch.bodyHtml,
    });
    revalidatePath("/hub/agreements");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function publishAgreementAction(agreementId: string): Promise<Result> {
  const gate = await requireOwnerOfAgreement(agreementId);
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    await publishAgreement(agreementId);
    revalidatePath("/hub/agreements");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function retireAgreementAction(agreementId: string): Promise<Result> {
  const gate = await requireOwnerOfAgreement(agreementId);
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    await retireAgreement(agreementId);
    revalidatePath("/hub/agreements");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** A member accepts for themselves. No org gate — they act only for themselves. */
export async function acceptAgreementAction(agreementId: string): Promise<Result> {
  const user = await requireUser();
  const res = await acceptAgreement(agreementId, user.id);
  revalidatePath("/hub/agreements");
  return res;
}

export async function revokeAgreementAction(agreementId: string): Promise<Result> {
  const user = await requireUser();
  await revokeAcceptance(agreementId, user.id);
  revalidatePath("/hub/agreements");
  return { ok: true };
}
