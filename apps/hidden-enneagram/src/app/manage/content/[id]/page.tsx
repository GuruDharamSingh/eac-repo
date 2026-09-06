import { notFound } from "next/navigation";
import { listOrgFeeds, getServiceOfferingById } from "@elkdonis/services";
import { ContentForm } from "@/components/manage/content-form";
import { serviceToDefaults, threadToDefaults } from "@/lib/cms/form-defaults";
import { getThreadById } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Edit" };

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [thread, feeds] = await Promise.all([
    getThreadById(id),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);
  if (!thread) notFound();

  // A service carries its pricing in the workshop_pages sidecar, so it needs
  // the fuller read; a post is entirely on the thread row.
  const defaults =
    thread.kind === "service"
      ? await getServiceOfferingById(siteConfig.orgId, thread.id).then((s) =>
          s ? serviceToDefaults(s) : threadToDefaults(thread)
        )
      : threadToDefaults(thread);

  return (
    <div>
      <h2 className="font-serif text-2xl">{thread.title}</h2>
      <div className="mt-6 max-w-2xl">
        <ContentForm
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name, minRole: f.minRole }))}
          defaults={defaults}
          threadId={thread.id}
        />
      </div>
    </div>
  );
}
