import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isValidSlug } from "@elkdonis/page-builder";
import { templateDocument } from "@elkdonis/blocks";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { requireOrgEditor } from "@/lib/auth";
import { HOME_SLUG, loadPage } from "@/lib/puck/store";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { slugProblem } from "@/lib/puck/actions";
import { startingTemplate } from "@/lib/puck/templates";
import { loadHomeSeed } from "@/lib/puck/home-seed";
import { CanvasEditor } from "@/components/studio/CanvasEditor";
import { siteConfig } from "@/config/site";

/**
 * The canvas editor on one page: the same stored document /studio/<slug> opens in
 * Puck's editor, and the same one `/<slug>` publishes. Gated here, and again in the
 * save action, because a client component is not an authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function CanvasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  // `/` is a coded page since 2026-11-02, and draws no stored document.
  if (slug === HOME_SLUG || slug === LANDING_SLUG) redirect("/");
  await requireOrgEditor(`/studio/${slug}/canvas`);

  const problem = await slugProblem(slug, { allowTemplate: true });
  if (problem) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-serif text-2xl">That name is taken</h1>
        <p className="mt-3 text-muted-foreground">{problem} Pick another name for the page.</p>
        <a href="/manage/builder" className="mt-6 inline-block underline underline-offset-4">
          Back to the page list
        </a>
      </div>
    );
  }

  const stored = await loadPage(slug);
  // As /studio/<slug>: a page with no row opens as a starting document, saved only on Save.
  const initial = stored
    ? (stored.data as PuckDoc)
    : (templateDocument(startingTemplate(slug, undefined, await loadHomeSeed()), "") as unknown as PuckDoc);

  return <CanvasEditor slug={slug} orgId={siteConfig.orgId} initial={initial} />;
}
