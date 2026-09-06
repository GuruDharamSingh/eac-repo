import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { canViewFeed, getOrgFeed } from "@elkdonis/services";
import { getThreadBySlug } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { SiteNav } from "@/components/site-nav";
import { siteConfig } from "@/config/site";

interface PageProps {
  params: Promise<{ page: string; slug: string }>;
}

function plain(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page: feedSlug, slug } = await params;
  const [feed, viewer] = await Promise.all([
    getOrgFeed(siteConfig.orgId, feedSlug),
    getViewer(),
  ]);
  if (!feed || !canViewFeed(feed, viewer?.role ?? null)) return {};

  const thread = await getThreadBySlug(feedSlug, slug, { isMember: Boolean(viewer?.isMember) });
  if (!thread) return {};

  const nonPublic = Boolean(feed.minRole) || thread.visibility === "ORGANIZATION";
  return {
    title: thread.title,
    description: thread.excerpt ?? plain(thread.description),
    robots: nonPublic ? { index: false, follow: false } : undefined,
    openGraph: thread.coverImageUrl ? { images: [thread.coverImageUrl] } : undefined,
  };
}

export default async function ThreadPage({ params }: PageProps) {
  const { page: feedSlug, slug } = await params;
  const [feed, viewer] = await Promise.all([
    getOrgFeed(siteConfig.orgId, feedSlug),
    getViewer(),
  ]);

  if (!feed || !canViewFeed(feed, viewer?.role ?? null)) notFound();

  // The read itself is member-aware, so an ORGANIZATION-visibility post inside
  // a public feed is equally unreachable to a signed-out visitor with the
  // direct link — the gate is the query, not the link.
  const thread = await getThreadBySlug(feedSlug, slug, {
    isMember: Boolean(viewer?.isMember),
  });
  if (!thread) notFound();

  const published = thread.publishedAt ?? thread.createdAt;

  return (
    <>
    <SiteNav />
    <main className="mx-auto max-w-[720px] px-6 py-16 font-sans">
    <article>
      <Link
        href={`/${feed.slug}`}
        className="text-xs uppercase tracking-[0.2em] text-muted-foreground no-underline hover:text-foreground"
      >
        ← {feed.name}
      </Link>

      {thread.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.coverImageUrl}
          alt=""
          className="mt-6 aspect-[21/9] w-full rounded-xl object-cover"
        />
      )}

      <h1 className="mt-8 font-serif text-4xl font-medium leading-[1.1]">{thread.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {thread.authorName && (
          <span>
            {thread.authorSlug ? (
              <Link href={`/about/${thread.authorSlug}`} className="hover:text-foreground">
                {thread.authorName}
              </Link>
            ) : (
              thread.authorName
            )}
          </span>
        )}
        <time dateTime={new Date(published).toISOString()}>
          {new Date(published).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        {thread.visibility === "ORGANIZATION" && (
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden />
            Members only
          </span>
        )}
      </div>

      {thread.description && (
        <div
          className="prose-enneagram mt-10 text-[17px]"
          dangerouslySetInnerHTML={{ __html: thread.description }}
        />
      )}
    </article>
    </main>
    </>
  );
}
