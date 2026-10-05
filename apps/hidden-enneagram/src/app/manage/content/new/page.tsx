import Link from "next/link";
import { listOrgFeeds } from "@elkdonis/services";
import { ContentComposerBody } from "@/components/manage/content-composer-body";
import { siteConfig } from "@/config/site";

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
  const { feed, kind: kindParam } = await searchParams;
  const kind = kindParam === "service" || feed === "services" ? "service" : "post";
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  const options = feeds.map((f) => ({ slug: f.slug, name: f.name }));
  const initialFeed = feed && feeds.some((f) => f.slug === feed) ? feed : undefined;

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
        <ContentComposerBody
          key={kind}
          kind={kind}
          feeds={options}
          initialAnswers={initialFeed ? { feed_slug: initialFeed } : undefined}
        />
      </div>
    </div>
  );
}
