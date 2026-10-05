import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Article } from "@/blocks/article-blocks";
import { DiscussionView } from "@/blocks/discussion.client";
import { loadDiscussion, loadPost } from "@/lib/article-data";
import { renderPuckPage } from "@/lib/puck/render";

/**
 * An article that is a forum topic: `/read/<slug>`.
 *
 * Drawn from the `article-detail` template once one is published (edit it at
 * /edit/article-detail), otherwise as the article with its discussion beneath.
 * Only public topics in public feeds are shown (lib/article-data.ts); a draft
 * or a members-only topic is a 404 here. Replies are made on the forum, which
 * the discussion block links to.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.lede ?? undefined,
    openGraph: { title: post.title, description: post.lede ?? undefined, type: "article", images: post.coverImageUrl ? [post.coverImageUrl] : undefined },
  };
}

export default async function ReadPage({ params }: Props) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const designed = await renderPuckPage("article-detail", { template: true, metadata: { slug, threadId: post.id } });
  if (designed) return <main className="mx-auto max-w-6xl flex flex-col gap-14 px-6 py-10">{designed}</main>;

  const discussion = await loadDiscussion(post.id, 8);
  return (
    <main className="mx-auto max-w-4xl flex flex-col gap-14 px-6 py-10">
      <Article post={post} reading="journal" showCover />
      <DiscussionView discussion={discussion} />
    </main>
  );
}
