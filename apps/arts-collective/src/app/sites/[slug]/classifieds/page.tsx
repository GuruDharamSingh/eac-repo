import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getOrgFeed } from "@/lib/org";
import { loadSiteContext } from "@/lib/site-context";
import { loadClassifieds } from "@/lib/classifieds/store";
import { classifiedsFontsHref } from "@/lib/classifieds/catalog";
import { ClassifiedSheet, type LinkedThread } from "@/components/classifieds/ClassifiedSheet";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadSiteContext(slug);
  return { title: ctx ? `Classifieds · ${ctx.org.name}` : "Classifieds" };
}

/**
 * An org's classifieds page: `<org>.arts-collective.com/classifieds`.
 * Ads are made in /hub/sites/<slug>/classifieds by the org's owners and
 * guides; each can link to one of the org's threads or to any web address.
 * Without a saved page, visitors get a 404 and editors an invitation.
 */
export default async function SiteClassifiedsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await loadSiteContext(slug);
  if (!ctx) notFound();
  const { org, user, canEditSite, mainSiteUrl } = ctx;

  const doc = await loadClassifieds(org.id);
  if (!doc && !canEditSite) notFound();

  const fontsHref = doc ? classifiedsFontsHref(doc) : null;
  const editHref = `${ctx.proto}://${ctx.rootHost}/hub/sites/${encodeURIComponent(slug)}/classifieds`;
  const threads = new Map<string, LinkedThread>();
  if (doc?.ads.some((a) => a.link?.kind === "thread")) {
    for (const t of await getOrgFeed(org.id, 100)) threads.set(String(t.id), { id: String(t.id), slug: t.slug, title: t.title });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Only the web fonts this sheet uses (the shared font library builds the URL). */}
      {fontsHref && <link rel="stylesheet" href={fontsHref} precedence="default" />}
      <ThemeStyle orgId={org.id} pageKey="classifieds" />
      <SiteNav orgName={org.name} current="classifieds" mainSiteUrl={mainSiteUrl} signedIn={Boolean(user)} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {doc ? (
          <ClassifiedSheet doc={doc} orgName={org.name} threads={threads} />
        ) : (
          <div className="rounded-md border border-border p-8 text-center">
            <h1 className="font-serif text-2xl">{org.name} has no classifieds page yet</h1>
            <p className="mt-2 text-muted-foreground">Make one: a sheet of notices, each linking to a thread or anywhere on the web.</p>
            <a href={editHref} className="mt-4 inline-block underline underline-offset-4">Make the classifieds page →</a>
          </div>
        )}
      </main>
      {doc && canEditSite && (
        <a
          href={editHref}
          className="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-lg hover:bg-accent"
        >
          Edit classifieds
        </a>
      )}
      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
