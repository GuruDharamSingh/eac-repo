import { redirect } from "next/navigation";
import { listOrgFeeds } from "@elkdonis/services";
import { ContentForm } from "@/components/manage/content-form";
import { emptyDefaults } from "@/lib/cms/form-defaults";
import { siteConfig } from "@/config/site";

interface NewContentPageProps {
  /** ?feed=yoga preselects a page — the "post to this section" entry point. */
  searchParams: Promise<{ feed?: string }>;
}

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  const [{ feed }, feeds] = await Promise.all([
    searchParams,
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);

  // Nothing can be published without somewhere to publish it to.
  if (feeds.length === 0) redirect("/manage/feeds");

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
