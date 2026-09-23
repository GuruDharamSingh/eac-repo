import { notFound } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { EMPTY_PAGE, isValidPagePath } from "@elkdonis/page-builder";
import { requireOrgEditor } from "@/lib/auth";
import { loadPage } from "@/lib/puck/store";
import { PageEditor } from "@/components/studio/page-editor";

/**
 * Edit one page — at any depth. `/studio/mixed-media/collage` edits the page
 * published at `/mixed-media/collage`.
 *
 * This was `/studio/[slug]`, a single segment, which made every nested page
 * (all of Mixed Media) impossible to open in the editor: a 404. The store has
 * always accepted paths up to MAX_PATH_DEPTH; only this route did not.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor at all, and again in savePageAction, because a client component is
 * not an authorisation boundary. `/studio/theme` and `/studio/navigation` are
 * real routes and still win over this catch-all.
 */
export const dynamic = "force-dynamic";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const slug = path.join("/");
  if (!isValidPagePath(slug)) notFound();

  await requireOrgEditor(`/studio/${slug}`);

  const page = await loadPage(slug);
  return <PageEditor slug={slug} initial={(page?.data as Data) ?? (EMPTY_PAGE as Data)} />;
}
