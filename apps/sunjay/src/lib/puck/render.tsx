import type { Metadata } from "next";
// The /rsc entry explicitly, not "@puckeditor/core": the bare specifier only
// resolves to the server renderer because Next honours the package's
// react-server export condition, and nothing here would say so if that changed.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { serverPuckConfig } from "./config.server";
import { loadPage } from "./store";
import { TEMPLATE_SLUGS } from "./reserved";

// ============================================================================
// Drawing a stored page. Shared by `/` (the home page) and `/[feed]` (any
// other page), which both ask the same two questions: is there a published
// document at this name, and what is it called?
//
// `<Render>` applies no defaults and runs no resolvers, which is why
// `resolveAllData` runs first: a data block stores only its settings, and its
// rows are fetched here, per request. Without that step the page would publish
// whatever the editor had last put in the document.
// ============================================================================

const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

/** The page's own title from the editor's Page panel, or null. */
export async function puckPageMetadata(slug: string): Promise<Metadata | null> {
  if (!isValidSlug(slug) || TEMPLATE_SLUGS.has(slug)) return null;
  const page = await loadPage(slug, KNOWN_TYPES);
  if (!page) return null;
  const root = (page.data as Data).root;
  const title = root && "props" in root ? (root.props as { title?: string })?.title : undefined;
  return { title: title?.trim() || slug.replace(/-/g, " ") };
}

/**
 * The page as a node, or null when none is stored (or the row is not renderable).
 *
 * `template` marks a call from a route that draws a generated page (an event,
 * a piece) from a template document; without it a template slug is refused, so
 * `/event-detail` is not a public page. `metadata` reaches every block's
 * resolver (`threadId`, `piece`), the same channel the editor uses for `slug`.
 */
export async function renderPuckPage(
  slug: string,
  opts: { template?: boolean; metadata?: Record<string, unknown> } = {}
): Promise<React.ReactNode | null> {
  if (!isValidSlug(slug)) return null;
  if (TEMPLATE_SLUGS.has(slug) && !opts.template) return null;
  const page = await loadPage(slug, KNOWN_TYPES);
  if (!page) return null;

  const viewer = await getViewer().catch(() => null);
  const resolved = await resolveAllData(page.data as Data, serverPuckConfig, {
    orgId: siteConfig.orgId,
    slug,
    canEdit: Boolean(viewer?.canEdit),
    ...opts.metadata,
  });

  return (
    <>
      <Render config={serverPuckConfig} data={resolved as Data} />
      {viewer?.canEdit ? (
        <a
          href={`/studio/${slug}`}
          className="fixed bottom-4 right-4 z-50 border border-[hsl(var(--primary))]/60 bg-card px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] shadow-lg hover:bg-[hsl(var(--primary))]/15"
        >
          Edit this page
        </a>
      ) : null}
    </>
  );
}
