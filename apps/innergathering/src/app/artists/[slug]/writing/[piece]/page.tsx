import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getProfileBySlug, getWritingPost } from "@elkdonis/services";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { hasProfileSection, isMember } from "@/lib/members";

/**
 * One piece, in the reading layer.
 *
 * Published only. A draft's title is not something to hand a crawler, and the
 * author edits from their own hub rather than from the public page.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; piece: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, piece } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) return {};
  const post = await getWritingPost(profile.userId, piece);
  if (!post) return {};
  return {
    title: `${post.title} — ${profile.displayName}`,
    description: post.lede ?? undefined,
    openGraph: {
      title: post.title,
      description: post.lede ?? undefined,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function MemberWritingPiecePage({ params }: Props) {
  const { slug, piece } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile || !(await isMember(profile.userId))) notFound();
  if (!(await hasProfileSection(profile.userId, "blog"))) notFound();

  const post = await getWritingPost(profile.userId, piece);
  if (!post) notFound();

  return (
    <main className="hub">
      <div className="hub-band">
        <p className="hub-kicker">
          <Link href={`/artists/${slug}/writing`}>
            ← {profile.displayName}&rsquo;s writing
          </Link>
        </p>
      </div>
      <ArticleView
        title={post.title}
        lede={post.lede}
        bodyHtml={post.bodyHtml}
        authorName={profile.displayName}
        publishedAt={post.publishedAt}
        coverImageUrl={post.coverImageUrl}
        readingMinutes={post.readingMinutes}
      />
    </main>
  );
}
