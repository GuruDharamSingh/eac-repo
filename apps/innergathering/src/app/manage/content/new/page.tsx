import { redirect } from "next/navigation";
import { listOrgFeeds } from "@elkdonis/services";
import { SiteFormPageHost } from "@/components/manage/site-form-page";
import { ContentForm } from "@/components/manage/content-form";
import { emptyDefaults } from "@/lib/cms/form-defaults";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

interface NewContentPageProps {
  /** ?feed=yoga preselects a page — the "post to this section" entry point. */
  searchParams: Promise<{ feed?: string; kind?: string }>;
}

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const [{ feed, kind }, feeds] = await Promise.all([
    searchParams,
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);

  // Nothing can be published without somewhere to publish it to.
  if (feeds.length === 0) redirect("/manage/feeds");

  // `?kind=meeting|event|post|workshop`: the shared form (@elkdonis/site-forms); new items start members-only
  // (`defaultAudience` in lib/forms/site.tsx). Without it, the old form (2026-11-14).
  if (kind === "meeting" || kind === "event" || kind === "post" || kind === "workshop") {
    return (
      <>
        <h2 className="sr-only">New</h2>
        <div className="mt-6 max-w-3xl">
          <SiteFormPageHost kind={kind} feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))} />
        </div>
      </>
    );
  }

  const preselected = feeds.find((f) => f.slug === feed)?.slug ?? feeds[0].slug;

  return (
    <>
      <h2 className="font-serif text-2xl">New</h2>
      <div className="mt-6 max-w-3xl">
        <ContentForm
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name, presenter: f.presenter }))}
          defaults={emptyDefaults(preselected)}
        />
      </div>
    </>
  );
}
