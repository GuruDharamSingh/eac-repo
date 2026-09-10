"use server";

import { revalidatePath } from "next/cache";
import {
  ensureWorkshopMaterialsFolder,
  upsertWorkshopOffering,
  type WorkshopOfferingInput,
} from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { shareWorkshopMaterials } from "@/lib/workshop-share";
import { siteConfig } from "@/config/site";
import type { ActionResult } from "@/lib/cms/actions";

/**
 * Save a workshop from the compose surface.
 *
 * Workshops are not `saveContentAction`'s shape — they carry a
 * `workshop_pages` row and `workshop_sessions` — so they go through the
 * shared `upsertWorkshopOffering` in @elkdonis/services. (arts-collective's
 * wizard still writes those tables with its own SQL; this is the layer it
 * should move onto.) Authorisation is re-checked here; a server action is a
 * public endpoint.
 *
 * Saving also makes sure the workshop's materials folder exists and that the
 * author holds it in Nextcloud, so the workspace is there from the first
 * draft rather than appearing at some later step nobody remembers to take.
 */
export async function saveWorkshopAction(
  input: WorkshopOfferingInput,
  threadId?: string
): Promise<ActionResult> {
  const editor = await requireOrgEditor();
  if (!input.title?.trim()) return { ok: false, error: "Give it a title" };

  try {
    const saved = await upsertWorkshopOffering(siteConfig.orgId, editor.userId, input, threadId);
    // Whoever saves holds the folder read/write: on a first save that is the
    // author; on a later edit it is a co-guide who now also gets the desk.
    void ensureWorkshopMaterialsFolder(siteConfig.orgId, saved.id).then((ok) => {
      if (ok) return shareWorkshopMaterials(saved.id, editor.userId, "author");
    });
    const section = input.section ?? "offerings";
    revalidatePath("/");
    revalidatePath(`/${section}`);
    revalidatePath(`/${section}/${saved.slug}`);
    revalidatePath("/hub");
    return { ok: true, id: saved.id, path: `/${section}/${saved.slug}` };
  } catch (err) {
    console.error("[innergathering] saveWorkshopAction:", err);
    return { ok: false, error: "Could not save the workshop." };
  }
}
