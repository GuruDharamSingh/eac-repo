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
import { recordQuery, studioRecord } from "./record";

/**
 * Edit one page in the canvas (2026-11-14, canvas first, as hidden-enneagram on
 * 2026-11-11): `/studio/visiting` is the page published at `/visiting`,
 * `/studio/event-detail` the template every gathering's detail page is drawn
 * from. One block's settings open in Puck over the canvas ("Settings…"); Puck's
 * editor on the whole page is at /studio/<slug>/blocks. The old address
 * /studio/<slug>/canvas comes here.
 *
 * Gated here, and again in the save action, because a client component is not
 * an authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string; thread?: string; piece?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { template } = query;
  // A template opened on one record ("Edit this page's layout" on a gathering, post or piece): drawn with THAT record.
  const record = studioRecord(slug, query);
  if (!isValidSlug(slug)) notFound();
  // `/` is a coded page since 2026-11-02 and is edited in place there ("Edit page").
  if (slug === HOME_SLUG || slug === LANDING_SLUG) redirect("/");
  await requireOrgEditor(`/studio/${slug}${recordQuery(record, { template })}`);

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
  // A page with no row opens as its starting document (the New page form's choice), saved only on Save.
  const initial = stored
    ? (stored.data as PuckDoc)
    : (templateDocument(startingTemplate(slug, template, await loadHomeSeed()), "") as unknown as PuckDoc);
  // Puck's editor opens the same starting document while nothing is saved.
  const blocks = `/studio/${slug}/blocks${recordQuery(record, { template: !stored ? template : undefined })}`;

  return <CanvasEditor slug={slug} orgId={siteConfig.orgId} initial={initial} blockEditorHref={blocks} record={record} />;
}
