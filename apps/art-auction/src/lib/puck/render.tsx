import type { Metadata } from "next";
// The /rsc entry explicitly: the bare specifier only resolves to the server
// renderer because Next honours the package's react-server export condition.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder";
import { siteConfig } from "@/config/site";
import { getPagesEditor } from "./auth";
import { serverPuckConfig } from "./config.server";
import { loadPage } from "./store";
import { TEMPLATE_SLUGS } from "./reserved";

// ============================================================================
// Drawing a stored page, shared by `/<slug>` and the generated /read/<slug>.
//
// `<Render>` applies no defaults and runs no resolvers, so `resolveAllData`
// runs first: a data block stores only its settings and its rows are fetched
// here, per request. `template` marks a call from a route that draws a
// generated page from a template document; without it a template slug is
// refused, so `/article-detail` is not a public page. `metadata` reaches every
// block's resolver (`slug`, `threadId`).
// ============================================================================

const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

export async function puckPageMetadata(slug: string): Promise<Metadata | null> {
  if (!isValidSlug(slug) || TEMPLATE_SLUGS.has(slug)) return null;
  const page = await loadPage(slug, KNOWN_TYPES);
  if (!page) return null;
  const root = (page.data as Data).root;
  const title = root && "props" in root ? (root.props as { title?: string })?.title : undefined;
  return { title: title?.trim() || slug.replace(/-/g, " ") };
}

export async function renderPuckPage(
  slug: string,
  opts: { template?: boolean; metadata?: Record<string, unknown> } = {}
): Promise<React.ReactNode | null> {
  if (!isValidSlug(slug)) return null;
  if (TEMPLATE_SLUGS.has(slug) && !opts.template) return null;
  const page = await loadPage(slug, KNOWN_TYPES);
  if (!page) return null;

  const editor = await getPagesEditor();
  const resolved = await resolveAllData(page.data as Data, serverPuckConfig, {
    orgId: siteConfig.marketplaceOrgId,
    slug,
    canEdit: Boolean(editor),
    ...opts.metadata,
  });

  return (
    <>
      <Render config={serverPuckConfig} data={resolved as Data} />
      {editor ? (
        <a
          href={`/edit/${slug}`}
          className="fixed bottom-4 right-4 z-50 rounded-md border border-primary/60 bg-card px-4 py-2 text-sm font-medium text-primary shadow-lg hover:bg-primary/10"
        >
          Edit this page
        </a>
      ) : null}
    </>
  );
}
