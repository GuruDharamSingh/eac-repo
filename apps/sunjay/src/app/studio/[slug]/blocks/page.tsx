import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder";
import { templateDocument } from "@elkdonis/blocks";
import { requireOrgEditor } from "@/lib/auth";
import { loadPageWithVersion, HOME_SLUG } from "@/lib/puck/store";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { slugProblem } from "@/lib/puck/actions";
import { allTemplates, startingTemplate } from "@/lib/puck/templates";
import { loadHomeSeed } from "@/lib/puck/home-seed";
import { PageEditor } from "@/components/studio/page-editor";
import { siteConfig } from "@/config/site";
import { recordQuery, studioRecord } from "../record";

/**
 * Puck's editor on one whole page (moved here from /studio/<slug> on 2026-11-14,
 * canvas first, as hidden-enneagram did on 2026-11-11): the canvas at
 * /studio/<slug> is the page editor; one block's settings open in Puck over it
 * ("Settings…"). This is the whole document in Puck, for what that sheet does
 * not cover (the templates drawer, many rows at once). Same stored document,
 * same save.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor at all, and again in savePageAction, because a client component is not
 * an authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor: blocks", robots: { index: false, follow: false } };

export default async function StudioBlocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string; thread?: string; piece?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { template: start } = query;
  const record = studioRecord(slug, query);
  if (!isValidSlug(slug)) notFound();
  // The home page's tree is edited on `/`, where its live pieces are.
  if (slug === LANDING_SLUG) redirect("/");
  await requireOrgEditor(`/studio/${slug}/blocks${recordQuery(record)}`);

  // A name the site already uses (a section, /hub, /about) cannot hold a page.
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

  const seed = await loadHomeSeed();
  const templates = allTemplates(seed);

  const stored = await loadPageWithVersion(slug);
  // A page that does not exist yet opens as a starting document rather than a
  // 404. Nothing is saved until Publish.
  const initial = stored
    ? (stored.data as Data)
    : (templateDocument(startingTemplate(slug, start, seed), slug === HOME_SLUG ? "Home" : "") as unknown as Data);

  return (
    <PageEditor
      slug={slug}
      orgId={siteConfig.orgId}
      initial={initial}
      version={stored?.updatedAt}
      templates={templates}
      metadata={{ ...record }}
    />
  );
}
