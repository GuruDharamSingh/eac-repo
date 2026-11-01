// The /rsc entry explicitly, not "@puckeditor/core": the bare specifier only
// resolves to the server renderer because Next honours the package's
// react-server export condition, and nothing here would say so if that changed.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import type { ReactNode } from "react";
import { validatePage } from "@elkdonis/page-builder";
import { KNOWN_TYPES, serverPuckConfig } from "./config.server";
import { HOME_SLUG, loadOrgHome } from "./store";

/**
 * An org's designed landing page as a node, or null when none is published
 * (or the stored row is not renderable: `loadPage` validates and returns null).
 *
 * `<Render>` applies no defaults and runs no resolvers, which is why
 * `resolveAllData` runs first: the feed, offering and people blocks store
 * only their settings, and their rows are fetched here, per request, for the
 * org in the metadata.
 */
export async function renderOrgHome(org: {
  id: string;
  slug: string;
}, opts: { canEdit?: boolean } = {}): Promise<ReactNode | null> {
  const page = await loadOrgHome(org.id, KNOWN_TYPES);
  if (!page) return null;
  // `puck:home` is also the key the template apps use for their own home
  // page (sunjay, danamccool), with blocks this catalogue does not have.
  // `loadPage` only warns about an unknown block and `<Render>` would draw
  // the rest, so a page with any unknown block is treated as not this
  // site's and the root falls back to the offering or the default page.
  const check = validatePage(page.data, KNOWN_TYPES);
  if (check.warnings.some((w) => w.message.startsWith("Unknown block"))) return null;
  const resolved = await resolveAllData(page.data as Data, serverPuckConfig, {
    orgId: org.id,
    orgSlug: org.slug,
    slug: HOME_SLUG,
    canEdit: Boolean(opts.canEdit),
  });
  return <Render config={serverPuckConfig} data={resolved as Data} />;
}
