import { notFound } from "next/navigation";
import { getServiceOfferingById, listOrgFeeds, serviceAnswersFromOffering } from "@elkdonis/services";
import { ContentComposerBody } from "@/components/manage/content-composer-body";
import { getThreadById } from "@/lib/data";
import { siteConfig } from "@/config/site";

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
  const { id } = await params;
  const [thread, feeds] = await Promise.all([
    getThreadById(id),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);
  if (!thread) notFound();

  const kind = thread.kind === "service" ? "service" : "post";
  const service = kind === "service" ? await getServiceOfferingById(siteConfig.orgId, thread.id) : null;

  const answers: Record<string, unknown> = {
    title: thread.title,
    excerpt: thread.excerpt ?? "",
    body: thread.description ?? "",
    cover_image_url: service?.coverImageUrl ?? thread.coverImageUrl ?? "",
    feed_slug: thread.feedSlug ?? undefined,
    visibility: thread.visibility === "ORGANIZATION" ? "ORGANIZATION" : "PUBLIC",
    ...(service
      ? {
          price: service.price ?? undefined,
          currency: service.currency,
          format: service.format ?? "online",
          ...serviceAnswersFromOffering(service),
        }
      : {}),
  };

  return (
    <div>
      <h2 className="font-serif text-2xl">{thread.title}</h2>
      <div className="mt-6 max-w-2xl">
        <ContentComposerBody
          kind={kind}
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))}
          initialAnswers={answers}
          threadId={thread.id}
        />
      </div>
    </div>
  );
}
