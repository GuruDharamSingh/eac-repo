"use server";

import { revalidatePath } from "next/cache";
import { createSavePageAction } from "@elkdonis/house-editor/server";
import { savePage as savePageFor } from "@elkdonis/page-builder/server";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { deletePage } from "./store";
import { LANDING_SLUG } from "./landing";
import { LANDING_RESOLVED_KEYS } from "./landing-resolved";

/**
 * Publish a page (the house's createSavePageAction).
 *
 * The role check is HERE rather than in the editor component, for the same reason the theme actions put it in
 * the action: the editor is a client component and must never be the thing deciding who may change a site. A
 * person who can reach the editor UI still cannot write without this passing. cleanBoxDoc and the resolver-key
 * strip (thread-feed items) are the factory's.
 */
const publishPage = createSavePageAction({
  orgId: siteConfig.orgId,
  gate: getApiEditor,
  denied: "Only editors can publish pages.",
  resolvedKeys: { "thread-feed": ["items"], ...LANDING_RESOLVED_KEYS },
  store: savePageFor,
  revalidate: (slug) => revalidatePath(`/p/${slug}`),
});

/**
 * `expectedUpdatedAt` is the page's version as the editor loaded it (then as each save returned it): when the
 * row has changed since, nothing is written and the answer has `stale: true`. Absent: unguarded.
 */
export async function savePageAction(
  slug: string,
  data: unknown,
  expectedUpdatedAt?: string
): Promise<{ ok: boolean; error?: string; stale?: boolean; updatedAt?: string }> {
  return publishPage(slug, data, expectedUpdatedAt);
}

/** Back to the landing page as it is written in code. Same gate as saving. */
export async function restoreLandingAction(): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can change this page." };
  return deletePage(LANDING_SLUG);
}
