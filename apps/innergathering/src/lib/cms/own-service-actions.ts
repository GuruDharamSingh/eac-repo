"use server";

/**
 * The person's own services, offered on their ArtDirect page, from the Center's
 * ArtDirect journey. Same path ArtDirect's "Manage your space" uses
 * (`saveOffering` in @elkdonis/services, homed in `oad`, author-only), so a
 * service written here is the one ArtDirect lists and sells. This file
 * supplies who is asking; every write matches the author against the session.
 * A service with a price books and pays by card through Stripe once the person
 * has a payout account (the journey's "Get paid" step).
 */

import { listOfferings, saveOffering, setOfferingStatus } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

export async function listOwnServicesAction() {
  const viewer = await getViewer();
  if (!viewer) return [];
  const rows = await listOfferings(viewer.userId, { includeDrafts: true });
  return rows
    .filter((o) => o.kind === "service")
    .map((o) => ({
      id: o.id,
      title: o.title,
      price: o.price ?? 0,
      currency: o.currency ?? "CAD",
      status: (o.status === "published" ? "published" : "draft") as "draft" | "published",
      format: (o.isOnline ? "online" : null) as "online" | "in_person" | "hybrid" | null,
      shortDescription: o.excerpt,
    }));
}

export async function saveOwnServiceAction(
  input: { title: string; shortDescription: string; price: string; format: "online" | "in_person" | "hybrid"; status: "draft" | "published" },
  id?: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const price = input.price.trim() === "" ? 0 : Number(input.price);
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Price must be a number, or blank for free." };
  const r = await saveOffering(
    viewer.userId,
    {
      kind: "service",
      title: input.title,
      excerpt: input.shortDescription.trim() || null,
      body: input.shortDescription.trim() ? `<p>${input.shortDescription.trim().replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : "",
      status: input.status,
      visibility: "PUBLIC",
      shareToNetwork: true,
      price,
      currency: "CAD",
      format: input.format,
    },
    id ?? undefined
  ).catch((err) => {
    console.error("[innergathering] saveOwnServiceAction:", err);
    return { ok: false, error: "Could not save. Try again." } as const;
  });
  if (r.ok === false || !r.id) return { ok: false, error: r.error ?? "Could not save." };
  return { ok: true, id: r.id };
}

export async function setOwnServiceStatusAction(id: string, status: "draft" | "published") {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const ok = await setOfferingStatus(viewer.userId, id, status);
  return ok ? { ok: true } : { ok: false, error: "Not found." };
}
