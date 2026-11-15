import Link from "next/link";
import { listOrgFeeds } from "@elkdonis/services";
import { SiteFormPageHost } from "@/components/manage/site-form-page";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export const metadata = { title: "New" };

/**
 * New post or service, on the shared composer. The kind is chosen here
 * (`?kind=service`), as the hub's compose catalogue does; `?feed=` preselects
 * the page it goes on.
 */
export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; kind?: string }>;
}) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { feed, kind: kindParam } = await searchParams;
  const kind = kindParam === "service" || feed === "services" ? "service" : "post";
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  const options = feeds.map((f) => ({ slug: f.slug, name: f.name }));

  return (
    <div>
      <h2 className="font-serif text-2xl">New</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {kind === "post" ? (
          <>
            Writing a post. <Link className="underline underline-offset-4" href="/manage/content/new?kind=service">Offer a service instead</Link>
          </>
        ) : (
          <>
            Offering a service people book and pay for.{" "}
            <Link className="underline underline-offset-4" href="/manage/content/new">Write a post instead</Link>
          </>
        )}
      </p>
      <div className="mt-6 max-w-2xl">
        {/* The shared form (@elkdonis/site-forms), 2026-11-14. `?feed=` is not carried over: pick the page in "Goes on". */}
        <SiteFormPageHost key={kind} kind={kind} feeds={options} />
      </div>
    </div>
  );
}
