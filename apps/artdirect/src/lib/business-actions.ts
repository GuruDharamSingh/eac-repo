"use server";
// CONTRACT: ArtDirect business page actions: claim (stub submission into business_claims) and removal request.

import { revalidatePath } from "next/cache";
import { getBusinessListing, requestBusinessClaim, requestBusinessRemoval, type BusinessClaimMethod } from "@elkdonis/services/businesses";
import { getCurrentUser } from "@/lib/session";

export type BusinessActionState = { ok: boolean; message: string } | null;

const METHODS: BusinessClaimMethod[] = ["domain_email", "phone", "document", "in_person", "steward_vouch"];

/**
 * "Is this your business? Claim it." Signed-in people only. Stub: the claim is recorded
 * (method + contact + role + message) for a platform admin, or the steward's owners for
 * in-person claims, to decide. Nothing changes on the page until it is approved.
 */
export async function claimBusinessAction(_prev: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first, then send the claim." };
  const businessUserId = String(form.get("businessUserId") ?? "");
  const method = String(form.get("method") ?? "") as BusinessClaimMethod;
  if (!METHODS.includes(method)) return { ok: false, message: "Choose how we can check that it is yours." };
  const b = await getBusinessListing(businessUserId);
  if (!b || b.status !== "shell") return { ok: false, message: "This listing cannot be claimed." };
  const text = (k: string, max: number) => String(form.get(k) ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max) || null;
  const res = await requestBusinessClaim({
    businessUserId,
    claimantUserId: user.id,
    method,
    evidence: { role: text("role", 200), contact: text("contact", 300), accountEmail: user.email },
    message: text("message", 4000),
  });
  if (!res.ok) return { ok: false, message: (res as { error: string }).error };
  return { ok: true, message: "Thank you. We will check and get back to you; the page stays as it is until then." };
}

/**
 * "Ask us to remove it." Anyone. While unclaimed the listing is removed at once (kept only
 * as a tombstone so it is not re-listed); a claimed listing is handled within 30 days.
 */
export async function requestBusinessRemovalAction(_prev: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  const user = await getCurrentUser().catch(() => null);
  const businessUserId = String(form.get("businessUserId") ?? "");
  const reason = String(form.get("reason") ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 1000);
  const contact = String(form.get("contact") ?? "").trim().slice(0, 300);
  if (!user && !contact) return { ok: false, message: "Leave an email or phone so we can confirm." };
  const b = await getBusinessListing(businessUserId);
  if (!b || b.status === "removed") return { ok: false, message: "This listing is already gone." };
  const res = await requestBusinessRemoval({ businessUserId, requesterUserId: user?.id ?? null, reason, contact });
  if (!res.ok) return { ok: false, message: (res as { error: string }).error };
  revalidatePath(`/${b.slug}`);
  revalidatePath("/");
  return res.removed
    ? { ok: true, message: "Removed. The listing is no longer shown anywhere on the network." }
    : { ok: true, message: "Received. We will act on it within 30 days." };
}
