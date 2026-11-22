import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { loadPageWithVersion } from "@/lib/puck/store";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { slugProblem } from "@/lib/puck/actions";
import { startingDocument } from "@/lib/puck/starts";
import { PageEditor } from "@/components/studio/page-editor";
import { siteConfig } from "@/config/site";

/**
 * Puck's editor on one whole page (2026-11-20, canvas first as sunjay): the canvas at /studio/<slug> is the page
 * editor; this is the same stored document in Puck, for what the canvas does not cover (the blocks drawer, many
 * rows at once). Same `puck:<slug>` row and the same stale-save guard as the canvas.
 * Gated here and again in savePageAction, because a client component is not an authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor: blocks", robots: { index: false, follow: false } };

export default async function StudioBlocksPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ template?: string }> }) {
  const { slug } = await params;
  const { template: start } = await searchParams;
  if (!isValidSlug(slug)) notFound();
  if (slug === LANDING_SLUG) redirect("/");
  await requireOrgEditor(`/studio/${slug}/blocks`);

  const problem = await slugProblem(slug);
  if (problem) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-serif text-2xl">That name is taken</h1>
        <p className="mt-3 text-muted-foreground">{problem} Pick another name for the page.</p>
        <a href="/manage/builder" className="mt-6 inline-block underline underline-offset-4">Back to the page list</a>
      </div>
    );
  }

  const stored = await loadPageWithVersion(slug);
  const initial = stored ? (stored.data as Data) : startingDocument(slug, start);
  return <PageEditor slug={slug} orgId={siteConfig.orgId} initial={initial} version={stored?.updatedAt} />;
}
