import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { loadPageWithVersion } from "@/lib/puck/store";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { slugProblem } from "@/lib/puck/actions";
import { startingDocument } from "@/lib/puck/starts";
import { CanvasEditor } from "@/components/studio/CanvasEditor";
import { MobilePageEditor } from "@/components/studio/mobile-page-editor";
import { isMobileKey } from "@/lib/puck/mobile-keys";
import { loadMobileDoc } from "@/lib/puck/mobile";
import { siteConfig } from "@/config/site";

/**
 * Edit one page of the site in the canvas (canvas first, 2026-11-20, as sunjay): `/studio/walking-notes` is the page at `/walking-notes` (2026-11-06);
 * Puck's editor on the whole page is `/studio/<slug>/blocks`. The tour and
 * experience layouts keep their own studios (static routes beside this one); the landing page is edited on `/`.
 * Gated here and again in savePageAction, because a client component is not an authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function StudioPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ template?: string }> }) {
  const { slug } = await params;
  const { template: start } = await searchParams;
  if (!isValidSlug(slug)) notFound();
  if (slug === LANDING_SLUG) redirect("/");
  await requireOrgEditor(`/studio/${slug}`);

  // A phone layout (G2): /studio/m-tours edits puck:m-tours in a 390px canvas. Saved, else the code default.
  if (isMobileKey(slug)) {
    const { data } = await loadMobileDoc(slug);
    return <MobilePageEditor slug={slug} orgId={siteConfig.orgId} initial={data} />;
  }

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
  const initial = (stored ? stored.data : startingDocument(slug, start)) as PuckDoc;
  // Puck's editor opens the same starting document while nothing is saved.
  const blocks = `/studio/${slug}/blocks${!stored && start ? `?template=${encodeURIComponent(start)}` : ""}`;
  return <CanvasEditor slug={slug} orgId={siteConfig.orgId} initial={initial} version={stored?.updatedAt} blockEditorHref={blocks} />;
}
