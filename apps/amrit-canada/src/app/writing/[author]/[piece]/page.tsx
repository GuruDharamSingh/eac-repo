import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getProfileBySlug, getWritingPost, isListedOn } from "@elkdonis/services";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { siteConfig } from "@/config/site";

/**
 * One published piece from the writing room. getWritingPost scopes by author
 * but not by org, so the org is checked here: a piece not shown on this site
 * (homed here or listed here, thread_orgs) is not served from this one. New
 * pieces are homed in `oad` and listed on the site they start from (2026-09-26).
 */
type Props = { params: Promise<{ author: string; piece: string }> };

async function load(author: string, piece: string) {
  const profile = await getProfileBySlug(author);
  if (!profile) return null;
  const post = await getWritingPost(profile.userId, piece);
  if (!post || !(await isListedOn(post.id, siteConfig.orgId))) return null;
  return { profile, post };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { author, piece } = await params;
  const found = await load(author, piece);
  if (!found) return {};
  return {
    title: `${found.post.title} — ${found.profile.displayName}`,
    description: found.post.lede ?? undefined,
  };
}

export default async function WritingPiecePage({ params }: Props) {
  const { author, piece } = await params;
  const found = await load(author, piece);
  if (!found) notFound();
  const { profile, post } = found;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href={`/writing/${author}`}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {profile.displayName}&rsquo;s writing
      </Link>
      <div className="mt-6">
        <ArticleView
          title={post.title}
          lede={post.lede}
          bodyHtml={post.bodyHtml}
          threadId={post.id}
          authorName={profile.displayName}
          publishedAt={post.publishedAt}
          coverImageUrl={post.coverImageUrl}
          video={post.video ? { src: post.video.src, poster: post.video.poster } : null}
          readingMinutes={post.readingMinutes}
        />
      </div>
    </div>
  );
}
