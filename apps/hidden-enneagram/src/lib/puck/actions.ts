"use server";

import { revalidatePath } from "next/cache";
import { createSavePageAction } from "@elkdonis/house-editor/server";
import { isValidSlug, savePage as savePageFor } from "@elkdonis/page-builder/server";
import { getApiEditor } from "@/lib/auth";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { siteConfig } from "@/config/site";
import { HOME_SLUG, ROUTE_SLUGS } from "./store";

// Publish a page (katie's action, now the house's factory). The role check is HERE, not in the editor component:
// a client component is not an authorisation boundary. Resolver-filled props (the course, the placement) are
// stripped before the page is stored and cleanBoxDoc keeps each node's look (`morph`) to its known shape, both by
// the factory. `expectedUpdatedAt` is the page's version as the editor loaded it: a changed row answers stale.
const publishPage = createSavePageAction({
  orgId: siteConfig.orgId,
  gate: getApiEditor,
  denied: "Only the site's editors can publish pages.",
  slugProblem: (slug) => (!isValidSlug(slug) || ROUTE_SLUGS.has(slug) ? "That address belongs to another part of the site." : null),
  resolvedKeys: RESOLVED_KEYS,
  store: savePageFor,
  revalidate: (slug) => revalidatePath(slug === HOME_SLUG ? "/" : `/${slug}`),
});

export async function savePageAction(
  slug: string,
  data: unknown,
  expectedUpdatedAt?: string,
): Promise<{ ok: boolean; error?: string; stale?: boolean; updatedAt?: string }> {
  return publishPage(slug, data, expectedUpdatedAt);
}
