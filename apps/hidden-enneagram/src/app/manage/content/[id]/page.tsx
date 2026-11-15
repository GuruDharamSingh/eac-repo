import { notFound } from "next/navigation";
import { listOrgFeeds } from "@elkdonis/services";
import { SiteFormPageHost } from "@/components/manage/site-form-page";
import { getThreadById } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export const metadata = { title: "Edit" };

/**
 * Edit a post or service on the shared composer. The saved record becomes the
 * composer's answers: shared columns from the thread, a service's booking
 * fields from its workshop_pages sidecar (serviceAnswersFromOffering).
 */
export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const [thread, feeds] = await Promise.all([
    getThreadById(id),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);
  if (!thread) notFound();

  // Posts and services edit in the shared form (@elkdonis/site-forms), 2026-11-14.
  const kind = thread.kind === "service" ? "service" : "post";

  return (
    <div>
      <h2 className="font-serif text-2xl">{thread.title}</h2>
      <div className="mt-6 max-w-2xl">
        <SiteFormPageHost kind={kind} feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))} threadId={thread.id} />
      </div>
    </div>
  );
}
