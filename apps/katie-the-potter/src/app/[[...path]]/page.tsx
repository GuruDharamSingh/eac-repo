import { notFound } from "next/navigation";
import type { Metadata } from "next";
// The /rsc entry explicitly: the bare specifier only resolves to the server
// renderer because Next honours the package's react-server condition.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
// The /server entry, not the package's main: since 2026-11-06 the main entry
// re-exports the parts plugin's store (a React hook), which a Server
// Component may not import.
import { isValidPagePath } from "@elkdonis/page-builder/server";
import { currentOrgId } from "@/lib/site-org";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { HOME_SLUG, loadPage, TEMPLATE_SLUGS } from "@/lib/puck/store";
import { DEFAULT_HOME } from "@/lib/default-home";
import { getViewer } from "@/lib/auth";

// ============================================================================
// Every URL this site has not already claimed (danamccool's pattern).
//
// `/` is the document stored under the slug `home`. Until Katie (or whoever
// sets the site up) publishes one from the studio, `/` draws DEFAULT_HOME —
// the landing and the grid as written in code (sunjay's "code until saved"
// idea, with a Puck document instead of hand-written JSX). Any other path is
// a page published at that slug, or a 404.
// ============================================================================

export const dynamic = "force-dynamic";

const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

function pathKey(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return HOME_SLUG;
  const key = segments.join("/");
  // A template (piece-detail) draws other pages; it is never a page of its own.
  return isValidPagePath(key) && !TEMPLATE_SLUGS.has(key) ? key : null;
}

/** The stored document, or the code default for the home page. */
async function pageData(key: string): Promise<Data | null> {
  const page = await loadPage(key, KNOWN_TYPES);
  if (page) return page.data as Data;
  return key === HOME_SLUG ? (DEFAULT_HOME as Data) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const key = pathKey(path);
  if (!key) return {};
  const data = await pageData(key);
  const root = data?.root;
  const title = root && "props" in root ? (root.props as { title?: string })?.title : undefined;
  if (key === HOME_SLUG) return {};
  return { title: title?.trim() || key.split("/").pop()?.replace(/-/g, " ") };
}

export default async function EditorBuiltPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const key = pathKey(path);
  if (!key) notFound();

  const data = await pageData(key);
  if (!data) notFound();

  const viewer = await getViewer().catch(() => null);
  const resolved = await resolveAllData(data, serverPuckConfig, {
    orgId: currentOrgId(),
    slug: key,
    canEdit: Boolean(viewer?.canEdit),
  });

  return (
    <div className="ktp-content">
      <Render config={serverPuckConfig} data={resolved as Data} />
      {viewer?.canEdit ? (
        <a className="ktp-edit-page" href={`/studio/${key}`}>
          Edit this page
        </a>
      ) : null}
    </div>
  );
}
