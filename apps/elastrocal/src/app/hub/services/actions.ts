"use server";

import { revalidatePath } from "next/cache";
import {
  deleteServiceOffering,
  getOrgFeed,
  serviceInputFromAnswers,
  upsertServiceOffering,
  validateServiceInput,
} from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Server actions for /hub/services. Every action re-checks authorisation.
 *
 * Since 2026-09-27 the editor is the shared composer
 * (buildContentFields('service') from @elkdonis/cms-ui/compose), so the save
 * takes its answers and reads them with serviceInputFromAnswers — the same
 * translation hidden-enneagram and ArtDirect use — before
 * upsertServiceOffering writes the thread and its workshop_pages sidecar.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
  slug?: string;
}

export async function saveServiceAction(
  answers: Record<string, unknown>,
  status: "draft" | "published",
  threadId?: string
): Promise<ActionResult> {
  const editor = await requireOrgEditor("/hub/services");

  // The feed must exist (073's invariant): migration 121 seeds 'services'.
  const feed = await getOrgFeed(siteConfig.orgId, "services");
  if (!feed) return { ok: false, error: "The services feed is missing — run migration 121" };

  // Everything here is public and filed under Services; the composer offers
  // neither another page nor another audience on this site.
  const input = { ...serviceInputFromAnswers(answers, status), visibility: "PUBLIC" as const, section: "services" };
  const invalid = validateServiceInput(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    const { id, slug } = await upsertServiceOffering(siteConfig.orgId, editor.userId, input, threadId);
    revalidatePath("/services");
    revalidatePath(`/services/${slug}`);
    revalidatePath("/hub/services");
    revalidatePath("/hub");
    return { ok: true, id, slug };
  } catch (err) {
    console.error("[elastrocal] saveServiceAction", err);
    return { ok: false, error: err instanceof Error ? err.message : "The service could not be saved" };
  }
}

/** Takes a service down for good (archived, not deleted; see deleteServiceOffering). */
export async function deleteServiceAction(threadId: string): Promise<ActionResult> {
  await requireOrgEditor("/hub/services");
  try {
    const ok = await deleteServiceOffering(siteConfig.orgId, threadId);
    revalidatePath("/services");
    revalidatePath("/hub/services");
    revalidatePath("/hub");
    return ok ? { ok: true } : { ok: false, error: "Not found" };
  } catch (err) {
    console.error("[elastrocal] deleteServiceAction", err);
    return { ok: false, error: "The service could not be removed" };
  }
}
