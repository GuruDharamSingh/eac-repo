import type { Metadata } from "next";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { serverPuckConfig } from "./config.server";
import { loadPage } from "./store";
import { TEMPLATE_SLUGS } from "./reserved";

// ============================================================================
// A page from /manage/builder at /<slug> (2026-11-06), drawn by `/[feed]` when no
// section answers to the name. `resolveAllData` first: `<Render>` runs no
// resolvers, and a Featured person stores only who it is about.
// ============================================================================

const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

/** The page's own title from the editor's Page panel, or null when no page is stored there. */
export async function puckPageMetadata(slug: string): Promise<Metadata | null> {
  if (!isValidSlug(slug) || TEMPLATE_SLUGS.has(slug)) return null;
  const page = await loadPage(slug, KNOWN_TYPES);
  if (!page) return null;
  const root = (page.data as Data).root;
  const props = root && "props" in root ? (root.props as { title?: string }) : undefined;
  return { title: props?.title?.trim() || slug.replace(/-/g, " ") };
}

/** The page, or null when none is stored at this name (or the row cannot be drawn). */
export async function renderPuckPage(slug: string): Promise<React.ReactNode | null> {
  if (!isValidSlug(slug) || TEMPLATE_SLUGS.has(slug)) return null;
  const page = await loadPage(slug, KNOWN_TYPES);
  if (!page) return null;
  const viewer = await getViewer().catch(() => null);
  const filled = await resolveAllData(page.data as Data, serverPuckConfig, { orgId: siteConfig.orgId, slug });
  return (
    <>
      <div className="elk-page">
        <Render config={serverPuckConfig} data={filled as Data} metadata={{ orgId: siteConfig.orgId, slug }} />
      </div>
      {viewer?.canEdit ? (
        <a
          href={`/studio/${slug}`}
          className="fixed bottom-4 left-4 z-50 border border-[hsl(var(--primary))]/60 bg-card px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] shadow-lg hover:bg-[hsl(var(--primary))]/15"
        >
          Edit this page
        </a>
      ) : null}
    </>
  );
}
