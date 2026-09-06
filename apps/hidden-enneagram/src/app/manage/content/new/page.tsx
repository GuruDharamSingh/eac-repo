import { listOrgFeeds } from "@elkdonis/services";
import { ContentForm } from "@/components/manage/content-form";
import { emptyDefaults } from "@/lib/cms/form-defaults";
import { siteConfig } from "@/config/site";

export const metadata = { title: "New" };

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const { feed } = await searchParams;
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  const initialFeed = feed && feeds.some((f) => f.slug === feed) ? feed : (feeds[0]?.slug ?? "writing");

  return (
    <div>
      <h2 className="font-serif text-2xl">New</h2>
      <div className="mt-6 max-w-2xl">
        <ContentForm
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name, minRole: f.minRole }))}
          defaults={emptyDefaults(initialFeed)}
        />
      </div>
    </div>
  );
}
