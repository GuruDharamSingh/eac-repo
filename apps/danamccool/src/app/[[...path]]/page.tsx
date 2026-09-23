import { notFound } from "next/navigation";
import type { Metadata } from "next";
// The /rsc entry explicitly — see the note in /p/[slug]. The bare specifier
// only resolves to the server renderer because Next honours the package's
// react-server condition.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { isValidPagePath } from "@elkdonis/page-builder";
import { currentOrgId } from "@/lib/site-org";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { loadPage } from "@/lib/puck/store";
import { getViewer } from "@/lib/auth";

// ============================================================================
// Every URL this site has not already claimed.
//
// This is what turns the editor from "a way to make extra pages at /p/…" into
// a way to build the site itself: a page published as `about` answers at
// /about, not at /p/about.
//
// The migration path falls out of Next's own routing rules rather than needing
// any logic here. A static route is more specific than a catch-all, so every
// hand-written page keeps winning until it is DELETED — at which point the
// Puck page at that slug takes the URL over. One page at a time, reversible by
// restoring the file, with no flag day.
//
// `[[...path]]` — the OPTIONAL catch-all, so this answers "/" as well.
// app/page.tsx is gone; the home page is a document like any other, stored
// under the slug `home`.
//
// What it does NOT swallow: every static route still wins, which is what keeps
// /studio, /manage, /login, /api and a future /hub reachable. Reserving a path
// from the editor is therefore just having a real route at it.
// ============================================================================

export const dynamic = "force-dynamic";

const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

/**
 * The stored key for a URL path. `/about/press` → `about/press`.
 *
 * "/" arrives as no segments at all and maps to `home` — a name an editor can
 * see and publish to, rather than an empty string that would be invisible in
 * the page list and unusable as a storage key.
 */
export const HOME_SLUG = "home";

function pathKey(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return HOME_SLUG;
  const key = segments.join("/");
  return isValidPagePath(key) ? key : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  const key = pathKey(path);
  if (!key) return {};
  const page = await loadPage(key, KNOWN_TYPES);
  const root = (page?.data as Data | undefined)?.root;
  const title = root && "props" in root ? (root.props as { title?: string })?.title : undefined;
  return { title: title?.trim() || key.split("/").pop()?.replace(/-/g, " ") };
}

export default async function EditorBuiltPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const key = pathKey(path);
  if (!key) notFound();

  const page = await loadPage(key, KNOWN_TYPES);
  // Covers "no such page" and "stored but not renderable" alike — loadPage
  // returns null for both. A 404 is the truth in either case.
  if (!page) notFound();

  // `canEdit` lets a block offer in-place editing to the site's editors on
  // the published page (the Gallery grid's drag and resize). Blocks that do
  // not ask for it ignore it.
  const viewer = await getViewer().catch(() => null);
  const resolved = await resolveAllData(page.data as Data, serverPuckConfig, {
    orgId: currentOrgId(),
    slug: key,
    canEdit: Boolean(viewer?.canEdit),
  });

  return (
    <>
      <Render config={serverPuckConfig} data={resolved as Data} />
      {viewer?.canEdit ? (
        // The way into the editor from the page itself. The landing page hides
        // the whole sidebar (the diamond splash), so without this there was no
        // link to edit it from anywhere on it.
        <a className="dm-edit-page" href={`/studio/${key}`}>
          Edit this page
        </a>
      ) : null}
    </>
  );
}
