"use server";

import { revalidatePath } from "next/cache";
import { deleteServiceOffering, getOrgFeed, upsertServiceOffering } from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { serviceSchema, type ServiceFormInput } from "@/lib/service-schema";
import { siteConfig } from "@/config/site";

/**
 * Server actions for /hub/services. Same contract as hidden-enneagram's
 * lib/cms/actions.ts: every action re-checks authorisation, and an offering is
 * a `threads` row (kind='service') plus its workshop_pages sidecar, written by
 * upsertServiceOffering in one transaction.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
  slug?: string;
}

export async function saveServiceAction(input: ServiceFormInput, threadId?: string): Promise<ActionResult> {
  const editor = await requireOrgEditor("/hub/services");
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;

  // The feed must exist (073's invariant): migration 121 seeds 'services'.
  const feed = await getOrgFeed(siteConfig.orgId, "services");
  if (!feed) return { ok: false, error: "The services feed is missing — run migration 121" };

  try {
    const { id, slug } = await upsertServiceOffering(
      siteConfig.orgId,
      editor.userId,
      {
        title: d.title,
        subtitle: d.subtitle || null,
        descriptionShort: d.descriptionShort || d.subtitle || null,
        body: d.body || null,
        bookingType: d.bookingType,
        format: d.format ?? null,
        price: d.price,
        currency: d.currency.toUpperCase(),
        priceSlidingMin: d.priceSlidingMin ?? null,
        slidingScaleNote: d.slidingScaleNote || null,
        sessionDurationHrs: d.sessionDurationHrs ?? null,
        recurrenceLabel: d.recurrenceLabel || null,
        location: d.location || null,
        registrationStatus: d.registrationStatus,
        status: d.status,
        visibility: "PUBLIC",
        section: "services",
      },
      threadId,
    );
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
    return { ok: false, error: "The service could not be deleted" };
  }
}
