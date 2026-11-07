import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { currentOrgId } from "@/lib/site-org";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { loadPage } from "@/lib/puck/store";
import { getViewer } from "@/lib/auth";

// ============================================================================
// Draw one studio page (server only): the stored document, else `fallback`
// (a code default), resolved and rendered, with "Edit this page" for the
// site's editors. `<Render>` applies no defaults and runs no resolvers, so
// resolveAllData always runs first. Returns null when there is nothing to draw.
// ============================================================================

export const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

export async function pageData(slug: string, fallback?: unknown): Promise<Data | null> {
  const page = await loadPage(slug, KNOWN_TYPES).catch((err) => {
    console.error("[hidden-enneagram] loadPage:", slug, err);
    return null;
  });
  if (page) return page.data as Data;
  return fallback ? (fallback as Data) : null;
}

/** The page's title from its root props, if it set one. */
export function titleOf(data: Data | null): string | undefined {
  const root = data?.root;
  const title = root && "props" in root ? (root.props as { title?: unknown })?.title : undefined;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

export async function PuckPage({ slug, data }: { slug: string; data: Data }) {
  const viewer = await getViewer().catch(() => null);
  const resolved = await resolveAllData(data, serverPuckConfig, {
    orgId: currentOrgId(),
    slug,
    canEdit: Boolean(viewer?.canEdit),
  });
  return (
    <main className="he-content">
      <Render config={serverPuckConfig} data={resolved as Data} />
      {viewer?.canEdit ? (
        <a className="he-edit-page" href={`/studio/${slug}`} data-de-ui="">
          Edit this page
        </a>
      ) : null}
    </main>
  );
}
